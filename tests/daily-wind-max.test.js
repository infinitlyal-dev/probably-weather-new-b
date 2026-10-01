// Wind on the Weekly day card (1 Oct 2026): Cape Town Saturday said "Gusty winds" with no number.
// Each daily object now carries windMaxKph (blend of the daily MAXIMUM mean wind from Open-Meteo
// wind_speed_10m_max and WeatherAPI maxwind_kph; Pirate's daily windSpeed is not documented as a
// maximum and is left out) and gustMaxKph (blend of Open-Meteo wind_gusts_10m_max and Pirate's daily
// windGust, the day's maximum gust). Display only: the condition's dailyWind/windKph must not move.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../api/weather.js';

const makeResponse = (payload) => ({ ok: true, status: 200, json: vi.fn(async () => structuredClone(payload)) });

const OM_MAX = [20, 22, 30, 18, 25, 15, 12];       // km/h, OM daily max mean wind
const WA_MAX = [20, 22, 30, 18, 25, 15, 12];       // km/h, WA maxwind_kph (equal to OM: any weights give the same blend)
const PIRATE_SPEED_KMH = 100;                      // Pirate daily windSpeed, far off on purpose: it must not reach windMaxKph
const OM_GUST = [40, 44, 60, 36, 50, 30, 24];      // km/h
const PIRATE_GUST_KMH = [40, 44, 60, 36, 50, 30, 24];

function payloads({ omGusts = OM_GUST, pirateGusts = PIRATE_GUST_KMH, omMax = OM_MAX, waMax = WA_MAX } = {}) {
  const daily = {
    temperature_2m_max: Array(7).fill(20), temperature_2m_min: Array(7).fill(12),
    precipitation_probability_max: Array(7).fill(0), uv_index_max: Array(7).fill(4),
    weather_code: Array(7).fill(0),
    sunrise: Array(7).fill('2026-05-19T06:00'), sunset: Array(7).fill('2026-05-19T18:00'),
  };
  if (omMax) daily.wind_speed_10m_max = omMax;
  if (omGusts) daily.wind_gusts_10m_max = omGusts;
  const openMeteo = {
    utc_offset_seconds: 7200,
    current: { temperature_2m: 18, apparent_temperature: 18, weather_code: 0, wind_speed_10m: 10, wind_gusts_10m: 12, relative_humidity_2m: 50, cloud_cover: 10 },
    hourly: {
      temperature_2m: Array(48).fill(18), apparent_temperature: Array(48).fill(18),
      precipitation_probability: Array(48).fill(0), precipitation: Array(48).fill(0),
      wind_speed_10m: Array(48).fill(10), wind_gusts_10m: Array(48).fill(12),
      cloud_cover: Array(48).fill(10), relative_humidity_2m: Array(48).fill(50),
      uv_index: Array(48).fill(4), weather_code: Array(48).fill(0),
      visibility: Array(48).fill(20000), dew_point_2m: Array(48).fill(8),
    },
    daily,
  };
  const weatherApi = {
    location: { tz_id: 'Africa/Johannesburg' },
    current: { temp_c: 18, feelslike_c: 18, condition: { code: 1000, text: 'Sunny' }, wind_kph: 10, humidity: 50 },
    forecast: {
      forecastday: Array.from({ length: 7 }, (_, i) => ({
        day: { maxtemp_c: 20, mintemp_c: 12, totalprecip_mm: 0, daily_chance_of_rain: 0, uv: 4, ...(waMax ? { maxwind_kph: waMax[i] } : {}), condition: { code: 1000, text: 'Sunny' } },
        astro: { sunrise: '06:00 AM', sunset: '06:00 PM' },
        hour: Array.from({ length: 24 }, () => ({ temp_c: 18, feelslike_c: 18, chance_of_rain: 0, precip_mm: 0, wind_kph: 10, cloud: 10, humidity: 50, condition: { code: 1000, text: 'Sunny' } })),
      })),
    },
  };
  const pirate = {
    offset: 2,
    currently: { temperature: 18, windSpeed: 3, windGust: 4, humidity: 0.5, cloudCover: 0.1, icon: 'clear-day' },
    daily: { data: Array.from({ length: 7 }, (_, i) => ({
      temperatureHigh: 20, temperatureLow: 12, precipProbability: 0, uvIndex: 4, windSpeed: PIRATE_SPEED_KMH / 3.6,
      ...(pirateGusts ? { windGust: pirateGusts[i] / 3.6 } : {}),
      cloudCover: 0.1, icon: 'clear-day', sunriseTime: 1779177600, sunsetTime: 1779220800,
    })) },
  };
  const met = {
    properties: { timeseries: Array.from({ length: 48 }, (_, i) => ({
      time: new Date(Date.UTC(2026, 4, 18, 22 + i, 0, 0)).toISOString(),
      data: { instant: { details: { air_temperature: 18, wind_speed: 3, relative_humidity: 50, cloud_area_fraction: 10 } }, next_1_hours: { summary: { symbol_code: 'clearsky_day' }, details: { precipitation_amount: 0 } } },
    })) },
  };
  return { openMeteo, weatherApi, pirate, met };
}

