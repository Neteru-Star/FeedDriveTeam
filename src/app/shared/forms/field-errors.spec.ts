import { FormControl, Validators } from '@angular/forms';

import { SERVER_ERROR, fieldErrorMessage } from './field-errors';

describe('fieldErrorMessage', () => {
  it('returns an empty string for a valid control', () => {
    expect(fieldErrorMessage(null)).toBe('');
  });

  it('describes each validator in Spanish', () => {
    const control = new FormControl('', [Validators.required, Validators.email, Validators.minLength(8)]);
    expect(fieldErrorMessage(control.errors)).toBe('Este campo es obligatorio.');

    control.setValue('abc');
    expect(fieldErrorMessage(control.errors)).toBe('Ingresa un correo válido.');

    control.setValue('a@b.co');
    expect(fieldErrorMessage(control.errors)).toBe('Debe tener al menos 8 caracteres.');
  });

  it('prefers the message sent by the backend', () => {
    expect(fieldErrorMessage({ [SERVER_ERROR]: 'El correo ya está en uso.', required: true })).toBe(
      'El correo ya está en uso.',
    );
  });
});
