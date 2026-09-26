// THE HONEST RAIN % — the pre-registered rule (v2/PLAN.md, 25 Sept 10:55 SAST) applied to the recorder (v4/PLAN.md
// §3, c639248): the calibrated % (the 2025 curve "the app's %, calibrated", results/rain.json) must beat the % the
// app really served on the Brier score with the whole 95 % interval below zero, 7-day blocks, for rain today, and no
// airport's interval above zero. Next 3 hours reported as secondary. Same readings and truth as v2/live-rain.mjs:
// rain today on one reading per airport-day, the first of the local day read by 06:59. The bootstrap runs only with
// >= 4 complete 7-day blocks (Fable); below that the rule is not met.
//   node review/accuracy/v4/rainpct.mjs [--dir <recorder data folder>]
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { RESULTS, isNum, round, applyCurve, bootDiff } from '../v2/lib.mjs';

const args = process.argv.slice(2);
const DIR = args.includes('--dir') ? args[args.indexOf('--dir') + 1] : 'C:/Users/27741/OneDrive/Desktop/Probably weather new/probably-weather-new-c/review/accuracy/live';
const rain = JSON.parse(readFileSync(path.join(RESULTS, 'rain.json'), 'utf8'));
const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)) : [];
const recs = files.flatMap((f) => readFileSync(path.join(DIR, f), 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } })).filter((r) => r?.icao && r?.api?.payload?.hourly);

