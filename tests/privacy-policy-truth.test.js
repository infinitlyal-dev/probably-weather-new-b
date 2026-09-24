import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import {
  SNAP_DEGREES,
  WEATHER_CACHE_TTL_SECONDS,
  WEATHER_STALE_TTL_SECONDS,
  weatherCacheKey,
  weatherCacheSet,
} from '../api/_lib/weather-cache.js';

// Truth guard for privacy.html. POPIA makes an inaccurate privacy notice a real
// liability, not a copy nit: the policy has to describe what the code actually
// does. Two claims went stale and this file pins both to the source of truth —
//   1. "processed in memory and not retained" — untrue since the server-side
//      Upstash cache landed (api/_lib/weather-cache.js), which persists the
//      ensemble payload (INCLUDING the populating caller's exact coordinates at
//      api/weather.js:1993-1996) for up to WEATHER_STALE_TTL_SECONDS.
//   2. "ipapi.co is used as a location fallback" — untrue since the fallback
//      moved to same-origin /api/locate reading Vercel's x-vercel-ip-* headers.
// If the cache TTL or the fallback mechanism changes, these fail rather than
// letting the published policy drift away from the code again.

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

const privacy = read('../privacy.html');

/** The text of one <h2> section, up to the next <h2>. */
function section(heading) {
  const start = privacy.indexOf(`<h2>${heading}</h2>`);
  expect(start, `section "${heading}" is missing from privacy.html`).toBeGreaterThan(-1);
  const rest = privacy.slice(start + heading.length + 9);
  const end = rest.indexOf('<h2>');
  return end === -1 ? rest : rest.slice(0, end);
}

