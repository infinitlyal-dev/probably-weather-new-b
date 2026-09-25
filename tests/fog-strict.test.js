// The fog detector's strict gates (review/accuracy/v3/PLAN.md, results/v3-fog.txt; Fable ruling 1): in the
// regions where they were proven (FOG_STRICT_REGIONS) the current hour also needs humidity ≥ 95 % and
// Open-Meteo's own wind ≤ 10 km/h. Strand's two pinned real fogs must still fire; Cape Town's live false fog
// (25 Sept 00:10, airport 6 km under cloud at 500 ft) must not. Everywhere else the detector is unchanged.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import handler, { detectAdvectionFog, FOG_STRICT_REGIONS, FOG_STRICT_MIN_HUMIDITY, FOG_STRICT_MAX_WIND_KPH } from '../api/weather.js';

const fill = (v) => Array.from({ length: 48 }, () => v);
const om = ({ visM, rh, tempC, dewC, windKph, precipProb = 0, precipMm = 0 }) => ({
  visibility: fill(visM), humidity: fill(rh), temps: fill(tempC), dewPoints: fill(dewC),
  rains: fill(precipProb), precipMm: fill(precipMm), winds: windKph === undefined ? [] : fill(windKph),
});
const ti = (visKm) => ({ visibilityKm: fill(visKm) });

describe('the strict gates', () => {
  it('are the tested cell, in the five proven regions', () => {
    expect(FOG_STRICT_MIN_HUMIDITY).toBe(95);
    expect(FOG_STRICT_MAX_WIND_KPH).toBe(10);
    expect(FOG_STRICT_REGIONS).toEqual(['Western Cape', 'Garden Route', 'Eastern Cape', 'KZN coast', 'Lowveld']);
  });

  it('the five regions are exactly those whose wrong-fog rate fell with the whole interval below zero (results/v3-fog.json)', () => {
    const res = JSON.parse(readFileSync(new URL('../review/accuracy/v2/results/v3-fog.json', import.meta.url), 'utf8'));
    const proven = Object.entries(res.byRegion).filter(([, r]) => r.wrongPer1000 && r.wrongPer1000.hi < 0).map(([g]) => g);
    expect([...FOG_STRICT_REGIONS].sort()).toEqual(proven.sort());
  });

  it("Strand's pinned real fogs still fire: 21 May (Open-Meteo 1,040 m) and 3 Aug (Tomorrow.io 0.8 km)", () => {
    const may = detectAdvectionFog(om({ visM: 1040, rh: 97, tempC: 15, dewC: 14.6, windKph: 6.5 }), 21, null, { strict: true });
    expect(may.currentFog).toBe(true);
    expect(may.omWindKph).toBe(6.5);
    const aug = detectAdvectionFog(om({ visM: 35000, rh: 95, tempC: 15, dewC: 14.2, windKph: 5.2 }), 16, ti(0.8), { strict: true });
    expect(aug.currentFog).toBe(true);
  });

  it("Cape Town's live false fog (0.3 km, humidity 94 %) no longer fires under strict; standard still does", () => {
    const h = om({ visM: 300, rh: 94, tempC: 13, dewC: 12, windKph: 7 });
    expect(detectAdvectionFog(h, 0, null, { strict: true }).currentFog).toBe(false);
    expect(detectAdvectionFog(h, 0).currentFog).toBe(true);
  });

  it('humid enough but windier than 10 km/h, or no wind reading at all: no fog under strict', () => {
    expect(detectAdvectionFog(om({ visM: 500, rh: 97, tempC: 13, dewC: 12.6, windKph: 12 }), 5, null, { strict: true }).currentFog).toBe(false);
    const noWind = om({ visM: 500, rh: 97, tempC: 13, dewC: 12.6 });
    expect(detectAdvectionFog(noWind, 5, null, { strict: true }).currentFog).toBe(false);
    expect(detectAdvectionFog(noWind, 5).currentFog).toBe(true);
  });

  it('the trend check is the same with or without strict', () => {
    const h = om({ visM: 22000, rh: 68, tempC: 19, dewC: 9, windKph: 4 });
    h.visibility[19] = 900; h.humidity[19] = 97; h.temps[19] = 14; h.dewPoints[19] = 13.2;
    expect(detectAdvectionFog(h, 17, null, { strict: true }).trendFog).toBe(true);
    expect(detectAdvectionFog(h, 17).trendFog).toBe(true);
  });
});

