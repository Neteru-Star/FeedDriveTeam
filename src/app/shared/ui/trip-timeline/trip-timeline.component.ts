import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CLIENT_TIMELINE, TRIP_STATUS, timelineIndex, type TripStatus } from '@shared/models/trip-status';

type StepState = 'done' | 'current' | 'pending';

/** Línea de tiempo del viaje del pasajero: Buscando conductor → … → Finalizado. */
@Component({
  selector: 'app-trip-timeline',
  template: `
    <ol aria-label="Progreso del viaje">
      @for (step of steps(); track step.status) {
        <li [attr.data-state]="step.state" [attr.aria-current]="step.state === 'current' ? 'step' : null">
          <span class="dot" aria-hidden="true">
            @if (step.state === 'done') {
              <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
            }
          </span>
          <span class="label">{{ step.label }}</span>
          @if (step.state === 'done') {
            <span class="sr-only">(completado)</span>
          }
        </li>
      }
    </ol>
  `,
  styles: `
    ol {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    li {
      position: relative;
      display: grid;
      justify-items: center;
      gap: 6px;
      text-align: center;
    }
    /* Conector hacia el paso anterior */
    li + li::before {
      content: '';
      position: absolute;
      top: 8px;
      right: 50%;
      width: 100%;
      height: 2px;
      background: var(--color-card-border);
      transition: background var(--motion-base);
    }
    li[data-state='done']::before,
    li[data-state='current']::before {
      background: var(--color-primary-strong);
    }
    .dot {
      position: relative;
      z-index: 1;
      display: grid;
      place-items: center;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 2px solid var(--color-card-border);
      background: var(--color-surface);
      transition:
        background var(--motion-base),
        border-color var(--motion-base);
    }
    [data-state='done'] .dot {
      border-color: var(--color-primary-strong);
      background: var(--color-primary-strong);
    }
    [data-state='current'] .dot {
      border-color: var(--color-primary-strong);
      box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-primary) 35%, transparent);
    }
    svg {
      width: 12px;
      fill: none;
      stroke: #0f1a14;
      stroke-width: 3;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .label {
      max-width: 72px;
      font-size: 11px;
      line-height: 1.25;
      color: var(--color-muted);
    }
    [data-state='current'] .label {
      color: var(--color-ink);
      font-weight: 600;
    }
    @media (prefers-reduced-motion: reduce) {
      li::before,
      .dot {
        transition: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripTimelineComponent {
  readonly status = input.required<TripStatus>();

  protected readonly steps = computed(() => {
    const status = this.status();
    const current = timelineIndex(status);
    return CLIENT_TIMELINE.map((step, index) => {
      // Al terminar, el último paso también cuenta como hecho.
      const state: StepState =
        index < current || (status === 'completed' && index === current)
          ? 'done'
          : index === current
            ? 'current'
            : 'pending';
      return { status: step, label: TRIP_STATUS[step].clientStep, state };
    });
  });
}
