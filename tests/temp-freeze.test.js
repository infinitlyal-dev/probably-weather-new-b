// TEMPERATURES MUST NOT MOVE (review/accuracy/v6/PLAN.md §3, 28 Sept 2026). A fixed set of recorded provider
// responses (tests/fixtures/temp-freeze.json, made by review/accuracy/v6/make-temp-fixture.mjs — Open-Meteo and MET
// Norway verbatim; WeatherAPI, Pirate Weather and Tomorrow.io built from the recorder's readings of those sources) is
// played through the handler with the clock frozen. The current temperature, feels-like, every hourly temperature and
// feels-like and every daily high and low must equal the golden numbers the code produced BEFORE the v6 wind change
// (tests/fixtures/temp-freeze-golden.json), exactly. One moved number fails the build.
//
// Writing the golden (only ever before a change, never in the gate): TEMP_FREEZE_WRITE=1 npx vitest run tests/temp-freeze.test.js
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

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

const FIXTURE = new URL('./fixtures/temp-freeze.json', import.meta.url);
const GOLDEN = new URL('./fixtures/temp-freeze-golden.json', import.meta.url);
const { cases } = JSON.parse(readFileSync(FIXTURE, 'utf8'));
const WRITE = process.env.TEMP_FREEZE_WRITE === '1';

const ok = (body) => ({ ok: true, status: 200, json: async () => structuredClone(body) });
function stubFor(c) {
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    const href = String(url);
    if (href.includes('open-meteo.com/')) return ok(href.includes('models=') ? c.responses.precision : c.responses.openMeteo);
    if (href.includes('api.weatherapi.com/')) return ok(c.responses.weatherApi);
    if (href.includes('api.pirateweather.net/')) return ok(c.responses.pirate);
    if (href.startsWith('https://api.met.no/')) return ok(c.responses.met);
    if (href.startsWith('https://api.tomorrow.io/')) return ok(c.responses.tomorrow);
    throw new Error(`Unexpected URL: ${href}`);
  }));
}
async function run(c) {
  stubFor(c);
  vi.setSystemTime(new Date(c.nowUtc));
  let body;
  const res = { setHeader: vi.fn(), status() { return this; }, json(p) { body = p; return this; } };
  await handler({ query: { lat: String(c.lat), lon: String(c.lon) } }, res);
  return body;
}
const temps = (b) => ({
  nowTempC: b.now.tempC,
  nowFeelsLikeC: b.now.feelsLikeC,
  hourlyTempC: b.hourly.map((h) => h.tempC),
  hourlyFeelsLikeC: b.hourly.map((h) => h.feelsLikeC),
  dailyHighC: b.daily.map((d) => d.highC),
  dailyLowC: b.daily.map((d) => d.lowC),
});

beforeEach(() => {
  vi.useFakeTimers();
  process.env.WEATHERAPI_KEY = 'fixture';
  process.env.PIRATE_WEATHER_KEY = 'fixture';
  process.env.TOMORROWIO_API_KEY = 'fixture';
  process.env.OPEN_METEO_API_KEY = 'fixture';   // the customer host path, so the precision request runs as in production
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  for (const k of ['WEATHERAPI_KEY', 'PIRATE_WEATHER_KEY', 'TOMORROWIO_API_KEY', 'OPEN_METEO_API_KEY']) delete process.env[k];
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('temperatures do not move', () => {
  it('every case answers from all five sources and the precision request', async () => {
    for (const c of cases) {
      const b = await run(c);
      expect(b.ok, c.place).toBe(true);
      expect(b.meta.sources.filter((s) => s.ok).map((s) => s.name).sort(), c.place).toEqual(['MET Norway', 'Open-Meteo', 'Pirate Weather', 'Tomorrow.io', 'WeatherAPI']);
      expect(b.meta.precision.status, c.place).toBe('applied');
    }
  });

  it('now, feels-like, every hour and every day equal the golden numbers exactly', async () => {
    const got = {};
    for (const c of cases) got[`${c.place}|${c.nowUtc}`] = temps(await run(c));
    if (WRITE) { writeFileSync(GOLDEN, JSON.stringify(got, null, 1)); return; }
    expect(existsSync(GOLDEN), 'golden missing — it is written once, before a change').toBe(true);
    expect(got).toEqual(JSON.parse(readFileSync(GOLDEN, 'utf8')));
  });

  it('the fixture is not blind to wind: its places are served different winds by different rules', async () => {
    const winds = [], rules = new Set();
    for (const c of cases) { const b = await run(c); winds.push(b.now.windKph); rules.add(b.meta.wind?.rule); }
    expect(new Set(winds).size).toBeGreaterThan(2);
    expect(rules.size).toBeGreaterThan(1);
  });
});
