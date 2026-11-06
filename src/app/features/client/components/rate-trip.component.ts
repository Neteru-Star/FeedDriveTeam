import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { IonButton } from '@ionic/angular/ion-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToggle } from '@ionic/angular/ion-toggle';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { PlateComponent } from '@shared/ui/plate/plate.component';
import { RatingStarsComponent } from '@shared/ui/rating-stars/rating-stars.component';

import { RATING_COMMENT_MAX, TripHistoryStore, type RateResult } from '../data-access/trip-history.store';
import type { RateTarget } from '../data-access/trip-record';

const SCORE_LABEL = ['', 'Muy malo', 'Malo', 'Regular', 'Bueno', 'Excelente'];

/** Calificación del viaje (HU-08): estrellas, comentario y reporte de incidente. Va dentro de un `ion-modal`. */
@Component({
  selector: 'app-rate-trip',
  imports: [
    DatePipe,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonToggle,
    PlateComponent,
    RatingStarsComponent,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>Califica tu viaje</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="closed.emit()">Ahora no</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <form class="rate" (submit)="$event.preventDefault(); submit()">
        <div class="who">
          <span class="avatar" aria-hidden="true">{{ initials() }}</span>
          <h2>¿Cómo te fue con {{ target().driverName }}?</h2>
          <p class="app-muted">
            @if (target().date; as date) {
              {{ date | date: "d 'de' MMMM, h:mm a" }}
            }
          </p>
          @if (target().plate; as plate) {
            <app-plate [value]="plate" />
          }
        </div>

        <fieldset class="stars">
          <legend class="sr-only">Calificación de 1 a 5 estrellas</legend>
          <app-rating-stars [(value)]="score" style="--star-size: 42px" />
          <p class="score-label" aria-live="polite">{{ scoreLabel() }}</p>
        </fieldset>

        <ion-toggle
          class="incident"
          justify="space-between"
          [checked]="incident()"
          (ionChange)="incident.set($event.detail.checked)"
        >
          Reportar un problema en el viaje
        </ion-toggle>

        <label class="field">
          <span>{{ incident() ? 'Cuéntanos qué pasó' : 'Comentario (opcional)' }}</span>
          <textarea
            rows="4"
            [attr.maxlength]="max"
            [value]="comment()"
            [attr.aria-invalid]="commentMissing() || null"
            [placeholder]="incident() ? 'Describe el problema' : '¿Algo que quieras destacar?'"
            (input)="comment.set($any($event.target).value)"
          ></textarea>
          <small class="app-muted">{{ comment().length }}/{{ max }}</small>
        </label>
        @if (commentMissing()) {
          <p class="error" role="alert">Describe el problema para poder revisarlo.</p>
        }

        <ion-button type="submit" expand="block" [disabled]="!canSubmit() || sending()">
          {{ sending() ? 'Enviando…' : 'Enviar calificación' }}
        </ion-button>
      </form>
    </ion-content>
  `,
  styles: `
    :host {
      display: contents;
    }
    .rate {
      max-width: 480px;
      margin: 0 auto;
    }
    .who {
      display: grid;
      justify-items: center;
      gap: 6px;
      text-align: center;
      margin-bottom: 8px;
    }
    .who h2 {
      margin: 6px 0 0;
      font-size: 20px;
    }
    .who p {
      margin: 0;
      font-size: 13px;
    }
    .avatar {
      display: grid;
      place-items: center;
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: var(--color-primary);
      color: #0f1a14;
      font-weight: 700;
      font-size: 20px;
    }
    .stars {
      display: grid;
      justify-items: center;
      margin: 12px 0 8px;
      padding: 0;
      border: 0;
    }
    .score-label {
      min-height: 20px;
      margin: 4px 0 0;
      font-weight: 600;
    }
    .incident {
      margin: 8px 0 16px;
    }
    .field {
      display: grid;
      gap: 6px;
      font-size: 14px;
      font-weight: 600;
    }
    .field small {
      justify-self: end;
      font-weight: 400;
    }
    textarea {
      width: 100%;
      padding: 12px;
      border: 1px solid var(--color-card-border);
      border-radius: 12px;
      font: inherit;
      font-weight: 400;
      color: var(--color-ink);
      background: color-mix(in srgb, var(--color-ink) 4%, transparent);
      resize: vertical;
    }
    textarea:focus-visible {
      outline: 2px solid var(--color-primary-strong);
      outline-offset: 1px;
    }
    textarea[aria-invalid='true'] {
      border-color: var(--color-danger);
    }
    .error {
      margin: 6px 0 0;
      font-size: 13px;
      color: var(--color-danger);
    }
    ion-button {
      margin-top: 20px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RateTripComponent {
  private readonly history = inject(TripHistoryStore);

  readonly target = input.required<RateTarget>();
  /** Terminó la calificación: enviada, o el backend dijo que ya estaba calificado. */
  readonly done = output<RateResult>();
  readonly closed = output();

  protected readonly max = RATING_COMMENT_MAX;
  protected readonly score = signal(0);
  protected readonly comment = signal('');
  protected readonly incident = signal(false);
  protected readonly sending = signal(false);

  protected readonly scoreLabel = computed(() => SCORE_LABEL[this.score()] ?? '');
  /** Un incidente sin descripción no le sirve al administrador para revisarlo. */
  protected readonly commentMissing = computed(() => this.incident() && this.comment().trim() === '');
  protected readonly canSubmit = computed(() => this.score() >= 1 && !this.commentMissing());
  protected readonly initials = computed(() =>
    this.target()
      .driverName.split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join(''),
  );

  protected async submit(): Promise<void> {
    if (!this.canSubmit() || this.sending()) return;
    this.sending.set(true);
    const result = await this.history.rate(this.target().id, {
      score: this.score(),
      comment: this.comment(),
      has_incident: this.incident(),
    });
    this.sending.set(false);
    if (result !== 'failed') this.done.emit(result);
  }
}
