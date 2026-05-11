// Phase B-2 weather logic changes:
// 1. utcOffsetSeconds fallback chain (OM → PW → WA → default-utc)
// 2. Broader multi-source consensus (wind/heat/cold/storm) — added in Item 2
// 3. Provider mapping completeness (PW expanded icons + MET full symbol map) — added in Item 3

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import handler, { categorizeDesc } from '../api/weather.js';

// ---------------------------------------------------------------------------
// Mock helpers (mirror tests/weather-logic-phase-b.test.js style)
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
    weather_code: 2,
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
    weather_code: Array(48).fill(2),
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
          instant: { details: { air_temperature: 22, wind_speed: 3, relative_humidity: 55, cloud_area_fraction: 50 } },
          next_1_hours: { summary: { symbol_code: symbol }, details: { precipitation_amount: 0 } },
        },
      })),
    },
  };
};

const makeWeatherApiPayload = (overrides = {}) => ({
  location: {
    name: 'Strand',
    region: 'Western Cape',
    country: 'South Africa',
    lat: -34.1,
    lon: 18.83,
    tz_id: 'Africa/Johannesburg',
    localtime_epoch: 1746967800,
    localtime: '2026-05-11 13:30',
    ...(overrides.location || {}),
  },
  current: {
    temp_c: 22, feelslike_c: 22, wind_kph: 10, humidity: 55,
    condition: { code: 1003, text: 'Partly cloudy' },
    ...(overrides.current || {}),
  },
  forecast: {
    forecastday: [
      {
        date: '2026-05-11',
        day: { maxtemp_c: 24, mintemp_c: 18, totalprecip_mm: 0, daily_chance_of_rain: 0, uv: 4, condition: { code: 1003, text: 'Partly cloudy' } },
        astro: { sunrise: '06:30 AM', sunset: '06:00 PM' },
        hour: Array.from({ length: 24 }, (_, h) => ({
          temp_c: 22, feelslike_c: 22, wind_kph: 10, humidity: 55, cloud: 50, precip_mm: 0, chance_of_rain: 0,
          condition: { code: 1003, text: 'Partly cloudy' },
        })),
      },
      {
        date: '2026-05-12',
        day: { maxtemp_c: 24, mintemp_c: 18, totalprecip_mm: 0, daily_chance_of_rain: 0, uv: 4, condition: { code: 1003, text: 'Partly cloudy' } },
        astro: { sunrise: '06:30 AM', sunset: '06:00 PM' },
        hour: Array.from({ length: 24 }, (_, h) => ({
          temp_c: 22, feelslike_c: 22, wind_kph: 10, humidity: 55, cloud: 50, precip_mm: 0, chance_of_rain: 0,
          condition: { code: 1003, text: 'Partly cloudy' },
        })),
      },
    ],
  },
});

const makePirateWeatherPayload = (overrides = {}) => ({
  offset: 2.0,
  currently: {
    temperature: 22, apparentTemperature: 22, windSpeed: 2.8, humidity: 0.55,
    cloudCover: 0.5, uvIndex: 4, icon: 'partly-cloudy-day',
    ...(overrides.currently || {}),
  },
  daily: {
    data: Array.from({ length: 7 }, () => ({
      temperatureHigh: 24, temperatureLow: 18, precipProbability: 0, uvIndex: 5,
      icon: 'partly-cloudy-day', sunriseTime: 1746939000, sunsetTime: 1746984000,
    })),
  },
  ...overrides,
});

const callWeather = async (envOverride = {}) => {
  let statusCode = 200;
  let body;
  const req = { query: { lat: '-34.1', lon: '18.83', name: 'Strand' } };
  const res = {
    setHeader: vi.fn(),
    status(code) { statusCode = code; return this; },
    json(payload) { body = payload; return this; },
  };
  // Cleanly stub env vars for WA/PW key presence per scenario
  const origWA = process.env.WEATHERAPI_KEY;
  const origPW = process.env.PIRATE_WEATHER_KEY;
  if ('WEATHERAPI_KEY' in envOverride) process.env.WEATHERAPI_KEY = envOverride.WEATHERAPI_KEY;
  if ('PIRATE_WEATHER_KEY' in envOverride) process.env.PIRATE_WEATHER_KEY = envOverride.PIRATE_WEATHER_KEY;
  try {
    await handler(req, res);
  } finally {
    if ('WEATHERAPI_KEY' in envOverride) {
      if (origWA === undefined) delete process.env.WEATHERAPI_KEY; else process.env.WEATHERAPI_KEY = origWA;
    }
    if ('PIRATE_WEATHER_KEY' in envOverride) {
      if (origPW === undefined) delete process.env.PIRATE_WEATHER_KEY; else process.env.PIRATE_WEATHER_KEY = origPW;
    }
  }
  return { statusCode, body };
};

