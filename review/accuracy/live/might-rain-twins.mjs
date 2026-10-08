// Part B item 6 (7 Oct 2026 sweep, row 7): "Might rain." from the hour's blended 30 % line. Open-Meteo and WeatherAPI are the
// same ECMWF model; when only those two are at 30 % or more, two copies of one forecast hold the hero.
// Scores every live probability "Might rain." hero at an airport against the airport's reports within 60 minutes either side,
// split by which sources were at 30 % or more for the hour: only the two ECMWF copies, or at least one other source.
//
//   node review/accuracy/live/might-rain-twins.mjs [--dir <folder of recorder .jsonl>]
// Writes review/accuracy/results/might-rain-twins.md.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const dir = args.includes('--dir') ? args[args.indexOf('--dir') + 1] : here;
const recs = [];
for (const f of readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort()) {
  for (const line of readFileSync(path.join(dir, f), 'utf8').split('\n')) { if (line.trim()) try { recs.push(JSON.parse(line)); } catch { /* torn */ } }
}
const TWINS = new Set(['Open-Meteo', 'WeatherAPI']);
const near = (r, mins) => (r.metar?.reports || []).filter((m) => m.icaoId === r.icao && Math.abs(m.obsTime * 1000 - Date.parse(r.api.atUtc)) <= mins * 60e3);
const rows = [];
for (const r of recs) {
  const p = r.api?.payload;
  const n = p?.now;
  if (!r.icao || n?.conditionReason !== 'rain-possible-prob') continue;
  const at30 = (p.meta?.sourceNow || []).filter((s) => typeof s.rainChance === 'number' && s.rainChance >= 30);
  const reps = near(r, 60);
  const toks = reps.flatMap((m) => String(m.wxString || '').split(/\s+/)).filter((t) => t && !/^[-+]?VC/.test(t));
  rows.push({
    icao: r.icao, at: r.runAtUtc.slice(0, 16), blend: n.rainChance,
    at30: at30.map((s) => `${s.name} ${s.rainChance}`).join(', '),
    twinsOnly: at30.length > 0 && at30.every((s) => TWINS.has(s.name)),
    judged: reps.length > 0,
    wet: toks.some((t) => /(RA|DZ|SN|GR|GS|PL|UP)/.test(t)),
    nearShowers: reps.some((m) => /\bVC(SH|TS)\b/.test(m.rawOb || '')),
  });
}
const judged = rows.filter((r) => r.judged);
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)} %` : '–');
const line = (name, list) => `| ${name} | ${list.length} | ${list.filter((r) => r.wet).length} | ${list.filter((r) => !r.wet && r.nearShowers).length} | ${list.filter((r) => !r.wet && !r.nearShowers).length} (${pct(list.filter((r) => !r.wet && !r.nearShowers).length, list.length)}) |`;
const twins = judged.filter((r) => r.twinsOnly), other = judged.filter((r) => !r.twinsOnly);
const md = ['# "Might rain." from the 30 % hour — the ECMWF twins alone (Part B item 6, 8 Oct 2026)', '',
  `Live recorder, ${recs[0]?.runAtUtc?.slice(0, 10)} → ${recs.at(-1)?.runAtUtc?.slice(0, 10)}: ${rows.length} probability "Might rain." heroes at the six airports, ${judged.length} with an airport report within 60 min either side.`, '',
  '| sources at 30 % or more for the hour | hours | rain at the airport | showers nearby (VCSH/VCTS), dry | dry |', '|---|---|---|---|---|',
  line('only Open-Meteo and/or WeatherAPI (the same model)', twins), line('at least one of MET Norway, Pirate, Tomorrow.io', other), '',
  '| airport | UTC | blend | sources at 30 %+ | twins only | rain | VCSH |', '|---|---|---|---|---|---|---|',
  ...judged.map((r) => `| ${r.icao} | ${r.at} | ${r.blend} | ${r.at30} | ${r.twinsOnly ? 'yes' : 'no'} | ${r.wet ? 'yes' : 'no'} | ${r.nearShowers ? 'yes' : 'no'} |`)];
writeFileSync(path.join(here, '..', 'results', 'might-rain-twins.md'), md.join('\n') + '\n');
process.stdout.write(md.slice(0, 10).join('\n') + '\n');
