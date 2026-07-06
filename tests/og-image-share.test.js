import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { WEATHER_COPY } from '../assets/weather-copy.js';
import { WITTY_DAY_TAGS, dayAwarePool, eligibleWittyPool } from '../assets/witty-day-tags.js';
import { buildShareLink, buildOgImageUrl, sanitizeRawCondition } from '../assets/share-url.js';

const weatherPayload = {
  ok: true,
  location: { name: 'Strand, Western Cape', lat: -34.1, lon: 18.83 },
  now: {
    tempC: 28,
    feelsLikeC: 30,
    rainChance: 8,
    cloudPct: 35,
    windKph: 18,
    uv: 7,
    conditionKey: 'clear',
  },
  daily: [
    {
      highC: 34,
      lowC: 22,
      rainChance: 8,
      uv: 7,
      conditionKey: 'clear',
    },
  ],
  consensus: { confidenceKey: 'strong' },
  meta: { sources: [{ name: 'Open-Meteo', ok: true }] },
};

vi.mock('../api/weather.js', () => ({
  default: vi.fn(async (_req, res) => res.status(200).json(weatherPayload)),
}));

const { default: ogHandler, buildOgViewModel, buildFallbackViewModel, normalizeConditionParam, CACHE_CONTROL, DEGRADED_CACHE_CONTROL, JPEG_BYTE_BUDGET } = await import('../api/og.js');
const { default: weatherMock } = await import('../api/weather.js');

const callOg = async (query = {}) => {
  let statusCode = 200;
  let body;
  const headers = new Map();
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    setHeader(key, value) {
      headers.set(key.toLowerCase(), value);
      return this;
    },
    end(value) {
      body = value;
      return this;
    },
    json(value) {
      body = value;
      return this;
    },
  };

  await ogHandler({ query }, res);
  return { statusCode, headers, body };
};

describe('dynamic OG image share endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a 200 JPEG under the WhatsApp byte budget for a valid shared weather location', async () => {
    const res = await callOg({ lat: '-34.1', lon: '18.83', lang: 'en' });

    expect(res.statusCode).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/jpeg');
    expect(res.body).toBeInstanceOf(Buffer);
    expect(res.body.length).toBeGreaterThan(1000);
    // JPEG magic bytes (SOI marker) — the transcode really happened.
    expect(res.body[0]).toBe(0xff);
    expect(res.body[1]).toBe(0xd8);
    // WhatsApp silently drops oversized preview images (field failure 2026-07-06).
    expect(res.body.length).toBeLessThan(JPEG_BYTE_BUDGET);
  });

  it('uses the lang param to pull copy from the requested language bank', () => {
    const model = buildOgViewModel(weatherPayload, { lang: 'af' });

    expect(model.lang).toBe('af');
    expect(model.headline).toBe('Helder lug.');
    expect(model.witty).toBeTruthy();
    expect(model.witty).not.toBe('Pack sunscreen. Or move into a fridge.');
  });

  it('falls back to a safe default image when params are missing or invalid', async () => {
    const res = await callOg({});

    expect(res.statusCode).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/jpeg');
    expect(res.body).toBeInstanceOf(Buffer);
    expect(res.body.length).toBeGreaterThan(1000);
    expect(res.body.length).toBeLessThan(JPEG_BYTE_BUDGET);
  });

  it('sets browser + CDN cache headers (repeat crawler fetches served from edge)', async () => {
    const res = await callOg({ lat: '-34.1', lon: '18.83', lang: 'en' });

    expect(res.headers.get('cache-control')).toBe(CACHE_CONTROL);
    expect(res.headers.get('cache-control')).toContain('max-age=300');
    expect(res.headers.get('cache-control')).toContain('s-maxage=3600');
    expect(res.headers.get('cache-control')).toContain('stale-while-revalidate');
  });

  it('short-caches the fallback card when weather fails for VALID coords (no 1h CDN poisoning)', async () => {
    // Codex finding 2026-07-06: a transient limiter/provider failure must not
    // pin a generic card to this share URL at the CDN for an hour.
    weatherMock.mockImplementationOnce(async (_req, res) => res.status(429).json({ ok: false, error: 'rate limited' }));
    const res = await callOg({ lat: '-34.1', lon: '18.83', lang: 'af' });

    expect(res.statusCode).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/jpeg');
    expect(res.headers.get('cache-control')).toBe(DEGRADED_CACHE_CONTROL);
    expect(res.headers.get('cache-control')).not.toContain('s-maxage=3600');
  });
});

