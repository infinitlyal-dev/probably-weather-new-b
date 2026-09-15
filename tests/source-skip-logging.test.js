// What the budget guard skips is logged and handled as a skip (2026-09-15).
//
// 1. The production runtime error table was topped by 14 groups of
//    "[pw-source-fail] Tomorrow.io network Provider unavailable (no key or
//    budget-blocked)". All were budget skips: the Tomorrow.io block only reaches
//    getSettledValue inside its own key check. They now log as [pw-source-skip]
//    at warn; a real upstream failure still logs [pw-source-fail] at error.
// 2. Both LocationIQ calls inside the weather handler (the name lookup and
//    ?reverse=1) spend the same global 'locationiq' budget as /api/geocode; a
//    refused slot never reaches LocationIQ.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const budget = vi.hoisted(() => ({ denied: new Set() }));

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

vi.mock('../api/_lib/provider-budget.js', async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    consumeProviderBudgets: vi.fn(async (providers) => Object.fromEntries(providers.map((p) => [p, !budget.denied.has(p)]))),
  };
});

import handler from '../api/weather.js';

const makeResponse = (payload, status = 200) => ({ ok: status >= 200 && status < 300, status, json: vi.fn(async () => payload) });

const openMeteo = {
  utc_offset_seconds: 7200,
  current: { temperature_2m: 18, apparent_temperature: 18, weather_code: 0, wind_speed_10m: 10, wind_gusts_10m: 12, relative_humidity_2m: 50, cloud_cover: 10 },
  hourly: {
    temperature_2m: Array(48).fill(18), apparent_temperature: Array(48).fill(18), precipitation_probability: Array(48).fill(0),
    precipitation: Array(48).fill(0), wind_speed_10m: Array(48).fill(10), wind_gusts_10m: Array(48).fill(12), cloud_cover: Array(48).fill(10),
    relative_humidity_2m: Array(48).fill(50), uv_index: Array(48).fill(4), weather_code: Array(48).fill(0),
    visibility: Array(48).fill(20000), dew_point_2m: Array(48).fill(8),
  },
  daily: {
    temperature_2m_max: Array(7).fill(24), temperature_2m_min: Array(7).fill(12), precipitation_probability_max: Array(7).fill(0),
    uv_index_max: Array(7).fill(6), weather_code: Array(7).fill(0), sunrise: Array(7).fill('2026-05-19T06:00'), sunset: Array(7).fill('2026-05-19T18:00'),
  },
};

const met = {
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

const callHandler = async (query = { lat: '-34.1163', lon: '18.8362' }) => {
  let body;
  let statusCode = 200;
  const res = { setHeader: vi.fn(), status(code) { statusCode = code; return this; }, json(p) { body = p; return this; } };
  await handler({ query }, res);
  return { body, statusCode };
};

let fetched;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-19T08:30:00Z'));
  budget.denied.clear();
  fetched = [];
  process.env.TOMORROWIO_API_KEY = 'ti-key';
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    const href = String(url);
    fetched.push(href);
    if (href.includes('open-meteo.com/')) return makeResponse(openMeteo);
    if (href.startsWith('https://api.met.no/')) return makeResponse(met);
    if (href.includes('api.tomorrow.io/')) return makeResponse({ error: 'down' }, 503);
    if (href.includes('locationiq.com/')) return makeResponse({ address: { town: 'Strand', state: 'Western Cape', country_code: 'za' } });
    throw new Error(`Unexpected URL: ${href}`);
  }));
});

afterEach(() => {
  delete process.env.TOMORROWIO_API_KEY;
  delete process.env.LOCATIONIQ_TOKEN;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const linesFrom = (spy) => spy.mock.calls.map((args) => args.map(String).join(' '));
const hits = (host) => fetched.filter((u) => u.includes(host)).length;

describe('budget skips log as skips, real failures as failures', () => {
  it('a budget-blocked Tomorrow.io is [pw-source-skip] at warn — no error line, no fetch', async () => {
    budget.denied.add('tomorrow');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { body } = await callHandler();

    expect(hits('api.tomorrow.io')).toBe(0);
    expect(linesFrom(warn)).toContain('[pw-source-skip] Tomorrow.io budget-blocked');
    expect(linesFrom(error).filter((l) => l.includes('Tomorrow.io'))).toEqual([]);
    expect(body.meta.sources.find((s) => s.name === 'Tomorrow.io')).toEqual({ name: 'Tomorrow.io', ok: false });
  });

  it('a Tomorrow.io that answers 503 is still [pw-source-fail] at error', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await callHandler();

    expect(hits('api.tomorrow.io')).toBe(1);
    expect(linesFrom(error).some((l) => l.startsWith('[pw-source-fail] Tomorrow.io'))).toBe(true);
    expect(linesFrom(warn).some((l) => l.startsWith('[pw-source-skip]'))).toBe(false);
  });
});

describe('the weather handler spends the LocationIQ budget before calling LocationIQ', () => {
  beforeEach(() => { process.env.LOCATIONIQ_TOKEN = 'liq-token'; });

  it('name lookup: a refused slot keeps the fallback name and never calls LocationIQ', async () => {
    budget.denied.add('locationiq');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { body } = await callHandler();

    expect(hits('locationiq.com')).toBe(0);
    expect(linesFrom(warn)).toContain('[pw-budget] locationiq over ceiling — name lookup skipped');
    expect(body.ok).toBe(true);
  });

  it('name lookup: a granted slot calls LocationIQ once', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { body } = await callHandler();

    expect(hits('locationiq.com')).toBe(1);
    expect(body.location.name).toBe('Strand, Western Cape');
  });

  it('?reverse=1: a refused slot answers ok:false without calling LocationIQ', async () => {
    budget.denied.add('locationiq');
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { body, statusCode } = await callHandler({ lat: '-34.1163', lon: '18.8362', reverse: '1' });

    expect(statusCode).toBe(200);
    expect(body).toEqual({ ok: false, city: null, admin1: null, countryCode: null, nearCity: null });
    expect(hits('locationiq.com')).toBe(0);
  });
});
