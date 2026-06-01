// GPS-home name persistence helpers — pure, unit-tested in tests/home-name.test.js.
//
// The weather endpoint's location.name resolves a clean label ("Strand, Western
// Cape") but was display-only; the stored homePlace.name came from
// buildLocationName paths that fall back to a coords string ("34.1°S, 18.8°E")
// when /api/weather?reverse=1 returns ok:false, and renderHome's only self-heal
// fires solely for placeholder names — so a coords name stuck forever and
// returning users saw raw coordinates. shouldPersistHomeName decides when to
// write the good weather name back onto the GPS home.

// The exact shape buildLocationName() emits as its coords fallback:
//   `${Math.abs(lat).toFixed(1)}°${lat<0?'S':'N'}, ${Math.abs(lon).toFixed(1)}°${lon<0?'W':'E'}`
// e.g. "34.1°S, 18.8°E". Anchored ^…$ so a real place name that merely contains
// a degree sign can't match.
const COORDS_NAME_RE = /^\s*\d+(?:\.\d+)?°[NS],\s*\d+(?:\.\d+)?°[EW]\s*$/;

/** True when `name` is a coordinates string (buildLocationName's fallback shape). */
export function isCoordsName(name) {
  return COORDS_NAME_RE.test(String(name == null ? '' : name));
}

/** Mirrors app.js's isPlaceholderName: empty / "unknown…" / "my location…". */
export function isPlaceholderName(name) {
  const v = String(name == null ? '' : name).trim();
  return v === '' || /^unknown\b/i.test(v) || /^my location\b/i.test(v);
}

/**
 * Should the freshly-resolved weather location.name be persisted onto the GPS
 * home place? Only when ALL hold:
 *   · it's a real name — not empty, not a placeholder, and NOT coords-shaped
 *     (persisting coords would re-seed the very bug we're fixing), AND
 *   · the active place IS the home (lat/lon match) — so a pinned search result
 *     or shared-link place is never clobbered, AND
 *   · it actually differs from what's already stored.
 *
 * @param {{locationName:string, homePlace:{name:string,lat:number,lon:number}|null,
 *          activePlace:{lat:number,lon:number}|null}} args
 */
export function shouldPersistHomeName({ locationName, homePlace, activePlace }) {
  if (!locationName || isPlaceholderName(locationName) || isCoordsName(locationName)) return false;
  if (!homePlace || !activePlace) return false;
  if (homePlace.lat !== activePlace.lat || homePlace.lon !== activePlace.lon) return false;
  return homePlace.name !== locationName;
}
