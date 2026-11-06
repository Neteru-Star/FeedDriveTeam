import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/ion-content';
import { GlassCardComponent } from '@shared/ui/glass-card/glass-card.component';

/** Marco de las pantallas de acceso: marca, fondo con brillo verde y tarjeta de vidrio. */
@Component({
  selector: 'app-auth-layout',
  imports: [IonContent, RouterLink, GlassCardComponent],
  template: `
    <ion-content>
      <main class="auth">
        <div class="glow" aria-hidden="true"></div>
        <header>
          @if (backLink()) {
            <a class="back" [routerLink]="backLink()" aria-label="Volver">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
            </a>
          }
          <span class="brand display">Feed<b>Drive</b></span>
        </header>
        <app-glass-card class="panel">
          <ng-content />
        </app-glass-card>
      </main>
    </ion-content>
  `,
  styles: `
    /* ion-content debe quedar como hijo directo de la página (.ion-page, flex) para tener alto y scroll. */
    :host {
      display: contents;
    }
    .auth {
      position: relative;
      min-height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 20px;
      padding: 32px 20px;
      overflow: hidden;
    }
    .glow {
      position: absolute;
      top: -180px;
      right: -160px;
      width: 460px;
      height: 460px;
      border-radius: 50%;
      background: radial-gradient(circle, var(--color-primary) 0%, transparent 65%);
      opacity: 0.5;
      filter: blur(20px);
      pointer-events: none;
    }
    header {
      position: relative;
      width: min(440px, 100%);
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand {
      font-size: 30px;
      font-weight: 700;
      letter-spacing: -0.03em;
    }
    .brand b {
      color: var(--color-primary-strong);
    }
    .back {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--color-card);
      border: 1px solid var(--color-card-border);
      color: var(--color-ink);
    }
    .back svg {
      width: 20px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .panel {
      position: relative;
      width: min(440px, 100%);
      padding: 24px 20px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthLayoutComponent {
  readonly backLink = input<string>();
}
