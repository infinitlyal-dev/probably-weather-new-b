// Prelaunch item 2 — Open-Meteo commercial endpoint (API Standard, 1M/month).
//
// Al subscribed to Open-Meteo API Standard. The commercial licence is only
// actually in force on the `customer-` prefixed host with `&apikey=`; the same
// key sent to the public host is ignored and we stay on free-tier terms and
// free-tier servers. These tests pin:
//   · the host/key switch in both directions, and meta.openMeteoEndpoint so
//     production can be confirmed from the live API after deploy;
//   · that the key never escapes into the payload, the logs, or the client;
//   · that the free-tier 600/min + 10k/day ceilings apply ONLY without a key
//     (under the commercial plan they would throttle traffic Open-Meteo
//     itself does not throttle);
//   · the advisory monthly counter, which is denominated in CALL UNITS (2.9
//     per request) because the plan is — counting requests would put the 80%
//     alert ~2.9x too late in billing terms.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/_lib/weather-cache.js', async (importOriginal) => {
  const mod = await importOriginal();
  return { ...mod, weatherCacheGet: vi.fn(mod.weatherCacheGet) };
});

import handler, { PAYLOAD_SCHEMA, deriveCondition } from '../api/weather.js';
import { weatherCacheGet } from '../api/_lib/weather-cache.js';
import {
  PROVIDER_BUDGETS,
  OPEN_METEO_UNITS_PER_REQUEST,
  openMeteoBudget,
  recordOpenMeteoCall,
  recordOpenMeteoCallDeferred,
  _resetOpenMeteoMonthly,
} from '../api/_lib/provider-budget.js';

const TEST_KEY = 'om-live-key-0d41d8cd98f00b204e9800998ecf8427';
const ROOT = fileURLToPath(new URL('..', import.meta.url));

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

// Records every URL the handler fetched so the endpoint switch is observable.
let fetchedUrls = [];
const fetchStub = vi.fn(async (url) => {
  const href = String(url);
  fetchedUrls.push(href);
  if (href.includes('open-meteo.com/')) return makeResponse(openMeteoPayload);
  if (href.startsWith('https://api.met.no/')) return makeResponse(metPayload);
  throw new Error(`Unexpected URL: ${href}`);
});
const openMeteoUrl = () => fetchedUrls.find((u) => u.includes('open-meteo.com/'));

// Captures everything written to the console during a request, as one string.
let consoleOutput = [];
const captureConsole = () => {
  for (const level of ['log', 'warn', 'error', 'info', 'debug']) {
    vi.spyOn(console, level).mockImplementation((...args) => {
      consoleOutput.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    });
  }
};

