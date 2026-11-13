import type { TripStatus } from '@shared/models/trip-status';

export interface Fare {
  id: number;
  name: string;
  base_fare: number;
  price_per_km: number;
  price_per_minute: number;
  minimum_fare: number;
  surge_multiplier: number;
  active: boolean;
}

export type FareRates = Pick<
  Fare,
  'base_fare' | 'price_per_km' | 'price_per_minute' | 'minimum_fare' | 'surge_multiplier'
>;

export interface FareEstimate {
  distance_km: number;
  duration_min: number;
  estimated_fare: number;
  currency: string;
  fare_breakdown: FareRates;
}

export interface RouteCoords {
  origin_latitude: number;
  origin_longitude: number;
  destination_latitude: number;
  destination_longitude: number;
}

export interface RideRequestPayload extends RouteCoords {
  origin_name: string;
  destination_name: string;
}

export interface RideRequest extends RideRequestPayload {
  id: number;
  client_id: number;
  estimated_distance_km: number;
  estimated_duration_min: number;
  estimated_fare: number;
  status: 'requested' | 'accepted' | 'cancelled' | 'completed';
  created_at: string;
}

/**
 * Viaje activo según `GET /client/active`. La documentación solo garantiza estos campos:
 * el origen y el destino no vienen, por eso la app guarda la solicitud en el teléfono.
 */
export interface ActiveTrip {
  id: number;
  request_id?: number;
  status: TripStatus;
  estimated_fare: number;
  driver: {
    id: number;
    rating_average: number;
    user: { name: string; phone: string };
    latest_location: { latitude: number; longitude: number } | null;
  };
  vehicle: { plate: string; brand: string; model: string; color: string } | null;
  /** No están en la documentación; si el backend los envía, sirven cuando no hay solicitud guardada en el teléfono. */
  origin_latitude?: number;
  origin_longitude?: number;
  destination_latitude?: number;
  destination_longitude?: number;
}

/** Respuesta de `GET /client/active` como unión discriminada. */
export type ClientActive =
  | { has_active: false }
  | { has_active: true; type: 'request'; data: RideRequest }
  | { has_active: true; type: 'trip'; data: ActiveTrip };

/**
 * Viaje del historial (`GET /client/trips`). La documentación garantiza id, status, final_fare, completed_at,
 * driver.user.name y vehicle.plate; el resto se muestra solo si el backend lo envía.
 */
export interface TripRecord {
  id: number;
  status: TripStatus;
  final_fare: number | null;
  completed_at: string | null;
  estimated_fare?: number;
  created_at?: string;
  cancel_reason?: string | null;
  origin_name?: string;
  destination_name?: string;
  distance_travelled_km?: number | null;
  duration_travelled_min?: number | null;
  driver?: { user: { name: string; phone?: string }; rating_average?: number } | null;
  vehicle?: { plate: string; brand?: string; model?: string; color?: string } | null;
  rating?: { score: number; comment: string | null } | null;
}

/** Página del historial ya adaptada: los viajes y si hay más por cargar. */
export interface TripPage {
  items: TripRecord[];
  page: number;
  hasMore: boolean;
}

export interface RatingPayload {
  score: number;
  comment?: string;
  has_incident: boolean;
}

export interface TripRating {
  id: number;
  trip_id: number;
  score: number;
  comment: string | null;
}
