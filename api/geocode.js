// /api/geocode.js
// Probably Weather — server-side geocoding proxy (LocationIQ)
//
// Routes both directions so the LocationIQ token never reaches the browser:
//   ?type=search&q=<query>             → LocationIQ /v1/search  → { ok, results: [...] }
//   ?type=reverse&lat=<lat>&lon=<lon>  → LocationIQ /v1/reverse → { ok, name, address, ... }
//
// LocationIQ is Nominatim-API-compatible: same request params, same response
// shape (address object with village/town/suburb/city/state, display_name, lat, lon).
// Replaces the previous client-side calls to nominatim.openstreetmap.org, which
// violated Nominatim's usage policy (per-keystroke autocomplete is forbidden).

const TIMEOUT_MS = 9000;
const GEOCODE_UA = process.env.MET_USER_AGENT || 'ProbablyWeather/1.0 (contact: howzit@probablyweather.co.za)';

// isBadLabel — reject empty labels, "Ward 4"-style admin labels, and bare numbers.
// Same logic as api/weather.js's name-resolution block.
function isBadLabel(s) {
  const v = String(s || '').trim();
  return !v || /\bward\b/i.test(v) || /^\d+$/.test(v);
}

// Mirror of api/weather.js fetchJson — AbortController-based timeout.
async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { ...options, signal: controller.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

// Pick the first non-bad value from a list.
function pick(...vals) {
  return vals.find(v => !isBadLabel(v)) || null;
}

// Resolve a single result's own display name.
// The feature's OWN name leads (r.name), so "Bryn Mawr" shows as itself rather
// than collapsing into its container "Lower Merion Township". Falls back to
// town/village/city, then the first segment of display_name.
function resolveResultName(r) {
  const a = r.address || {};
  const firstSegment = typeof r.display_name === 'string' ? r.display_name.split(',')[0].trim() : '';
  return pick(r.name, a.village, a.town, a.suburb, a.neighbourhood, a.city, firstSegment) || 'Unknown';
}

// Build the reverse-geocode display string.
// Priority: village/town → suburb/neighbourhood → city → municipality → state,
// applying isBadLabel at each step. municipality stays BELOW city so it never
// wins over a real town name (the Malmesbury→Swartland bug).
function buildReverseName(addr) {
  const smallPlace = pick(addr.village, addr.town);
  const suburb     = pick(addr.suburb, addr.neighbourhood);
  const city       = pick(addr.city);
  const municipality = pick(addr.municipality);
  const province   = pick(addr.state, addr.province, addr.region, addr.county);
  const country    = addr.country;

  const parts = [];
  if (smallPlace) {
    parts.push(smallPlace);
    if (province) parts.push(province);
    else if (country) parts.push(country);
  } else if (suburb) {
    parts.push(suburb);
    if (city) parts.push(city);
    else if (province) parts.push(province);
    else if (country) parts.push(country);
  } else if (city) {
    parts.push(city);
    if (province) parts.push(province);
    else if (country) parts.push(country);
  } else if (municipality) {
    parts.push(municipality);
    if (province) parts.push(province);
    else if (country) parts.push(country);
  } else if (province) {
    parts.push(province);
    if (country) parts.push(country);
  } else if (country) {
    parts.push(country);
  }
  return parts.length ? parts.join(', ') : null;
}

export default async function handler(req, res) {
  const TOKEN = process.env.LOCATIONIQ_TOKEN || null;
  const type = typeof req.query.type === 'string' ? req.query.type.toLowerCase() : '';

  // Graceful degradation — no token means no geocoding, but never a crash.
  if (!TOKEN) {
    return res.status(200).json({ ok: false, error: 'Geocoding unavailable', results: [] });
  }

  try {
    // ---------------------------------------------------------------------
    // SEARCH — ?type=search&q=<query>
    // ---------------------------------------------------------------------
    if (type === 'search') {
      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      if (q.length < 2) {
        return res.status(200).json({ ok: true, results: [] });
      }

      const base =
        `https://us1.locationiq.com/v1/search?key=${encodeURIComponent(TOKEN)}` +
        `&q=${encodeURIComponent(q)}&format=json&addressdetails=1&normalizecity=1` +
        `&dedupe=1&limit=10&accept-language=en`;

      // ZA bias: query with countrycodes=za first. If that returns nothing,
      // retry WITHOUT the restriction so a US/UK town search still resolves.
      // This biases the ranking toward South Africa without excluding others.
      let raw = await fetchJson(`${base}&countrycodes=za`, { headers: { 'User-Agent': GEOCODE_UA } });
      if (!Array.isArray(raw) || raw.length === 0) {
        raw = await fetchJson(base, { headers: { 'User-Agent': GEOCODE_UA } });
      }
      if (!Array.isArray(raw)) raw = [];

      const results = raw
        .map(r => ({
          name: resolveResultName(r),
          display_name: r.display_name || null,
          lat: Number(r.lat),
          lon: Number(r.lon),
          address: r.address || {},
          type: r.type || null,
          class: r.class || null,
        }))
        .filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lon));

      // Search results are stable for a given query — safe to cache briefly.
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
      return res.status(200).json({ ok: true, results });
    }

    // ---------------------------------------------------------------------
    // REVERSE — ?type=reverse&lat=<lat>&lon=<lon>
    // ---------------------------------------------------------------------
    if (type === 'reverse') {
      const lat = parseFloat(req.query.lat);
      const lon = parseFloat(req.query.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return res.status(400).json({ ok: false, error: 'Invalid lat/lon' });
      }

      const rev = await fetchJson(
        `https://us1.locationiq.com/v1/reverse?key=${encodeURIComponent(TOKEN)}` +
        `&lat=${lat}&lon=${lon}&format=json&zoom=16&addressdetails=1&normalizecity=1&accept-language=en`,
        { headers: { 'User-Agent': GEOCODE_UA } }
      );
      const addr = rev?.address || {};
      const name = buildReverseName(addr);

      // Reverse lookups for a coordinate change slowly — safe to cache briefly.
      res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');
      return res.status(200).json({
        ok: !!name,
        name,
        address: addr,
        display_name: rev?.display_name || null,
        lat,
        lon,
      });
    }

    return res.status(400).json({ ok: false, error: 'Unknown type — use type=search or type=reverse', results: [] });
  } catch (err) {
    // Never crash — degrade gracefully so the app still renders.
    return res.status(200).json({ ok: false, error: 'Geocoding failed', results: [] });
  }
}