describe('privacy.html tells the truth about location data', () => {
  it('names no third-party IP-lookup service (ipapi.co is gone from the code)', () => {
    expect(privacy.toLowerCase()).not.toContain('ipapi');
  });

  it('discloses the server-side forecast cache and its 15-minute lifetime', () => {
    expect(privacy).toMatch(/cach/i);
    expect(privacy).toMatch(/15 minutes|fifteen minutes/i);
  });

  it('discloses the ~2 km location cell the cache is keyed by', () => {
    expect(privacy).toMatch(/2\s?km|two kilometre/i);
  });

  it('names the actual IP-location mechanism inside the IP-based location section', () => {
    // A bare /Vercel/ match over the whole page is worthless — Vercel is named
    // in analytics, hosting and cross-border too. The MECHANISM must be stated
    // where the fallback is described: our own endpoint, and Vercel deriving
    // the position from the IP address (api/locate.js:20-41).
    const ip = section('IP-based location');
    expect(ip).toContain('/api/locate');
    expect(ip).toMatch(/Vercel/);
    expect(ip).toMatch(/from your IP address/i);
    expect(ip).toMatch(/no third-party IP-lookup service is contacted/i);
  });

  it('does not deny that an IP-derived lookup happens at all', () => {
    // The previous guard accepted a rewrite that replaced the paragraph with
    // "No IP location lookup is used" — which is false: api/locate.js DOES
    // derive a position from the IP address, it just does so via our host
    // rather than a third party. Denying the lookup outright must fail.
    const ip = section('IP-based location');
    expect(ip).not.toMatch(/\bno\b[^.]*\bIP\b[^.]*\b(lookup|location)[^.]*\bis\b[^.]*\b(used|made|performed|carried out)/i);
    expect(ip).not.toMatch(/we do not (use|derive|determine)[^.]*IP address/i);
  });

  it('drops the "processed in memory and not retained" claim', () => {
    expect(privacy).not.toMatch(/processed in memory and are not retained/i);
  });

  it('discloses the CDN response cache, which holds the coordinates in the URL', () => {
    // api/weather.js:221,1881 — s-maxage=300 + stale-while-revalidate=60 (~6 min)
    // on a body carrying the CURRENT caller's lat/lon (lines 224-228).
    // api/geocode.js:229 — s-maxage=600 + stale-while-revalidate=1800 (~40 min).
    const loc = section('Location data');
    expect(loc).toMatch(/content-delivery network|delivery network|CDN/i);
    expect(loc).toMatch(/6 minutes/);
    expect(loc).toMatch(/40 minutes/);
  });

  it('discloses the share-card and share-redirect caches', () => {
    // api/og.js:25 CACHE_CONTROL — max-age=300, s-maxage=3600,
    // stale-while-revalidate=86400 on a card whose URL carries the shared
    // coordinates. api/og.js:531 — s-maxage=86400 on the 301 that canonicalises
    // an over-precise share URL, filed under the UNROUNDED incoming address.
    const loc = section('Location data');
    expect(loc).toMatch(/share-preview card|share card/i);
    expect(loc).toMatch(/1 hour/);
    expect(loc).toMatch(/24 hours/);
    expect(loc).toMatch(/redirect/i);
    expect(loc).toMatch(/unrounded/i);
  });

  it('attributes the two-decimal rounding to /api/og and discloses the /share page cache', () => {
    // api/og.js:77,91-92,531 — the rounding redirect belongs to the preview
    // IMAGE. api/share.js:149-152,164 embeds the incoming coordinates verbatim
    // in the HTML, and :196 asks for max-age=300, s-maxage=300.
    const loc = section('Location data');
    expect(loc).toMatch(/\/api\/og/);
    expect(loc).toMatch(/\/share/);
    expect(loc).toMatch(/5 minutes/);
  });

  it('discloses the on-device service-worker and browser-database copies', () => {
    // sw.js:131 API_CACHE_MAX_AGE = 3 h, :129-130 caps of 60 and 32, :313 the
    // /api/og cache has no age gate. assets/app.js:166 CACHE_MAX_AGE = 30 min,
    // :184 key at 3 decimals, :193,204 read gate and write.
    const loc = section('Location data');
    expect(loc).toMatch(/service worker/i);
    expect(loc).toMatch(/3 hours/);
    expect(loc).toMatch(/30 minutes/);
    expect(loc).toMatch(/clear this site's data|clear the site's data/i);
    expect(loc).toMatch(/whatever their age/i);
  });

  it('discloses the per-install identifier and what it is for', () => {
    // Prelaunch item 1 (separate worktree at the time of writing): assets/app.js
    // installId() mints a random id into localStorage 'pw_install' and sends it
    // as the X-PW-Install header; api/_lib/rate-limit.js readInstallId validates
    // it and api/weather.js charges `${clientIp}:${installId}` against the
    // per-install minute/day buckets. The policy must name the storage key, the
    // header, and the abuse-protection purpose.
    const abuse = section('Abuse protection');
    expect(abuse).toMatch(/pw_install/);
    expect(abuse).toMatch(/X-PW-Install/);
    expect(abuse).toMatch(/abuse-protection counters|abuse protection/i);
    // It must not be sold as anonymous, nor as separate from the IP: the two
    // are combined in the counter label.
    expect(abuse).toMatch(/together with your IP address|with your IP address/i);
    expect(abuse).not.toMatch(/anonymous identifier/i);
    // And the browser-storage paragraph must acknowledge it lives on the device.
    expect(section('Location data')).toMatch(/install identifier/i);
  });

  it('does not present the cache windows as deletion times', () => {
    // Vercel's docs define s-maxage as how long a response is considered fresh,
    // after which the CDN serves stale while revalidating — eviction timing is
    // not specified. The policy must say so rather than promise deletion.
    const loc = section('Location data');
    expect(loc).toMatch(/not deletion times|are not deletion times/i);
    expect(loc).toMatch(/we have not verified/i);
    expect(privacy).not.toMatch(/Each of those expires on its own within the periods stated/i);
  });

  it('discloses the per-IP rate-limit counters, their store and their windows', () => {
    // api/_lib/rate-limit.js:44 keys the limiter on the raw client IP;
    // api/_lib/limiters.js:46-51 defines a counter per endpoint over a 60 s or
    // 1 d window, stored in Upstash Redis.
    const abuse = section('Abuse protection');
    expect(abuse).toMatch(/IP address/i);
    expect(abuse).toMatch(/counter/i);
    expect(abuse).toMatch(/Upstash/);
    expect(abuse).toMatch(/minute/i);
    expect(abuse).toMatch(/day/i);
    expect(abuse).toMatch(/48 hours/);
    // The expiry is set once at bucket creation (window*2+1000 ms), so the
    // policy must not say it counts from the user's last request.
    expect(abuse).toMatch(/created/i);
    expect(abuse).not.toMatch(/after your last request/i);
  });

  it('states the forecast is asked for on the ~2 km grid, GPS and searched places alike', () => {
    // fetchProbable snaps lat/lon to the server's 0.02° cache grid (snapToCacheGrid) before the
    // request leaves the phone; the place-name lookup keeps the four decimals GPS is rounded to.
    const loc = section('Location data');
    expect(loc).toContain('rounded before they leave your device: to about 2 km when the app asks for a forecast, and to four decimal places (about 10 m) when it looks up the name of your place.');
    expect(loc).toContain('If instead you choose a place from the search box, its forecast is asked for on the same 2 km grid.');
    expect(loc).toContain('The forecast stored inside carries the coordinates it was fetched for, which are that grid point — about 2 km — not your position.');
    expect(loc).not.toMatch(/we do not round those/i);
  });

  it('makes no categorical anonymity claim about the cache', () => {
    // Absence of identity fields is not anonymity: the entries hold precise
    // coordinates. The policy may list which identifiers are absent, and stop.
    expect(privacy).not.toMatch(/link it back to you/i);
    expect(privacy).not.toMatch(/link two of your visits/i);
    expect(privacy).not.toMatch(/the only thing we store/i);
    expect(privacy).not.toMatch(/never written down at all/i);
    expect(privacy).not.toMatch(/the one place we hold coordinates/i);
  });
});

