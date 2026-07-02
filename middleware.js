// Vercel Edge middleware — injects per-condition og:image / og:url / og:title
// / og:description into the static index.html response based on ?bg=<condition>
// (and optionally ?city=<name>, ?lang=<lang>).
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
  'clear', 'cloudy', 'cold', 'cold-clear', 'fog', 'heat', 'rain',
  'storm', 'wind', 'rain-possible', 'uv', 'default',
]);

const DEFAULT_CONDITION = 'clear';

const SUPPORTED_LANGS = new Set(['en', 'af', 'zu', 'xh', 'st']);
const DEFAULT_LANG = 'en';

// Per-language titles. EN keeps the original per-condition copy. AF gets a
// per-condition variant mirroring the in-app `WEATHER_COPY.headlines.<cond>.af`
// phrasing so the WhatsApp preview matches what testers see when they open
// the app. ZU / XH / ST use a single brand-clean title until those columns
// get native-speaker review — avoids the GPT-style misfire the Sesotho
// reviewer flagged last night.
const TITLES = {
  en: {
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
  },
  af: {
    clear:           'Helder lug — Probably Weather',
    cloudy:          'Bewolk vandag — Probably Weather',
    cold:            'Dis koud — Probably Weather',
    fog:             'Dis mistig — Probably Weather',
    heat:            'Dis bloedig warm — Probably Weather',
    rain:            'Dit reën — Probably Weather',
    'rain-possible': 'Dalk reën — Probably Weather',
    storm:           'Storm op pad — Probably Weather',
    uv:              'UV is hoog — Probably Weather',
    wind:            'Dit waai — Probably Weather',
    default:         'Probably Weather',
  },
  zu: 'Probably Weather',
  xh: 'Probably Weather',
  st: 'Probably Weather',
};

// Per-language descriptions. EN / AF use a tagline + per-condition status
// fragment. ZU / XH / ST use `{tagline}. {headline}` where both halves come
// from existing localized strings in assets/app.js (T.misc.shareMessage
// tagline portion) and assets/weather-copy.js (WEATHER_COPY.headlines.<cond>)
// — kept verbatim so any native-review fix in those source-of-truth files
// flows into the OG card automatically on next deploy.
const DESCRIPTIONS = {
  en: {
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
  },
  af: {
    clear:           'Suid-Afrikaanse weer, in jou taal. Helder lug nou.',
    cloudy:          'Suid-Afrikaanse weer, in jou taal. Bewolk vandag.',
    cold:            'Suid-Afrikaanse weer, in jou taal. Dis koud.',
    fog:             'Suid-Afrikaanse weer, in jou taal. Dis mistig.',
    heat:            'Suid-Afrikaanse weer, in jou taal. Dis bloedig warm.',
    rain:            'Suid-Afrikaanse weer, in jou taal. Dit reën.',
    'rain-possible': 'Suid-Afrikaanse weer, in jou taal. Dalk reën.',
    storm:           'Suid-Afrikaanse weer, in jou taal. Storm op pad.',
    uv:              'Suid-Afrikaanse weer, in jou taal. UV is hoog.',
    wind:            'Suid-Afrikaanse weer, in jou taal. Dit waai.',
    default:         'Suid-Afrikaanse weer, in jou taal.',
  },
  zu: {
    clear:           'Isimo sezulu saseNingizimu Afrika ngolimi lwakho. Izulu lihlanzekile.',
    cloudy:          'Isimo sezulu saseNingizimu Afrika ngolimi lwakho. Kunamafu.',
    cold:            'Isimo sezulu saseNingizimu Afrika ngolimi lwakho. Kuyabanda.',
    fog:             'Isimo sezulu saseNingizimu Afrika ngolimi lwakho. Kunenkungu.',
    heat:            'Isimo sezulu saseNingizimu Afrika ngolimi lwakho. Kushisa.',
    rain:            'Isimo sezulu saseNingizimu Afrika ngolimi lwakho. Imvula ikhona.',
    'rain-possible': 'Isimo sezulu saseNingizimu Afrika ngolimi lwakho. Kungase line.',
    storm:           'Isimo sezulu saseNingizimu Afrika ngolimi lwakho. Isiphepho siyeza.',
    uv:              'Isimo sezulu saseNingizimu Afrika ngolimi lwakho. I-UV iphezulu kakhulu.',
    wind:            'Isimo sezulu saseNingizimu Afrika ngolimi lwakho. Umoya uyavunguza.',
    default:         'Isimo sezulu saseNingizimu Afrika ngolimi lwakho.',
  },
  xh: {
    clear:           'Imozulu yaseMzantsi Afrika ngolwimi lwakho. Isibhakabhaka sihlanzekile.',
    cloudy:          'Imozulu yaseMzantsi Afrika ngolwimi lwakho. Linamafu.',
    cold:            'Imozulu yaseMzantsi Afrika ngolwimi lwakho. Kuyabanda.',
    fog:             'Imozulu yaseMzantsi Afrika ngolwimi lwakho. Linenkungula.',
    heat:            'Imozulu yaseMzantsi Afrika ngolwimi lwakho. Kushushu.',
    rain:            'Imozulu yaseMzantsi Afrika ngolwimi lwakho. Imvula ikhona.',
    'rain-possible': 'Imozulu yaseMzantsi Afrika ngolwimi lwakho. Mhlawumbi iya kuna.',
    storm:           'Imozulu yaseMzantsi Afrika ngolwimi lwakho. Isaqhwithi siyeza.',
    uv:              'Imozulu yaseMzantsi Afrika ngolwimi lwakho. I-UV iphezulu kakhulu.',
    wind:            'Imozulu yaseMzantsi Afrika ngolwimi lwakho. Umoya uvuthuza.',
    default:         'Imozulu yaseMzantsi Afrika ngolwimi lwakho.',
  },
  st: {
    clear:           'Boemo ba leholimo ba Afrika Borwa ka puo ya hao. Lehodimo le hlakileng.',
    cloudy:          'Boemo ba leholimo ba Afrika Borwa ka puo ya hao. Maru a teng.',
    cold:            'Boemo ba leholimo ba Afrika Borwa ka puo ya hao. Ho a bata.',
    fog:             'Boemo ba leholimo ba Afrika Borwa ka puo ya hao. Ho na le mohodi.',
    heat:            'Boemo ba leholimo ba Afrika Borwa ka puo ya hao. Ho tjhesa.',
    rain:            'Boemo ba leholimo ba Afrika Borwa ka puo ya hao. Pula e a na.',
    'rain-possible': 'Boemo ba leholimo ba Afrika Borwa ka puo ya hao. Mohlomong pula.',
    storm:           'Boemo ba leholimo ba Afrika Borwa ka puo ya hao. Ledimo le a tla.',
    uv:              'Boemo ba leholimo ba Afrika Borwa ka puo ya hao. UV e hodimo.',
    wind:            'Boemo ba leholimo ba Afrika Borwa ka puo ya hao. Moea o a foka.',
    default:         'Boemo ba leholimo ba Afrika Borwa ka puo ya hao.',
  },
};