const callHandler = async () => {
  let statusCode = 200, body;
  const req = { query: { lat: '-34.1163', lon: '18.8362', name: 'Strand' } };
  const res = { setHeader: vi.fn(), status(c) { statusCode = c; return this; }, json(p) { body = p; return this; } };
  await handler(req, res);
  return { statusCode, body };
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-19T08:30:00Z'));
  fetchedUrls = [];
  consoleOutput = [];
  delete process.env.OPEN_METEO_API_KEY;
  vi.stubGlobal('fetch', fetchStub);
  _resetOpenMeteoMonthly();
});
afterEach(() => {
  delete process.env.OPEN_METEO_API_KEY;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('(a) with OPEN_METEO_API_KEY — the commercial customer endpoint', () => {
  it('fetches customer-api.open-meteo.com with apikey= and reports meta.openMeteoEndpoint "customer"', async () => {
    process.env.OPEN_METEO_API_KEY = TEST_KEY;
    const { body } = await callHandler();
    const url = openMeteoUrl();
    expect(url, 'no Open-Meteo request was issued').toBeDefined();
    expect(url.startsWith('https://customer-api.open-meteo.com/v1/forecast?')).toBe(true);
    expect(url).toContain(`&apikey=${TEST_KEY}`);
    expect(body.ok).toBe(true);
    expect(body.meta.openMeteoEndpoint).toBe('customer');
  });

  it('logs no free-endpoint warning when the key is present', async () => {
    process.env.OPEN_METEO_API_KEY = TEST_KEY;
    captureConsole();
    await callHandler();
    expect(consoleOutput.join('\n')).not.toContain('[pw-open-meteo]');
  });

  // Astra finding 4: a configured endpoint is not a working one.
  it('reports openMeteoStatus "ok" when the customer endpoint answered and validated', async () => {
    process.env.OPEN_METEO_API_KEY = TEST_KEY;
    const { body } = await callHandler();
    expect(body.meta.openMeteoEndpoint).toBe('customer');
    expect(body.meta.openMeteoStatus).toBe('ok');
  });

  it('reports endpoint "customer" but status "failed" on a 401 — a bad key cannot read as success', async () => {
    process.env.OPEN_METEO_API_KEY = TEST_KEY;
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const href = String(url);
      fetchedUrls.push(href);
      if (href.includes('open-meteo.com/')) return makeResponse({}, 401);
      if (href.startsWith('https://api.met.no/')) return makeResponse(metPayload);
      throw new Error(`Unexpected URL: ${href}`);
    }));
    const { statusCode, body } = await callHandler();
    expect(statusCode).toBe(200);             // the other sources still carry it
    expect(body.ok).toBe(true);
    expect(body.meta.openMeteoEndpoint).toBe('customer');
    expect(body.meta.openMeteoStatus).toBe('failed');
  });
});

describe('(b) without OPEN_METEO_API_KEY — the free endpoint, loudly', () => {
  it('fetches api.open-meteo.com with no apikey and reports meta.openMeteoEndpoint "free"', async () => {
    const { body } = await callHandler();
    const url = openMeteoUrl();
    expect(url.startsWith('https://api.open-meteo.com/v1/forecast?')).toBe(true);
    expect(url).not.toContain('apikey');
    expect(body.meta.openMeteoEndpoint).toBe('free');
  });

  it('warns exactly once per request that the free endpoint is non-commercial terms', async () => {
    captureConsole();
    await callHandler();
    const warnings = consoleOutput.filter((line) => line.includes('[pw-open-meteo]'));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('OPEN_METEO_API_KEY absent');
    expect(warnings[0]).toContain('non-commercial terms');
  });
});

describe('(c) the key never leaks out of the request', () => {
  it('appears in neither the payload nor any console output', async () => {
    process.env.OPEN_METEO_API_KEY = TEST_KEY;
    captureConsole();
    const { body } = await callHandler();
    expect(JSON.stringify(body.meta)).not.toContain(TEST_KEY);
    expect(JSON.stringify(body)).not.toContain(TEST_KEY);
    expect(consoleOutput.join('\n')).not.toContain(TEST_KEY);
  });

  it('survives an Open-Meteo HTTP failure without the URL reaching the failure log', async () => {
    process.env.OPEN_METEO_API_KEY = TEST_KEY;
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const href = String(url);
      fetchedUrls.push(href);
      if (href.includes('open-meteo.com/')) return makeResponse({}, 401);
      if (href.startsWith('https://api.met.no/')) return makeResponse(metPayload);
      throw new Error(`Unexpected URL: ${href}`);
    }));
    captureConsole();
    await callHandler();
    const joined = consoleOutput.join('\n');
    expect(joined).toContain('[pw-source-fail] Open-Meteo');
    expect(joined).not.toContain(TEST_KEY);
    expect(joined).not.toContain('apikey');
  });
});

