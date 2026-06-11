// IP-based approximate location from Vercel's geo headers.
//
// Replaces the third-party ipapi.co call that sat on the first-open critical
// path: Vercel stamps x-vercel-ip-latitude / -longitude / -city / -country on
// every request at the edge, so the lookup is a same-origin round-trip with no
// third-party handshake, no free-tier quota, and no 5s timeout exposure
// (ipapi.co throttles aggressively behind SA carrier NAT — its worst case WAS
// the black-screen worst case).
//
// Privacy posture preserved from the old client-side path: coordinates are
// rounded to 1 decimal (~11 km) before they ever reach the page.
//
// No rate limiting: the handler reads request headers only — there is no paid
// upstream to protect and the response is smaller than a 429 would be.
export default function handler(req, res) {
  // Per-IP response — must never be cached cross-user at the edge.
  res.setHeader('Cache-Control', 'private, no-store');

  const h = req.headers || {};
  const lat = Number.parseFloat(h['x-vercel-ip-latitude']);
  const lon = Number.parseFloat(h['x-vercel-ip-longitude']);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)
      || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    // Local dev / non-Vercel runtime / headerless edge case — the client
    // falls back to its own ultimate default (Johannesburg).
    return res.status(200).json({ ok: false });
  }

  // x-vercel-ip-city is percent-encoded (e.g. "Cape%20Town").
  let city = null;
  const rawCity = h['x-vercel-ip-city'];
  if (typeof rawCity === 'string' && rawCity) {
    try { city = decodeURIComponent(rawCity); } catch { city = rawCity; }
  }
  const rawCountry = h['x-vercel-ip-country'];
  const country = typeof rawCountry === 'string' && rawCountry ? rawCountry.toUpperCase() : null;

  return res.status(200).json({
    ok: true,
    lat: Math.round(lat * 10) / 10,
    lon: Math.round(lon * 10) / 10,
    name: city && country ? `${city}, ${country}` : (city || null),
  });
}
