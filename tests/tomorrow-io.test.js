// Tomorrow.io integration tests (added 2026-05-19)
//
// Covers the 5th-source integration in api/weather.js:
//   - Graceful fallback on missing key / 401 / 429 / 500 / timeout
//   - Precipitation override fires above 0.5 mm/h threshold
//   - Thunder override on weatherCode 8000
//   - Existing 4-source consensus unchanged when Tomorrow.io is unavailable
//   - Source weights sum to 100, meta.sources / meta.sourceWeights / meta.sourceConditions
//     all include Tomorrow.io when available
//
// Mocking pattern matches weather-provider-parallel.test.js: vi.stubGlobal('fetch')
// intercepts by URL prefix and returns canned payloads.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import handler from '../api/weather.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeResponse = (payload, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: vi.fn(async () => payload),
});

const openMeteoPayload = {
  utc_offset_seconds: 7200,
  current: {
    temperature_2m: 18,
    apparent_temperature: 18,
    weather_code: 0,
    wind_speed_10m: 10,
    wind_gusts_10m: 12,
    relative_humidity_2m: 50,
    cloud_cover: 10,
  },
  hourly: {
    temperature_2m: Array(48).fill(18),
    apparent_temperature: Array(48).fill(18),
    precipitation_probability: Array(48).fill(0),
    precipitation: Array(48).fill(0),
    wind_speed_10m: Array(48).fill(10),
    wind_gusts_10m: Array(48).fill(12),
    cloud_cover: Array(48).fill(10),
    relative_humidity_2m: Array(48).fill(50),
    uv_index: Array(48).fill(4),
    weather_code: Array(48).fill(0),
  },
  daily: {
    temperature_2m_max: Array(7).fill(24),
    temperature_2m_min: Array(7).fill(12),
    precipitation_probability_max: Array(7).fill(0),
    uv_index_max: Array(7).fill(6),
    weather_code: Array(7).fill(0),
    sunrise: Array(7).fill('2026-05-19T06:00'),
    sunset: Array(7).fill('2026-05-19T18:00'),
  },
};

const weatherApiPayload = {
  location: { tz_id: 'Africa/Johannesburg' },
  current: {
    temp_c: 18,
    feelslike_c: 18,
    condition: { code: 1000, text: 'Sunny' },
    wind_kph: 10,
    humidity: 50,
  },
  forecast: {
    forecastday: Array.from({ length: 7 }, () => ({
      day: {
        maxtemp_c: 24,
        mintemp_c: 12,
        totalprecip_mm: 0,
        daily_chance_of_rain: 0,
        uv: 6,
        condition: { code: 1000, text: 'Sunny' },
      },
      astro: { sunrise: '06:00 AM', sunset: '06:00 PM' },
      hour: Array.from({ length: 24 }, () => ({
        temp_c: 18,
        feelslike_c: 18,
        chance_of_rain: 0,
        precip_mm: 0,
        wind_kph: 10,
        cloud: 10,
        humidity: 50,
        condition: { code: 1000, text: 'Sunny' },
      })),
    })),
  },
};

const piratePayload = {
  offset: 2,
  currently: {
    temperature: 18,
    windSpeed: 3,
    windGust: 4,
    humidity: 0.5,
    icon: 'clear-day',
  },
  daily: {
    data: Array.from({ length: 7 }, () => ({
      temperatureHigh: 24,
      temperatureLow: 12,
      precipProbability: 0,
      uvIndex: 6,
      icon: 'clear-day',
      sunriseTime: 1779177600,
      sunsetTime: 1779220800,
    })),
  },
};

const metPayload = {
  properties: {
    timeseries: Array.from({ length: 48 }, (_, i) => ({
      time: new Date(Date.UTC(2026, 4, 18, 22 + i, 0, 0)).toISOString(),
      data: {
        instant: {
          details: {
            air_temperature: 18,
            wind_speed: 3,
            relative_humidity: 50,
            cloud_area_fraction: 10,
          },
        },
        next_1_hours: {
          summary: { symbol_code: 'clearsky_day' },
          details: { precipitation_amount: 0 },
        },
      },
    })),
  },
};

