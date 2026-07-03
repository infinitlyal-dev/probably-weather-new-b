import { describe, expect, it } from 'vitest';

import { isRegionTagAt, isWesternCape, regionTagsAt } from '../assets/geo-regions.js';

const PLACES = {
  capeTown: { lat: -33.9249, lon: 18.4241 },
  joburg: { lat: -26.2041, lon: 28.0473 },
  pretoria: { lat: -25.7479, lon: 28.2293 },
  bloemfontein: { lat: -29.0852, lon: 26.1596 },
  beaufortWest: { lat: -32.3567, lon: 22.5820 },
  durban: { lat: -29.8587, lon: 31.0218 },
};

describe('geo region boxes for witty gating', () => {
  it('reuses the existing Western Cape Cape Doctor box', () => {
    expect(isWesternCape(PLACES.capeTown)).toBe(true);
    expect(isWesternCape(PLACES.joburg)).toBe(false);
  });

  it('lands inland probe cities in their intended boxes', () => {
    expect(isRegionTagAt('gauteng', PLACES.joburg.lat, PLACES.joburg.lon)).toBe(true);
    expect(isRegionTagAt('gauteng', PLACES.pretoria.lat, PLACES.pretoria.lon)).toBe(true);
    expect(isRegionTagAt('free-state', PLACES.bloemfontein.lat, PLACES.bloemfontein.lon)).toBe(true);
    expect(isRegionTagAt('karoo', PLACES.beaufortWest.lat, PLACES.beaufortWest.lon)).toBe(true);
  });

  it('keeps Cape Town and Durban out of the new inland boxes', () => {
    const inland = ['gauteng', 'highveld', 'free-state', 'karoo'];
    for (const place of [PLACES.capeTown, PLACES.durban]) {
      expect(inland.filter((region) => isRegionTagAt(region, place.lat, place.lon))).toEqual([]);
    }
    expect(regionTagsAt(PLACES.durban.lat, PLACES.durban.lon)).toEqual([]);
  });
});
