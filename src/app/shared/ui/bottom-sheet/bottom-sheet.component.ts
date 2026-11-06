import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IonContent } from '@ionic/angular/ion-content';
import { IonModal } from '@ionic/angular/ion-modal';

/**
 * Hoja inferior de vidrio sobre el mapa. Por debajo de `backdropBreakpoint` el mapa sigue siendo interactivo.
 * Por defecto no se cierra tocando fuera: la pantalla decide cuándo cerrarla.
 */
@Component({
  selector: 'app-bottom-sheet',
  imports: [IonModal, IonContent],
  template: `
    <ion-modal
      class="app-sheet"
      [isOpen]="open()"
      [breakpoints]="breakpoints()"
      [initialBreakpoint]="initialBreakpoint()"
      [backdropBreakpoint]="backdropBreakpoint()"
      [backdropDismiss]="false"
      [canDismiss]="dismissible()"
      [handle]="true"
      (didDismiss)="dismissed.emit()"
    >
      <ng-template>
        <ion-content class="ion-padding">
          <ng-content />
        </ion-content>
      </ng-template>
    </ion-modal>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BottomSheetComponent {
  readonly open = input(false);
  readonly breakpoints = input([0, 0.35, 0.6, 0.92]);
  readonly initialBreakpoint = input(0.6);
  readonly backdropBreakpoint = input(0.6);
  readonly dismissible = input(true);
  readonly dismissed = output();
}