// ---------------------------------------------------------------------------
// ITEM 1 — utcOffsetSeconds fallback chain
// ---------------------------------------------------------------------------

describe('Item 1: Open-Meteo supplies the offset (primary path, unchanged behaviour)', () => {
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
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("uses OM's utc_offset_seconds and labels source 'open-meteo'", async () => {
    const { body } = await callWeather();
    expect(body.meta.utcOffsetSeconds).toBe(7200);
    expect(body.meta.utcOffsetSource).toBe('open-meteo');
  });
});

describe('Item 1: OM fails, Pirate Weather fills the offset', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-11T11:15:00Z'));
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const href = String(url);
      if (href.startsWith('https://api.open-meteo.com/')) throw new Error('simulate OM fail');
      if (href.startsWith('https://api.pirateweather.net/')) return makeResponse(makePirateWeatherPayload());
      if (href.startsWith('https://api.met.no/')) return makeResponse(makeMetPayload());
      throw new Error(`Unexpected URL: ${href}`);
    }));
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("falls back to PW's offset field (hours → seconds) and labels source 'pirate-weather'", async () => {
    const { body } = await callWeather({ PIRATE_WEATHER_KEY: 'test-key' });
    // PW offset 2.0 hours → 7200 seconds
    expect(body.meta.utcOffsetSource).toBe('pirate-weather');
    expect(body.meta.utcOffsetSeconds).toBe(7200);
  });

  it("MET hourly alignment stays correct under PW fallback (regression: previously OM-SPOF)", async () => {
    const { body } = await callWeather({ PIRATE_WEATHER_KEY: 'test-key' });
    // With offset 7200s, MET data starting at UTC midnight aligns to local 02:00
    // i.e. aggregatedHourly[2] should have a non-null temp from MET
    expect(body.hourly[2].tempC).not.toBeNull();
  });
});

describe('Item 1: OM and PW fail, WeatherAPI fills via tz_id', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-11T11:15:00Z'));
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const href = String(url);
      if (href.startsWith('https://api.open-meteo.com/')) throw new Error('simulate OM fail');
      if (href.startsWith('https://api.weatherapi.com/')) return makeResponse(makeWeatherApiPayload());
      if (href.startsWith('https://api.met.no/')) return makeResponse(makeMetPayload());
      throw new Error(`Unexpected URL: ${href}`);
    }));
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("resolves Africa/Johannesburg → +7200s via Intl.DateTimeFormat", async () => {
    const { body } = await callWeather({ WEATHERAPI_KEY: 'test-key' });
    expect(body.meta.utcOffsetSource).toBe('weatherapi');
    expect(body.meta.utcOffsetSeconds).toBe(7200);
  });
});

describe('Item 1: WeatherAPI fallback handles non-SA timezones correctly', () => {
  // The fallback chain should generalise — not be SA-specific.
  beforeEach(() => {
    vi.useFakeTimers();
    // Pick mid-winter for the US so DST is clear: Jan is PST (-08:00).
    vi.setSystemTime(new Date('2026-01-15T18:00:00Z'));
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const href = String(url);
      if (href.startsWith('https://api.open-meteo.com/')) throw new Error('simulate OM fail');
      if (href.startsWith('https://api.weatherapi.com/')) {
        return makeResponse(makeWeatherApiPayload({
          location: { name: 'Los Angeles', tz_id: 'America/Los_Angeles', lat: 34.05, lon: -118.24 },
        }));
      }
      if (href.startsWith('https://api.met.no/')) return makeResponse(makeMetPayload());
      throw new Error(`Unexpected URL: ${href}`);
    }));
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("America/Los_Angeles in January resolves to -28800s (PST, -8 hours)", async () => {
    const { body } = await callWeather({ WEATHERAPI_KEY: 'test-key' });
    expect(body.meta.utcOffsetSource).toBe('weatherapi');
    expect(body.meta.utcOffsetSeconds).toBe(-28800);
  });
});