function normalizeBg(value) {
  if (!value) return null;
  const v = String(value).toLowerCase().trim();
  return CONDITION_ALLOWLIST.has(v) ? v : null;
}

function normalizeLang(value) {
  if (!value) return DEFAULT_LANG;
  const v = String(value).toLowerCase().trim();
  return SUPPORTED_LANGS.has(v) ? v : DEFAULT_LANG;
}

// Resolve title for (lang, condition). ZU/XH/ST entries are stored as a
// single string (same title across all conditions); EN/AF entries are an
// object keyed by condition.
function resolveTitle(lang, condition) {
  const table = TITLES[lang] ?? TITLES[DEFAULT_LANG];
  if (typeof table === 'string') return table;
  return table[condition] ?? table.default;
}

function resolveDescription(lang, condition) {
  const table = DESCRIPTIONS[lang] ?? DESCRIPTIONS[DEFAULT_LANG];
  return table[condition] ?? table.default;
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

  // Only process GETs to the root document. The matcher is ['/'] (see config
  // below), so /index.html never reaches here — the old extra branch was dead.
  if (request.method !== 'GET') return;
  if (url.pathname !== '/') return;

  const bgParam = url.searchParams.get('bg');
  const city = (url.searchParams.get('city') || '').slice(0, 80) || null;
  const condition = normalizeBg(bgParam) || DEFAULT_CONDITION;
  const lang = normalizeLang(url.searchParams.get('lang'));

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
  const title = resolveTitle(lang, condition);
  const baseDescription = resolveDescription(lang, condition);
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
      'x-pw-share-lang': lang,
    },
  });
}

// Exported for unit tests.
export const __test = {
  normalizeBg,
  normalizeLang,
  swapMeta,
  buildCanonicalUrl,
  resolveTitle,
  resolveDescription,
  CONDITION_ALLOWLIST,
  SUPPORTED_LANGS,
  TITLES,
  DESCRIPTIONS,
};
