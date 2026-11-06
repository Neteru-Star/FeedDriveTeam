import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Hoja de vidrio esmerilado que flota sobre el mapa o el fondo. */
@Component({
  selector: 'app-glass-card',
  template: '<ng-content />',
  styles: `
    :host {
      display: block;
      padding: 20px;
      border-radius: var(--radius-card);
      background: var(--color-card);
      border: 1px solid var(--color-card-border);
      box-shadow: var(--shadow-float);
      backdrop-filter: var(--blur-glass);
      -webkit-backdrop-filter: var(--blur-glass);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlassCardComponent {}