// Verified Tomorrow.io fixture (2026-05-19 ~08:05 SAST Strand snapshot from
// Phase 1 — captures the empirical case where intensity=2.25 mm/h but
// PW's 4-source consensus reported "Rain Unlikely". Extended to 48 intervals
// for the 48h window the live fetcher requests.
const tomorrowIoActiveRainPayload = {
  data: {
    timelines: [{
      timestep: '1h',
      startTime: '2026-05-19T08:00:00Z',
      endTime: '2026-05-21T08:00:00Z',
      intervals: [
        { startTime: '2026-05-19T08:00:00Z', values: { temperature: 20.18, precipitationIntensity: 2.25, precipitationProbability: 25, weatherCode: 4200, windSpeed: 5, humidity: 70, cloudCover: 80 } },
        { startTime: '2026-05-19T09:00:00Z', values: { temperature: 17.74, precipitationIntensity: 0.67, precipitationProbability: 5,  weatherCode: 4200, windSpeed: 5, humidity: 70, cloudCover: 80 } },
        ...Array.from({ length: 46 }, (_, i) => ({
          startTime: new Date(Date.UTC(2026, 4, 19, 10 + i, 0, 0)).toISOString(),
          values: { temperature: 19, precipitationIntensity: 0, precipitationProbability: 0, weatherCode: 1001, windSpeed: 4, humidity: 70, cloudCover: 80 },
        })),
      ],
    }],
  },
};

const tomorrowIoLightDrizzlePayload = {
  data: {
    timelines: [{
      intervals: [
        { startTime: '2026-05-19T08:00:00Z', values: { temperature: 20, precipitationIntensity: 0.4, precipitationProbability: 25, weatherCode: 4000, windSpeed: 4, humidity: 65, cloudCover: 70 } },
        ...Array.from({ length: 47 }, (_, i) => ({
          startTime: new Date(Date.UTC(2026, 4, 19, 9 + i, 0, 0)).toISOString(),
          values: { temperature: 20, precipitationIntensity: 0, precipitationProbability: 0, weatherCode: 1000, windSpeed: 4, humidity: 65, cloudCover: 10 },
        })),
      ],
    }],
  },
};

const tomorrowIoThunderPayload = {
  data: {
    timelines: [{
      intervals: [
        { startTime: '2026-05-19T08:00:00Z', values: { temperature: 22, precipitationIntensity: 0, precipitationProbability: 80, weatherCode: 8000, windSpeed: 12, humidity: 90, cloudCover: 100 } },
        ...Array.from({ length: 47 }, (_, i) => ({
          startTime: new Date(Date.UTC(2026, 4, 19, 9 + i, 0, 0)).toISOString(),
          values: { temperature: 22, precipitationIntensity: 0, precipitationProbability: 5, weatherCode: 1001, windSpeed: 6, humidity: 70, cloudCover: 80 },
        })),
      ],
    }],
  },
};

const tomorrowIoClearPayload = {
  data: {
    timelines: [{
      intervals: Array.from({ length: 48 }, (_, i) => ({
        startTime: new Date(Date.UTC(2026, 4, 19, 8 + i, 0, 0)).toISOString(),
        values: { temperature: 20, precipitationIntensity: 0, precipitationProbability: 0, weatherCode: 1000, windSpeed: 4, humidity: 50, cloudCover: 10 },
      })),
    }],
  },
};

const tomorrowIoCalendarBoundaryPayload = {
  data: {
    timelines: [{
      intervals: Array.from({ length: 48 }, (_, i) => ({
        startTime: new Date(Date.UTC(2026, 4, 19, 8 + i, 0, 0)).toISOString(),
        values: {
          temperature: i === 14 ? 50 : 20,
          precipitationIntensity: 0,
          precipitationProbability: i === 14 ? 100 : 10,
          weatherCode: 1000,
          windSpeed: 4,
          humidity: 50,
          cloudCover: 10,
        },
      })),
    }],
  },
};

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

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

const makeFetchStub = (tomorrowIoHandler) => vi.fn(async (url, _opts) => {
  const href = String(url);
  if (href.startsWith('https://api.open-meteo.com/'))   return makeResponse(openMeteoPayload);
  if (href.startsWith('https://api.weatherapi.com/'))   return makeResponse(weatherApiPayload);
  if (href.startsWith('https://api.pirateweather.net/')) return makeResponse(piratePayload);
  if (href.startsWith('https://api.met.no/'))           return makeResponse(metPayload);
  if (href.startsWith('https://api.tomorrow.io/'))      return tomorrowIoHandler(href);
  throw new Error(`Unexpected URL: ${href}`);
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-19T08:30:00Z'));
  process.env.WEATHERAPI_KEY = 'weather-key';
  process.env.PIRATE_WEATHER_KEY = 'pirate-key';
});

