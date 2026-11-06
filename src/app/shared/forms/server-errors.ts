import type { AbstractControl, FormGroup } from '@angular/forms';
import type { ApiError } from '@core/http/api-error';

import { SERVER_ERROR } from './field-errors';

/**
 * Pone los errores de un 422 debajo de cada campo. Busca el control por nombre en el formulario y sus grupos.
 * Devuelve los campos que no existen en el formulario, para mostrarlos en un mensaje general.
 */
export function applyServerErrors(form: FormGroup, error: ApiError): string[] {
  const missing: string[] = [];
  for (const [field, message] of Object.entries(error.fieldErrors)) {
    const control = findControl(form, field);
    if (!control) {
      missing.push(message);
      continue;
    }
    control.setErrors({ ...control.errors, [SERVER_ERROR]: message });
    control.markAsTouched();
  }
  return missing;
}

function findControl(group: AbstractControl, name: string): AbstractControl | null {
  const direct = group.get(name);
  if (direct) return direct;
  const children = 'controls' in group ? Object.values(group.controls as Record<string, AbstractControl>) : [];
  for (const child of children) {
    const found = findControl(child, name);
    if (found) return found;
  }
  return null;
}
