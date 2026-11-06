import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TRIP_STATUS, type TripStatus } from '@shared/models/trip-status';

@Component({
  selector: 'app-status-pill',
  template: `
    <span class="pill" [attr.data-tone]="meta().tone" role="status">
      <span class="dot" [class.live]="meta().live"></span>
      {{ meta().label }}
    </span>
  `,
  styles: `
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 600;
      color: var(--tone);
      background: color-mix(in srgb, var(--tone) 14%, transparent);
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--tone);
    }
    .dot.live {
      animation: pulse 1.6s ease-out infinite;
    }
    [data-tone='warning'] {
      --tone: var(--color-warning);
    }
    [data-tone='info'] {
      --tone: var(--color-info);
    }
    [data-tone='violet'] {
      --tone: var(--color-violet);
    }
    [data-tone='primary'] {
      --tone: var(--color-primary-strong);
    }
    [data-tone='neutral'] {
      --tone: var(--color-muted);
    }
    [data-tone='danger'] {
      --tone: var(--color-danger);
    }
    @keyframes pulse {
      0% {
        box-shadow: 0 0 0 0 color-mix(in srgb, var(--tone) 60%, transparent);
      }
      100% {
        box-shadow: 0 0 0 8px transparent;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusPillComponent {
  readonly status = input.required<TripStatus>();
  protected readonly meta = computed(() => TRIP_STATUS[this.status()]);
}
