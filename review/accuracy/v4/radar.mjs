// THE RADAR — every "Rain's here" that Tomorrow.io's radar made on its own, against the airport (review/accuracy/v4/
// PLAN.md §2, pre-registered c639248). Calls: recorder readings at the six airports whose conditionReason is
// tomorrow-io-radar-override. Primary truth: rain (RA/DZ/SH/TS with precipitation, not VC) in any airport report
// within 30 min of the forecast's own time; secondary: within 60 min, VCSH/VCTS counting. Decision on the primary,
// Wilson 95 %: upper < 50 % → mostly wrong, switch the radar-alone call off; lower ≥ 50 % → keep; else too few.
// Either decision also needs >= 10 distinct airport-day events (Fable: consecutive hours of one shower are not
// independent).
//   node review/accuracy/v4/radar.mjs [--dir <recorder data folder>]
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { RESULTS, isNum, round } from '../v2/lib.mjs';
import { wilson } from './lib4.mjs';

const args = process.argv.slice(2);
const DIR = args.includes('--dir') ? args[args.indexOf('--dir') + 1] : 'C:/Users/27741/OneDrive/Desktop/Probably weather new/probably-weather-new-c/review/accuracy/live';
const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)) : [];
const recs = files.flatMap((f) => readFileSync(path.join(DIR, f), 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } })).filter(Boolean);

// every airport report seen, de-duplicated
const reports = {};
for (const r of recs) for (const m of r.metar?.reports || []) {
  const t = isNum(m.obsTime) ? m.obsTime * 1000 : Date.parse(m.reportTime);
  if (isNum(t) && r.icao) (reports[r.icao] ??= new Map()).set(t, String(m.rawOb || ''));
}
const body = (raw) => raw.split(/\s(?:RMK|TEMPO|BECMG|NOSIG)\b/)[0].replace(/^(METAR|SPECI)\s+/, '');
const WET = /^[+-]?(SH|TS|FZ)?(DZ|RA|SN|SG|PL|GR|GS|UP)+$|^[+-]?TS(RA|DZ|SN|GR|GS|PL)+$/;
const wetAt = (raw, vicinity) => body(raw).split(/\s+/).some((t) => WET.test(t) || (vicinity && /^VC(SH|TS)$/.test(t)));
const within = (icao, tMs, mins, vicinity) => {
  const near = [...(reports[icao] || [])].filter(([t]) => Math.abs(t - tMs) <= mins * 60e3);
  return near.length ? near.some(([, raw]) => wetAt(raw, vicinity)) : null;
};

const calls = [], spotCalls = [];
for (const r of recs) {
  const p = r.api?.payload;
  if (!p?.now || p.now.conditionReason !== 'tomorrow-io-radar-override') continue;
  const ov = (p.now.conditionSignals?.overrides || []).find((o) => o.rule === 'tomorrow-io-radar-override');
  const written = Date.parse(p.meta?.updatedAtLabel || r.api.atUtc);
  const c = { at: new Date(written).toISOString().slice(0, 16), where: r.icao || r.spot, version: String(r.servedVersion || '').slice(0, 7), from: ov?.from ?? null, detail: ov?.reasonDetail ?? null };
  if (r.spot) { spotCalls.push(c); continue; }
  c.primary = within(r.icao, written, 30, false);
  c.secondary = within(r.icao, written, 60, true);
  calls.push(c);
}
const judged = calls.filter((c) => c.primary !== null);
const right = judged.filter((c) => c.primary).length;
const w = wilson(right, judged.length);
const events = new Set(judged.map((c) => `${c.where}|${new Date(Date.parse(c.at) + 2 * 3600e3).toISOString().slice(0, 10)}`));
const eventsRight = new Set(judged.filter((c) => c.primary).map((c) => `${c.where}|${new Date(Date.parse(c.at) + 2 * 3600e3).toISOString().slice(0, 10)}`));
const sec = calls.filter((c) => c.secondary !== null), secRight = sec.filter((c) => c.secondary).length;
let decision = 'too few to judge', needed = null;
const enoughEvents = events.size >= 10;
if (enoughEvents && isNum(w.hi) && w.hi < 0.5) decision = 'mostly wrong: switch the radar-alone call off';
else if (enoughEvents && isNum(w.lo) && w.lo >= 0.5) decision = 'mostly right: keep';
if (!enoughEvents) decision += ` (${events.size} of the 10 events needed)`;
if (decision.startsWith('too few') && judged.length && right / judged.length !== 0.5) {
  // calls at which the observed share, held, would decide
  const p = right / judged.length;
  for (let n = judged.length + 1; n <= 5000; n++) { const x = wilson(Math.round(p * n), n); if (x.hi < 0.5 || x.lo >= 0.5) { needed = n; break; } }
}
const out = { readings: recs.length, airportCalls: calls.length, judged: judged.length, right, share: w.p, wilson: [w.lo, w.hi], events: events.size, eventsRight: eventsRight.size,
  secondary: { judged: sec.length, right: secRight, share: sec.length ? secRight / sec.length : null }, decision, callsNeeded: needed, spotCalls, calls };
mkdirSync(RESULTS, { recursive: true });
writeFileSync(path.join(RESULTS, 'v4-radar.json'), JSON.stringify(out, (k, x) => (typeof x === 'number' ? round(x, 4) : x), 1));
console.log(`RADAR-ALONE "Rain's here" — ${recs.length} readings; ${calls.length} calls at the airports, ${judged.length} judgeable`);
for (const c of calls) console.log(`  ${c.at}Z ${c.where} ${c.version} from ${c.from} · ${c.detail} · rain ±30 min: ${c.primary} · ±60 min incl. VC: ${c.secondary}`);
console.log(`Right (±30 min): ${right}/${judged.length} = ${judged.length ? ((100 * right) / judged.length).toFixed(0) : '—'}% · Wilson 95 % [${isNum(w.lo) ? (100 * w.lo).toFixed(0) : '—'}, ${isNum(w.hi) ? (100 * w.hi).toFixed(0) : '—'}]%`);
console.log(`Distinct rain events (airport-days): ${events.size}, with rain at the airport ${eventsRight.size} · secondary (±60 min, VC): ${secRight}/${sec.length}`);
console.log(`Strand / Cape Town city radar calls (no station): ${spotCalls.length}`);
console.log(`DECISION: ${decision}${needed ? ` — about ${needed} judged calls would decide at this share` : ''}`);
