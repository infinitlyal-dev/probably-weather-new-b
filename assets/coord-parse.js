// Strict coordinate parser — THE single implementation (L2 dedupe, 2026-06-11).
//
// Previously four byte-identical copies lived in api/weather.js, api/geocode.js,
// api/og.js and assets/startup-location.js; any hardening fix had to be applied
// four times. It lives under assets/ because the browser can import from here
// while the api/ endpoints can import from anywhere — the reverse isn't true
// (api/** is never served as static files).
//
// Why strict: Number.parseFloat partial-parses ('90abc'→90, '0x10'→0), so a
// corrupted share link like ?lat=90abc would silently resolve to an in-range
// but WRONG location and trigger upstream provider calls for it (codex
// cross-layer finding, 2026-05-30). Requiring the WHOLE trimmed string to be
// a clean decimal returns NaN instead, and every caller fails closed with a
// single Number.isFinite check. Also rejects array-valued params (?lat=1&lat=2
// arrives as an array on Vercel) via the typeof guard.
export function parseCoord(value) {
  if (typeof value !== 'string') return NaN;          // arrays / undefined → reject
  const s = value.trim();
  if (s === '') return NaN;
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
  return Number(s);
}