afterEach(() => {
  delete process.env.WEATHERAPI_KEY;
  delete process.env.PIRATE_WEATHER_KEY;
  delete process.env.TOMORROWIO_API_KEY;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests 1-5 — fetcher fails gracefully on missing key / 401 / 429 / timeout / 500
// ---------------------------------------------------------------------------

describe('Tomorrow.io fetcher — graceful fallback', () => {
  it('returns null when TOMORROWIO_API_KEY env var is missing', async () => {
    // No key set in this test
    vi.stubGlobal('fetch', makeFetchStub(() => {
      throw new Error('Tomorrow.io fetch should not be attempted without a key');
    }));
    const { statusCode, body } = await callHandler();
    expect(statusCode).toBe(200);
    expect(body.ok).toBe(true);
    const tiSource = body.meta.sources.find(s => s.name === 'Tomorrow.io');
    expect(tiSource).toBeDefined();
    expect(tiSource.ok).toBe(false);
  });

  it('returns null on 401 (bad key) without crashing the response', async () => {
    process.env.TOMORROWIO_API_KEY = 'bad-key';
    vi.stubGlobal('fetch', makeFetchStub(() => makeResponse({ error: 'invalid key' }, 401)));
    const { statusCode, body } = await callHandler();
    expect(statusCode).toBe(200);
    expect(body.ok).toBe(true);
    const tiSource = body.meta.sources.find(s => s.name === 'Tomorrow.io');
    expect(tiSource?.ok).toBe(false);
  });

  it('returns null on 429 (rate limit) without crashing the response', async () => {
    process.env.TOMORROWIO_API_KEY = 'real-key';
    vi.stubGlobal('fetch', makeFetchStub(() => makeResponse({ error: 'rate limited' }, 429)));
    const { statusCode, body } = await callHandler();
    expect(statusCode).toBe(200);
    expect(body.ok).toBe(true);
    const tiSource = body.meta.sources.find(s => s.name === 'Tomorrow.io');
    expect(tiSource?.ok).toBe(false);
  });

  it('returns null on timeout (AbortError) without crashing the response', async () => {
    process.env.TOMORROWIO_API_KEY = 'real-key';
    vi.stubGlobal('fetch', makeFetchStub(() => {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    }));
    const { statusCode, body } = await callHandler();
    expect(statusCode).toBe(200);
    expect(body.ok).toBe(true);
    const tiSource = body.meta.sources.find(s => s.name === 'Tomorrow.io');
    expect(tiSource?.ok).toBe(false);
  });

  it('returns null on 500 (server error) without crashing the response', async () => {
    process.env.TOMORROWIO_API_KEY = 'real-key';
    vi.stubGlobal('fetch', makeFetchStub(() => makeResponse({ error: 'server' }, 500)));
    const { statusCode, body } = await callHandler();
    expect(statusCode).toBe(200);
    expect(body.ok).toBe(true);
    const tiSource = body.meta.sources.find(s => s.name === 'Tomorrow.io');
    expect(tiSource?.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests 6-8 — overrides
// ---------------------------------------------------------------------------

describe('Tomorrow.io precipitation + thunder overrides', () => {
  it('precipitation override fires when intensity > 0.5 mm/h (uses Phase-1 fixture)', async () => {
    process.env.TOMORROWIO_API_KEY = 'real-key';
    vi.stubGlobal('fetch', makeFetchStub(() => makeResponse(tomorrowIoActiveRainPayload)));
    const { statusCode, body } = await callHandler();
    expect(statusCode).toBe(200);
    expect(body.now.conditionKey).toBe('rain');
    expect(body.now.conditionReason).toBe('tomorrow-io-radar-override');
    expect(body.now.rainChance).toBeGreaterThanOrEqual(70);
    // The audit trail records the override
    const overrideEntry = body.now.conditionSignals.overrides.find(o => o.rule === 'tomorrow-io-radar-override');
    expect(overrideEntry).toBeDefined();
    expect(overrideEntry.to).toBe('rain');
  });

  it('precipitation override does NOT fire when intensity is below 0.5 mm/h', async () => {
    process.env.TOMORROWIO_API_KEY = 'real-key';
    vi.stubGlobal('fetch', makeFetchStub(() => makeResponse(tomorrowIoLightDrizzlePayload)));
    const { statusCode, body } = await callHandler();
    expect(statusCode).toBe(200);
    // With 0.4 mm/h intensity, the override must NOT fire
    expect(body.now.conditionReason).not.toBe('tomorrow-io-radar-override');
    // And no override audit entry from Tomorrow.io
    const overrideEntries = body.now.conditionSignals.overrides.filter(o => o.rule === 'tomorrow-io-radar-override');
    expect(overrideEntries.length).toBe(0);
  });

  it('thunder override fires on weatherCode 8000', async () => {
    process.env.TOMORROWIO_API_KEY = 'real-key';
    vi.stubGlobal('fetch', makeFetchStub(() => makeResponse(tomorrowIoThunderPayload)));
    const { statusCode, body } = await callHandler();
    expect(statusCode).toBe(200);
    expect(body.now.conditionKey).toBe('storm');
    expect(body.now.conditionReason).toBe('tomorrow-io-thunder');
    const overrideEntry = body.now.conditionSignals.overrides.find(o => o.rule === 'tomorrow-io-thunder');
    expect(overrideEntry).toBeDefined();
    expect(overrideEntry.to).toBe('storm');
  });
});

// ---------------------------------------------------------------------------
// Test 9 — existing 4-source consensus unchanged when Tomorrow.io is null
// ---------------------------------------------------------------------------

describe('4-source consensus regression check', () => {
  it('produces clear consensus when Tomorrow.io is unavailable (no override possible)', async () => {
    // No TOMORROWIO_API_KEY — Tomorrow.io fetcher skipped entirely
    vi.stubGlobal('fetch', makeFetchStub(() => {
      throw new Error('Tomorrow.io fetch should not be attempted without a key');
    }));
    const { statusCode, body } = await callHandler();
    expect(statusCode).toBe(200);
    expect(body.ok).toBe(true);
    // All other 4 sources should have succeeded with the all-clear fixtures
    expect(body.meta.sources.filter(s => s.ok).map(s => s.name).sort()).toEqual([
      'MET Norway', 'Open-Meteo', 'Pirate Weather', 'WeatherAPI',
    ]);
    // No tomorrow-io override entries in the audit trail — the proof that
    // 4-source consensus is what produced the conditionKey, not the radar override.
    const tiOverrides = body.now.conditionSignals.overrides.filter(o => o.rule?.startsWith('tomorrow-io'));
    expect(tiOverrides.length).toBe(0);
    // 4-source consensus from these fixtures (OM/WA/PW all sunny + uvIndex=6,
    // local hour 10:30 SAST → moderate UV rung fires in deriveCondition).
    // The point: this output is identical to pre-Tomorrow.io behaviour because
    // Tomorrow.io contributed nothing to the consensus on this path.
    expect(body.now.conditionKey).toBe('uv');
  });
});

// ---------------------------------------------------------------------------
// Tests 10-12 — weights + meta surfacing
// ---------------------------------------------------------------------------

describe('Source weights and meta surfacing', () => {
  it('source weights sum to 100 when all 5 sources are active', async () => {
    process.env.TOMORROWIO_API_KEY = 'real-key';
    vi.stubGlobal('fetch', makeFetchStub(() => makeResponse(tomorrowIoClearPayload)));
    const { body } = await callHandler();
    const w = body.meta.sourceWeights;
    const sum = (w['Open-Meteo'] ?? 0) + (w['WeatherAPI'] ?? 0) + (w['Pirate Weather'] ?? 0)
      + (w['MET Norway'] ?? 0) + (w['Tomorrow.io'] ?? 0);
    expect(sum).toBe(100);
  });

  it('meta.sources, meta.sourceWeights, meta.sourceConditions include Tomorrow.io when fetch succeeds', async () => {
    process.env.TOMORROWIO_API_KEY = 'real-key';
    vi.stubGlobal('fetch', makeFetchStub(() => makeResponse(tomorrowIoClearPayload)));
    const { body } = await callHandler();
    // meta.sources
    const tiSource = body.meta.sources.find(s => s.name === 'Tomorrow.io');
    expect(tiSource).toBeDefined();
    expect(tiSource.ok).toBe(true);
    // meta.sourceWeights
    expect(body.meta.sourceWeights['Tomorrow.io']).toBeGreaterThan(0);
    // meta.sourceConditions
    const tiVote = body.meta.sourceConditions.find(v => v.source === 'Tomorrow.io');
    expect(tiVote).toBeDefined();
    expect(typeof tiVote.vote).toBe('string');
  });

  it('marks Tomorrow.io ok:false on fetch failure without crashing the response', async () => {
    process.env.TOMORROWIO_API_KEY = 'real-key';
    vi.stubGlobal('fetch', makeFetchStub(() => makeResponse({ error: 'rate-limited' }, 429)));
    const { statusCode, body } = await callHandler();
    expect(statusCode).toBe(200);
    expect(body.ok).toBe(true);
    const tiSource = body.meta.sources.find(s => s.name === 'Tomorrow.io');
    expect(tiSource?.ok).toBe(false);
    // sourceWeights entry for Tomorrow.io should be null when the source is unavailable
    expect(body.meta.sourceWeights['Tomorrow.io']).toBeNull();
  });
});

describe('Tomorrow.io local-calendar daily aggregation', () => {
  it("B3 excludes tomorrow's midnight spike from day zero without changing day one", async () => {
    process.env.TOMORROWIO_API_KEY = 'real-key';
    vi.stubGlobal('fetch', makeFetchStub(() => makeResponse(tomorrowIoCalendarBoundaryPayload)));

    const { body } = await callHandler();
    const tomorrowRange = body.meta.sourceRanges.find((source) => source.name === 'Tomorrow.io');

    expect(tomorrowRange).toEqual({ name: 'Tomorrow.io', minTemp: 20, maxTemp: 20 });
    expect(body.daily[1].highC).toBe(24);
  });
});
