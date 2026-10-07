// Part B item 3 (Al, 7 Oct 2026): the Tomorrow.io radar makes "Rain's here." only when a source OTHER than
// Tomorrow.io also describes rain ("possible" not counting).
//
// Replay case — Johannesburg airport, 23 Sept 2026, 23:29 SAST (review/accuracy/results/live-sample-2026-09-23.md):
// Open-Meteo "Clear sky", WeatherAPI "Partly cloudy", Pirate "Partly cloudy", MET "Clear sky", Tomorrow.io
// "Light rain" with ~1 mm/h radar; cloud 5 %; the airport reported nothing falling. The hero said "Rain's here."
// Its five words and radar reading are replayed here on the cloud test's fixture hour.
// Scorecard: review/accuracy/results/radar-second-signal.md.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../api/weather.js';

const makeResponse = (payload, status = 200) => ({ ok: status >= 200 && status < 300, status, json: vi.fn(async () => payload) });
const DAY = '2026-10-07';
const NOW_UTC = Date.UTC(2026, 9, 7, 5, 0, 0); // 07:00 SAST

const openMeteo = ({ code, hourCode, total, low, mid }) => ({
  utc_offset_seconds: 7200,
  current: { temperature_2m: 11.2, apparent_temperature: 11.2, weather_code: code, wind_speed_10m: 10.2, wind_gusts_10m: 18, wind_direction_10m: 120, relative_humidity_2m: 72, cloud_cover: total },
  hourly: {
    temperature_2m: Array(48).fill(11.2), apparent_temperature: Array(48).fill(11.2),
    precipitation_probability: Array(48).fill(4), precipitation: Array(48).fill(0),
    wind_speed_10m: Array(48).fill(10.2), wind_gusts_10m: Array(48).fill(18), wind_direction_10m: Array(48).fill(120),
    cloud_cover: Array(48).fill(total), cloud_cover_low: Array(48).fill(low), cloud_cover_mid: Array(48).fill(mid),
    relative_humidity_2m: Array(48).fill(72), uv_index: Array(48).fill(0.4), weather_code: Array(48).fill(hourCode),
    visibility: Array(48).fill(34000), dew_point_2m: Array(48).fill(6),
  },
  daily: {
    temperature_2m_max: Array(7).fill(19), temperature_2m_min: Array(7).fill(9), precipitation_probability_max: Array(7).fill(5),
    uv_index_max: Array(7).fill(7), weather_code: Array(7).fill(2), wind_speed_10m_max: Array(7).fill(20), wind_gusts_10m_max: Array(7).fill(30),
    sunrise: Array(7).fill(`${DAY}T06:35`), sunset: Array(7).fill(`${DAY}T19:05`),
  },
});
const waHour = (code, cloud) => ({ temp_c: 11.2, feelslike_c: 11.2, condition: { code, text: 'x' }, chance_of_rain: 5, precip_mm: 0, wind_kph: 11, gust_kph: 20, cloud, humidity: 72, uv: 0.4 });
const weatherApi = (code, cloud) => ({
  location: { tz_id: 'Africa/Johannesburg' },
  current: { temp_c: 11.2, feelslike_c: 11.2, condition: { code, text: 'x' }, wind_kph: 11, gust_kph: 20, humidity: 72, cloud, uv: 0.4, precip_mm: 0 },
  forecast: {
    forecastday: [0, 1].map(() => ({
      day: { maxtemp_c: 19, mintemp_c: 9, daily_chance_of_rain: 5, totalprecip_mm: 0, uv: 6, maxwind_kph: 20, condition: { code, text: 'x' } },
      astro: { sunrise: '06:35 AM', sunset: '07:05 PM' },
      hour: Array.from({ length: 24 }, () => waHour(code, cloud)),
    })),
  },
});
const pirate = (icon) => ({
  offset: 2,
  currently: { temperature: 11.2, windSpeed: 2.8, windGust: 5, humidity: 0.72, icon },
  daily: { data: Array.from({ length: 7 }, () => ({ temperatureHigh: 19, temperatureLow: 9, precipProbability: 0.05, uvIndex: 6, icon, windSpeed: 3, cloudCover: 0.2,
    sunriseTime: Date.UTC(2026, 9, 7, 4, 35) / 1000, sunsetTime: Date.UTC(2026, 9, 7, 17, 5) / 1000 })) },
});
const met = (symbol, cloud) => ({
  properties: { timeseries: Array.from({ length: 48 }, (_, i) => ({
    time: new Date(Date.UTC(2026, 9, 6, 22 + i)).toISOString(),
    data: { instant: { details: { air_temperature: 11.2, wind_speed: 2.8, relative_humidity: 72, cloud_area_fraction: cloud } },
      next_1_hours: { summary: { symbol_code: symbol }, details: { precipitation_amount: 0 } } },
  })) },
});
const tomorrow = (weatherCode, cloudCover) => ({
  data: { timelines: [{ intervals: Array.from({ length: 48 }, (_, i) => ({
    startTime: new Date(NOW_UTC + i * 3600e3).toISOString(),
    values: { temperature: 11.2, precipitationIntensity: 0, precipitationProbability: 5, weatherCode, windSpeed: 3, humidity: 72, cloudCover, visibility: 30 },
  })) }] },
});

