// Phase B-1 weather logic changes:
// 1. conditionReason + conditionSignals on /api/weather (now + daily)
// 2. Category-aware voting in pickWeightedMostCommon (added in Item 2)
// 3. Per-hour condition preserved through hourly aggregation (added in Item 3)
//
// Item 2 and 3 tests are appended to this file as those items land.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import handler, { deriveCondition, categorizeDesc } from '../api/weather.js';

// ---------------------------------------------------------------------------
// ITEM 1 — deriveCondition return shape
// ---------------------------------------------------------------------------

describe('deriveCondition return shape: { key, reason }', () => {
  const baseArgs = { rainChance: 0, windKph: 5, cloudPct: 10, isDay: true };

  it('returns an object with key and reason fields', () => {
    const result = deriveCondition({ ...baseArgs, desc: 'Clear sky', tempC: 20, uvIndex: 4 });
    expect(result).toEqual(expect.objectContaining({ key: expect.any(String), reason: expect.any(String) }));
  });

  it("priority 1 storm desc → reason='desc-storm-keyword'", () => {
    const result = deriveCondition({ ...baseArgs, desc: 'Thunderstorm', tempC: 18 });
    expect(result.key).toBe('storm');
    expect(result.reason).toBe('desc-storm-keyword');
  });

  it("priority 5 heavy rain prob → reason='heavy-rain-prob'", () => {
    const result = deriveCondition({ ...baseArgs, desc: 'Cloudy', tempC: 18, rainChance: 70, cloudPct: 70 });
    expect(result.key).toBe('rain');
    expect(result.reason).toBe('heavy-rain-prob');
  });

  it("priority 6 high UV with temp gate → reason='high-uv-with-temp-gate'", () => {
    const result = deriveCondition({ ...baseArgs, desc: 'Clear sky', tempC: 22, uvIndex: 9, dailyHighC: 24 });
    expect(result.key).toBe('uv');
    expect(result.reason).toBe('high-uv-with-temp-gate');
  });

  it("priority 7 strong wind → reason='strong-wind'", () => {
    const result = deriveCondition({ ...baseArgs, desc: 'Cloudy', tempC: 18, windKph: 35, cloudPct: 60 });
    expect(result.key).toBe('wind');
    expect(result.reason).toBe('strong-wind');
  });

  it("priority 14 chilly with daily gate → reason='chilly-with-daily-gate'", () => {
    const result = deriveCondition({ ...baseArgs, desc: 'Clear sky', tempC: 8, dailyHighC: 12 });
    expect(result.key).toBe('cold');
    expect(result.reason).toBe('chilly-with-daily-gate');
  });

  it("priority 16 moderate UV with temp gate → reason='moderate-uv-with-temp-gate'", () => {
    const result = deriveCondition({ ...baseArgs, desc: 'Clear sky', tempC: 22, uvIndex: 6, dailyHighC: 24 });
    expect(result.key).toBe('uv');
    expect(result.reason).toBe('moderate-uv-with-temp-gate');
  });

  it("priority 17 mostly cloudy → reason='mostly-cloudy'", () => {
    const result = deriveCondition({ ...baseArgs, desc: 'Cloudy', tempC: 18, cloudPct: 70 });
    expect(result.key).toBe('cloudy');
    expect(result.reason).toBe('mostly-cloudy');
  });

  it("priority 18 partly cloudy → reason='partly-cloudy'", () => {
    const result = deriveCondition({ ...baseArgs, desc: 'Partly cloudy', tempC: 18, cloudPct: 40 });
    expect(result.key).toBe('partly-cloudy');
    expect(result.reason).toBe('partly-cloudy');
  });

  it("priority 20 fallback → reason='fallback-clear'", () => {
    // Empty desc, no other rung fires → fallback path
    const result = deriveCondition({ ...baseArgs, desc: '', tempC: 18 });
    expect(result.key).toBe('clear');
    expect(result.reason).toBe('fallback-clear');
  });

  it("hail consensus → reason='two-source-consensus-hail'", () => {
    const result = deriveCondition({
      ...baseArgs,
      desc: 'Thunderstorm with heavy hail',
      tempC: 14,
      rainChance: 60,
      sourceDescs: ['Thunderstorm with heavy hail', 'Rain showers'],
    });
    expect(result.key).toBe('hail');
    expect(result.reason).toBe('two-source-consensus-hail');
  });

  it("thunder consensus → reason='two-source-consensus-thunder'", () => {
    const result = deriveCondition({
      ...baseArgs,
      desc: 'Thunderstorm',
      tempC: 18,
      rainChance: 50,
      sourceDescs: ['Thunderstorm', 'Light rain'],
    });
    expect(result.key).toBe('thunder');
    expect(result.reason).toBe('two-source-consensus-thunder');
  });
});

