// Prelaunch item 6 (P1-4, 2026-09-14): the location's UTC offset is resolved
// BEFORE any provider's hourly alignment.
//
// Astra's evidence: utcOffsetSeconds started at 0 and MET / Tomorrow.io aligned
// their series with it; the coordinate fallback only ran AFTER the provider
// blocks. So when Open-Meteo, WeatherAPI and Pirate all failed, MET's series
// was aligned as if the location were UTC: with a 10:15Z clock the 12:00Z
// entry landed at local index 12 instead of the 10:00Z entry (SAST = UTC+2).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/_lib/weather-cache.js', async (importOriginal) => {
  const mod = await importOriginal();
  return { ...mod, weatherCacheGet: vi.fn(mod.weatherCacheGet) };
});

import handler, { PAYLOAD_SCHEMA } from '../api/weather.js';
import { weatherCacheGet } from '../api/_lib/weather-cache.js';

const makeResponse = (payload, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: vi.fn(async () => payload),
});

// MET series from 08:00Z, one entry per hour, air_temperature = the UTC hour
// so each slot is self-identifying (08:00Z → 8, 10:00Z → 10, 12:00Z → 12 …).
const metPayload = {
  properties: {
    timeseries: Array.from({ length: 40 }, (_, i) => {
      const t = new Date(Date.UTC(2026, 8, 14, 8 + i, 0, 0));
      return {
        time: t.toISOString(),
        data: {
          instant: { details: { air_temperature: t.getUTCHours(), wind_speed: 2, relative_humidity: 50, cloud_area_fraction: 10 } },
          next_1_hours: { summary: { symbol_code: 'clearsky_day' }, details: { precipitation_amount: 0 } },
        },
      };
    }),
  },
};

