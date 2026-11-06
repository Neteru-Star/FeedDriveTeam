import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonBackButton } from '@ionic/angular/ion-back-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonMenuButton } from '@ionic/angular/ion-menu-button';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';

/** Encabezado de las pantallas sin mapa: botón de menú del rol (o de volver, en un detalle) y título. */
@Component({
  selector: 'app-page-header',
  imports: [IonHeader, IonToolbar, IonButtons, IonBackButton, IonMenuButton, IonTitle],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          @if (backHref(); as href) {
            <ion-back-button [defaultHref]="href" text="" aria-label="Volver" />
          } @else {
            <ion-menu-button [menu]="menuId" />
          }
        </ion-buttons>
        <ion-title role="heading" aria-level="1">{{ title() }}</ion-title>
      </ion-toolbar>
    </ion-header>
  `,
  styles: `
    /* ion-header debe quedar como hijo directo de la página (.ion-page, flex). */
    :host {
      display: contents;
    }
    ion-toolbar {
      --background: transparent;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  /** En una pantalla de detalle: a dónde vuelve si no hay historial de navegación. */
  readonly backHref = input<string>();
  /** El menú del rol se declara en la ruta del shell (data.menuId). */
  protected readonly menuId = findMenuId(inject(ActivatedRoute));
}

function findMenuId(route: ActivatedRoute): string | undefined {
  for (let r: ActivatedRoute | null = route; r; r = r.parent) {
    const id = r.snapshot.data['menuId'];
    if (typeof id === 'string') return id;
  }
  return undefined;
}
