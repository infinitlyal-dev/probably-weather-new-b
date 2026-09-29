// The scored stations (PLAN §1–§3): every block-68 SYNOP station inside South Africa with ≥ 100 on-the-hour reports
// since March (Ogimet, v7's files), and the 23 airports' METARs (IEM, v7's files). An airport within 3 km of a SYNOP
// station keeps its own row here (the two feeds are compared in §1); the scorer decides which row a place uses.
import { loadIsd, DATA as V7DATA } from '../v7/common.mjs';
import { loadSynop } from '../v7/synop7.mjs';
import { STATIONS as AIRPORTS } from '../v2/stations.mjs';
import { inSouthAfrica } from '../../../api/_lib/precision.js';

export function scoredStations(synop = loadSynop()) {
  const isd = loadIsd(), out = [];
  for (const [id, m] of synop) {
    const meta = isd.get(id);
    if (!meta || meta.ctry !== 'SF' || !inSouthAfrica(meta.lat, meta.lon) || m.size < 100) continue;
    const hours = [...m.keys()].sort((a, b) => a - b);
    // cadence: the most common gap between consecutive reports (hours)
    const gaps = {}; for (let i = 1; i < hours.length; i++) { const g = Math.round((hours[i] - hours[i - 1]) / 3600e3); gaps[g] = (gaps[g] ?? 0) + 1; }
    const cadence = Number(Object.entries(gaps).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 6);
    out.push({ id, kind: 'synop', name: meta.name, lat: meta.lat, lon: meta.lon, elev: meta.elev, reports: m.size, cadence: cadence <= 1 ? 1 : cadence <= 3 ? 3 : 6 });
  }
  for (const a of AIRPORTS) if (!a.skip) out.push({ id: a.id, kind: 'metar', name: a.name, lat: a.lat, lon: a.lon, elev: a.elev, cadence: 1 });
  return out.sort((a, b) => a.id.localeCompare(b.id));
}
export { V7DATA };
