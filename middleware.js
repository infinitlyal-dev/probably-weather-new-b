// Vercel Edge middleware — injects per-condition og:image / og:url / og:title
// / og:description into the static index.html response based on ?bg=<condition>
// (and optionally ?city=<name>).
//
// The dynamic /api/og endpoint remains the source of truth when ?lat/lon are
// known. This middleware adds a fast static fallback so any share URL that
// only carries ?bg= (or none at all) still produces a branded preview without
// hitting the weather API.
//
// Allowlist must match the static images under /og/<condition>.jpg.

export const config = {
  runtime: 'edge',
  matcher: ['/'],
};

const ORIGIN = 'https://www.probablyweather.co.za';

const CONDITION_ALLOWLIST = new Set([
  'clear', 'cloudy', 'cold', 'fog', 'heat', 'rain',
  'storm', 'wind', 'rain-possible', 'uv', 'default',
]);

const DEFAULT_CONDITION = 'clear';

const TITLES = {
  clear:           'Clear skies — Probably Weather',
  cloudy:          'Cloudy vibes — Probably Weather',
  cold:            'Chilly out — Probably Weather',
  fog:             'Foggy out there — Probably Weather',
  heat:            'It is hot — Probably Weather',
  rain:            'Rain incoming — Probably Weather',
  'rain-possible': 'Maybe rain — Probably Weather',
  storm:           'Storm watch — Probably Weather',
  uv:              'High UV — Probably Weather',
  wind:            'Wind is up — Probably Weather',
  default:         'Probably Weather',
};

const DESCRIPTIONS = {
  clear:           'South African weather, in your language. Clear right now.',
  cloudy:          'South African weather, in your language. Cloudy right now.',
  cold:            'South African weather, in your language. Chilly right now.',
  fog:             'South African weather, in your language. Foggy right now.',
  heat:            'South African weather, in your language. Hot right now.',
  rain:            'South African weather, in your language. Wet right now.',
  'rain-possible': 'South African weather, in your language. Maybe rain.',
  storm:           'South African weather, in your language. Storm watch.',
  uv:              'South African weather, in your language. UV is high.',
  wind:            'South African weather, in your language. Wind is up.',
  default:         'South African weather, in your language.',
};

function normalizeBg(value) {
  if (!value) return null;
  const v = String(value).toLowerCase().trim();
  return CONDITION_ALLOWLIST.has(v) ? v : null;
}

function escapeAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildCanonicalUrl(url, condition, city) {
  const params = new URLSearchParams();
  params.set('bg', condition);
  if (city) params.set('city', city);
  return `${ORIGIN}/?${params.toString()}`;
}

// Swap a meta tag's content="..." by property/name. Cheap, idempotent, runs once
// per request. Only matches the EXACT tag we render in index.html so we don't
// touch unrelated meta lines.
function swapMeta(html, attrType, attrValue, newContent) {
  const escaped = newContent
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;');
  const pattern = new RegExp(
    `(<meta\\s+${attrType}="${attrValue}"\\s+content=")[^"]*(")`,
    'i'
  );
  return html.replace(pattern, `$1${escaped}$2`);
}

export default async function middleware(request) {
  const url = new URL(request.url);

  // Only process GETs to the root document.
  if (request.method !== 'GET') return;
  if (url.pathname !== '/' && url.pathname !== '/index.html') return;

  const bgParam = url.searchParams.get('bg');
  const city = (url.searchParams.get('city') || '').slice(0, 80) || null;
  const condition = normalizeBg(bgParam) || DEFAULT_CONDITION;

  // Only intervene when ?bg= is actually present. Leaves the un-shared root
  // page untouched (uses its inline runtime og fallback).
  if (!bgParam) return;

  // Fetch the upstream HTML response.
  const upstream = await fetch(request);
  const contentType = upstream.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return upstream;

  let html = await upstream.text();

  const ogImage = `${ORIGIN}/og/${condition}.jpg`;
  const canonical = buildCanonicalUrl(url, condition, city);
  const title = TITLES[condition] || TITLES.default;
  const baseDescription = DESCRIPTIONS[condition] || DESCRIPTIONS.default;
  const description = city ? `${city} — ${baseDescription}` : baseDescription;

  html = swapMeta(html, 'property',  'og:image',          ogImage);
  html = swapMeta(html, 'name',      'twitter:image',     ogImage);
  html = swapMeta(html, 'property',  'og:url',            canonical);
  html = swapMeta(html, 'property',  'og:title',          title);
  html = swapMeta(html, 'name',      'twitter:title',     title);
  html = swapMeta(html, 'property',  'og:description',    description);
  html = swapMeta(html, 'name',      'twitter:description', description);
  html = swapMeta(html, 'name',      'description',       description);

  return new Response(html, {
    status: upstream.status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300, s-maxage=300',
      'x-pw-share-bg': condition,
    },
  });
}

// Exported for unit tests.
export const __test = {
  normalizeBg,
  swapMeta,
  buildCanonicalUrl,
  CONDITION_ALLOWLIST,
  TITLES,
  DESCRIPTIONS,
};
