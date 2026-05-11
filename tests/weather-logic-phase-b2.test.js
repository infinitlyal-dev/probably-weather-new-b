// Phase B-2 weather logic changes:
// 1. utcOffsetSeconds fallback chain (OM → PW → WA → default-utc)
// 2. Broader multi-source consensus (wind/heat/cold/storm) — added in Item 2
// 3. Provider mapping completeness (PW expanded icons + MET full symbol map) — added in Item 3

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import handler from '../api/weather.js';

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
