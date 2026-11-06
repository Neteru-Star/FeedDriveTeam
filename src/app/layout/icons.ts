import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  carOutline,
  cashOutline,
  documentTextOutline,
  gridOutline,
  listOutline,
  locateOutline,
  locationOutline,
  logOutOutline,
  mapOutline,
  menuOutline,
  peopleOutline,
  personCircleOutline,
  pricetagOutline,
  searchOutline,
  shieldCheckmarkOutline,
  statsChartOutline,
  timeOutline,
} from 'ionicons/icons';

/** Iconos de Ionicons que usa la app. Registrarlos evita descargarlos por red en tiempo de ejecución. */
export function registerAppIcons(): void {
  addIcons({
    'arrow-back-outline': arrowBackOutline,
    'car-outline': carOutline,
    'cash-outline': cashOutline,
    'document-text-outline': documentTextOutline,
    'grid-outline': gridOutline,
    'list-outline': listOutline,
    'locate-outline': locateOutline,
    'location-outline': locationOutline,
    'log-out-outline': logOutOutline,
    'map-outline': mapOutline,
    'menu-outline': menuOutline,
    'people-outline': peopleOutline,
    'person-circle-outline': personCircleOutline,
    'pricetag-outline': pricetagOutline,
    'search-outline': searchOutline,
    'shield-checkmark-outline': shieldCheckmarkOutline,
    'stats-chart-outline': statsChartOutline,
    'time-outline': timeOutline,
  });
}
