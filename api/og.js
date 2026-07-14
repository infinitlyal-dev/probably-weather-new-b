import { readFile } from 'node:fs/promises';

import satori from 'satori';
import sharp from 'sharp';

import weatherHandler from './weather.js';
import { checkRateLimit, getClientIp } from './_lib/rate-limit.js';
import { ogLimiter } from './_lib/limiters.js';
import { WEATHER_COPY } from '../assets/weather-copy.js';
// L2 dedupe: one language list for the whole app (was three copies).
import { SUPPORTED_LANGS } from '../assets/language-preferences.js';
import {
  getOgStaticBackgroundFallbackChain,
  getOgStaticBackgroundPath,
  getTimeOfDaySlot,
} from '../assets/weather-visuals.js';
import { WITTY_DAY_TAGS, eligibleWittyPool } from '../assets/witty-day-tags.js';

export const config = { runtime: 'nodejs' };
// s-maxage=3600: Vercel's CDN keys on the full URL (query included), so a
// repeat crawler fetch of the same share link is served from the edge without
// re-rendering. stale-while-revalidate keeps even an expired card instant for
// the crawler while the refresh happens in the background — WhatsApp's
// preview fetcher gives up fast on slow origins.
export const CACHE_CONTROL = 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400';

// Degraded renders (weather fetch failed for VALID coords, or the primary
// render threw) must not poison the CDN for an hour with a generic card under
// a real share URL — cache them just long enough to absorb a crawler burst.
export const DEGRADED_CACHE_CONTROL = 'public, max-age=60, s-maxage=60';

// WhatsApp silently drops large link-preview images (branded card rendered
// fine for the crawler but never showed on the phone — field evidence
// 2026-07-06). Hard budget: every card ships as JPEG under 300KB.
export const JPEG_BYTE_BUDGET = 300 * 1024;
const JPEG_QUALITY = 82;

const WIDTH = 1200;
const HEIGHT = 630;
const BACKGROUND_DATA_URL_CACHE = new Map();
const FONT_DATA_PROMISE = readFile(new URL('../og/Geist-Regular.ttf', import.meta.url));

const STAT_LABELS = {
  en: { wind: 'Wind', rain: 'Rain', uv: 'UV' },
  af: { wind: 'Wind', rain: 'Reën', uv: 'UV' },
  zu: { wind: 'Umoya', rain: 'Imvula', uv: 'UV' },
  xh: { wind: 'Umoya', rain: 'Imvula', uv: 'UV' },
  st: { wind: 'Moya', rain: 'Pula', uv: 'UV' },
};

const h = (type, props = {}, ...children) => ({
  type,
  props: {
    ...props,
    children: children.length === 1 ? children[0] : children,
  },
});

const isNum = (value) => Number.isFinite(Number(value));
const round = (value) => Math.round(Number(value));
const clampLang = (lang) => SUPPORTED_LANGS.includes(lang) ? lang : 'en';
const formatTemp = (value) => isNum(value) ? `${round(value)}°` : null;

// Strict coordinate parser — single implementation (L2 dedupe). This endpoint
// is a SECOND entry point into the weather aggregation (callWeatherHandler →
// weatherHandler), so it must reject malformed coords with the same rigor or
// it re-opens the quota-burn hole the /api/weather guard closes. NaN on
// reject → hasValidCoords falls back to the generic OG card (no weather call).
import { parseCoord } from '../assets/coord-parse.js';

function getQuery(req) {
  if (req?.query) return req.query;
  const url = new URL(req?.url || '/', 'https://probablyweather.co.za');
  return Object.fromEntries(url.searchParams.entries());
}

const formatShareCoord = (value) => String(Math.round(value * 100) / 100);

export function canonicalizeOgRequest(req) {
  const requestUrl = req?.url ? new URL(req.url, 'https://probablyweather.co.za') : null;
  const query = requestUrl ? Object.fromEntries(requestUrl.searchParams.entries()) : getQuery(req);
  const lang = clampLang(String(query.lang || 'en').toLowerCase());
  const lat = parseCoord(query.lat);
  const lon = parseCoord(query.lon);
  const hasValidCoords = Number.isFinite(lat) && Number.isFinite(lon)
    && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  const conditionOverride = normalizeConditionParam(query.c);
  const params = new URLSearchParams({ lang });

  if (hasValidCoords) {
    params.set('lat', formatShareCoord(lat));
    params.set('lon', formatShareCoord(lon));
  }
  if (conditionOverride) params.set('c', conditionOverride);

  const canonicalQuery = params.toString();
  return {
    lang,
    lat: hasValidCoords ? Number(params.get('lat')) : Number.NaN,
    lon: hasValidCoords ? Number(params.get('lon')) : Number.NaN,
    hasValidCoords,
    conditionOverride,
    canonicalPath: `/api/og?${canonicalQuery}`,
    // Direct unit callers often provide req.query without an HTTP URL. They
    // still receive normalized values, but only a real request can redirect.
    needsRedirect: Boolean(requestUrl && requestUrl.searchParams.toString() !== canonicalQuery),
  };
}

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function pickLocalized(bank, key, lang, fallback = '') {
  const entry = bank?.[key] || bank?.clear;
  return entry?.[lang] || entry?.en || fallback;
}

