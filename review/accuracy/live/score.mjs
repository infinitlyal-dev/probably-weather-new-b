// LIVE SCORE — what production served at the six airports vs what the airports reported,
// from the hourly recorder's JSONL (record.mjs). Real sources, no stand-ins.
//
//   node review/accuracy/live/score.mjs [--dir <data folder>]
//
// Default data folder: the OneDrive working copy's review/accuracy/live/ (where the scheduled task
// writes), plus any held-<date>.jsonl the recorder parked in %USERPROFILE%\pw-accuracy-recorder\
// while OneDrive held the day file. Every record is aligned on meta.updatedAtLabel — the moment the
// forecast was computed — never on meta.localHour (a replayed cache entry refreshes localHour but
// keeps the numbers of the moment it was made).
// Writes results/live-score.md and .json (in review/accuracy/results/).
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const DIR = path.resolve(args.includes('--dir') ? args[args.indexOf('--dir') + 1] : 'C:\\Users\\27741\\OneDrive\\Desktop\\Probably weather new\\probably-weather-new-c\\review\\accuracy\\live');
const HELD = path.join(os.homedir(), 'pw-accuracy-recorder');
const OUT = path.resolve(HERE, '..', 'results');
const CITIES = { FACT: [-33.9648, 18.6017], FAOR: [-26.1392, 28.2460], FALE: [-29.6144, 31.1197], FAPE: [-33.9849, 25.6173], FABL: [-29.0927, 26.3024], FAGG: [-34.0056, 22.3789] };
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);

// ---- load (data folder + held files), drop records whose coordinates are not the harness's ----
const files = [
  ...(existsSync(DIR) ? readdirSync(DIR).filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f)).map((f) => path.join(DIR, f)) : []),
  ...(existsSync(HELD) ? readdirSync(HELD).filter((f) => /^held-.*\.jsonl$/.test(f)).map((f) => path.join(HELD, f)) : []),
];
const recs = [];
for (const f of files) for (const line of readFileSync(f, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  let r; try { r = JSON.parse(line); } catch { continue; }
  const c = CITIES[r.icao];
  if (!c || c[0] !== r.lat || c[1] !== r.lon) continue;
  recs.push(r);
}
// Every METAR report seen, per station, de-duplicated (each run carries the last 3 h).
const metars = {};
for (const r of recs) for (const m of r.metar?.reports || []) {
  const t = isNum(m.obsTime) ? m.obsTime * 1000 : Date.parse(m.reportTime);
  if (!isNum(t)) continue;
  (metars[r.icao] ??= new Map()).set(t, m);
}

// ---- METAR → observed category ----
// Present-weather groups read off the raw report (the JSON's wxString is often absent) —
// the same token grammar as live-sample.mjs.
const WX_TOKEN = /^(\+|-|VC|RE)?(MI|BC|PR|DR|BL|SH|TS|FZ)?(DZ|RA|SN|SG|IC|PL|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|PY|PO|SQ|FC|SS|DS)*$/;
function observed(m) {
  const raw = String(m.rawOb || '');
  const body = raw.split(/\s(?:RMK|TEMPO|BECMG|NOSIG)\b/)[0];
  const fromText = body.trim().split(/\s+/).slice(2).filter((t) => t.length >= 2 && t !== 'AUTO' && t !== 'COR' && !/^\d/.test(t) && WX_TOKEN.test(t)).join(' ');
  const wx = String(m.wxString || fromText);
  if (/\/\/(\s|$)/.test(body) && !wx) return 'unobserved';
  if (/TS/.test(wx)) return 'storm';
  if (/(^|\s)[-+]?(SH|FZ)?(RA|DZ|SN|GR|GS|PL)/.test(wx) && !/(^|\s)VC/.test(wx)) return 'rain';
  if (/FG/.test(wx) && !/(BC|MI|PR)FG/.test(wx)) return 'fog';
  if (/BR|HZ/.test(wx)) return 'mist';
  // Cloud by the app's own buckets (Fable, review 3): CAVOK / SKC / NSC / NCD / CLR / FEW → clear,
  // SCT → either, BKN / OVC / VV → cloudy. CAVOK only says "no cloud below 5,000 ft".
  const layers = [...body.matchAll(/\b(FEW|SCT|BKN|OVC|VV)(\d{3})/g)].map((x) => x[1]);
  if (layers.some((l) => l === 'BKN' || l === 'OVC' || l === 'VV')) return 'cloudy';
  if (layers.includes('SCT')) return 'scattered';
  return 'clear';
}
const SERVED = (k) => (['rain', 'storm', 'thunder', 'hail'].includes(k) ? 'wet' : k === 'rain-possible' ? 'maybe' : k === 'fog' ? 'fog'
  : k === 'cloudy' ? 'cloudy' : k === 'wind' ? 'wind' : 'clear');   // clear, partly-cloudy, cold-clear, uv, heat, cold
const agrees = (served, obs) => {
  if (obs === 'unobserved') return null;
  if (served === 'wet') return obs === 'rain' || obs === 'storm';
  if (served === 'maybe') return obs === 'rain' || obs === 'storm' || obs === 'cloudy';
  if (served === 'fog') return obs === 'fog' || obs === 'mist';
  if (served === 'cloudy') return obs === 'cloudy' || obs === 'scattered' || obs === 'mist';   // fog (FG, < 1 km) needs fog
  if (served === 'clear') return obs === 'clear' || obs === 'scattered';
  return null;   // wind: scored against the wind rule elsewhere, not here
};
const nearest = (icao, tMs, within = 45 * 60e3) => {
  let best = null;
  for (const [t, m] of metars[icao] || []) if (Math.abs(t - tMs) <= within && (!best || Math.abs(t - tMs) < Math.abs(best[0] - tMs))) best = [t, m];
  return best ? best[1] : null;
};

// ---- per record ----
const rows = [];
let skipped = 0;
for (const r of recs) {
  const p = r.api?.payload;
  if (!p?.now || r.api?.status !== 200 || r.api?.error) { skipped++; continue; }   // failed reads: counted, never fatal
  const written = Date.parse(p.meta?.updatedAtLabel || r.api.atUtc);
  const m = nearest(r.icao, written);
  const obs = m ? observed(m) : 'none';
  const served = SERVED(p.now.conditionKey);
  // Rain in the hour after the forecast was made (any report).
  const after = [...(metars[r.icao] || [])].filter(([t]) => t > written && t <= written + 3600e3).map(([, mm]) => observed(mm));
  rows.push({ icao: r.icao, written: new Date(written).toISOString(), key: p.now.conditionKey, reason: p.now.conditionReason, served, obs, agree: m ? agrees(served, obs) : null,
    rainChance: p.now.rainChance, rainedNextHour: after.length ? after.some((o) => o === 'rain' || o === 'storm') : null,
    radarBump: p.now.conditionSignals?.radarNextHourBump ?? null, radarOverride: p.now.conditionReason === 'tomorrow-io-radar-override',
    sourceToday: p.meta?.sourceToday ?? null, high: p.daily?.[0]?.highC, low: p.daily?.[0]?.lowC, sastDay: new Date(written + 2 * 3600e3).toISOString().slice(0, 10) });
}

// ---- summaries ----
const scored = rows.filter((x) => x.agree !== null);
const byCity = {};
for (const x of scored) { const c = (byCity[x.icao] ??= { n: 0, ok: 0 }); c.n++; if (x.agree) c.ok++; }
const falseRain = rows.filter((x) => x.served === 'wet' && x.obs !== 'none' && x.obs !== 'unobserved');
const bins = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 101];
const calib = bins.slice(0, -1).map((lo, i) => { const hs = rows.filter((x) => isNum(x.rainChance) && x.rainedNextHour !== null && x.rainChance >= lo && x.rainChance < bins[i + 1]); return { bin: `${lo}–${bins[i + 1] - 1}`, n: hs.length, rained: hs.filter((x) => x.rainedNextHour).length }; }).filter((b) => b.n);
const out = { generatedAt: new Date().toISOString(), files: files.map((f) => path.basename(f)), records: recs.length, failedReads: skipped, scoredNow: scored.length,
  agreeNow: { n: scored.length, ok: scored.filter((x) => x.agree).length }, byCity, falseRain: { served: falseRain.length, dry: falseRain.filter((x) => x.obs !== 'rain' && x.obs !== 'storm').length },
  radar: { overrides: rows.filter((x) => x.radarOverride).length, nextHourBumps: rows.filter((x) => x.radarBump).length }, calibration: calib,
  mismatches: scored.filter((x) => !x.agree).map((x) => `${x.written.slice(0, 16)} ${x.icao} served ${x.key} (${x.reason}) · airport ${x.obs}`) };
