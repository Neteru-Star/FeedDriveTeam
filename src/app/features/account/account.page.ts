import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ROLE_LABEL } from '@core/auth/auth.models';
import { AuthStore } from '@core/auth/auth.store';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { PageHeaderComponent } from '@layout/page-header.component';
import { GlassCardComponent } from '@shared/ui/glass-card/glass-card.component';

/** Datos de la cuenta y cierre de sesión, para los tres roles. */
@Component({
  selector: 'app-account',
  imports: [IonContent, IonButton, PageHeaderComponent, GlassCardComponent],
  template: `
    <app-page-header title="Cuenta" />
    <ion-content>
      <main class="account">
        <app-glass-card>
          <span class="badge">{{ roleLabel() }}</span>
          <h1>{{ store.user()?.name }}</h1>
          <dl>
            <dt>Correo</dt>
            <dd>{{ store.user()?.email }}</dd>
            @if (store.user()?.phone) {
              <dt>Celular</dt>
              <dd>{{ store.user()?.phone }}</dd>
            }
          </dl>
          <ion-button expand="block" fill="outline" color="danger" (click)="store.logout()">Cerrar sesión</ion-button>
        </app-glass-card>
      </main>
    </ion-content>
  `,
  styles: `
    .account {
      max-width: 520px;
      margin: 0 auto;
      padding: 12px 16px 32px;
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
      margin: 12px 0 16px;
      font-size: 28px;
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 8px 16px;
      margin: 0 0 20px;
    }
    dt {
      color: var(--color-muted);
    }
    dd {
      margin: 0;
      font-weight: 600;
      word-break: break-word;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountPage {
  protected readonly store = inject(AuthStore);
  protected readonly roleLabel = computed(() => {
    const role = this.store.role();
    return role ? ROLE_LABEL[role] : '';
  });
}