function pickWitty(condition, lang, seed, context) {
  // Resolve the bin/register the same way as the app, then apply the SAME
  // context + empty-slot filter (witty-day-tags.js). Deterministic hash pick
  // over the filtered pool.
  const { pool: lines } = eligibleWittyPool({
    copy: WEATHER_COPY,
    tags: WITTY_DAY_TAGS,
    condition,
    lang,
    context,
  });
  if (lines.length === 0) return '';
  return lines[hashString(seed) % lines.length];
}

// Display conditions the client may thread via ?c= on a share card. Validated
// against the copy banks so a crafted /api/og?c=<junk> can't select an unknown
// bin — junk (or absent) falls back to the weather-derived condition. Semantic
// gate on top of share-url.js's format sanitizer.
const KNOWN_CONDITIONS = new Set(Object.keys(WEATHER_COPY.headlines));
export function normalizeConditionParam(value) {
  if (!value) return null;
  const v = String(value).toLowerCase().trim();
  return KNOWN_CONDITIONS.has(v) ? v : null;
}

// Owner-ruled plausibility graph for a sender's display condition versus the
// freshly fetched live condition. Links are explicit and symmetric: storm ↔
// rain ↔ rain-possible is a chain (storm is not adjacent to rain-possible),
// clear ↔ partly-cloudy, clear ↔ UV/night, and cloudy neighbours the softer
// visibility/wind states. Severe overrides are stricter below: storm-family,
// heat, and cold may only stand when live weather is in that same family.
export const CONDITION_ADJACENCY = Object.freeze({
  clear:          ['partly-cloudy', 'uv', 'night'],
  'partly-cloudy': ['clear', 'cloudy', 'rain-possible'],
  cloudy:         ['partly-cloudy', 'fog', 'rain-possible', 'wind'],
  fog:            ['cloudy'],
  wind:           ['cloudy'],
  uv:             ['clear'],
  night:          ['clear'],
  'rain-possible': ['partly-cloudy', 'cloudy', 'rain'],
  rain:           ['rain-possible', 'storm', 'thunder', 'hail'],
  storm:          ['rain', 'thunder', 'hail'],
  thunder:        ['rain', 'storm', 'hail'],
  hail:           ['rain', 'storm', 'thunder'],
  heat:           [],
  cold:           ['cold-clear'],
  'cold-clear':   ['cold'],
});

const SEVERE_OVERRIDE_FAMILIES = Object.freeze({
  storm:       new Set(['storm', 'thunder', 'hail']),
  thunder:     new Set(['storm', 'thunder', 'hail']),
  hail:        new Set(['storm', 'thunder', 'hail']),
  heat:        new Set(['heat']),
  cold:        new Set(['cold', 'cold-clear']),
  'cold-clear': new Set(['cold', 'cold-clear']),
});

export function verifyConditionOverride(conditionOverride, liveCondition) {
  const live = normalizeConditionParam(liveCondition) || 'clear';
  const requested = normalizeConditionParam(conditionOverride);
  if (!requested || requested === live) return live;

  const severeFamily = SEVERE_OVERRIDE_FAMILIES[requested];
  if (severeFamily) return severeFamily.has(live) ? requested : live;
  return CONDITION_ADJACENCY[live]?.includes(requested) ? requested : live;
}

