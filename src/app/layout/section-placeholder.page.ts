import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonContent } from '@ionic/angular/ion-content';
import { EmptyStateComponent } from '@shared/ui/empty-state/empty-state.component';

import { PageHeaderComponent } from './page-header.component';

export interface SectionData {
  title: string;
  emptyTitle: string;
  emptyMessage: string;
}

/**
 * Sección del menú cuya historia aún no se implementa (historial, panel de administración).
 * Muestra el título y un estado vacío; cada fase reemplaza su ruta por la pantalla real.
 */
@Component({
  selector: 'app-section-placeholder',
  imports: [IonContent, PageHeaderComponent, EmptyStateComponent],
  template: `
    <app-page-header [title]="data.title" />
    <ion-content>
      <main class="section">
        <app-empty-state [title]="data.emptyTitle" [message]="data.emptyMessage" />
      </main>
    </ion-content>
  `,
  styles: `
    .section {
      min-height: 100%;
      display: grid;
      place-items: center;
      padding: 24px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SectionPlaceholderPage {
  protected readonly data = inject(ActivatedRoute).snapshot.data as SectionData;
}