describe('the client no longer contacts a third-party IP-lookup service', () => {
  // Explanatory comments in assets/app.js and index.html still mention ipapi.co
  // as removed history, which is accurate. What must not exist is a LIVE
  // reference: a URL the browser could fetch, or a connection hint to that host.
  for (const file of ['../assets/app.js', '../index.html', '../sw.js']) {
    it(`${file} contains no ipapi.co URL`, () => {
      expect(read(file)).not.toMatch(/https?:\/\/(www\.)?ipapi\.co/i);
    });
  }

  it('index.html has no preconnect/dns-prefetch to ipapi.co', () => {
    expect(read('../index.html')).not.toMatch(/<link[^>]*(preconnect|dns-prefetch)[^>]*ipapi/i);
  });
});

describe('the cache constants still match what the policy promises', () => {
  it('stale TTL is the 15 minutes the policy states', () => {
    expect(WEATHER_STALE_TTL_SECONDS).toBe(900);
    expect(WEATHER_STALE_TTL_SECONDS / 60).toBe(15);
  });

  it('the cache grid is still the ~2 km cell the policy states', () => {
    expect(SNAP_DEGREES).toBe(0.02);
  });
});

describe('what weatherCacheSet actually writes matches the policy', () => {
  // Constants alone can drift from behaviour. This drives the real writer with
  // a fake redis (same pattern as tests/server-weather-cache.test.js) so the
  // sentences "carries the coordinates it was fetched for, at whatever
  // precision the request used", "refreshed after 5 minutes" and "deleted
  // automatically after 15 minutes" are pinned to serialization, not to prose.
  const fakeRedis = (store = new Map()) => ({
    store,
    setCalls: [],
    async get(key) { return store.get(key) ?? null; },
    async set(key, value, opts) { this.setCalls.push({ key, value, opts }); store.set(key, value); },
  });

  // Deliberately more precise than the GPS path's 4dp — the search path
  // (assets/app.js:2974-2975) passes the provider's value through unrounded.
  const PRECISE_LAT = -34.116312345;
  const PRECISE_LON = 18.836254321;

  it('stores the caller coordinates at full precision under both TTLs', async () => {
    const redis = fakeRedis();
    const key = weatherCacheKey(PRECISE_LAT, PRECISE_LON);
    const payload = {
      ok: true,
      location: { name: 'Strand, Western Cape', lat: PRECISE_LAT, lon: PRECISE_LON },
      meta: { serverCache: 'miss' },
    };

    expect(await weatherCacheSet(key, payload, redis)).toBe(true);
    expect(redis.setCalls).toHaveLength(2);

    const fresh = redis.setCalls.find((c) => c.key === key);
    const stale = redis.setCalls.find((c) => c.key === `${key}:stale`);
    expect(fresh, 'fresh entry must be written').toBeTruthy();
    expect(stale, 'stale entry must be written').toBeTruthy();

    // The policy says the entry carries the coordinates it was fetched for, at
    // the precision the request used — not the snapped cell.
    for (const call of [fresh, stale]) {
      const stored = JSON.parse(call.value);
      expect(stored.location.lat).toBe(PRECISE_LAT);
      expect(stored.location.lon).toBe(PRECISE_LON);
    }

    // ...and the key is the ~2 km cell, carrying no identity and no exact point.
    expect(fresh.key).toBe('pw-wx:v2:-34.12,18.84');

    // "refreshed after 5 minutes ... deleted automatically after 15 minutes"
    expect(fresh.opts).toEqual({ ex: 300 });
    expect(stale.opts).toEqual({ ex: 900 });
    expect(fresh.opts.ex).toBe(WEATHER_CACHE_TTL_SECONDS);
    expect(stale.opts.ex).toBe(WEATHER_STALE_TTL_SECONDS);
  });
});

