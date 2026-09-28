// The populated places near a station (GeoNames ZA, population ≥ 500 or a town-class feature), with distance, bearing
// and ground height against the station's — the raw material for towns.json (PLAN §4: within 12 km, ground within
// 150 m of the station's, same side of the mountains and the coast, judged by hand from this list).
//   node review/accuracy/v7/towns-near.mjs 68911 [68816 ...]
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DATA } from './common.mjs';
import { gustStationsFromDisk } from './synop7.mjs';

const ids = process.argv.slice(2);
const st = gustStationsFromDisk(100);
const geo = readFileSync(path.join(DATA, 'ZA.txt'), 'utf8').split('\n').map((l) => l.split('\t')).filter((c) => c[6] === 'P' && c[7] !== 'PPLH' && c[7] !== 'PPLQ')
  .map((c) => ({ name: c[1], lat: Number(c[4]), lon: Number(c[5]), pop: Number(c[14]), dem: Number(c[16]) }));
const km = (a, b) => 111.2 * Math.hypot(a.lat - b.lat, (a.lon - b.lon) * Math.cos((a.lat * Math.PI) / 180));
const brg = (a, b) => Math.round((Math.atan2((b.lon - a.lon) * Math.cos((a.lat * Math.PI) / 180), b.lat - a.lat) * 180) / Math.PI + 360) % 360;
for (const id of ids) {
  const s = st.find((x) => x.id === id); if (!s) { console.log(`${id}: not a gust station`); continue; }
  const near = geo.filter((g) => km(s, g) <= 12).sort((a, b) => km(s, a) - km(s, b));
  const sDem = near.length ? null : null;
  console.log(`${id} ${s.name} (${s.lat}, ${s.lon}, ${s.elev} m):`);
  for (const g of near) console.log(`  ${g.name.padEnd(28)} ${km(s, g).toFixed(1).padStart(5)} km  bearing ${String(brg(s, g)).padStart(3)}°  ground ${g.dem} m (${g.dem - s.elev >= 0 ? '+' : ''}${g.dem - s.elev})  pop ${g.pop}  ${g.lat},${g.lon}`);
}
