import { provideRouter } from '@angular/router';
import { AuthStore } from '@core/auth/auth.store';
import { ApiError } from '@core/http/api-error';
import { NavController } from '@ionic/angular/nav-controller';
import { render, screen } from '@testing-library/angular';

import { LoginPage } from './login.page';

describe('LoginPage', () => {
  const store = { login: vi.fn() };
  const nav = { navigateRoot: vi.fn().mockResolvedValue(true) };

  async function setup(inputs: Record<string, unknown> = {}) {
    const view = await render(LoginPage, {
      inputs,
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: store },
        { provide: NavController, useValue: nav },
      ],
    });
    return { ...view, navigate: nav.navigateRoot };
  }

  function fill(fixture: Awaited<ReturnType<typeof setup>>['fixture'], login: string, password: string) {
    const page = fixture.componentInstance as unknown as { form: { setValue(v: unknown): void } };
    page.form.setValue({ login, password });
  }

  const submit = (container: Element) => container.querySelector('form')!.dispatchEvent(new Event('submit'));

  beforeEach(() => {
    store.login.mockReset();
    nav.navigateRoot.mockClear();
  });

  it('does not call the API while fields are empty', async () => {
    const { container } = await setup();
    submit(container);
    expect(store.login).not.toHaveBeenCalled();
  });

  it('shows "Correo o contraseña incorrectos" on a wrong password', async () => {
    // Un vi.fn que devuelve una promesa rechazada hace fallar la prueba aunque la página la atrape.
    const failing = { login: () => Promise.reject(new ApiError(401, 'Credenciales inválidas')) };
    const { container, fixture } = await render(LoginPage, {
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: failing },
        { provide: NavController, useValue: nav },
      ],
    });
    fill(fixture as never, 'cliente@uber.com', 'mala');

    submit(container);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent?.trim()).toBe('Correo o contraseña incorrectos');
  });

  it('goes to the home of the role after logging in', async () => {
    store.login.mockResolvedValue({ role: 'driver' });
    const { container, fixture, navigate } = await setup();
    fill(fixture, 'conductor@uber.com', 'conductor123');

    submit(container);

    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/conductor'));
  });

  it('returns to the route that was requested before logging in', async () => {
    store.login.mockResolvedValue({ role: 'driver' });
    const { container, fixture, navigate } = await setup({ returnUrl: '/conductor/viaje' });
    fill(fixture, 'conductor@uber.com', 'conductor123');

    submit(container);

    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/conductor/viaje'));
  });

  it('shows the success message after registering', async () => {
    await setup({ registered: '1' });
    expect(screen.getByRole('status').textContent).toContain('Cuenta creada');
  });
});
