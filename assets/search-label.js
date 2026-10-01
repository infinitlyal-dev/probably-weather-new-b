// Search-result labels — pure, unit-tested in tests/search-label.test.js.
//
// 1 Oct 2026 (outside reviewer, 30 Sept): "Witbank" listed "Witbank, South Africa" above
// "eMalahleni, South Africa" and nothing told a reader they are two different places (one is a
// small town in the Northern Cape, the other is the Mpumalanga city that used to be called
// Witbank). Every row now carries its province, and a suburb carries the town or city it sits in.
//
// searchResultName() is the STORED name (favourites, recents, the Home title before the weather
// call renames it) and stays "City, Country" so samePlace/favourites keep working; only the
// DISPLAY label (searchLabelParts) gains the province.

// The feature's OWN name — what the user searched for, not its container.
function ownName(r) {
  const a = r?.address || {};
  return r?.name || a.town || a.village || a.city || 'Unknown';
}

/** The raw "City, Country" name that is stored and compared; independent of the display language. */
export function searchResultName(r) {
  const a = r?.address || {};
  const city = ownName(r);
  return a.country ? `${city}, ${a.country}` : city;
}

// A container worth showing to a reader. "Khâi-Ma Local Municipality" is an admin unit, not a
// place anyone says out loud, so a municipality is skipped (mirrors the order in api/geocode.js
// buildReverseName, where a municipality ranks below every real place name).
const MUNICIPALITY_RE = /\bmunicipality\b/i;
const isUsable = (s) => {
  const v = String(s || '').trim();
  return !!v && !/\bward\b/i.test(v) && !/^\d+$/.test(v) && !MUNICIPALITY_RE.test(v);
};
const pick = (...vals) => vals.find(isUsable) || null;

const SUBURB_TYPES = new Set(['suburb', 'neighbourhood', 'quarter', 'city_district', 'borough']);

/**
 * The display label as English parts, own name first:
 *   town / village / city  → [Name, Province]
 *   suburb / neighbourhood → [Name, Town-or-city, Province]  (the container only when it differs)
 *   outside South Africa   → the same, plus the country
 *   no province known      → [Name, Country]
 * Parts are raw English; the caller localizes the province and country (localizePlaceParts).
 */
export function searchLabelParts(r) {
  const a = r?.address || {};
  const name = ownName(r);
  const province = pick(a.state, a.province, a.region);
  const country = isUsable(a.country) ? String(a.country).trim() : null;
  const inZa = String(a.country_code || '').toLowerCase() === 'za' || country === 'South Africa';

  const parts = [name];
  if (SUBURB_TYPES.has(String(r?.type || '').toLowerCase())) {
    const container = pick(a.city, a.town, a.village);
    if (container && container.toLowerCase() !== name.toLowerCase()) parts.push(container);
  }
  if (province) {
    parts.push(province);
    if (!inZa && country) parts.push(country);
  } else if (country) {
    parts.push(country);
  }
  // A province that is the place's own name ("Gauteng") must not repeat.
  return parts.filter((p, i) => i === 0 || p.toLowerCase() !== parts[i - 1].toLowerCase());
}

/**
 * Drop a result only when an earlier one has the same stored name AND sits within `maxKm` of it
 * (the "Bryn Mawr triplication" fix). Two places that merely share a name — Witbank in the
 * Northern Cape and the Witbank that is now eMalahleni — are 1,000+ km apart and both stay.
 * `distanceKm(a, b)` is passed in (app.js's haversineKm) so this stays dependency-free.
 */
export function dedupeSearchResults(results, distanceKm, maxKm = 1) {
  return results.filter((r, i) => !results.slice(0, i).some((prev) =>
    searchResultName(prev) === searchResultName(r) && distanceKm(prev, r) <= maxKm));
}
