import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// Validators.email de Angular acepta correos sin dominio (laura@correo); este exige punto y dominio.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Celular colombiano: 10 dígitos que empiezan por 3.
const PHONE = /^3\d{9}$/;
// Placa colombiana de carro (ABC123) o moto (ABC12D), con o sin guion.
const PLATE = /^[A-Z]{3}-?\d{2}[A-Z0-9]$/i;

const test =
  (pattern: RegExp, key: string): ValidatorFn =>
  (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value ?? '').trim();
    return !value || pattern.test(value) ? null : { [key]: true };
  };

export const AppValidators = {
  email: test(EMAIL, 'email'),
  phone: test(PHONE, 'phone'),
  plate: test(PLATE, 'plate'),
  /** Para un grupo: marca el error en `confirmField` si no coincide con `field`. */
  matches(field: string, confirmField: string): ValidatorFn {
    return (group: AbstractControl): ValidationErrors | null => {
      const confirm = group.get(confirmField);
      if (!confirm) return null;
      const mismatch = group.get(field)?.value !== confirm.value && !!confirm.value;
      const { mismatch: _old, ...rest } = confirm.errors ?? {};
      confirm.setErrors(mismatch ? { ...rest, mismatch: true } : Object.keys(rest).length ? rest : null);
      return null;
    };
  },
};
