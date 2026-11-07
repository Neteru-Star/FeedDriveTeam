import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { APP_CONFIG } from '@core/config/app-config';

import { AdminApi, toPage, toReport } from './admin.api';
import { previewFare } from './admin.models';

const API = 'http://api.test/api';

describe('admin data access', () => {
  let api: AdminApi;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { apiBaseUrl: API } },
      ],
    });
    api = TestBed.inject(AdminApi);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('calculates the fare like the backend: surge, and never below the minimum', () => {
    const fare = {
      base_fare: 3800,
      price_per_km: 1250,
      price_per_minute: 250,
      minimum_fare: 6500,
      surge_multiplier: 1,
    };

    expect(previewFare(fare, 1.28, 4)).toBe(6500);
    expect(previewFare(fare, 5, 15)).toBe(3800 + 6250 + 3750);
    expect(previewFare({ ...fare, surge_multiplier: 1.3 }, 5, 15)).toBe(Math.round(13800 * 1.3));
  });

  it('reads Laravel pages and plain lists alike', () => {
    expect(toPage({ data: [1, 2], current_page: 2, last_page: 3, total: 25 })).toEqual({
      items: [1, 2],
      page: 2,
      lastPage: 3,
      total: 25,
    });
    expect(toPage([1, 2, 3])).toEqual({ items: [1, 2, 3], page: 1, lastPage: 1, total: 3 });
    expect(toPage(undefined, 4).items).toEqual([]);
  });

  it('fills the sections the report does not send', () => {
    const report = toReport({ revenue: { total: 15800, completed_trips: 2, average_fare: 7900 } } as never);

    expect(report.revenue.total).toBe(15800);
    expect(report.cancellations).toEqual({ total: 0, cancelled_trips: 0, rate: 0, by_reason: [] });
    expect(report.drivers).toEqual([]);
  });

  it('fills missing dashboard stats with zeros', async () => {
    const dashboard = api.dashboard();
    backend.expectOne(`${API}/admin/dashboard`).flush({ success: true, stats: { total_clients: 3 } });

    const result = await dashboard;
    expect(result.stats.total_clients).toBe(3);
    expect(result.stats.total_revenue).toBe(0);
    expect(result.recentTrips).toEqual([]);
  });

  it('filters drivers and sends the notes only when there are any', async () => {
    const list = api.drivers('pending');
    backend.expectOne(`${API}/admin/drivers?approval_status=pending`).flush({ drivers: [{ id: 3 }] });
    expect(await list).toEqual([{ id: 3 }]);

    const approve = api.setApproval(3, 'approved', '  ');
    const req = backend.expectOne(`${API}/admin/drivers/3/approval`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ approval_status: 'approved' });
    req.flush({ message: 'Estado del conductor actualizado a: approved' });
    expect(await approve).toContain('approved');

    void api.setApproval(3, 'suspended', ' Documentos vencidos ');
    expect(backend.expectOne(`${API}/admin/drivers/3/approval`).request.body).toEqual({
      approval_status: 'suspended',
      admin_notes: 'Documentos vencidos',
    });
  });

  it('sends only the trip filters that have a value', async () => {
    const trips = api.trips({ status: 'completed', driver_id: '', date: '2026-10-20', page: 2 });
    backend
      .expectOne(`${API}/admin/trips?status=completed&date=2026-10-20&page=2`)
      .flush({ trips: { data: [{ id: 1, status: 'completed' }], current_page: 2, last_page: 2 } });

    expect((await trips).items).toHaveLength(1);
  });
});
