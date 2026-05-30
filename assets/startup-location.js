// Strict coordinate parser — parity with api/weather.js, api/geocode.js, api/og.js.
// Number.parseFloat partial-parses ('90abc'→90, '0x10'→0), so a corrupted share
// link like ?lat=90abc would silently resolve to an in-range but WRONG location
// (90,N) and trigger a /api/weather call for it (codex cross-layer finding,
// 2026-05-30). Requiring the whole trimmed string to be a clean decimal means a
// malformed share coord returns null here and the app falls back to the user's
// own geolocation instead of showing the wrong place. Valid share links
// (-34.1163 / 18.8362 etc.) are unaffected. URLSearchParams.get returns a string
// or null, so the typeof guard mainly future-proofs against non-string callers.
function parseCoord(value) {
  if (typeof value !== 'string') return NaN;
  const s = value.trim();
  if (s === '') return NaN;
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
  return Number(s);
}

export function getSharedPlaceFromSearch(search) {
  const params = new URLSearchParams(search || '');
  const lat = parseCoord(params.get('lat'));
  const lon = parseCoord(params.get('lon'));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

  // Honour ?city= when present — share URLs emit it (assets/share-url.js)
  // and the recipient should see the sender's location name immediately,
  // not "Unknown location" while reverse-geocode is in flight. Trim, cap
  // to 80 chars (mirrors middleware.js sanitization), and drop empty /
  // whitespace-only values back to the default sentinel.
  const rawCity = params.get('city');
  const trimmed = typeof rawCity === 'string' ? rawCity.trim().slice(0, 80) : '';
  const name = trimmed || 'Unknown location';

  return {
    name,
    lat,
    lon,
    shared: true,
  };
}