// The seam both the cache and the limiters share (api/_lib/weather-cache.js:17,
// api/weather.js:17). Mocking getRedis lets the REAL weather-cache
// serialization run, so the TTL options asserted below are the shipped ones.
// vi.mock is hoisted; the factory only runs at the dynamic import inside the
// test, by which time handlerRedis is initialised.
const handlerRedis = {
  setCalls: [],
  async get() { return null; },                    // always a miss → full fan-out
  // 'OK' matters: weatherCacheAcquireLock treats anything else as "another
  // instance holds the miss lock" and then blocks for WEATHER_LOCK_WAIT_MS.
  async set(key, value, opts) { this.setCalls.push({ key, value, opts }); return 'OK'; },
  // Redis's EVAL command (the lock-release Lua in weather-cache.js), not
  // JavaScript eval — this stub runs no code, it just returns 0.
  async eval() { return 0; },
};

vi.mock('../api/_lib/limiters.js', () => ({
  getRedis: () => handlerRedis,
  // null limiter → fail-open, no rate limiting. Item 1 split the flat weather
  // limiters into a forecast family and a ?reverse=1 family.
  weatherMinuteInstallLimiter: () => null,
  weatherDailyInstallLimiter: () => null,
  weatherMinuteIpLimiter: () => null,
  weatherDailyIpLimiter: () => null,
  reverseMinuteInstallLimiter: () => null,
  reverseDailyInstallLimiter: () => null,
  reverseMinuteIpLimiter: () => null,
  reverseDailyIpLimiter: () => null,
  geocodeLimiter: () => null,
  errorsLimiter: () => null,
  ogLimiter: () => null,
  RATE_LIMITS: {},
}));

