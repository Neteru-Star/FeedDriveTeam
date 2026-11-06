import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Línea de ruta viva: origen y destino unidos por una línea verde con pulso. */
@Component({
  selector: 'app-route-line',
  template: `
    <div class="route">
      <div class="track" aria-hidden="true">
        <span class="node origin"></span>
        <span class="line"><i></i></span>
        <span class="node destination"></span>
      </div>
      <div class="stops">
        <p><small>Origen</small>{{ origin() }}</p>
        <p><small>Destino</small>{{ destination() }}</p>
      </div>
    </div>
  `,
  styles: `
    .route {
      display: flex;
      gap: 14px;
    }
    .track {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 6px 0;
    }
    .node {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 3px solid var(--color-ink);
      background: var(--color-primary);
    }
    .destination {
      border-radius: 4px;
      background: var(--color-ink);
    }
    .line {
      position: relative;
      flex: 1;
      width: 4px;
      min-height: 34px;
      margin: 4px 0;
      border-radius: 4px;
      background: var(--color-primary-soft);
      overflow: hidden;
    }
    .line i {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, transparent, var(--color-primary-strong), transparent);
      animation: flow 1.8s ease-in-out infinite;
    }
    .stops {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 14px;
    }
    p {
      margin: 0;
      font-weight: 600;
    }
    small {
      display: block;
      font-weight: 400;
      font-size: 12px;
      color: var(--color-muted);
    }
    @keyframes flow {
      from {
        transform: translateY(-100%);
      }
      to {
        transform: translateY(100%);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RouteLineComponent {
  readonly origin = input.required<string>();
  readonly destination = input.required<string>();
}
