import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import handler from '../api/weather.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const response = (payload) => ({ ok: true, status: 200, json: async () => payload });

const openMeteoPayload = {
  utc_offset_seconds: 7200,
  current: {
    temperature_2m: 20, apparent_temperature: 20, weather_code: 0,
    wind_speed_10m: 10, wind_gusts_10m: 14, relative_humidity_2m: 55, cloud_cover: 10,
  },
  hourly: {
    temperature_2m: Array(48).fill(20), apparent_temperature: Array(48).fill(20),
    precipitation_probability: Array(48).fill(0), precipitation: Array(48).fill(0),
    wind_speed_10m: Array(48).fill(10), wind_gusts_10m: Array(48).fill(14),
    cloud_cover: Array(48).fill(10), relative_humidity_2m: Array(48).fill(55),
    uv_index: Array(48).fill(4), weather_code: Array(48).fill(0),
    visibility: Array(48).fill(20000), dew_point_2m: Array(48).fill(10),
  },
  daily: {
    temperature_2m_max: Array(7).fill(24), temperature_2m_min: Array(7).fill(14),
    precipitation_probability_max: Array(7).fill(0), uv_index_max: Array(7).fill(6),
    weather_code: Array(7).fill(0), wind_speed_10m_max: Array(7).fill(12),
    sunrise: Array(7).fill('2026-07-10T07:00'), sunset: Array(7).fill('2026-07-10T18:00'),
  },
};

const weatherApiPayload = {
  location: { tz_id: 'Africa/Johannesburg' },
  current: { temp_c: 20, feelslike_c: 20, condition: { code: 1000, text: 'Sunny' }, wind_kph: 10, humidity: 55 },
  forecast: { forecastday: Array.from({ length: 7 }, () => ({
    day: { maxtemp_c: 24, mintemp_c: 14, totalprecip_mm: 0, daily_chance_of_rain: 0, uv: 6, maxwind_kph: 12, condition: { code: 1000, text: 'Sunny' } },
    astro: { sunrise: '07:00 AM', sunset: '06:00 PM' },
    hour: Array.from({ length: 24 }, () => ({ temp_c: 20, feelslike_c: 20, chance_of_rain: 0, precip_mm: 0, wind_kph: 10, cloud: 10, humidity: 55, condition: { code: 1000, text: 'Sunny' } })),
  })) },
};

const piratePayload = {
  offset: 2,
  currently: { temperature: 20, windSpeed: 3, windGust: 4, humidity: 0.55, icon: 'clear-day' },
  daily: { data: Array.from({ length: 7 }, () => ({ temperatureHigh: 24, temperatureLow: 14, precipProbability: 0, uvIndex: 6, windSpeed: 3, cloudCover: 0.1, icon: 'clear-day', sunriseTime: 1783659600, sunsetTime: 1783699200 })) },
};

const metPayload = {
  properties: { timeseries: Array.from({ length: 48 }, (_, i) => ({
    time: new Date(Date.now() + i * 3600000).toISOString(),
    data: {
      instant: { details: { air_temperature: 20, wind_speed: 3, relative_humidity: 55, cloud_area_fraction: 10 } },
      next_1_hours: { summary: { symbol_code: 'clearsky_day' }, details: { precipitation_amount: 0 } },
    },
  })) },
};

const tomorrowPayload = {
  data: { timelines: [{ intervals: Array.from({ length: 48 }, (_, i) => ({
    startTime: new Date(Date.now() + i * 3600000).toISOString(),
    values: { temperature: 20, precipitationIntensity: 0, precipitationProbability: 0, weatherCode: 1000, windSpeed: 3, humidity: 55, cloudCover: 10 },
  })) }] },
};

function callWeather(index) {
  let statusCode = 200;
  let body;
  const req = { query: { lat: '-34.1163', lon: '18.8362', name: `Strand ${index}` }, headers: { 'x-real-ip': `196.1.1.${index}` } };
  const res = {
    setHeader() { return this; },
    status(code) { statusCode = code; return this; },
    json(payload) { body = payload; return this; },
  };
  return handler(req, res).then(() => ({ statusCode, body }));
}

describe('P3 same-cell miss coalescing', () => {
  beforeEach(() => {
    process.env.WEATHERAPI_KEY = 'weather-key';
    process.env.PIRATE_WEATHER_KEY = 'pirate-key';
    process.env.TOMORROWIO_API_KEY = 'tomorrow-key';
  });

  afterEach(() => {
    delete process.env.WEATHERAPI_KEY;
    delete process.env.PIRATE_WEATHER_KEY;
    delete process.env.TOMORROWIO_API_KEY;
    vi.unstubAllGlobals();
  });

  it('P3 runs exactly one five-provider fan-out for eight concurrent same-cell misses', async () => {
    const callsByProvider = new Map();
    const fetchStub = vi.fn(async (url) => {
      await delay(40);
      const href = String(url);
      const [provider, payload] = href.startsWith('https://api.open-meteo.com/') ? ['open-meteo', openMeteoPayload]
        : href.startsWith('https://api.weatherapi.com/') ? ['weatherapi', weatherApiPayload]
        : href.startsWith('https://api.pirateweather.net/') ? ['pirate', piratePayload]
        : href.startsWith('https://api.met.no/') ? ['met', metPayload]
        : href.startsWith('https://api.tomorrow.io/') ? ['tomorrow', tomorrowPayload]
        : [null, null];
      if (!provider) throw new Error(`Unexpected URL: ${href}`);
      callsByProvider.set(provider, (callsByProvider.get(provider) || 0) + 1);
      return response(payload);
    });
    vi.stubGlobal('fetch', fetchStub);

    const start = performance.now();
    const results = await Promise.all(Array.from({ length: 8 }, (_, i) => callWeather(i)));
    const elapsedMs = performance.now() - start;
    console.log(`[P3 burst] N=8 upstream=${fetchStub.mock.calls.length} elapsedMs=${elapsedMs.toFixed(1)}`);

    expect(results.every((result) => result.statusCode === 200 && result.body?.ok === true)).toBe(true);
    expect(fetchStub).toHaveBeenCalledTimes(5);
    expect(Object.fromEntries(callsByProvider)).toEqual({
      'open-meteo': 1, weatherapi: 1, pirate: 1, met: 1, tomorrow: 1,
    });
  }, 15000);
});