describe('OG card uses the same eligible witty pool as the app', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('same payload/context resolves the shared weekend-aware pool', () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 6, 4, 8, 0, 0)); // Saturday 10:00 SAST.
    const payload = {
      ...weatherPayload,
      location: { name: 'Cape Town, Western Cape', lat: -33.9249, lon: 18.4241 },
      now: { ...weatherPayload.now, conditionKey: 'clear' },
      daily: [{ ...weatherPayload.daily[0], conditionKey: 'clear' }],
      meta: { utcOffsetSeconds: 7200 },
    };
    const context = { day: 6, hour: 10, month: 7, lat: -33.9249, lon: 18.4241 };
    const appEligible = eligibleWittyPool({
      copy: WEATHER_COPY,
      tags: WITTY_DAY_TAGS,
      condition: 'clear',
      lang: 'en',
      context,
    }).pool;
    expect(appEligible).toEqual(dayAwarePool(WITTY_DAY_TAGS.witty.weekend, WEATHER_COPY.witty.weekend.en, context));

    const model = buildOgViewModel(payload, { lang: 'en' });
    expect(appEligible).toContain(model.witty);
  });
});

// F1 regression guard. The card's witty line must be gated by the LOCATION's
// local day (from payload.meta.utcOffsetSeconds), never the server's UTC day.
// buildOgViewModel picks lines[hashString(seed) % lines.length] over the
// day-filtered pool, seeded with the server-UTC date — so to make the assertion
// deterministic AND able to fail on the old top-level `payload.utcOffsetSeconds`
// read (which was always undefined → server-UTC), we pin a location whose hash
// lands on the one day-named fog line (fog[7] = "…just Tuesday.", tag 'tue').
describe('OG card gates the witty line by the LOCATION day, not server-UTC (F1)', () => {
  // Mirror of hashString in api/og.js — used only to pick a seed-hitting location.
  const hashString = (value) => {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
    return Math.abs(hash);
  };

  const FOG = WEATHER_COPY.witty.fog.en;
  const TUE_LINE = FOG[7]; // the only day-named fog line

  // On Tuesday nothing is filtered, so the pool is the full fog array and the
  // Tuesday line sits at index 7. Find a location whose seed selects index 7.
  const TUE_POOL_LEN = dayAwarePool(WITTY_DAY_TAGS.witty.fog, FOG, 2, 12).length;
  const locHittingTuesdayLine = (dateStr) => {
    for (let i = 0; i < 100000; i += 1) {
      const name = `FogTown${i}`;
      if (hashString(`${name}|fog|en|${dateStr}`) % TUE_POOL_LEN === 7) return name;
    }
    throw new Error('no location seed selected the Tuesday fog line');
  };

  const fogPayload = (name, utcOffsetSeconds) => ({
    ok: true,
    location: { name },
    now: { conditionKey: 'fog', tempC: 12 },
    daily: [{ conditionKey: 'fog' }],
    meta: { utcOffsetSeconds },
  });

  // First UTC instant on/after 2026-07-01 that is `hourUTC`:30 on weekday `dow`.
  const utcInstant = (dow, hourUTC) => {
    let ms = Date.UTC(2026, 6, 1, hourUTC, 30, 0);
    while (new Date(ms).getUTCDay() !== dow) ms += 86400000;
    return ms;
  };

  // The card runs on Vercel where the server TZ is UTC, so pin the test TZ to UTC:
  // the OLD fallback used locDate.getDay() (server-LOCAL), and a runner in the
  // location's own TZ (e.g. UTC+2) would mask the bug in one direction. Scoped +
  // restored so sibling test files keep their ambient TZ.
  let savedTZ;
  beforeAll(() => { savedTZ = process.env.TZ; process.env.TZ = 'UTC'; });
  afterAll(() => { if (savedTZ === undefined) delete process.env.TZ; else process.env.TZ = savedTZ; });
  afterEach(() => { vi.useRealTimers(); });

  it('INCLUDES the Tuesday line when it is Tuesday at the location but Monday at UTC', () => {
    // Server UTC = Monday 23:30; location UTC+2 → Tuesday 01:30.
    const nowMs = utcInstant(1, 23);
    expect(new Date(nowMs).getUTCDay()).toBe(1);                 // Mon at UTC
    expect(new Date(nowMs + 7200 * 1000).getUTCDay()).toBe(2);  // Tue at location
    vi.useFakeTimers();
    vi.setSystemTime(nowMs);

    const serverDate = new Date(nowMs).toISOString().slice(0, 10);
    const model = buildOgViewModel(fogPayload(locHittingTuesdayLine(serverDate), 7200), { lang: 'en' });

    // Location is Tuesday → the Tuesday line is in the pool and our seed selects
    // it. The old server-UTC (Monday) read filtered it out, so it could never be
    // produced here — this is the guard the old suite lacked.
    expect(model.witty).toBe(TUE_LINE);
  });

  it('EXCLUDES the Tuesday line when it is Monday at the location but Tuesday at UTC', () => {
    // Server UTC = Tuesday 00:30; location UTC-2 → Monday 22:30.
    const nowMs = utcInstant(2, 0);
    expect(new Date(nowMs).getUTCDay()).toBe(2);                 // Tue at UTC
    expect(new Date(nowMs - 7200 * 1000).getUTCDay()).toBe(1);  // Mon at location
    vi.useFakeTimers();
    vi.setSystemTime(nowMs);

    const serverDate = new Date(nowMs).toISOString().slice(0, 10);
    // This location WOULD select index 7 against the server-UTC (Tuesday) pool,
    // so the old read surfaces the Tuesday line on a Monday card.
    const model = buildOgViewModel(fogPayload(locHittingTuesdayLine(serverDate), -7200), { lang: 'en' });

    // Location is Monday → the Tuesday line must be filtered out, and the pick
    // must come from the Monday (location-day) pool.
    expect(model.witty).not.toBe(TUE_LINE);
    expect(dayAwarePool(WITTY_DAY_TAGS.witty.fog, FOG, 1, 22)).toContain(model.witty);
  });
});

