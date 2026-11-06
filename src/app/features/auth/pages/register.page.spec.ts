import { Router, provideRouter } from '@angular/router';
import { AuthStore } from '@core/auth/auth.store';
import { ApiError } from '@core/http/api-error';
import { render, screen } from '@testing-library/angular';

import { RegisterPage } from './register.page';

type Page = {
  account: { setValue(v: unknown): void; controls: { email: { errors: unknown } } };
  vehicle: { setValue(v: unknown): void };
};

describe('RegisterPage', () => {
  const store = { register: vi.fn() };
  const account = { name: 'Laura Gómez', email: 'laura@correo.com', phone: '3014442210', password: 'clave1234' };

  // Un vi.fn que devuelve una promesa rechazada hace fallar la prueba aunque la página la atrape;
  // para los errores del backend se pasa un store con funciones normales.
  async function setup(authStore: object = store) {
    const view = await render(RegisterPage, {
      providers: [provideRouter([]), { provide: AuthStore, useValue: authStore }],
    });
    const navigate = vi.spyOn(view.fixture.debugElement.injector.get(Router), 'navigate').mockResolvedValue(true);
    const page = view.fixture.componentInstance as unknown as Page;
    const submit = async () => {
      view.container.querySelector('form')!.dispatchEvent(new Event('submit'));
      await view.fixture.whenStable();
      view.fixture.detectChanges();
    };
    return { ...view, navigate, page, submit };
  }

  beforeEach(() => store.register.mockReset().mockResolvedValue(undefined));

  it('registers a passenger and goes to the login with the success flag', async () => {
    const { page, submit, navigate } = await setup();
    page.account.setValue(account);

    await submit();

    expect(store.register).toHaveBeenCalledWith({ ...account, role: 'client' });
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { registered: 1 } });
  });

  it('asks a driver for the vehicle in a second step', async () => {
    const { page, submit } = await setup();
    screen.getByRole('button', { name: 'Conductor' }).click();
    page.account.setValue(account);

    await submit();

    expect(store.register).not.toHaveBeenCalled();
    expect(screen.getByText(/Paso 2 de 2/)).toBeTruthy();

    page.vehicle.setValue({
      license_number: 'LC-1',
      plate: 'kzt482',
      brand: 'Chevrolet',
      model: 'Onix',
      color: 'Gris',
      year: '2022',
      capacity: '4',
    });
    await submit();

    expect(store.register).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'driver', plate: 'KZT482', year: 2022, capacity: 4, license_number: 'LC-1' }),
    );
  });

  it('shows "El correo ya está en uso" under the email field', async () => {
    const rejecting = {
      register: () => Promise.reject(new ApiError(422, 'invalid', { email: 'El correo ya está en uso.' })),
    };
    const { page, submit } = await setup(rejecting);
    page.account.setValue(account);

    await submit();

    expect(page.account.controls.email.errors).toEqual({ server: 'El correo ya está en uso.' });
  });
});
