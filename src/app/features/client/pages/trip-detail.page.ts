import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { IonModal } from '@ionic/angular/ion-modal';
import { IonSkeletonText } from '@ionic/angular/ion-skeleton-text';
import { PageHeaderComponent } from '@layout/page-header.component';
import { CurrencyCopPipe } from '@shared/pipes/format.pipes';
import { EmptyStateComponent } from '@shared/ui/empty-state/empty-state.component';
import { GlassCardComponent } from '@shared/ui/glass-card/glass-card.component';
import { PlateComponent } from '@shared/ui/plate/plate.component';
import { RatingStarsComponent } from '@shared/ui/rating-stars/rating-stars.component';
import { RouteLineComponent } from '@shared/ui/route-line/route-line.component';
import { StatusPillComponent } from '@shared/ui/status-pill/status-pill.component';
import { formatDistance } from '@shared/utils/geo';

import { RateTripComponent } from '../components/rate-trip.component';
import { TripHistoryStore } from '../data-access/trip-history.store';
import { rateTargetOf, tripDate } from '../data-access/trip-record';

/** Páginas que se recorren buscando un viaje que no está en las ya cargadas (enlace directo o recarga). */
const MAX_PAGES_TO_FIND = 5;

/** Detalle de un viaje del historial y su calificación (HU-08). */
@Component({
  selector: 'app-trip-detail',
  imports: [
    DatePipe,
    RouterLink,
    IonButton,
    IonContent,
    IonModal,
    IonSkeletonText,
    PageHeaderComponent,
    CurrencyCopPipe,
    EmptyStateComponent,
    GlassCardComponent,
    PlateComponent,
    RatingStarsComponent,
    RouteLineComponent,
    StatusPillComponent,
    RateTripComponent,
  ],
  template: `
    <app-page-header title="Detalle del viaje" backHref="/pasajero/viajes" />
    <ion-content>
      <main class="detail">
        @if (trip(); as t) {
          <app-glass-card>
            <div class="head">
              <app-status-pill [status]="t.status" />
              @if (date(); as d) {
                <span class="app-muted">{{ d | date: "d 'de' MMMM 'de' y, h:mm a" }}</span>
              }
            </div>
            @if (t.origin_name && t.destination_name) {
              <app-route-line [origin]="t.origin_name" [destination]="t.destination_name" />
            } @else {
              <h1>Viaje #{{ t.id }}</h1>
            }
            <dl>
              <dt>{{ t.final_fare === null ? 'Tarifa estimada' : 'Tarifa final' }}</dt>
              <dd class="mono">
                @if (t.final_fare ?? t.estimated_fare; as fare) {
                  {{ fare | currencyCop }}
                } @else {
                  Sin cobro
                }
              </dd>
              @if (t.distance_travelled_km) {
                <dt>Distancia recorrida</dt>
                <dd>{{ distance() }}</dd>
              }
              @if (t.duration_travelled_min) {
                <dt>Duración</dt>
                <dd>{{ t.duration_travelled_min }} min</dd>
              }
              @if (t.status === 'completed') {
                <dt>Pago</dt>
                <dd>Efectivo</dd>
              }
              @if (t.cancel_reason) {
                <dt>Motivo de cancelación</dt>
                <dd>{{ t.cancel_reason }}</dd>
              }
            </dl>
          </app-glass-card>

          @if (t.driver) {
            <app-glass-card>
              <h2>Conductor</h2>
              <div class="driver">
                <div>
                  <strong>{{ t.driver.user.name }}</strong>
                  @if (t.vehicle; as v) {
                    @if (v.brand) {
                      <small class="app-muted">{{ v.brand }} {{ v.model }} · {{ v.color }}</small>
                    }
                  }
                </div>
                @if (t.vehicle?.plate; as plate) {
                  <app-plate [value]="plate" />
                }
              </div>
            </app-glass-card>
          }

          @if (t.status === 'completed') {
            <app-glass-card>
              <h2>Tu calificación</h2>
              @if (rating(); as score) {
                <app-rating-stars [value]="score" [readonly]="true" />
                @if (t.rating?.comment; as comment) {
                  <p class="comment">“{{ comment }}”</p>
                }
              } @else if (rating() === 0) {
                <p class="app-muted">Ya calificaste este viaje.</p>
              } @else {
                <p class="app-muted">Cuéntanos cómo te fue para ayudar a otros pasajeros.</p>
                <ion-button expand="block" (click)="rateOpen.set(true)">Calificar viaje</ion-button>
              }
            </app-glass-card>
          }
        } @else if (searching()) {
          <div class="skeleton" aria-busy="true" aria-label="Cargando el viaje">
            <ion-skeleton-text [animated]="true" style="width: 40%" />
            <ion-skeleton-text [animated]="true" style="width: 90%; height: 22px" />
            <ion-skeleton-text [animated]="true" style="width: 60%" />
          </div>
        } @else {
          <app-empty-state title="No encontramos este viaje" message="Puede que ya no esté en tu historial.">
            <ion-button routerLink="/pasajero/viajes">Ver mis viajes</ion-button>
          </app-empty-state>
        }
      </main>
    </ion-content>

    <ion-modal [isOpen]="rateOpen()" (didDismiss)="rateOpen.set(false)">
      <ng-template>
        @if (trip(); as t) {
          <app-rate-trip [target]="rateTargetOf(t)" (done)="rateOpen.set(false)" (closed)="rateOpen.set(false)" />
        }
      </ng-template>
    </ion-modal>
  `,
  styles: `
    .detail {
      display: grid;
      gap: 14px;
      max-width: 640px;
      margin: 0 auto;
      padding: 8px 16px 32px;
    }
    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 14px;
      font-size: 13px;
    }
    h1 {
      margin: 0;
      font-size: 22px;
    }
    h2 {
      margin: 0 0 10px;
      font-size: 16px;
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 8px 16px;
      margin: 16px 0 0;
    }
    dt {
      color: var(--color-muted);
    }
    dd {
      margin: 0;
      text-align: right;
      font-weight: 600;
    }
    .driver {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .driver strong,
    .driver small {
      display: block;
    }
    .comment {
      margin: 8px 0 0;
      font-style: italic;
    }
    .skeleton {
      display: grid;
      gap: 10px;
      padding: 16px;
    }
    app-empty-state {
      display: block;
      margin-top: 15vh;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripDetailPage {
  protected readonly store = inject(TripHistoryStore);
  /** Parámetro `:id` de la ruta. */
  readonly id = input.required<string>();

  protected readonly searching = signal(true);
  protected readonly rateOpen = signal(false);
  protected readonly trip = computed(() => this.store.find(Number(this.id())));
  protected readonly date = computed(() => {
    const trip = this.trip();
    return trip ? tripDate(trip) : null;
  });
  protected readonly rating = computed(() => {
    const trip = this.trip();
    return trip ? this.store.ratingOf(trip) : null;
  });
  protected readonly distance = computed(() => formatDistance(this.trip()?.distance_travelled_km ?? 0));
  protected readonly rateTargetOf = rateTargetOf;

  constructor() {
    effect(() => {
      const id = Number(this.id());
      untracked(() => void this.findTrip(id));
    });
  }

  /** El viaje puede no estar en las páginas cargadas: se piden más hasta encontrarlo o agotar el historial. */
  private async findTrip(id: number): Promise<void> {
    this.searching.set(true);
    await this.store.ensureLoaded();
    for (let i = 0; i < MAX_PAGES_TO_FIND && !this.store.find(id) && this.store.hasMore(); i++) {
      await this.store.loadMore();
    }
    this.searching.set(false);
  }
}
