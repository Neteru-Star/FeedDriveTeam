import type { MapTilesConfig } from '@core/config/app-config';

/**
 * Teselas estándar de OpenStreetMap. El estilo claro y oscuro de la marca se aplica con filtros CSS
 * en el componente de mapa (map.component.scss), así no depende de un proveedor con clave de API.
 */
export const MAP_TILES: MapTilesConfig = {
  light: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  dark: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
};

export const GEOCODER_URL = 'https://nominatim.openstreetmap.org';
