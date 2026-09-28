// THE DAILY SCORECARD (review/accuracy/v6/PLAN.md §4 with Fable's §4a.9) — how right the app was yesterday, in
// everyday words, one line per spot, plus a running 7-day tally. Built ONLY from the live recorder's own files
// (review/accuracy/live/*.jsonl): no network call of any kind — no weather source, no place-name lookup, no METAR fetch.
//   node make-scorecard.mjs [--live <dir>] [--out <file>] [--day YYYY-MM-DD]
// Runs every morning at 06:20 SAST as the scheduled task "ProbablyWeather scorecard" (install-scorecard.ps1), from a
// copy in %USERPROFILE%\pw-scorecard\ so it runs whatever branch the repo is on. This file is the source of truth.
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const BASE = 'C:/Users/27741/OneDrive/Desktop/Probably weather new/probably-weather-new-c/review';
const LIVE = argOf('--live', `${BASE}/accuracy/live`);
const OUT = argOf('--out', `${BASE}/scorecard.html`);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const mean = (a) => { const v = a.filter(isNum); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
const r0 = (x) => (isNum(x) ? Math.round(x) : null);
const sast = (ms) => new Date(ms + 2 * 3600e3);
const dayOf = (ms) => sast(ms).toISOString().slice(0, 10);
const hourOf = (ms) => sast(ms).getUTCHours();
const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400e3).toISOString().slice(0, 10);
const todaySast = dayOf(Date.now());
const YESTERDAY = argOf('--day', addDays(todaySast, -1));

const SPOTS = [
  { key: 'Strand', label: 'Strand', station: 'the SA Weather Service station in Strand (68911)', kind: 'synop' },
  { key: 'Cape Town city', label: 'Cape Town city', station: 'Cape Town airport, 20 km east — there is no station in the city', kind: 'metar', icao: 'FACT' },
  { key: 'FACT', label: 'Cape Town airport', station: 'the airport', kind: 'metar', icao: 'FACT' },
  { key: 'FAOR', label: 'Johannesburg (OR Tambo)', station: 'the airport', kind: 'metar', icao: 'FAOR' },
  { key: 'FALE', label: 'Durban (King Shaka)', station: 'the airport', kind: 'metar', icao: 'FALE' },
  { key: 'FAPE', label: 'Gqeberha', station: 'the airport', kind: 'metar', icao: 'FAPE' },
  { key: 'FABL', label: 'Bloemfontein', station: 'the airport', kind: 'metar', icao: 'FABL' },
  { key: 'FAGG', label: 'George', station: 'the airport', kind: 'metar', icao: 'FAGG' },
];

// ---------- read the recorder ----------
const lines = [];
if (existsSync(LIVE)) for (const f of readdirSync(LIVE).filter((x) => /^(held-)?\d{4}-\d{2}-\d{2}\.jsonl$/.test(x)).sort())
  for (const l of readFileSync(path.join(LIVE, f), 'utf8').split('\n')) { if (!l.trim()) continue; try { lines.push(JSON.parse(l)); } catch { /* a half-written line */ } }
const readings = {};          // spot key → [{ at, p }]
const metars = {};            // icao → Map(obsTime → report)
const synops = new Map();     // utc ms → parsed 68911 report
for (const x of lines) {
  const key = x.icao || x.spot; const p = x.api?.payload;
  if (p && p.ok !== false && p.now) (readings[key] ||= []).push({ at: Date.parse(x.runAtUtc), p });
  if (x.icao) for (const m of x.metar?.reports || []) (metars[x.icao] ||= new Map()).set(m.obsTime, m);
  if (x.spot === 'Strand') for (const s of x.synop?.reports || []) { const r = parseSynop(s); if (r) synops.set(r.utc, r); }
}
for (const k of Object.keys(readings)) readings[k].sort((a, b) => a.at - b.at);