describe('Item 1: all sources fail, default to UTC with explicit source label', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-11T11:15:00Z'));
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const href = String(url);
      if (href.startsWith('https://api.open-meteo.com/')) throw new Error('simulate OM fail');
      // Even MET responds — without it activeNorms is 0 and we'd hit the 503 path.
      if (href.startsWith('https://api.met.no/')) return makeResponse(makeMetPayload());
      throw new Error(`Unexpected URL: ${href}`);
    }));
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("when only MET responds (no offset source available), utcOffsetSource === 'default-utc'", async () => {
    // No WEATHERAPI_KEY, no PIRATE_WEATHER_KEY → only MET is live.
    const { body } = await callWeather({ WEATHERAPI_KEY: '', PIRATE_WEATHER_KEY: '' });
    expect(body.meta.utcOffsetSource).toBe('default-utc');
    expect(body.meta.utcOffsetSeconds).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// ITEM 2 — Broader multi-source consensus (storm / wind / heat / cold)
//
// Phase A's two-source-consensus rule covered fog (and hail/thunder via the
// pre-derive consensus rungs). Phase B-2 Item 2 extends the SAME post-derive
// override pattern uniformly to storm/wind/heat/cold. With ≥3 sources active
// but <2 individually supporting the condition, demote to 'clear' with an
// audit-trail entry in conditionSignals.overrides.
// ---------------------------------------------------------------------------

// Helper: build OM payload that triggers `wind` (windKph ≥ 30) on the ensemble.
// OM has the highest weight (~0.53 of normalised), so to push the ensemble above
// the wind threshold from a single high reading, OM must be well above the
// trigger — e.g. 60 km/h pulls the ensemble into wind territory even when other
// sources are calm.
const makeOmWindyAt = (windKph = 60) => makeOpenMeteoPayload({
  current: { temperature_2m: 22, apparent_temperature: 22, weather_code: 2, wind_speed_10m: windKph, wind_gusts_10m: windKph + 10, relative_humidity_2m: 55, cloud_cover: 50 },
});

// Helper: PW payload with given wind speed (m/s — code converts to km/h via *3.6)
const makePwWith = (windMs, temp = 22) => makePirateWeatherPayload({
  currently: { temperature: temp, apparentTemperature: temp, windSpeed: windMs, humidity: 0.55, cloudCover: 0.5, uvIndex: 4, icon: 'partly-cloudy-day' },
});

// Helper: WA payload with given wind speed (km/h directly)
const makeWaWithWind = (windKph) => makeWeatherApiPayload({
  current: { temp_c: 22, feelslike_c: 22, wind_kph: windKph, humidity: 55, condition: { code: 1003, text: 'Partly cloudy' } },
});

// Helper: MET timeseries with given wind speed (m/s; code converts via *3.6)
const makeMetWithWind = (windMs) => {
  const startUtc = Date.UTC(2026, 4, 11, 0, 0, 0);
  return {
    properties: {
      timeseries: Array.from({ length: 48 }, (_, i) => ({
        time: new Date(startUtc + i * 60 * 60 * 1000).toISOString(),
        data: {
          instant: { details: { air_temperature: 22, wind_speed: windMs, relative_humidity: 55, cloud_area_fraction: 50 } },
          next_1_hours: { summary: { symbol_code: 'partlycloudy_day' }, details: { precipitation_amount: 0 } },
        },
      })),
    },
  };
};

describe('Item 2: wind consensus — only 1 of 3 sources supports wind → demote to clear', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-11T11:15:00Z'));
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const href = String(url);
      // OM windy at 60 km/h (heavy outlier — pulls ensemble above wind threshold).
      // PW + MET both calm at 3 km/h. Ensemble ~33 km/h → derive returns 'wind'.
      // But only 1 of 3 sources individually meets the predicate (≥25 km/h).
      // Phase B-2 Item 2 consensus override should demote to 'clear'.
      if (href.startsWith('https://api.open-meteo.com/')) return makeResponse(makeOmWindyAt(60));
      if (href.startsWith('https://api.pirateweather.net/')) return makeResponse(makePwWith(0.83));
      if (href.startsWith('https://api.met.no/')) return makeResponse(makeMetWithWind(0.83));
      throw new Error(`Unexpected URL: ${href}`);
    }));
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("conditionKey is NOT 'wind' (single-source outlier demoted to clear)", async () => {
    const { body } = await callWeather({ PIRATE_WEATHER_KEY: 'test-key' });
    expect(body.now.conditionKey).not.toBe('wind');
    // overrides should record the wind-consensus-failed transformation
    const overrides = body.now.conditionSignals.overrides;
    const windOverride = overrides.find(o => o.rule === 'wind-consensus-failed');
    expect(windOverride).toBeDefined();
    expect(windOverride.from).toBe('wind');
    expect(windOverride.to).toBe('clear');
  });
});

