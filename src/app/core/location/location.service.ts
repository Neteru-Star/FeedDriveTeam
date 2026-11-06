import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import type { LatLng } from '@shared/utils/geo';

export type LocationStatus = 'idle' | 'locating' | 'granted' | 'denied' | 'unavailable';

type GeolocationApi = Pick<typeof Geolocation, 'getCurrentPosition' | 'checkPermissions' | 'requestPermissions'>;

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

/** Ubicación del dispositivo con Capacitor Geolocation (GPS en el teléfono, navigator.geolocation en la web). */
@Injectable({ providedIn: 'root' })
export class LocationService {
  private readonly geolocation = inject(GEOLOCATION);
  private readonly isNative = inject(IS_NATIVE_PLATFORM);

  readonly status = signal<LocationStatus>('idle');
  readonly position = signal<LatLng | null>(null);
  readonly heading = signal<number | null>(null);

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
