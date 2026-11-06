import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { GlassCardComponent } from '@shared/ui/glass-card/glass-card.component';
import { RouteLineComponent } from '@shared/ui/route-line/route-line.component';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrl: 'home.page.scss',
  imports: [IonContent, IonButton, RouterLink, GlassCardComponent, RouteLineComponent],
})
export class HomePage {}
