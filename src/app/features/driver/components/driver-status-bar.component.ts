import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { DriverMode } from '../data-access/driver.store';

const STATE_LABEL: Record<DriverMode, string> = {
  checking: 'Consultando…',
  review: 'En revisión',
  offline: 'Fuera de línea',
  switching: 'Cambiando…',
  online: 'En línea',
  assigned: 'En viaje',
  summary: 'En línea',
};

/** Píldora superior del conductor: sus iniciales, su nombre y su estado. */
@Component({
  selector: 'app-driver-status-bar',
  template: `
    <div class="bar">
      <span class="avatar" aria-hidden="true">{{ initials() }}</span>
      <strong>{{ name() }}</strong>
      <span class="state" [attr.data-mode]="mode()">{{ label() }}</span>
    </div>
  `,
  styleUrl: 'driver-status-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DriverStatusBarComponent {
  readonly name = input('');
  readonly mode = input.required<DriverMode>();

  protected readonly label = computed(() => STATE_LABEL[this.mode()]);
  protected readonly initials = computed(() =>
    this.name()
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join(''),
  );
}
