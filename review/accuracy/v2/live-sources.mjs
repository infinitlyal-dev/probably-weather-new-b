// The real sources, live: each one's own high and low for a day (production's meta.sourceRanges, as the
// recorder saved them at the first reading of that day, ≤ 06:10 SAST) against the airport's observed
// max / min for that day (METAR hours the recorder saved). Only complete days count.
//   node review/accuracy/v2/live-sources.mjs [--dir <recorder data folder>]
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { RESULTS, isNum, mean, round } from './lib.mjs';

const args = process.argv.slice(2);
const DIR = args.includes('--dir') ? args[args.indexOf('--dir') + 1] : 'C:/Users/27741/OneDrive/Desktop/Probably weather new/probably-weather-new-c/review/accuracy/live';
const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)) : [];
const recs = files.flatMap((f) => readFileSync(path.join(DIR, f), 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } })).filter(Boolean);

const sast = (iso) => new Date(Date.parse(iso) + 2 * 3600e3);
const today = sast(new Date().toISOString()).toISOString().slice(0, 10);
const first = new Map();     // `${icao}|${day}` → the earliest reading of that SAST day at or before 06:10
const temps = new Map();     // `${icao}|${day}` → Map(hour → tempC) from the METARs the recorder saved
for (const r of recs) {
  const t = sast(r.runAtUtc); const day = t.toISOString().slice(0, 10);
  const key = `${r.icao}|${day}`;
  if (t.getUTCHours() * 60 + t.getUTCMinutes() <= 6 * 60 + 10 && r.api?.payload?.meta?.sourceRanges) {
    const prev = first.get(key); if (!prev || r.runAtUtc < prev.runAtUtc) first.set(key, r);
  }
  for (const rep of r.metar?.reports || []) {
    const obsT = sast(rep.reportTime || rep.obsTime * 1000 || rep.time || 0);
    if (!isNum(rep.temp)) continue;
    const d = obsT.toISOString().slice(0, 10); const k = `${r.icao}|${d}`;
    (temps.get(k) || temps.set(k, new Map()).get(k)).set(obsT.getUTCHours(), rep.temp);
  }
}
const rows = [];
for (const [key, r] of first) {
  const [icao, day] = key.split('|');
  if (day >= today) continue;                                  // the day is not over yet
  const T = temps.get(key); if (!T || T.size < 18) continue;
  const obsMax = Math.max(...T.values()), obsMin = Math.min(...T.values());
  for (const s of r.api.payload.meta.sourceRanges) rows.push({ icao, day, source: s.name, max: s.maxTemp, min: s.minTemp, obsMax, obsMin });
  const d0 = r.api.payload.daily?.[0];
  rows.push({ icao, day, source: 'the app (served)', max: d0?.highC, min: d0?.lowC, obsMax, obsMin });
  // Shadow mode (PLAN.md, Fable's rule 2): once the precision change is live, the reading carries the blend
  // alone and the consensus beside what was served, so all three are scored on the same station-days.
  const p0 = r.api.payload.meta.precision?.days?.find((x) => x.day === 0);
  if (p0) {
    rows.push({ icao, day, source: 'precision: blend alone', max: p0.blendHigh, min: p0.blendLow, obsMax, obsMin });
    rows.push({ icao, day, source: 'precision: consensus', max: p0.consensusHigh, min: p0.consensusLow, obsMax, obsMin });
  }
}
const bySource = {};
for (const x of rows) (bySource[x.source] ||= []).push(x);
const out = { days: [...new Set(rows.map((r) => r.day))], stations: [...new Set(rows.map((r) => r.icao))], sources: {} };
for (const [s, list] of Object.entries(bySource)) {
  const eMax = list.filter((x) => isNum(x.max)).map((x) => x.max - x.obsMax), eMin = list.filter((x) => isNum(x.min)).map((x) => x.min - x.obsMin);
  out.sources[s] = { n: list.length, highMae: mean(eMax.map(Math.abs)), highBias: mean(eMax), lowMae: mean(eMin.map(Math.abs)), lowBias: mean(eMin) };
}
mkdirSync(RESULTS, { recursive: true });
writeFileSync(path.join(RESULTS, 'live-sources.json'), JSON.stringify({ ...out, rows }, (k, x) => (typeof x === 'number' ? round(x, 2) : x), 1));
console.log(`complete station-days: ${rows.length ? rows.filter((r) => r.source === 'the app (served)').length : 0} (${out.days.join(', ') || 'none yet'})`);
for (const [s, v] of Object.entries(out.sources)) console.log(`${s.padEnd(16)} high MAE ${v.highMae?.toFixed(2)} bias ${v.highBias?.toFixed(2)} | low MAE ${v.lowMae?.toFixed(2)} bias ${v.lowBias?.toFixed(2)} (n${v.n})`);