// BRIEF 1 / Task 4 — WhatsApp share redesign (M-2/M-3). The share must send the
// branded /api/og card (not a /og/*.jpg stock photo), reproduce the sender's
// on-screen condition, and never ship an impossible combination (night-cap).
describe('branded share link (M-2/M-3 pipeline)', () => {
  it('buildShareLink points at /share (branded card), not the ?bg= root, and threads ?c=', () => {
    const link = buildShareLink({ lat: -34.1, lon: 18.83, lang: 'af', condition: 'partly-cloudy' });
    const u = new URL(link);
    expect(u.origin).toBe('https://probablyweather.co.za');
    expect(u.pathname).toBe('/share');          // branded, server-rendered card
    expect(link).not.toContain('/?bg=');         // NOT the old middleware stock-photo path
    expect(u.searchParams.get('lat')).toBe('-34.1');
    expect(u.searchParams.get('lon')).toBe('18.83');
    expect(u.searchParams.get('lang')).toBe('af');
    expect(u.searchParams.get('c')).toBe('partly-cloudy');
  });

  it('buildShareLink rounds coords to 2 decimals (~1km) to keep the URL short', () => {
    const link = buildShareLink({ lat: 40.7856117, lon: -74.0093129, lang: 'af', condition: 'rain' });
    const u = new URL(link);
    expect(u.searchParams.get('lat')).toBe('40.79');
    expect(u.searchParams.get('lon')).toBe('-74.01');
    // Full-precision coords must never leak into the share URL.
    expect(link).not.toContain('40.7856117');
  });

  it('buildShareLink refuses non-number coords (no Number() canonicalisation of junk)', () => {
    // Codex finding 2026-07-06: Number('0x10') = 16 would turn junk into a
    // valid-looking coord BEFORE the server's strict parseCoord gate.
    const link = buildShareLink({ lat: '0x10', lon: '0x10', lang: 'en' });
    const u = new URL(link);
    expect(u.searchParams.get('lat')).toBeNull();
    expect(u.searchParams.get('lon')).toBeNull();
  });

  it('buildOgImageUrl threads the sanitized condition into the dynamic card URL', () => {
    const og = buildOgImageUrl({ lat: -34.1, lon: 18.83, lang: 'en', condition: 'cold-clear' });
    expect(new URL(og).searchParams.get('c')).toBe('cold-clear');
  });

  it('sanitizeRawCondition keeps valid conditions and rejects junk', () => {
    expect(sanitizeRawCondition('partly-cloudy')).toBe('partly-cloudy');
    expect(sanitizeRawCondition('COLD-CLEAR')).toBe('cold-clear');
    expect(sanitizeRawCondition('drop table')).toBe('');   // space → rejected
    expect(sanitizeRawCondition('')).toBe('');
    expect(sanitizeRawCondition(undefined)).toBe('');
  });

  it('normalizeConditionParam (api/og.js) allowlists against the copy banks', () => {
    expect(normalizeConditionParam('partly-cloudy')).toBe('partly-cloudy');
    expect(normalizeConditionParam('night')).toBe('night');
    expect(normalizeConditionParam('nonsense')).toBeNull();
    expect(normalizeConditionParam('')).toBeNull();
  });
});

