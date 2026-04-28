import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import handler from '../api/weather.js';

const makeResponse = (payload, ok = true, status = 200) => ({
  ok,
  status,
  json: vi.fn(async () => payload),
});

const makeOpenMeteoPayload = () => ({
  utc_offset_seconds: 7200,
  current: {
    temperature_2m: 10,
    apparent_temperature: 10,
    weather_code: 0,
    wind_speed_10m: 10,
    wind_gusts_10m: 10,
    relative_humidity_2m: 50,
    cloud_cover: 0,
  },
  hourly: {
    temperature_2m: Array(48).fill(10),
    apparent_temperature: Array(48).fill(10),
    precipitation_probability: Array(48).fill(0),
    wind_speed_10m: Array(48).fill(10),
    wind_gusts_10m: Array(48).fill(10),
    cloud_cover: Array(48).fill(0),
    relative_humidity_2m: Array(48).fill(50),
    uv_index: Array(48).fill(0),
  },
  daily: {
    temperature_2m_max: Array(7).fill(20),
    temperature_2m_min: Array(7).fill(8),
    precipitation_probability_max: Array(7).fill(0),
    uv_index_max: Array(7).fill(5),
    weather_code: Array(7).fill(0),
    sunrise: Array(7).fill('2026-04-27T06:00'),
    sunset: Array(7).fill('2026-04-27T18:00'),
  },
});

const makeMetPayload = () => {
  const startUtc = Date.UTC(2026, 3, 27, 12, 0, 0); // 14:00 local with +02:00 offset
  return {
    properties: {
      timeseries: Array.from({ length: 48 }, (_, i) => ({
        time: new Date(startUtc + i * 60 * 60 * 1000).toISOString(),
        data: {
          instant: {
            details: {
              air_temperature: i === 0 ? 99 : 20,
              wind_speed: 1,
              relative_humidity: 50,
              cloud_area_fraction: 0,
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

describe('MET Norway hourly alignment', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-27T12:15:00Z'));
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const href = String(url);
      if (href.startsWith('https://api.open-meteo.com/')) {
        return makeResponse(makeOpenMeteoPayload());
      }
      if (href.startsWith('https://api.met.no/')) {
        return makeResponse(makeMetPayload());
      }
      throw new Error(`Unexpected URL: ${href}`);
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('pads MET Norway data so index 0 remains local midnight', async () => {
    const { statusCode, body } = await callWeather();

    expect(statusCode).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.meta.localHour).toBe(14);
    expect(body.hourly[0].tempC).toBe(10);
    expect(body.hourly[13].tempC).toBe(10);
    expect(body.hourly[14].tempC).toBeGreaterThan(40);
  });

  it('skips MET Norway daily high and low when too few today hours are available', async () => {
    const { statusCode, body } = await callWeather();

    expect(statusCode).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.daily[0].highC).toBe(20);
    expect(body.daily[0].lowC).toBe(8);
    expect(body.meta.sourceRanges).toContainEqual({
      name: 'MET Norway',
      minTemp: null,
      maxTemp: null,
    });
  });
});
