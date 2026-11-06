import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

import type { StoredSession } from './auth.models';

const KEY = 'feeddrive.session';

/** Guarda la sesión con Capacitor Preferences (almacenamiento nativo en el teléfono, localStorage en la web). */
@Injectable({ providedIn: 'root' })
export class TokenStorage {
  async load(): Promise<StoredSession | null> {
    const { value } = await Preferences.get({ key: KEY });
    if (!value) return null;
    try {
      return JSON.parse(value) as StoredSession;
    } catch {
      await this.clear();
      return null;
    }
  }

  save(session: StoredSession): Promise<void> {
    return Preferences.set({ key: KEY, value: JSON.stringify(session) });
  }

  clear(): Promise<void> {
    return Preferences.remove({ key: KEY });
  }
}