describe('Item 2: wind consensus — 2 of 3 sources support wind → preserved', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-11T11:15:00Z'));
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const href = String(url);
      // OM 50 + PW 35 km/h (≈9.72 m/s) + MET 30 km/h (≈8.33 m/s) — all three
      // support wind. Ensemble is squarely in wind territory; consensus passes.
      if (href.startsWith('https://api.open-meteo.com/')) return makeResponse(makeOmWindyAt(50));
      if (href.startsWith('https://api.pirateweather.net/')) return makeResponse(makePwWith(9.72));
      if (href.startsWith('https://api.met.no/')) return makeResponse(makeMetWithWind(8.33));
      throw new Error(`Unexpected URL: ${href}`);
    }));
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("conditionKey is 'wind' (2+ sources support)", async () => {
    const { body } = await callWeather({ PIRATE_WEATHER_KEY: 'test-key' });
    expect(body.now.conditionKey).toBe('wind');
    const overrides = body.now.conditionSignals.overrides;
    expect(overrides.find(o => o.rule === 'wind-consensus-failed')).toBeUndefined();
  });
});

describe('Item 2: heat consensus — only 1 of 3 sources is hot enough → demote', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-11T11:15:00Z'));
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const href = String(url);
      // OM reports 36°C, PW reports 22°C, MET reports 22°C. Ensemble might
      // average ~28-30 — close to heat threshold — but only 1 source individually
      // supports heat. Should demote.
      if (href.startsWith('https://api.open-meteo.com/')) {
        return makeResponse(makeOpenMeteoPayload({
          current: { temperature_2m: 36, apparent_temperature: 36, weather_code: 0, wind_speed_10m: 5, wind_gusts_10m: 5, relative_humidity_2m: 30, cloud_cover: 10 },
        }));
      }
      if (href.startsWith('https://api.pirateweather.net/')) return makeResponse(makePwWith(0.83, 22));
      if (href.startsWith('https://api.met.no/')) return makeResponse(makeMetWithWind(0.83));
      throw new Error(`Unexpected URL: ${href}`);
    }));
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("conditionKey demoted from 'heat' to 'clear' under consensus-failed", async () => {
    const { body } = await callWeather({ PIRATE_WEATHER_KEY: 'test-key' });
    // Ensemble warm/heat might fire, but with only 1 supporting source, override fires.
    if (body.now.conditionKey === 'clear' || body.now.conditionKey === 'cloudy') {
      const override = body.now.conditionSignals.overrides.find(o => o.rule === 'heat-consensus-failed');
      // If derive picked heat, the override should have fired. If derive picked clear
      // directly (ensemble cool enough), no override is needed.
      if (override) {
        expect(override.from).toBe('heat');
        expect(override.to).toBe('clear');
      }
      expect(body.now.conditionKey).not.toBe('heat');
    } else {
      // Sanity: not heat
      expect(body.now.conditionKey).not.toBe('heat');
    }
  });
});