mkdirSync(OUT, { recursive: true });
writeFileSync(path.join(OUT, 'live-score.json'), JSON.stringify(out, null, 1));
const md = [`# Live score — production vs the airports (${out.generatedAt.slice(0, 16)}Z)`, '',
  `${recs.length} records from ${files.length} file(s), ${skipped} failed reads skipped; ${scored.length} airport-hours with a usable report within 45 min of the forecast's own time (cloud by the app's buckets: CAVOK/FEW clear, SCT either, BKN/OVC cloudy; Bloemfontein's overnight AUTO reports observe nothing and are not scored).`, '',
  `- **Now condition agrees with the airport:** ${out.agreeNow.ok} of ${out.agreeNow.n} (${pct(out.agreeNow.ok, out.agreeNow.n) ?? '—'}%) — by airport: ${Object.entries(byCity).map(([k, v]) => `${k} ${v.ok}/${v.n}`).join(', ') || '—'}`,
  `- **"Rain" shown:** ${out.falseRain.served} times, dry at the airport ${out.falseRain.dry}. Tomorrow.io radar override: ${out.radar.overrides}; next-hour bump: ${out.radar.nextHourBumps}.`,
  `- **Rain chance vs rain in the next hour:** ${calib.map((b) => `${b.bin}%: ${b.rained}/${b.n}`).join(' · ') || '—'}`, '',
  'Mismatches:', '', ...(out.mismatches.length ? out.mismatches.map((x) => `- ${x}`) : ['- none'])];
writeFileSync(path.join(OUT, 'live-score.md'), md.join('\n') + '\n');
console.log(md.join('\n'));
