// Day 0's low blends the sources that can see the day's minimum (2026-09-15).
//
// A same-time comparison with SAWS at 13:25 SAST found two window mismatches in
// the blended "today low":
//   - MET Norway and Tomorrow.io only carry hours from NOW to midnight, so their
//     day-0 low is the rest of today's low. Polokwane: both 18.9°C against
//     Open-Meteo 13.6, WeatherAPI 13.8 and SAWS 13 — blended 15.5.
//   - Pirate Weather's temperatureLow is the NEXT morning's low
//     (temperatureLowTime 05:00 on 16 Sept in all five cities); its calendar-day
//     minimum is temperatureMin.
// The fixture below is built so each defect moves the answer somewhere else:
// old code 12.3, MET-only fix 9.7, Pirate-only fix 13.3, both fixed 10.9.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/_lib/weather-cache.js', async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    weatherCacheSetDeferred: vi.fn(),
    weatherCacheGet: vi.fn(async () => null),
    weatherCacheGetStale: vi.fn(async () => null),
    weatherCacheAcquireLock: vi.fn(async () => ({ acquired: true, release: async () => {} })),
    waitForWeatherCache: vi.fn(async () => null),
  };
});

import handler from '../api/weather.js';

const makeResponse = (payload, status = 200) => ({ ok: status >= 200 && status < 300, status, json: vi.fn(async () => payload) });
const down = () => makeResponse({ error: 'down' }, 503);
const fill = (n, v) => Array(n).fill(v);

// Calendar-day minimum 10°C; high 24.
const openMeteo = {
  utc_offset_seconds: 7200,
  current: { temperature_2m: 18, apparent_temperature: 18, weather_code: 0, wind_speed_10m: 10, wind_gusts_10m: 12, relative_humidity_2m: 50, cloud_cover: 10 },
  hourly: {
    temperature_2m: fill(48, 18), apparent_temperature: fill(48, 18), precipitation_probability: fill(48, 0),
    precipitation: fill(48, 0), wind_speed_10m: fill(48, 10), wind_gusts_10m: fill(48, 12), cloud_cover: fill(48, 10),
    relative_humidity_2m: fill(48, 50), uv_index: fill(48, 4), weather_code: fill(48, 0),
    visibility: fill(48, 20000), dew_point_2m: fill(48, 8),
  },
  daily: {
    temperature_2m_max: fill(7, 24), temperature_2m_min: fill(7, 10), precipitation_probability_max: fill(7, 0),
    uv_index_max: fill(7, 6), weather_code: fill(7, 0), sunrise: fill(7, '2026-05-19T06:00'), sunset: fill(7, '2026-05-19T18:00'),
  },
};

// Calendar-day minimum 12°C; high 26 (more than 0.5° from Open-Meteo, so no ECMWF de-duplication).
const waHour = { temp_c: 18, feelslike_c: 18, condition: { code: 1000, text: 'Sunny' }, chance_of_rain: 0, precip_mm: 0, wind_kph: 10, cloud: 10, humidity: 50, uv: 4 };
const weatherApi = {
  location: { tz_id: 'Africa/Johannesburg' },
  current: { temp_c: 18, feelslike_c: 18, condition: { code: 1000, text: 'Sunny' }, wind_kph: 10, humidity: 50, cloud: 10, uv: 4, precip_mm: 0 },
  forecast: {
    forecastday: [0, 1].map(() => ({
      day: { maxtemp_c: 26, mintemp_c: 12, daily_chance_of_rain: 0, totalprecip_mm: 0, uv: 6, maxwind_kph: 20, condition: { code: 1000, text: 'Sunny' } },
      astro: { sunrise: '06:00 AM', sunset: '06:00 PM' },
      hour: Array.from({ length: 24 }, () => ({ ...waHour })),
    })),
  },
};

// Calendar-day minimum 11°C; the following night's low 5°C.
const pirate = {
  offset: 2,
  currently: { temperature: 18, windSpeed: 3, windGust: 4, humidity: 0.5, icon: 'clear-day' },
  daily: {
    data: Array.from({ length: 7 }, () => ({
      temperatureHigh: 25, temperatureMin: 11, temperatureLow: 5, precipProbability: 0, uvIndex: 6, icon: 'clear-day', windSpeed: 3, cloudCover: 0.1,
      sunriseTime: Date.UTC(2026, 4, 19, 4, 0, 0) / 1000, sunsetTime: Date.UTC(2026, 4, 19, 16, 0, 0) / 1000,
    })),
  },
};

// Every hour of MET's day at 29°C: a partial-window low that is far too warm.
// (29 is less than 5° above the ECMWF-family high, so MET's high boost stays off.)
const met = {
  properties: {
    timeseries: Array.from({ length: 48 }, (_, i) => ({
      time: new Date(Date.UTC(2026, 4, 18, 22 + i, 0, 0)).toISOString(),
      data: {
        instant: { details: { air_temperature: 29, wind_speed: 3, relative_humidity: 50, cloud_area_fraction: 10 } },
        next_1_hours: { summary: { symbol_code: 'clearsky_day' }, details: { precipitation_amount: 0 } },
      },
    })),
  },
};

const stub = ({ om = () => makeResponse(openMeteo), wa = () => makeResponse(weatherApi), pw = () => makeResponse(pirate), mn = () => makeResponse(met) } = {}) => {
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    const href = String(url);
    if (href.includes('open-meteo.com/')) return om();
    if (href.includes('api.weatherapi.com/')) return wa();
    if (href.includes('api.pirateweather.net/')) return pw();
    if (href.startsWith('https://api.met.no/')) return mn();
    throw new Error(`Unexpected URL: ${href}`);
  }));
};

const callHandler = async () => {
  let body;
  const res = { setHeader: vi.fn(), status() { return this; }, json(p) { body = p; return this; } };
  await handler({ query: { lat: '-23.9045', lon: '29.4689' } }, res);
  return body;
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-19T08:30:00Z')); // 10:30 SAST
  process.env.WEATHERAPI_KEY = 'wa-key';
  process.env.PIRATE_WEATHER_KEY = 'pw-key';
  delete process.env.TOMORROWIO_API_KEY;
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  delete process.env.WEATHERAPI_KEY;
  delete process.env.PIRATE_WEATHER_KEY;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the blended low uses calendar-day minimums', () => {
  it("today's low ignores MET's rest-of-day low and takes Pirate's temperatureMin, not the next night's low", async () => {
    stub();
    const body = await callHandler();
    for (const name of ['Open-Meteo', 'WeatherAPI', 'Pirate Weather', 'MET Norway']) {
      expect(body.meta.sources.find((s) => s.name === name)).toEqual({ name, ok: true });
    }
    // (10 x 0.30 + 12 x 0.22 + 11 x 0.13) / 0.65 = 10.88
    expect(body.daily[0].lowC).toBe(10.9);
  });

  it("later days' lows take Pirate's calendar-day minimum too", async () => {
    stub();
    const body = await callHandler();
    // Day 3: Open-Meteo 10, Pirate min 11, WeatherAPI has no day 3 → (3 + 1.43) / 0.43 = 10.3
    expect(body.daily[3].lowC).toBe(10.3);
  });

  it('falls back to the partial-window source when it is the only one that answered', async () => {
    stub({ om: down, wa: down, pw: down });
    const body = await callHandler();
    expect(body.meta.sources.find((s) => s.name === 'MET Norway')).toEqual({ name: 'MET Norway', ok: true });
    expect(body.daily[0].lowC).toBe(29);
  });
});
