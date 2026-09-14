// Astra finding 1 (MAJOR) — the Open-Meteo monthly counter must never sit on
// the response path.
//
// The counter's Redis INCRBY was awaited inline, so a stalled Upstash stalled
// the forecast even when every provider had already answered (Astra measured
// >10 s with immediate providers). The count is advisory; the forecast is not.
//
// This lives in its own file because it mocks the counter module: the handler's
// VITEST bypass inside consumeProviderBudgets/recordOpenMeteoCall would
// otherwise hide the very stall under test. Replacing the deferred recorder
// with a promise that NEVER settles means any `await` of it in the handler
// deadlocks this test — which is exactly the regression we want to catch.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/_lib/provider-budget.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    // Never settles, and is never scheduled anywhere the handler can await.
    recordOpenMeteoCallDeferred: vi.fn(() => new Promise(() => {})),
  };
});

const { default: handler } = await import('../api/weather.js');
const { recordOpenMeteoCallDeferred } = await import('../api/_lib/provider-budget.js');

const TEST_KEY = 'om-live-key-stall-probe';
const makeResponse = (payload, status = 200) => ({
  ok: status >= 200 && status < 300, status, json: vi.fn(async () => payload),
});

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
    weather_code: Array(7).fill(0), wind_speed_10m_max: Array(7).fill(10),
    sunrise: Array(7).fill('2026-05-19T06:00'), sunset: Array(7).fill('2026-05-19T18:00'),
  },
};
const metPayload = {
  properties: { timeseries: Array.from({ length: 48 }, (_, i) => ({
    time: new Date(Date.UTC(2026, 4, 18, 22 + i, 0, 0)).toISOString(),
    data: { instant: { details: { air_temperature: 18, wind_speed: 3, relative_humidity: 50, cloud_area_fraction: 10 } }, next_1_hours: { summary: { symbol_code: 'clearsky_day' }, details: { precipitation_amount: 0 } } },
  })) },
};

// Every provider answers immediately — the ONLY slow thing in the request is
// the counter, so any delay in the response is attributable to it.
const fetchStub = vi.fn(async (url) => {
  const href = String(url);
  if (href.includes('open-meteo.com/')) return makeResponse(openMeteoPayload);
  if (href.startsWith('https://api.met.no/')) return makeResponse(metPayload);
  throw new Error(`Unexpected URL: ${href}`);
});

const callHandler = async () => {
  let statusCode = 200, body;
  const req = { query: { lat: '-34.1163', lon: '18.8362', name: 'Strand' } };
  const res = { setHeader: vi.fn(), status(c) { statusCode = c; return this; }, json(p) { body = p; return this; } };
  await handler(req, res);
  return { statusCode, body };
};

beforeEach(() => {
  process.env.OPEN_METEO_API_KEY = TEST_KEY;
  vi.stubGlobal('fetch', fetchStub);
});
afterEach(() => {
  delete process.env.OPEN_METEO_API_KEY;
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('a stalled monthly counter does not delay the forecast', () => {
  it('returns a complete 200 while the counter is still outstanding', async () => {
    // If the handler awaits the counter, this call never resolves and the test
    // fails on timeout rather than on an assertion.
    const { statusCode, body } = await callHandler();

    expect(statusCode).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.now).toBeDefined();
    expect(body.daily).toHaveLength(7);
    expect(recordOpenMeteoCallDeferred).toHaveBeenCalledTimes(1);
  }, 5000); // well under the >10 s stall Astra measured

  it('does not count at all on the free endpoint — no key, no commercial spend', async () => {
    delete process.env.OPEN_METEO_API_KEY;
    const { statusCode, body } = await callHandler();
    expect(statusCode).toBe(200);
    expect(body.meta.openMeteoEndpoint).toBe('free');
    expect(recordOpenMeteoCallDeferred).not.toHaveBeenCalled();
  });
});
