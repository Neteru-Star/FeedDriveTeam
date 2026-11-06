import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface FareBreakdownItem {
  label: string;
  amount: number;
}

/** Tarifa como protagonista: cifra grande, chip de demanda y desglose proporcional. */
@Component({
  selector: 'app-fare-display',
  imports: [CurrencyPipe],
  template: `
    <div class="fare">
      <span class="label">Tarifa estimada</span>
      <strong class="amount display">{{ total() | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}</strong>
      @if (surge() > 1) {
        <span class="surge">Alta demanda ×{{ surge() }}</span>
      }
      @if (breakdown().length) {
        <ul>
          @for (item of breakdown(); track item.label) {
            <li>
              <span>{{ item.label }}</span>
              <span class="bar"><i [style.width.%]="(item.amount / max()) * 100"></i></span>
              <span class="mono">{{ item.amount | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}</span>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    .fare {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .label {
      color: var(--color-muted);
      font-size: 13px;
    }
    .amount {
      font-size: 44px;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }
    .surge {
      align-self: flex-start;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      color: #0f1a14;
      background: linear-gradient(90deg, var(--color-warning), var(--color-primary), var(--color-warning));
      background-size: 200% 100%;
      animation: shift 3s linear infinite;
    }
    ul {
      list-style: none;
      margin: 10px 0 0;
      padding: 0;
      display: grid;
      gap: 8px;
      font-size: 13px;
    }
    li {
      display: grid;
      grid-template-columns: 90px 1fr auto;
      align-items: center;
      gap: 10px;
    }
    .bar {
      height: 6px;
      border-radius: 6px;
      background: var(--color-primary-soft);
      overflow: hidden;
    }
    .bar i {
      display: block;
      height: 100%;
      border-radius: 6px;
      background: var(--color-primary-strong);
    }
    @keyframes shift {
      to {
        background-position: 200% 0;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FareDisplayComponent {
  readonly total = input.required<number>();
  readonly surge = input(1);
  readonly breakdown = input<FareBreakdownItem[]>([]);
  protected readonly max = computed(() => Math.max(1, ...this.breakdown().map((i) => i.amount)));
}
