// Fetch the elevations the geometry needs (no weather): coast samples for every scored station, the line between every
// pair of scored stations 2–40 km apart, and — with --towns — coast samples for the towns list and the lines from each
// town to every scored station within 40 km.   node review/accuracy/stations/prep-geo.mjs [--towns]
import { elevations, coastPoints, linePoints, kmBetween } from './geo.mjs';
import { scoredStations } from './stations.mjs';
import { loadTowns } from './towns.mjs';

const st = scoredStations();
const pts = [];
for (const s of st) pts.push(...coastPoints(s.lat, s.lon));
for (let i = 0; i < st.length; i++) for (let j = i + 1; j < st.length; j++) {
  const d = kmBetween(st[i].lat, st[i].lon, st[j].lat, st[j].lon);
  if (d >= 2 && d <= 40) pts.push(...linePoints(st[i].lat, st[i].lon, st[j].lat, st[j].lon));
}
console.log(`stations ${st.length}, points ${pts.length}`);
await elevations(pts);
if (process.argv.includes('--towns')) {
  const towns = loadTowns(st), tp = [];
  for (const t of towns) {
    tp.push(...coastPoints(t.lat, t.lon));
    for (const s of st) if (kmBetween(t.lat, t.lon, s.lat, s.lon) <= 40) tp.push(...linePoints(t.lat, t.lon, s.lat, s.lon));
  }
  console.log(`towns ${towns.length}, points ${tp.length}`);
  await elevations(tp);
}
console.log('GEO DONE');
