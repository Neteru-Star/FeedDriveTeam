import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { APP_CONFIG } from '@core/config/app-config';
import { firstValueFrom, map } from 'rxjs';

import type {
  AdminDriver,
  AdminTrip,
  ApprovalStatus,
  AuditLog,
  Dashboard,
  DashboardStats,
  Fare,
  NewFare,
  Page,
  Report,
  TripFilters,
} from './admin.models';

/** Respuesta paginada de Laravel o una lista simple: la documentación no muestra la forma de todas. */
type Paged<T> = T[] | { data: T[]; current_page?: number; last_page?: number; total?: number };

/** Convierte una página de Laravel (o un arreglo) en `Page`. */
export function toPage<T>(raw: Paged<T> | undefined, requested = 1): Page<T> {
  if (!raw) return { items: [], page: requested, lastPage: requested, total: 0 };
  if (Array.isArray(raw)) return { items: raw, page: 1, lastPage: 1, total: raw.length };
  return {
    items: raw.data ?? [],
    page: raw.current_page ?? requested,
    lastPage: raw.last_page ?? raw.current_page ?? requested,
    total: raw.total ?? null,
  };
}

const EMPTY_STATS: DashboardStats = {
  total_clients: 0,
  total_drivers: 0,
  pending_drivers: 0,
  approved_drivers: 0,
  active_trips: 0,
  completed_trips: 0,
  cancelled_trips: 0,
  pending_requests: 0,
  total_revenue: 0,
};

/** Reporte con valores por defecto: si el backend omite una sección, la pantalla la muestra vacía en lugar de fallar. */
export function toReport(raw: Partial<Report> | undefined): Report {
  return {
    revenue: { total: 0, completed_trips: 0, average_fare: 0, ...raw?.revenue },
    cancellations: { total: 0, cancelled_trips: 0, rate: 0, by_reason: [], ...raw?.cancellations },
    drivers: raw?.drivers ?? [],
  };
}

/** Endpoints del administrador (`/api/admin`). */
@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${inject(APP_CONFIG).apiBaseUrl}/admin`;

  dashboard(): Promise<Dashboard> {
    return firstValueFrom(
      this.http
        .get<{
          stats?: Partial<DashboardStats>;
          recent_trips?: AdminTrip[];
          recent_incidents?: Dashboard['recentIncidents'];
        }>(`${this.base}/dashboard`)
        .pipe(
          map((r) => ({
            stats: { ...EMPTY_STATS, ...r.stats },
            recentTrips: r.recent_trips ?? [],
            recentIncidents: r.recent_incidents ?? [],
          })),
        ),
    );
  }

  drivers(status?: ApprovalStatus): Promise<AdminDriver[]> {
    const params = status ? new HttpParams().set('approval_status', status) : undefined;
    return firstValueFrom(
      this.http.get<{ drivers: AdminDriver[] }>(`${this.base}/drivers`, { params }).pipe(map((r) => r.drivers ?? [])),
    );
  }

  setApproval(driverId: number, status: ApprovalStatus, notes: string): Promise<string> {
    const body = { approval_status: status, ...(notes.trim() ? { admin_notes: notes.trim() } : {}) };
    return firstValueFrom(
      this.http
        .patch<{ message?: string }>(`${this.base}/drivers/${driverId}/approval`, body)
        .pipe(map((r) => r.message ?? 'Estado actualizado.')),
    );
  }

  fares(): Promise<Fare[]> {
    return firstValueFrom(
      this.http.get<{ fares: Paged<Fare> }>(`${this.base}/fares`).pipe(map((r) => toPage(r.fares).items)),
    );
  }

  createFare(fare: NewFare): Promise<Fare> {
    return firstValueFrom(this.http.post<{ fare: Fare }>(`${this.base}/fares`, fare).pipe(map((r) => r.fare)));
  }

  trips(filters: TripFilters): Promise<Page<AdminTrip>> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== '' && value !== null) params = params.set(key, String(value));
    }
    return firstValueFrom(
      this.http
        .get<{ trips: Paged<AdminTrip> }>(`${this.base}/trips`, { params })
        .pipe(map((r) => toPage(r.trips, filters.page ?? 1))),
    );
  }

  reports(): Promise<Report> {
    return firstValueFrom(
      this.http.get<{ report?: Partial<Report> }>(`${this.base}/reports`).pipe(map((r) => toReport(r.report))),
    );
  }

  auditLogs(page = 1): Promise<Page<AuditLog>> {
    return firstValueFrom(
      this.http
        .get<{ logs: Paged<AuditLog> }>(`${this.base}/audit-logs`, { params: { page } })
        .pipe(map((r) => toPage(r.logs, page))),
    );
  }
}