// SA Weather Service SYNOP (FM 12): wind (iw: 3/4 knots, 0/1 m/s), section 1 temperature and rain, section 3 day
// max / night min / 910ff gust / rain. iR (first figure of the 4th group): 1 or 2 = rain group included, 3 = none fell,
// 4 = not observed.
function parseSynop(line) {
  const c = line.trim().split(','); if (c[0] !== '68911' || c.length < 7) return null;
  const msg = c.slice(6).join(',').replace(/=\s*$/, '').trim(); if (/NIL/.test(msg)) return null;
  const g = msg.split(/\s+/); const iw = Number(g[1]?.slice(4, 5)); const unit = iw === 3 || iw === 4 ? 1.852 : iw === 0 || iw === 1 ? 3.6 : null;
  const utc = Date.UTC(+c[1], +c[2] - 1, +c[3], +c[4]);
  const i333 = g.indexOf('333'), i555 = g.indexOf('555');
  const sec1 = g.slice(5, i333 > 0 ? i333 : i555 > 0 ? i555 : undefined), sec3 = i333 > 0 ? g.slice(i333 + 1, i555 > i333 ? i555 : undefined) : [];
  const t = (grp) => (grp && /^[12][01]\d{3}$/.test(grp) ? (grp[1] === '1' ? -1 : 1) * Number(grp.slice(2)) / 10 : null);
  const rain = (grp) => { if (!grp || !/^6\d{3}[\d/]$/.test(grp)) return null; const R = Number(grp.slice(1, 4)); return R === 990 ? 0 : R > 990 ? (R - 990) / 10 : R; };
  const wind = g[4] && /^[\d/]\d{4}$/.test(g[4]) ? g[4] : null; const ff = wind ? Number(wind.slice(3, 5)) : null;
  const gg = sec3.find((x) => /^910\d\d$/.test(x));
  const iR = g[3]?.[0];
  const rr = [sec1.find((x) => x.startsWith('6')), sec3.find((x) => /^6\d{3}[\d/]$/.test(x))].map(rain).filter(isNum);
  return { utc, windKph: unit && isNum(ff) && ff !== 99 ? ff * unit : null, gustKph: unit && gg ? Number(gg.slice(3)) * unit : null,
    tempC: t(sec1.find((x) => x.startsWith('1'))), maxC: t(sec3.find((x) => x.startsWith('1'))), minC: t(sec3.find((x) => x.startsWith('2'))),
    rainMm: iR === '3' ? 0 : (iR === '1' || iR === '2') && rr.length ? Math.max(...rr) : null };
}

// ---------- one spot, one day ----------
const sayWord = (pct) => (!isNum(pct) ? null : pct < 10 ? 'none' : pct < 30 ? 'unlikely' : pct < 55 ? 'possible' : 'likely');   // the phone's ladder
const skyOfKey = (k) => (['clear', 'uv', 'cold-clear'].includes(k) ? 'clear' : k === 'partly-cloudy' ? 'partly' : ['cloudy', 'rain', 'rain-possible', 'storm', 'thunder', 'hail', 'fog'].includes(k) ? 'cloudy' : null);
const COVER = { SKC: 0, CLR: 0, NSC: 0, NCD: 0, CAVOK: 0, FEW: 1, SCT: 2, BKN: 3, OVC: 4, OVX: 4, VV: 4 };
function skyOfMetar(m) {
  const covers = [...(m.clouds || []).map((c) => COVER[c.cover]), COVER[m.cover]].filter(isNum);
  if (!covers.length) return null; const top = Math.max(...covers);   // the most-covered layer (Fable 9b)
  return top <= 1 ? 'clear' : top === 2 ? 'partly' : 'cloudy';
}
const wetMetar = (m) => /(^|\s)[-+]?(TS)?(SH)?(RA|DZ)/.test(m.wxString || '') && !/VC/.test(m.wxString || '');
const windRuleOf = (p) => p.meta?.wind?.rule ?? 'blend';

