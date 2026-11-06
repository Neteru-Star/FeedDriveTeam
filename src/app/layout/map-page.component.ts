import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';
import { IonContent } from '@ionic/angular/ion-content';

/**
 * Pantalla con mapa a pantalla completa: el mapa va al fondo, los botones flotantes arriba ([top]),
 * avisos encima del mapa ([overlay]) y el contenido principal en una hoja de vidrio abajo.
 * En pantallas anchas la hoja se vuelve un panel lateral flotante.
 */
@Component({
  selector: 'app-map-page',
  imports: [IonContent],
  template: `
    <ion-content [scrollY]="false">
      <div class="fd-stage">
        <ng-content select="app-map" />
        <div class="fd-top"><ng-content select="[top]" /></div>
        <ng-content select="[overlay]" />
        <section class="fd-sheet" [attr.aria-label]="sheetLabel()">
          <span class="fd-handle" aria-hidden="true"></span>
          <ng-content />
        </section>
      </div>
    </ion-content>
  `,
  styleUrl: 'map-page.component.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapPageComponent {
  readonly sheetLabel = input('Panel');
}