// ---------------------------------------------------------------------------
// ITEM 1 — End-to-end: conditionReason + conditionSignals appear on the
// /api/weather response for both now and each daily entry.
// ---------------------------------------------------------------------------

const makeResponse = (payload, ok = true, status = 200) => ({
  ok,
  status,
  json: vi.fn(async () => payload),
});

const makeOpenMeteoPayload = (overrides = {}) => ({
  utc_offset_seconds: 7200,
  current: {
    temperature_2m: 22,
    apparent_temperature: 22,
    weather_code: 2, // partly cloudy
    wind_speed_10m: 10,
    wind_gusts_10m: 12,
    relative_humidity_2m: 55,
    cloud_cover: 50,
    ...(overrides.current || {}),
  },
  hourly: {
    temperature_2m: Array(48).fill(22),
    apparent_temperature: Array(48).fill(22),
    precipitation_probability: Array(48).fill(0),
    wind_speed_10m: Array(48).fill(10),
    wind_gusts_10m: Array(48).fill(12),
    cloud_cover: Array(48).fill(50),
    relative_humidity_2m: Array(48).fill(55),
    uv_index: Array(48).fill(4),
    ...(overrides.hourly || {}),
  },
  daily: {
    temperature_2m_max: Array(7).fill(24),
    temperature_2m_min: Array(7).fill(18),
    precipitation_probability_max: Array(7).fill(0),
    uv_index_max: Array(7).fill(5),
    weather_code: Array(7).fill(2),
    sunrise: Array(7).fill('2026-05-11T06:00'),
    sunset: Array(7).fill('2026-05-11T18:00'),
    ...(overrides.daily || {}),
  },
});

const makeMetPayload = (symbol = 'partlycloudy_day') => {
  const startUtc = Date.UTC(2026, 4, 11, 0, 0, 0);
  return {
    properties: {
      timeseries: Array.from({ length: 48 }, (_, i) => ({
        time: new Date(startUtc + i * 60 * 60 * 1000).toISOString(),
        data: {
          instant: {
            details: {
              air_temperature: 22,
              wind_speed: 3,
              relative_humidity: 55,
              cloud_area_fraction: 50,
            },
          },
          next_1_hours: {
            summary: { symbol_code: symbol },
            details: { precipitation_amount: 0 },
          },
        },
      })),
    },
  };
};

const callWeather = async () => {
  let statusCode = 200;
  let body;
  const req = { query: { lat: '-34.1', lon: '18.83', name: 'Strand' } };
  const res = {
    setHeader: vi.fn(),
    status(code) { statusCode = code; return this; },
    json(payload) { body = payload; return this; },
  };
  await handler(req, res);
  return { statusCode, body };
};

