import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import type { LatLng } from '@shared/utils/geo';

export type LocationStatus = 'idle' | 'locating' | 'granted' | 'denied' | 'unavailable';

type GeolocationApi = Pick<
  typeof Geolocation,
  'getCurrentPosition' | 'checkPermissions' | 'requestPermissions' | 'watchPosition' | 'clearWatch'
>;

/** Plugin de geolocalización de Capacitor; se reemplaza en las pruebas. */
export const GEOLOCATION = new InjectionToken<GeolocationApi>('GEOLOCATION', {
  providedIn: 'root',
  factory: () => Geolocation,
});

/** En Android hay que pedir el permiso de forma explícita; en la web lo pide el navegador. */
export const IS_NATIVE_PLATFORM = new InjectionToken<boolean>('IS_NATIVE_PLATFORM', {
  providedIn: 'root',
  factory: () => Capacitor.isNativePlatform(),
});

const TIMEOUT_MS = 10_000;
/** Posiciones del seguimiento continuo que se aceptan aunque tengan hasta esta antigüedad. */
const WATCH_MAX_AGE_MS = 3_000;
const MS_TO_KMH = 3.6;

/** Ubicación del dispositivo con Capacitor Geolocation (GPS en el teléfono, navigator.geolocation en la web). */
@Injectable({ providedIn: 'root' })
export class LocationService {
  private readonly geolocation = inject(GEOLOCATION);
  private readonly isNative = inject(IS_NATIVE_PLATFORM);

  readonly status = signal<LocationStatus>('idle');
  readonly position = signal<LatLng | null>(null);
  readonly heading = signal<number | null>(null);
  /** Velocidad en km/h según el GPS, si la informa. */
  readonly speedKmh = signal<number | null>(null);
  /** El seguimiento continuo está activo. */
  readonly watching = signal(false);

  private watchId: string | null = null;

  /** Pide permiso si hace falta y obtiene la posición actual. Devuelve null si no se pudo. */
  async locate(): Promise<LatLng | null> {
    this.status.set('locating');
    try {
      if (this.isNative && !(await this.ensurePermission())) {
        this.status.set('denied');
        return null;
      }
      const { coords } = await this.geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: TIMEOUT_MS });
      const position = { lat: coords.latitude, lng: coords.longitude };
      this.position.set(position);
      this.heading.set(coords.heading ?? null);
      this.status.set('granted');
      return position;
    } catch (error) {
      this.status.set(isPermissionError(error) ? 'denied' : 'unavailable');
      return null;
    }
  }

  /**
   * Seguimiento continuo de la posición (conductor en línea o en viaje). Solo funciona con la app abierta:
   * el seguimiento en segundo plano necesita un plugin nativo aparte (backlog).
   */
  async watch(): Promise<void> {
    if (this.watchId) return;
    if (this.isNative && !(await this.ensurePermission().catch(() => false))) {
      this.status.set('denied');
      return;
    }
    this.watchId = await this.geolocation.watchPosition(
      { enableHighAccuracy: true, timeout: TIMEOUT_MS, maximumAge: WATCH_MAX_AGE_MS },
      (position, error) => {
        if (error || !position) {
          if (error && isPermissionError(error)) this.status.set('denied');
          return;
        }
        const { coords } = position;
        this.position.set({ lat: coords.latitude, lng: coords.longitude });
        this.heading.set(coords.heading ?? null);
        this.speedKmh.set(coords.speed === null || coords.speed === undefined ? null : coords.speed * MS_TO_KMH);
        this.status.set('granted');
      },
    );
    this.watching.set(true);
  }

  async stopWatch(): Promise<void> {
    if (!this.watchId) return;
    const id = this.watchId;
    this.watchId = null;
    this.watching.set(false);
    await this.geolocation.clearWatch({ id });
  }

  private async ensurePermission(): Promise<boolean> {
    let permission = await this.geolocation.checkPermissions();
    if (permission.location !== 'granted') permission = await this.geolocation.requestPermissions();
    return permission.location === 'granted';
  }
}

/** El navegador responde con código 1 y Capacitor con mensajes que mencionan el permiso. */
function isPermissionError(error: unknown): boolean {
  if (typeof error === 'object' && error && 'code' in error && (error as { code: unknown }).code === 1) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /denied|permission/i.test(message);
}