describe('Item 2: heat consensus — 2 of 3 sources hot → preserved', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-11T11:15:00Z'));
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const href = String(url);
      // OM 36, PW 33, MET 22 — two sources support heat
      if (href.startsWith('https://api.open-meteo.com/')) {
        return makeResponse(makeOpenMeteoPayload({
          current: { temperature_2m: 36, apparent_temperature: 36, weather_code: 0, wind_speed_10m: 5, wind_gusts_10m: 5, relative_humidity_2m: 30, cloud_cover: 10 },
        }));
      }
      if (href.startsWith('https://api.pirateweather.net/')) return makeResponse(makePwWith(0.83, 33));
      if (href.startsWith('https://api.met.no/')) return makeResponse(makeMetWithWind(0.83));
      throw new Error(`Unexpected URL: ${href}`);
    }));
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("conditionKey is 'heat' (2 sources individually support)", async () => {
    const { body } = await callWeather({ PIRATE_WEATHER_KEY: 'test-key' });
    expect(body.now.conditionKey).toBe('heat');
    expect(body.now.conditionSignals.overrides.find(o => o.rule === 'heat-consensus-failed')).toBeUndefined();
  });
});

describe('Item 2: storm consensus — only 1 of 3 sources votes storm → demote', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-11T11:15:00Z'));
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const href = String(url);
      // OM partly cloudy, PW reports thunderstorm icon (single source), MET partly cloudy
      if (href.startsWith('https://api.open-meteo.com/')) return makeResponse(makeOpenMeteoPayload());
      if (href.startsWith('https://api.pirateweather.net/')) {
        return makeResponse(makePirateWeatherPayload({
          currently: { temperature: 22, apparentTemperature: 22, windSpeed: 0.83, humidity: 0.55, cloudCover: 0.5, uvIndex: 4, icon: 'thunderstorm' },
        }));
      }
      if (href.startsWith('https://api.met.no/')) return makeResponse(makeMetPayload('partlycloudy_day'));
      throw new Error(`Unexpected URL: ${href}`);
    }));
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("single-source storm gets demoted via consensus rule", async () => {
    const { body } = await callWeather({ PIRATE_WEATHER_KEY: 'test-key' });
    // PW's storm vote alone can't win the headline. Either derive avoided storm
    // (category-aware vote picked partly-cloudy bucket since storm bucket weight
    // 1 vs partly-cloudy weight 2), OR derive picked storm and consensus demoted.
    expect(body.now.conditionKey).not.toBe('storm');
  });
});

describe('Item 2: <3 active sources skips consensus override (matches fog rule)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-11T11:15:00Z'));
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const href = String(url);
      // Only OM + MET active (no WA, no PW). OM has wind 60, MET has wind 0.83 m/s.
      if (href.startsWith('https://api.open-meteo.com/')) return makeResponse(makeOmWindyAt(60));
      if (href.startsWith('https://api.met.no/')) return makeResponse(makeMetWithWind(0.83));
      throw new Error(`Unexpected URL: ${href}`);
    }));
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("with only 2 sources, consensus override is NOT applied (data too thin)", async () => {
    const { body } = await callWeather({ WEATHERAPI_KEY: '', PIRATE_WEATHER_KEY: '' });
    // Ensemble wind is between 32 and 3 km/h, weighted. Could fire wind depending on weights.
    // Whatever fires, it should NOT carry a wind-consensus-failed override (since we don't
    // apply the override with <3 sources).
    expect(body.now.conditionSignals.overrides.find(o => o.rule === 'wind-consensus-failed')).toBeUndefined();
  });
});

