// The region map for rules proven region by region (api/_lib/regions.js, review/accuracy/v3/PLAN.md): a place
// belongs to its nearest measured station's region. The copy must match the stations the checks score.
import { describe, expect, it } from 'vitest';
import { REGION_STATIONS, regionOf } from '../api/_lib/regions.js';
import { SCORED } from '../review/accuracy/v2/stations.mjs';
import { SYNOP_STATIONS } from '../review/accuracy/v2/fetch-synop.mjs';

describe('regionOf', () => {
  it('the stations are exactly the scored airports and the SAWS towns, at their coordinates', () => {
    const want = [...SCORED, ...SYNOP_STATIONS].map((s) => ({ id: s.id, region: s.region, lat: Number(s.lat.toFixed(3)), lon: Number(s.lon.toFixed(3)) }));
    expect(REGION_STATIONS).toEqual(want);
  });

  it('every station falls in its own region', () => {
    for (const s of REGION_STATIONS) expect(regionOf(s.lat, s.lon), s.id).toBe(s.region);
  });

  it("Al's spots and the places the rules were argued on", () => {
    expect(regionOf(-34.1163, 18.8362)).toBe('Western Cape');   // Strand
    expect(regionOf(-33.9249, 18.4241)).toBe('Western Cape');   // Cape Town city
    expect(regionOf(-33.09, 18.03)).toBe('West Coast');          // Langebaan
    expect(regionOf(-33.59, 22.20)).toBe('Garden Route');        // Oudtshoorn
    expect(regionOf(-29.60, 30.38)).toBe('KZN inland');          // Pietermaritzburg
    expect(regionOf(-26.20, 28.05)).toBe('Highveld');            // Johannesburg
  });

  it('outside South Africa there is no region', () => {
    expect(regionOf(51.5, -0.12)).toBe(null);
    expect(regionOf(-15.4, 28.3)).toBe(null);
    expect(regionOf(NaN, 18)).toBe(null);
  });
});
