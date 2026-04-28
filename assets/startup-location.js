export function getSharedPlaceFromSearch(search) {
  const params = new URLSearchParams(search || '');
  const lat = Number.parseFloat(params.get('lat'));
  const lon = Number.parseFloat(params.get('lon'));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;

  return {
    name: 'Unknown location',
    lat,
    lon,
    shared: true,
  };
}
