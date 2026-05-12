import { describe, expect, it } from 'vitest';

import { getSharedPlaceFromSearch } from '../assets/startup-location.js';

describe('shared location startup params', () => {
  it('returns a shared place for valid lat/lon params', () => {
    expect(getSharedPlaceFromSearch('?lat=-33.92&lon=18.42')).toEqual({
      name: 'Unknown location',
      lat: -33.92,
      lon: 18.42,
      shared: true,
    });
  });

  it('ignores missing or out-of-range coordinates', () => {
    expect(getSharedPlaceFromSearch('?lat=-33.92')).toBeNull();
    expect(getSharedPlaceFromSearch('?lat=-91&lon=18.42')).toBeNull();
    expect(getSharedPlaceFromSearch('?lat=-33.92&lon=181')).toBeNull();
    expect(getSharedPlaceFromSearch('?lat=nope&lon=18.42')).toBeNull();
  });

  // Phase 2 audit fix Z4 — share URLs emit ?city= (see assets/share-url.js).
  // The recipient should see the sender's location label immediately rather
  // than the "Unknown location" placeholder until reverse-geocode resolves.
  describe('?city= parameter handling (Z4)', () => {
    it('uses the URL-supplied city as the place name when present', () => {
      expect(getSharedPlaceFromSearch('?lat=-33.92&lon=18.42&city=Cape%20Town')).toEqual({
        name: 'Cape Town',
        lat: -33.92,
        lon: 18.42,
        shared: true,
      });
    });

    it('trims whitespace from city', () => {
      expect(getSharedPlaceFromSearch('?lat=-33.92&lon=18.42&city=%20Strand%20').name).toBe('Strand');
    });

    it('falls back to "Unknown location" for an empty or whitespace-only city', () => {
      expect(getSharedPlaceFromSearch('?lat=-33.92&lon=18.42&city=').name).toBe('Unknown location');
      expect(getSharedPlaceFromSearch('?lat=-33.92&lon=18.42&city=%20%20').name).toBe('Unknown location');
    });

    it('caps city length at 80 characters to mirror middleware sanitization', () => {
      const long = 'A'.repeat(200);
      const result = getSharedPlaceFromSearch(`?lat=-33.92&lon=18.42&city=${encodeURIComponent(long)}`);
      expect(result.name.length).toBe(80);
    });

    it('still returns null when coords are invalid even if city is provided', () => {
      expect(getSharedPlaceFromSearch('?lat=999&lon=18.42&city=Cape%20Town')).toBeNull();
    });
  });
});
