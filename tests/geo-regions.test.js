import { describe, expect, it } from 'vitest';

import { isRegionTagAt, isWesternCape, regionTagsAt } from '../assets/geo-regions.js';

const PLACES = {
  capeTown: { lat: -33.9249, lon: 18.4241 },
  joburg: { lat: -26.2041, lon: 28.0473 },
  pretoria: { lat: -25.7479, lon: 28.2293 },
  bloemfontein: { lat: -29.0852, lon: 26.1596 },
  beaufortWest: { lat: -32.3567, lon: 22.5820 },
  durban: { lat: -29.8587, lon: 31.0218 },
  nelspruit: { lat: -25.4753, lon: 30.9694 },
  midlandsHowick: { lat: -29.4886, lon: 30.2325 },
  gqeberha: { lat: -33.9608, lon: 25.6022 },
  jeffreysBay: { lat: -34.0507, lon: 24.9307 },
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

  it('keeps Cape Town and Durban out of the old inland boxes', () => {
    const inland = ['gauteng', 'highveld', 'free-state', 'karoo'];
    for (const place of [PLACES.capeTown, PLACES.durban]) {
      expect(inland.filter((region) => isRegionTagAt(region, place.lat, place.lon))).toEqual([]);
    }
    // Durban now has a home box (kzn) — the only region it should resolve to.
    expect(regionTagsAt(PLACES.durban.lat, PLACES.durban.lon)).toEqual(['kzn']);
  });

  describe('lowveld / kzn / eastern-cape region boxes (un-held meme-batch-2 lines)', () => {
    it('lands Nelspruit in lowveld only', () => {
      expect(isRegionTagAt('lowveld', PLACES.nelspruit.lat, PLACES.nelspruit.lon)).toBe(true);
      expect(regionTagsAt(PLACES.nelspruit.lat, PLACES.nelspruit.lon)).toEqual(['lowveld']);
    });
    it('lands Durban and the KZN Midlands in kzn', () => {
      expect(isRegionTagAt('kzn', PLACES.durban.lat, PLACES.durban.lon)).toBe(true);
      expect(isRegionTagAt('kzn', PLACES.midlandsHowick.lat, PLACES.midlandsHowick.lon)).toBe(true);
      expect(regionTagsAt(PLACES.midlandsHowick.lat, PLACES.midlandsHowick.lon)).toEqual(['kzn']);
    });
    it('lands Gqeberha and Jeffreys Bay in eastern-cape', () => {
      expect(isRegionTagAt('eastern-cape', PLACES.gqeberha.lat, PLACES.gqeberha.lon)).toBe(true);
      expect(isRegionTagAt('eastern-cape', PLACES.jeffreysBay.lat, PLACES.jeffreysBay.lon)).toBe(true);
      expect(regionTagsAt(PLACES.gqeberha.lat, PLACES.gqeberha.lon)).toEqual(['eastern-cape']);
      expect(regionTagsAt(PLACES.jeffreysBay.lat, PLACES.jeffreysBay.lon)).toEqual(['eastern-cape']);
    });
    it('keeps Cape Town out of all three new boxes (negative)', () => {
      const fresh = ['lowveld', 'kzn', 'eastern-cape'];
      expect(fresh.filter((region) => isRegionTagAt(region, PLACES.capeTown.lat, PLACES.capeTown.lon))).toEqual([]);
    });
  });
});
