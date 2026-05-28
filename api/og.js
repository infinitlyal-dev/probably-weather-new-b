import { readFile } from 'node:fs/promises';

import { ImageResponse } from '@vercel/og';

import weatherHandler from './weather.js';
import { WEATHER_COPY } from '../assets/weather-copy.js';
import {
  getOgStaticBackgroundFallbackChain,
  getOgStaticBackgroundPath,
  getTimeOfDaySlot,
} from '../assets/weather-visuals.js';

export const config = { runtime: 'nodejs' };
export const CACHE_CONTROL = 'public, max-age=300, s-maxage=300';

const WIDTH = 1200;
const HEIGHT = 630;
const SUPPORTED_LANGS = ['en', 'af', 'zu', 'xh', 'st'];

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

function getQuery(req) {
  if (req?.query) return req.query;
  const url = new URL(req?.url || '/', 'https://probablyweather.co.za');
  return Object.fromEntries(url.searchParams.entries());
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

function pickWitty(condition, lang, seed) {
  const lines = WEATHER_COPY.witty?.[condition]?.[lang] || WEATHER_COPY.witty?.[condition]?.en || WEATHER_COPY.witty.clear.en;
  if (!Array.isArray(lines) || lines.length === 0) return '';
  return lines[hashString(seed) % lines.length];
}

export function buildOgViewModel(payload, options = {}) {
  const lang = clampLang(options.lang);
  const now = payload?.now || payload?.current || {};
  const today = payload?.daily?.[0] || {};
  const location = payload?.location?.name || options.locationName || 'South Africa';
  const condition = now.conditionKey || today.conditionKey || 'clear';
  // Compute timeOfDay server-side from the same sunrise/sunset signals the
  // browser uses. This is what picks one of 36 canonical OG sources
  // (9 conditions × 4 times). Falls back to 'day' if signals are missing.
  const timeOfDay = getTimeOfDaySlot(payload);
  const low = formatTemp(today.lowC ?? today.minC ?? now.tempC ?? now.temperature_2m);
  const high = formatTemp(today.highC ?? today.maxC ?? now.tempC ?? now.temperature_2m);
  const current = formatTemp(now.tempC ?? now.temperature_2m);
  const tempRange = low && high && low !== high ? `${low} / ${high}` : (current || high || low || '--°');
  const labels = STAT_LABELS[lang] || STAT_LABELS.en;
  const wind = isNum(now.windKph ?? now.wind_kph ?? payload?.wind_kph) ? `${round(now.windKph ?? now.wind_kph ?? payload.wind_kph)} km/h` : '--';
  const rain = isNum(now.rainChance ?? today.rainChance) ? `${round(now.rainChance ?? today.rainChance)}%` : '--';
  const uv = isNum(now.uv ?? today.uv) ? String(round(now.uv ?? today.uv)) : '--';
  const seed = `${location}|${condition}|${lang}|${new Date().toISOString().slice(0, 10)}`;

  return {
    lang,
    location,
    condition,
    timeOfDay,
    tempRange,
    headline: pickLocalized(WEATHER_COPY.headlines, condition, lang, 'Probably weather.'),
    heroLabel: pickLocalized(WEATHER_COPY.heroLabels, condition, lang, 'Weather'),
    witty: pickWitty(condition, lang, seed),
    stats: `${labels.wind} ${wind} • ${labels.rain} ${rain} • ${labels.uv} ${uv}`,
    // backgroundPath is now the static og/<condition>.jpg (no time-of-day) —
    // see getOgStaticBackgroundPath docblock for the @vercel/og WebP reason.
    backgroundPath: getOgStaticBackgroundPath(condition),
  };
}

export function buildFallbackViewModel(lang = 'en') {
  const safeLang = clampLang(lang);
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

async function callWeatherHandler(lat, lon) {
  let statusCode = 200;
  let body = null;
  const req = { query: { lat: String(lat), lon: String(lon), name: 'Shared location' } };
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
    try {
      const bytes = await readFile(new URL(`../${candidate}`, import.meta.url));
      if (i > 0) {
        // Log only on actual fallback events to match the picker's [Image picker] logging shape.
        console.log(`[OG picker] fallback step ${i} → ${candidate}`);
      }
      // Every candidate is JPEG under og/. No MIME detection needed — and no
      // chance of accidentally serving a WebP back to Satori.
      return `data:image/jpeg;base64,${bytes.toString('base64')}`;
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
            background: 'linear-gradient(135deg, #ffdd44, #ff8c42)',
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
          color: '#ff8c42',
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

async function renderPng(model) {
  const background = await readBackgroundDataUrl(model);
  const image = new ImageResponse(ogElement(model, background), { width: WIDTH, height: HEIGHT });
  return Buffer.from(await image.arrayBuffer());
}

function sendPng(res, statusCode, buffer) {
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', CACHE_CONTROL);
  res.status(statusCode).end(buffer);
}

export default async function handler(req, res) {
  const query = getQuery(req);
  const lang = clampLang(String(query.lang || 'en'));
  const lat = Number.parseFloat(query.lat);
  const lon = Number.parseFloat(query.lon);

  try {
    const hasValidCoords = Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
    const payload = hasValidCoords ? await callWeatherHandler(lat, lon) : null;
    const model = payload ? buildOgViewModel(payload, { lang }) : buildFallbackViewModel(lang);
    sendPng(res, 200, await renderPng(model));
  } catch {
    // Primary render failed. Try the safe fallback model. If THAT also throws
    // (e.g. Satori-side breakage, missing font), respond with a no-cache 500
    // instead of letting the handler crash and Vercel return its own default.
    try {
      sendPng(res, 200, await renderPng(buildFallbackViewModel(lang)));
    } catch (err) {
      console.error('[OG] fallback render also failed:', err);
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Cache-Control', 'no-store');
      res.status(500).end('OG render failed');
    }
  }
}
