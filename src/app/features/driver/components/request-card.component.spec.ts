import { render, screen } from '@testing-library/angular';

import type { NearbyRequest } from '../data-access/driver.store';

import { RequestCardComponent } from './request-card.component';

const request: NearbyRequest = {
  id: 2,
  origin_name: 'Parque de la 93',
  destination_name: 'Centro Comercial Andino',
  estimated_distance_km: 1.28,
  estimated_fare: 6500,
  client: { name: 'Juan Pérez', phone: '3001234567' },
  pickupKm: 0.85,
};

describe('RequestCardComponent', () => {
  it('shows the earning, the pickup distance and time, and the passenger', async () => {
    const { container } = await render(RequestCardComponent, { inputs: { request } });

    const text = container.textContent ?? '';
    // El formato es-CO se registra en la app; aquí basta con ver el monto.
    expect(text).toMatch(/\$\s?6[.,]500/);
    expect(text).toContain('850 m');
    // 0,85 km × 1,3 a 22 km/h ≈ 3 min
    expect(text).toContain('~3 min para recoger');
    expect(text).toContain('Juan Pérez · Viaje de 1,3 km');
  });

  it('leaves out the pickup when the backend does not send the origin', async () => {
    const { container } = await render(RequestCardComponent, { inputs: { request: { ...request, pickupKm: null } } });

    expect(container.textContent).not.toContain('para recoger');
  });

  it('accepts and rejects, and blocks both once another driver took it', async () => {
    const events: string[] = [];
    const view = await render(RequestCardComponent, {
      inputs: { request },
      on: { accept: () => events.push('accept'), reject: () => events.push('reject') },
    });

    screen.getByText('Aceptar').closest('ion-button')!.click();
    screen.getByText('Rechazar').closest('ion-button')!.click();
    expect(events).toEqual(['accept', 'reject']);

    view.fixture.componentRef.setInput('taken', true);
    view.fixture.detectChanges();

    expect(screen.getByRole('alert').textContent).toContain('Otro conductor tomó este viaje');
    expect((screen.getByText('Aceptar').closest('ion-button') as HTMLIonButtonElement).disabled).toBe(true);
  });
});
