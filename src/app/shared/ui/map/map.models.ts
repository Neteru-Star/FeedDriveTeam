import type { LatLng } from '@shared/utils/geo';

export type MarkerKind = 'user' | 'origin' | 'destination' | 'driver';

export interface MapMarker {
  /** Identificador estable para mover el marcador en lugar de recrearlo. */
  id: string;
  kind: MarkerKind;
  position: LatLng;
  /** Rumbo en grados (solo conductor). */
  heading?: number | null;
  label?: string;
}

/** Margen en píxeles que debe quedar libre al encuadrar la ruta (por ejemplo, bajo la hoja inferior). */
export interface MapPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface MapRoute {
  from: LatLng;
  to: LatLng;
}
