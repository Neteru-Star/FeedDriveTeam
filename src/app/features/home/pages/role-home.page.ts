import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ROLE_LABEL } from '@core/auth/auth.models';
import { AuthStore } from '@core/auth/auth.store';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { GlassCardComponent } from '@shared/ui/glass-card/glass-card.component';

const NEXT: Record<string, string> = {
  client: 'Aquí verás el mapa para pedir tu viaje.',
  driver: 'Aquí podrás ponerte en línea y ver las solicitudes cercanas.',
  admin: 'Aquí verás el panel con las métricas y los conductores.',
};

/** Inicio de cada rol mientras se construyen sus pantallas (Fase 3 en adelante). */
@Component({
  selector: 'app-role-home',
  imports: [IonContent, IonButton, GlassCardComponent],
  template: `
    <ion-content>
      <main class="home">
        <div class="glow" aria-hidden="true"></div>
        <app-glass-card class="card">
          <span class="badge">{{ roleLabel() }}</span>
          <h1>Hola, {{ firstName() }}</h1>
          <p class="app-muted">{{ store.user()?.email }}</p>
          <p>{{ next() }}</p>
          <ion-button expand="block" fill="outline" color="dark" (click)="store.logout()">Cerrar sesión</ion-button>
        </app-glass-card>
      </main>
    </ion-content>
  `,
  styles: `
    .home {
      position: relative;
      min-height: 100%;
      display: grid;
      place-items: center;
      padding: 24px;
      overflow: hidden;
    }
    .glow {
      position: absolute;
      top: -180px;
      right: -160px;
      width: 460px;
      height: 460px;
      border-radius: 50%;
      background: radial-gradient(circle, var(--color-primary) 0%, transparent 65%);
      opacity: 0.5;
      filter: blur(20px);
    }
    .card {
      position: relative;
      width: min(420px, 100%);
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      text-transform: capitalize;
      background: var(--color-primary-soft);
    }
    h1 {
      margin: 12px 0 0;
      font-size: 34px;
    }
    p {
      margin: 6px 0 14px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoleHomePage {
  protected readonly store = inject(AuthStore);
  protected readonly firstName = computed(() => this.store.user()?.name.split(' ')[0] ?? '');
  protected readonly roleLabel = computed(() => {
    const role = this.store.role();
    return role ? ROLE_LABEL[role] : '';
  });
  protected readonly next = computed(() => NEXT[this.store.role() ?? ''] ?? '');
}
