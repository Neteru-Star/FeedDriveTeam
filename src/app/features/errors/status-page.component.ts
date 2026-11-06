import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';

/** Pantalla centrada para errores de navegación (404, acceso denegado). */
@Component({
  selector: 'app-status-page',
  imports: [IonContent, IonButton, RouterLink],
  template: `
    <ion-content>
      <main class="status">
        <ng-content select="[visual]" />
        <h1>{{ title() }}</h1>
        <p class="app-muted">{{ message() }}</p>
        <ng-content />
        <ion-button [routerLink]="actionLink()">{{ actionLabel() }}</ion-button>
      </main>
    </ion-content>
  `,
  styles: `
    /* ion-content debe quedar como hijo directo de la página (.ion-page, flex) para tener alto y scroll. */
    :host {
      display: contents;
    }
    .status {
      min-height: 100%;
      max-width: 360px;
      margin: 0 auto;
      padding: 32px 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      text-align: center;
    }
    h1 {
      margin: 8px 0 0;
      font-size: 26px;
    }
    p {
      margin: 0 0 12px;
    }
    ion-button {
      align-self: stretch;
      margin-top: 8px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusPageComponent {
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly actionLabel = input('Volver al inicio');
  readonly actionLink = input('/');
}