function score(spot, day) {
  const R = (readings[spot.key] || []).filter((r) => dayOf(r.at) === day);
  const out = { day, readings: R.length };
  if (!R.length) return out;
  const morning = R.find((r) => hourOf(r.at) >= 6) || R[0];
  const d0 = morning.p.daily?.[0] || {};
  out.appHigh = d0.highC; out.appLow = d0.lowC; out.appRainPct = d0.rainChance; out.morningHour = hourOf(morning.at);
  out.rules = [...new Set(R.map((r) => windRuleOf(r.p)))];
  const shown = (r) => { const w = r.p.now.windKph, gst = r.p.gustKph; return isNum(gst) && gst > w ? gst : w; };
  if (spot.kind === 'metar') {
    const M = [...(metars[spot.icao]?.values() || [])].filter((m) => dayOf(m.obsTime * 1000) === day).sort((a, b) => a.obsTime - b.obsTime);
    out.stationReports = M.length;
    const temps = M.map((m) => m.temp).filter(isNum);
    if (temps.length >= 12) { out.obsHigh = Math.max(...temps); out.obsLow = Math.min(...temps); }
    const pairs = R.map((r) => { const at = Date.parse(r.p.meta?.updatedAtLabel || '') || r.at; const m = M.map((mm) => ({ mm, d: Math.abs(mm.obsTime * 1000 - at) })).filter((y) => y.d <= 40 * 60e3).sort((a, b) => a.d - b.d)[0]?.mm; return m ? { r, m } : null; }).filter(Boolean);
    const wp = pairs.filter(({ m }) => isNum(m.wspd));
    if (wp.length) {
      out.appWind = mean(wp.map(({ r }) => r.p.now.windKph)); out.obsWind = mean(wp.map(({ m }) => m.wspd * 1.852));
      out.appStrong = Math.max(...wp.map(({ r }) => shown(r)).filter(isNum));
      const gusts = wp.map(({ m }) => m.wgst).filter(isNum);
      out.obsGust = gusts.length ? Math.max(...gusts) * 1.852 : null;
      out.obsStrongMean = Math.max(...wp.map(({ m }) => m.wspd * 1.852));
      out.appStrongMean = Math.max(...wp.map(({ r }) => r.p.now.windKph).filter(isNum));
    }
    const wet = M.filter(wetMetar).length;
    out.rained = M.length >= 12 ? wet >= 2 : null; out.wetReports = wet;
    const sky = pairs.filter(({ r }) => { const h = hourOf(r.at); return h >= 6 && h < 18; }).map(({ r, m }) => ({ a: skyOfKey(r.p.now.conditionKey), s: skyOfMetar(m) })).filter((x) => x.a && x.s);
    out.skyRight = sky.filter((x) => x.a === x.s).length; out.skyHours = sky.length;
  } else {
    const S = [...synops.values()].filter((s) => dayOf(s.utc) === day || (s.utc === Date.parse(`${day}T18:00:00Z`)));
    const s18 = synops.get(Date.parse(`${day}T18:00:00Z`)), s06 = synops.get(Date.parse(`${day}T06:00:00Z`));
    out.stationReports = S.length;
    out.obsHigh = s18?.maxC ?? null; out.obsLow = s06?.minC ?? null;
    const pairs = [0, 6, 12, 18].map((h) => synops.get(Date.parse(`${day}T${String(h).padStart(2, '0')}:00:00Z`))).filter(Boolean)
      .map((s) => { const r = (readings.Strand || []).find((x) => x.at - s.utc >= 0 && x.at - s.utc <= 70 * 60e3); return r && isNum(s.windKph) ? { r, s } : null; }).filter(Boolean);
    if (pairs.length) {
      out.appWind = mean(pairs.map(({ r }) => r.p.now.windKph)); out.obsWind = mean(pairs.map(({ s }) => s.windKph));
      out.appStrong = Math.max(...pairs.map(({ r }) => shown(r)).filter(isNum));
      const gusts = pairs.map(({ s }) => s.gustKph).filter(isNum);
      out.obsGust = gusts.length ? Math.max(...gusts) : null;
      out.obsStrongMean = Math.max(...pairs.map(({ s }) => s.windKph)); out.appStrongMean = Math.max(...pairs.map(({ r }) => r.p.now.windKph).filter(isNum));
      out.windPairs = pairs.length;
    }
    const rain = [0, 6, 12, 18].map((h) => synops.get(Date.parse(`${day}T${String(h).padStart(2, '0')}:00:00Z`))).filter(Boolean).map((s) => s.rainMm);
    out.rained = rain.some((x) => isNum(x) && x >= 0.5) ? true : rain.length >= 3 && rain.every((x) => x === 0) ? false : null;
  }
  const w = sayWord(out.appRainPct);
  out.rainWord = w;
  out.rainVerdict = out.rained === null || out.rained === undefined || !w ? null : w === 'possible' ? 'hedged' : (w === 'likely') === out.rained ? 'right' : 'wrong';
  return out;
}

