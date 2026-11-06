import type { ValidationErrors } from '@angular/forms';

/** Clave de error para los mensajes de validación que devuelve el backend (422). */
export const SERVER_ERROR = 'server';

/** Traduce los errores de un control al mensaje que se muestra debajo del campo. */
export function fieldErrorMessage(errors: ValidationErrors | null): string {
  if (!errors) return '';
  if (typeof errors[SERVER_ERROR] === 'string') return errors[SERVER_ERROR];
  if (errors['required']) return 'Este campo es obligatorio.';
  if (errors['email']) return 'Ingresa un correo válido.';
  if (errors['minlength']) return `Debe tener al menos ${errors['minlength'].requiredLength} caracteres.`;
  if (errors['maxlength']) return `No debe superar ${errors['maxlength'].requiredLength} caracteres.`;
  if (errors['min']) return `El valor mínimo es ${errors['min'].min}.`;
  if (errors['max']) return `El valor máximo es ${errors['max'].max}.`;
  if (errors['pattern']) return 'El formato no es válido.';
  return 'Revisa este campo.';
}
