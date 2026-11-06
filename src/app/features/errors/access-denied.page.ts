import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ROLE_LABEL } from '@core/auth/auth.models';
import { AuthStore } from '@core/auth/auth.store';

import { StatusPageComponent } from './status-page.component';

@Component({
  selector: 'app-access-denied',
  imports: [StatusPageComponent],
  template: `
    <app-status-page title="Acceso denegado" [message]="message()" [actionLink]="store.home()">
      <span visual class="lock" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
      </span>
      @if (ruta()) {
        <code class="route mono">Ruta solicitada: {{ ruta() }}</code>
      }
    </app-status-page>
  `,
  styles: `
    .lock {
      display: grid;
      place-items: center;
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: color-mix(in srgb, var(--color-danger) 12%, transparent);
      color: var(--color-danger);
    }
    .lock svg {
      width: 30px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
    }
    .route {
      padding: 4px 10px;
      border-radius: 8px;
      font-size: 12px;
      background: color-mix(in srgb, var(--color-ink) 6%, transparent);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessDeniedPage {
  protected readonly store = inject(AuthStore);
  /** Ruta que se intentó abrir (query param). */
  readonly ruta = input<string>();

  protected readonly message = computed(() => {
    const role = this.store.role();
    return role
      ? `Tu cuenta de ${ROLE_LABEL[role]} no tiene permiso para ver esta sección.`
      : 'No tienes permiso para ver esta sección.';
  });
}
