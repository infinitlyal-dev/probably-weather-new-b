export const SHARE_ORIGIN = 'https://probablyweather.co.za';

const isValidLat = (value) => Number.isFinite(Number(value)) && Number(value) >= -90 && Number(value) <= 90;
const isValidLon = (value) => Number.isFinite(Number(value)) && Number(value) >= -180 && Number(value) <= 180;

// Conditions served by static /og/<key>.jpg — must mirror middleware.js allowlist.
const SHARE_BG_ALLOWLIST = new Set([
  'clear', 'cloudy', 'cold', 'fog', 'heat', 'rain',
  'storm', 'wind', 'rain-possible', 'uv', 'default',
]);

// Internal display-condition codes that don't have a dedicated OG slug
// fold into the closest visual equivalent.
const SHARE_BG_ALIASES = {
  'partly-cloudy': 'cloudy',
  hail: 'storm',
  thunder: 'storm',
  night: 'clear',
};

export function normalizeShareCondition(condition) {
  if (!condition) return 'default';
  const v = String(condition).toLowerCase().trim();
  if (SHARE_BG_ALLOWLIST.has(v)) return v;
  if (SHARE_BG_ALIASES[v]) return SHARE_BG_ALIASES[v];
  return 'default';
}

// Format-sanitize a raw display condition for the ?c= share param — lowercase,
// letters + hyphen only, length-capped. Preserves the PRECISE condition
// (partly-cloudy, cold-clear) so the OG card can pick the exact witty bin,
// unlike normalizeShareCondition which folds families for the static /og image.
// api/og.js does the semantic allowlist check (KNOWN_CONDITIONS) on top of this.
export function sanitizeRawCondition(condition) {
  if (!condition) return '';
  const v = String(condition).toLowerCase().trim();
  return /^[a-z][a-z-]{1,20}$/.test(v) ? v : '';
}

// ---- Place names on share links (2026-09-15) ----
// WhatsApp previews showed "Unknown": /share had coordinates but no name, and a
// forecast cell cached after a skipped LocationIQ lookup carries 'Unknown'. The
// link now carries the sender's place. It is shown to strangers in a preview, so
// only a plain place name passes: letters (any script), digits, space and
// . , ' ’ ( ) & - ; at most 60 characters; no placeholders ("Unknown", "My
// location", "Shared location") and no coordinate-shaped names.
export const SHARE_NAME_MAX = 60;
const PLACEHOLDER_NAME_RE = /^(unknown|my location|shared location)\b/i;
const COORDS_NAME_RE = /^\d+(?:\.\d+)?°[NS],\s*\d+(?:\.\d+)?°[EW]$/;

