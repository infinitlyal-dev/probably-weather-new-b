// The recorder's rain check — the shadow mode the rain-% pre-registration names (PLAN.md): the rain % the app
// really served, and the same % through the calibration curves learned on 2025 (results/rain.json, "the app's
// %, calibrated"), each scored against the airport's reports. The curves are applied here, offline, to what was
// served — nothing a user sees changes. Small until rain falls at the six airports: every number carries its n.
// ("Rain's here" live is live-votes.mjs: the app's served rain calls against the report that hour.)
//   node review/accuracy/v2/live-rain.mjs [--dir <recorder data folder>]
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { RESULTS, isNum, mean, round, applyCurve } from './lib.mjs';

const args = process.argv.slice(2);
const DIR = args.includes('--dir') ? args[args.indexOf('--dir') + 1] : 'C:/Users/27741/OneDrive/Desktop/Probably weather new/probably-weather-new-c/review/accuracy/live';
const curves = JSON.parse(readFileSync(path.join(RESULTS, 'rain.json'), 'utf8'));
const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)) : [];
const recs = files.flatMap((f) => readFileSync(path.join(DIR, f), 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } })).filter((r) => r?.api?.payload?.hourly);

// the airports' reports, hour by hour (UTC), from every reading's recent METARs
const WET = /^[+-]?(MI|BC|PR|DR|BL|SH|TS|FZ)?(DZ|RA|SN|SG|PL|GR|GS|UP)+$/;
const reported = new Map();   // `${icao}|${utcHourIso}` → wet?
for (const r of recs) for (const rep of r.metar?.reports || []) {
  const t = Date.parse(rep.reportTime); if (!isNum(t)) continue;
  const toks = String(rep.rawOb || '').replace(/^(METAR|SPECI)\s+/, '').split(/\s+/);
  const key = `${r.icao}|${new Date(Math.floor(t / 3600e3) * 3600e3).toISOString().slice(0, 13)}`;
  reported.set(key, Boolean(reported.get(key)) || toks.some((x) => WET.test(x)));
}
const wetIn = (icao, fromMs, hours) => {   // null unless most hours were reported
  const seen = []; for (let k = 1; k <= hours; k++) { const key = `${icao}|${new Date(Math.floor(fromMs / 3600e3) * 3600e3 + k * 3600e3).toISOString().slice(0, 13)}`; if (reported.has(key)) seen.push(reported.get(key)); }
  return seen.length >= Math.ceil(hours * 0.75) ? seen.some(Boolean) : null;
};

const next3h = [], today = [];
const firstOfDay = new Map();
for (const r of recs) {
  const p = r.api.payload, at = Date.parse(r.api.atUtc || r.runAtUtc), h = p.meta?.localHour;
  if (!isNum(at) || !isNum(h)) continue;
  const served = Math.max(...[1, 2, 3].map((k) => p.hourly[h + k]?.rainChance).filter(isNum));
  const wet = wetIn(r.icao, at, 3);
  if (isFinite(served) && wet !== null) next3h.push({ icao: r.icao, served: served / 100, wet });
  const day = new Date(at + (p.meta.utcOffsetSeconds ?? 7200) * 1000).toISOString().slice(0, 10);
  const prev = firstOfDay.get(`${r.icao}|${day}`); if (!prev || at < prev.at) firstOfDay.set(`${r.icao}|${day}`, { at, r, day, h });
}
for (const { at, r, h } of firstOfDay.values()) {
  const served = r.api.payload.daily?.[0]?.rainChance; if (!isNum(served) || h > 6) continue;   // read by 06:59, as the backtest's day
  const wet = wetIn(r.icao, at - (h + 1) * 3600e3, 24); if (wet === null) continue;             // the whole local day
  today.push({ icao: r.icao, served: served / 100, wet });
}
const score = (rows, curve) => (rows.length ? { n: rows.length, rained: rows.filter((x) => x.wet).length,
  brierServed: mean(rows.map((x) => (x.served - (x.wet ? 1 : 0)) ** 2)), brierCalibrated: mean(rows.map((x) => (applyCurve(curve, x.served) - (x.wet ? 1 : 0)) ** 2)) } : { n: 0 });
const out = { readings: recs.length, next3h: score(next3h, curves.next3h.curves.app), today: score(today, curves.today.curves.app) };
mkdirSync(RESULTS, { recursive: true });
writeFileSync(path.join(RESULTS, 'live-rain.json'), JSON.stringify(out, (k, x) => (typeof x === 'number' ? round(x, 4) : x), 1));
for (const [k, s] of Object.entries({ 'next 3 hours': out.next3h, 'rain today': out.today })) {
  console.log(s.n ? `${k.padEnd(13)} n=${s.n} (rained ${s.rained}) · Brier served ${s.brierServed.toFixed(4)} · calibrated ${s.brierCalibrated.toFixed(4)}` : `${k.padEnd(13)} no scored readings yet`);
}
