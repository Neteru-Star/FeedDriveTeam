import type { TripStatus } from '@shared/models/trip-status';

export type ApprovalStatus = 'pending' | 'approved' | 'suspended' | 'rejected';

export const APPROVAL_LABEL: Record<ApprovalStatus, string> = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  suspended: 'Suspendido',
  rejected: 'Rechazado',
};

export interface DashboardStats {
  total_clients: number;
  total_drivers: number;
  pending_drivers: number;
  approved_drivers: number;
  active_trips: number;
  completed_trips: number;
  cancelled_trips: number;
  pending_requests: number;
  total_revenue: number;
}

/** Viaje de los listados del administrador. Solo `id` y `status` son seguros; el resto se muestra si llega. */
export interface AdminTrip {
  id: number;
  status: TripStatus;
  estimated_fare?: number;
  final_fare?: number | null;
  created_at?: string;
  completed_at?: string | null;
  origin_name?: string;
  destination_name?: string;
  cancel_reason?: string | null;
  client_id?: number;
  driver_id?: number;
  client?: { id?: number; name: string } | null;
  driver?: { id?: number; user?: { name: string } } | null;
  vehicle?: { plate: string } | null;
}

export interface Incident {
  id: number;
  trip_id: number;
  description: string;
  status: string;
  created_at: string;
}

export interface Dashboard {
  stats: DashboardStats;
  recentTrips: AdminTrip[];
  recentIncidents: Incident[];
}

export interface AdminDriver {
  id: number;
  license_number: string;
  approval_status: ApprovalStatus;
  rating_average: number;
  admin_notes?: string | null;
  user: { name: string; email: string; phone?: string };
  vehicles: { plate: string; brand: string; model: string; year?: number; color?: string }[];
}

export interface Fare {
  id: number;
  name: string;
  base_fare: number;
  price_per_km: number;
  price_per_minute: number;
  minimum_fare: number;
  surge_multiplier: number;
  active: boolean;
  created_at?: string;
}

export type NewFare = Omit<Fare, 'id' | 'created_at'>;

export interface TripFilters {
  status?: TripStatus | '';
  driver_id?: string;
  client_id?: string;
  date?: string;
  page?: number;
}

export interface Page<T> {
  items: T[];
  page: number;
  lastPage: number;
  total: number | null;
}

export interface Report {
  revenue: { total: number; completed_trips: number; average_fare: number };
  cancellations: {
    total: number;
    cancelled_trips: number;
    rate: number;
    by_reason: { reason: string; count: number }[];
  };
  drivers: {
    driver_id: number;
    name: string;
    approval_status?: ApprovalStatus;
    completed_trips: number;
    revenue: number;
    rating_average: number;
  }[];
}

export interface AuditLog {
  id: number;
  action: string;
  description: string;
  entity_type?: string | null;
  entity_id?: number | null;
  ip_address?: string | null;
  created_at: string;
  user?: { name: string } | null;
}

/** Tarifa de un viaje con la fórmula del backend: (base + km + minutos) × demanda, sin bajar de la mínima. */
export function previewFare(
  fare: Pick<Fare, 'base_fare' | 'price_per_km' | 'price_per_minute' | 'minimum_fare' | 'surge_multiplier'>,
  km: number,
  minutes: number,
): number {
  const raw = (fare.base_fare + fare.price_per_km * km + fare.price_per_minute * minutes) * fare.surge_multiplier;
  return Math.round(Math.max(fare.minimum_fare, raw));
}
