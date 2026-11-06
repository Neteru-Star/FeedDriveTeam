import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

const DARK_CLASS = 'ion-palette-dark';

/** Modo claro/oscuro. Arranca con la preferencia del sistema y se puede alternar. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  readonly dark = signal(false);

  init(): void {
    const prefersDark = this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    this.setDark(prefersDark);
  }

  toggle(): void {
    this.setDark(!this.dark());
  }

  setDark(dark: boolean): void {
    this.dark.set(dark);
    this.document.documentElement.classList.toggle(DARK_CLASS, dark);
  }
}