async function run(p) {
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    const href = String(url);
    if (href.startsWith('https://api.open-meteo.com/')) return makeResponse(p.openMeteo);
    if (href.startsWith('https://api.weatherapi.com/')) return makeResponse(p.weatherApi);
    if (href.startsWith('https://api.pirateweather.net/')) return makeResponse(p.pirate);
    if (href.startsWith('https://api.met.no/')) return makeResponse(p.met);
    throw new Error(`Unexpected URL: ${href}`);
  }));
  let body;
  const res = { setHeader: vi.fn(), status() { return this; }, json(b) { body = b; return this; } };
  await handler({ query: { lat: '-34.1163', lon: '18.8362', name: 'Strand' } }, res);
  return body;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-19T08:30:00Z'));
  process.env.WEATHERAPI_KEY = 'weather-key';
  process.env.PIRATE_WEATHER_KEY = 'pirate-key';
});
afterEach(() => {
  delete process.env.WEATHERAPI_KEY; delete process.env.PIRATE_WEATHER_KEY;
  vi.unstubAllGlobals(); vi.useRealTimers();
});

describe('daily windMaxKph / gustMaxKph', () => {
  it('the Open-Meteo request asks for the daily maximum gust', async () => {
    const p = payloads();
    let omUrl = '';
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const href = String(url);
      if (href.startsWith('https://api.open-meteo.com/')) { omUrl = href; return makeResponse(p.openMeteo); }
      if (href.startsWith('https://api.weatherapi.com/')) return makeResponse(p.weatherApi);
      if (href.startsWith('https://api.pirateweather.net/')) return makeResponse(p.pirate);
      return makeResponse(p.met);
    }));
    const res = { setHeader: vi.fn(), status() { return this; }, json() { return this; } };
    await handler({ query: { lat: '-34.1163', lon: '18.8362', name: 'Strand' } }, res);
    expect(new URL(omUrl).searchParams.get('daily').split(',')).toContain('wind_gusts_10m_max');
  });

  it('windMaxKph blends the Open-Meteo and WeatherAPI maxima only — Pirate daily windSpeed is excluded', async () => {
    const body = await run(payloads());
    expect(body.ok).toBe(true);
    for (let i = 0; i < 7; i++) expect(body.daily[i].windMaxKph, `day ${i}`).toBe(OM_MAX[i]);
  });

  it('windMaxKph is a weighted blend of the two maxima, rounded to whole km/h', async () => {
    const body = await run(payloads({ waMax: [40, 40, 40, 40, 40, 40, 40], omMax: [20, 20, 20, 20, 20, 20, 20] }));
    for (let i = 0; i < 7; i++) {
      const v = body.daily[i].windMaxKph;
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThan(20);
      expect(v).toBeLessThan(40);
    }
  });

  it('gustMaxKph blends Open-Meteo wind_gusts_10m_max and Pirate windGust', async () => {
    const same = await run(payloads());
    for (let i = 0; i < 7; i++) expect(same.daily[i].gustMaxKph, `day ${i}`).toBe(OM_GUST[i]);

    const split = await run(payloads({ omGusts: Array(7).fill(40), pirateGusts: Array(7).fill(80) }));
    for (let i = 0; i < 7; i++) {
      const v = split.daily[i].gustMaxKph;
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThan(40);
      expect(v).toBeLessThan(80);
    }

    const pirateOnly = await run(payloads({ omGusts: null }));
    expect(pirateOnly.daily[2].gustMaxKph).toBe(PIRATE_GUST_KMH[2]);
  });

  it('both are null when no source offers one', async () => {
    const body = await run(payloads({ omGusts: null, pirateGusts: null, omMax: null, waMax: null }));
    expect(body.ok).toBe(true);
    for (let i = 0; i < 7; i++) {
      expect(body.daily[i].windMaxKph, `day ${i}`).toBeNull();
      expect(body.daily[i].gustMaxKph, `day ${i}`).toBeNull();
    }
  });

  it('an out-of-range gust is dropped, not blended (DAILY_ARRAY_BOUNDS)', async () => {
    const body = await run(payloads({ omGusts: Array(7).fill(9999) }));
    expect(body.daily[3].gustMaxKph).toBe(PIRATE_GUST_KMH[3]);
  });

  it('the new fields move no condition, wind signal or temperature', async () => {
    const without = await run(payloads({ omGusts: null, pirateGusts: null }));
    const withGusts = await run(payloads());
    for (let i = 0; i < 7; i++) {
      const a = without.daily[i], b = withGusts.daily[i];
      expect(b.conditionKey).toBe(a.conditionKey);
      expect(b.conditionSignals.numeric).toEqual(a.conditionSignals.numeric);
      expect([b.highC, b.lowC]).toEqual([a.highC, a.lowC]);
    }
    expect(withGusts.now.conditionKey).toBe(without.now.conditionKey);
  });
});
