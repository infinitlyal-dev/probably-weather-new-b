// Refresh-behaviour helpers — pure functions used by app.js for the
// launch / visibilitychange / pull-to-refresh paths. Extracted into a module
// so the logic is unit-testable independently of the DOM.
//
// Bug this addresses: Al installed PW in Strand, drove to Paarl (~50km),
// opened the app — saw Strand weather because there was no GPS re-detection
// on visibility return. Phase A's `visibilitychange` handler only re-fetched
// weather for the cached homePlace; it never asked GPS for a new fix.

// Stale-data threshold: refetches gated on this so we don't hammer the API
// on every tab-focus. Matches the value the existing visibilitychange
// handler already used (15 min).
export const FRESHNESS_MS = 15 * 60 * 1000;

// Distance threshold (km) for "the user has moved". 5 km is small enough
// to catch driving between SA towns (Strand → Somerset West ≈ 8 km, Strand
// → Paarl ≈ 50 km, Cape Town CBD → Sea Point ≈ 5 km) and big enough to
// ignore GPS drift on the same property.
export const SIGNIFICANT_MOVE_KM = 5;

// Place "mode" values. A place is either:
//   - 'gps':    auto-derived from device sensors (or IP fallback). On next
//               launch / visibilitychange we attempt re-detection.
//   - 'pinned': user explicitly chose this place from Search / Favorites /
//               Recents / a shared link. GPS is NOT allowed to override.
export const PLACE_MODE_GPS = 'gps';
export const PLACE_MODE_PINNED = 'pinned';

/**
 * Great-circle distance between two {lat, lon} points, in kilometres.
 * Haversine formula. Returns NaN if either input is missing coords.
 */
export function haversineKm(a, b) {
  if (!a || !b || typeof a.lat !== 'number' || typeof a.lon !== 'number' || typeof b.lat !== 'number' || typeof b.lon !== 'number') {
    return NaN;
  }
  const R = 6371;
  const toRad = (deg) => deg * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Decide whether the weather should be re-fetched for the current place.
 *
 * @param {object} args
 * @param {number|null} args.lastFetchTime  Epoch ms of last completed fetch
 * @param {string} args.source              'launch' | 'visibilitychange' | 'pull-to-refresh' | 'interval'
 * @returns {boolean}
 *
 * Rule: pull-to-refresh always wins (user intent overrides freshness).
 * Otherwise, only refetch when data is older than FRESHNESS_MS.
 */
export function shouldRefetchWeather({ lastFetchTime, source }) {
  if (source === 'pull-to-refresh') return true;
  if (lastFetchTime === null || lastFetchTime === undefined) return true;
  return Date.now() - lastFetchTime > FRESHNESS_MS;
}

/**
 * Decide whether the place's lat/lon should be updated from a new GPS fix.
 *
 * @param {object} args
 * @param {object} args.activePlace   { lat, lon, mode } — currently-displayed place
 * @param {object} args.newGps        { lat, lon } — fresh getCurrentPosition result
 * @returns {boolean}
 *
 * Rules:
 *  - Manually-pinned places are sticky. Never override with GPS detection.
 *  - GPS places update only when the new position is >SIGNIFICANT_MOVE_KM
 *    away from the currently-displayed coords.
 */
export function shouldUpdateLocation({ activePlace, newGps }) {
  if (!activePlace || !newGps) return false;
  if (activePlace.mode !== PLACE_MODE_GPS) return false;
  const distance = haversineKm(
    { lat: activePlace.lat, lon: activePlace.lon },
    { lat: newGps.lat, lon: newGps.lon },
  );
  if (!Number.isFinite(distance)) return false;
  return distance > SIGNIFICANT_MOVE_KM;
}

/**
 * Pull-to-refresh threshold (px). Distance the user must drag downward
 * from scrollTop=0 before release triggers a refresh.
 */
export const PTR_THRESHOLD_PX = 70;

/**
 * Pull-to-refresh max overscroll (px). Caps how far the affordance
 * stretches even if the user keeps dragging — feels rubber-bandy
 * instead of unbounded.
 */
export const PTR_MAX_OVERSCROLL_PX = 120;

/**
 * Resistance factor — drag distance is multiplied by this for visual feel.
 * 0.5 means the affordance moves half as far as the finger.
 */
export const PTR_RESISTANCE = 0.5;

/**
 * Localised PTR copy. Three states:
 *   - below threshold: "Pull to refresh"
 *   - at/above threshold: "Release to refresh"
 *   - during fetch: "Refreshing…"
 * Five languages: en / af / zu / xh / st (Sotho).
 */
export const PTR_COPY = {
  pull: {
    en: 'Pull to refresh',
    af: 'Trek om te verfris',
    zu: 'Donsa ukuvuselela',
    xh: 'Tsala ukuhlaziya',
    st: 'Hula ho ntjhafatsa',
  },
  release: {
    en: 'Release to refresh',
    af: 'Los om te verfris',
    zu: 'Dedela ukuvuselela',
    xh: 'Khulula ukuhlaziya',
    st: 'Tlohela ho ntjhafatsa',
  },
  refreshing: {
    en: 'Refreshing…',
    af: 'Besig om te verfris…',
    zu: 'Iyavuselela…',
    xh: 'Iyahlaziywa…',
    st: 'E a ntjhafatsa…',
  },
};
