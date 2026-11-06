import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ThemeService } from '@core/theme/theme.service';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonSkeletonText } from '@ionic/angular/ion-skeleton-text';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToggle } from '@ionic/angular/ion-toggle';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { TRIP_STATUSES } from '@shared/models/trip-status';
import { BottomSheetComponent } from '@shared/ui/bottom-sheet/bottom-sheet.component';
import { EmptyStateComponent } from '@shared/ui/empty-state/empty-state.component';
import { FareDisplayComponent, type FareBreakdownItem } from '@shared/ui/fare-display/fare-display.component';
import { GlassCardComponent } from '@shared/ui/glass-card/glass-card.component';
import { PlateComponent } from '@shared/ui/plate/plate.component';
import { RatingStarsComponent } from '@shared/ui/rating-stars/rating-stars.component';
import { RouteLineComponent } from '@shared/ui/route-line/route-line.component';
import { StatusPillComponent } from '@shared/ui/status-pill/status-pill.component';
import { TextFieldComponent } from '@shared/ui/text-field/text-field.component';
import { ToastService } from '@shared/ui/toast/toast.service';

/** Vitrina del sistema de diseño (solo en desarrollo). */
@Component({
  selector: 'app-design-system',
  templateUrl: 'design-system.page.html',
  styleUrl: 'design-system.page.scss',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButton,
    IonToggle,
    IonSkeletonText,
    GlassCardComponent,
    StatusPillComponent,
    PlateComponent,
    RatingStarsComponent,
    FareDisplayComponent,
    EmptyStateComponent,
    RouteLineComponent,
    ReactiveFormsModule,
    TextFieldComponent,
    BottomSheetComponent,
  ],
})
export class DesignSystemPage {
  protected readonly theme = inject(ThemeService);
  protected readonly toast = inject(ToastService);
  protected readonly statuses = TRIP_STATUSES;
  protected readonly rating = signal(4);
  protected readonly sheetOpen = signal(false);

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['laura@correo', [Validators.required, Validators.email]],
    password: ['12345', [Validators.required, Validators.minLength(8)]],
  });

  protected validate(): void {
    this.form.markAllAsTouched();
    if (this.form.valid) void this.toast.success('Formulario válido');
  }

  protected readonly swatches = [
    { name: 'primary', token: '--color-primary', value: '#A6F28B' },
    { name: 'primary-strong', token: '--color-primary-strong', value: '#6FD957' },
    { name: 'primary-soft', token: '--color-primary-soft', value: '#E9FBE2' },
    { name: 'ink', token: '--color-ink', value: '#0F1A14' },
    { name: 'surface', token: '--color-surface', value: '#F5F7F2' },
    { name: 'muted', token: '--color-muted', value: '#6B7A70' },
    { name: 'warning', token: '--color-warning', value: '#F5A524' },
    { name: 'danger', token: '--color-danger', value: '#E5484D' },
  ];

  protected readonly breakdown: FareBreakdownItem[] = [
    { label: 'Base', amount: 4500 },
    { label: 'Distancia', amount: 9800 },
    { label: 'Tiempo', amount: 3200 },
    { label: 'Demanda', amount: 5250 },
  ];
}