describe('OG share card threads the sender condition (?c=) + respects the night-cap', () => {
  afterEach(() => { vi.useRealTimers(); });

  const payloadWith = ({ conditionKey = 'clear', offsetS = 7200 } = {}) => ({
    ...weatherPayload,
    location: { name: 'Cape Town, Western Cape', lat: -33.9249, lon: 18.4241 },
    now: { ...weatherPayload.now, conditionKey },
    daily: [{ ...weatherPayload.daily[0], conditionKey }],
    meta: { utcOffsetSeconds: offsetS },
  });

  it('conditionOverride drives the card condition, background and headline', () => {
    // Sender screen shows partly-cloudy even though the fresh fetch derived clear.
    const model = buildOgViewModel(payloadWith({ conditionKey: 'clear' }), { lang: 'en', conditionOverride: 'partly-cloudy' });
    expect(model.condition).toBe('partly-cloudy');
    expect(model.backgroundPath).toBe('og/cloudy.jpg');   // OG alias folds partly-cloudy → cloudy
    expect(model.headline).toBe(WEATHER_COPY.headlines['partly-cloudy'].en);
  });

  it('without an override, the card uses the weather-derived condition', () => {
    const model = buildOgViewModel(payloadWith({ conditionKey: 'rain' }), { lang: 'en' });
    expect(model.condition).toBe('rain');
    expect(model.headline).toBe(WEATHER_COPY.headlines.rain.en);
  });

  it('night-cap: a night override in a DAYTIME context falls back to the day pool (no impossible combo)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 6, 6, 12, 0, 0)); // Mon 12:00 UTC → local 14:00 (UTC+2, daytime)
    const context = { day: 1, hour: 14, month: 7, lat: -33.9249, lon: 18.4241, fallbackCondition: 'clear' };
    const cappedPool = eligibleWittyPool({ copy: WEATHER_COPY, tags: WITTY_DAY_TAGS, condition: 'night', lang: 'en', context }).pool;
    const model = buildOgViewModel(payloadWith({ conditionKey: 'clear' }), { lang: 'en', conditionOverride: 'night' });
    expect(model.condition).toBe('night');                 // bg/label still reflect the sender's screen
    expect(cappedPool).toContain(model.witty);             // ...but the witty line came from the fallback pool
    expect(cappedPool).not.toEqual(WEATHER_COPY.witty.night.en); // proves the cap fired (not the night bin)
  });

  it('night-cap: a night override IN the night window keeps the night pool', () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 6, 6, 21, 0, 0)); // Mon 21:00 UTC → local 23:00 (UTC+2, night)
    const context = { day: 1, hour: 23, month: 7, lat: -33.9249, lon: 18.4241, fallbackCondition: 'clear' };
    const nightPool = eligibleWittyPool({ copy: WEATHER_COPY, tags: WITTY_DAY_TAGS, condition: 'night', lang: 'en', context }).pool;
    const model = buildOgViewModel(payloadWith({ conditionKey: 'clear' }), { lang: 'en', conditionOverride: 'night' });
    expect(nightPool).toContain(model.witty);
  });
});

describe('coord-less legacy share (?bg=<cond>, no lat/lon) → condition-matched fallback card', () => {
  // A legacy /?bg=storm link carries no coords, so /api/og renders the fallback
  // view-model (no weather fetch). It MUST honour the condition — not regress to
  // a generic clear card — so the WhatsApp preview still shows storm. This pins
  // the fix for the coord-less fidelity regression the middleware change exposed.
  it('honours a valid conditionOverride: right condition, localized headline, condition background', () => {
    const model = buildFallbackViewModel('en', 'storm');
    expect(model.condition).toBe('storm');
    expect(model.headline).toBe(WEATHER_COPY.headlines.storm.en);
    expect(model.backgroundPath).toBe('og/storm.jpg');
  });

  it('localizes the fallback headline (af)', () => {
    const model = buildFallbackViewModel('af', 'rain');
    expect(model.condition).toBe('rain');
    expect(model.headline).toBe(WEATHER_COPY.headlines.rain.af);
  });

  it('folds a partly-cloudy override to the cloudy OG background', () => {
    const model = buildFallbackViewModel('en', 'partly-cloudy');
    expect(model.condition).toBe('partly-cloudy');
    expect(model.backgroundPath).toBe('og/cloudy.jpg');
  });

  it('no override → the generic clear brand card (unchanged behavior)', () => {
    const model = buildFallbackViewModel('en');
    expect(model.condition).toBe('clear');
    expect(model.headline).toBe('South African weather');
    expect(model.backgroundPath).toBe('og/clear.jpg');
  });

  it('junk override is rejected → generic clear card (no crafted-condition injection)', () => {
    const model = buildFallbackViewModel('en', 'drop-table');
    expect(model.condition).toBe('clear');
  });
});