// ---------- words ----------
const deg = (x) => `${r0(x)}°`;
function tempWords(app, obs) {
  if (!isNum(app) || !isNum(obs)) return null;
  const d = Math.round(app - obs);
  return `${deg(app)} (station ${deg(obs)}${d === 0 ? ', spot on' : d > 0 ? `, ${d}° too warm` : `, ${-d}° too cool`})`;
}
function windWords(s) {
  if (!isNum(s.appWind)) return '<span class="dim">no wind reading to compare</span>';
  const d = Math.round(s.appWind - s.obsWind);
  const avg = `average ${r0(s.appWind)} km/h (station ${r0(s.obsWind)}${Math.abs(d) <= 2 ? ', about right' : d > 0 ? `, ${d} too high` : `, ${-d} too low`})`;
  const strong = isNum(s.obsGust) ? `strongest gust: app ${r0(s.appStrong)}, station ${r0(s.obsGust)}` : `station gusts not reported · strongest average: app ${r0(s.appStrongMean)}, station ${r0(s.obsStrongMean)}`;
  return `${avg}; ${strong}`;
}
function rainWords(s) {
  const said = s.rainWord ? `said rain was <b>${s.rainWord}</b> (${r0(s.appRainPct)}%)` : 'no rain chance on record';
  const was = s.rained === true ? 'it rained' : s.rained === false ? 'it stayed dry' : 'rain not reported';
  const mark = s.rainVerdict === 'right' ? ' — <span class="ok">right</span>' : s.rainVerdict === 'wrong' ? ' — <span class="bad">wrong</span>' : s.rainVerdict === 'hedged' ? ' — hedged' : '';
  return `${said}, ${was}${mark}`;
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const RULE_WORDS = { blend: 'the plain blend', today: 'the plain blend', BC: 'the region table', LW: "the region's own source weights", AW: 'archive weights' };

function spotLine(spot) {
  const s = score(spot, YESTERDAY);
  const head = `<h2>${esc(spot.label)}</h2><p class="vs">measured by ${esc(spot.station)}</p>`;
  if (!s.readings) return `<section>${head}<p class="dim">No readings yesterday — the PC was asleep or offline.</p>${tally(spot)}</section>`;
  // one line per spot (Al's brief): high, low, wind, rain, sky
  const parts = [];
  const hi = tempWords(s.appHigh, s.obsHigh), lo = tempWords(s.appLow, s.obsLow);
  const noStation = spot.kind === 'synop' && !s.stationReports;
  parts.push(`<b>High</b> ${hi ?? `${isNum(s.appHigh) ? deg(s.appHigh) : '—'} <span class="dim">(station: not reported)</span>`}`);
  parts.push(`<b>Low</b> ${lo ?? `${isNum(s.appLow) ? deg(s.appLow) : '—'} <span class="dim">(station: not reported)</span>`}`);
  parts.push(`<b>Wind</b> ${windWords(s)}`);
  parts.push(`<b>Rain</b> ${rainWords(s)}`);
  parts.push(`<b>Sky</b> ${spot.kind === 'synop' ? '<span class="dim">the Strand station does not measure cloud</span>' : s.skyHours ? `right in ${s.skyRight} of ${s.skyHours} daytime hours` : '<span class="dim">nothing to compare (the app led with wind or temperature)</span>'}`);
  const foot = `<p class="foot">${noStation ? 'No station reports on record for this day (the recorder has read the Strand station since 28 Sept 2026). ' : ''}App as read at ${String(s.morningHour).padStart(2, '0')}:10 · ${s.readings} hourly readings · ${s.stationReports} station reports · wind by ${s.rules.map((r) => RULE_WORDS[r] ?? r).join(' → ')}</p>`;
  return `<section>${head}<p class="line">${parts.join(' <span class="sep">·</span> ')}</p>${foot}${tally(spot)}</section>`;
}

function tally(spot) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(YESTERDAY, -i)).reverse().map((d) => score(spot, d)).filter((s) => s.readings);
  if (!days.length) return '';
  const count = (f) => { const v = days.map(f).filter((x) => x !== null && x !== undefined); return { yes: v.filter(Boolean).length, of: v.length }; };
  const hi = count((s) => (isNum(s.appHigh) && isNum(s.obsHigh) ? Math.abs(s.appHigh - s.obsHigh) <= 2 : null));
  const lo = count((s) => (isNum(s.appLow) && isNum(s.obsLow) ? Math.abs(s.appLow - s.obsLow) <= 2 : null));
  const wind = count((s) => (isNum(s.appWind) && isNum(s.obsWind) ? Math.abs(s.appWind - s.obsWind) <= 5 : null));
  const rr = days.map((s) => s.rainVerdict).filter(Boolean);
  const sky = days.reduce((a, s) => ({ r: a.r + (s.skyRight || 0), n: a.n + (s.skyHours || 0) }), { r: 0, n: 0 });
  const rules = [...new Set(days.flatMap((s) => s.rules))];
  const bits = [];
  if (hi.of) bits.push(`highs within 2° on <b>${hi.yes} of ${hi.of}</b> days`);
  if (lo.of) bits.push(`lows within 2° on <b>${lo.yes} of ${lo.of}</b>`);
  if (wind.of) bits.push(`average wind within 5 km/h on <b>${wind.yes} of ${wind.of}</b>`);
  if (rr.length) bits.push(`rain right on <b>${rr.filter((x) => x === 'right').length}</b>, wrong on <b>${rr.filter((x) => x === 'wrong').length}</b>${rr.includes('hedged') ? `, hedged on ${rr.filter((x) => x === 'hedged').length}` : ''}`);
  if (sky.n) bits.push(`sky right in <b>${sky.r} of ${sky.n}</b> daytime hours`);
  const span = `last ${days.length === 1 ? 'day' : `${days.length} days`} with readings`;
  return `<p class="tally"><span class="lbl">${span}:</span> ${bits.join(' · ') || 'nothing to compare yet'}${rules.length > 1 ? ` <span class="dim">(the wind rule changed in this stretch: ${rules.map((r) => RULE_WORDS[r] ?? r).join(' → ')})</span>` : ''}</p>`;
}

