import type { TripStatus } from '@shared/models/trip-status';

export type Availability = 'available' | 'unavailable';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

/**
 * Solicitud pendiente de `GET /driver/ride-requests`. La documentación garantiza los nombres, la distancia,
 * la tarifa y el pasajero; las coordenadas se usan para ordenar por cercanía solo si el backend las envía.
 */
export interface DriverRideRequest {
  id: number;
  origin_name: string;
  destination_name: string;
  estimated_distance_km: number;
  estimated_fare: number;
  client: { name: string; phone: string };
  origin_latitude?: number;
  origin_longitude?: number;
  destination_latitude?: number;
  destination_longitude?: number;
  estimated_duration_min?: number;
  created_at?: string;
}

/** Viaje que devuelve `POST /driver/ride-requests/{id}/accept`. */
export interface AcceptedTrip {
  id: number;
  request_id: number;
  client_id: number;
  driver_id: number;
  status: TripStatus;
  estimated_fare: number;
}

/**
 * Viaje asignado al conductor con la solicitud de la que salió. No hay un endpoint para consultar el viaje
 * activo del conductor, así que se guarda en el teléfono para retomarlo si la app se cierra.
 */
export interface AssignedTrip {
  trip: AcceptedTrip;
  request: DriverRideRequest;
}

export interface LocationReport {
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  trip_id?: number;
}
