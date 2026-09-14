// Prelaunch item 3 (P1-1, 2026-09-14): now.uv is the CURRENT-HOUR blended UV,
// and today's peak ships separately as daily[0].uvMax, labelled wherever it
// is shown (stats row, byline, share card).
//
// Astra's evidence: at ~08:48 SAST Cape Town's live API said now.uv=4.8 while
// the hour's forecast was ~0.3 — because api/weather.js exposed the blended
// daily MAXIMUM (medUv) as `now.uv`, and the home stats row labelled it "UV".
// Astra's review of the first cut added: legacy cached payloads (Redis ≤15 min,
// service worker ≤3 h) still carry the peak in now.uv; cache hits straddling an
// hour boundary kept a stale now.uv; the share card fell back to the peak.

import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/_lib/weather-cache.js', async (importOriginal) => {
  const mod = await importOriginal();
  return { ...mod, weatherCacheGet: vi.fn(mod.weatherCacheGet), weatherCacheSetDeferred: vi.fn(mod.weatherCacheSetDeferred) };
});

import handler, { PAYLOAD_SCHEMA, deriveCondition } from '../api/weather.js';
import { weatherCacheGet, weatherCacheSetDeferred } from '../api/_lib/weather-cache.js';

const makeResponse = (payload, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: vi.fn(async () => payload),
});

// Clock: 2026-05-19T08:30Z = 10:30 SAST → localHour 10 (daytime).
const CLOCK_DAY = new Date('2026-05-19T08:30:00Z');
// 2026-05-19T20:30Z = 22:30 SAST → after the fixture's 18:00 sunset.
const CLOCK_NIGHT = new Date('2026-05-19T20:30:00Z');

const OM_HOUR_UV = Array(48).fill(0.2);
OM_HOUR_UV[10] = 1.5;   // the current hour
OM_HOUR_UV[12] = 8.6;   // the noon peak

const openMeteoPayload = {
  utc_offset_seconds: 7200,
  current: {
    temperature_2m: 18, apparent_temperature: 18, weather_code: 0,
    wind_speed_10m: 10, wind_gusts_10m: 12, relative_humidity_2m: 50, cloud_cover: 10,
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
    uv_index: OM_HOUR_UV,
    weather_code: Array(48).fill(0),
  },
  daily: {
    temperature_2m_max: Array(7).fill(24),
    temperature_2m_min: Array(7).fill(12),
    precipitation_probability_max: Array(7).fill(0),
    uv_index_max: Array(7).fill(8.6),
    weather_code: Array(7).fill(0),
    sunrise: Array(7).fill('2026-05-19T06:00'),
    sunset: Array(7).fill('2026-05-19T18:00'),
  },
};

const makeWeatherApiPayload = (hourUvAt10) => ({
  location: { tz_id: 'Africa/Johannesburg' },
  current: { temp_c: 18, feelslike_c: 18, condition: { code: 1000, text: 'Sunny' }, wind_kph: 10, humidity: 50 },
  forecast: {
    forecastday: Array.from({ length: 7 }, (_, d) => ({
      day: { maxtemp_c: 24, mintemp_c: 12, totalprecip_mm: 0, daily_chance_of_rain: 0, uv: 8.6, condition: { code: 1000, text: 'Sunny' } },
      astro: { sunrise: '06:00 AM', sunset: '06:00 PM' },
      hour: Array.from({ length: 24 }, (_, h) => ({
        temp_c: 18, feelslike_c: 18, chance_of_rain: 0, precip_mm: 0, wind_kph: 10, cloud: 10, humidity: 50,
        condition: { code: 1000, text: 'Sunny' },
        ...(d === 0 && h === 10 && hourUvAt10 != null ? { uv: hourUvAt10 } : {}),
      })),
    })),
  },
});

const metPayload = {
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
  const req = { query: { lat: '-34.1163', lon: '18.8362', name: 'Strand' } };
  const res = {
    setHeader: vi.fn(),
    status(code) { statusCode = code; return this; },
    json(payload) { body = payload; return this; },
  };
  await handler(req, res);
  return { statusCode, body };
};

const stubFetch = (weatherApiPayload) => { const fn = vi.fn(async (url) => {
  const href = String(url);
  if (href.includes('open-meteo.com/')) return makeResponse(openMeteoPayload);
  if (href.startsWith('https://api.weatherapi.com/')) return makeResponse(weatherApiPayload);
  if (href.startsWith('https://api.met.no/')) return makeResponse(metPayload);
  throw new Error(`Unexpected URL: ${href}`);
}); vi.stubGlobal('fetch', fn); return fn; };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(CLOCK_DAY);
  process.env.WEATHERAPI_KEY = 'weather-key';
  delete process.env.PIRATE_WEATHER_KEY;
  delete process.env.TOMORROWIO_API_KEY;
  weatherCacheGet.mockReset();
  weatherCacheGet.mockResolvedValue(null); // cache miss unless a test says otherwise
});

