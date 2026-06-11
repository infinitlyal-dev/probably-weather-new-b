import { buildOgImageUrl, SHARE_ORIGIN } from '../assets/share-url.js';
import { WEATHER_COPY } from '../assets/weather-copy.js';
import weatherHandler, { parseCoord } from './weather.js';
import { getClientIp } from './_lib/rate-limit.js';

const STATIC_DESCRIPTION = 'South African weather, in your language.';
const SUPPORTED_LANGS = new Set(['en', 'af', 'zu', 'xh', 'st']);
const PROBABLY_WORD = {
  en: 'Probably',
  af: 'Waarskynlik',
  zu: 'Cishe',
  xh: 'Cishe',
  st: 'Mohlomong',
};

const escapeAttr = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

// Thrown when the inline-script JSON.stringify fails. Mapped to a controlled
// 400 in the handler rather than a 500 crash. Phase 2 Codex S2 defensive
// wrap — JSON.stringify on a plain URL string can't fail under current
// inputs, but the failure surface widens if appUrl ever holds non-string
// values, so the catch is here for the future.
export class ShareSerializationError extends Error {
  constructor(message, { cause } = {}) {
    super(message);
    this.name = 'ShareSerializationError';
    if (cause) this.cause = cause;
  }
}

function safeStringifyForScript(value) {
  try {
    return JSON.stringify(value);
  } catch (err) {
    throw new ShareSerializationError(
      `Failed to serialize value for inline script: ${err?.message || err}`,
      { cause: err }
    );
  }
}

// Strict parseCoord (shared with api/weather.js) rejects hex/partial/empty
// before the range check — '0x10', '', '90abc' no longer slip through as the
// old Number() check let them. Matches the other 4 coord entry points.
const isValidLat = (value) => { const n = parseCoord(value); return Number.isFinite(n) && n >= -90 && n <= 90; };
const isValidLon = (value) => { const n = parseCoord(value); return Number.isFinite(n) && n >= -180 && n <= 180; };
const clampLang = (lang) => SUPPORTED_LANGS.has(lang) ? lang : 'en';
const isFiniteNumber = (value) => Number.isFinite(Number(value));
const formatTemp = (value) => `${Math.round(Number(value))}°`;

function getQuery(req) {
  if (req?.query) return req.query;
  const url = new URL(req?.url || '/', SHARE_ORIGIN);
  return Object.fromEntries(url.searchParams.entries());
}

function pickLocalized(bank, key, lang, fallback = '') {
  const values = bank?.[key] || bank?.clear || {};
  return values?.[lang] || values?.en || fallback;
}

async function callWeatherHandler(lat, lon, clientIp) {
  let statusCode = 200;
  let body;
  // H3: thread the REAL client IP into the synthetic request. Without it,
  // getClientIp() inside weatherHandler fell through to '0.0.0.0' and every
  // share-card weather lookup worldwide shared ONE 60/min rate-limit bucket —
  // WhatsApp preview crawlers alone could saturate it, silently degrading all
  // share cards to the static description (and one attacker could force it).
  // Keeping the limiter in the loop (vs bypassing for internal calls) was
  // deliberate: /api/share is itself unauthenticated, so a bypass would
  // reopen the per-IP quota-burn hole through crafted share URLs.
  const req = { query: { lat, lon }, headers: clientIp ? { 'x-real-ip': clientIp } : {} };
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    setHeader() {},
    json(payload) {
      body = payload;
      return this;
    },
    end(payload) {
      body = payload;
      return this;
    },
  };

  await weatherHandler(req, res);

  if (statusCode >= 400 || !body?.ok) {
    throw new Error(`Weather fetch failed with status ${statusCode}`);
  }

  return body;
}