describe('what the weather handler actually hands the cache writer', () => {
  // The policy says the stored forecast "carries the coordinates it was fetched
  // for — at whatever precision the request that filled the cache used", is
  // "refreshed after 5 minutes" and "deleted automatically after 15 minutes".
  // Drive the real handler end to end and read the values off the fake Redis.
  const REQ_LAT = -34.116312345;   // deliberately finer than the GPS path's 4dp
  const REQ_LON = 18.836254321;

  const ok = (payload) => ({ ok: true, status: 200, json: async () => payload });
  const fill = (n, v) => Array(n).fill(v);

  const openMeteo = {
    utc_offset_seconds: 7200,
    current: { temperature_2m: 20, apparent_temperature: 20, weather_code: 0, wind_speed_10m: 10, wind_gusts_10m: 14, relative_humidity_2m: 55, cloud_cover: 10 },
    hourly: {
      temperature_2m: fill(48, 20), apparent_temperature: fill(48, 20),
      precipitation_probability: fill(48, 0), precipitation: fill(48, 0),
      wind_speed_10m: fill(48, 10), wind_gusts_10m: fill(48, 14),
      cloud_cover: fill(48, 10), relative_humidity_2m: fill(48, 55),
      uv_index: fill(48, 4), weather_code: fill(48, 0),
      visibility: fill(48, 20000), dew_point_2m: fill(48, 10),
    },
    daily: {
      temperature_2m_max: fill(7, 24), temperature_2m_min: fill(7, 14),
      precipitation_probability_max: fill(7, 0), uv_index_max: fill(7, 6),
      weather_code: fill(7, 0), wind_speed_10m_max: fill(7, 12),
      sunrise: fill(7, '2026-09-14T07:00'), sunset: fill(7, '2026-09-14T18:00'),
    },
  };
  const weatherApi = {
    location: { tz_id: 'Africa/Johannesburg' },
    current: { temp_c: 20, feelslike_c: 20, condition: { code: 1000, text: 'Sunny' }, wind_kph: 10, humidity: 55 },
    forecast: { forecastday: Array.from({ length: 7 }, () => ({
      day: { maxtemp_c: 24, mintemp_c: 14, totalprecip_mm: 0, daily_chance_of_rain: 0, uv: 6, maxwind_kph: 12, condition: { code: 1000, text: 'Sunny' } },
      astro: { sunrise: '07:00 AM', sunset: '06:00 PM' },
      hour: Array.from({ length: 24 }, () => ({ temp_c: 20, feelslike_c: 20, chance_of_rain: 0, precip_mm: 0, wind_kph: 10, cloud: 10, humidity: 55, condition: { code: 1000, text: 'Sunny' } })),
    })) },
  };
  const pirate = {
    offset: 2,
    currently: { temperature: 20, windSpeed: 3, windGust: 4, humidity: 0.55, icon: 'clear-day' },
    daily: { data: Array.from({ length: 7 }, () => ({ temperatureHigh: 24, temperatureLow: 14, precipProbability: 0, uvIndex: 6, windSpeed: 3, cloudCover: 0.1, icon: 'clear-day', sunriseTime: 1789707600, sunsetTime: 1789747200 })) },
  };
  const met = {
    properties: { timeseries: Array.from({ length: 48 }, (_, i) => ({
      time: new Date(Date.now() + i * 3600000).toISOString(),
      data: {
        instant: { details: { air_temperature: 20, wind_speed: 3, relative_humidity: 55, cloud_area_fraction: 10 } },
        next_1_hours: { summary: { symbol_code: 'clearsky_day' }, details: { precipitation_amount: 0 } },
      },
    })) },
  };
  const tomorrow = {
    data: { timelines: [{ intervals: Array.from({ length: 48 }, (_, i) => ({
      startTime: new Date(Date.now() + i * 3600000).toISOString(),
      values: { temperature: 20, precipitationIntensity: 0, precipitationProbability: 0, weatherCode: 1000, windSpeed: 3, humidity: 55, cloudCover: 10 },
    })) }] },
  };

  beforeEach(() => {
    handlerRedis.setCalls.length = 0;
    process.env.WEATHERAPI_KEY = 'k';
    process.env.PIRATE_WEATHER_KEY = 'k';
    process.env.TOMORROWIO_API_KEY = 'k';
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const href = String(url);
      if (href.startsWith('https://api.open-meteo.com/')) return ok(openMeteo);
      if (href.startsWith('https://api.weatherapi.com/')) return ok(weatherApi);
      if (href.startsWith('https://api.pirateweather.net/')) return ok(pirate);
      if (href.startsWith('https://api.met.no/')) return ok(met);
      if (href.startsWith('https://api.tomorrow.io/')) return ok(tomorrow);
      // LocationIQ name resolution and anything else: no result, not an error.
      return { ok: false, status: 404, json: async () => ({}) };
    }));
  });

  afterEach(() => {
    delete process.env.WEATHERAPI_KEY;
    delete process.env.PIRATE_WEATHER_KEY;
    delete process.env.TOMORROWIO_API_KEY;
    vi.unstubAllGlobals();
  });

  it('writes the request coordinates at full precision under ex:300 and ex:900', async () => {
    const { default: handler } = await import('../api/weather.js');
    let body;
    const res = {
      setHeader() { return this; },
      status() { return this; },
      json(payload) { body = payload; return this; },
    };
    await handler(
      { query: { lat: String(REQ_LAT), lon: String(REQ_LON) }, headers: { 'x-real-ip': '196.1.1.9' } },
      res,
    );
    expect(body?.ok).toBe(true);

    // The cache key is the ~2 km cell, not the exact point. Match on it
    // exactly — setCalls also holds the short-lived miss-lock write.
    const CELL_KEY = 'pw-wx:v2:-34.12,18.84';
    expect(weatherCacheKey(REQ_LAT, REQ_LON)).toBe(CELL_KEY);

    // The deferred write is started synchronously inside the handler; let the
    // already-in-flight promise settle against the fake.
    const written = () => handlerRedis.setCalls.filter((c) => c.key === CELL_KEY || c.key === `${CELL_KEY}:stale`);
    for (let i = 0; i < 50 && written().length < 2; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    const fresh = handlerRedis.setCalls.find((c) => c.key === CELL_KEY);
    const stale = handlerRedis.setCalls.find((c) => c.key === `${CELL_KEY}:stale`);
    expect(fresh, 'fresh cache entry must be written').toBeTruthy();
    expect(stale, 'stale cache entry must be written').toBeTruthy();

    // ...but the stored payload carries the REQUEST's exact coordinates, which
    // is precisely what the policy now admits.
    for (const call of [fresh, stale]) {
      const stored = JSON.parse(call.value);
      expect(stored.location.lat).toBe(REQ_LAT);
      expect(stored.location.lon).toBe(REQ_LON);
    }

    expect(fresh.opts).toEqual({ ex: WEATHER_CACHE_TTL_SECONDS });
    expect(stale.opts).toEqual({ ex: WEATHER_STALE_TTL_SECONDS });
    expect(fresh.opts.ex).toBe(300);
    expect(stale.opts.ex).toBe(900);
  }, 20000);
});

