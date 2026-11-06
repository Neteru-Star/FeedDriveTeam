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

  it('covers the length, range, format and app-specific errors', () => {
    expect(fieldErrorMessage({ maxlength: { requiredLength: 50 } })).toBe('No debe superar 50 caracteres.');
    expect(fieldErrorMessage({ min: { min: 1990 } })).toBe('El valor mínimo es 1990.');
    expect(fieldErrorMessage({ max: { max: 8 } })).toBe('El valor máximo es 8.');
    expect(fieldErrorMessage({ pattern: true })).toBe('El formato no es válido.');
    expect(fieldErrorMessage({ phone: true })).toContain('10 dígitos');
    expect(fieldErrorMessage({ plate: true })).toContain('placa');
    expect(fieldErrorMessage({ mismatch: true })).toBe('Las contraseñas no coinciden.');
    expect(fieldErrorMessage({ unknown: true })).toBe('Revisa este campo.');
  });

  it('prefers the message sent by the backend', () => {
    expect(fieldErrorMessage({ [SERVER_ERROR]: 'El correo ya está en uso.', required: true })).toBe(
      'El correo ya está en uso.',
    );
  });
});
