import { Injectable, inject } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { IS_NATIVE_PLATFORM } from '@core/location/location.service';

import type { StoredSession } from './auth.models';

const KEY = 'feeddrive.session';

/**
 * Guarda la sesión. En el teléfono usa Capacitor Preferences (una app, una sesión). En la web usa
 * `sessionStorage`, que es propio de cada pestaña: así se puede tener, por ejemplo, el pasajero en una pestaña y
 * el conductor en otra sin que iniciar sesión en una cierre la otra. La sesión sobrevive a recargar la pestaña.
 */
@Injectable({ providedIn: 'root' })
export class TokenStorage {
  private readonly isNative = inject(IS_NATIVE_PLATFORM);

  async load(): Promise<StoredSession | null> {
    const value = this.isNative ? (await Preferences.get({ key: KEY })).value : tabStorage()?.getItem(KEY);
    if (!this.isNative) await dropSharedWebSession();
    if (!value) return null;
    try {
      return JSON.parse(value) as StoredSession;
    } catch {
      await this.clear();
      return null;
    }
  }

  async save(session: StoredSession): Promise<void> {
    const value = JSON.stringify(session);
    if (this.isNative) await Preferences.set({ key: KEY, value });
    else tabStorage()?.setItem(KEY, value);
  }

  async clear(): Promise<void> {
    if (this.isNative) await Preferences.remove({ key: KEY });
    else tabStorage()?.removeItem(KEY);
  }
}

/** `sessionStorage` puede no existir o lanzar error (navegación privada estricta): entonces la sesión vive en memoria. */
function tabStorage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Versiones anteriores guardaban la sesión web en localStorage, compartido por todas las pestañas.
 * Se borra para que no quede un token huérfano.
 */
async function dropSharedWebSession(): Promise<void> {
  await Preferences.remove({ key: KEY }).catch(() => undefined);
}
