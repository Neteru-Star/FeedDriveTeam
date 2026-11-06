import { ChangeDetectionStrategy, Component } from '@angular/core';

import { StatusPageComponent } from './status-page.component';

@Component({
  selector: 'app-not-found',
  imports: [StatusPageComponent],
  template: `
    <app-status-page
      title="Página no encontrada"
      message="La dirección que abriste no existe o fue movida."
      actionLabel="Ir al inicio"
    >
      <span visual class="code display" aria-hidden="true">404</span>
    </app-status-page>
  `,
  styles: `
    .code {
      font-size: 96px;
      font-weight: 800;
      line-height: 1;
      background: linear-gradient(180deg, var(--color-ink), var(--color-primary-strong));
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundPage {}
