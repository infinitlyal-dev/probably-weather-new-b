// Download the terrain tiles the geometry needs (no weather): coast samples for every scored station, the line between
// every pair of scored stations 2–40 km apart (D is learned on them), and, for every town within 40 km of an airport
// (the live stations, PLAN §8), its coast samples and its lines to those airports.
//   node review/accuracy/stations/prep-geo.mjs
import { ensureParallel, coastPoints, linePoints, kmBetween } from './geo.mjs';
import { scoredStations } from './stations.mjs';
import { loadTowns } from './towns.mjs';

const st = scoredStations(), air = st.filter((s) => s.kind === 'metar');
const pts = [];
for (const s of st) pts.push(...coastPoints(s.lat, s.lon));
for (let i = 0; i < st.length; i++) for (let j = i + 1; j < st.length; j++) {
  const d = kmBetween(st[i].lat, st[i].lon, st[j].lat, st[j].lon);
  if (d >= 2 && d <= 40) pts.push(...linePoints(st[i].lat, st[i].lon, st[j].lat, st[j].lon));
}
const towns = loadTowns(st);
let near = 0;
for (const t of towns) {
  const a = air.filter((s) => kmBetween(t.lat, t.lon, s.lat, s.lon) <= 40);
  if (!a.length) continue;
  near++;
  pts.push(...coastPoints(t.lat, t.lon));
  for (const s of a) pts.push(...linePoints(t.lat, t.lon, s.lat, s.lon));
}
console.log(`stations ${st.length} (airports ${air.length}), towns ${towns.length} (${near} within 40 km of an airport), points ${pts.length}`);
await ensureParallel(pts, 6);
console.log('GEO DONE');
