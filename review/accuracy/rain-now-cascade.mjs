// The cascade (12 Oct 2026): how often a wet hour gets the might-rain key — and with it the cloudy photo
// (assets/weather-visuals.js aliases rain-possible → cloudy) and a cloudy hero line. Reads two run-eval.mjs hour dumps:
// today's code (run on main) and the branch. Per airport/region: wet hours (METAR precipitation that hour), shown
// might-rain, shown rain; and the "Rain's here" calls with how many were wet that hour / within an hour.
//   node review/accuracy/run-eval.mjs --tag cascade-main    (on main)
//   node review/accuracy/run-eval.mjs --tag rain-desc       (on fix/rain-now-descriptive)
//   node review/accuracy/rain-now-cascade.mjs <main-hours.csv> <branch-hours.csv>
import { readFileSync } from 'node:fs';
const parse = (f) => { const [h, ...ls] = readFileSync(f, 'utf8').split('\n').filter(Boolean); const c = h.split(','); return ls.map((l) => { const v = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { v.push(cur); cur = ''; } else cur += ch; } v.push(cur); return Object.fromEntries(c.map((k, i) => [k, v[i]])); }); };
const REG = { FACT: 'Western Cape', FAGG: 'Garden Route', FAPE: 'Eastern Cape', FALE: 'KZN coast', FAOR: 'Highveld', FABL: 'Free State' };
for (const [tag, f] of Object.entries({ main: process.argv[2], branch: process.argv[3] })) {
  const rows = parse(f); const t = (x) => x === 'true' || x === '1';
  console.log(`== ${tag}`); const tot = { wet: 0, rp: 0, rain: 0, calls: 0, right: 0, near: 0 };
  for (const [icao, g] of Object.entries(REG)) {
    const r = rows.filter((x) => x.icao === icao), wet = r.filter((x) => t(x.obsPrecip));
    const rp = wet.filter((x) => x.display === 'rain-possible').length, rain = wet.filter((x) => x.display === 'rain').length;
    const calls = r.filter((x) => x.display === 'rain'), right = calls.filter((x) => t(x.obsPrecip)).length, near = calls.filter((x) => t(x.obsPrecipNear)).length;
    tot.wet += wet.length; tot.rp += rp; tot.rain += rain; tot.calls += calls.length; tot.right += right; tot.near += near;
    console.log(`${g.padEnd(13)} wet ${wet.length}  shown might-rain ${rp} (${Math.round(rp / wet.length * 100)}%)  shown rain ${rain}  | Rain's here calls ${calls.length} right ${right} ±1h ${near}`);
  }
  console.log(`ALL           wet ${tot.wet}  shown might-rain ${tot.rp} (${Math.round(tot.rp / tot.wet * 100)}%)  shown rain ${tot.rain} | calls ${tot.calls} right ${tot.right} (${Math.round(tot.right / tot.calls * 100)}%) ±1h ${tot.near}`);
}
