import { FormControl, Validators } from '@angular/forms';
import { render } from '@testing-library/angular';

import { TextFieldComponent } from './text-field.component';

describe('TextFieldComponent', () => {
  const errorText = (container: Element) => container.querySelector<HTMLIonInputElement>('ion-input')?.errorText;

  it('passes the validation message to the input', async () => {
    const control = new FormControl('', [Validators.required]);
    const { container, fixture } = await render(TextFieldComponent, { inputs: { control, label: 'Correo' } });

    expect(errorText(container)).toBe('Este campo es obligatorio.');

    control.setValue('laura@correo.com');
    fixture.detectChanges();
    expect(errorText(container)).toBe('');
  });

  it('shows the backend message set after a 422', async () => {
    const control = new FormControl('laura@correo.com');
    const { container, fixture } = await render(TextFieldComponent, { inputs: { control, label: 'Correo' } });

    control.setErrors({ server: 'El correo ya está en uso.' });
    fixture.detectChanges();

    expect(errorText(container)).toBe('El correo ya está en uso.');
  });

  it('adds the show/hide toggle only for passwords', async () => {
    const control = new FormControl('');
    const { container } = await render(TextFieldComponent, {
      inputs: { control, label: 'Contraseña', type: 'password' },
    });

    expect(container.querySelector('ion-input-password-toggle')).not.toBeNull();
  });
});