describe('(d) provider budget is a function of the env, not a constant', () => {
  it('with the key: no per-minute or per-day ceiling for Open-Meteo', () => {
    process.env.OPEN_METEO_API_KEY = TEST_KEY;
    expect(openMeteoBudget().perMin).toBeUndefined();
    expect(openMeteoBudget().perDay).toBeUndefined();
    expect(PROVIDER_BUDGETS['open-meteo'].perMin).toBeUndefined();
    expect(PROVIDER_BUDGETS['open-meteo'].perDay).toBeUndefined();
  });

  it('without the key: the published free-tier 600/min and 10,000/day still apply', () => {
    expect(openMeteoBudget()).toEqual({ perMin: 600, perDay: 10000 });
    expect(PROVIDER_BUDGETS['open-meteo']).toEqual({ perMin: 600, perDay: 10000 });
  });

  it('the same imported binding flips when the env flips (not frozen at import)', () => {
    expect(PROVIDER_BUDGETS['open-meteo'].perMin).toBe(600);
    process.env.OPEN_METEO_API_KEY = TEST_KEY;
    expect(PROVIDER_BUDGETS['open-meteo'].perMin).toBeUndefined();
    delete process.env.OPEN_METEO_API_KEY;
    expect(PROVIDER_BUDGETS['open-meteo'].perMin).toBe(600);
  });

  it('the other providers keep their free-tier ceilings untouched', () => {
    process.env.OPEN_METEO_API_KEY = TEST_KEY;
    expect(PROVIDER_BUDGETS.pirate).toEqual({ perMin: 20, perDay: 600 });
    expect(PROVIDER_BUDGETS.tomorrow).toEqual({ perSecond: 3, perHour: 25, perDay: 500 });
  });
});

