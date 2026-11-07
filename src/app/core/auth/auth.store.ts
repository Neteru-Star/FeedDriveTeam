import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NavController } from '@ionic/angular/nav-controller';
import { ToastService } from '@shared/ui/toast/toast.service';

import { AuthApi } from './auth.api';
import {
  ROLE_HOME,
  type AuthResponse,
  type LoginPayload,
  type RegisterPayload,
  type StoredSession,
  type User,
} from './auth.models';
import { TokenStorage } from './token-storage';

const WARN_BEFORE_MS = 2 * 60_000;

/**
 * Sesión del usuario. El token JWT dura una hora y el backend no lo renueva:
 * se avisa 2 minutos antes de que venza y al vencer se cierra la sesión conservando la ruta de retorno.
 */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly api = inject(AuthApi);
  private readonly storage = inject(TokenStorage);
  private readonly router = inject(Router);
  // navigateRoot vacía la pila de páginas de Ionic: el shell del rol anterior no queda vivo en segundo plano.
  private readonly nav = inject(NavController);
  private readonly toast = inject(ToastService);

  private readonly session = signal<StoredSession | null>(null);
  private timers: ReturnType<typeof setTimeout>[] = [];

  private readonly logoutHooks = new Set<() => Promise<unknown>>();
  readonly user = computed(() => this.session()?.user ?? null);
  readonly token = computed(() => this.session()?.token ?? null);
  readonly role = computed(() => this.user()?.role ?? null);
  readonly isAuthenticated = computed(() => this.session() !== null);
  /** Pantalla inicial según el rol, o el login si no hay sesión. */
  readonly home = computed(() => {
    const role = this.role();
    return role ? ROLE_HOME[role] : '/login';
  });

  /** Recupera la sesión guardada al abrir la app. */
  async restore(): Promise<void> {
    const saved = await this.storage.load();
    if (!saved || saved.expiresAt <= Date.now()) {
      await this.storage.clear();
      return;
    }
    this.start(saved);
    // Valida el token sin bloquear el arranque: un 401 lo atiende el interceptor; sin red se conserva la sesión.
    this.api
      .me()
      .then((user) => this.updateUser(user))
      .catch(() => undefined);
  }

  async login(payload: LoginPayload): Promise<User> {
    const response = await this.api.login(payload);
    await this.open(response);
    return response.user;
  }

  /** Registra la cuenta. La HU-01 pide volver al login después, así que no abre sesión con el token devuelto. */
  async register(payload: RegisterPayload): Promise<void> {
    await this.api.register(payload);
  }

  /**
   * Tareas que deben correr antes de cerrar sesión, mientras el token aún sirve
   * (por ejemplo, desconectar al conductor). Devuelve la función para quitarla.
   */
  beforeLogout(hook: () => Promise<unknown>): () => void {
    this.logoutHooks.add(hook);
    return () => this.logoutHooks.delete(hook);
  }

  async logout(): Promise<void> {
    const token = this.token();
    // Si una tarea falla (sin conexión), igual se cierra la sesión.
    await Promise.allSettled([...this.logoutHooks].map((hook) => hook()));
    await this.clear();
    if (token) await this.api.logout(token).catch(() => undefined);
    await this.nav.navigateRoot('/login');
  }

  /** Cierra la sesión porque el token venció o el backend lo rechazó (401). */
  async expire(returnUrl?: string): Promise<void> {
    if (!this.session()) return;
    await this.clear();
    void this.toast.error('Tu sesión expiró. Inicia sesión de nuevo.');
    const keep = returnUrl && returnUrl !== '/login' ? { returnUrl } : {};
    await this.nav.navigateRoot(['/login'], { queryParams: keep });
  }

  private async open(response: AuthResponse): Promise<void> {
    const session: StoredSession = {
      token: response.access_token,
      expiresAt: Date.now() + response.expires_in * 1000,
      user: response.user,
    };
    await this.storage.save(session);
    this.start(session);
  }

  private start(session: StoredSession): void {
    this.session.set(session);
    this.clearTimers();
    const remaining = session.expiresAt - Date.now();
    if (remaining > WARN_BEFORE_MS) {
      this.timers.push(
        setTimeout(() => void this.toast.info('Tu sesión vence en 2 minutos.'), remaining - WARN_BEFORE_MS),
      );
    }
    this.timers.push(setTimeout(() => void this.expire(this.router.url), remaining));
  }

  private updateUser(user: User): void {
    const current = this.session();
    if (!current) return;
    const next = { ...current, user };
    this.session.set(next);
    void this.storage.save(next);
  }

  private async clear(): Promise<void> {
    this.clearTimers();
    this.session.set(null);
    await this.storage.clear();
  }

  private clearTimers(): void {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }
}