export function buildShareDescription(payload, lang = 'en') {
  const safeLang = clampLang(lang);
  const daily = payload?.daily?.[0] || {};
  const now = payload?.now || {};
  const location = payload?.location?.name || 'South Africa';
  const low = daily.lowC ?? daily.minC ?? daily.tempLowC ?? now.lowC ?? now.tempC;
  const high = daily.highC ?? daily.maxC ?? daily.tempHighC ?? now.highC ?? now.tempC;
  const conditionKey = now.conditionKey || daily.conditionKey || 'clear';
  const conditionText = pickLocalized(WEATHER_COPY.headlines, conditionKey, safeLang, 'Weather update.').trim();
  const condition = conditionText.endsWith('.') ? conditionText : `${conditionText}.`;
  const temp = isFiniteNumber(low) && isFiniteNumber(high)
    ? `${formatTemp(low)}/${formatTemp(high)}`
    : (isFiniteNumber(now.tempC) ? formatTemp(now.tempC) : '');

  if (!temp) return STATIC_DESCRIPTION;

  return `${location}: ${PROBABLY_WORD[safeLang]} ${temp}. ${condition}`;
}

async function resolveShareDescription({ lat, lon, lang, hasCoords, clientIp }) {
  if (!hasCoords) return STATIC_DESCRIPTION;

  try {
    const payload = await callWeatherHandler(lat, lon, clientIp);
    return buildShareDescription(payload, lang);
  } catch (error) {
    return STATIC_DESCRIPTION;
  }
}

export async function buildShareMetaHtml(query = {}, { clientIp } = {}) {
  const lat = query.lat;
  const lon = query.lon;
  const lang = clampLang(query.lang || 'en');
  const hasCoords = isValidLat(lat) && isValidLon(lon);
  const description = await resolveShareDescription({ lat, lon, lang, hasCoords, clientIp });
  const appParams = new URLSearchParams();
  if (hasCoords) {
    appParams.set('lat', String(lat));
    appParams.set('lon', String(lon));
  }
  appParams.set('lang', String(lang));
  const appUrl = `${SHARE_ORIGIN}/?${appParams.toString()}`;
  // Only feed coords into the OG image URL when they pass the SAME strict
  // parseCoord gate as the rest of this handler (hasCoords). buildOgImageUrl's
  // own validator is a loose Number() that accepts hex ('0x10'→16), so passing
  // raw query coords here reflected junk into the og:image/twitter:image tags.
  // No valid coords → default OG card.
  const ogImage = buildOgImageUrl(hasCoords ? { lat, lon, lang } : { lang });
  const shareUrl = `${SHARE_ORIGIN}/share?${new URLSearchParams({ ...(hasCoords ? { lat: String(lat), lon: String(lon) } : {}), lang: String(lang) }).toString()}`;

  return `<!doctype html>
<html lang="${escapeAttr(String(lang).slice(0, 2) || 'en')}">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
  <title>Probably Weather</title>
  <meta name="description" content="${escapeAttr(description)}"/>
  <meta property="og:title" content="Probably Weather"/>
  <meta property="og:description" content="${escapeAttr(description)}"/>
  <meta property="og:type" content="website"/>
  <meta property="og:url" content="${escapeAttr(shareUrl)}"/>
  <meta property="og:image" content="${escapeAttr(ogImage)}"/>
  <meta property="og:image:width" content="1200"/>
  <meta property="og:image:height" content="630"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="Probably Weather"/>
  <meta name="twitter:description" content="${escapeAttr(description)}"/>
  <meta name="twitter:image" content="${escapeAttr(ogImage)}"/>
  <meta http-equiv="refresh" content="0; url=${escapeAttr(appUrl)}"/>
  <script>window.location.replace(${safeStringifyForScript(appUrl)});</script>
</head>
<body>
  <p><a href="${escapeAttr(appUrl)}">Open Probably Weather</a></p>
</body>
</html>`;
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
  try {
    const html = await buildShareMetaHtml(getQuery(req), { clientIp: getClientIp(req) });
    res.status(200).end(html);
  } catch (err) {
    if (err instanceof ShareSerializationError) {
      // Controlled 400 — the inputs produced something we can't safely
      // inline. Plain-text body so a curl probe sees the diagnosis.
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.status(400).end(`Share preview unavailable: ${err.message}`);
      return;
    }
    throw err;
  }
}
