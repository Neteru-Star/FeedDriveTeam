export type Role = 'client' | 'driver' | 'admin';

export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  status: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
  user: User;
}

export interface LoginPayload {
  /** Correo o teléfono. */
  login: string;
  password: string;
}

interface RegisterBase {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export interface RegisterClientPayload extends RegisterBase {
  role: 'client';
}

export interface VehiclePayload {
  license_number: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  capacity: number;
  color: string;
}

export interface RegisterDriverPayload extends RegisterBase, VehiclePayload {
  role: 'driver';
}

export type RegisterPayload = RegisterClientPayload | RegisterDriverPayload;

export interface ForgotPasswordPayload {
  email: string;
  new_password: string;
}

/** Sesión guardada en el dispositivo. El backend no renueva tokens, así que se guarda su vencimiento. */
export interface StoredSession {
  token: string;
  expiresAt: number;
  user: User;
}

export const ROLE_LABEL: Record<Role, string> = {
  client: 'pasajero',
  driver: 'conductor',
  admin: 'administrador',
};

/** Pantalla inicial de cada rol. */
export const ROLE_HOME: Record<Role, string> = {
  client: '/pasajero',
  driver: '/conductor',
  admin: '/admin',
};