describe('the installed rate limiter expires counters the way the policy says', () => {
  // The policy states the expiry is set ONCE when a counter is created, to
  // twice its window — not rolling from the last request. That claim lives in
  // the vendored library, so assert against the shipped script text.
  const require = createRequire(import.meta.url);
  const dist = readFileSync(require.resolve('@upstash/ratelimit/dist/index.mjs'), 'utf8');

  it('sets PEXPIRE to window * 2 + 1000 ms, guarded to first use of the bucket', () => {
    expect(dist).toContain('redis.call("PEXPIRE", currentKey, window * 2 + 1000)');
    // The guard is what makes it "from creation" rather than "from last request".
    expect(dist).toMatch(/if requestsInCurrentWindow == 0 then[\s\S]{0,240}?PEXPIRE", currentKey, window \* 2 \+ 1000\)/);
  });

  it('yields the lifetimes the policy quotes for a 60 s and a 1 d window', () => {
    const lifetimeMs = (windowMs) => windowMs * 2 + 1000;
    expect(lifetimeMs(60_000)).toBe(121_000);               // "a little over two minutes"
    expect(lifetimeMs(24 * 60 * 60_000)).toBe(172_801_000);  // "about 48 hours"
    expect(lifetimeMs(24 * 60 * 60_000) / 3_600_000).toBeCloseTo(48.0, 2);
  });
});

// Published on Al's word, 25 Sept 2026 ("just publish the damn privacy page already"): the draft
// marker is gone, and the ad choice is described as what happens once Google ads start — no ad
// network loads today, and Settings has no "Ad choices" yet.
describe('the published page', () => {
  it('carries no draft marker, only the date', () => {
    expect(privacy).not.toMatch(/DRAFT|not published/);
    expect(privacy).toContain('<p class="date">Last updated: 25 September 2026</p>');
  });
  it('describes the ad choice as coming with the first Google ads', () => {
    const ads = section('Your ad choice: ads picked for you, or general ads');
    expect(ads).toContain('When Google ads start, the app will ask you once whether Google may pick ads for you.');
    expect(ads).toContain('Once ads start, you can change it at any time under Settings → Ad choices.');
    expect(ads).not.toContain('Before the first Google ad loads, the app asks you once');
  });
});
