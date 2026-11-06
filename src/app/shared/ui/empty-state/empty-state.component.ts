import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  template: `
    <div class="empty">
      <svg viewBox="0 0 120 60" aria-hidden="true">
        <path d="M10 50 C 40 50, 40 10, 70 10 S 100 30, 110 10" />
        <circle cx="10" cy="50" r="6" />
        <circle cx="110" cy="10" r="6" />
      </svg>
      <h3>{{ title() }}</h3>
      <p>{{ message() }}</p>
      <ng-content />
    </div>
  `,
  styles: `
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 24px;
      gap: 6px;
    }
    svg {
      width: 120px;
      margin-bottom: 8px;
    }
    path {
      fill: none;
      stroke: var(--color-primary-strong);
      stroke-width: 4;
      stroke-linecap: round;
      stroke-dasharray: 6 8;
    }
    circle {
      fill: var(--color-primary);
      stroke: var(--color-ink);
      stroke-width: 2;
    }
    h3 {
      margin: 0;
    }
    p {
      margin: 0;
      color: var(--color-muted);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyStateComponent {
  readonly title = input.required<string>();
  readonly message = input('');
}