describe('Item 2: daily-path consensus — storm', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-11T11:15:00Z'));
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const href = String(url);
      if (href.startsWith('https://api.open-meteo.com/')) return makeResponse(makeOpenMeteoPayload());
      // PW reports daily thunderstorm icon for day 0 only — single source
      if (href.startsWith('https://api.pirateweather.net/')) {
        return makeResponse(makePirateWeatherPayload({
          daily: {
            data: Array.from({ length: 7 }, (_, d) => ({
              temperatureHigh: 24, temperatureLow: 18, precipProbability: 0, uvIndex: 5,
              icon: d === 0 ? 'thunderstorm' : 'partly-cloudy-day',
              sunriseTime: 1746939000, sunsetTime: 1746984000,
            })),
          },
        }));
      }
      if (href.startsWith('https://api.met.no/')) return makeResponse(makeMetPayload());
      throw new Error(`Unexpected URL: ${href}`);
    }));
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("day 0 daily 'storm' (single source) is demoted via daily consensus", async () => {
    const { body } = await callWeather({ PIRATE_WEATHER_KEY: 'test-key' });
    // PW alone says storm for day 0 — should not be the daily key
    expect(body.daily[0].conditionKey).not.toBe('storm');
    // If derive picked storm, override audit trail should show it
    const override = body.daily[0].conditionSignals.overrides.find(o => o.rule === 'storm-consensus-failed');
    if (body.daily[0].conditionSignals.overrides.length > 0 && override) {
      expect(override.from).toBe('storm');
      expect(override.to).toBe('clear');
    }
  });
});

describe('Item 1: OM provides offset → PW and WA do NOT overwrite (first-fill wins)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-11T11:15:00Z'));
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const href = String(url);
      if (href.startsWith('https://api.open-meteo.com/')) return makeResponse(makeOpenMeteoPayload());
      if (href.startsWith('https://api.weatherapi.com/')) {
        // Even if WA returns a different tz_id, OM's offset wins
        return makeResponse(makeWeatherApiPayload({
          location: { name: 'Anchorage', tz_id: 'America/Anchorage' },
        }));
      }
      if (href.startsWith('https://api.pirateweather.net/')) {
        // PW also returns a different offset that would clobber if logic was wrong
        return makeResponse(makePirateWeatherPayload({ offset: -9.0 }));
      }
      if (href.startsWith('https://api.met.no/')) return makeResponse(makeMetPayload());
      throw new Error(`Unexpected URL: ${href}`);
    }));
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("OM's +7200 stays the winner even when WA and PW disagree", async () => {
    const { body } = await callWeather({ WEATHERAPI_KEY: 'test-key', PIRATE_WEATHER_KEY: 'test-key' });
    expect(body.meta.utcOffsetSource).toBe('open-meteo');
    expect(body.meta.utcOffsetSeconds).toBe(7200);
  });
});

// ---------------------------------------------------------------------------
// ITEM 3 — Provider mapping completeness
//
// (A) Pirate Weather expanded-icon mode: URL gains &icon=pirate, and the
//     pirateIconMap covers mist/haze/smoke/mixed/possible-* variants.
// (B) MET Norway: metSymbolMap fills in the missing sleet/snow/thunder
//     permutations (was ~20, now 45 codes per the official symbol spec).
// (C) categorizeDesc routes haze/smoke to fog instead of defaulting to clear.
// ---------------------------------------------------------------------------

describe('Item 3: PW URL requests expanded icon set (icon=pirate)', () => {
  let observedUrls;
  beforeEach(() => {
    observedUrls = [];
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-11T11:15:00Z'));
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const href = String(url);
      observedUrls.push(href);
      if (href.startsWith('https://api.open-meteo.com/')) return makeResponse(makeOpenMeteoPayload());
      if (href.startsWith('https://api.pirateweather.net/')) return makeResponse(makePirateWeatherPayload());
      if (href.startsWith('https://api.met.no/')) return makeResponse(makeMetPayload());
      throw new Error(`Unexpected URL: ${href}`);
    }));
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("PW URL contains &icon=pirate query param", async () => {
    await callWeather({ PIRATE_WEATHER_KEY: 'test-key' });
    const pwUrl = observedUrls.find(u => u.startsWith('https://api.pirateweather.net/'));
    expect(pwUrl).toBeDefined();
    expect(pwUrl).toContain('icon=pirate');
  });
});

