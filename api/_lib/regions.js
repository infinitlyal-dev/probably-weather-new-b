// SA REGIONS for the rules proven region by region (review/accuracy/v3/PLAN.md, 25 Sept 2026). A place belongs
// to the region of its nearest measured station — the 16 airports and 4 SA Weather Service towns the accuracy
// checks score (review/accuracy/v2/stations.mjs SCORED, v2/fetch-synop.mjs SYNOP_STATIONS; a test pins the copy).
// A rule that was proven in some regions and not others looks its region up here; a region not proven keeps
// today's behaviour. Outside South Africa's box there is no region (null). The Lowveld block of the precision
// layer stays its own geometry (precision.js inLowveld), reviewed before this map existed.
// These are station cells (nearest station wins), not climate zones: Strand falls to Cape Town airport (27 km),
// Langebaan to Langebaanweg, but Ermelo reaches the Lowveld (Mbombela 167 km beats Johannesburg 178 km) and
// Bethlehem KZN inland (Ladysmith 144 km). Harmless for what ships on it; read a region as "measured like".
import { inSouthAfrica } from './precision.js';

export const REGION_STATIONS = [
  { id: 'FACT', region: 'Western Cape', lat: -33.967, lon: 18.600 },
  { id: 'FALW', region: 'West Coast', lat: -32.972, lon: 18.158 },
  { id: 'FAGG', region: 'Garden Route', lat: -34.006, lon: 22.379 },
  { id: 'FAPE', region: 'Eastern Cape', lat: -33.984, lon: 25.611 },
  { id: 'FAEL', region: 'Eastern Cape', lat: -33.036, lon: 27.826 },
  { id: 'FAUT', region: 'Eastern Cape', lat: -31.530, lon: 28.670 },
  { id: 'FALE', region: 'KZN coast', lat: -29.602, lon: 31.130 },
  { id: 'FAOR', region: 'Highveld', lat: -26.133, lon: 28.239 },
  { id: 'FAWB', region: 'Highveld', lat: -25.654, lon: 28.224 },
  { id: 'FABL', region: 'Free State', lat: -29.093, lon: 26.302 },
  { id: 'FAUP', region: 'Northern Cape', lat: -28.414, lon: 21.260 },
  { id: 'FAKM', region: 'Northern Cape', lat: -28.803, lon: 24.765 },
  { id: 'FAMM', region: 'North West', lat: -25.798, lon: 25.548 },
  { id: 'FAKN', region: 'Lowveld', lat: -25.383, lon: 31.106 },
  { id: 'FAHS', region: 'Lowveld', lat: -24.367, lon: 31.033 },
  { id: 'FAPP', region: 'Limpopo', lat: -23.845, lon: 29.459 },
  { id: '68727', region: 'Karoo', lat: -32.350, lon: 22.550 },
  { id: '68737', region: 'Karoo', lat: -32.200, lon: 24.550 },
  { id: '68581', region: 'KZN inland', lat: -29.633, lon: 30.400 },
  { id: '68479', region: 'KZN inland', lat: -28.567, lon: 29.767 },
];

const RAD = Math.PI / 180;
// great-circle distance, km (haversine) — small enough to run on every request
function km(aLat, aLon, bLat, bLon) {
  const dLat = (bLat - aLat) * RAD, dLon = (bLon - aLon) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * RAD) * Math.cos(bLat * RAD) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The region of the nearest measured station, or null outside South Africa's box. */
export function regionOf(lat, lon) {
  if (!inSouthAfrica(lat, lon)) return null;
  let best = null, bestKm = Infinity;
  for (const s of REGION_STATIONS) { const d = km(lat, lon, s.lat, s.lon); if (d < bestKm) { bestKm = d; best = s; } }
  return best.region;
}
