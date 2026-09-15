import { buildOgImageUrl, buildShareLink, cleanShareName, parseShareNameSegment, SHARE_ORIGIN } from '../assets/share-url.js';
import { WEATHER_COPY } from '../assets/weather-copy.js';
import { SUPPORTED_LANGS } from '../assets/language-preferences.js';
import weatherHandler, { parseCoord } from './weather.js';
import { getClientIp } from './_lib/rate-limit.js';
import { SHARE_REDIRECT_SCRIPT } from './_lib/share-redirect.js';
import { reversePlaceName } from './_lib/place-name.js';

const STATIC_DESCRIPTION = 'South African weather, in your language.';
// L2 dedupe: one language list for the whole app (was three copies). Kept as
// a Set locally — clampLang uses .has().
const LANG_SET = new Set(SUPPORTED_LANGS);
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

// Strict parseCoord (shared with api/weather.js) rejects hex/partial/empty
// before the range check — '0x10', '', '90abc' no longer slip through as the
// old Number() check let them. Matches the other 4 coord entry points.
const isValidLat = (value) => { const n = parseCoord(value); return Number.isFinite(n) && n >= -90 && n <= 90; };
const isValidLon = (value) => { const n = parseCoord(value); return Number.isFinite(n) && n >= -180 && n <= 180; };
const clampLang = (lang) => LANG_SET.has(lang) ? lang : 'en';
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
  //
  // No `name` is passed even when the link carries one: weather.js caches only
  // names it resolved itself, so a named call on a cache miss would pin the
  // cell's cached name to 'Unknown' for every other caller.
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

// placeName wins over the forecast's own name; a placeholder name ('Unknown')
// never reaches the preview.
export function buildShareDescription(payload, lang = 'en', placeName = '') {
  const safeLang = clampLang(lang);
  const daily = payload?.daily?.[0] || {};
  const now = payload?.now || {};
  const location = cleanShareName(placeName) || cleanShareName(payload?.location?.name) || 'South Africa';
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

// The place for the preview: the link's own name, else the forecast's resolved
// name, else one budgeted LocationIQ reverse lookup (api/_lib/place-name.js).
async function resolveShare({ lat, lon, lang, hasCoords, clientIp, linkName }) {
  if (!hasCoords) return { description: STATIC_DESCRIPTION, placeName: '' };

  let payload;
  try {
    payload = await callWeatherHandler(lat, lon, clientIp);
  } catch (error) {
    // M8: the static-description fallback is correct UX, but silently eating
    // the error left the operator blind to systematic failures (quota
    // exhaustion, rate-limit saturation, a geographic hole). Greppable
    // prefix matches the [pw-source-fail] convention in api/weather.js.
    console.error(`[pw-share-fail] weather fetch failed lat=${lat} lon=${lon}: ${error?.message || error}`);
    return { description: STATIC_DESCRIPTION, placeName: linkName };
  }
  let placeName = linkName || cleanShareName(payload?.location?.name);
  if (!placeName) {
    placeName = (await reversePlaceName(lat, lon, clientIp)) || '';
    console.log(`[pw-share-name] no link or forecast name lat=${lat} lon=${lon} → reverse ${placeName ? 'resolved' : 'empty'}`);
  }
  return { description: buildShareDescription(payload, lang, placeName), placeName };
}

export async function buildShareMetaHtml(query = {}, { clientIp } = {}) {
  const lat = query.lat;
  const lon = query.lon;
  const lang = clampLang(query.lang || 'en');
  const hasCoords = isValidLat(lat) && isValidLon(lon);
  const linkName = parseShareNameSegment(query.name);
  const { description, placeName } = await resolveShare({ lat, lon, lang, hasCoords, clientIp, linkName });
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
  // condition (?c=) reproduces the sender's on-screen bg family + witty bin on
  // the dynamic card. buildOgImageUrl format-sanitizes it; api/og.js does the
  // semantic allowlist check. Only threaded alongside valid coords (the
  // fallback card ignores condition anyway). The place rides along the same way.
  const ogImage = buildOgImageUrl(hasCoords ? { lat, lon, lang, condition: query.c, name: placeName } : { lang });
  // og:url is the canonical short link (/s/…) whichever form was opened.
  const shareUrl = hasCoords
    ? buildShareLink({ lat: parseCoord(lat), lon: parseCoord(lon), lang, condition: query.c, name: placeName })
    : buildShareLink({ lang });

  // The script is byte-constant (api/_lib/share-redirect.js) so the site CSP can
  // allow it by hash; it reads its destination from the meta refresh above it.
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
  <meta property="og:image:type" content="image/jpeg"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="Probably Weather"/>
  <meta name="twitter:description" content="${escapeAttr(description)}"/>
  <meta name="twitter:image" content="${escapeAttr(ogImage)}"/>
  <meta http-equiv="refresh" content="0; url=${escapeAttr(appUrl)}"/>
  <script>${SHARE_REDIRECT_SCRIPT}</script>
</head>
<body>
  <p><a href="${escapeAttr(appUrl)}">Open Probably Weather</a></p>
</body>
</html>`;
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
  const html = await buildShareMetaHtml(getQuery(req), { clientIp: getClientIp(req) });
  res.status(200).end(html);
}
