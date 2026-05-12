export function getSharedPlaceFromSearch(search) {
  const params = new URLSearchParams(search || '');
  const lat = Number.parseFloat(params.get('lat'));
  const lon = Number.parseFloat(params.get('lon'));

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