describe('(e) the advisory monthly counter counts UNITS, and alerts at 80%', () => {
  // The plan is denominated in call units, so the counter must be too — counting
  // requests would put the 80% alert ~2.9x too late in billing terms.
  // Redis stores integer TENTHS of a unit (INCRBY 29), so `seedUnits` below is
  // converted accordingly.
  const fakeRedis = (seedUnits = 0) => {
    const store = new Map();
    const seedTenths = Math.round(seedUnits * 10);
    return {
      store, expireCalls: [],
      async incrby(key, by) { const n = (store.get(key) ?? seedTenths) + by; store.set(key, n); return n; },
      async expire(key, ttl) { this.expireCalls.push([key, ttl]); return 1; },
    };
  };
  const JUNE = Date.UTC(2026, 5, 14, 12, 0, 0); // 2026-06-14 UTC
  const JUNE_KEY = 'pw-budget:open-meteo:month:2026-06';

  // Astra finding 5: derive the constant from the URL the handler actually
  // builds, so adding a variable to the request cannot silently invalidate it.
  it('derives 2.9 units from the REAL request URL (8 current + 13 hourly + 8 daily = 29, 7 days)', async () => {
    process.env.OPEN_METEO_API_KEY = TEST_KEY;
    await callHandler();
    const params = new URL(openMeteoUrl()).searchParams;

    const counts = {
      current: params.get('current').split(',').length,
      hourly: params.get('hourly').split(',').length,
      daily: params.get('daily').split(',').length,
    };
    expect(counts).toEqual({ current: 8, hourly: 13, daily: 8 });

    const variables = counts.current + counts.hourly + counts.daily;
    const days = Number(params.get('forecast_days'));
    expect(variables).toBe(29);
    expect(days).toBe(7);

    // Open-Meteo: units = max(1, variables/10) x max(1, days/14).
    const units = Math.max(1, variables / 10) * Math.max(1, days / 14);
    expect(units).toBeCloseTo(OPEN_METEO_UNITS_PER_REQUEST, 10);
    expect(OPEN_METEO_UNITS_PER_REQUEST).toBe(2.9);
  });

  it('increments by 2.9 units (29 tenths) and sets a ~40 day TTL on first write', async () => {
    const redis = fakeRedis();
    captureConsole();
    const units = await recordOpenMeteoCall(redis, JUNE);
    expect(units).toBe(2.9);
    expect(redis.store.get(JUNE_KEY)).toBe(29); // tenths of a unit, not requests
    expect(redis.expireCalls).toEqual([[JUNE_KEY, 40 * 86400]]);

    const second = await recordOpenMeteoCall(redis, JUNE);
    expect(second).toBeCloseTo(5.8, 10);
    expect(redis.store.get(JUNE_KEY)).toBe(58);
    expect(redis.expireCalls).toHaveLength(1); // TTL set once, on creation only
  });

  it('logs the routine usage line once per 1,000 UNITS (≈345 requests), not per call', async () => {
    // 998.2 units: the next 2.9 lands on 1001.1, crossing the 1,000-unit mark.
    const redis = fakeRedis(998.2);
    captureConsole();
    const lines = () => consoleOutput.filter((l) => l.includes('[pw-om-monthly]'));

    await recordOpenMeteoCall(redis, JUNE); // 1001.1 — crosses 1,000 → logs
    expect(lines()).toHaveLength(1);
    expect(lines()[0]).toContain('1001.1/1000000 units');
    expect(lines()[0]).toContain('(0.1%)');
    expect(lines()[0]).toContain('≈ 345 requests');

    // The next 100 calls stay inside the same 1,000-unit band → still one line.
    for (let i = 0; i < 100; i++) await recordOpenMeteoCall(redis, JUNE);
    expect(lines()).toHaveLength(1);
  });

  it('does NOT alert at 799,999.9 units and DOES alert at 800,000 (80% of 1,000,000)', async () => {
    captureConsole();
    // 799,997.0 + 2.9 = 799,999.9 — just under the threshold.
    const under = await recordOpenMeteoCall(fakeRedis(799_997.0), JUNE);
    expect(under).toBeCloseTo(799_999.9, 6);
    expect(consoleOutput.filter((l) => l.includes('[pw-om-alert]'))).toHaveLength(0);

    // 799,997.1 + 2.9 = 800,000.0 — exactly at the threshold.
    const at = await recordOpenMeteoCall(fakeRedis(799_997.1), JUNE);
    expect(at).toBeCloseTo(800_000, 6);
    const alerts = consoleOutput.filter((l) => l.includes('[pw-om-alert]'));
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toContain('80.0%');
    expect(alerts[0]).toContain('1,000,000 units');
  });

  it('alerts on EVERY call above the threshold, not once per band', async () => {
    const redis = fakeRedis(850_000);
    captureConsole();
    await recordOpenMeteoCall(redis, JUNE);
    await recordOpenMeteoCall(redis, JUNE);
    await recordOpenMeteoCall(redis, JUNE);
    expect(consoleOutput.filter((l) => l.includes('[pw-om-alert]'))).toHaveLength(3);
  });

  it('integer tenths keep the total exact over many increments (no float drift)', async () => {
    const redis = fakeRedis();
    captureConsole();
    let units;
    for (let i = 0; i < 1000; i++) units = await recordOpenMeteoCall(redis, JUNE);
    expect(redis.store.get(JUNE_KEY)).toBe(29_000); // exactly 1000 × 29 tenths
    expect(units).toBe(2900);                        // exactly 1000 × 2.9 units
  });

  it('never blocks or throws: Redis absent counts nothing and warns once per instance', async () => {
    captureConsole();
    expect(await recordOpenMeteoCall(null, JUNE)).toBeNull();
    expect(await recordOpenMeteoCall(null, JUNE)).toBeNull();
    expect(consoleOutput.filter((l) => l.includes('Redis unavailable'))).toHaveLength(1);
  });

  it('never blocks or throws: a throwing Redis returns null instead of failing the request', async () => {
    const broken = { async incrby() { throw new Error('redis down'); }, async expire() {} };
    await expect(recordOpenMeteoCall(broken, JUNE)).resolves.toBeNull();
  });

  // Astra finding 3: a rejected command silently disabled the 80% alert too.
  it('warns [pw-om-monthly] accounting failed when the Redis command rejects', async () => {
    const broken = { async incrby() { throw new Error('WRONGTYPE'); }, async expire() {} };
    captureConsole();
    await recordOpenMeteoCall(broken, JUNE);
    const lines = consoleOutput.filter((l) => l.includes('accounting failed'));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('WRONGTYPE');
  });

  it('throttles the accounting warning to once per minute per instance', async () => {
    const broken = { async incrby() { throw new Error('WRONGTYPE'); }, async expire() {} };
    captureConsole();
    await recordOpenMeteoCall(broken, JUNE);
    await recordOpenMeteoCall(broken, JUNE + 30_000); // same minute — quiet
    expect(consoleOutput.filter((l) => l.includes('accounting failed'))).toHaveLength(1);
    await recordOpenMeteoCall(broken, JUNE + 61_000); // past the window — warns
    expect(consoleOutput.filter((l) => l.includes('accounting failed'))).toHaveLength(2);
  });
});

