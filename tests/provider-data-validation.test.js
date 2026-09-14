// Prelaunch item 5 (P1-2, 2026-09-14): malformed provider data must not become
// a successful, cached forecast.
//
// Astra's two fixtures, reproduced exactly:
//   A. Open-Meteo HTTP 200 with `{}`, MET 503, no keyed providers → the old
//      handler answered 200 ok:true, now.tempC:null, Open-Meteo.ok:true and
//      scheduled a cache write.
//   B. detectAdvectionFog with Open-Meteo visibility -9999 m, Tomorrow 20 km,
//      RH 95%, 15°C / dew 14°C, no rain → visKm:-10, currentFog:true.

import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/_lib/weather-cache.js', async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    weatherCacheSetDeferred: vi.fn(mod.weatherCacheSetDeferred),
    weatherCacheGet: vi.fn(mod.weatherCacheGet),
    weatherCacheGetStale: vi.fn(mod.weatherCacheGetStale),
    weatherCacheAcquireLock: vi.fn(mod.weatherCacheAcquireLock),
    waitForWeatherCache: vi.fn(mod.waitForWeatherCache),
  };
});

import handler, { PAYLOAD_SCHEMA, detectAdvectionFog, sanitizeSources } from '../api/weather.js';
import {
  waitForWeatherCache,
  weatherCacheAcquireLock,
  weatherCacheGet,
  weatherCacheGetStale,
  weatherCacheSetDeferred,
} from '../api/_lib/weather-cache.js';

const makeResponse = (payload, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: vi.fn(async () => payload),
});