describe('API response includes conditionReason + conditionSignals', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-11T11:15:00Z'));
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const href = String(url);
      if (href.startsWith('https://api.open-meteo.com/')) return makeResponse(makeOpenMeteoPayload());
      if (href.startsWith('https://api.met.no/')) return makeResponse(makeMetPayload());
      throw new Error(`Unexpected URL: ${href}`);
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("now.conditionReason and now.conditionSignals are present", async () => {
    const { body } = await callWeather();
    expect(body.now.conditionReason).toEqual(expect.any(String));
    expect(body.now.conditionSignals).toBeDefined();
    expect(body.now.conditionSignals).toEqual(expect.objectContaining({
      descWinner: expect.any(String),
      numeric: expect.any(Object),
      sourceVotes: expect.any(Array),
      overrides: expect.any(Array),
    }));
  });

  it("now.conditionSignals.numeric exposes the inputs that fed deriveCondition", async () => {
    const { body } = await callWeather();
    const n = body.now.conditionSignals.numeric;
    expect(n).toEqual(expect.objectContaining({
      tempC: expect.any(Number),
      windKph: expect.any(Number),
      cloudPct: expect.any(Number),
      isDay: expect.any(Boolean),
    }));
    // dailyHighC is the gate input for the UV temp gate
    expect('dailyHighC' in n).toBe(true);
  });

  it("now.conditionSignals.sourceVotes shows per-source desc + categorised vote", async () => {
    const { body } = await callWeather();
    const votes = body.now.conditionSignals.sourceVotes;
    expect(votes.length).toBeGreaterThanOrEqual(1);
    for (const v of votes) {
      expect(v).toEqual(expect.objectContaining({
        source: expect.any(String),
        desc: expect.any(String),
        vote: expect.any(String),
      }));
    }
  });

  it("now.conditionSignals.overrides is empty when no override fired", async () => {
    const { body } = await callWeather();
    expect(body.now.conditionSignals.overrides).toEqual([]);
  });

  it("each daily[i] has conditionReason and conditionSignals", async () => {
    const { body } = await callWeather();
    expect(body.daily.length).toBeGreaterThan(0);
    for (const day of body.daily) {
      expect(day.conditionReason).toEqual(expect.any(String));
      expect(day.conditionSignals).toEqual(expect.objectContaining({
        descWinner: expect.any(String),
        numeric: expect.any(Object),
        sourceDescs: expect.any(Array),
        overrides: expect.any(Array),
      }));
    }
  });

  it("partly-cloudy mock yields a partly-cloudy/clear-family reason on now", async () => {
    const { body } = await callWeather();
    // Mock weather: temp 22, partly cloudy code 2, no rain, UV 4 → frontend-relevant rungs
    // Reason should be from the cloud or partly-cloudy family (not rain, not storm)
    const reason = body.now.conditionReason;
    expect(['mostly-cloudy', 'partly-cloudy', 'fallback-clear', 'desc-clear-keyword']).toContain(reason);
  });
});

// ---------------------------------------------------------------------------
// ITEM 1 — Override audit trail: when FIX-001 demotes 'rain-possible' to
// 'clear' for lack of consensus, the override appears in conditionSignals.
// ---------------------------------------------------------------------------

describe('Override trail: FIX-001 majority-override-clear', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-11T11:15:00Z'));
    // Mock with a setup that triggers rain-possible from one source but not
    // enough for majority. Here OM has rainProbabilty 25 (triggers
    // 'rain-possible-prob' rung) but MET reports clear so the majority
    // override from FIX-001 should kick in IF a third source exists.
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const href = String(url);
      if (href.startsWith('https://api.open-meteo.com/')) {
        return makeResponse(makeOpenMeteoPayload({
          current: { temperature_2m: 22, apparent_temperature: 22, weather_code: 2, wind_speed_10m: 10, wind_gusts_10m: 12, relative_humidity_2m: 55, cloud_cover: 30 },
          hourly: { precipitation_probability: Array(48).fill(25), cloud_cover: Array(48).fill(30) },
        }));
      }
      if (href.startsWith('https://api.met.no/')) return makeResponse(makeMetPayload('clearsky_day'));
      throw new Error(`Unexpected URL: ${href}`);
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("conditionSignals.overrides records the override when only 2 sources are active (no override fires — 3+ required)", async () => {
    // FIX-001 only fires with activeNorms.length >= 3, so with only OM + MET
    // we EXPECT no override — verify that's reflected in the audit trail.
    const { body } = await callWeather();
    expect(body.now.conditionSignals.overrides).toEqual([]);
  });
});