describe('(g) the counter is scheduled OFF the response path (Astra finding 1)', () => {
  const JUNE = Date.UTC(2026, 5, 14, 12, 0, 0);

  it('returns without awaiting a Redis that never resolves, and hands the promise to the scheduler', async () => {
    const stalled = { incrby: () => new Promise(() => {}), expire: () => new Promise(() => {}) };
    const scheduled = [];
    captureConsole();

    let returned = false;
    recordOpenMeteoCallDeferred(stalled, JUNE, (p) => scheduled.push(p));
    returned = true;

    // Synchronous return — nothing about the caller's path waited on Redis.
    expect(returned).toBe(true);
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]).toBeInstanceOf(Promise);
  });

  it('gives up on a stalled Redis after 1,500 ms and warns, instead of hanging the invocation', async () => {
    const stalled = { incrby: () => new Promise(() => {}), expire: () => new Promise(() => {}) };
    captureConsole();
    const pending = recordOpenMeteoCallDeferred(stalled, JUNE, () => {});

    await vi.advanceTimersByTimeAsync(1499);
    expect(consoleOutput.filter((l) => l.includes('accounting failed'))).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toBeNull();
    const lines = consoleOutput.filter((l) => l.includes('accounting failed'));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('timed out after 1500 ms');
  });

  it('a throwing scheduler (no Vercel lifecycle) never propagates to the caller', () => {
    const redis = { async incrby() { return 29; }, async expire() {} };
    captureConsole();
    expect(() => recordOpenMeteoCallDeferred(redis, JUNE, () => { throw new Error('no waitUntil here'); })).not.toThrow();
  });
});