const when = sast(Date.now()).toISOString().slice(0, 16).replace('T', ' ');
const longDay = new Date(`${YESTERDAY}T12:00:00Z`).toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Weather scorecard</title>
<style>
:root{--bg:#f7f5f0;--card:#fff;--ink:#1d1d1b;--dim:#6b6b66;--line:#e4e0d6;--ok:#1f7a3a;--bad:#b3261e;--accent:#b8860b}
@media (prefers-color-scheme:dark){:root{--bg:#121211;--card:#1c1c1a;--ink:#ecebe6;--dim:#9c9b94;--line:#2e2d2a;--ok:#6fcf8a;--bad:#ff8a80;--accent:#e0b44c}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:760px;margin:0 auto;padding:24px 16px 48px}
h1{font-size:1.6rem;margin:0 0 4px}h1 span{color:var(--accent)}.sub{color:var(--dim);margin:0 0 20px}
section{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin:0 0 12px}
h2{font-size:1.1rem;margin:0}.vs{color:var(--dim);font-size:.85rem;margin:0 0 8px}
.line{margin:0}.sep{color:var(--dim)}
.ok{color:var(--ok);font-weight:600}.bad{color:var(--bad);font-weight:600}.dim{color:var(--dim)}
.foot{color:var(--dim);font-size:.78rem;margin:8px 0 0}.tally{margin:8px 0 0;padding:8px 10px;border-radius:8px;background:color-mix(in srgb,var(--accent) 10%,transparent);font-size:.92rem}
.lbl{color:var(--dim)}.notes{color:var(--dim);font-size:.82rem;margin-top:20px}
</style></head><body><main>
<h1>How right was the app <span>yesterday</span>?</h1>
<p class="sub">${esc(longDay)} · built ${when} SAST from the recorder's hourly readings — no weather or place-name look-ups.</p>
${SPOTS.map(spotLine).join('\n')}
<p class="notes">How to read it: the app's high, low and rain word are what it said at the first reading after 06:00 that morning; wind is the app's number beside the station's at the same hours. Airport highs and lows come from hourly reports in whole degrees, so the true high is often ½–1° higher. "Rained" at an airport means rain in at least two reports that day — one passing shower is not counted as a miss. A "possible" rain call is counted as hedged, neither right nor wrong. Airports only send a gust when it is 18 km/h or more above the average wind; with none sent, the strongest averages are compared instead.</p>
</main></body></html>
`;
writeFileSync(OUT, html);
console.log(`scorecard for ${YESTERDAY} → ${OUT}`);
