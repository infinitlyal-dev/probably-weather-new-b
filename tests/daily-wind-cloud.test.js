// H-2: daily wind/cloud for forecast days 2–6 (2026-07-02).
//
// noonIdx = i*24+12 indexes past the 48-slot hourly array for days 2–6, so
// windKph/cloudPct were always null there — a windy day-3 could never derive
// 'wind', and null cloud left far days leaning on weak desc votes (the Weekly-
// tab fog symptom). Fix sources days 2–6 from the providers' own daily
// aggregates (OM/WA/Pirate max wind, Pirate cloud), blended per the daily
// weights, NO index clamp. This fixture proves days 2–6 now carry real wind/
// cloud and that a windy far day resolves to 'wind', not fog.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../api/weather.js';

const makeResponse = (payload, status = 200) => ({ ok: status >= 200 && status < 300, status, json: vi.fn(async () => payload) });

// Day 2 is windy (≈45 km/h) with clear sky; day 3 is calm but 70% cloud. All
// other fields are mild/clear so the wind and cloud rungs are what decide.
const WIND_KMH = [10, 10, 45, 10, 10, 10, 10];
const WIND_MS = WIND_KMH.map((k) => k / 3.6);      // Pirate units=si (m/s)
const CLOUD_FRAC = [0.1, 0.1, 0.1, 0.7, 0.1, 0.1, 0.1]; // Pirate cloudCover 0-1

const openMeteoPayload = {
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
  daily: {
    temperature_2m_max: Array(7).fill(20), temperature_2m_min: Array(7).fill(12),
    precipitation_probability_max: Array(7).fill(0), uv_index_max: Array(7).fill(4),
    weather_code: [0, 0, 0, 3, 0, 0, 0], wind_speed_10m_max: WIND_KMH,
    sunrise: Array(7).fill('2026-05-19T06:00'), sunset: Array(7).fill('2026-05-19T18:00'),
  },
};
const weatherApiPayload = {
  location: { tz_id: 'Africa/Johannesburg' },
  current: { temp_c: 18, feelslike_c: 18, condition: { code: 1000, text: 'Sunny' }, wind_kph: 10, humidity: 50 },
  forecast: {
    forecastday: Array.from({ length: 7 }, (_, i) => ({
      day: { maxtemp_c: 20, mintemp_c: 12, totalprecip_mm: 0, daily_chance_of_rain: 0, uv: 4, maxwind_kph: WIND_KMH[i], condition: i === 3 ? { code: 1009, text: 'Overcast' } : { code: 1000, text: 'Sunny' } },
      astro: { sunrise: '06:00 AM', sunset: '06:00 PM' },
      hour: Array.from({ length: 24 }, () => ({ temp_c: 18, feelslike_c: 18, chance_of_rain: 0, precip_mm: 0, wind_kph: 10, cloud: 10, humidity: 50, condition: { code: 1000, text: 'Sunny' } })),
    })),
  },
};
const piratePayload = {
  offset: 2,
  currently: { temperature: 18, windSpeed: 3, windGust: 4, humidity: 0.5, cloudCover: 0.1, icon: 'clear-day' },
  daily: { data: Array.from({ length: 7 }, (_, i) => ({ temperatureHigh: 20, temperatureLow: 12, precipProbability: 0, uvIndex: 4, windSpeed: WIND_MS[i], cloudCover: CLOUD_FRAC[i], icon: i === 3 ? 'cloudy' : 'clear-day', sunriseTime: 1779177600, sunsetTime: 1779220800 })) },
};
const metPayload = {
  properties: { timeseries: Array.from({ length: 48 }, (_, i) => ({
    time: new Date(Date.UTC(2026, 4, 18, 22 + i, 0, 0)).toISOString(),
    data: { instant: { details: { air_temperature: 18, wind_speed: 3, relative_humidity: 50, cloud_area_fraction: 10 } }, next_1_hours: { summary: { symbol_code: 'clearsky_day' }, details: { precipitation_amount: 0 } } },
  })) },
};