export function buildOgViewModel(payload, options = {}) {
  const lang = clampLang(options.lang);
  const now = payload?.now || payload?.current || {};
  const today = payload?.daily?.[0] || {};
  const location = payload?.location?.name || options.locationName || 'South Africa';
  const locationLat = payload?.location?.lat;
  const locationLon = payload?.location?.lon;
  // ?c= reproduces an honest sender's on-screen condition only when it matches
  // or plausibly neighbours the live weather. Implausible values silently fall
  // back to live truth; generic no-coordinate cards are handled separately.
  const derivedCondition = now.conditionKey || today.conditionKey || 'clear';
  const condition = verifyConditionOverride(options.conditionOverride, derivedCondition);
  // Compute timeOfDay server-side from the same sunrise/sunset signals the
  // browser uses. This is what picks one of 36 canonical OG sources
  // (9 conditions × 4 times). Falls back to 'day' if signals are missing.
  const timeOfDay = getTimeOfDaySlot(payload);
  const low = formatTemp(today.lowC ?? today.minC ?? now.tempC ?? now.temperature_2m);
  const high = formatTemp(today.highC ?? today.maxC ?? now.tempC ?? now.temperature_2m);
  const current = formatTemp(now.tempC ?? now.temperature_2m);
  const tempRange = low && high && low !== high ? `${low} / ${high}` : (current || high || low || '--°');
  const labels = STAT_LABELS[lang] || STAT_LABELS.en;
  // Task 4 (2026-07-06): mirror the home byline — a stat with no source value
  // (e.g. UV after sunset) is dropped from the card, not rendered as "--".
  const wind = isNum(now.windKph ?? now.wind_kph ?? payload?.wind_kph) ? `${round(now.windKph ?? now.wind_kph ?? payload.wind_kph)} km/h` : null;
  const rain = isNum(now.rainChance ?? today.rainChance) ? `${round(now.rainChance ?? today.rainChance)}%` : null;
  const uv = isNum(now.uv ?? today.uv) ? String(round(now.uv ?? today.uv)) : null;
  const statParts = [
    wind != null ? `${labels.wind} ${wind}` : null,
    rain != null ? `${labels.rain} ${rain}` : null,
    uv != null ? `${labels.uv} ${uv}` : null,
  ].filter(Boolean);
  const seed = `${location}|${condition}|${lang}|${new Date().toISOString().slice(0, 10)}`;
  // Local day/hour at the shared location, so the card's witty line obeys the
  // same day-tags as the app (no "just Tuesday" line on a Friday share card).
  // The offset lives under meta — weather.js emits it at meta.utcOffsetSeconds
  // (read back the same way at weather.js:192; getTimeOfDaySlot also reads it
  // from meta). A top-level read here was always undefined, silently falling the
  // card back to server-UTC day/hour and gating witty by the wrong day.
  const offsetS = payload?.meta?.utcOffsetSeconds;
  const locMs = isNum(offsetS) ? Date.now() + Number(offsetS) * 1000 : Date.now();
  const locDate = new Date(locMs);
  const day = isNum(offsetS) ? locDate.getUTCDay() : locDate.getDay();
  const hour = isNum(offsetS) ? locDate.getUTCHours() : locDate.getHours();
  const month = isNum(offsetS) ? locDate.getUTCMonth() + 1 : locDate.getMonth() + 1;
  const wittyContext = { day, hour, lat: locationLat, lon: locationLon, month, fallbackCondition: derivedCondition };

  return {
    lang,
    location,
    condition,
    timeOfDay,
    tempRange,
    headline: pickLocalized(WEATHER_COPY.headlines, condition, lang, 'Probably weather.'),
    heroLabel: pickLocalized(WEATHER_COPY.heroLabels, condition, lang, 'Weather'),
    witty: pickWitty(condition, lang, seed, wittyContext),
    stats: statParts.join(' • '),
    // backgroundPath is now the static og/<condition>.jpg (no time-of-day) —
    // see getOgStaticBackgroundPath docblock for the @vercel/og WebP reason.
    backgroundPath: getOgStaticBackgroundPath(condition),
  };
}

export function buildFallbackViewModel(lang = 'en', conditionOverride = null) {
  const safeLang = clampLang(lang);
  // With no coordinates there's no live weather, but a legacy ?bg=<cond> share
  // still carries the sender's on-screen condition. Honour it so the card shows
  // the right background + localized headline + hero label (branded AND
  // condition-matched) instead of a generic clear card — the coord-less legacy
  // links are exactly the "already shared in the wild" ones this path improves.
  // Temps/stats stay generic (no forecast without coords); the witty line stays
  // the context-free brand tagline so no day/region-gated line can misfire here.
  const condition = normalizeConditionParam(conditionOverride);
  if (condition) {
    return {
      lang: safeLang,
      location: 'South Africa',
      condition,
      timeOfDay: 'day',
      tempRange: 'Probably',
      headline: pickLocalized(WEATHER_COPY.headlines, condition, safeLang, 'South African weather'),
      heroLabel: pickLocalized(WEATHER_COPY.heroLabels, condition, safeLang, 'Probably Weather'),
      witty: 'Weather that speaks your language.',
      stats: 'Live local forecast • Wind • Rain • UV',
      backgroundPath: getOgStaticBackgroundPath(condition),
    };
  }
  return {
    lang: safeLang,
    location: 'South Africa',
    condition: 'clear',
    timeOfDay: 'day',
    tempRange: 'Probably',
    headline: 'South African weather',
    heroLabel: 'Probably Weather',
    witty: 'Weather that speaks your language.',
    stats: 'Live local forecast • Wind • Rain • UV',
    backgroundPath: getOgStaticBackgroundPath('clear'),
  };
}

