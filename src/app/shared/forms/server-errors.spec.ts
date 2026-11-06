import { FormControl, FormGroup } from '@angular/forms';
import { ApiError } from '@core/http/api-error';

import { applyServerErrors } from './server-errors';
import { AppValidators } from './validators';

describe('applyServerErrors', () => {
  it('puts each 422 message on its field, including nested groups', () => {
    const form = new FormGroup({
      account: new FormGroup({ email: new FormControl('a@b.co') }),
      vehicle: new FormGroup({ plate: new FormControl('ABC123') }),
    });
    const error = new ApiError(422, 'invalid', {
      email: 'El correo ya está en uso.',
      plate: 'La placa ya está en uso.',
      role: 'Rol inválido',
    });

    const missing = applyServerErrors(form, error);

    expect(form.get('account.email')?.errors).toEqual({ server: 'El correo ya está en uso.' });
    expect(form.get('account.email')?.touched).toBe(true);
    expect(form.get('vehicle.plate')?.errors).toEqual({ server: 'La placa ya está en uso.' });
    expect(missing).toEqual(['Rol inválido']);
  });

  it('clears the backend message once the user edits the field', () => {
    const form = new FormGroup({ email: new FormControl('a@b.co') });
    applyServerErrors(form, new ApiError(422, 'invalid', { email: 'El correo ya está en uso.' }));

    form.controls.email.setValue('otro@b.co');

    expect(form.controls.email.errors).toBeNull();
  });
});

describe('AppValidators', () => {
  const check = (validator: typeof AppValidators.email, value: string) => validator(new FormControl(value));

  it('requires a domain in emails', () => {
    expect(check(AppValidators.email, 'laura@correo')).toEqual({ email: true });
    expect(check(AppValidators.email, 'laura@correo.com')).toBeNull();
  });

  it('accepts Colombian mobile numbers and plates', () => {
    expect(check(AppValidators.phone, '3014442210')).toBeNull();
    expect(check(AppValidators.phone, '6014442210')).toEqual({ phone: true });
    expect(check(AppValidators.plate, 'KZT-482')).toBeNull();
    expect(check(AppValidators.plate, 'abc12d')).toBeNull();
    expect(check(AppValidators.plate, 'K-48')).toEqual({ plate: true });
  });

  it('flags a password confirmation that does not match', () => {
    const form = new FormGroup(
      { password: new FormControl('clave1234'), confirm: new FormControl('clave9999') },
      { validators: AppValidators.matches('password', 'confirm') },
    );
    expect(form.controls.confirm.errors).toEqual({ mismatch: true });

    form.controls.confirm.setValue('clave1234');
    expect(form.controls.confirm.errors).toBeNull();
  });
});
