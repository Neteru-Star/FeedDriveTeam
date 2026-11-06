import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IonButton } from '@ionic/angular/ion-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonSkeletonText } from '@ionic/angular/ion-skeleton-text';
import { CurrencyCopPipe, DistanceKmPipe, DurationPipe } from '@shared/pipes/format.pipes';
import { FareDisplayComponent } from '@shared/ui/fare-display/fare-display.component';
import { RouteLineComponent } from '@shared/ui/route-line/route-line.component';

import { fareBreakdown } from '../data-access/fare-breakdown';
import type { QuoteState } from '../data-access/fare-quote.store';

/** "Confirma tu viaje": tarifa estimada con desglose, error con reintento y botón para solicitar (HU-03). */
@Component({
  selector: 'app-fare-confirm',
  imports: [
    IonButton,
    IonIcon,
    IonSkeletonText,
    CurrencyCopPipe,
    DistanceKmPipe,
    DurationPipe,
    FareDisplayComponent,
    RouteLineComponent,
  ],
  templateUrl: 'fare-confirm.component.html',
  styleUrl: 'fare-confirm.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FareConfirmComponent {
  readonly quote = input.required<QuoteState>();
  readonly origin = input.required<string>();
  readonly destination = input.required<string>();
  readonly requesting = input(false);

  readonly confirm = output();
  readonly retry = output();
  readonly back = output();

  protected readonly estimate = computed(() => {
    const quote = this.quote();
    return quote.status === 'ready' ? quote.estimate : null;
  });
  protected readonly breakdown = computed(() => {
    const estimate = this.estimate();
    return estimate ? fareBreakdown(estimate) : [];
  });
  protected readonly surge = computed(() => this.estimate()?.fare_breakdown.surge_multiplier ?? 1);
  protected readonly errorMessage = computed(() => {
    const quote = this.quote();
    return quote.status === 'error' ? quote.message : '';
  });
}
