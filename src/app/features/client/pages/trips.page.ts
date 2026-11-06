import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { IonInfiniteScroll } from '@ionic/angular/ion-infinite-scroll';
import { IonInfiniteScrollContent } from '@ionic/angular/ion-infinite-scroll-content';
import { IonModal } from '@ionic/angular/ion-modal';
import { IonRefresher } from '@ionic/angular/ion-refresher';
import { IonRefresherContent } from '@ionic/angular/ion-refresher-content';
import { IonSkeletonText } from '@ionic/angular/ion-skeleton-text';
import type { InfiniteScrollCustomEvent, RefresherCustomEvent } from '@ionic/core';
import { PageHeaderComponent } from '@layout/page-header.component';
import { EmptyStateComponent } from '@shared/ui/empty-state/empty-state.component';

import { RateTripComponent } from '../components/rate-trip.component';
import { TripCardComponent } from '../components/trip-card.component';
import type { TripRecord } from '../data-access/client.models';
import { TripHistoryStore } from '../data-access/trip-history.store';
import { rateTargetOf, type RateTarget } from '../data-access/trip-record';

/** Historial de viajes del pasajero (HU-08), con actualizar al deslizar y scroll infinito. */
@Component({
  selector: 'app-trips',
  imports: [
    RouterLink,
    IonButton,
    IonContent,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonModal,
    IonRefresher,
    IonRefresherContent,
    IonSkeletonText,
    PageHeaderComponent,
    EmptyStateComponent,
    RateTripComponent,
    TripCardComponent,
  ],
  template: `
    <app-page-header title="Mis viajes" />
    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content pullingText="Desliza para actualizar" refreshingSpinner="crescent" />
      </ion-refresher>
      <main class="trips">
        @switch (store.status()) {
          @case ('error') {
            <app-empty-state title="No pudimos cargar tus viajes" message="Revisa tu conexión e inténtalo de nuevo.">
              <ion-button (click)="store.refresh()">Reintentar</ion-button>
            </app-empty-state>
          }
          @case ('ready') {
            @if (store.empty()) {
              <app-empty-state title="Aún no tienes viajes" message="Cuando pidas tu primer viaje, aparecerá aquí.">
                <ion-button routerLink="/pasajero">Pedir un viaje</ion-button>
              </app-empty-state>
            } @else {
              <ul aria-label="Viajes">
                @for (trip of store.trips(); track trip.id) {
                  <li>
                    <app-trip-card
                      [trip]="trip"
                      [rating]="store.ratingOf(trip)"
                      [canRate]="store.canRate(trip)"
                      (rate)="openRating(trip)"
                    />
                  </li>
                }
              </ul>
              @if (!store.hasMore()) {
                <p class="end app-muted">No hay más viajes.</p>
              }
            }
          }
          @default {
            <ul aria-label="Cargando viajes" aria-busy="true">
              @for (n of [1, 2, 3]; track n) {
                <li class="skeleton">
                  <ion-skeleton-text [animated]="true" style="width: 40%" />
                  <ion-skeleton-text [animated]="true" style="width: 85%; height: 18px" />
                  <ion-skeleton-text [animated]="true" style="width: 30%" />
                </li>
              }
            </ul>
          }
        }
      </main>
      <ion-infinite-scroll [disabled]="!store.hasMore() || store.status() !== 'ready'" (ionInfinite)="loadMore($event)">
        <ion-infinite-scroll-content loadingText="Cargando más viajes…" />
      </ion-infinite-scroll>
    </ion-content>

    <ion-modal [isOpen]="rateOpen()" (didDismiss)="closeRating()">
      <ng-template>
        @if (rateTarget(); as target) {
          <app-rate-trip [target]="target" (done)="rateOpen.set(false)" (closed)="rateOpen.set(false)" />
        }
      </ng-template>
    </ion-modal>
  `,
  styles: `
    .trips {
      max-width: 640px;
      margin: 0 auto;
      padding: 8px 16px 24px;
    }
    ul {
      display: grid;
      gap: 12px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .skeleton {
      display: grid;
      gap: 8px;
      padding: 16px;
      border-radius: 18px;
      background: var(--color-card);
    }
    .end {
      margin: 20px 0 0;
      text-align: center;
      font-size: 13px;
    }
    app-empty-state {
      display: block;
      margin-top: 15vh;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripsPage {
  protected readonly store = inject(TripHistoryStore);
  protected readonly rateTarget = signal<RateTarget | null>(null);
  protected readonly rateOpen = signal(false);

  constructor() {
    // Siempre se actualiza al entrar: puede haber terminado un viaje desde la última visita.
    void this.store.refresh();
  }

  protected async refresh(event: RefresherCustomEvent): Promise<void> {
    await this.store.refresh();
    await event.target.complete();
  }

  protected async loadMore(event: InfiniteScrollCustomEvent): Promise<void> {
    await this.store.loadMore();
    await event.target.complete();
  }

  protected openRating(trip: TripRecord): void {
    this.rateTarget.set(rateTargetOf(trip));
    this.rateOpen.set(true);
  }

  protected closeRating(): void {
    this.rateOpen.set(false);
    this.rateTarget.set(null);
  }
}
