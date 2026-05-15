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
// Used by the reverse-geocode path, where any non-2xx is a genuine fault.
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

// Strip the secret token out of a URL before it touches a log line.
// Vercel function logs are accessible to anyone with project access, so the
// key must never reach them. Everything else in the query is fair game.
function sanitizeUrl(url) {
  return String(url).replace(/([?&]key=)[^&]+/i, '$1REDACTED');
}

// LocationIQ-specific search fetch.
//   • HTTP 404 = documented "Unable to geocode" → treat as empty result, NOT a fault.
//     This is what makes the ZA→unrestricted fallback work: when the ZA query has
//     no matches (e.g. "Bryn Mawr"), LocationIQ returns 404, we return [], and the
//     fallback fires. Previously fetchJson threw on 404 and the fallback was unreachable.
//   • Other non-2xx (400/401/403/429/500) → log status server-side (with token
//     redacted) and throw so the outer handler returns a real error. Future
//     incidents shouldn't need a re-investigation to find what LocationIQ said.
async function locationIqSearch(url, context) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': GEOCODE_UA }, signal: controller.signal });
    if (r.status === 404) return [];
    if (!r.ok) {
      console.error(`[geocode] LocationIQ ${context} returned HTTP ${r.status} — ${sanitizeUrl(url)}`);
      throw new Error(`LocationIQ HTTP ${r.status}`);
    }
    const data = await r.json();
    return Array.isArray(data) ? data : [];
  } finally {
    clearTimeout(t);
  }
}

// Pick the first non-bad value from a list.
function pick(...vals) {
  return vals.find(v => !isBadLabel(v)) || null;
}

// Resolve a single result's own display name.
// The feature's OWN name leads, so "Bryn Mawr" shows as itself rather than
// collapsing into its container "Lower Merion Township".
// Priority: display_place (autocomplete's pre-split feature name) → r.name →
// address.village/town/suburb/neighbourhood/city → first segment of display_name.
function resolveResultName(r) {
  const a = r.address || {};
  const firstSegment = typeof r.display_name === 'string' ? r.display_name.split(',')[0].trim() : '';
  return pick(r.display_place, r.name, a.name, a.village, a.town, a.suburb, a.neighbourhood, a.city, firstSegment) || 'Unknown';
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

      // /v1/autocomplete is LocationIQ's purpose-built type-ahead endpoint and
      // (unlike /v1/search) documents the `tag` filter. We restrict to inhabited
      // OSM place tags only — drops streets, buildings, golf courses, POIs.
      // Without this filter, "Bryn Mawr" returned six SA streets containing
      // "Bryn"; with it, the ZA query is empty and the unrestricted fallback
      // correctly returns Bryn Mawr, Pennsylvania.
      const SETTLEMENT_TAGS = 'place:city,place:town,place:village,place:suburb,place:hamlet,place:neighbourhood';
      const base =
        `https://us1.locationiq.com/v1/autocomplete?key=${encodeURIComponent(TOKEN)}` +
        `&q=${encodeURIComponent(q)}&format=json&addressdetails=1&normalizecity=1` +
        `&dedupe=1&limit=10&accept-language=en&tag=${SETTLEMENT_TAGS}`;

      // ZA bias: query with countrycodes=za first. If that returns nothing,
      // retry WITHOUT the restriction so a US/UK town search still resolves.
      // This biases the ranking toward South Africa without excluding others.
      // The tag filter applies to BOTH queries — streets are noise everywhere.
      // locationIqSearch handles LocationIQ's 404-on-no-matches contract so a
      // genuinely empty ZA query falls through to the unrestricted fallback.
      let raw = await locationIqSearch(`${base}&countrycodes=za`, 'search (ZA)');
      if (raw.length === 0) {
        raw = await locationIqSearch(base, 'search (unrestricted)');
      }

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