// ---- the handler: a Western Cape place gets the strict gates, a Highveld place today's ----
const makeResponse = (payload, status = 200) => ({ ok: status >= 200 && status < 300, status, json: vi.fn(async () => payload) });
const flat = (n, v) => Array(n).fill(v);
// the live false-fog hour at Cape Town, 25 Sept 00:10: Open-Meteo 0.3 km, humidity 94 %, calm; clear sky above
const omPayload = {
  utc_offset_seconds: 7200,
  current: { temperature_2m: 13, apparent_temperature: 13, weather_code: 0, wind_speed_10m: 7, wind_gusts_10m: 12, relative_humidity_2m: 94, cloud_cover: 10 },
  hourly: {
    temperature_2m: flat(168, 13), apparent_temperature: flat(168, 13), precipitation_probability: flat(168, 0), precipitation: flat(168, 0),
    wind_speed_10m: flat(168, 7), wind_gusts_10m: flat(168, 12), wind_direction_10m: flat(168, 180), cloud_cover: flat(168, 10),
    relative_humidity_2m: flat(168, 94), uv_index: flat(168, 0), weather_code: flat(168, 0), visibility: flat(168, 300), dew_point_2m: flat(168, 12),
  },
  daily: {
    temperature_2m_max: flat(7, 20), temperature_2m_min: flat(7, 11), precipitation_probability_max: flat(7, 0), uv_index_max: flat(7, 4),
    weather_code: flat(7, 0), wind_speed_10m_max: flat(7, 10),
    sunrise: Array.from({ length: 7 }, (_, i) => `2026-07-${10 + i}T07:30`), sunset: Array.from({ length: 7 }, (_, i) => `2026-07-${10 + i}T17:50`),
  },
};
const fetchStub = vi.fn(async (url) => {
  const href = String(url);
  if (href.includes('open-meteo.com/')) return makeResponse(omPayload);
  throw new Error(`Unexpected URL: ${href}`);
});
const call = async (lat, lon) => {
  let body; const res = { setHeader: vi.fn(), status() { return this; }, json(p) { body = p; return this; } };
  await handler({ query: { lat: String(lat), lon: String(lon), name: 'Test' } }, res);
  return body;
};
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-07-10T01:30:00Z')); vi.stubGlobal('fetch', fetchStub); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('the forecast endpoint', () => {
  it('Western Cape: the same readings are not fog, and the signal says strict', async () => {
    const body = await call(-33.97, 18.60);
    expect(body.now.conditionKey).not.toBe('fog');
    expect(body.meta.conditionConfidence.fogSignal).toMatchObject({ rule: 'strict', region: 'Western Cape', omWindKph: 7 });
    // The trend check is unchanged (Fable ruling), so the same murk in the next hours still hedges the copy:
    // the false fog moves from the headline to 'fog may be coming' with low confidence — deliberate, pinned.
    expect(body.meta.fogTrendIncoming).toBe(true);
    expect(body.meta.confidence).toBe('low');
  });

  it('Highveld: today\'s gates, so the same readings are still fog', async () => {
    const body = await call(-26.13, 28.24);
    expect(body.now.conditionKey).toBe('fog');
    expect(body.now.conditionReason).toBe('visibility-humidity-fog-detector');
    expect(body.meta.conditionConfidence.fogSignal).toMatchObject({ rule: 'standard', region: 'Highveld' });
  });

  it('both spots carry the strict rain rule (Al, 25 Sept: strict in every region)', async () => {
    const RULE = { rainHere: { votes: 2, prob: 90, mm: 2 }, showersNearby: { prob: 60, mm: 0.3 } };
    for (const [lat, lon] of [[-33.97, 18.60], [-26.13, 28.24]]) expect((await call(lat, lon)).meta.conditionConfidence.rainRule, `${lat},${lon}`).toEqual(RULE);
  });
});