const stubFive = (p) => vi.stubGlobal('fetch', vi.fn(async (url) => {
  const href = String(url);
  if (href.includes('open-meteo.com/')) return makeResponse(p.openMeteo);
  if (href.startsWith('https://api.met.no/')) return makeResponse(p.met);
  if (href.includes('api.weatherapi.com/')) return makeResponse(p.weatherApi);
  if (href.includes('api.pirateweather.net/')) return makeResponse(p.pirate);
  if (href.startsWith('https://api.tomorrow.io/')) return makeResponse(p.tomorrow);
  throw new Error(`Unexpected URL: ${href}`);
}));

const callHandler = async () => {
  let body;
  await handler({ query: { lat: '-26.139', lon: '28.246', name: 'Johannesburg' } }, { setHeader: vi.fn(), status() { return this; }, json(p) { body = p; return this; } });
  return body;
};
const radarNow = (weatherCode, mmPerHour) => {
  const p = tomorrow(weatherCode, 10);
  p.data.timelines[0].intervals[0].values.precipitationIntensity = mmPerHour;
  return p;
};
const clearOm = () => openMeteo({ code: 0, hourCode: 0, total: 5, low: 0, mid: 0 });

describe('radar needs a second source describing rain', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW_UTC));
    process.env.WEATHERAPI_KEY = 'wa-key'; process.env.PIRATE_WEATHER_KEY = 'pw-key'; process.env.TOMORROWIO_API_KEY = 'ti-key';
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete process.env.WEATHERAPI_KEY; delete process.env.PIRATE_WEATHER_KEY; delete process.env.TOMORROWIO_API_KEY;
  });

  it('Johannesburg 23 Sept: four sources clear, Tomorrow.io "Light rain" + 1 mm/h radar → not "Rain\'s here"', async () => {
    stubFive({ openMeteo: clearOm(), weatherApi: weatherApi(1003, 10), pirate: pirate('partly-cloudy-night'), met: met('clearsky_night', 5), tomorrow: radarNow(4200, 1.0) });
    const body = await callHandler();
    expect(body.now.conditionSignals.sourceVotes.find((v) => v.source === 'Tomorrow.io').vote).toBe('rain');
    expect(body.now.conditionKey).not.toBe('rain');
    expect(body.now.conditionReason).not.toBe('tomorrow-io-radar-override');
    expect(body.now.conditionSignals.radarHeld).toEqual({ intensity: 1, key: body.now.conditionKey });
  });

  it('a "possible" from WeatherAPI is not the second signal', async () => {
    stubFive({ openMeteo: clearOm(), weatherApi: weatherApi(1063, 40), pirate: pirate('clear-night'), met: met('clearsky_night', 5), tomorrow: radarNow(4200, 1.0) });
    const body = await callHandler();
    expect(body.now.conditionReason).not.toBe('tomorrow-io-radar-override');
  });

  it('the same radar with WeatherAPI describing light rain → "Rain\'s here"', async () => {
    stubFive({ openMeteo: clearOm(), weatherApi: weatherApi(1183, 60), pirate: pirate('clear-night'), met: met('clearsky_night', 5), tomorrow: radarNow(4200, 1.0) });
    const body = await callHandler();
    expect(body.now.conditionKey).toBe('rain');
    expect(body.now.conditionReason).toBe('tomorrow-io-radar-override');
    expect(body.now.conditionSignals.radarHeld).toBeNull();
  });
});
