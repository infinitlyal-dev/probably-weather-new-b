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

export function buildOgImageUrl({ lat, lon, lang = 'en', condition } = {}, origin = SHARE_ORIGIN) {
  const safeLang = String(lang || 'en');
  const params = new URLSearchParams({ lang: safeLang });
  if (isValidLat(lat) && isValidLon(lon)) {
    params.set('lat', String(lat));
    params.set('lon', String(lon));
  }
  // ?c= threads the sender's exact display condition so the dynamic card
  // reproduces their background family + witty bin (api/og.js applies the
  // Layer-1 context gates + night-cap on top).
  const c = sanitizeRawCondition(condition);
  if (c) params.set('c', c);
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
// link-preview crawler — land on /share (server-rendered by api/share.js):
//   • og:image → the dynamic /api/og card (background photo + temperature +
//     witty line in the sender's language), NOT a raw /og/<cond>.jpg stock
//     photo. This is the M-2 fix: the share sends the meme, not a stock photo.
//   • ?c=<condition> reproduces the exact condition the sender is looking at
//     (bg family + witty bin); api/og.js re-applies the Layer-1 context gates
//     and the night-cap on top, so no impossible combination ships.
//   • /share then redirects a human tap to /?lat&lon&lang (the app root).
// Shorter than the old ?bg=&lat=&lon=&lang=&city= root URL, and it rides
// navigator.share's dedicated `url` field so the message text carries no raw
// URL (M-3). /share is already SW-correct (query-distinct, never collapsed),
// so this needs no new route or service-worker handling.
export function buildShareLink({ lat, lon, lang = 'en', condition } = {}, origin = SHARE_ORIGIN) {
  const params = new URLSearchParams({ lang: String(lang || 'en') });
  if (isValidLat(lat) && isValidLon(lon)) {
    params.set('lat', String(lat));
    params.set('lon', String(lon));
  }
  const c = sanitizeRawCondition(condition);
  if (c) params.set('c', c);
  return `${origin}/share?${params.toString()}`;
}
