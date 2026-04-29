export const SHARE_ORIGIN = 'https://probablyweather.co.za';

const isValidLat = (value) => Number.isFinite(Number(value)) && Number(value) >= -90 && Number(value) <= 90;
const isValidLon = (value) => Number.isFinite(Number(value)) && Number(value) >= -180 && Number(value) <= 180;

export function buildOgImageUrl({ lat, lon, lang = 'en' } = {}, origin = SHARE_ORIGIN) {
  const safeLang = String(lang || 'en');
  const params = new URLSearchParams({ lang: safeLang });
  if (isValidLat(lat) && isValidLon(lon)) {
    params.set('lat', String(lat));
    params.set('lon', String(lon));
  }
  return `${origin}/api/og?${params.toString()}`;
}

export function buildShareUrl({ lat, lon, lang = 'en' } = {}, origin = SHARE_ORIGIN) {
  if (!isValidLat(lat) || !isValidLon(lon)) return origin;
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    lang: String(lang || 'en'),
  });
  return `${origin}/share?${params.toString()}`;
}
