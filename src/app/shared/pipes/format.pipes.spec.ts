import { registerLocaleData } from '@angular/common';
import localeEsCo from '@angular/common/locales/es-CO';
import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { CurrencyCopPipe, DistanceKmPipe, DurationPipe } from './format.pipes';

registerLocaleData(localeEsCo);

describe('format pipes', () => {
  it('formats Colombian pesos without cents', () => {
    TestBed.configureTestingModule({ providers: [{ provide: LOCALE_ID, useValue: 'es-CO' }] });
    const pipe = TestBed.runInInjectionContext(() => new CurrencyCopPipe());
    expect(pipe.transform(6500).replace(/\s/g, ' ')).toBe('$ 6.500');
    expect(pipe.transform(null)).toBe('');
  });

  it('formats distances', () => {
    const pipe = new DistanceKmPipe();
    expect(pipe.transform(0.85)).toBe('850 m');
    expect(pipe.transform(12.43)).toBe('12,4 km');
    expect(pipe.transform(null)).toBe('');
  });

  it('formats durations in minutes and hours', () => {
    const pipe = new DurationPipe();
    expect(pipe.transform(28)).toBe('28 min');
    expect(pipe.transform(75)).toBe('1 h 15 min');
    expect(pipe.transform(120)).toBe('2 h');
    expect(pipe.transform(undefined)).toBe('');
  });
});
