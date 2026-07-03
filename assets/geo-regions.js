const isNum = (value) => Number.isFinite(Number(value));

const inBox = (lat, lon, box) =>
  isNum(lat) && isNum(lon)
  && Number(lat) >= box.minLat && Number(lat) <= box.maxLat
  && Number(lon) >= box.minLon && Number(lon) <= box.maxLon;

export const REGION_BOXES = {
  // Existing Cape Doctor box from app.js, kept byte-for-byte in behaviour.
  'western-cape': { minLat: -34.5, maxLat: -33.0, minLon: 17.5, maxLon: 20.0 },
  gauteng: { minLat: -26.6, maxLat: -25.2, minLon: 27.4, maxLon: 28.7 },
  highveld: { minLat: -26.6, maxLat: -25.2, minLon: 27.4, maxLon: 28.7 },
  'free-state': { minLat: -30.8, maxLat: -26.4, minLon: 24.4, maxLon: 29.2 },
  karoo: { minLat: -33.6, maxLat: -30.0, minLon: 20.0, maxLon: 25.6 },
};

export function isWesternCape(placeOrLat, maybeLon) {
  const lat = typeof placeOrLat === 'object' ? placeOrLat?.lat : placeOrLat;
  const lon = typeof placeOrLat === 'object' ? placeOrLat?.lon : maybeLon;
  return inBox(lat, lon, REGION_BOXES['western-cape']);
}

export function isRegionTagAt(region, lat, lon) {
  const box = REGION_BOXES[region];
  if (!box) return true;
  return inBox(lat, lon, box);
}

export function regionTagsAt(lat, lon) {
  return Object.keys(REGION_BOXES).filter((region) => isRegionTagAt(region, lat, lon));
}
