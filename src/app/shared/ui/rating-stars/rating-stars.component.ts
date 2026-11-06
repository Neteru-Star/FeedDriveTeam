import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

/** Estrellas de calificación. Con readonly=false funciona como control (1 a 5). */
@Component({
  selector: 'app-rating-stars',
  template: `
    <div class="stars" role="radiogroup" [attr.aria-label]="'Calificación ' + value() + ' de 5'">
      @for (star of stars; track star) {
        <button
          type="button"
          role="radio"
          [attr.aria-checked]="star === value()"
          [attr.aria-label]="star === 1 ? '1 estrella' : star + ' estrellas'"
          [class.on]="star <= value()"
          [disabled]="readonly()"
          (click)="value.set(star)"
        >
          ★
        </button>
      }
    </div>
  `,
  styles: `
    .stars {
      display: inline-flex;
      gap: 2px;
    }
    button {
      border: 0;
      padding: 0 2px;
      background: none;
      font-size: var(--star-size, 26px);
      line-height: 1;
      color: color-mix(in srgb, var(--color-muted) 35%, transparent);
      cursor: pointer;
      transition:
        transform var(--motion-fast),
        color var(--motion-fast);
    }
    button.on {
      color: var(--color-warning);
    }
    button:not(:disabled):hover {
      transform: scale(1.15);
    }
    button:disabled {
      cursor: default;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RatingStarsComponent {
  readonly value = model(0);
  readonly readonly = input(false);
  protected readonly stars = [1, 2, 3, 4, 5];
}
