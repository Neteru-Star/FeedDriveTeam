import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BackButtonService } from '@core/device/back-button.service';

import { AppComponent } from './app.component';

describe('AppComponent', () => {
  it('should create the app', async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([]), { provide: BackButtonService, useValue: { init: () => undefined } }],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
