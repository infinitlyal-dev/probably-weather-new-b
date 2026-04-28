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
});
