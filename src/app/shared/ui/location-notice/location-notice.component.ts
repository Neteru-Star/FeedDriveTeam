import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { LocationStatus } from '@core/location/location.service';
import { IonIcon } from '@ionic/angular/ion-icon';

/** Aviso flotante cuando no hay ubicación: el mapa se muestra en Bogotá y se ofrece reintentar. */
@Component({
  selector: 'app-location-notice',
  imports: [IonIcon],
  template: `
    <div class="notice" role="alert">
      <span class="icon" aria-hidden="true"><ion-icon name="location-outline" /></span>
      <div>
        <strong>{{ title() }}</strong>
        <p>{{ message() }}</p>
        <button type="button" (click)="retry.emit()">
          {{ status() === 'denied' ? 'Activar ubicación' : 'Reintentar' }}
        </button>
      </div>
    </div>
  `,
  styles: `
    .notice {
      display: flex;
      gap: 12px;
      margin: 72px 14px 0;
      padding: 14px 16px;
      border-radius: var(--radius-card);
      border: 1px solid var(--color-card-border);
      background: var(--color-card);
      backdrop-filter: var(--blur-glass);
      -webkit-backdrop-filter: var(--blur-glass);
      box-shadow: var(--shadow-float);
      position: relative;
      z-index: 550;
    }
    .icon {
      flex: none;
      display: grid;
      place-items: center;
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: color-mix(in srgb, var(--color-danger) 12%, transparent);
      color: var(--color-danger);
      font-size: 20px;
    }
    p {
      margin: 4px 0 6px;
      color: var(--color-muted);
      font-size: 13px;
    }
    button {
      padding: 0;
      border: 0;
      background: none;
      color: var(--color-ink);
      font: inherit;
      font-weight: 700;
      font-size: 14px;
      text-decoration: underline;
      text-decoration-color: var(--color-primary-strong);
      text-decoration-thickness: 2px;
      text-underline-offset: 3px;
      cursor: pointer;
    }
    @media (min-width: 900px) {
      .notice {
        position: absolute;
        top: 0;
        right: 20px;
        width: 360px;
        margin: 80px 0 0;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocationNoticeComponent {
  readonly status = input.required<LocationStatus>();
  /** Texto según el rol: para qué sirve la ubicación en esta pantalla. */
  readonly purpose = input('llenar tu origen automáticamente');
  readonly retry = output();

  protected readonly title = computed(() =>
    this.status() === 'denied' ? 'Activa tu ubicación' : 'No pudimos ubicarte',
  );
  protected readonly message = computed(() =>
    this.status() === 'denied'
      ? `Sin permiso, el mapa se muestra en Bogotá. Actívala para ${this.purpose()}.`
      : `Revisa que el GPS esté encendido. Mientras tanto, el mapa se muestra en Bogotá.`,
  );
}
