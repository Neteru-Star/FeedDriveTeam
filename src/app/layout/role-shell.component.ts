import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonMenu } from '@ionic/angular/ion-menu';
import { IonRouterOutlet } from '@ionic/angular/ion-router-outlet';
import { IonSplitPane } from '@ionic/angular/ion-split-pane';

import { RoleMenuComponent, type MenuItem } from './role-menu.component';

export interface ShellData {
  /** Identificador del menú (pasajero, conductor, admin): cada rol tiene el suyo. */
  menuId: string;
  items: MenuItem[];
  /** En escritorio el menú queda fijo a un lado (panel de administración). */
  splitPane?: boolean;
}

/**
 * Estructura de cada rol: menú lateral y un router-outlet para sus pantallas.
 * Pasajero y conductor usan el mapa a pantalla completa con el menú deslizable;
 * el administrador ve el menú fijo en pantallas anchas (ion-split-pane).
 */
@Component({
  selector: 'app-role-shell',
  imports: [IonMenu, IonRouterOutlet, IonSplitPane, RoleMenuComponent],
  template: `
    @if (data.splitPane) {
      <ion-split-pane [contentId]="contentId" when="lg">
        <ion-menu [menuId]="data.menuId" [contentId]="contentId" type="overlay">
          <app-role-menu [items]="data.items" />
        </ion-menu>
        <ion-router-outlet [id]="contentId" />
      </ion-split-pane>
    } @else {
      <ion-menu [menuId]="data.menuId" [contentId]="contentId" type="overlay">
        <app-role-menu [items]="data.items" />
      </ion-menu>
      <ion-router-outlet [id]="contentId" />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoleShellComponent {
  protected readonly data = inject(ActivatedRoute).snapshot.data as ShellData;
  protected readonly contentId = `${this.data.menuId}-main`;
}