describe('Item 3: PW expanded icons map correctly', () => {
  // Verify that when PW returns one of the expanded icons, it surfaces as the
  // expected description through the API response — and is categorised right.
  const runWithPwIcon = async (icon) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-11T11:15:00Z'));
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const href = String(url);
      if (href.startsWith('https://api.open-meteo.com/')) return makeResponse(makeOpenMeteoPayload());
      if (href.startsWith('https://api.pirateweather.net/')) {
        return makeResponse(makePirateWeatherPayload({
          currently: { temperature: 22, apparentTemperature: 22, windSpeed: 1, humidity: 0.55, cloudCover: 0.5, uvIndex: 4, icon },
        }));
      }
      if (href.startsWith('https://api.met.no/')) return makeResponse(makeMetPayload());
      throw new Error(`Unexpected URL: ${href}`);
    }));
    try {
      return await callWeather({ PIRATE_WEATHER_KEY: 'test-key' });
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  };

  it("'mist' → 'Mist' → fog category", async () => {
    const { body } = await runWithPwIcon('mist');
    const pwVote = body.now.conditionSignals.sourceVotes.find(v => v.source === 'Pirate Weather');
    expect(pwVote).toBeDefined();
    expect(pwVote.desc).toBe('Mist');
    expect(pwVote.vote).toBe('fog');
  });

  it("'haze' → 'Haze' → fog category (NOT clear)", async () => {
    const { body } = await runWithPwIcon('haze');
    const pwVote = body.now.conditionSignals.sourceVotes.find(v => v.source === 'Pirate Weather');
    expect(pwVote.desc).toBe('Haze');
    expect(pwVote.vote).toBe('fog');
  });

  it("'smoke' → 'Smoke' → fog category", async () => {
    const { body } = await runWithPwIcon('smoke');
    const pwVote = body.now.conditionSignals.sourceVotes.find(v => v.source === 'Pirate Weather');
    expect(pwVote.desc).toBe('Smoke');
    expect(pwVote.vote).toBe('fog');
  });

  it("'mixed' → 'Sleet' → cold category", async () => {
    const { body } = await runWithPwIcon('mixed');
    const pwVote = body.now.conditionSignals.sourceVotes.find(v => v.source === 'Pirate Weather');
    expect(pwVote.desc).toBe('Sleet');
    expect(pwVote.vote).toBe('cold');
  });

  it("'possible-rain-day' → 'Possible rain' → rain category", async () => {
    const { body } = await runWithPwIcon('possible-rain-day');
    const pwVote = body.now.conditionSignals.sourceVotes.find(v => v.source === 'Pirate Weather');
    expect(pwVote.desc).toBe('Possible rain');
    expect(pwVote.vote).toBe('rain');
  });

  it("'possible-thunderstorm-night' → 'Possible thunderstorm' → storm category", async () => {
    const { body } = await runWithPwIcon('possible-thunderstorm-night');
    const pwVote = body.now.conditionSignals.sourceVotes.find(v => v.source === 'Pirate Weather');
    expect(pwVote.desc).toBe('Possible thunderstorm');
    expect(pwVote.vote).toBe('storm');
  });
});

