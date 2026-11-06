import { formatCurrency } from '@angular/common';
import { LOCALE_ID, Pipe, inject, type PipeTransform } from '@angular/core';
import { formatDistance } from '@shared/utils/geo';

/** Pesos colombianos sin centavos: 6500 → "$ 6.500". */
@Pipe({ name: 'currencyCop' })
export class CurrencyCopPipe implements PipeTransform {
  private readonly locale = inject(LOCALE_ID);

  transform(value: number | null | undefined): string {
    return value === null || value === undefined ? '' : formatCurrency(value, this.locale, '$', 'COP', '1.0-0');
  }
}

/** 0,85 → "850 m"; 12,43 → "12,4 km". */
@Pipe({ name: 'distanceKm' })
export class DistanceKmPipe implements PipeTransform {
  transform(km: number | null | undefined): string {
    return km === null || km === undefined ? '' : formatDistance(km);
  }
}

/** 28 → "28 min"; 75 → "1 h 15 min". */
@Pipe({ name: 'duration' })
export class DurationPipe implements PipeTransform {
  transform(minutes: number | null | undefined): string {
    if (minutes === null || minutes === undefined) return '';
    const total = Math.max(0, Math.round(minutes));
    const hours = Math.floor(total / 60);
    const rest = total % 60;
    if (!hours) return `${rest} min`;
    return rest ? `${hours} h ${rest} min` : `${hours} h`;
  }
}