// the airports' reports, hour by hour (UTC) — as live-rain.mjs
const WET = /^[+-]?(MI|BC|PR|DR|BL|SH|TS|FZ)?(DZ|RA|SN|SG|PL|GR|GS|UP)+$/;
const reported = new Map();
for (const r of recs) for (const rep of r.metar?.reports || []) {
  const t = Date.parse(rep.reportTime); if (!isNum(t)) continue;
  const toks = String(rep.rawOb || '').replace(/^(METAR|SPECI)\s+/, '').split(/\s+/);
  const key = `${r.icao}|${new Date(Math.floor(t / 3600e3) * 3600e3).toISOString().slice(0, 13)}`;
  reported.set(key, Boolean(reported.get(key)) || toks.some((x) => WET.test(x)));
}
const wetIn = (icao, fromMs, hours) => {
  const seen = []; for (let k = 1; k <= hours; k++) { const key = `${icao}|${new Date(Math.floor(fromMs / 3600e3) * 3600e3 + k * 3600e3).toISOString().slice(0, 13)}`; if (reported.has(key)) seen.push(reported.get(key)); }
  return seen.length >= Math.ceil(hours * 0.75) ? seen.some(Boolean) : null;
};
const sastDay = (ms) => new Date(ms + 2 * 3600e3).toISOString().slice(0, 10);
const next3h = [], today = [], firstOfDay = new Map();
for (const r of recs) {
  const p = r.api.payload, at = Date.parse(r.api.atUtc || r.runAtUtc), h = p.meta?.localHour;
  if (!isNum(at) || !isNum(h)) continue;
  const served = Math.max(...[1, 2, 3].map((k) => p.hourly[h + k]?.rainChance).filter(isNum));
  const wet = wetIn(r.icao, at, 3);
  if (isFinite(served) && wet !== null) next3h.push({ icao: r.icao, day: sastDay(at), served: served / 100, wet });
  const day = sastDay(at), key = `${r.icao}|${day}`, prev = firstOfDay.get(key);
  if (!prev || at < prev.at) firstOfDay.set(key, { at, r, h, day });
}
for (const { at, r, h, day } of firstOfDay.values()) {
  const served = r.api.payload.daily?.[0]?.rainChance; if (!isNum(served) || h > 6) continue;
  const wet = wetIn(r.icao, at - (h + 1) * 3600e3, 24); if (wet === null) continue;
  today.push({ icao: r.icao, day, served: served / 100, wet });
}
const week = (d) => String(Math.floor(Date.parse(`${d}T00:00:00Z`) / 86400e3 / 7));
function judge(items, curve) {
  const pairs = items.map((x) => ({ day: x.day, a: (applyCurve(curve, x.served) - (x.wet ? 1 : 0)) ** 2, b: (x.served - (x.wet ? 1 : 0)) ** 2, icao: x.icao }));
  const weeks = new Map(); for (const x of items) weeks.set(week(x.day), (weeks.get(week(x.day)) || new Set()).add(x.day));
  const completeWeeks = [...weeks.values()].filter((s) => s.size === 7).length;
  const avg = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
  if (completeWeeks < 4) return { n: items.length, rained: items.filter((x) => x.wet).length, weeks: weeks.size, completeWeeks, pooled: { diff: avg(pairs.map((x) => x.a - x.b)), lo: null, hi: null }, byAirport: {}, met: false, why: `${completeWeeks} complete 7-day block(s); 4 needed before the test runs` };
  const pooled = bootDiff(pairs, 1000, 7, week);
  const byAirport = {};
  for (const id of [...new Set(pairs.map((x) => x.icao))]) byAirport[id] = bootDiff(pairs.filter((x) => x.icao === id), 1000, 7, week);
  const met = Boolean(pooled && isNum(pooled.hi) && pooled.hi < 0 && Object.values(byAirport).every((b) => !(b && b.lo > 0)));
  return { n: items.length, rained: items.filter((x) => x.wet).length, weeks: weeks.size, completeWeeks, pooled, byAirport, met };
}
// Readings needed: the archive's own effect and spread (rain.json boot, "the app's %, calibrated"), scaled by √n to
// the sample at which its whole interval would sit below zero; in days at the archive's density per station-day.
function needed(lead) {
  const b = rain[lead].boot["the app's %, calibrated"], n = rain[lead].n;
  const se = (b.hi - b.lo) / (2 * 1.96), nNeed = Math.ceil(n * (se / (Math.abs(b.diff) / 1.96)) ** 2);
  const perStationDay = lead === 'today' ? 1 : n / (rain.today.n || n);
  return { archiveDiff: b.diff, archiveCi: [b.lo, b.hi], archiveN: n, nNeeded: nNeed, stationDaysNeeded: Math.ceil(nNeed / perStationDay), daysAtSixAirports: Math.ceil(nNeed / perStationDay / 6) };
}
const out = { readings: recs.length, today: judge(today, rain.today.curves.app), next3h: judge(next3h, rain.next3h.curves.app), needed: { today: needed('today'), next3h: needed('next3h') } };
out.met = out.today.met;
mkdirSync(RESULTS, { recursive: true });
writeFileSync(path.join(RESULTS, 'v4-rainpct.json'), JSON.stringify(out, (k, x) => (typeof x === 'number' ? round(x, 5) : x), 1));
const ci = (b) => (b && isNum(b.diff) ? `${b.diff.toFixed(4)} [${isNum(b.lo) ? b.lo.toFixed(4) : '—'}, ${isNum(b.hi) ? b.hi.toFixed(4) : '—'}]` : '—');
for (const [k, j] of [['rain today (primary)', out.today], ['next 3 hours', out.next3h]]) console.log(`${k.padEnd(21)} n ${j.n} (rained ${j.rained}), ${j.weeks} week(s), ${j.completeWeeks} complete · calibrated − served Brier ${ci(j.pooled)} · met: ${j.met}${j.why ? ` (${j.why})` : ''}`);
for (const [k, x] of Object.entries(out.needed)) console.log(`needed (${k}): archive ${x.archiveDiff} [${x.archiveCi.join(', ')}] on ${x.archiveN} → ~${x.nNeeded} scored (≈ ${x.stationDaysNeeded} airport-days, ≈ ${x.daysAtSixAirports} days at six airports)`);
console.log(`HONEST RAIN %: ${out.met ? 'rule met — switch on' : 'rule not met — keep recording'}`);