const callHandler = async () => {
  let statusCode = 200, body;
  const req = { query: { lat: '-34.1163', lon: '18.8362', name: 'Strand' } };
  const res = { setHeader: vi.fn(), status(c) { statusCode = c; return this; }, json(p) { body = p; return this; } };
  await handler(req, res);
  return { statusCode, body };
};
const fetchStub = vi.fn(async (url) => {
  const href = String(url);
  if (href.startsWith('https://api.open-meteo.com/')) return makeResponse(openMeteoPayload);
  if (href.startsWith('https://api.weatherapi.com/')) return makeResponse(weatherApiPayload);
  if (href.startsWith('https://api.pirateweather.net/')) return makeResponse(piratePayload);
  if (href.startsWith('https://api.met.no/')) return makeResponse(metPayload);
  throw new Error(`Unexpected URL: ${href}`);
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-19T08:30:00Z'));
  process.env.WEATHERAPI_KEY = 'weather-key';
  process.env.PIRATE_WEATHER_KEY = 'pirate-key';
  vi.stubGlobal('fetch', fetchStub);
});
afterEach(() => {
  delete process.env.WEATHERAPI_KEY; delete process.env.PIRATE_WEATHER_KEY;
  vi.unstubAllGlobals(); vi.useRealTimers();
});

describe('daily wind/cloud — days 2–6 sourced from provider daily aggregates', () => {
  it('every forecast day 2–6 has a real (non-null) windKph and cloudPct', async () => {
    const { body } = await callHandler();
    expect(body.ok).toBe(true);
    for (let i = 2; i <= 6; i++) {
      const num = body.daily[i].conditionSignals.numeric;
      expect(Number.isFinite(num.windKph), `day ${i} windKph null`).toBe(true);
      expect(Number.isFinite(num.cloudPct), `day ${i} cloudPct null`).toBe(true);
    }
  });

  it('a windy far day (day 2, ~45 km/h) resolves to wind — not reachable before the fix', async () => {
    const { body } = await callHandler();
    expect(body.daily[2].conditionSignals.numeric.windKph).toBeGreaterThanOrEqual(30);
    expect(body.daily[2].conditionKey).toBe('wind');
  });

  it('a cloudy far day (day 3, overcast descs + 70% cloud) resolves to cloudy via the daily cloud aggregate', async () => {
    const { body } = await callHandler();
    expect(body.daily[3].conditionSignals.numeric.cloudPct).toBeGreaterThanOrEqual(55);
    expect(body.daily[3].conditionKey).not.toBe('fog');
    expect(['cloudy', 'partly-cloudy']).toContain(body.daily[3].conditionKey);
  });
});

describe('daily fog — under-corroborated fog on far days is demoted (>=2-source rule)', () => {
  // Reproduces the live Weekly-tab symptom: WeatherAPI free tier stops at day 2,
  // so far days have only OM + Pirate descs. Here OM says Overcast and Pirate says
  // Fog on day 4 — a single fog vote of two. The daily fog guard must demote it.
  const om = JSON.parse(JSON.stringify(openMeteoPayload));
  om.daily.weather_code = [0, 0, 0, 0, 3, 0, 0];      // day 4 overcast (not fog)
  const wa3 = JSON.parse(JSON.stringify(weatherApiPayload));
  wa3.forecast.forecastday = wa3.forecast.forecastday.slice(0, 3); // free-tier: 3 days
  const pir = JSON.parse(JSON.stringify(piratePayload));
  pir.daily.data = pir.daily.data.map((d, i) => i === 4 ? { ...d, icon: 'fog', cloudCover: 0.4 } : d);

  const stub = vi.fn(async (url) => {
    const href = String(url);
    if (href.startsWith('https://api.open-meteo.com/')) return makeResponse(om);
    if (href.startsWith('https://api.weatherapi.com/')) return makeResponse(wa3);
    if (href.startsWith('https://api.pirateweather.net/')) return makeResponse(pir);
    if (href.startsWith('https://api.met.no/')) return makeResponse(metPayload);
    throw new Error(`Unexpected URL: ${href}`);
  });

  it('day 4 (OM Overcast + Pirate Fog = 1/2 fog votes) does NOT render fog', async () => {
    vi.stubGlobal('fetch', stub);
    let body;
    const res = { setHeader: vi.fn(), status() { return this; }, json(p) { body = p; return this; } };
    await handler({ query: { lat: '-34.1163', lon: '18.8362', name: 'Strand' } }, res);
    expect(body.daily[4].conditionSignals.sourceDescs.length).toBe(2); // only OM + Pirate
    expect(body.daily[4].conditionKey).not.toBe('fog');
  });
});
