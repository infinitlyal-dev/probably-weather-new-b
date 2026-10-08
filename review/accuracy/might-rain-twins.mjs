// Part B item 6 on the harness (8 Oct 2026): every hour the shipped resolver served "Might rain." from the blended 30 % line
// (reason rain-possible-prob), split by which slots were at 30 % or more for the hour — only Open-Meteo and the WeatherAPI slot
// (here the ECMWF archive: the same model twice), or at least one independent model — and scored against the airport.
// Also tries the candidate rules, each as "what the hero would lose / keep":
//   A  the twins count once: an independent source must be at 30 % too
//   B  the twins alone need a higher blend (50 %, 60 %)
//
//   node review/accuracy/might-rain-twins.mjs        writes results/might-rain-twins-harness.md

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { CITIES, ACCURACY_ROOT, RANGE, ensembleAt, loadCity } from './lib/sources.mjs';
import { decideAt } from './lib/replay.mjs';
import { loadStationHourly, precipNear } from './lib/obs.mjs';

const TWINS = new Set(['Open-Meteo', 'WeatherAPI']);
const rows = [];
for (const icao of Object.keys(CITIES)) {
  const city = loadCity(icao);
  const obs = loadStationHourly(path.join(ACCURACY_ROOT, 'obs', `metar-${icao}-${RANGE.from.replace(/-/g, '')}-${RANGE.to.replace(/-/g, '')}.csv`));
  for (let i = 0; i < city.nHours; i++) {
    const key = city.times[i].slice(0, 13);
    const o = obs.get(key);
    if (!o) continue;
    const r = decideAt(city, i);
    if (r.server.reason !== 'rain-possible-prob') continue;
    const E = ensembleAt(city, i);
    const at30 = E.hourlies.filter(Boolean).filter((h) => typeof h.rains?.[E.localHour] === 'number' && h.rains[E.localHour] >= 30).map((h) => h.source);
    rows.push({ icao, time: r.time, blend: r.blends.rainChance, at30, twinsOnly: at30.length > 0 && at30.every((s) => TWINS.has(s)),
      wet: Boolean(o.precip || o.precipAnyReport), wetNear: Boolean(precipNear(obs, key)), hero: r.frontend.hero });
  }
}
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)} %` : '–');
const line = (name, list) => `| ${name} | ${list.length} | ${list.filter((r) => r.wetNear).length} (${pct(list.filter((r) => r.wetNear).length, list.length)}) | ${list.filter((r) => !r.wetNear).length} |`;
const twins = rows.filter((r) => r.twinsOnly), other = rows.filter((r) => !r.twinsOnly);
const keepB = (min) => rows.filter((r) => !r.twinsOnly || r.blend >= min);
const md = ['# "Might rain." from the 30 % hour on the harness (Part B item 6, 8 Oct 2026)', '',
  `Six airports, ${RANGE.from} → ${RANGE.to}. ${rows.length} hours the shipped resolver served "Might rain." from the blended 30 % line. "Wet" = rain reported that hour or the hour either side.`, '',
  '| which slots were at 30 % or more | hours | wet | dry |', '|---|---|---|---|',
  line('only Open-Meteo and the WeatherAPI slot (ECMWF twice)', twins), line('at least one independent model', other), '',
  '## Candidate rules: the "Might rain." hours each would keep', '',
  '| rule | hours kept | wet | dry | wet hours lost | dry hours removed |', '|---|---|---|---|---|---|',
  ...[['today (no change)', rows], ['A: an independent source at 30 % too', other], ['B: twins alone need 50 %', keepB(50)], ['B: twins alone need 60 %', keepB(60)]].map(([name, list]) =>
    `| ${name} | ${list.length} | ${list.filter((r) => r.wetNear).length} | ${list.filter((r) => !r.wetNear).length} | ${rows.filter((r) => r.wetNear).length - list.filter((r) => r.wetNear).length} | ${rows.filter((r) => !r.wetNear).length - list.filter((r) => !r.wetNear).length} |`),
  '', 'Blend bands of the twins-only hours:', '', '| blend | hours | wet |', '|---|---|---|',
  ...[[30, 40], [40, 50], [50, 60], [60, 101]].map(([a, b]) => { const l = twins.filter((r) => r.blend >= a && r.blend < b); return `| ${a}–${b === 101 ? 100 : b - 1} % | ${l.length} | ${l.filter((r) => r.wetNear).length} (${pct(l.filter((r) => r.wetNear).length, l.length)}) |`; })];
writeFileSync(path.join(ACCURACY_ROOT, 'results', 'might-rain-twins-harness.md'), md.join('\n') + '\n');
process.stdout.write(md.join('\n') + '\n');
