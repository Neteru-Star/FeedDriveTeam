import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { CurrencyCopPipe } from '@shared/pipes/format.pipes';
import { RatingStarsComponent } from '@shared/ui/rating-stars/rating-stars.component';
import { StatusPillComponent } from '@shared/ui/status-pill/status-pill.component';

import type { TripRecord } from '../data-access/client.models';
import { tripDate, tripTitle } from '../data-access/trip-record';

/** Tarjeta de un viaje del historial. Toda la tarjeta abre el detalle; "Calificar" es un botón aparte. */
@Component({
  selector: 'app-trip-card',
  imports: [DatePipe, RouterLink, IonButton, CurrencyCopPipe, RatingStarsComponent, StatusPillComponent],
  template: `
    <article class="card">
      <div class="top">
        <span class="date app-muted">
          @if (date(); as d) {
            {{ d | date: 'd MMM y · h:mm a' }}
          }
        </span>
        <app-status-pill [status]="trip().status" />
      </div>
      <a class="title" [routerLink]="['/pasajero/viajes', trip().id]">{{ title() }}</a>
      @if (trip().driver || trip().vehicle) {
        <p class="meta app-muted">
          {{ trip().driver?.user?.name }}
          @if (trip().vehicle?.plate; as plate) {
            · <span class="mono">{{ plate }}</span>
          }
        </p>
      }
      <div class="bottom">
        @if (fare(); as amount) {
          <strong class="mono">{{ amount | currencyCop }}</strong>
        } @else {
          <span class="app-muted">Sin cobro</span>
        }
        @if (rating(); as score) {
          <app-rating-stars [value]="score" [readonly]="true" style="--star-size: 16px" />
        } @else if (rating() === 0) {
          <span class="app-muted rated">Calificado</span>
        } @else if (canRate()) {
          <ion-button size="small" (click)="rate.emit()">Calificar</ion-button>
        }
      </div>
    </article>
  `,
  styles: `
    .card {
      position: relative;
      padding: 14px 16px;
      border: 1px solid var(--color-card-border);
      border-radius: 18px;
      background: var(--color-card);
      transition: border-color var(--motion-fast);
    }
    .card:has(.title:hover) {
      border-color: var(--color-primary-strong);
    }
    .top,
    .bottom {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .date {
      font-size: 12px;
    }
    .title {
      display: block;
      margin: 10px 0 2px;
      font-weight: 700;
      color: var(--color-ink);
      text-decoration: none;
    }
    /* Toda la tarjeta es el enlace, salvo el botón de calificar que queda encima. */
    .title::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
    }
    .title:focus-visible {
      outline: none;
    }
    .title:focus-visible::after {
      outline: 2px solid var(--color-primary-strong);
      outline-offset: 2px;
    }
    .meta {
      margin: 0 0 10px;
      font-size: 13px;
    }
    .bottom strong {
      font-size: 17px;
    }
    .bottom ion-button,
    .bottom app-rating-stars {
      position: relative;
      z-index: 1;
    }
    .rated {
      font-size: 13px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripCardComponent {
  readonly trip = input.required<TripRecord>();
  /** Estrellas dadas, 0 si se sabe calificado sin cuántas, null si no se ha calificado. */
  readonly rating = input<number | null>(null);
  readonly canRate = input(false);
  readonly rate = output();

  protected readonly title = computed(() => tripTitle(this.trip()));
  protected readonly date = computed(() => tripDate(this.trip()));
  protected readonly fare = computed(
    () => this.trip().final_fare ?? (this.trip().status === 'completed' ? this.trip().estimated_fare : null) ?? null,
  );
}