export function cleanShareName(value) {
  const v = String(value ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
  if (!v || v.length > SHARE_NAME_MAX) return '';
  if (PLACEHOLDER_NAME_RE.test(v) || COORDS_NAME_RE.test(v)) return '';
  return /^[\p{L}\p{M}\d .,'’()&-]+$/u.test(v) ? v : '';
}

// The place part only ("Strand, Western Cape" → "Strand"), for the URL and the card.
export function sharePlaceName(value) {
  return cleanShareName(String(value ?? '').split(',')[0]);
}

// Path segment: spaces as '+', everything else percent-encoded.
export function shareNameSegment(value) {
  const place = sharePlaceName(value);
  return place ? encodeURIComponent(place).replace(/%20/g, '+') : '';
}

// Inverse of shareNameSegment. Idempotent on an already-decoded value: the /s/
// rewrite hands the segment to /api/share as ?name=, which the query parser
// decodes before this runs.
export function parseShareNameSegment(raw) {
  const s = String(raw ?? '').replace(/\+/g, ' ');
  let decoded = s;
  try { decoded = decodeURIComponent(s); } catch { /* already decoded */ }
  return cleanShareName(decoded);
}

const TELEMETRY_LANGS = new Set(['en', 'af', 'zu', 'xh', 'st']);

// Error telemetry needs the failing route and display context, not a user's
// precise location or arbitrary query state. Keep only the path, language and
// condition; legacy ?bg= is normalized to ?c= for one stable log shape.
export function sanitizeTelemetryUrl(value) {
  try {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (!raw) return '';
    const url = new URL(raw, SHARE_ORIGIN);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    const params = new URLSearchParams();
    const lang = String(url.searchParams.get('lang') || '').toLowerCase();
    if (TELEMETRY_LANGS.has(lang)) params.set('lang', lang);
    const condition = sanitizeRawCondition(url.searchParams.get('c') || url.searchParams.get('bg'));
    if (condition) params.set('c', condition);
    const query = params.toString();
    return `${url.pathname || '/'}${query ? `?${query}` : ''}`.slice(0, 300);
  } catch {
    return '';
  }
}

export function buildOgImageUrl({ lat, lon, lang = 'en', condition, name } = {}, origin = SHARE_ORIGIN) {
  const safeLang = String(lang || 'en');
  const params = new URLSearchParams({ lang: safeLang });
  const hasCoords = isValidLat(lat) && isValidLon(lon);
  if (hasCoords) {
    // Match /share's public precision so callers emit the canonical OG URL
    // directly instead of making preview crawlers follow a redirect.
    params.set('lat', String(Math.round(Number(lat) * 100) / 100));
    params.set('lon', String(Math.round(Number(lon) * 100) / 100));
  }
  // ?c= threads the sender's exact display condition so the dynamic card
  // reproduces their background family + witty bin (api/og.js applies the
  // Layer-1 context gates + night-cap on top).
  const c = sanitizeRawCondition(condition);
  if (c) params.set('c', c);
  // ?name= puts the place on the card; api/og.js keeps it in the canonical URL.
  const place = hasCoords ? sharePlaceName(name) : '';
  if (place) params.set('name', place);
  return `${origin}/api/og?${params.toString()}`;
}

// Build the user-facing share URL. Recipients land on the app root with:
//   ?bg=<condition>  → edge middleware injects the static og:image
//   &city=<name>     → middleware threads the city into og:description
//   &lat/&lon        → app loads the shared location on first paint
//   &lang=<code>     → recipient sees the sender's language
//
// All params are optional. Missing coords / condition / city still produce a
// valid URL — the middleware will fall back to the default OG image.
export function buildShareUrl({ lat, lon, lang = 'en', condition, city } = {}, origin = SHARE_ORIGIN) {
  const params = new URLSearchParams();
  params.set('bg', normalizeShareCondition(condition));
  if (isValidLat(lat) && isValidLon(lon)) {
    params.set('lat', String(lat));
    params.set('lon', String(lon));
  }
  params.set('lang', String(lang || 'en'));
  if (city) {
    const trimmed = String(city).trim().slice(0, 80);
    if (trimmed) params.set('city', trimmed);
  }
  return `${origin}/?${params.toString()}`;
}

// Build the branded, crawler-friendly share link. Recipients — and WhatsApp's
// link-preview crawler — land on the server-rendered share page (api/share.js):
//   • og:image → the dynamic /api/og card (background photo + temperature +
//     witty line + place in the sender's language), NOT a raw /og/<cond>.jpg.
//   • the condition reproduces the exact bg + witty bin the sender is looking
//     at; api/og.js re-applies the Layer-1 context gates and the night-cap.
//   • the share page then redirects a human tap to /?lat&lon&lang (the app root).
//
// With coordinates it is the short path form (2026-09-15):
//   /s/<lang>/<lat>/<lon>/<condition>[/<Place>]   e.g. /s/en/-34.12/18.84/rain/Strand
// vercel.json rewrites it to /api/share. Without coordinates it stays
// /share?lang=…, and the old /share?lat&lon&lang&c query form keeps working.
export function buildShareLink({ lat, lon, lang = 'en', condition, name } = {}, origin = SHARE_ORIGIN) {
  const safeLang = String(lang || 'en');
  const c = sanitizeRawCondition(condition);
  // NUMBERS only (callers pass activePlace coords, already numeric). A loose
  // Number() coercion here would canonicalise junk strings ('0x10' → 16) into
  // valid-looking coords BEFORE the server's strict parseCoord gate sees them.
  if (typeof lat === 'number' && typeof lon === 'number' && isValidLat(lat) && isValidLon(lon)) {
    // 2-decimal coords (~1.1km) — plenty for a weather forecast, and it keeps
    // the visible share URL short. Rounding happens ONLY here (the share link);
    // the app itself keeps full precision.
    const lat2 = String(Math.round(lat * 100) / 100);
    const lon2 = String(Math.round(lon * 100) / 100);
    const segment = shareNameSegment(name);
    return `${origin}/s/${encodeURIComponent(safeLang)}/${lat2}/${lon2}/${c || 'clear'}${segment ? `/${segment}` : ''}`;
  }
  const params = new URLSearchParams({ lang: safeLang });
  if (c) params.set('c', c);
  return `${origin}/share?${params.toString()}`;
}
