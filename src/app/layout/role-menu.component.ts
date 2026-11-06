import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ROLE_LABEL } from '@core/auth/auth.models';
import { AuthStore } from '@core/auth/auth.store';
import { IonContent } from '@ionic/angular/ion-content';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonMenuToggle } from '@ionic/angular/ion-menu-toggle';

export interface MenuItem {
  label: string;
  /** Nombre de un icono registrado con addIcons. */
  icon: string;
  link: string;
  /** Coincidencia exacta para marcar el enlace activo (rutas raíz del rol). */
  exact?: boolean;
}

/** Contenido del menú lateral: usuario, enlaces del rol y cerrar sesión. Va dentro de un ion-menu del shell. */
@Component({
  selector: 'app-role-menu',
  imports: [IonContent, IonIcon, IonMenuToggle, RouterLink, RouterLinkActive],
  template: `
    <ion-content>
      <div class="menu">
        <div class="user">
          <span class="avatar" aria-hidden="true">{{ initials() }}</span>
          <div>
            <strong>{{ store.user()?.name }}</strong>
            <small>{{ roleLabel() }}</small>
          </div>
        </div>
        <nav aria-label="Menú principal">
          @for (item of items(); track item.link) {
            <ion-menu-toggle [autoHide]="false">
              <a
                [routerLink]="item.link"
                routerLinkActive="active"
                [routerLinkActiveOptions]="{ exact: item.exact ?? false }"
                ariaCurrentWhenActive="page"
              >
                <ion-icon [name]="item.icon" aria-hidden="true" />
                {{ item.label }}
              </a>
            </ion-menu-toggle>
          }
        </nav>
        <ion-menu-toggle [autoHide]="false" class="logout">
          <button type="button" (click)="store.logout()">
            <ion-icon name="log-out-outline" aria-hidden="true" />
            Cerrar sesión
          </button>
        </ion-menu-toggle>
      </div>
    </ion-content>
  `,
  styles: `
    /* ion-content debe quedar como hijo directo del ion-menu para tener alto. */
    :host {
      display: contents;
    }
    ion-content {
      --background: var(--color-surface);
    }
    .menu {
      min-height: 100%;
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 28px 14px 18px;
    }
    .user {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 8px 18px;
    }
    .user strong,
    .user small {
      display: block;
    }
    .user small {
      color: var(--color-muted);
      text-transform: capitalize;
    }
    .avatar {
      display: grid;
      place-items: center;
      width: 46px;
      height: 46px;
      border-radius: 50%;
      background: var(--color-primary);
      color: #0f1a14;
      font-weight: 700;
    }
    nav {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    a,
    button {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      min-height: 46px;
      padding: 0 12px;
      border: 0;
      border-radius: 12px;
      background: none;
      color: var(--color-ink);
      font: inherit;
      font-weight: 600;
      text-decoration: none;
      cursor: pointer;
    }
    a:hover,
    button:hover {
      background: color-mix(in srgb, var(--color-ink) 6%, transparent);
    }
    a.active {
      background: var(--color-primary-soft);
    }
    ion-icon {
      font-size: 20px;
    }
    .logout {
      margin-top: auto;
    }
    .logout button {
      color: var(--color-danger);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoleMenuComponent {
  protected readonly store = inject(AuthStore);
  readonly items = input.required<MenuItem[]>();

  protected readonly initials = computed(() =>
    (this.store.user()?.name ?? '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join(''),
  );
  protected readonly roleLabel = computed(() => {
    const role = this.store.role();
    return role ? ROLE_LABEL[role] : '';
  });
}