afterEach(() => {
  delete process.env.WEATHERAPI_KEY;
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('item 3 — now.uv is the current hour, daily[0].uvMax is the peak (api/weather.js)', () => {
  it('now.uv is the WEIGHTED blend of the hourly sources at the current hour', async () => {
    stubFetch(makeWeatherApiPayload(2.1));
    const { statusCode, body } = await callHandler();
    expect(statusCode).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.meta.localHour).toBe(10);
    expect(body.meta.schema).toBe(PAYLOAD_SCHEMA);
    // OM 1.5 @ 0.30 and WA 2.1 @ 0.11 (ECMWF dedup halves WA: both highs 24°)
    // → (0.45 + 0.231) / 0.41 = 1.66 → 1.7. Open-Meteo alone would be 1.5,
    // an unweighted mean 1.8, the peak 8.6 — only the weighted blend is 1.7.
    expect(body.now.uv).toBe(1.7);
    // It IS the hourly slot the client slices from (single source of truth).
    expect(body.hourly[10].uv).toBe(1.7);
  });

  it('without WeatherAPI hourly UV, now.uv is Open-Meteo alone', async () => {
    stubFetch(makeWeatherApiPayload(null));
    const { body } = await callHandler();
    expect(body.now.uv).toBe(1.5);
  });

  it('daily[0].uvMax carries today\'s blended peak, labelled separately', async () => {
    stubFetch(makeWeatherApiPayload(2.1));
    const { body } = await callHandler();
    expect(body.daily[0].uvMax).toBe(8.6);
    expect(body.daily[1].uvMax).toBeUndefined();
  });

  it('the now-condition UV rung reads the current hour: 1.7 at 10:00 is no longer a "uv" headline', async () => {
    stubFetch(makeWeatherApiPayload(2.1));
    const { body } = await callHandler();
    expect(body.now.conditionKey).not.toBe('uv');
    expect(body.now.conditionSignals.numeric.uvIndex).toBe(1.7);
  });

  it('after sunset now.uv is null while daily[0].uvMax still reports the day\'s peak', async () => {
    vi.setSystemTime(CLOCK_NIGHT);
    stubFetch(makeWeatherApiPayload(0));
    const { body } = await callHandler();
    expect(body.now.isDay).toBe(false);
    expect(body.now.uv).toBeNull();
    expect(body.daily[0].uvMax).toBe(8.6);
  });
});

describe('item 3 — cache hits re-read the current hour (respondWithCachedPayload)', () => {
  const hourlyUv = Array.from({ length: 48 }, (_, i) => ({ rainChance: 0, uv: i === 10 ? 1.7 : i === 11 ? 0.2 : i === 35 ? 3.3 : 0.1 }));
  const cachedSchema2 = {
    ok: true,
    location: { name: 'Strand', lat: -34.1163, lon: 18.8362 },
    now: { tempC: 18, uv: 1.7, isDay: true, conditionKey: 'clear', conditionReason: 'clear-default', windKph: 10, cloudPct: 10, conditionSignals: { descWinner: 'Clear sky', numeric: { rainChance: 0, tempC: 18, feelsLikeC: 18, windKph: 10, uvIndex: 1.7, cloudPct: 10, dailyHighC: 24, isDay: true }, sourceVotes: [{ source: 'Open-Meteo', desc: 'Clear sky', vote: 'clear' }], overrides: [], selector: (() => { const inputs = { desc: 'Clear sky', rainChance: 0, tempC: 18, feelsLikeC: 18, windKph: 10, uvIndex: 1.7, cloudPct: 10, maxWindKph: 10, isDay: true, dailyHighC: 24, dailyLowC: 12, sourceDescs: ['Clear sky'] }; return { inputs, base: deriveCondition(inputs) }; })() } },
    maxWindKph: 10,
    daily: [{ highC: 24, lowC: 12, uv: 8.6, uvMax: 8.6, conditionKey: 'clear' }],
    hourly: hourlyUv,
    meta: { localHour: 10, utcOffsetSeconds: 7200, schema: PAYLOAD_SCHEMA, updatedAtLabel: '2026-05-19T08:59:00.000Z', sources: [] },
  };

  it('10:59 → 11:01: a cache hit reports hour 11 AND hour 11\'s UV, not the 10:59 value', async () => {
    vi.setSystemTime(new Date('2026-05-19T09:01:00Z')); // 11:01 SAST
    weatherCacheGet.mockResolvedValue(cachedSchema2);
    stubFetch(makeWeatherApiPayload(2.1));
    const { body } = await callHandler();
    expect(body.meta.serverCache).toBe('hit');
    expect(body.meta.localHour).toBe(11);
    expect(body.now.uv).toBe(0.2);
    expect(body.daily[0].uvMax).toBe(8.6);
    expect(body.meta.schema).toBe(PAYLOAD_SCHEMA);
  });

  it('a legacy cached payload (no meta.schema, peak in now.uv) is migrated: peak → uvMax, now.uv from the hour', async () => {
    vi.setSystemTime(new Date('2026-05-19T09:01:00Z'));
    const legacy = {
      ...cachedSchema2,
      now: { tempC: 18, uv: 8.6, isDay: true, conditionKey: 'clear' },
      daily: [{ highC: 24, lowC: 12, uv: 8.6, conditionKey: 'clear' }],
      meta: { localHour: 10, utcOffsetSeconds: 7200, updatedAtLabel: '2026-05-19T08:59:00.000Z', sources: [] },
    };
    weatherCacheGet.mockResolvedValue(legacy);
    stubFetch(makeWeatherApiPayload(2.1));
    const { body } = await callHandler();
    expect(body.now.uv).toBe(0.2);
    expect(body.daily[0].uvMax).toBe(8.6);
    expect(body.meta.schema).toBe(PAYLOAD_SCHEMA);
  });

  it('day rollover inside the TTL: midnight is night, so UV is null — never index 0\'s stale 9', async () => {
    // Written 23:58 SAST on the 19th, read 00:03 SAST on the 20th. A rollover
    // inside a 15-minute TTL can only ever happen at midnight, which is after
    // sunset: the honest answer is isDay false, uv null (Astra: the old fixture
    // asserted a positive UV at midnight by freezing daylight artificially).
    const written = { ...cachedSchema2, now: { ...cachedSchema2.now, uv: 0.1, isDay: false, sunrise: '2026-05-19T06:00', sunset: '2026-05-19T18:00' }, meta: { ...cachedSchema2.meta, localHour: 23, updatedAtLabel: '2026-05-19T21:58:00.000Z' } };
    const hourly = hourlyUv.map((h, i) => (i === 24 ? { ...h, uv: 0.4 } : i === 0 ? { ...h, uv: 9 } : h));
    vi.setSystemTime(new Date('2026-05-19T22:03:00Z'));
    weatherCacheGet.mockResolvedValue({ ...written, hourly });
    stubFetch(makeWeatherApiPayload(2.1));
    const { body } = await callHandler();
    expect(body.meta.localHour).toBe(0);
    expect(body.now.isDay).toBe(false);
    expect(body.now.uv).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Frontend: normalizePayload keeps now.uv (current) and today.uvMax (peak)
// apart, treats a schema-less payload as legacy, and the stats row / byline
// label the peak as "Max" in rendered output.
// ---------------------------------------------------------------------------
const js = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');

const sliceFn = (name) => {
  const start = js.indexOf(`function ${name}(`);
  expect(start, `${name} missing from app.js`).toBeGreaterThan(-1);
  return js.slice(start, js.indexOf('\n  }', start) + 4);
};

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const noop = () => {};
// The production minimum, read from source — never injected (Astra, item 6 minor).
const CLIENT_SCHEMA_MIN = Number(js.match(/const PAYLOAD_SCHEMA_MIN = (\d+);/)[1]);
const normalizePayload = new Function('isNum', 'debugLog', 'PAYLOAD_SCHEMA_MIN', `${sliceFn('normalizePayload')}; return normalizePayload;`)(isNum, noop, CLIENT_SCHEMA_MIN);

// renderStatsRow with its closure dependencies supplied: a fake element, the
// English catalogue, and the same tiny formatters app.js defines.
const T_EN = {
  weather: { wind: 'Wind', rain: 'Rain', uv: 'UV', uvMax: 'Max', gusts: 'gusts', none: 'None', unlikely: 'Unlikely', possible: 'Possible', likely: 'Likely', possibleLater: 'Possible later', later: 'Later', low: 'Low', moderate: 'Moderate', high: 'High', veryHigh: 'Very High' },
};
const makeStatsRow = () => {
  const el = { innerHTML: '' };
  const round0 = (n) => (isNum(n) ? Math.round(n) : null);
  const render = new Function(
    'statsRowEl', 'isNum', 't', 'round0', 'formatWind', 'windCompass', 'settings', 'debugLog',
    `${sliceFn('renderStatsRow')}; return renderStatsRow;`,
  )(el, isNum, (c, k) => T_EN[c]?.[k], round0, (kph) => `${round0(kph)} km/h`, () => '', { wind: 'kph' }, noop);
  return { el, render };
};

describe('item 3 — frontend keeps current UV and peak UV apart (assets/app.js)', () => {
  const schema2 = {
    now: { tempC: 18, uv: 1.7, isDay: true, conditionKey: 'clear', windKph: 12, rainChance: 5 },
    daily: [{ highC: 24, lowC: 12, uv: 8.6, uvMax: 8.6, conditionKey: 'clear', rainChance: 5 }],
    hourly: Array.from({ length: 48 }, () => ({ rainChance: 5, uv: 1.7 })),
    meta: { localHour: 10, schema: PAYLOAD_SCHEMA, sources: [] },
  };

  it('schema 2: uv is the current hour, uvMax the labelled peak, the hero rung reads the peak', () => {
    const norm = normalizePayload(schema2);
    expect(norm.uv).toBe(1.7);
    expect(norm.uvMax).toBe(8.6);
    expect(norm.uvDaily).toBe(8.6);
  });

  it('legacy payload (no meta.schema, now.uv = 8.6 peak): current is UNKNOWN, 8.6 is the peak', () => {
    const legacy = {
      ...schema2,
      now: { ...schema2.now, uv: 8.6 },
      daily: [{ highC: 24, lowC: 12, uv: 8.6, conditionKey: 'clear', rainChance: 5 }],
      meta: { localHour: 10, sources: [] },
    };
    const norm = normalizePayload(legacy);
    expect(norm.uv).toBeNull();
    expect(norm.uvMax).toBe(8.6);
    expect(norm.uvDaily).toBe(8.6);
  });

  it('renders "UV 2 / Low · Max 9" — the peak never appears without its label', () => {
    const { el, render } = makeStatsRow();
    render(normalizePayload(schema2));
    expect(el.innerHTML).toContain('<div class="stat-k">UV</div><div class="stat-v">2</div><div class="stat-sub">Low · Max 9</div>');
    expect(el.innerHTML).not.toContain('<div class="stat-v">9</div><div class="stat-sub">Very High</div>');
  });

  it('renders the peak under its own label when the current hour is unknown (legacy payload)', () => {
    const { el, render } = makeStatsRow();
    render(normalizePayload({ ...schema2, now: { ...schema2.now, uv: 8.6 }, meta: { localHour: 10, sources: [] } }));
    expect(el.innerHTML).toContain('<div class="stat-k">UV</div><div class="stat-v">9</div><div class="stat-sub">Max</div>');
    expect(el.innerHTML).not.toContain('Very High');
  });

  it('renders no UV cell at night, even with a peak on record', () => {
    const { el, render } = makeStatsRow();
    render(normalizePayload({ ...schema2, now: { ...schema2.now, uv: null, isDay: false } }));
    expect(el.innerHTML).not.toContain('<div class="stat-k">UV</div>');
  });

  it('the byline labels the peak, and shows it alone when the current hour is unknown', () => {
    const byline = js.slice(js.indexOf('const bylineEl = $(\'#weatherByline\')'), js.indexOf('bylineEl.innerHTML'));
    expect(byline).toMatch(/t\('weather', 'uvMax'\)/);
    expect(byline).toMatch(/else if \(isNum\(norm\.uvMax\) && norm\.isDay\)/);
  });

  it('the "Max" label exists in all five languages', () => {
    const m = js.match(/uvMax: \{ en: "([^"]+)", af: "([^"]+)", zu: "([^"]+)", xh: "([^"]+)", st: "([^"]+)" \}/);
    expect(m, 'T.weather.uvMax with five languages').not.toBeNull();
    expect(m.slice(1).every((s) => s.trim().length > 0)).toBe(true);
  });
});

describe('item 3 — the share card never shows the peak as current UV (api/og.js)', () => {
  it('current unavailable + daytime peak → "UV max 9"; current present → "UV 2"; night → no UV', async () => {
    const { buildOgViewModel } = await import('../api/og.js');
    const base = { ok: true, location: { name: 'Strand' }, now: { conditionKey: 'clear', tempC: 20, windKph: 18, rainChance: 8, isDay: true }, daily: [{ conditionKey: 'clear', highC: 24, lowC: 14, rainChance: 8, uv: 8.6, uvMax: 8.6 }] };
    expect(buildOgViewModel(base, { lang: 'en' }).stats).toBe('Wind 18 km/h • Rain 8% • UV max 9');
    expect(buildOgViewModel({ ...base, now: { ...base.now, uv: 1.7 } }, { lang: 'en' }).stats).toBe('Wind 18 km/h • Rain 8% • UV 2');
    expect(buildOgViewModel({ ...base, now: { ...base.now, isDay: false } }, { lang: 'en' }).stats).toBe('Wind 18 km/h • Rain 8%');
    expect(buildOgViewModel(base, { lang: 'af' }).stats).toContain('UV maks 9');
  });
});

// ---------------------------------------------------------------------------
// Round 2 (Astra): the peak must not select the current headline either, a
// legacy entry must not be served from the server cache at all, the share
// card must treat an API-shaped null as "no value" (its isNum coerces null →
// 0), daylight must be re-derived on cache hits, and the byline must be
// checked as rendered output.
// ---------------------------------------------------------------------------
const makeByline = () => {
  const el = { innerHTML: '' };
  const start = js.indexOf("const bylineEl = $('#weatherByline')");
  const endMarker = "bylineEl.innerHTML = rows.join('');";
  const end = js.indexOf(endMarker, start) + endMarker.length;
  expect(start, 'byline block missing').toBeGreaterThan(-1);
  const src = js.slice(start, end) + ' }'; // close the enclosing if (bylineEl) { … }
  const round0 = (n) => (isNum(n) ? Math.round(n) : null);
  const render = new Function('$', 'norm', 'wind', 'rain', 'uv', 'currentTemp', 't', 'isNum', 'formatWind', 'formatTemp', 'round0', src);
  return {
    el,
    render: (norm) => render(() => el, norm, norm.windKph, norm.rainPct, norm.uv, norm.nowTemp, (c, k) => T_EN[c]?.[k], isNum, (kph) => `${round0(kph)} km/h`, (c) => `${round0(c)}°`, round0),
  };
};

describe('item 3 — round 2: no peak-driven headline, no legacy cache, no "UV 0"', () => {
  const hourlyNoUv = Array.from({ length: 48 }, () => ({ rainChance: 0, uv: null }));

  it('no hourly UV source this hour → now.uv null AND the now-condition is not "uv" (peak 8.6 does not select it)', async () => {
    const noHourlyUv = { ...openMeteoPayload, hourly: { ...openMeteoPayload.hourly, uv_index: Array(48).fill(null) } };
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const href = String(url);
      if (href.includes('open-meteo.com/')) return makeResponse(noHourlyUv);
      if (href.startsWith('https://api.weatherapi.com/')) return makeResponse(makeWeatherApiPayload(null));
      if (href.startsWith('https://api.met.no/')) return makeResponse(metPayload);
      throw new Error(`Unexpected URL: ${href}`);
    }));
    const { body } = await callHandler();
    expect(body.now.uv).toBeNull();
    expect(body.daily[0].uvMax).toBe(8.6);
    expect(body.now.conditionKey).not.toBe('uv');
    expect(body.now.conditionSignals.numeric.uvIndex).toBeNull();
  });

  it('a legacy (schema-less) server cache entry is a MISS: the handler fetches fresh instead of serving it', async () => {
    const legacy = {
      ok: true,
      location: { name: 'Strand', lat: -34.1163, lon: 18.8362 },
      now: { tempC: 18, uv: 8.6, isDay: true, conditionKey: 'uv', conditionReason: 'high-uv-with-temp-gate' },
      daily: [{ highC: 24, lowC: 12, uv: 8.6, conditionKey: 'clear' }],
      hourly: hourlyNoUv,
      meta: { localHour: 10, utcOffsetSeconds: 7200, updatedAtLabel: '2026-05-19T08:29:00.000Z', sources: [] },
    };
    weatherCacheGet.mockResolvedValue(legacy);
    const fetchStub = stubFetch(makeWeatherApiPayload(2.1));
    const { body } = await callHandler();
    expect(fetchStub).toHaveBeenCalled(); // providers were fetched: the legacy entry was not served
    expect(body.meta.serverCache).toBe('miss');
    expect(body.now.uv).toBe(1.7);
    expect(body.now.conditionKey).not.toBe('uv');
  });

  it('a cached entry without a real current temperature is a MISS too', async () => {
    weatherCacheGet.mockResolvedValue({ ok: true, now: { tempC: null, conditionKey: 'clear' }, daily: [], hourly: hourlyNoUv, meta: { schema: PAYLOAD_SCHEMA, localHour: 10 } });
    const fetchStub = stubFetch(makeWeatherApiPayload(2.1));
    const { body } = await callHandler();
    expect(fetchStub).toHaveBeenCalled();
    expect(body.meta.serverCache).toBe('miss');
  });

  it('cache hit across SUNSET: daylight is re-derived from the cached sunrise/sunset, UV goes null', async () => {
    // Written 17:55 SAST (isDay true), read 18:02 SAST; fixture sunset 18:00.
    const written = {
      ok: true, location: { name: 'Strand', lat: -34.1163, lon: 18.8362 },
      now: { tempC: 18, uv: 0.2, isDay: true, conditionKey: 'clear', conditionReason: 'clear-default', windKph: 10, cloudPct: 10, sunrise: '2026-05-19T06:00', sunset: '2026-05-19T18:00', conditionSignals: { descWinner: 'Clear sky', numeric: { rainChance: 0, tempC: 18, feelsLikeC: 18, windKph: 10, uvIndex: 0.2, cloudPct: 10, dailyHighC: 24, isDay: true }, sourceVotes: [{ source: 'Open-Meteo', desc: 'Clear sky', vote: 'clear' }], overrides: [], selector: (() => { const inputs = { desc: 'Clear sky', rainChance: 0, tempC: 18, feelsLikeC: 18, windKph: 10, uvIndex: 0.2, cloudPct: 10, maxWindKph: 10, isDay: true, dailyHighC: 24, dailyLowC: 12, sourceDescs: ['Clear sky'] }; return { inputs, base: deriveCondition(inputs) }; })() } },
      daily: [{ highC: 24, lowC: 12, uv: 8.6, uvMax: 8.6, conditionKey: 'clear' }],
      hourly: Array.from({ length: 48 }, (_, i) => ({ rainChance: 0, uv: i === 18 ? 0.1 : 0.2 })),
      meta: { localHour: 17, utcOffsetSeconds: 7200, schema: PAYLOAD_SCHEMA, updatedAtLabel: '2026-05-19T15:55:00.000Z', sources: [] },
    };
    vi.setSystemTime(new Date('2026-05-19T16:02:00Z'));
    weatherCacheGet.mockResolvedValue(written);
    stubFetch(makeWeatherApiPayload(2.1));
    const { body } = await callHandler();
    expect(body.meta.serverCache).toBe('hit');
    expect(body.now.isDay).toBe(false);
    expect(body.now.uv).toBeNull();
  });

  it("cache hit across SUNRISE: daylight comes back and the hour's UV with it", async () => {
    const written = {
      ok: true, location: { name: 'Strand', lat: -34.1163, lon: 18.8362 },
      now: { tempC: 12, uv: null, isDay: false, conditionKey: 'clear', conditionReason: 'clear-default', windKph: 10, cloudPct: 10, sunrise: '2026-05-19T06:00', sunset: '2026-05-19T18:00', conditionSignals: { descWinner: 'Clear sky', numeric: { rainChance: 0, tempC: 12, feelsLikeC: 12, windKph: 10, uvIndex: null, cloudPct: 10, dailyHighC: 24, isDay: true }, sourceVotes: [{ source: 'Open-Meteo', desc: 'Clear sky', vote: 'clear' }], overrides: [], selector: (() => { const inputs = { desc: 'Clear sky', rainChance: 0, tempC: 12, feelsLikeC: 12, windKph: 10, uvIndex: null, cloudPct: 10, maxWindKph: 10, isDay: true, dailyHighC: 24, dailyLowC: 12, sourceDescs: ['Clear sky'] }; return { inputs, base: deriveCondition(inputs) }; })() } },
      daily: [{ highC: 24, lowC: 12, uv: 8.6, uvMax: 8.6, conditionKey: 'clear' }],
      hourly: Array.from({ length: 48 }, (_, i) => ({ rainChance: 0, uv: i === 6 ? 0.3 : 0 })),
      meta: { localHour: 5, utcOffsetSeconds: 7200, schema: PAYLOAD_SCHEMA, updatedAtLabel: '2026-05-19T03:56:00.000Z', sources: [] },
    };
    vi.setSystemTime(new Date('2026-05-19T04:03:00Z')); // 06:03 SAST
    weatherCacheGet.mockResolvedValue(written);
    stubFetch(makeWeatherApiPayload(2.1));
    const { body } = await callHandler();
    expect(body.now.isDay).toBe(true);
    expect(body.now.uv).toBe(0.3);
  });

  it('client: a legacy payload\'s "uv" headline (peak-derived) is demoted to clear', () => {
    const norm = normalizePayload({
      now: { tempC: 18, uv: 8.6, isDay: true, conditionKey: 'uv', windKph: 5, rainChance: 0, cloudPct: 5 },
      daily: [{ highC: 24, lowC: 12, uv: 8.6, conditionKey: 'clear', rainChance: 0 }],
      hourly: hourlyNoUv,
      meta: { localHour: 10, sources: [] },
    });
    expect(norm.conditionKey).toBe('clear');
    expect(norm.uv).toBeNull();
    expect(norm.uvMax).toBe(8.6);
  });

  it('share card: API-shaped now.uv = null never prints "UV 0", by day or by night', async () => {
    const { buildOgViewModel } = await import('../api/og.js');
    const base = { ok: true, location: { name: 'Strand' }, now: { conditionKey: 'clear', tempC: 20, windKph: 18, rainChance: 8, uv: null, isDay: true }, daily: [{ conditionKey: 'clear', highC: 24, lowC: 14, rainChance: 8, uv: 8.6, uvMax: 8.6 }] };
    expect(buildOgViewModel(base, { lang: 'en' }).stats).toBe('Wind 18 km/h • Rain 8% • UV max 9');
    expect(buildOgViewModel({ ...base, now: { ...base.now, isDay: false } }, { lang: 'en' }).stats).toBe('Wind 18 km/h • Rain 8%');
    expect(buildOgViewModel({ ...base, now: { ...base.now, uv: 1.7 } }, { lang: 'en' }).stats).toBe('Wind 18 km/h • Rain 8% • UV 2');
  });

  it('byline as rendered: "UV Low (2) · Max 9" by day; peak alone under its label when current is unknown; nothing at night', () => {
    const schema2 = {
      now: { tempC: 18, uv: 1.7, isDay: true, conditionKey: 'clear', windKph: 12, rainChance: 5 },
      daily: [{ highC: 24, lowC: 12, uv: 8.6, uvMax: 8.6, conditionKey: 'clear', rainChance: 5 }],
      hourly: Array.from({ length: 48 }, () => ({ rainChance: 5, uv: 1.7 })),
      meta: { localHour: 10, schema: PAYLOAD_SCHEMA, sources: [] },
    };
    const day = makeByline(); day.render(normalizePayload(schema2));
    expect(day.el.innerHTML).toContain('UV Low (2) · Max 9');
    const legacy = makeByline(); legacy.render(normalizePayload({ ...schema2, now: { ...schema2.now, uv: 8.6 }, meta: { localHour: 10, sources: [] } }));
    expect(legacy.el.innerHTML).toContain('UV Max 9');
    expect(legacy.el.innerHTML).not.toContain('Very High');
    const night = makeByline(); night.render(normalizePayload({ ...schema2, now: { ...schema2.now, uv: null, isDay: false } }));
    expect(night.el.innerHTML).not.toContain('UV');
  });
});

describe('item 3 — client refuses pre-contract or degraded payloads (service worker / IndexedDB copies)', () => {
  const isRenderablePayload = new Function('PAYLOAD_SCHEMA_MIN', `${sliceFn('isRenderablePayload')}; return isRenderablePayload;`)(CLIENT_SCHEMA_MIN);
  it('accepts a schema-2 payload with a real current temperature', () => {
    expect(isRenderablePayload({ ok: true, now: { tempC: 18 }, meta: { schema: PAYLOAD_SCHEMA } })).toBe(true);
  });
  it('rejects a schema-less (pre-deploy) payload, a degraded body, and a null temperature', () => {
    expect(isRenderablePayload({ ok: true, now: { tempC: 18 }, meta: {} })).toBe(false);
    expect(isRenderablePayload({ ok: false, degraded: true, meta: { schema: PAYLOAD_SCHEMA } })).toBe(false);
    expect(isRenderablePayload({ ok: true, now: { tempC: null }, meta: { schema: PAYLOAD_SCHEMA } })).toBe(false);
    expect(isRenderablePayload(null)).toBe(false);
  });
  it('fetchProbable and the IndexedDB reader both gate on it', () => {
    expect(sliceFn('fetchProbable')).toMatch(/isRenderablePayload\(data\)/);
    expect(sliceFn('getCachedWeather')).toMatch(/isRenderablePayload\(entry\.payload\)/);
  });
});

// ---------------------------------------------------------------------------
// Rounds 3–7 (Astra): a cache hit cannot re-run the pipeline the headline went
// through (consensus flips, radar/thunder overrides, fog detector, confidence).
// So a hit RE-CHECKS, never re-decides: the selector runs again with the exact
// inputs it saw at write time (stored as conditionSignals.selector) and only
// uv/isDay refreshed; if its base result (key and reason) would differ, the
// entry is refused and the request fans out fresh — parity with a fresh request
// by construction. Otherwise the hit is served with the hour's UV/daylight
// refreshed and the audit fields left as written. Entries are GENERATED THROUGH
// THE HANDLER here, so what the test reads back is what production writes.
// ---------------------------------------------------------------------------
describe('item 3 — cache hits re-check the headline against the stored selector call', () => {
  // Open-Meteo hourly UV: 0.2 everywhere except the current hour, 8.6 at noon.
  // 11:59 SAST → hour 11 uv 0.2 (clear). 12:01 → hour 12 uv 8.6 (uv headline).
  const writtenAt = new Date('2026-05-19T09:59:00Z'); // 11:59 SAST
  const sameHour = new Date('2026-05-19T10:00:30Z');   // 12:00:30 SAST — still hour 12? no: hour 12; use 09:59:30
  const stillHour11 = new Date('2026-05-19T09:59:30Z');
  const nextHour = new Date('2026-05-19T10:01:00Z');   // 12:01 SAST

  const writeEntry = async (clock) => {
    vi.setSystemTime(clock);
    weatherCacheGet.mockResolvedValue(null);
    weatherCacheSetDeferred.mockClear();
    const fetchFn = stubFetch(makeWeatherApiPayload(2.1));
    const { body } = await callHandler();
    expect(body.meta.serverCache).toBe('miss');
    expect(weatherCacheSetDeferred).toHaveBeenCalledTimes(1);
    return { written: weatherCacheSetDeferred.mock.calls[0][1], fetchFn, body };
  };

  it('an unchanged read (same hour) is a HIT and fetches no provider', async () => {
    const { written } = await writeEntry(writtenAt);
    expect(written.now.conditionSignals.selector).toMatchObject({ base: { key: expect.any(String), reason: expect.any(String) } });
    vi.setSystemTime(stillHour11);
    weatherCacheGet.mockResolvedValue(written);
    const fetchFn = stubFetch(makeWeatherApiPayload(2.1));
    const { body } = await callHandler();
    expect(body.meta.serverCache).toBe('hit');
    expect(fetchFn).not.toHaveBeenCalled();
    expect(body.now.conditionKey).toBe(written.now.conditionKey);
    expect(body.now.conditionReason).toBe(written.now.conditionReason);
    expect(body.now.uv).toBe(0.2);
  });

  it('a read across a UV rung crossing (0.2 → 8.6): base result changes → MISS, fully equal to a fresh request', async () => {
    const { written } = await writeEntry(writtenAt);
    expect(written.now.conditionKey).not.toBe('uv');
    vi.setSystemTime(nextHour);
    weatherCacheGet.mockResolvedValue(written);
    const fetchFn = stubFetch(makeWeatherApiPayload(2.1));
    const { body } = await callHandler();
    expect(body.meta.serverCache).toBe('miss');
    expect(fetchFn).toHaveBeenCalled();
    // Parity: identical to a request that never saw the cache.
    weatherCacheGet.mockResolvedValue(null);
    stubFetch(makeWeatherApiPayload(2.1));
    const f = (await callHandler()).body;
    expect(body.now.conditionKey).toBe('uv');
    expect(body.now.conditionKey).toBe(f.now.conditionKey);
    expect(body.now.conditionReason).toBe(f.now.conditionReason);
    expect(body.now.uv).toBe(f.now.uv);
    expect(body.now.conditionSignals).toEqual(f.now.conditionSignals);
    expect(body.meta.conditionConfidence).toEqual(f.meta.conditionConfidence);
  });

  it('a radar-rain entry (override rewrote rainChance to 70 after selection) still HITS on an unchanged read', async () => {
    process.env.TOMORROWIO_API_KEY = 'ti-key';
    try {
      const radar = {
        data: { timelines: [{ intervals: [
          { startTime: '2026-05-19T09:00:00Z', values: { temperature: 18, precipitationIntensity: 2.25, precipitationProbability: 25, weatherCode: 4200, windSpeed: 5, humidity: 70, cloudCover: 80 } },
          ...Array.from({ length: 47 }, (_, i) => ({ startTime: new Date(Date.UTC(2026, 4, 19, 10 + i, 0, 0)).toISOString(), values: { temperature: 18, precipitationIntensity: 0, precipitationProbability: 0, weatherCode: 1000, windSpeed: 4, humidity: 50, cloudCover: 10 } })),
        ] }] },
      };
      const stubAll = () => { const fn = vi.fn(async (url) => {
        const href = String(url);
        if (href.includes('open-meteo.com/')) return makeResponse(openMeteoPayload);
        if (href.startsWith('https://api.weatherapi.com/')) return makeResponse(makeWeatherApiPayload(2.1));
        if (href.startsWith('https://api.met.no/')) return makeResponse(metPayload);
        if (href.startsWith('https://api.tomorrow.io/')) return makeResponse(radar);
        throw new Error(`Unexpected URL: ${href}`);
      }); vi.stubGlobal('fetch', fn); return fn; };
      vi.setSystemTime(writtenAt);
      weatherCacheGet.mockResolvedValue(null);
      weatherCacheSetDeferred.mockClear();
      stubAll();
      const first = (await callHandler()).body;
      expect(first.now.conditionReason).toBe('tomorrow-io-radar-override');
      expect(first.now.rainChance).toBeGreaterThanOrEqual(70);
      const written = weatherCacheSetDeferred.mock.calls[0][1];
      expect(written.now.conditionSignals.selector.base.key).not.toBe('rain'); // base was the models' verdict; radar overrode it
      vi.setSystemTime(stillHour11);
      weatherCacheGet.mockResolvedValue(written);
      const fetchFn = stubAll();
      const { body } = await callHandler();
      expect(body.meta.serverCache).toBe('hit');
      expect(fetchFn).not.toHaveBeenCalled();
      expect(body.now.conditionKey).toBe('rain');
      expect(body.now.rainChance).toBeGreaterThanOrEqual(70);
    } finally {
      delete process.env.TOMORROWIO_API_KEY;
    }
  });

  it('a changed REASON alone (uv 8.6 → 7: high rung → moderate rung) refuses the entry', async () => {
    // Write at 12:01 (hour 12, uv 8.6 → high-uv rung), read at 13:01 with uv 7 at hour 13.
    const om = { ...openMeteoPayload, hourly: { ...openMeteoPayload.hourly, uv_index: openMeteoPayload.hourly.uv_index.map((v, i) => (i === 13 ? 7 : v)) } };
    const stubOm = () => { const fn = vi.fn(async (url) => {
      const href = String(url);
      if (href.includes('open-meteo.com/')) return makeResponse(om);
      if (href.startsWith('https://api.weatherapi.com/')) return makeResponse(makeWeatherApiPayload(null));
      if (href.startsWith('https://api.met.no/')) return makeResponse(metPayload);
      throw new Error(`Unexpected URL: ${href}`);
    }); vi.stubGlobal('fetch', fn); return fn; };
    vi.setSystemTime(nextHour);
    weatherCacheGet.mockResolvedValue(null);
    weatherCacheSetDeferred.mockClear();
    stubOm();
    const first = (await callHandler()).body;
    expect(first.now.conditionKey).toBe('uv');
    expect(first.now.conditionReason).toBe('high-uv-with-temp-gate');
    const written = weatherCacheSetDeferred.mock.calls[0][1];
    vi.setSystemTime(new Date('2026-05-19T11:01:00Z')); // 13:01 SAST
    weatherCacheGet.mockResolvedValue(written);
    const fetchFn = stubOm();
    const { body } = await callHandler();
    expect(body.meta.serverCache).toBe('miss');
    expect(fetchFn).toHaveBeenCalled();
    expect(body.now.conditionKey).toBe('uv');
    expect(body.now.conditionReason).toBe('moderate-uv-with-temp-gate');
    expect(body.now.conditionSignals.numeric.uvIndex).toBe(7);
  });

  it('degraded-provider entry (WeatherAPI "06:00 AM" solar strings): daylight follows the local hour on hits', async () => {
    // Generate through the handler with Open-Meteo down so the solar strings are WeatherAPI's.
    const stubNoOm = () => { const fn = vi.fn(async (url) => {
      const href = String(url);
      if (href.includes('open-meteo.com/')) return makeResponse({ error: 'down' }, 500);
      if (href.startsWith('https://api.weatherapi.com/')) return makeResponse(makeWeatherApiPayload(null));
      if (href.startsWith('https://api.met.no/')) return makeResponse(metPayload);
      throw new Error(`Unexpected URL: ${href}`);
    }); vi.stubGlobal('fetch', fn); return fn; };
    vi.setSystemTime(new Date('2026-05-19T03:56:00Z')); // 05:56 SAST — night by the 06–19 fallback
    weatherCacheGet.mockResolvedValue(null);
    weatherCacheSetDeferred.mockClear();
    stubNoOm();
    const first = (await callHandler()).body;
    expect(first.now.sunrise).toBe('06:00 AM');
    expect(first.now.isDay).toBe(false);
    const written = weatherCacheSetDeferred.mock.calls[0][1];
    vi.setSystemTime(new Date('2026-05-19T04:03:00Z')); // 06:03 SAST
    weatherCacheGet.mockResolvedValue(written);
    const fetchFn = stubNoOm();
    const { body } = await callHandler();
    expect(fetchFn).not.toHaveBeenCalled();
    expect(body.meta.serverCache).toBe('hit');
    expect(body.now.isDay).toBe(true);
  });

  it('an entry without the stored selector call cannot be re-checked → MISS', async () => {
    const { written } = await writeEntry(writtenAt);
    const stripped = { ...written, now: { ...written.now, conditionSignals: { ...written.now.conditionSignals, selector: undefined } } };
    vi.setSystemTime(stillHour11);
    weatherCacheGet.mockResolvedValue(stripped);
    stubFetch(makeWeatherApiPayload(2.1));
    const { body } = await callHandler();
    expect(body.meta.serverCache).toBe('miss');
  });
});
