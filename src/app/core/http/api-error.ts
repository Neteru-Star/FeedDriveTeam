import type { HttpErrorResponse } from '@angular/common/http';

/** Mensajes de validación de Laravel en inglés que el backend podría devolver sin traducir. */
const LARAVEL_MESSAGES: [RegExp, string][] = [
  [/has already been taken/i, 'ya está en uso.'],
  [/field is required/i, 'es obligatorio.'],
  [/must be a valid email/i, 'debe ser un correo válido.'],
];

const FIELD_LABEL: Record<string, string> = {
  email: 'El correo',
  phone: 'El teléfono',
  plate: 'La placa',
  name: 'El nombre',
  password: 'La contraseña',
};

const DEFAULT_MESSAGE: Record<number, string> = {
  401: 'Tu sesión expiró. Inicia sesión de nuevo.',
  403: 'No tienes permiso para realizar esta acción.',
  404: 'No encontramos lo que buscabas.',
  409: 'Otra persona hizo este cambio primero.',
  422: 'Revisa los datos del formulario.',
  500: 'El servidor tuvo un problema. Inténtalo más tarde.',
};

function translate(message: string, field: string): string {
  const match = LARAVEL_MESSAGES.find(([pattern]) => pattern.test(message));
  if (!match) return message;
  const label = FIELD_LABEL[field] ?? `El campo ${field}`;
  return `${label} ${match[1]}`;
}

/**
 * Error de la API normalizado. Cubre las dos formas de respuesta del backend:
 * `{ success: false, message }` para reglas de negocio y `{ message, errors }` para validación (422).
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Errores por campo cuando la respuesta es 422. */
    readonly fieldErrors: Record<string, string> = {},
    /** Cuerpo completo, para datos extra como `active_request_id` o `approval_status`. */
    readonly body: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static from(response: HttpErrorResponse): ApiError {
    if (response.status === 0) {
      return new ApiError(0, 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.');
    }
    const body = (typeof response.error === 'object' && response.error) || {};
    const message = typeof body.message === 'string' ? body.message : DEFAULT_MESSAGE[response.status];
    const fieldErrors: Record<string, string> = {};
    if (body.errors && typeof body.errors === 'object') {
      for (const [field, messages] of Object.entries(body.errors as Record<string, string[]>)) {
        if (messages?.[0]) fieldErrors[field] = translate(messages[0], field);
      }
    }
    return new ApiError(
      response.status,
      message ?? 'Ocurrió un error inesperado. Inténtalo de nuevo.',
      fieldErrors,
      body,
    );
  }
}