async function callWeatherHandler(lat, lon, clientIp) {
  let statusCode = 200;
  let body = null;
  // H3: carry the real client IP into the synthetic request so the internal
  // weather call is rate-limited per actual caller, not pooled under the
  // '0.0.0.0' fallback bucket shared by every OG render worldwide. The
  // 'Shared location' name is now treated as a placeholder by weatherHandler,
  // so the card shows the resolved city instead of the literal label.
  const req = {
    query: { lat: String(lat), lon: String(lon), name: 'Shared location' },
    headers: clientIp ? { 'x-real-ip': clientIp } : {},
  };
  const res = {
    setHeader() { return this; },
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      body = payload;
      return this;
    },
  };

  await weatherHandler(req, res);
  if (statusCode >= 400 || !body?.ok) throw new Error(body?.error || `Weather API failed with ${statusCode}`);
  return body;
}

async function readBackgroundDataUrl(model) {
  // STATIC OG sources — every candidate is a JPEG under og/. We previously
  // embedded a WebP into Satori (@vercel/og 0.11.1) which threw
  // "u2 is not iterable" deep in the Satori parser. Switching to the
  // pre-built og/*.jpg files (produced by tools/build-og-images.mjs) keeps
  // every embedded image as JPEG, which Satori handles cleanly.
  //
  // No time-of-day variation here. Social cards cache per shared URL for
  // ~30 days on WhatsApp/Twitter, so per-time variation was invisible anyway.
  // Path-only ?bg= and ?lang= share-URL handling is unaffected — those run
  // upstream of this background lookup, in the view-model construction.
  //
  // Chain already starts with `og/<resolved-folder>.jpg` which equals
  // model.backgroundPath in normal use — no redundant prepend.
  const ordered = getOgStaticBackgroundFallbackChain(model.condition);

  for (let i = 0; i < ordered.length; i += 1) {
    const candidate = ordered[i];
    const cached = BACKGROUND_DATA_URL_CACHE.get(candidate);
    if (cached) return cached;
    try {
      const bytes = await readFile(new URL(`../${candidate}`, import.meta.url));
      if (i > 0) {
        // Log only on actual fallback events to match the picker's [Image picker] logging shape.
        console.log(`[OG picker] fallback step ${i} → ${candidate}`);
      }
      // Every candidate is JPEG under og/. No MIME detection needed — and no
      // chance of accidentally serving a WebP back to Satori.
      const dataUrl = `data:image/jpeg;base64,${bytes.toString('base64')}`;
      BACKGROUND_DATA_URL_CACHE.set(candidate, dataUrl);
      return dataUrl;
    } catch {
      // Try the next candidate.
    }
  }

  console.log('[OG picker] fallback chain exhausted — rendering card without background');
  return null;
}

