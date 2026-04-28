import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import handler from '../api/weather.js';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const makeResponse = (payload) => ({
  ok: true,
  status: 200,
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
    wind_speed_10m: Array(48).fill(10),
    wind_gusts_10m: Array(48).fill(12),
    cloud_cover: Array(48).fill(10),
    relative_humidity_2m: Array(48).fill(50),
    uv_index: Array(48).fill(4),
  },
  daily: {
    temperature_2m_max: Array(7).fill(24),
    temperature_2m_min: Array(7).fill(12),
    precipitation_probability_max: Array(7).fill(0),
    uv_index_max: Array(7).fill(6),
    weather_code: Array(7).fill(0),
    sunrise: Array(7).fill('2026-04-27T06:00'),
    sunset: Array(7).fill('2026-04-27T18:00'),
  },
};

const weatherApiPayload = {
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
      sunriseTime: 1777272000,
      sunsetTime: 1777315200,
    })),
  },
};

const metPayload = {
  properties: {
    timeseries: Array.from({ length: 48 }, (_, i) => ({
      time: new Date(Date.UTC(2026, 3, 26, 22 + i, 0, 0)).toISOString(),
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

const callWeather = async () => {
  let statusCode = 200;
  let body;
  const req = { query: { lat: '-33.92', lon: '18.42', name: 'Cape Town' } };
  const res = {
    setHeader: vi.fn(),
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      body = payload;
      return this;
    },
  };

  await handler(req, res);
  return { statusCode, body };
};

describe('weather provider fetching', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-04-27T08:00:00Z'));
    process.env.WEATHERAPI_KEY = 'weather-key';
    process.env.PIRATE_WEATHER_KEY = 'pirate-key';
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      await delay(1000);
      const href = String(url);
      if (href.startsWith('https://api.open-meteo.com/')) return makeResponse(openMeteoPayload);
      if (href.startsWith('https://api.weatherapi.com/')) return makeResponse(weatherApiPayload);
      if (href.startsWith('https://api.pirateweather.net/')) return makeResponse(piratePayload);
      if (href.startsWith('https://api.met.no/')) return makeResponse(metPayload);
      throw new Error(`Unexpected URL: ${href}`);
    }));
  });

  afterEach(() => {
    delete process.env.WEATHERAPI_KEY;
    delete process.env.PIRATE_WEATHER_KEY;
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('fetches independent providers in parallel', async () => {
    const start = performance.now();
    const { statusCode, body } = await callWeather();
    const elapsed = performance.now() - start;

    expect(statusCode).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.meta.sources.filter(source => source.ok)).toHaveLength(4);
    expect(elapsed).toBeLessThan(2200);
  }, 7000);
});
