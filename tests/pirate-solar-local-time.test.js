import { describe, expect, it } from 'vitest';
import { unixToLocalIso } from '../api/weather.js';

describe('B8 Pirate Weather solar-time normalization', () => {
  it('B8 converts a UTC Unix sunrise to the location-local ISO clock time', () => {
    const sunriseUtc = Date.UTC(2026, 6, 10, 4, 30, 0) / 1000;
    expect(unixToLocalIso(sunriseUtc, 2 * 60 * 60)).toBe('2026-07-10T06:30:00');
  });

  it('B8 carries the local calendar date across a negative-offset boundary', () => {
    const sunsetUtc = Date.UTC(2026, 6, 10, 1, 15, 0) / 1000;
    expect(unixToLocalIso(sunsetUtc, -7 * 60 * 60)).toBe('2026-07-09T18:15:00');
  });

  it('B8 leaves missing Pirate solar values null', () => {
    expect(unixToLocalIso(null, 7200)).toBe(null);
  });
});