describe('(h) a cache hit replays the writer\'s audit fields — it never invents them', () => {
  // Astra round-2 minor 1. The cache-hit path spreads the STORED meta and
  // overrides only localHour/serverCache/schema, so a hit reports whatever the
  // WRITING request recorded. An entry written before openMeteoEndpoint /
  // openMeteoStatus existed is still servable (schema 3, finite tempC), and it
  // must come back with those fields ABSENT rather than back-filled from the
  // reading instance's env — otherwise a machine with the key set would report
  // 'customer' for a forecast fetched from the free endpoint by another
  // instance entirely. This is why the production check must be run on a miss.
  const selector = (() => {
    const inputs = {
      desc: 'Clear sky', rainChance: 0, tempC: 18, feelsLikeC: 18, windKph: 10,
      uvIndex: 1.7, cloudPct: 10, maxWindKph: 10, isDay: true,
      dailyHighC: 24, dailyLowC: 12, sourceDescs: ['Clear sky'],
    };
    return { inputs, base: deriveCondition(inputs) };
  })();

  // Deliberately no openMeteoEndpoint / openMeteoStatus: this is the shape a
  // pre-item-2 deploy wrote.
  const legacyCached = {
    ok: true,
    location: { name: 'Strand', lat: -34.1163, lon: 18.8362 },
    now: {
      tempC: 18, uv: 1.7, isDay: true, conditionKey: selector.base.key,
      conditionReason: selector.base.reason, windKph: 10, cloudPct: 10,
      conditionSignals: {
        descWinner: 'Clear sky',
        numeric: { rainChance: 0, tempC: 18, feelsLikeC: 18, windKph: 10, uvIndex: 1.7, cloudPct: 10, dailyHighC: 24, isDay: true },
        sourceVotes: [{ source: 'Open-Meteo', desc: 'Clear sky', vote: 'clear' }],
        overrides: [],
        selector,
      },
    },
    maxWindKph: 10,
    daily: [{ highC: 24, lowC: 12, uv: 8.6, uvMax: 8.6, conditionKey: 'clear' }],
    hourly: Array.from({ length: 48 }, (_, i) => ({ rainChance: 0, uv: i === 10 ? 1.7 : 0.1 })),
    meta: {
      localHour: 10, utcOffsetSeconds: 7200, schema: PAYLOAD_SCHEMA,
      updatedAtLabel: '2026-05-19T08:29:00.000Z', sources: [],
    },
  };

  it('a pre-item-2 cached entry comes back as a hit with both fields undefined', async () => {
    process.env.OPEN_METEO_API_KEY = TEST_KEY; // reader HAS the key — must not leak into the reply
    weatherCacheGet.mockResolvedValueOnce(legacyCached);

    const { statusCode, body } = await callHandler();

    expect(statusCode).toBe(200);
    expect(body.meta.serverCache).toBe('hit');
    expect(body.meta.schema).toBe(PAYLOAD_SCHEMA);
    // Absent, not invented — and absent specifically, not null/'free'/'customer'.
    expect(body.meta.openMeteoEndpoint).toBeUndefined();
    expect(body.meta.openMeteoStatus).toBeUndefined();
    expect('openMeteoEndpoint' in body.meta).toBe(false);
    expect('openMeteoStatus' in body.meta).toBe(false);
    // Nothing was fetched: the reply is the cached writer's, start to finish.
    expect(openMeteoUrl()).toBeUndefined();
  });

  it('the very next MISS reports both fields again, so the check works on a fresh request', async () => {
    process.env.OPEN_METEO_API_KEY = TEST_KEY;
    const { body } = await callHandler(); // weatherCacheGet passthrough → no Redis → miss
    expect(body.meta.serverCache).toBe('miss');
    expect(body.meta.openMeteoEndpoint).toBe('customer');
    expect(body.meta.openMeteoStatus).toBe('ok');
  });
});

describe('(f) nothing Open-Meteo-commercial reaches the client bundle', () => {
  const clientFiles = () => {
    const files = ['index.html', 'sw.js'];
    const walk = (dir) => {
      for (const entry of readdirSync(join(ROOT, dir))) {
        const rel = `${dir}/${entry}`;
        if (statSync(join(ROOT, rel)).isDirectory()) {
          if (entry === 'images') continue;
          walk(rel);
        } else if (/\.(js|html|json|css)$/.test(entry)) {
          files.push(rel);
        }
      }
    };
    walk('assets');
    return files;
  };

  it('no client file mentions OPEN_METEO_API_KEY or the customer endpoint', () => {
    const offenders = [];
    for (const rel of clientFiles()) {
      const src = readFileSync(join(ROOT, rel), 'utf8');
      if (src.includes('OPEN_METEO_API_KEY')) offenders.push(`${rel}: OPEN_METEO_API_KEY`);
      if (src.includes('customer-api.open-meteo.com')) offenders.push(`${rel}: customer-api.open-meteo.com`);
    }
    expect(offenders).toEqual([]);
  });

  it('scanned a meaningful number of client files (guards against an empty sweep)', () => {
    expect(clientFiles().length).toBeGreaterThan(5);
  });
});