const callHandler = async () => {
  let statusCode = 200;
  let body;
  const req = { query: { lat: '-34.1163', lon: '18.8362', name: 'Strand' } };
  const res = {
    setHeader: vi.fn(),
    status(code) { statusCode = code; return this; },
    json(payload) { body = payload; return this; },
  };
  await handler(req, res);
  return { statusCode, body };
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-14T10:15:00Z')); // 12:15 SAST
  delete process.env.WEATHERAPI_KEY;
  delete process.env.PIRATE_WEATHER_KEY;
  delete process.env.TOMORROWIO_API_KEY;
  weatherCacheGet.mockReset();
  weatherCacheGet.mockResolvedValue(null);
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    const href = String(url);
    if (href.includes('open-meteo.com/')) return makeResponse({ error: 'down' }, 500);
    if (href.startsWith('https://api.met.no/')) return makeResponse(metPayload);
    throw new Error(`Unexpected URL: ${href}`);
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('item 6 — UTC offset is resolved before provider alignment', () => {
  it("Astra's case: every offset-bearing provider down → MET aligns with the coordinate estimate, not UTC", async () => {
    const { statusCode, body } = await callHandler();
    expect(statusCode).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.meta.utcOffsetSource).toBe('coord-estimate');
    expect(body.meta.utcOffsetSeconds).toBe(7200);
    expect(body.meta.localHour).toBe(12);
    // Local 12:00 SAST is 10:00Z → the entry whose temperature is 10.
    // Under offset 0 this slot held the 12:00Z entry (12).
    expect(body.hourly[12].tempC).toBe(10);
    expect(body.hourly[13].tempC).toBe(11);
    expect(body.hourly[8].tempC).toBeNull(); // 06:00Z is before the series starts
    // MET's "now" is its FIRST series entry (08:00Z here) — unchanged contract,
    // asserted so the alignment fix is seen not to touch the now-path.
    expect(body.now.tempC).toBe(8);
  });

  it('a provider that supplies an offset still overrides the estimate (Open-Meteo primary)', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const href = String(url);
      if (href.includes('open-meteo.com/')) return makeResponse({
        utc_offset_seconds: 3600, // deliberately NOT the estimate, to prove precedence
        current: { temperature_2m: 18, apparent_temperature: 18, weather_code: 0, wind_speed_10m: 5, wind_gusts_10m: 6, relative_humidity_2m: 50, cloud_cover: 10 },
        hourly: { temperature_2m: Array(48).fill(18), apparent_temperature: Array(48).fill(18), precipitation_probability: Array(48).fill(0), precipitation: Array(48).fill(0), wind_speed_10m: Array(48).fill(5), wind_gusts_10m: Array(48).fill(6), cloud_cover: Array(48).fill(10), relative_humidity_2m: Array(48).fill(50), uv_index: Array(48).fill(2), weather_code: Array(48).fill(0) },
        daily: { temperature_2m_max: Array(7).fill(24), temperature_2m_min: Array(7).fill(12), precipitation_probability_max: Array(7).fill(0), uv_index_max: Array(7).fill(6), weather_code: Array(7).fill(0), sunrise: Array(7).fill('2026-09-14T06:00'), sunset: Array(7).fill('2026-09-14T18:00') },
      });
      if (href.startsWith('https://api.met.no/')) return makeResponse(metPayload);
      throw new Error(`Unexpected URL: ${href}`);
    }));
    const { body } = await callHandler();
    expect(body.meta.utcOffsetSource).toBe('open-meteo');
    expect(body.meta.utcOffsetSeconds).toBe(3600);
    expect(body.meta.localHour).toBe(11);
    // And MET is ALIGNED with that provider offset, not the estimate. Exact:
    // hourly weights OM 0.345 / MET 0.230 renormalised over the two present
    // sources → OM 0.6, MET 0.4. Local 11 (10:00Z, MET 10): 0.6·18 + 0.4·10 =
    // 14.8; local 13 (12:00Z, MET 12): 15.6. Aligned against the coordinate
    // estimate instead, the same slots would read 14.4 and 15.2.
    expect(body.hourly[11].tempC).toBe(14.8);
    expect(body.hourly[13].tempC).toBe(15.6);
  });

  it('a pre-fix cached entry (no meta.schema) is not served: the handler re-fetches and aligns correctly', async () => {
    // Written by the old code with hours aligned against UTC: 12:00Z at index 12.
    weatherCacheGet.mockResolvedValue({
      ok: true,
      location: { name: 'Strand', lat: -34.1163, lon: 18.8362 },
      now: { tempC: 8, conditionKey: 'clear', isDay: true },
      daily: [{ highC: 20, lowC: 8, conditionKey: 'clear' }],
      hourly: Array.from({ length: 48 }, (_, i) => ({ tempC: i >= 8 && i < 40 ? i : null, rainChance: 0 })),
      meta: { localHour: 12, utcOffsetSeconds: 0, utcOffsetSource: 'default-utc', updatedAtLabel: '2026-09-14T10:10:00.000Z', sources: [] },
    });
    const { body } = await callHandler();
    expect(body.meta.serverCache).toBe('miss');
    expect(body.hourly[12].tempC).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Round 2 (Astra): a schema-2 entry written by this deploy train BEFORE the
// alignment fix could still be served; the precedence test asserted metadata,
// not alignment; Tomorrow.io alignment was untested.
// ---------------------------------------------------------------------------
describe('item 6 — round 2', () => {
  it('a schema-2 cached entry (validated but aligned before this fix) is a MISS: schema is now ≥3 (4 as shipped, item 5)', async () => {
    expect(PAYLOAD_SCHEMA).toBeGreaterThanOrEqual(3);
    weatherCacheGet.mockResolvedValue({
      ok: true,
      location: { name: 'Strand', lat: -34.1163, lon: 18.8362 },
      now: { tempC: 8, conditionKey: 'clear', isDay: true },
      daily: [{ highC: 20, lowC: 8, conditionKey: 'clear' }],
      hourly: Array.from({ length: 48 }, (_, i) => ({ tempC: i >= 8 && i < 40 ? i : null, rainChance: 0 })),
      meta: { schema: 2, localHour: 12, utcOffsetSeconds: 7200, updatedAtLabel: '2026-09-14T10:10:00.000Z', sources: [] },
    });
    const { body } = await callHandler();
    expect(body.meta.serverCache).toBe('miss');
    expect(body.meta.schema).toBe(PAYLOAD_SCHEMA);
    expect(body.hourly[12].tempC).toBe(10);
  });

  it('Tomorrow.io-only forecast (every offset-bearing provider down) aligns with the estimate too', async () => {
    process.env.TOMORROWIO_API_KEY = 'ti-key';
    try {
      vi.stubGlobal('fetch', vi.fn(async (url) => {
        const href = String(url);
        if (href.includes('open-meteo.com/')) return makeResponse({ error: 'down' }, 500);
        if (href.startsWith('https://api.met.no/')) return makeResponse({ error: 'down' }, 503);
        if (href.startsWith('https://api.tomorrow.io/')) return makeResponse({
          data: { timelines: [{ intervals: Array.from({ length: 40 }, (_, i) => {
            const t = new Date(Date.UTC(2026, 8, 14, 8 + i, 0, 0));
            return { startTime: t.toISOString(), values: { temperature: t.getUTCHours(), precipitationIntensity: 0, precipitationProbability: 0, weatherCode: 1000, windSpeed: 2, humidity: 50, cloudCover: 10 } };
          }) }] },
        });
        throw new Error(`Unexpected URL: ${href}`);
      }));
      const { body } = await callHandler();
      expect(body.ok).toBe(true);
      expect(body.meta.utcOffsetSource).toBe('coord-estimate');
      expect(body.meta.localHour).toBe(12);
      expect(body.hourly[12].tempC).toBe(10); // 10:00Z at local 12:00 SAST — Tomorrow.io alone
      expect(body.hourly[13].tempC).toBe(11);
    } finally {
      delete process.env.TOMORROWIO_API_KEY;
    }
  });
});
