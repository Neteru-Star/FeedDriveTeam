import { Component, inject } from '@angular/core';
import { ThemeService } from '@core/theme/theme.service';
import { IonApp } from '@ionic/angular/ion-app';
import { IonRouterOutlet } from '@ionic/angular/ion-router-outlet';

import { registerAppIcons } from './layout/icons';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  constructor() {
    registerAppIcons();
    inject(ThemeService).init();
  }
}