const validOpenMeteo = (over = {}) => ({
  utc_offset_seconds: 7200,
  current: {
    temperature_2m: 18, apparent_temperature: 18, weather_code: 0,
    wind_speed_10m: 10, wind_gusts_10m: 12, relative_humidity_2m: 50, cloud_cover: 10,
    ...(over.current || {}),
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
    visibility: Array(48).fill(20000),
    dew_point_2m: Array(48).fill(8),
    ...(over.hourly || {}),
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
});

const validMet = {
  properties: {
    timeseries: Array.from({ length: 48 }, (_, i) => ({
      time: new Date(Date.UTC(2026, 4, 18, 22 + i, 0, 0)).toISOString(),
      data: {
        instant: { details: { air_temperature: 18, wind_speed: 3, relative_humidity: 50, cloud_area_fraction: 10 } },
        next_1_hours: { summary: { symbol_code: 'clearsky_day' }, details: { precipitation_amount: 0 } },
      },
    })),
  },
};

const callHandler = async () => {
  let statusCode = 200;
  let body;
  const headers = {};
  const req = { query: { lat: '-34.1163', lon: '18.8362', name: 'Strand' } };
  const res = {
    setHeader: vi.fn((k, v) => { headers[k] = v; }),
    status(code) { statusCode = code; return this; },
    json(payload) { body = payload; return this; },
  };
  await handler(req, res);
  return { statusCode, body, headers };
};

const stubFetch = ({ openMeteo, met }) => vi.stubGlobal('fetch', vi.fn(async (url) => {
  const href = String(url);
  if (href.includes('open-meteo.com/')) return openMeteo();
  if (href.startsWith('https://api.met.no/')) return met();
  throw new Error(`Unexpected URL: ${href}`);
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-19T08:30:00Z')); // 10:30 SAST → localHour 10
  delete process.env.WEATHERAPI_KEY;
  delete process.env.PIRATE_WEATHER_KEY;
  delete process.env.TOMORROWIO_API_KEY;
  weatherCacheSetDeferred.mockClear();
  weatherCacheGet.mockReset();
  weatherCacheGet.mockResolvedValue(null);
  weatherCacheGetStale.mockReset();
  weatherCacheGetStale.mockResolvedValue(null);
  weatherCacheAcquireLock.mockReset();
  weatherCacheAcquireLock.mockResolvedValue({ acquired: true, release: async () => {} });
  waitForWeatherCache.mockReset();
  waitForWeatherCache.mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('item 5 — fixture A: an empty Open-Meteo body is not a live source', () => {
  it('Open-Meteo 200 {} + MET 503 + no keys → 503 ok:false degraded, never cached', async () => {
    stubFetch({ openMeteo: () => makeResponse({}), met: () => makeResponse({ error: 'down' }, 503) });
    const { statusCode, body, headers } = await callHandler();
    expect(statusCode).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.degraded).toBe(true);
    expect(body.now).toBeUndefined();
    const om = body.meta.sources.find(s => s.name === 'Open-Meteo');
    expect(om).toEqual({ name: 'Open-Meteo', ok: false });
    expect(body.meta.invalidSources).toEqual([
      expect.objectContaining({ name: 'Open-Meteo', reason: expect.stringContaining('nowTemp=null') }),
    ]);
    expect(headers['Cache-Control']).toBe('no-store');
    expect(weatherCacheSetDeferred).not.toHaveBeenCalled();
  });

  it('a sentinel current temperature (-9999) rejects that source; the rest still answer', async () => {
    stubFetch({
      openMeteo: () => makeResponse(validOpenMeteo({ current: { temperature_2m: -9999 } })),
      met: () => makeResponse(validMet),
    });
    const { statusCode, body } = await callHandler();
    expect(statusCode).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.meta.sources.find(s => s.name === 'Open-Meteo')).toEqual({ name: 'Open-Meteo', ok: false });
    expect(body.meta.sources.find(s => s.name === 'MET Norway')).toEqual({ name: 'MET Norway', ok: true });
    expect(body.now.tempC).toBe(18); // MET alone; -9999 never entered the blend
    expect(weatherCacheSetDeferred).toHaveBeenCalledTimes(1);
  });

  it('an impossible OPTIONAL field (humidity 150%) is dropped, the source stays', async () => {
    stubFetch({
      openMeteo: () => makeResponse(validOpenMeteo({ current: { relative_humidity_2m: 150 } })),
      met: () => makeResponse(validMet),
    });
    const { body } = await callHandler();
    expect(body.ok).toBe(true);
    expect(body.meta.sources.find(s => s.name === 'Open-Meteo')).toEqual({ name: 'Open-Meteo', ok: true });
    expect(body.now.humidity).toBe(50); // MET's 50, not (150+50)/2
  });

  it('a negative Open-Meteo visibility sentinel never fires the fog detector through the handler', async () => {
    const vis = Array(48).fill(20000); vis[10] = -9999;
    stubFetch({
      openMeteo: () => makeResponse(validOpenMeteo({
        current: { temperature_2m: 15, relative_humidity_2m: 95, wind_speed_10m: 4, wind_gusts_10m: 5 },
        hourly: { visibility: vis, relative_humidity_2m: Array(48).fill(95), temperature_2m: Array(48).fill(15), dew_point_2m: Array(48).fill(14) },
      })),
      met: () => makeResponse(validMet),
    });
    const { body } = await callHandler();
    expect(body.ok).toBe(true);
    expect(body.now.conditionKey).not.toBe('fog');
    expect(body.meta.conditionConfidence.fogSignal).toBeNull();
  });
});

describe('item 5 — fixture B: detectAdvectionFog rejects negative visibility for every provider', () => {
  const idx = 10;
  const om = (visM) => ({
    visibility: Array(24).fill(visM), humidity: Array(24).fill(95), temps: Array(24).fill(15),
    dewPoints: Array(24).fill(14), rains: Array(24).fill(0), precipMm: Array(24).fill(0),
  });
  const tio = (visKm) => ({ visibilityKm: Array(24).fill(visKm) });

  it("Astra's exact fixture: OM -9999 m, Tomorrow 20 km → not fog, governed by the 20 km read", () => {
    const out = detectAdvectionFog(om(-9999), idx, tio(20));
    expect(out.currentFog).toBe(false);
    expect(out.omVisM).toBeNull();
    expect(out.visKm).toBe(20);
    expect(out.visSource).toBe('Tomorrow.io');
  });

  it('control: OM 10000 m → visKm 10, not fog (unchanged behaviour)', () => {
    const out = detectAdvectionFog(om(10000), idx, tio(20));
    expect(out.currentFog).toBe(false);
    expect(out.visKm).toBe(10);
  });

  it('OM -9999 with no Tomorrow read at all → no signal, not a fog verdict', () => {
    const out = detectAdvectionFog(om(-9999), idx, null);
    expect(out.available).toBe(false);
    expect(out.currentFog).toBe(false);
  });

  it('sanity: a real 500 m whiteout still fires', () => {
    expect(detectAdvectionFog(om(500), idx, null).currentFog).toBe(true);
  });
});

describe('item 5 — sanitizeSources', () => {
  it('rejects a source without a valid current temperature and clears its hourly/daily slots', () => {
    const norms = [null, null, null, { source: 'MET Norway', nowTemp: null, humidity: 50 }, null];
    const hourlies = [null, null, { source: 'MET Norway', temps: [18] }, null];
    const dailies = [null, null, null, { source: 'MET Norway', highs: [20] }, null];
    const rejected = sanitizeSources(norms, hourlies, dailies);
    expect(rejected).toEqual([{ source: 'MET Norway', reason: expect.stringContaining('nowTemp=null') }]);
    expect(norms[3]).toBeNull();
    expect(hourlies[2]).toBeNull();
    expect(dailies[3]).toBeNull();
  });

  it('nulls out-of-bounds optional fields and array entries, keeps the source', () => {
    const norms = [{ source: 'Open-Meteo', nowTemp: 18, humidity: 150, windKph: 12, desc: 'Clear sky', todayRain: 40, gustKph: 30, windDir: 400 }, null, null, null, null];
    const hourlies = [{ source: 'Open-Meteo', visibility: [20000, -9999, 0], rains: [0, 120, 50], temps: [18, -9999, 20, ...Array(12).fill(19)] }, null, null, null];
    const dailies = [{ source: 'Open-Meteo', highs: [24, 999], lows: [12, -999], uvs: [6, -1] }, null, null, null, null];
    const rejected = sanitizeSources(norms, hourlies, dailies);
    expect(rejected).toEqual([]);
    expect(norms[0]).toMatchObject({ nowTemp: 18, humidity: null, windKph: 12, windDir: null, todayRain: 40, gustKph: 30 });
    expect(hourlies[0].visibility).toEqual([20000, null, 0]); // 0 m is a real whiteout, kept
    expect(hourlies[0].rains).toEqual([0, null, 50]);
    expect(hourlies[0].temps.slice(0, 3)).toEqual([18, null, 20]);
    expect(dailies[0].highs).toEqual([24, null]);
    expect(dailies[0].lows).toEqual([12, null]);
    expect(dailies[0].uvs).toEqual([6, null]);
  });

  it('does not reject real South African extremes', () => {
    const norms = [{ source: 'Open-Meteo', nowTemp: 50.2, todayLow: -20, windKph: 150, humidity: 0, todayUv: 14, desc: 'Clear sky' }, null, null, null, null];
    const hourlies = [{ source: 'Open-Meteo', temps: Array(24).fill(45) }, null, null, null];
    const dailies = [{ source: 'Open-Meteo', highs: [50.2], lows: [-20] }, null, null, null, null];
    expect(sanitizeSources(norms, hourlies, dailies)).toEqual([]);
    expect(norms[0]).toMatchObject({ nowTemp: 50.2, todayLow: -20, windKph: 150, humidity: 0, todayUv: 14 });
  });

  // Round 3 (Astra): structure, per source.
  it('a series that is an object, not an array, is dropped — and Open-Meteo without a daily range is rejected', () => {
    const norms = [{ source: 'Open-Meteo', nowTemp: 18, desc: 'Clear sky', windKph: 10 }, null, null, null, null];
    const hourlies = [{ source: 'Open-Meteo', temps: Array(48).fill(18) }, null, null, null];
    const dailies = [{ source: 'Open-Meteo', highs: { 0: 9999 }, lows: [12] }, null, null, null, null];
    const rejected = sanitizeSources(norms, hourlies, dailies);
    expect(rejected).toEqual([{ source: 'Open-Meteo', reason: expect.stringContaining('daily highs=0') }]);
    expect(norms[0]).toBeNull();
    expect(dailies[0]).toBeNull();
    expect(hourlies[0]).toBeNull();
  });

  it('an object-shaped hourly series on MET leaves MET with no hours → rejected, never [0]-indexed', () => {
    const norms = [null, null, null, { source: 'MET Norway', nowTemp: 18, desc: 'Clear sky', windKph: 10 }, null];
    const hourlies = [null, null, { source: 'MET Norway', temps: { 0: 9999 }, rains: Array(48).fill(0) }, null];
    const dailies = [null, null, null, { source: 'MET Norway', highs: [18], lows: [12], rains: [0] }, null];
    const rejected = sanitizeSources(norms, hourlies, dailies);
    expect(rejected).toEqual([{ source: 'MET Norway', reason: expect.stringContaining('hourly temps=0') }]);
    expect(hourlies[2]).toBeNull();
  });

  it('a current temperature alone is not a forecast: <12 numeric hours rejects an hourly source', () => {
    const norms = [{ source: 'Open-Meteo', nowTemp: 18, desc: 'Clear sky', windKph: 10 }, null, null, null, null];
    const hourlies = [{ source: 'Open-Meteo', temps: [18, 18, '19', null, 20] }, null, null, null];
    const dailies = [{ source: 'Open-Meteo', highs: [24], lows: [12] }, null, null, null, null];
    expect(sanitizeSources(norms, hourlies, dailies)).toEqual([{ source: 'Open-Meteo', reason: expect.stringContaining('hourly temps=3') }]);
  });

  it('Pirate Weather (daily only) needs a daily high and low, not hours', () => {
    const norms = [null, null, { source: 'Pirate Weather', nowTemp: 18, desc: 'Clear', windKph: 10 }, null, null];
    const dailies = [null, null, { source: 'Pirate Weather', highs: [24], lows: [] }, null, null];
    expect(sanitizeSources(norms, [null, null, null, null], dailies)).toEqual([{ source: 'Pirate Weather', reason: expect.stringContaining('lows=0') }]);
    const ok = [null, null, { source: 'Pirate Weather', nowTemp: 18, desc: 'Clear', windKph: 10 }, null, null];
    expect(sanitizeSources(ok, [null, null, null, null], [null, null, { source: 'Pirate Weather', highs: [24], lows: [12] }, null, null])).toEqual([]);
  });

  it('text series and text fields keep strings only', () => {
    const norms = [null, null, null, { source: 'MET Norway', nowTemp: 18, desc: 'Clear sky', windKph: 10, sunrise: 12345, sunset: { h: 18 } }, null];
    const hourlies = [null, null, { source: 'MET Norway', temps: Array(48).fill(18), descs: ['Clear sky', 7, null, { a: 1 }] }, null];
    const dailies = [null, null, null, { source: 'MET Norway', highs: [18], descs: [3] }, null];
    expect(sanitizeSources(norms, hourlies, dailies)).toEqual([]);
    expect(norms[3]).toMatchObject({ desc: 'Clear sky', sunrise: null, sunset: null });
    expect(hourlies[2].descs).toEqual(['Clear sky', null, null, null]);
    expect(dailies[3].descs).toEqual([null]);
  });

  // Round 4 (Astra): usable weather signals, not just temperatures.
  it('temperatures alone are not a forecast: no condition → rejected, no wind → rejected', () => {
    const base = () => ({
      hourlies: [{ source: 'Open-Meteo', temps: Array(48).fill(18) }, null, null, null],
      dailies: [{ source: 'Open-Meteo', highs: [24], lows: [12] }, null, null, null, null],
    });
    const run = (norm) => { const { hourlies, dailies } = base(); return sanitizeSources([norm, null, null, null, null], hourlies, dailies); };
    expect(run({ source: 'Open-Meteo', nowTemp: 18, windKph: 10 }))
      .toEqual([{ source: 'Open-Meteo', reason: expect.stringContaining('desc=null') }]);
    expect(run({ source: 'Open-Meteo', nowTemp: 18, windKph: 10, desc: 'Unknown' }))
      .toEqual([{ source: 'Open-Meteo', reason: expect.stringContaining('desc="Unknown"') }]);
    expect(run({ source: 'Open-Meteo', nowTemp: 18, windKph: 10, desc: '' }))
      .toEqual([{ source: 'Open-Meteo', reason: expect.stringContaining('desc=""') }]);
    expect(run({ source: 'Open-Meteo', nowTemp: 18, windKph: 10, desc: { code: 1 } }))
      .toEqual([{ source: 'Open-Meteo', reason: expect.stringContaining('desc=') }]);
    expect(run({ source: 'Open-Meteo', nowTemp: 18, desc: 'Clear sky' }))
      .toEqual([{ source: 'Open-Meteo', reason: expect.stringContaining('windKph=null') }]);
    expect(run({ source: 'Open-Meteo', nowTemp: 18, desc: 'Clear sky', windKph: 9999 }))
      .toEqual([{ source: 'Open-Meteo', reason: expect.stringContaining('windKph=9999') }]);
    // Precipitation, humidity and cloud stay optional.
    expect(run({ source: 'Open-Meteo', nowTemp: 18, desc: 'Clear sky', windKph: 10, todayRain: null, humidity: null })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Round 2 (Astra): a provider that throws AFTER publishing its current slot
// stayed half-registered; Tomorrow.io's nested override fields skipped the
// bounds; MET's -9999 mm became "20% rain" and bad humidity shaped feels-like
// BEFORE validation; pre-validation cache entries were served; the fog
// detector's trend branch still accepted negative visibility.
// ---------------------------------------------------------------------------
const tomorrowIoPayload = (currentIntensity, nextIntensity) => ({
  data: {
    timelines: [{
      intervals: [
        { startTime: '2026-05-19T08:00:00Z', values: { temperature: 18, precipitationIntensity: currentIntensity, precipitationProbability: 10, weatherCode: 1000, windSpeed: 4, humidity: 50, cloudCover: 10 } },
        { startTime: '2026-05-19T09:00:00Z', values: { temperature: 18, precipitationIntensity: nextIntensity, precipitationProbability: 10, weatherCode: 1000, windSpeed: 4, humidity: 50, cloudCover: 10 } },
        ...Array.from({ length: 46 }, (_, i) => ({
          startTime: new Date(Date.UTC(2026, 4, 19, 10 + i, 0, 0)).toISOString(),
          values: { temperature: 18, precipitationIntensity: 0, precipitationProbability: 0, weatherCode: 1000, windSpeed: 4, humidity: 50, cloudCover: 10 },
        })),
      ],
    }],
  },
});

const stubFetchWith = ({ openMeteo, met, tomorrow }) => {
  const fn = vi.fn(async (url) => {
    const href = String(url);
    if (href.includes('open-meteo.com/')) return openMeteo();
    if (href.startsWith('https://api.met.no/')) return met();
    if (href.startsWith('https://api.tomorrow.io/')) return tomorrow();
    throw new Error(`Unexpected URL: ${href}`);
  });
  vi.stubGlobal('fetch', fn);
  return fn;
};

describe('item 5 — round 2: atomic source slots', () => {
  it('a valid current temperature with malformed hourly arrays drops the WHOLE source, listed as failed exactly once', async () => {
    // temperature_2m: 42 has no .slice → the OM block throws after norms[0] was set.
    stubFetchWith({
      openMeteo: () => makeResponse(validOpenMeteo({ hourly: { temperature_2m: 42 } })),
      met: () => makeResponse(validMet),
    });
    const { statusCode, body } = await callHandler();
    expect(statusCode).toBe(200);
    expect(body.ok).toBe(true);
    const omEntries = body.meta.sources.filter(s => s.name === 'Open-Meteo');
    expect(omEntries).toEqual([{ name: 'Open-Meteo', ok: false }]);
    expect(body.meta.sourceWeights['Open-Meteo']).toBeNull();
    expect(body.now.tempC).toBe(18); // MET alone
    expect(body.windDir).toBeNull();  // OM's bearing did not leak from the half-published slot
  });
});

describe('item 5 — round 2: Tomorrow.io override records are bounded', () => {
  beforeEach(() => { process.env.TOMORROWIO_API_KEY = 'ti-key'; });
  afterEach(() => { delete process.env.TOMORROWIO_API_KEY; });

  it('a 9999 mm/h current intensity never fires the radar rain override', async () => {
    stubFetchWith({ openMeteo: () => makeResponse(validOpenMeteo()), met: () => makeResponse(validMet), tomorrow: () => makeResponse(tomorrowIoPayload(9999, 0)) });
    const { body } = await callHandler();
    expect(body.now.conditionReason).not.toBe('tomorrow-io-radar-override');
    expect(body.now.conditionKey).not.toBe('rain');
    expect(body.now.rainChance).toBeLessThan(70);
    expect(body.meta.sources.find(s => s.name === 'Tomorrow.io')).toEqual({ name: 'Tomorrow.io', ok: true });
  });

  it('a 9999 mm/h next-hour intensity never bumps the rain chance to 60', async () => {
    stubFetchWith({ openMeteo: () => makeResponse(validOpenMeteo()), met: () => makeResponse(validMet), tomorrow: () => makeResponse(tomorrowIoPayload(0, 9999)) });
    const { body } = await callHandler();
    expect(body.now.rainChance).toBeLessThan(60);
  });

  it('control: a real 2.25 mm/h current intensity still fires the override', async () => {
    stubFetchWith({ openMeteo: () => makeResponse(validOpenMeteo()), met: () => makeResponse(validMet), tomorrow: () => makeResponse(tomorrowIoPayload(2.25, 0)) });
    const { body } = await callHandler();
    expect(body.now.conditionReason).toBe('tomorrow-io-radar-override');
    expect(body.now.rainChance).toBeGreaterThanOrEqual(70);
  });
});

describe('item 5 — round 2: raw inputs are bounded before anything is derived', () => {
  const metWith = (mutate) => ({
    properties: {
      timeseries: validMet.properties.timeseries.map((p, i) => mutate(JSON.parse(JSON.stringify(p)), i)),
    },
  });

  it('MET precipitation -9999 mm is no signal, not "20% rain" — the hour and the day stay dry', async () => {
    stubFetchWith({
      openMeteo: () => makeResponse(validOpenMeteo()),
      met: () => makeResponse(metWith((p) => { p.data.next_1_hours.details.precipitation_amount = -9999; return p; })),
    });
    const { body } = await callHandler();
    expect(body.hourly[10].rainChance).toBe(0);    // OM's 0 alone; MET contributed null, not 20
    expect(body.hourly[10].precipMm).toBe(0);
    expect(body.now.conditionKey).not.toBe('rain-possible');
    expect(body.now.conditionKey).not.toBe('rain');
    expect(body.meta.sources.find(s => s.name === 'MET Norway')).toEqual({ name: 'MET Norway', ok: true });
    expect(body.daily[0].rainChance).toBe(0);
  });

  it('MET humidity 500% at 32 °C (where feels-like USES humidity) changes nothing against MET humidity 50%', async () => {
    // Round 3 (Astra): the old 18 °C fixture proved nothing — feels-like
    // ignores humidity below 27 °C. Differential run: identical output.
    const hot = validOpenMeteo({
      current: { temperature_2m: 32, apparent_temperature: 34, relative_humidity_2m: 50 },
      hourly: { temperature_2m: Array(48).fill(32), apparent_temperature: Array(48).fill(34) },
    });
    const metHot = (rh) => metWith((p) => {
      p.data.instant.details.air_temperature = 32;
      if (rh === undefined) delete p.data.instant.details.relative_humidity;
      else p.data.instant.details.relative_humidity = rh;
      return p;
    });
    const run = async (rh) => {
      stubFetchWith({ openMeteo: () => makeResponse(hot), met: () => makeResponse(metHot(rh)) });
      return (await callHandler()).body;
    };
    const bad = await run(500);
    const absent = await run(undefined);
    const good = await run(50);
    expect(bad.meta.sources.find(s => s.name === 'MET Norway')).toEqual({ name: 'MET Norway', ok: true });
    expect(bad.now.humidity).toBe(50); // OM's 50 alone
    // Invalid ≡ absent: the 500 shaped nothing — not now, not the hours.
    expect(bad.now.feelsLikeC).toBe(absent.now.feelsLikeC);
    expect(bad.hourly[10].feelsLikeC).toBe(absent.hourly[10].feelsLikeC);
    expect(bad.hourly[10].humidity).toBe(absent.hourly[10].humidity);
    // …and humidity really is live at 32 °C: a real 50% raises feels-like,
    // a 500% would have sent it past 100 °C.
    expect(good.now.feelsLikeC).toBeGreaterThan(bad.now.feelsLikeC);
    expect(bad.now.feelsLikeC).toBeLessThan(40);
  });

  // Round 3 (Astra): with every MET amount invalid, MET's daily rain used to
  // become 0% and dilute Open-Meteo's valid 60% to a cacheable 36%.
  it('MET precipitation -9999 everywhere contributes NO daily rain: Open-Meteo\'s 60% stands', async () => {
    const wet = validOpenMeteo({ hourly: { precipitation_probability: Array(48).fill(60) } });
    wet.daily.precipitation_probability_max = Array(7).fill(60);
    stubFetchWith({
      openMeteo: () => makeResponse(wet),
      met: () => makeResponse(metWith((p) => { p.data.next_1_hours.details.precipitation_amount = -9999; return p; })),
    });
    const { body } = await callHandler();
    expect(body.meta.sources.find(s => s.name === 'MET Norway')).toEqual({ name: 'MET Norway', ok: true });
    expect(body.daily[0].rainChance).toBe(60);
    // Control: a real 0 mm from MET DOES establish dry weather and blends down.
    stubFetchWith({ openMeteo: () => makeResponse(wet), met: () => makeResponse(validMet) });
    const control = (await callHandler()).body;
    expect(control.daily[0].rainChance).toBeLessThan(60);
    expect(control.daily[0].rainChance).toBeGreaterThan(0);
  });

  it('MET with no precipitation fields at all is no signal either (absent ≠ dry)', async () => {
    const wet = validOpenMeteo();
    wet.daily.precipitation_probability_max = Array(7).fill(60);
    stubFetchWith({
      openMeteo: () => makeResponse(wet),
      met: () => makeResponse(metWith((p) => { delete p.data.next_1_hours.details; return p; })),
    });
    const { body } = await callHandler();
    expect(body.daily[0].rainChance).toBe(60);
  });
});

describe('item 5 — round 3: required structure per source, through the handler', () => {
  it('Open-Meteo {current:{temperature_2m:18}} + MET 503 → 503 degraded with the structural reason, never cached', async () => {
    stubFetchWith({ openMeteo: () => makeResponse({ current: { temperature_2m: 18 } }), met: () => makeResponse({ error: 'down' }, 503) });
    const { statusCode, body, headers } = await callHandler();
    expect(statusCode).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.degraded).toBe(true);
    expect(body.meta.invalidSources).toEqual([
      expect.objectContaining({ name: 'Open-Meteo', reason: expect.stringContaining('hourly temps=0') }),
    ]);
    expect(headers['Cache-Control']).toBe('no-store');
    expect(weatherCacheSetDeferred).not.toHaveBeenCalled();
  });

  it('the same body next to a healthy MET: Open-Meteo is dropped, MET answers alone, no empty forecast', async () => {
    stubFetchWith({ openMeteo: () => makeResponse({ current: { temperature_2m: 18 } }), met: () => makeResponse(validMet) });
    const { statusCode, body } = await callHandler();
    expect(statusCode).toBe(200);
    expect(body.meta.sources.find(s => s.name === 'Open-Meteo')).toEqual({ name: 'Open-Meteo', ok: false });
    expect(body.meta.sources.find(s => s.name === 'MET Norway')).toEqual({ name: 'MET Norway', ok: true });
    expect(body.hourly.filter(h => h && Number.isFinite(h.tempC)).length).toBeGreaterThanOrEqual(12);
    expect(body.daily[0].highC).toBe(18);
  });

  it('Open-Meteo daily.temperature_2m_max = {"0": 9999}: never daily[0].highC, never written to the cache', async () => {
    const om = validOpenMeteo();
    om.daily.temperature_2m_max = { 0: 9999 };
    stubFetchWith({ openMeteo: () => makeResponse(om), met: () => makeResponse(validMet) });
    const { statusCode, body } = await callHandler();
    expect(statusCode).toBe(200);
    expect(body.daily[0].highC).toBe(18); // MET's day-0 alone
    expect(body.meta.sources.find(s => s.name === 'Open-Meteo')).toEqual({ name: 'Open-Meteo', ok: false });
    const written = weatherCacheSetDeferred.mock.calls[0]?.[1];
    expect(written.daily[0].highC).toBe(18);
    expect(JSON.stringify(written)).not.toContain('9999');
  });

  it('Open-Meteo utc_offset_seconds 1e300 with malformed hours: OM dropped, the offset stays on the coord estimate, MET still answers', async () => {
    const om = validOpenMeteo({ hourly: { temperature_2m: 42 } }); // no .slice → OM block throws
    om.utc_offset_seconds = 1e300;
    stubFetchWith({ openMeteo: () => makeResponse(om), met: () => makeResponse(validMet) });
    const { statusCode, body } = await callHandler();
    expect(statusCode).toBe(200);
    expect(body.meta.sources.find(s => s.name === 'MET Norway')).toEqual({ name: 'MET Norway', ok: true });
    expect(body.meta.utcOffsetSource).toBe('coord-estimate');
    expect(body.meta.utcOffsetSeconds).toBe(7200);
    expect(body.now.tempC).toBe(18);
  });

  it('an impossible offset on an otherwise valid Open-Meteo is rejected while the source is kept', async () => {
    const om = validOpenMeteo();
    om.utc_offset_seconds = 1e300;
    stubFetchWith({ openMeteo: () => makeResponse(om), met: () => makeResponse(validMet) });
    const { body } = await callHandler();
    expect(body.meta.sources.find(s => s.name === 'Open-Meteo')).toEqual({ name: 'Open-Meteo', ok: true });
    expect(body.meta.utcOffsetSource).toBe('coord-estimate');
    expect(body.meta.utcOffsetSeconds).toBe(7200);
    // Control: a real offset is still taken from Open-Meteo.
    stubFetchWith({ openMeteo: () => makeResponse(validOpenMeteo()), met: () => makeResponse(validMet) });
    expect((await callHandler()).body.meta.utcOffsetSource).toBe('open-meteo');
  });
});

describe('item 5 — round 2/3: the cache serves nothing that never passed validation', () => {
  // Round 3 (Astra): the old hand-made fixtures were refused for lacking a
  // selector, not for the checks under test. Every case here starts from a
  // GENUINE entry this handler wrote and breaks exactly one thing.
  const genuineEntry = async () => {
    stubFetchWith({ openMeteo: () => makeResponse(validOpenMeteo()), met: () => makeResponse(validMet) });
    await callHandler();
    const entry = JSON.parse(JSON.stringify(weatherCacheSetDeferred.mock.calls[0][1]));
    weatherCacheSetDeferred.mockClear();
    expect(entry.meta.schema).toBe(PAYLOAD_SCHEMA);
    return entry;
  };
  const fetchNever = () => stubFetchWith({
    openMeteo: () => { throw new Error('must not fetch'); },
    met: () => { throw new Error('must not fetch'); },
  });

  it('control: the untouched entry is a HIT with no fetch', async () => {
    weatherCacheGet.mockResolvedValue(await genuineEntry());
    const fetchFn = fetchNever();
    const { body } = await callHandler();
    expect(fetchFn).not.toHaveBeenCalled();
    expect(body.meta.serverCache).toBe('hit');
    expect(body.now.tempC).toBe(18);
  });

  it('the same entry without meta.schema (written before validation) is a MISS', async () => {
    const entry = await genuineEntry();
    delete entry.meta.schema;
    weatherCacheGet.mockResolvedValue(entry);
    const fetchFn = stubFetchWith({ openMeteo: () => makeResponse(validOpenMeteo()), met: () => makeResponse(validMet) });
    const { body } = await callHandler();
    expect(fetchFn).toHaveBeenCalled();
    expect(body.meta.serverCache).toBe('miss');
  });

  it('the same entry with a null current temperature is a MISS', async () => {
    const entry = await genuineEntry();
    entry.now.tempC = null;
    weatherCacheGet.mockResolvedValue(entry);
    const fetchFn = stubFetchWith({ openMeteo: () => makeResponse(validOpenMeteo()), met: () => makeResponse(validMet) });
    const { body } = await callHandler();
    expect(fetchFn).toHaveBeenCalled();
    expect(body.meta.serverCache).toBe('miss');
    expect(body.now.tempC).toBe(18);
  });

  it('the same entry with an impossible cached offset is a MISS (fetched fresh, the real offset returned), not a hit and not a 500', async () => {
    const entry = await genuineEntry();
    entry.meta.utcOffsetSeconds = 1e300;
    weatherCacheGet.mockResolvedValue(entry);
    const fetchFn = stubFetchWith({ openMeteo: () => makeResponse(validOpenMeteo()), met: () => makeResponse(validMet) });
    const { statusCode, body } = await callHandler();
    expect(statusCode).toBe(200);
    expect(fetchFn).toHaveBeenCalled();
    expect(body.meta.serverCache).toBe('miss');
    expect(body.meta.utcOffsetSeconds).toBe(7200);
    expect(body.now.tempC).toBe(18);
  });

  it('stale path: a lock loser refuses a stale entry with an impossible offset too', async () => {
    const entry = await genuineEntry();
    entry.meta.utcOffsetSeconds = 1e300;
    weatherCacheGet.mockResolvedValue(null);
    weatherCacheAcquireLock.mockResolvedValue({ acquired: false, release: async () => {} });
    weatherCacheGetStale.mockResolvedValue(entry);
    waitForWeatherCache.mockResolvedValue(null);
    const fetchFn = fetchNever();
    const { statusCode, body } = await callHandler();
    expect(fetchFn).not.toHaveBeenCalled();
    expect(statusCode).toBe(503);
    expect(body.ok).toBe(false);
    expect(JSON.stringify(body)).not.toContain('1e+300');
  });

  it('stale path: a lock loser refuses a pre-validation stale entry and answers without it', async () => {
    const entry = await genuineEntry();
    delete entry.meta.schema;
    weatherCacheGet.mockResolvedValue(null);
    weatherCacheAcquireLock.mockResolvedValue({ acquired: false, release: async () => {} });
    weatherCacheGetStale.mockResolvedValue(entry);
    waitForWeatherCache.mockResolvedValue(null);
    const fetchFn = fetchNever();
    const { statusCode, body } = await callHandler();
    expect(fetchFn).not.toHaveBeenCalled();
    expect(statusCode).toBe(503);
    expect(body.ok).toBe(false);
    expect(weatherCacheSetDeferred).not.toHaveBeenCalled();
  });

  it('stale path control: the genuine stale entry IS served to a lock loser', async () => {
    const entry = await genuineEntry();
    weatherCacheGet.mockResolvedValue(null);
    weatherCacheAcquireLock.mockResolvedValue({ acquired: false, release: async () => {} });
    weatherCacheGetStale.mockResolvedValue(entry);
    const fetchFn = fetchNever();
    const { statusCode, body } = await callHandler();
    expect(fetchFn).not.toHaveBeenCalled();
    expect(statusCode).toBe(200);
    expect(body.meta.serverCache).toBe('stale-lock-wait');
  });
});

describe('item 5 — round 2: the fog detector trend branch rejects negative visibility too', () => {
  const idx = 10;
  it("Astra's fixture B asserted on BOTH verdicts: current false AND trend false", () => {
    const om = {
      visibility: Array(24).fill(-9999), humidity: Array(24).fill(95), temps: Array(24).fill(15),
      dewPoints: Array(24).fill(14), rains: Array(24).fill(0), precipMm: Array(24).fill(0),
    };
    const out = detectAdvectionFog(om, idx, { visibilityKm: Array(24).fill(20) });
    expect(out.currentFog).toBe(false);
    expect(out.trendFog).toBe(false);
  });

  it('a negative sentinel only in the next three hours is no trend signal; a real 800 m forecast is', () => {
    const base = {
      visibility: Array(24).fill(20000), humidity: Array(24).fill(95), temps: Array(24).fill(15),
      dewPoints: Array(24).fill(14), rains: Array(24).fill(0), precipMm: Array(24).fill(0),
    };
    const sentinel = { ...base, visibility: base.visibility.map((v, i) => (i === idx + 2 ? -9999 : v)) };
    expect(detectAdvectionFog(sentinel, idx, null).trendFog).toBe(false);
    const real = { ...base, visibility: base.visibility.map((v, i) => (i === idx + 2 ? 800 : v)) };
    expect(detectAdvectionFog(real, idx, null).trendFog).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Round 4 (Astra): WeatherAPI and Pirate Weather ingestion, previously never
// exercised through the handler.
// ---------------------------------------------------------------------------
const waHour = (over = {}) => ({
  temp_c: 18, feelslike_c: 18, condition: { code: 1000, text: 'Sunny' }, chance_of_rain: 0, precip_mm: 0,
  wind_kph: 10, cloud: 10, humidity: 50, uv: 4, ...over,
});
const validWeatherApi = (over = {}) => ({
  location: { tz_id: 'Africa/Johannesburg' },
  current: { temp_c: 18, feelslike_c: 18, condition: { code: 1000, text: 'Sunny' }, wind_kph: 10, humidity: 50, cloud: 10, uv: 4, precip_mm: 0, ...(over.current || {}) },
  forecast: {
    forecastday: over.forecastday || [0, 1].map(() => ({
      day: { maxtemp_c: 24, mintemp_c: 12, daily_chance_of_rain: 0, totalprecip_mm: 0, uv: 6, maxwind_kph: 20, condition: { code: 1000, text: 'Sunny' } },
      astro: { sunrise: '06:00 AM', sunset: '06:00 PM' },
      hour: Array.from({ length: 24 }, () => waHour(over.hour || {})),
    })),
  },
});
const validPirate = (over = {}) => ({
  offset: 2,
  currently: { temperature: 18, windSpeed: 3, windGust: 4, humidity: 0.5, icon: 'clear-day', ...(over.currently || {}) },
  daily: over.daily || {
    data: Array.from({ length: 7 }, () => ({
      temperatureHigh: 24, temperatureLow: 12, precipProbability: 0, uvIndex: 6, icon: 'clear-day', windSpeed: 3, cloudCover: 0.1,
      sunriseTime: Date.UTC(2026, 4, 19, 4, 0, 0) / 1000, sunsetTime: Date.UTC(2026, 4, 19, 16, 0, 0) / 1000, // 06:00 / 18:00 SAST
    })),
  },
  ...(over.top || {}),
});
const stubAll = ({ openMeteo, met, weatherApi, pirate }) => {
  const fn = vi.fn(async (url) => {
    const href = String(url);
    if (href.includes('open-meteo.com/')) return openMeteo();
    if (href.startsWith('https://api.met.no/')) return met();
    if (href.includes('api.weatherapi.com/')) return weatherApi();
    if (href.includes('api.pirateweather.net/')) return pirate();
    throw new Error(`Unexpected URL: ${href}`);
  });
  vi.stubGlobal('fetch', fn);
  return fn;
};
const down = () => makeResponse({ error: 'down' }, 503);

describe('item 5 — round 4: WeatherAPI and Pirate Weather through the handler', () => {
  beforeEach(() => { process.env.WEATHERAPI_KEY = 'wa-key'; process.env.PIRATE_WEATHER_KEY = 'pw-key'; });
  afterEach(() => { delete process.env.WEATHERAPI_KEY; delete process.env.PIRATE_WEATHER_KEY; });

  it('control: all four answer and are blended', async () => {
    stubAll({ openMeteo: () => makeResponse(validOpenMeteo()), met: () => makeResponse(validMet), weatherApi: () => makeResponse(validWeatherApi()), pirate: () => makeResponse(validPirate()) });
    const { statusCode, body } = await callHandler();
    expect(statusCode).toBe(200);
    for (const name of ['Open-Meteo', 'WeatherAPI', 'Pirate Weather', 'MET Norway']) {
      expect(body.meta.sources.find(s => s.name === name)).toEqual({ name, ok: true });
    }
    expect(body.meta.utcOffsetSource).toBe('open-meteo');
  });

  it("Pirate offset:null with Open-Meteo and WeatherAPI down: the offset stays on the coord estimate (7200), Strand's morning is still morning", async () => {
    // 06:30 SAST — Astra's reproduction: null*3600 = 0 used to give localHour 4, isDay false.
    vi.setSystemTime(new Date('2026-05-19T04:30:00Z'));
    stubAll({ openMeteo: down, weatherApi: down, met: () => makeResponse(validMet), pirate: () => makeResponse(validPirate({ top: { offset: null } })) });
    const { statusCode, body } = await callHandler();
    expect(statusCode).toBe(200);
    expect(body.meta.utcOffsetSource).toBe('coord-estimate');
    expect(body.meta.utcOffsetSeconds).toBe(7200);
    expect(body.meta.localHour).toBe(6);
    expect(body.now.isDay).toBe(true);
    expect(body.meta.sources.find(s => s.name === 'Pirate Weather')).toEqual({ name: 'Pirate Weather', ok: true });
    const written = weatherCacheSetDeferred.mock.calls[0]?.[1];
    expect(written.meta.utcOffsetSeconds).toBe(7200);
  });

  it('Pirate offset "2" (a string) and offset 1e300 are rejected the same way; a real 2 is taken', async () => {
    for (const offset of ['2', 1e300, -99]) {
      weatherCacheSetDeferred.mockClear();
      stubAll({ openMeteo: down, weatherApi: down, met: () => makeResponse(validMet), pirate: () => makeResponse(validPirate({ top: { offset } })) });
      const { body } = await callHandler();
      expect(body.meta.utcOffsetSource).toBe('coord-estimate');
      expect(body.meta.utcOffsetSeconds).toBe(7200);
    }
    stubAll({ openMeteo: down, weatherApi: down, met: () => makeResponse(validMet), pirate: () => makeResponse(validPirate()) });
    expect((await callHandler()).body.meta.utcOffsetSource).toBe('pirate-weather');
  });

  it('Pirate daily.data as an object: the source is dropped whole, the rest answer', async () => {
    stubAll({ openMeteo: () => makeResponse(validOpenMeteo()), met: () => makeResponse(validMet), weatherApi: () => makeResponse(validWeatherApi()), pirate: () => makeResponse(validPirate({ daily: { data: { 0: { temperatureHigh: 9999 } } } })) });
    const { body } = await callHandler();
    expect(body.meta.sources.find(s => s.name === 'Pirate Weather')).toEqual({ name: 'Pirate Weather', ok: false });
    expect(body.daily[0].highC).toBeLessThan(60);
    expect(JSON.stringify(body)).not.toContain('9999');
  });

  it('Pirate currently {} (no temperature, no wind, no icon) is rejected; its daily never reaches the blend', async () => {
    stubAll({ openMeteo: () => makeResponse(validOpenMeteo()), met: () => makeResponse(validMet), weatherApi: () => makeResponse(validWeatherApi()), pirate: () => makeResponse(validPirate({ currently: { temperature: undefined, windSpeed: undefined, icon: undefined } })) });
    const { body } = await callHandler();
    expect(body.meta.sources.find(s => s.name === 'Pirate Weather')).toEqual({ name: 'Pirate Weather', ok: false });
  });

  it('WeatherAPI hours with string temperatures are no hours: WeatherAPI is rejected, the others answer', async () => {
    stubAll({ openMeteo: () => makeResponse(validOpenMeteo()), met: () => makeResponse(validMet), weatherApi: () => makeResponse(validWeatherApi({ hour: { temp_c: '18' } })), pirate: () => makeResponse(validPirate()) });
    const { body } = await callHandler();
    expect(body.meta.sources.find(s => s.name === 'WeatherAPI')).toEqual({ name: 'WeatherAPI', ok: false });
    expect(body.meta.sources.find(s => s.name === 'Open-Meteo')).toEqual({ name: 'Open-Meteo', ok: true });
    expect(body.now.tempC).toBe(18);
  });

  it('WeatherAPI current {} and forecastday [] are rejected without throwing the request away', async () => {
    stubAll({ openMeteo: () => makeResponse(validOpenMeteo()), met: () => makeResponse(validMet), weatherApi: () => makeResponse(validWeatherApi({ current: { temp_c: null, wind_kph: null, condition: null } })), pirate: () => makeResponse(validPirate()) });
    expect((await callHandler()).body.meta.sources.find(s => s.name === 'WeatherAPI')).toEqual({ name: 'WeatherAPI', ok: false });
    stubAll({ openMeteo: () => makeResponse(validOpenMeteo()), met: () => makeResponse(validMet), weatherApi: () => makeResponse(validWeatherApi({ forecastday: [] })), pirate: () => makeResponse(validPirate()) });
    const { statusCode, body } = await callHandler();
    expect(statusCode).toBe(200);
    expect(body.meta.sources.find(s => s.name === 'WeatherAPI')).toEqual({ name: 'WeatherAPI', ok: false });
  });

  it('WeatherAPI with a condition but no wind, or wind but no condition, is not a usable source', async () => {
    stubAll({ openMeteo: () => makeResponse(validOpenMeteo()), met: () => makeResponse(validMet), weatherApi: () => makeResponse(validWeatherApi({ current: { wind_kph: undefined } })), pirate: () => makeResponse(validPirate()) });
    expect((await callHandler()).body.meta.sources.find(s => s.name === 'WeatherAPI')).toEqual({ name: 'WeatherAPI', ok: false });
    stubAll({ openMeteo: () => makeResponse(validOpenMeteo()), met: () => makeResponse(validMet), weatherApi: () => makeResponse(validWeatherApi({ current: { condition: {} } })), pirate: () => makeResponse(validPirate()) });
    expect((await callHandler()).body.meta.sources.find(s => s.name === 'WeatherAPI')).toEqual({ name: 'WeatherAPI', ok: false });
  });

  it('Open-Meteo with temperatures only (no weather code, no wind) next to a down MET: 503 degraded, uncached', async () => {
    stubAll({
      openMeteo: () => makeResponse({ utc_offset_seconds: 7200, current: { temperature_2m: 18 }, hourly: { temperature_2m: Array(48).fill(18) }, daily: { temperature_2m_max: [24], temperature_2m_min: [12] } }),
      met: down, weatherApi: down, pirate: down,
    });
    const { statusCode, body, headers } = await callHandler();
    expect(statusCode).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.meta.invalidSources).toEqual([expect.objectContaining({ name: 'Open-Meteo', reason: expect.stringMatching(/desc=|windKph=/) })]);
    expect(headers['Cache-Control']).toBe('no-store');
    expect(weatherCacheSetDeferred).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Round 5 (Astra): a "condition" is a RECOGNISED provider value, never an
// unknown or no-data marker; WeatherAPI's missing amounts are not dry weather;
// unparseable solar strings fall back to the local-hour rule on both paths.
// ---------------------------------------------------------------------------
const validTomorrowIo = (code = 1000) => {
  const p = tomorrowIoPayload(0, 0);
  for (const iv of p.data.timelines[0].intervals) iv.values.weatherCode = code;
  return p;
};
const stubFive = ({ openMeteo = down, met = down, weatherApi = down, pirate = down, tomorrow = down }) => {
  const fn = vi.fn(async (url) => {
    const href = String(url);
    if (href.includes('open-meteo.com/')) return openMeteo();
    if (href.startsWith('https://api.met.no/')) return met();
    if (href.includes('api.weatherapi.com/')) return weatherApi();
    if (href.includes('api.pirateweather.net/')) return pirate();
    if (href.startsWith('https://api.tomorrow.io/')) return tomorrow();
    throw new Error(`Unexpected URL: ${href}`);
  });
  vi.stubGlobal('fetch', fn);
  return fn;
};

describe('item 5 — round 5: unknown and no-data condition markers, per provider, alone', () => {
  beforeEach(() => { process.env.WEATHERAPI_KEY = 'wa-key'; process.env.PIRATE_WEATHER_KEY = 'pw-key'; process.env.TOMORROWIO_API_KEY = 'ti-key'; });
  afterEach(() => { delete process.env.WEATHERAPI_KEY; delete process.env.PIRATE_WEATHER_KEY; delete process.env.TOMORROWIO_API_KEY; });

  const alone = [
    ['Open-Meteo weather_code 999', { openMeteo: () => makeResponse(validOpenMeteo({ current: { weather_code: 999 } })) }],
    ['Open-Meteo weather_code absent', { openMeteo: () => makeResponse(validOpenMeteo({ current: { weather_code: undefined } })) }],
    ['MET symbol_code "weird_day"', { met: () => makeResponse({ properties: { timeseries: validMet.properties.timeseries.map(p => ({ ...p, data: { ...p.data, next_1_hours: { ...p.data.next_1_hours, summary: { symbol_code: 'weird_day' } } } })) } }) }],
    ['WeatherAPI condition code 9999', { weatherApi: () => makeResponse(validWeatherApi({ current: { condition: { code: 9999, text: 'Sunny' } } })) }],
    ['WeatherAPI condition {} (no code)', { weatherApi: () => makeResponse(validWeatherApi({ current: { condition: {} } })) }],
    ['Pirate icon "none" (its no-data marker)', { pirate: () => makeResponse(validPirate({ currently: { icon: 'none' } })) }],
    ['Pirate icon "sandstorm" (unmapped)', { pirate: () => makeResponse(validPirate({ currently: { icon: 'sandstorm' } })) }],
    ['Tomorrow.io weatherCode 9999', { tomorrow: () => makeResponse(validTomorrowIo(9999)) }],
  ];
  for (const [label, stubs] of alone) {
    it(`${label}, as the only source → 503 degraded with a desc reason, never cached`, async () => {
      stubFive(stubs);
      const { statusCode, body, headers } = await callHandler();
      expect(statusCode).toBe(503);
      expect(body.ok).toBe(false);
      expect(body.meta.invalidSources).toHaveLength(1);
      expect(body.meta.invalidSources[0].reason).toMatch(/desc=/);
      expect(headers['Cache-Control']).toBe('no-store');
      expect(weatherCacheSetDeferred).not.toHaveBeenCalled();
    });
  }

  it('control: each provider alone with a recognised condition answers 200', async () => {
    const cases = [
      { openMeteo: () => makeResponse(validOpenMeteo()) },
      { met: () => makeResponse(validMet) },
      { weatherApi: () => makeResponse(validWeatherApi()) },
      { pirate: () => makeResponse(validPirate()) },
      { tomorrow: () => makeResponse(validTomorrowIo()) },
    ];
    for (const stubs of cases) {
      weatherCacheSetDeferred.mockClear();
      stubFive(stubs);
      const { statusCode, body } = await callHandler();
      expect(statusCode).toBe(200);
      expect(body.ok).toBe(true);
      expect(weatherCacheSetDeferred).toHaveBeenCalledTimes(1);
    }
  });

  it('Pirate "none" next to healthy sources: Pirate is ok:false, the blend never sees a "clear" from it', async () => {
    stubFive({ openMeteo: () => makeResponse(validOpenMeteo()), met: () => makeResponse(validMet), weatherApi: () => makeResponse(validWeatherApi()), pirate: () => makeResponse(validPirate({ currently: { icon: 'none' } })), tomorrow: () => makeResponse(validTomorrowIo()) });
    const { body } = await callHandler();
    expect(body.meta.sources.find(s => s.name === 'Pirate Weather')).toEqual({ name: 'Pirate Weather', ok: false });
    expect(body.meta.sourceWeights['Pirate Weather']).toBeNull();
  });
});

describe('item 5 — round 5: WeatherAPI missing amounts are not dry weather', () => {
  beforeEach(() => { process.env.WEATHERAPI_KEY = 'wa-key'; });
  afterEach(() => { delete process.env.WEATHERAPI_KEY; });

  const wetHours = (precip) => ({ hour: { chance_of_rain: 60, precip_mm: precip, condition: { code: 1000, text: 'Sunny' } } });
  const wetDay = (wa, precip) => { for (const fd of wa.forecast.forecastday) { fd.day.daily_chance_of_rain = 60; fd.day.totalprecip_mm = precip; } return wa; };

  it('null precipitation amounts with 60% probabilities: 60% stands for the hour and the day, no clear clamp', async () => {
    const wa = wetDay(validWeatherApi({ ...wetHours(null), current: { precip_mm: null } }), null);
    stubFive({ weatherApi: () => makeResponse(wa) });
    const { statusCode, body } = await callHandler();
    expect(statusCode).toBe(200);
    expect(body.hourly[10].rainChance).toBe(60);
    expect(body.daily[0].rainChance).toBe(60);
    expect(body.now.conditionKey).not.toBe('clear');
    const written = weatherCacheSetDeferred.mock.calls[0]?.[1];
    expect(written.daily[0].rainChance).toBe(60);
  });

  it('control: an explicit, valid 0 mm with the same probabilities IS the clamp', async () => {
    const wa = wetDay(validWeatherApi({ ...wetHours(0), current: { precip_mm: 0 } }), 0);
    stubFive({ weatherApi: () => makeResponse(wa) });
    const { body } = await callHandler();
    expect(body.hourly[10].rainChance).toBe(0);
    expect(body.daily[0].rainChance).toBe(0);
  });

  it('an out-of-bounds amount (-9999) is treated exactly like a missing one', async () => {
    const wa = wetDay(validWeatherApi({ ...wetHours(-9999), current: { precip_mm: -9999 } }), -9999);
    stubFive({ weatherApi: () => makeResponse(wa) });
    const { body } = await callHandler();
    expect(body.hourly[10].rainChance).toBe(60);
    expect(body.daily[0].rainChance).toBe(60);
  });
});

describe('item 5 — round 5: unparseable solar strings fall back to the local-hour rule on both paths', () => {
  it('Open-Meteo sunrise/sunset "bad" at 23:30 SAST: isDay false fresh, and false again on the cache hit', async () => {
    vi.setSystemTime(new Date('2026-05-19T21:30:00Z')); // 23:30 SAST
    const om = validOpenMeteo();
    om.daily.sunrise = Array(7).fill('bad');
    om.daily.sunset = Array(7).fill('bad');
    stubFetchWith({ openMeteo: () => makeResponse(om), met: () => makeResponse(validMet) });
    const fresh = await callHandler();
    expect(fresh.statusCode).toBe(200);
    expect(fresh.body.now.isDay).toBe(false);
    expect(fresh.body.now.uv).toBeNull();
    const written = JSON.parse(JSON.stringify(weatherCacheSetDeferred.mock.calls[0][1]));
    weatherCacheGet.mockResolvedValue(written);
    const fetchFn = stubFetchWith({ openMeteo: () => { throw new Error('must not fetch'); }, met: () => { throw new Error('must not fetch'); } });
    const hit = await callHandler();
    expect(fetchFn).not.toHaveBeenCalled();
    expect(hit.body.meta.serverCache).toBe('hit');
    expect(hit.body.now.isDay).toBe(false);
  });

  it('control: parseable solar strings decide isDay at 23:30 SAST (false) and at 10:30 (true)', async () => {
    vi.setSystemTime(new Date('2026-05-19T21:30:00Z'));
    stubFetchWith({ openMeteo: () => makeResponse(validOpenMeteo()), met: () => makeResponse(validMet) });
    expect((await callHandler()).body.now.isDay).toBe(false);
    vi.setSystemTime(new Date('2026-05-19T08:30:00Z'));
    stubFetchWith({ openMeteo: () => makeResponse(validOpenMeteo()), met: () => makeResponse(validMet) });
    expect((await callHandler()).body.now.isDay).toBe(true);
  });
});

describe('item 5 — round 6: enumerated codes, scalar types, the MET symbol set, and a solar/fallback disagreement', () => {
  beforeEach(() => { process.env.WEATHERAPI_KEY = 'wa-key'; process.env.PIRATE_WEATHER_KEY = 'pw-key'; process.env.TOMORROWIO_API_KEY = 'ti-key'; });
  afterEach(() => { delete process.env.WEATHERAPI_KEY; delete process.env.PIRATE_WEATHER_KEY; delete process.env.TOMORROWIO_API_KEY; });

  const metWithSymbol = (symbol) => ({ properties: { timeseries: validMet.properties.timeseries.map(p => ({ ...p, data: { ...p.data, next_1_hours: { ...p.data.next_1_hours, summary: { symbol_code: symbol } } } })) } });

  const rejected = [
    ['WeatherAPI code 1001 (inside the numeric range, not an enumerated code) with text "none"', { weatherApi: () => makeResponse(validWeatherApi({ current: { condition: { code: 1001, text: 'none' } } })) }],
    ['WeatherAPI code 1002 with text "Sunny"', { weatherApi: () => makeResponse(validWeatherApi({ current: { condition: { code: 1002, text: 'Sunny' } } })) }],
    ['WeatherAPI code "1000" (a string)', { weatherApi: () => makeResponse(validWeatherApi({ current: { condition: { code: '1000', text: 'Sunny' } } })) }],
    ['Open-Meteo weather_code [0] (an array)', { openMeteo: () => makeResponse(validOpenMeteo({ current: { weather_code: [0] } })) }],
    ['Open-Meteo weather_code "0" (a string)', { openMeteo: () => makeResponse(validOpenMeteo({ current: { weather_code: '0' } })) }],
    ['Open-Meteo weather_code 0.5', { openMeteo: () => makeResponse(validOpenMeteo({ current: { weather_code: 0.5 } })) }],
    ['Tomorrow.io weatherCode [1000]', { tomorrow: () => makeResponse((() => { const p = validTomorrowIo(); p.data.timelines[0].intervals[0].values.weatherCode = [1000]; return p; })()) }],
    ['Pirate icon ["clear-day"]', { pirate: () => makeResponse(validPirate({ currently: { icon: ['clear-day'] } })) }],
    ['Pirate icon {} (an object)', { pirate: () => makeResponse(validPirate({ currently: { icon: {} } })) }],
    ['MET symbol_code ["clearsky_day"]', { met: () => makeResponse(metWithSymbol(['clearsky_day'])) }],
  ];
  for (const [label, stubs] of rejected) {
    it(`${label}, alone → 503 degraded, never cached`, async () => {
      stubFive(stubs);
      const { statusCode, body } = await callHandler();
      expect(statusCode).toBe(503);
      expect(body.ok).toBe(false);
      expect(weatherCacheSetDeferred).not.toHaveBeenCalled();
    });
  }

  it('WeatherAPI code 1000 with an empty text is still Sunny — the text is never the source of truth', async () => {
    stubFive({ weatherApi: () => makeResponse(validWeatherApi({ current: { condition: { code: 1000, text: '' } } })) });
    const { statusCode, body } = await callHandler();
    expect(statusCode).toBe(200);
    expect(body.now.conditionKey).toBe('clear');
  });

  it('WeatherAPI descriptions come from the code, not the text: code 1135 with text "Sunny" and 0% rain is Fog in now, hourly and daily', async () => {
    const wa = validWeatherApi({ current: { condition: { code: 1135, text: 'Sunny' } }, hour: { condition: { code: 1135, text: 'Sunny' } } });
    for (const fd of wa.forecast.forecastday) fd.day.condition = { code: 1135, text: 'Sunny' };
    stubFive({ weatherApi: () => makeResponse(wa) });
    const { statusCode, body } = await callHandler();
    expect(statusCode).toBe(200);
    expect(body.now.conditionLabel).toBe('Fog');
    expect(body.now.conditionKey).toBe('fog');
    expect(body.hourly[10].condition).toBe('fog');
    expect(body.daily[0].conditionLabel).toBe('Fog');
    expect(body.daily[0].conditionKey).toBe('fog');
    expect(body.hourly[10].descLabel).toBe('Fog');
    expect(JSON.stringify(body)).not.toContain('Sunny');
  });

  it("MET's published double-s spelling lightssnowshowersandthunder is a known condition (regression: it became 503/desc=null)", async () => {
    stubFive({ met: () => makeResponse(metWithSymbol('lightssnowshowersandthunder_day')) });
    const { statusCode, body } = await callHandler();
    expect(statusCode).toBe(200);
    expect(body.meta.sources.find(s => s.name === 'MET Norway')).toEqual({ name: 'MET Norway', ok: true });
    expect(['storm', 'thunder', 'cold', 'rain']).toContain(body.now.conditionKey);
  });

  it('every symbol in the published MET set, day and night, is a known condition', async () => {
    const symbols = ['clearsky', 'fair', 'partlycloudy', 'cloudy', 'fog', 'lightrainshowers', 'rainshowers', 'heavyrainshowers',
      'lightrainshowersandthunder', 'rainshowersandthunder', 'heavyrainshowersandthunder', 'lightsleetshowers', 'sleetshowers',
      'heavysleetshowers', 'lightssleetshowersandthunder', 'sleetshowersandthunder', 'heavysleetshowersandthunder', 'lightsnowshowers',
      'snowshowers', 'heavysnowshowers', 'lightssnowshowersandthunder', 'snowshowersandthunder', 'heavysnowshowersandthunder',
      'lightrain', 'rain', 'heavyrain', 'lightrainandthunder', 'rainandthunder', 'heavyrainandthunder', 'lightsleet', 'sleet',
      'heavysleet', 'lightsleetandthunder', 'sleetandthunder', 'heavysleetandthunder', 'lightsnow', 'snow', 'heavysnow',
      'lightsnowandthunder', 'snowandthunder', 'heavysnowandthunder'];
    for (const base of symbols) {
      for (const suffix of ['_day', '_night', '']) {
        weatherCacheSetDeferred.mockClear();
        stubFive({ met: () => makeResponse(metWithSymbol(base + suffix)) });
        const { statusCode } = await callHandler();
        expect(statusCode, base + suffix).toBe(200);
      }
    }
  });

  it('solar strings win over the hour fallback when they disagree: 18:30 SAST with sunset 18:00 is night', async () => {
    vi.setSystemTime(new Date('2026-05-19T16:30:00Z')); // 18:30 SAST — the 06–19 fallback would say day
    const om = validOpenMeteo();
    om.daily.sunset = Array(7).fill('2026-05-19T18:00');
    stubFetchWith({ openMeteo: () => makeResponse(om), met: () => makeResponse(validMet) });
    const fresh = await callHandler();
    expect(fresh.body.now.isDay).toBe(false);
    expect(fresh.body.now.uv).toBeNull();
    // …and the cache hit re-derives the same answer from the cached solar strings.
    const written = JSON.parse(JSON.stringify(weatherCacheSetDeferred.mock.calls[0][1]));
    weatherCacheGet.mockResolvedValue(written);
    stubFetchWith({ openMeteo: () => { throw new Error('must not fetch'); }, met: () => { throw new Error('must not fetch'); } });
    expect((await callHandler()).body.now.isDay).toBe(false);
    // Unparseable strings at the same instant: the fallback says day, honestly labelled by the hour rule.
    const bad = validOpenMeteo();
    bad.daily.sunrise = Array(7).fill('bad'); bad.daily.sunset = Array(7).fill('bad');
    weatherCacheGet.mockResolvedValue(null);
    stubFetchWith({ openMeteo: () => makeResponse(bad), met: () => makeResponse(validMet) });
    expect((await callHandler()).body.now.isDay).toBe(true);
  });
});

describe('item 5 — round 7: the complete WeatherAPI code list, raw-fraction bounds, real solar timestamps, one daylight rule', () => {
  beforeEach(() => { process.env.WEATHERAPI_KEY = 'wa-key'; process.env.PIRATE_WEATHER_KEY = 'pw-key'; });
  afterEach(() => { delete process.env.WEATHERAPI_KEY; delete process.env.PIRATE_WEATHER_KEY; });

  const WA_CODES = [1000, 1003, 1006, 1009, 1012, 1015, 1018, 1021, 1024, 1027, 1030, 1033, 1036, 1039, 1042, 1045, 1048, 1063, 1066, 1069,
    1072, 1087, 1114, 1117, 1135, 1147, 1150, 1153, 1168, 1171, 1180, 1183, 1186, 1189, 1192, 1195, 1198, 1201, 1204, 1207, 1210, 1213, 1216,
    1219, 1222, 1225, 1237, 1240, 1243, 1246, 1249, 1252, 1255, 1258, 1261, 1264, 1273, 1276, 1279, 1282];

  it('WeatherAPI 1012 (Haze) alone is a forecast (regression: the 48-code map made it 503)', async () => {
    stubFive({ weatherApi: () => makeResponse(validWeatherApi({ current: { condition: { code: 1012, text: 'Haze' } } })) });
    const { statusCode, body } = await callHandler();
    expect(statusCode).toBe(200);
    expect(body.now.conditionLabel).toBe('Haze');
  });

  it('every one of the 60 published WeatherAPI codes, alone, is a forecast; the gaps between them are not', async () => {
    for (const code of WA_CODES) {
      weatherCacheSetDeferred.mockClear();
      stubFive({ weatherApi: () => makeResponse(validWeatherApi({ current: { condition: { code, text: 'x' } } })) });
      const { statusCode } = await callHandler();
      expect(statusCode, String(code)).toBe(200);
    }
    for (const code of [999, 1001, 1013, 1050, 1283, 1300]) {
      stubFive({ weatherApi: () => makeResponse(validWeatherApi({ current: { condition: { code, text: 'Sunny' } } })) });
      expect((await callHandler()).statusCode, String(code)).toBe(503);
    }
    expect(WA_CODES).toHaveLength(60);
  });

  it('Pirate precipProbability -0.001 is no signal, not 0%: Open-Meteo\'s 60% stands', async () => {
    const wet = validOpenMeteo({ hourly: { precipitation_probability: Array(48).fill(60) } });
    wet.daily.precipitation_probability_max = Array(7).fill(60);
    const pirate = validPirate();
    for (const d of pirate.daily.data) d.precipProbability = -0.001;
    stubFive({ openMeteo: () => makeResponse(wet), pirate: () => makeResponse(pirate) });
    const { body } = await callHandler();
    expect(body.meta.sources.find(s => s.name === 'Pirate Weather')).toEqual({ name: 'Pirate Weather', ok: true });
    expect(body.daily[0].rainChance).toBe(60);
    // Control: a real 0 fraction blends down.
    for (const d of pirate.daily.data) d.precipProbability = 0;
    stubFive({ openMeteo: () => makeResponse(wet), pirate: () => makeResponse(pirate) });
    expect((await callHandler()).body.daily[0].rainChance).toBeLessThan(60);
  });

  it('Pirate humidity -0.004 (rounds to 0) and cloudCover 1.004 (rounds to 100) are dropped before rounding', async () => {
    const pirate = validPirate({ currently: { humidity: -0.004 } });
    for (const d of pirate.daily.data) d.cloudCover = 1.004;
    stubFive({ openMeteo: () => makeResponse(validOpenMeteo()), pirate: () => makeResponse(pirate) });
    const { body } = await callHandler();
    expect(body.meta.sources.find(s => s.name === 'Pirate Weather')).toEqual({ name: 'Pirate Weather', ok: true });
    expect(body.now.humidity).toBe(50);          // Open-Meteo's 50 alone — a rounded 0 would have blended to ~30
    expect(body.daily[3].conditionSignals.numeric.cloudPct).toBeNull(); // Pirate is the only daily-cloud source for days 2–6
    // Control: a boundary-valid 0.996 → 100% does reach the blend.
    for (const d of pirate.daily.data) d.cloudCover = 0.996;
    stubFive({ openMeteo: () => makeResponse(validOpenMeteo()), pirate: () => makeResponse(pirate) });
    expect((await callHandler()).body.daily[3].conditionSignals.numeric.cloudPct).toBe(100);
  });

  it('Open-Meteo sunrise "0" / sunset "9999" at 23:30 SAST: not solar values — night, no UV, fresh and on the hit', async () => {
    vi.setSystemTime(new Date('2026-05-19T21:30:00Z'));
    const om = validOpenMeteo();
    om.daily.sunrise = Array(7).fill('0');
    om.daily.sunset = Array(7).fill('9999');
    stubFetchWith({ openMeteo: () => makeResponse(om), met: () => makeResponse(validMet) });
    const fresh = await callHandler();
    expect(fresh.body.now.isDay).toBe(false);
    expect(fresh.body.now.uv).toBeNull();
    expect(fresh.body.now.sunrise).toBeNull();
    const written = JSON.parse(JSON.stringify(weatherCacheSetDeferred.mock.calls[0][1]));
    weatherCacheGet.mockResolvedValue(written);
    stubFetchWith({ openMeteo: () => { throw new Error('must not fetch'); }, met: () => { throw new Error('must not fetch'); } });
    expect((await callHandler()).body.now.isDay).toBe(false);
  });

  it('an ISO solar string from another week is not today\'s sunrise either', async () => {
    vi.setSystemTime(new Date('2026-05-19T21:30:00Z'));
    const om = validOpenMeteo();
    om.daily.sunrise = Array(7).fill('2026-05-01T06:00');
    om.daily.sunset = Array(7).fill('2026-05-01T23:59');
    stubFetchWith({ openMeteo: () => makeResponse(om), met: () => makeResponse(validMet) });
    const { body } = await callHandler();
    expect(body.now.isDay).toBe(false);
    expect(body.now.sunrise).toBeNull();
  });

  it('Pirate alone at 18:30 SAST with sunrise 06:00 / sunset 18:00: fresh says night, and so does the immediate cache hit', async () => {
    vi.setSystemTime(new Date('2026-05-19T16:30:00Z')); // 18:30 SAST
    const dayStart = Date.UTC(2026, 4, 19, 0, 0, 0) / 1000 - 7200; // local midnight in unix seconds
    const pirate = validPirate();
    for (const d of pirate.daily.data) { d.sunriseTime = dayStart + 6 * 3600; d.sunsetTime = dayStart + 18 * 3600; }
    stubFive({ pirate: () => makeResponse(pirate) });
    const fresh = await callHandler();
    expect(fresh.statusCode).toBe(200);
    expect(fresh.body.now.sunrise).toBe('2026-05-19T06:00:00');
    expect(fresh.body.now.sunset).toBe('2026-05-19T18:00:00');
    expect(fresh.body.now.isDay).toBe(false);
    const written = JSON.parse(JSON.stringify(weatherCacheSetDeferred.mock.calls[0][1]));
    weatherCacheGet.mockResolvedValue(written);
    const fetchFn = stubFive({});
    const hit = await callHandler();
    expect(fetchFn).not.toHaveBeenCalled();
    expect(hit.body.meta.serverCache).toBe('hit');
    expect(hit.body.now.isDay).toBe(false);
  });

  it('WeatherAPI alone: its clock strings are shipped for display but daylight is the hour rule on both paths', async () => {
    vi.setSystemTime(new Date('2026-05-19T16:30:00Z')); // 18:30 SAST → hour rule says day
    stubFive({ weatherApi: () => makeResponse(validWeatherApi()) });
    const fresh = await callHandler();
    expect(fresh.body.now.sunrise).toBe('06:00 AM');
    expect(fresh.body.now.isDay).toBe(true);
    const written = JSON.parse(JSON.stringify(weatherCacheSetDeferred.mock.calls[0][1]));
    weatherCacheGet.mockResolvedValue(written);
    stubFive({});
    expect((await callHandler()).body.now.isDay).toBe(true);
    // A malformed clock string is dropped, not shipped.
    weatherCacheGet.mockResolvedValue(null);
    stubFive({ weatherApi: () => makeResponse(validWeatherApi({ forecastday: validWeatherApi().forecast.forecastday.map(fd => ({ ...fd, astro: { sunrise: '25:99', sunset: 12 } })) })) });
    expect((await callHandler()).body.now.sunrise).toBeNull();
  });
});

describe('item 5 — round 8: schema 4, coherent solar pairs, raw wind bounds', () => {
  beforeEach(() => { process.env.PIRATE_WEATHER_KEY = 'pw-key'; process.env.TOMORROWIO_API_KEY = 'ti-key'; });
  afterEach(() => { delete process.env.PIRATE_WEATHER_KEY; delete process.env.TOMORROWIO_API_KEY; });

  it('an entry written under a previous contract (schema 4) is a MISS, hit path and stale path alike', async () => {
    expect(PAYLOAD_SCHEMA).toBe(5);
    stubFetchWith({ openMeteo: () => makeResponse(validOpenMeteo()), met: () => makeResponse(validMet) });
    await callHandler();
    const entry = JSON.parse(JSON.stringify(weatherCacheSetDeferred.mock.calls[0][1]));
    weatherCacheSetDeferred.mockClear();
    entry.meta.schema = 4;
    entry.now.sunrise = '0'; entry.now.sunset = '9999'; // what an intermediate contract could have written
    weatherCacheGet.mockResolvedValue(entry);
    const fetchFn = stubFetchWith({ openMeteo: () => makeResponse(validOpenMeteo()), met: () => makeResponse(validMet) });
    const hit = await callHandler();
    expect(fetchFn).toHaveBeenCalled();
    expect(hit.body.meta.serverCache).toBe('miss');
    weatherCacheGet.mockResolvedValue(null);
    weatherCacheAcquireLock.mockResolvedValue({ acquired: false, release: async () => {} });
    weatherCacheGetStale.mockResolvedValue(entry);
    const never = stubFetchWith({ openMeteo: () => { throw new Error('no'); }, met: () => { throw new Error('no'); } });
    const stale = await callHandler();
    expect(never).not.toHaveBeenCalled();
    expect(stale.statusCode).toBe(503);
  });

  it('the client and the service worker refuse schema 4 too', () => {
    const app = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
    const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
    expect(app).toMatch(/const PAYLOAD_SCHEMA_MIN = 5;/);
    expect(sw).toMatch(/const WEATHER_PAYLOAD_SCHEMA_MIN = 5;/);
  });

  it('Open-Meteo sunrise 06:00 alone + Pirate sunset 18:00 alone never combine: no pair shipped, hour rule fresh AND on the hit', async () => {
    vi.setSystemTime(new Date('2026-05-19T16:30:00Z')); // 18:30 SAST → hour rule says day
    const om = validOpenMeteo();
    om.daily.sunset = Array(7).fill('bad');
    const pirate = validPirate();
    for (const d of pirate.daily.data) { d.sunriseTime = undefined; }
    stubFive({ openMeteo: () => makeResponse(om), pirate: () => makeResponse(pirate) });
    const fresh = await callHandler();
    expect(fresh.statusCode).toBe(200);
    expect(fresh.body.now.sunrise).toBeNull();
    expect(fresh.body.now.sunset).toBeNull();
    expect(fresh.body.now.isDay).toBe(true);
    const written = JSON.parse(JSON.stringify(weatherCacheSetDeferred.mock.calls[0][1]));
    weatherCacheGet.mockResolvedValue(written);
    const fetchFn = stubFive({});
    const hit = await callHandler();
    expect(fetchFn).not.toHaveBeenCalled();
    expect(hit.body.now.isDay).toBe(true);
  });

  it('a pair from two different days, or out of order, or with an impossible gap, is voided as a pair', async () => {
    vi.setSystemTime(new Date('2026-05-19T21:30:00Z')); // 23:30 SAST
    const cases = [
      ['2026-05-18T06:00', '2026-05-20T18:00'],
      ['2026-05-19T18:00', '2026-05-19T06:00'],
      ['2026-05-19T06:00', '2026-05-19T07:00'],
      ['2026-05-19T06:00:99', '2026-05-19T18:00'],
      ['2026-05-19T00:30', '2026-05-19T23:59:59'],
    ];
    for (const [sr, ss] of cases) {
      weatherCacheSetDeferred.mockClear();
      const om = validOpenMeteo();
      om.daily.sunrise = Array(7).fill(sr);
      om.daily.sunset = Array(7).fill(ss);
      stubFetchWith({ openMeteo: () => makeResponse(om), met: () => makeResponse(validMet) });
      const { body } = await callHandler();
      expect(body.now.sunrise, sr + ' / ' + ss).toBeNull();
      expect(body.now.isDay, sr + ' / ' + ss).toBe(false);
      expect(body.now.uv, sr + ' / ' + ss).toBeNull();
    }
    // Control: the real pair for the day is kept, with seconds.
    const om = validOpenMeteo();
    om.daily.sunrise = Array(7).fill('2026-05-19T06:12:30');
    om.daily.sunset = Array(7).fill('2026-05-19T17:48:05');
    stubFetchWith({ openMeteo: () => makeResponse(om), met: () => makeResponse(validMet) });
    expect((await callHandler()).body.now.sunrise).toBe('2026-05-19T06:12:30');
  });

  it('Pirate daily windSpeed -0.001 is no wind reading: Open-Meteo\'s 30 km/h day-2 wind stands and the day stays windy', async () => {
    const om = validOpenMeteo();
    om.daily.wind_speed_10m_max = Array(7).fill(30);
    const pirate = validPirate();
    for (const d of pirate.daily.data) d.windSpeed = -0.001;
    stubFive({ openMeteo: () => makeResponse(om), pirate: () => makeResponse(pirate) });
    const { body } = await callHandler();
    expect(body.meta.sources.find(s => s.name === 'Pirate Weather')).toEqual({ name: 'Pirate Weather', ok: true });
    expect(body.daily[2].conditionSignals.numeric.windKph).toBe(30);
    expect(body.daily[2].conditionKey).toBe('wind');
    // Control: a real 0 m/s blends down and the day is no longer windy.
    for (const d of pirate.daily.data) d.windSpeed = 0;
    stubFive({ openMeteo: () => makeResponse(om), pirate: () => makeResponse(pirate) });
    const control = (await callHandler()).body;
    expect(control.daily[2].conditionSignals.numeric.windKph).toBeLessThan(30);
    expect(control.daily[2].conditionKey).not.toBe('wind');
  });

  it('MET and Tomorrow.io: a -0.001 m/s wind in ONE future hour is no reading for that hour, while both sources stay admitted', async () => {
    // Current wind stays valid (3 / 4 m/s); only local hour 14 is corrupted.
    const metNeg = { properties: { timeseries: validMet.properties.timeseries.map((p, i) => { const q = JSON.parse(JSON.stringify(p)); if (i === 14) q.data.instant.details.wind_speed = -0.001; return q; }) } };
    const ti = validTomorrowIo();
    for (const iv of ti.data.timelines[0].intervals) { if (String(iv.startTime).startsWith('2026-05-19T12:00')) iv.values.windSpeed = -0.001; } // 14:00 SAST
    const om = validOpenMeteo({ hourly: { wind_speed_10m: Array(48).fill(30) } });
    stubFive({ openMeteo: () => makeResponse(om), met: () => makeResponse(metNeg), tomorrow: () => makeResponse(ti) });
    const { body } = await callHandler();
    expect(body.meta.sources.find(s => s.name === 'MET Norway')).toEqual({ name: 'MET Norway', ok: true });
    expect(body.meta.sources.find(s => s.name === 'Tomorrow.io')).toEqual({ name: 'Tomorrow.io', ok: true });
    expect(body.hourly[14].windKph).toBe(30);        // Open-Meteo alone at 14:00 — the old conversions gave 18–20
    expect(body.hourly[13].windKph).toBeLessThan(30); // a neighbouring hour still blends MET's 10.8 and Tomorrow's 14.4 km/h
  });
});

describe('item 5 — round 9: every reading is bounded before it can reach a max/min aggregate', () => {
  beforeEach(() => { process.env.TOMORROWIO_API_KEY = 'ti-key'; });
  afterEach(() => { delete process.env.TOMORROWIO_API_KEY; });

  it('one Tomorrow.io precipitationProbability of 9999 does not erase its 80% day: the day blends to rain-possible, not 0%/uv, and the cache holds that', async () => {
    const ti = validTomorrowIo();
    for (const iv of ti.data.timelines[0].intervals) iv.values.precipitationProbability = 80;
    ti.data.timelines[0].intervals[5].values.precipitationProbability = 9999;
    stubFive({ openMeteo: () => makeResponse(validOpenMeteo()), tomorrow: () => makeResponse(ti) });
    const { statusCode, body } = await callHandler();
    expect(statusCode).toBe(200);
    expect(body.meta.sources.find(s => s.name === 'Tomorrow.io')).toEqual({ name: 'Tomorrow.io', ok: true });
    expect(body.daily[0].rainChance).toBeGreaterThan(20);
    expect(body.daily[0].conditionKey).not.toBe('uv');
    const written = weatherCacheSetDeferred.mock.calls[0]?.[1];
    expect(written.daily[0].rainChance).toBe(body.daily[0].rainChance);
    // Invalid ≡ absent: the same day with that interval's probability missing gives the same answer.
    weatherCacheSetDeferred.mockClear();
    delete ti.data.timelines[0].intervals[5].values.precipitationProbability;
    stubFive({ openMeteo: () => makeResponse(validOpenMeteo()), tomorrow: () => makeResponse(ti) });
    expect((await callHandler()).body.daily[0].rainChance).toBe(body.daily[0].rainChance);
  });

  it('one MET air_temperature of 9999 in the day does not become the high: the high comes from the valid hours', async () => {
    const met = { properties: { timeseries: validMet.properties.timeseries.map((p, i) => { const q = JSON.parse(JSON.stringify(p)); q.data.instant.details.air_temperature = 18 + (i % 24 === 14 ? 6 : 0); if (i === 20) q.data.instant.details.air_temperature = 9999; return q; }) } };
    stubFive({ met: () => makeResponse(met) });
    const { statusCode, body } = await callHandler();
    expect(statusCode).toBe(200);
    expect(body.daily[0].highC).toBe(24);
    expect(JSON.stringify(body)).not.toContain('9999');
  });

  it('one Tomorrow.io temperature of -9999 does not become the low', async () => {
    const ti = validTomorrowIo();
    ti.data.timelines[0].intervals[3].values.temperature = -9999;
    stubFive({ tomorrow: () => makeResponse(ti) });
    const { statusCode, body } = await callHandler();
    expect(statusCode).toBe(200);
    expect(body.daily[0].lowC).toBe(18);
  });
});

describe('item 5 — round 10: an entry written under the previous contract carries a malformed aggregate and is refused everywhere', () => {
  beforeEach(() => { process.env.TOMORROWIO_API_KEY = 'ti-key'; });
  afterEach(() => { delete process.env.TOMORROWIO_API_KEY; });

  const wetTi = () => {
    const ti = validTomorrowIo();
    for (const iv of ti.data.timelines[0].intervals) iv.values.precipitationProbability = 80;
    ti.data.timelines[0].intervals[5].values.precipitationProbability = 9999;
    return ti;
  };
  // What the parent contract (schema 4) wrote for this fixture: the day at 0% / uv.
  const parentEntry = async () => {
    stubFive({ openMeteo: () => makeResponse(validOpenMeteo()), tomorrow: () => makeResponse(wetTi()) });
    await callHandler();
    const entry = JSON.parse(JSON.stringify(weatherCacheSetDeferred.mock.calls[0][1]));
    weatherCacheSetDeferred.mockClear();
    entry.meta.schema = 4;
    entry.daily[0].rainChance = 0;
    entry.daily[0].conditionKey = 'uv';
    return entry;
  };

  it('fresh HEAD: the day is rain-possible, and its own cache hit replays exactly that', async () => {
    stubFive({ openMeteo: () => makeResponse(validOpenMeteo()), tomorrow: () => makeResponse(wetTi()) });
    const fresh = await callHandler();
    expect(fresh.body.daily[0].rainChance).toBeGreaterThan(20);
    expect(fresh.body.daily[0].conditionKey).toBe('rain-possible');
    const written = JSON.parse(JSON.stringify(weatherCacheSetDeferred.mock.calls[0][1]));
    expect(written.meta.schema).toBe(PAYLOAD_SCHEMA);
    weatherCacheGet.mockResolvedValue(written);
    const fetchFn = stubFive({});
    const hit = await callHandler();
    expect(fetchFn).not.toHaveBeenCalled();
    expect(hit.body.meta.serverCache).toBe('hit');
    expect(hit.body.daily[0].rainChance).toBe(fresh.body.daily[0].rainChance);
    expect(hit.body.daily[0].conditionKey).toBe('rain-possible');
  });

  it('the parent-contract entry is a MISS on the fresh path: fetched again, the day comes back rain-possible', async () => {
    const entry = await parentEntry();
    weatherCacheGet.mockResolvedValue(entry);
    const fetchFn = stubFive({ openMeteo: () => makeResponse(validOpenMeteo()), tomorrow: () => makeResponse(wetTi()) });
    const { body } = await callHandler();
    expect(fetchFn).toHaveBeenCalled();
    expect(body.meta.serverCache).toBe('miss');
    expect(body.daily[0].conditionKey).toBe('rain-possible');
  });

  it('the parent-contract entry is refused as a stale value too', async () => {
    const entry = await parentEntry();
    weatherCacheGet.mockResolvedValue(null);
    weatherCacheAcquireLock.mockResolvedValue({ acquired: false, release: async () => {} });
    weatherCacheGetStale.mockResolvedValue(entry);
    waitForWeatherCache.mockResolvedValue(null);
    const never = stubFive({});
    const { statusCode, body } = await callHandler();
    expect(never).not.toHaveBeenCalled();
    expect(statusCode).toBe(503);
    expect(JSON.stringify(body)).not.toContain('"uv"');
  });
});
