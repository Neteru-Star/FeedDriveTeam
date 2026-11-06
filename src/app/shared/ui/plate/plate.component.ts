import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Placa vehicular colombiana: amarilla, borde negro, tipografía mono. */
@Component({
  selector: 'app-plate',
  template: `
    <span class="plate mono" [attr.aria-label]="'Placa ' + formatted()">
      {{ formatted() }}
      @if (city()) {
        <small>{{ city() }}</small>
      }
    </span>
  `,
  styles: `
    .plate {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      padding: 4px 14px 2px;
      border: 2.5px solid #111;
      border-radius: 8px;
      background: linear-gradient(180deg, #ffd43b, #f5c400);
      color: #111;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: 0.08em;
      line-height: 1.1;
      box-shadow:
        inset 0 0 0 2px #f5c400,
        0 2px 6px rgba(0, 0, 0, 0.2);
    }
    small {
      font-size: 9px;
      letter-spacing: 0.2em;
      text-transform: uppercase;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlateComponent {
  readonly value = input.required<string>();
  readonly city = input<string>('');

  protected readonly formatted = computed(() => {
    const clean = this.value()
      .replace(/[^a-z0-9]/gi, '')
      .toUpperCase();
    return clean.length > 3 ? `${clean.slice(0, 3)}·${clean.slice(3)}` : clean;
  });
}