function ogElement(model, backgroundDataUrl) {
  return h('div', {
    style: {
      width: '100%',
      height: '100%',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '54px 64px',
      background: '#111',
      color: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      overflow: 'hidden',
    },
  },
    backgroundDataUrl ? h('img', {
      src: backgroundDataUrl,
      style: {
        position: 'absolute',
        top: -54,
        left: -64,
        width: WIDTH,
        height: HEIGHT,
        objectFit: 'cover',
      },
    }) : null,
    h('div', {
      style: {
        position: 'absolute',
        top: -54,
        left: -64,
        width: WIDTH,
        height: HEIGHT,
        display: 'flex',
        background: 'linear-gradient(90deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.55) 52%, rgba(0,0,0,0.34) 100%)',
      },
    }),
    h('div', {
      style: {
        position: 'relative',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
      },
    },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: 18 } },
        h('div', {
          style: {
            width: 56,
            height: 56,
            borderRadius: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #ffdd44, #ffaa00)',
            color: '#111',
            fontSize: 29,
            fontWeight: 900,
          },
        }, 'P'),
        h('div', { style: { display: 'flex', flexDirection: 'column' } },
          h('div', { style: { fontSize: 31, fontWeight: 850, lineHeight: 1 } }, 'Probably Weather'),
          h('div', { style: { marginTop: 6, fontSize: 18, opacity: 0.76 } }, model.heroLabel),
        ),
      ),
      h('div', {
        style: {
          maxWidth: 440,
          fontSize: 26,
          fontWeight: 700,
          textAlign: 'right',
          opacity: 0.94,
        },
      }, model.location),
    ),
    h('div', {
      style: {
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        maxWidth: 820,
        marginTop: 44,
      },
    },
      h('div', {
        style: {
          color: '#ffd700',
          fontSize: 112,
          fontWeight: 900,
          lineHeight: 0.95,
          letterSpacing: 0,
        },
      }, model.tempRange),
      h('div', {
        style: {
          marginTop: 26,
          color: '#f5a623',
          fontSize: 47,
          fontWeight: 850,
          lineHeight: 1.05,
        },
      }, model.headline),
      h('div', {
        style: {
          marginTop: 18,
          maxWidth: 760,
          color: '#fff',
          opacity: 0.92,
          fontSize: 30,
          fontWeight: 650,
          lineHeight: 1.25,
        },
      }, model.witty),
    ),
    h('div', {
      style: {
        position: 'relative',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        width: '100%',
        fontSize: 25,
        fontWeight: 650,
      },
    },
      h('div', { style: { opacity: 0.85 } }, model.stats),
      h('div', { style: { opacity: 0.9, fontWeight: 800 } }, 'probablyweather.co.za'),
    ),
  );
}

export async function renderJpeg(model) {
  const background = await readBackgroundDataUrl(model);
  const fontData = await FONT_DATA_PROMISE;
  const svg = await satori(ogElement(model, background), {
    width: WIDTH,
    height: HEIGHT,
    fonts: [{ name: 'geist', data: fontData, weight: 400, style: 'normal' }],
  });
  const jpeg = await sharp(Buffer.from(svg)).jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
  if (jpeg.length > JPEG_BYTE_BUDGET) {
    throw new Error(`[OG jpeg] over budget at q${JPEG_QUALITY}: ${jpeg.length} bytes`);
  }
  console.log(`[OG jpeg] q${JPEG_QUALITY} → ${(jpeg.length / 1024).toFixed(0)}KB`);
  return jpeg;
}

function sendJpeg(res, statusCode, buffer, cacheControl = CACHE_CONTROL) {
  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('Cache-Control', cacheControl);
  res.status(statusCode).end(buffer);
}

export default async function handler(req, res) {
  const {
    lang,
    lat,
    lon,
    hasValidCoords,
    conditionOverride,
    canonicalPath,
    needsRedirect,
  } = canonicalizeOgRequest(req);

  // Collapse junk params, alternate ordering and over-precise coordinates to
  // one CDN key before any weather lookup or image render occurs.
  if (needsRedirect) {
    res.setHeader('Location', canonicalPath);
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=86400');
    return res.status(301).end();
  }

  const rate = await checkRateLimit(req, ogLimiter());
  if (!rate.allowed) {
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(429).end('Too many requests');
  }

  try {
    let payload = null;
    if (hasValidCoords) {
      try {
        payload = await callWeatherHandler(lat, lon, getClientIp(req));
      } catch (weatherErr) {
        // M8: weather failure → generic card is correct, but log it so quota /
        // rate-limit saturation is visible in the function logs.
        console.error(`[pw-og-fail] weather fetch failed lat=${lat} lon=${lon}: ${weatherErr?.message || weatherErr}`);
      }
    }
    const model = payload ? buildOgViewModel(payload, { lang, conditionOverride }) : buildFallbackViewModel(lang, conditionOverride);
    // Valid coords but no weather (limiter/provider failure) → the generic
    // card is a TRANSIENT stand-in for this URL; short cache so the CDN
    // retries soon instead of pinning the wrong card for an hour.
    const degraded = hasValidCoords && !payload;
    sendJpeg(res, 200, await renderJpeg(model), degraded ? DEGRADED_CACHE_CONTROL : CACHE_CONTROL);
  } catch {
    // Primary render failed. Try the safe fallback model. If THAT also throws
    // (e.g. Satori-side breakage, missing font), respond with a no-cache 500
    // instead of letting the handler crash and Vercel return its own default.
    try {
      sendJpeg(res, 200, await renderJpeg(buildFallbackViewModel(lang, conditionOverride)), DEGRADED_CACHE_CONTROL);
    } catch (err) {
      console.error('[OG] fallback render also failed:', err);
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Cache-Control', 'no-store');
      res.status(500).end('OG render failed');
    }
  }
}
