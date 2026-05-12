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

export function buildOgImageUrl({ lat, lon, lang = 'en' } = {}, origin = SHARE_ORIGIN) {
  const safeLang = String(lang || 'en');
  const params = new URLSearchParams({ lang: safeLang });
  if (isValidLat(lat) && isValidLon(lon)) {
    params.set('lat', String(lat));
    params.set('lon', String(lon));
  }
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