describe('Item 3: MET Norway full symbol map — sleet/snow/thunder variants', () => {
  // Helper: build a MET response where every hour is the given symbol_code
  const makeMetWithSymbol = (symbolCode) => {
    const startUtc = Date.UTC(2026, 4, 11, 0, 0, 0);
    return {
      properties: {
        timeseries: Array.from({ length: 48 }, (_, i) => ({
          time: new Date(startUtc + i * 60 * 60 * 1000).toISOString(),
          data: {
            instant: { details: { air_temperature: 5, wind_speed: 3, relative_humidity: 80, cloud_area_fraction: 80 } },
            next_1_hours: { summary: { symbol_code: symbolCode }, details: { precipitation_amount: 2 } },
          },
        })),
      },
    };
  };

  const runWithMetSymbol = async (symbolCode) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-11T11:15:00Z'));
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const href = String(url);
      if (href.startsWith('https://api.open-meteo.com/')) return makeResponse(makeOpenMeteoPayload());
      if (href.startsWith('https://api.met.no/')) return makeResponse(makeMetWithSymbol(symbolCode));
      throw new Error(`Unexpected URL: ${href}`);
    }));
    try {
      return await callWeather();
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  };

  it("'sleetshowersandthunder' is now mapped (was falling through to raw)", async () => {
    const { body } = await runWithMetSymbol('sleetshowersandthunder_day');
    const metVote = body.now.conditionSignals.sourceVotes.find(v => v.source === 'MET Norway');
    expect(metVote.desc).toBe('Sleet showers and thunder');
    expect(metVote.vote).toBe('storm'); // thunder wins over sleet in categorizeDesc order
  });

  it("'snowandthunder' → 'Snow and thunder' → storm", async () => {
    const { body } = await runWithMetSymbol('snowandthunder_day');
    const metVote = body.now.conditionSignals.sourceVotes.find(v => v.source === 'MET Norway');
    expect(metVote.desc).toBe('Snow and thunder');
    expect(metVote.vote).toBe('storm');
  });

  it("'lightsnowshowers' → 'Light snow showers' → cold (was falling through)", async () => {
    const { body } = await runWithMetSymbol('lightsnowshowers_day');
    const metVote = body.now.conditionSignals.sourceVotes.find(v => v.source === 'MET Norway');
    expect(metVote.desc).toBe('Light snow showers');
    expect(metVote.vote).toBe('cold');
  });

  it("'sleetshowers' → 'Sleet showers' → cold", async () => {
    const { body } = await runWithMetSymbol('sleetshowers_night');
    const metVote = body.now.conditionSignals.sourceVotes.find(v => v.source === 'MET Norway');
    expect(metVote.desc).toBe('Sleet showers');
    expect(metVote.vote).toBe('cold');
  });

  it("'heavysleetandthunder' → 'Heavy sleet and thunder' → storm", async () => {
    const { body } = await runWithMetSymbol('heavysleetandthunder_day');
    const metVote = body.now.conditionSignals.sourceVotes.find(v => v.source === 'MET Norway');
    expect(metVote.desc).toBe('Heavy sleet and thunder');
    expect(metVote.vote).toBe('storm');
  });

  it("the spec-spelling variant 'lightssleetshowersandthunder' (double-s) also maps", async () => {
    const { body } = await runWithMetSymbol('lightssleetshowersandthunder_day');
    const metVote = body.now.conditionSignals.sourceVotes.find(v => v.source === 'MET Norway');
    expect(metVote.desc).toBe('Light sleet showers and thunder');
    expect(metVote.vote).toBe('storm');
  });

  it("day/night/polartwilight suffix is correctly stripped before lookup", async () => {
    // Same base symbol, three different suffixes — all should resolve to same description
    const dayResult = await runWithMetSymbol('rainandthunder_day');
    const nightResult = await runWithMetSymbol('rainandthunder_night');
    const polarResult = await runWithMetSymbol('rainandthunder_polartwilight');
    const desc = body => body.now.conditionSignals.sourceVotes.find(v => v.source === 'MET Norway').desc;
    expect(desc(dayResult.body)).toBe('Rain and thunder');
    expect(desc(nightResult.body)).toBe('Rain and thunder');
    expect(desc(polarResult.body)).toBe('Rain and thunder');
  });
});

describe('Item 3: categorizeDesc routes haze/smoke to fog', () => {
  // Direct unit tests on the exported helper.
  it("'Haze' → 'fog' (previously 'clear', a regression for low-visibility weather)", () => {
    expect(categorizeDesc('Haze')).toBe('fog');
  });

  it("'Smoke' → 'fog' (bush-fire smoke is a visibility issue, not a clear day)", () => {
    expect(categorizeDesc('Smoke')).toBe('fog');
  });

  it("'Mist' still routes to 'fog' (existing keyword preserved)", () => {
    expect(categorizeDesc('Mist')).toBe('fog');
  });

  it("'Fog' still routes to 'fog' (existing keyword preserved)", () => {
    expect(categorizeDesc('Fog')).toBe('fog');
  });

  it("haze with other context (\"Heavy haze and smoke\") still routes to 'fog'", () => {
    expect(categorizeDesc('Heavy haze and smoke')).toBe('fog');
  });

  it("rain wins over haze when both keywords present (priority order preserved)", () => {
    // 'rain' is checked before 'haze' in the keyword cascade
    expect(categorizeDesc('Rain with light haze')).toBe('rain');
  });
});
