// Al's page for the precision run, generated from the results files so every number on it is the scored
// one; the words come from page-content.json, written after the numbers were in.
//   node review/accuracy/v2/make-page.mjs [--out <path>]
// House pattern: works from file://, remembers marks in the browser (localStorage), exports
// precision-ruled.json. Written to the OneDrive copy's review/ by default.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRECISION_TABLE } from '../../../api/_lib/precision-table.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const R = (f) => { const p = path.join(here, 'results', f); return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null; };
const args = process.argv.slice(2);
const OUT = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'C:/Users/27741/OneDrive/Desktop/Probably weather new/probably-weather-new-c/review/precision-for-al.html';
const RES = { t1: R('temps-t1.json'), t0: R('temps-t0.json'), rain: R('rain.json'), wind: R('wind.json'), rainhere: R('rainhere.json'),
  synop1: R('synop-t1.json'), synop0: R('synop-t0.json'), votes: R('live-votes.json') };
const CONTENT = JSON.parse(readFileSync(path.join(here, 'page-content.json'), 'utf8'));

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const f1 = (x) => (isNum(x) ? x.toFixed(1) : '—');
const signed = (x) => (isNum(x) ? `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toFixed(1)}` : '—');
const in10 = (a, b) => (b ? `${Math.round((a / b) * 10)} in 10` : '—');
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)} %` : '—');
const table = (head, rows) => `<div class="scroll"><table class="simple"><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c, i) => `<td${i && /^[−+\d]/.test(String(c).replace(/<[^>]+>/g, '')) ? ' class="num"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</table></div>`;
const missing = (what) => `<p class="muted">(${esc(what)}: not run)</p>`;

// ---- high and low, region by region: the app now (range over the three source assignments) vs after ----
const MODEL_NAMES = { best_match: 'Open-Meteo (ECMWF 9 km) — the app\'s Open-Meteo source', ecmwf_ifs025: 'ECMWF 25 km', gfs_seamless: 'GFS (US)', icon_seamless: 'ICON (Germany)', ukmo_seamless: 'UK Met Office', meteofrance_seamless: 'Météo-France' };
const shortName = (m) => MODEL_NAMES[m].split(' — ')[0];
// "The app now" and "after" are ranges over the three source assignments (temps-replay.mjs); "after" is what
// production does (temps.mjs "as shipped": the mix, the blocked Lowveld left as today).
const V = ['old harness', 'ECMWF-heavy', 'mixed'];
const range = (m, prefix, key) => { const x = V.map((v) => m[`${prefix} (${v})`]?.[key]).filter(isNum); return [Math.min(...x), Math.max(...x)]; };
const deg = ([lo, hi]) => { const a = f1(lo), b = f1(hi); return `${a}${a !== b ? `–${b}` : ''} °C`; };
const in10r = ([lo, hi]) => { const a = Math.round(lo * 10), b = Math.round(hi * 10); return a === b ? `${a} in 10` : `${a}–${b} in 10`; };
function regionTable(res, title) {
  const rows = [];
  const one = (label, m) => {
    const models = Object.keys(MODEL_NAMES).map((k) => [k, m[`model: ${k}`]?.mae]).filter(([, x]) => isNum(x)).sort((a, b) => a[1] - b[1]);
    const blocked = PRECISION_TABLE.blocked.includes(label);
    rows.push([esc(label), deg(range(m, 'app now', 'mae')), `<b>${deg(range(m, 'as shipped', 'mae'))}</b>${blocked ? '<br><span class="muted">left as today</span>' : ''}`,
      `${in10r(range(m, 'app now', 'within2'))} → <b>${in10r(range(m, 'as shipped', 'within2'))}</b>`, `${f1(m['model: best_match']?.mae)} °C`,
      `${esc(shortName(models[0][0]))} ${f1(models[0][1])} °C`, `${esc(shortName(models.at(-1)[0]))} ${f1(models.at(-1)[1])} °C`]);
  };
  one(`All ${res.stations.length} airports`, res.pooled);
  for (const g of Object.keys(res.byRegion)) one(g, res.byRegion[g]);
  return `<h3>${esc(title)}</h3>` + table(['Where', 'The app now<br><span class="muted">off by, on average</span>', 'After<br><span class="muted">off by</span>', 'Right to within 2 °C', 'Open-Meteo alone<br><span class="muted">a one-source app</span>', 'Best single model', 'Worst single model'], rows);
}

// ---- frost nights ----
function frost() {
  const a = RES.t1?.frost, b = RES.t0?.frost; if (!a || !b) return missing('frost');
  const row = (label, prefix) => {
    const get = (f, key) => (prefix.startsWith('model:') || prefix.startsWith('consensus') ? [f.methods[prefix][key], f.methods[prefix][key]] : range(f.methods, prefix, key));
    const cell = (f) => { const bias = get(f, 'bias'), called = get(f, 'called'); return [`${signed(bias[0])}${signed(bias[0]) !== signed(bias[1]) ? ` to ${signed(bias[1])}` : ''} °C`, `${called[0]}${called[1] !== called[0] ? `–${called[1]}` : ''} of ${f.nights}`]; };
    return [esc(label), ...cell(a), ...cell(b)];
  };
  const sts = Object.entries(a.byStation).map(([id, n]) => `${id} ${n}`).join(', ');
  return `<p class="muted">${a.nights} nights with a low of 2 °C or less (${esc(sts)}). "Too warm by" = the forecast low minus the airport's; "frost forecast" = the forecast low was 2 °C or less.</p>` +
    table(['', 'The day before<br><span class="muted">too warm by</span>', 'frost forecast', 'The same morning<br><span class="muted">too warm by</span>', 'frost forecast'],
      [row('Open-Meteo alone', 'model: best_match'), row('The app now', 'app now'), row('After (as shipped)', 'as shipped'), row('The corrected five models alone', 'consensus, SA table (without this station)'), row('An airport\'s own correction (only at that airport)', 'consensus, own station table (upper bound)')]);
}

// ---- rain: how honest the % is ----
const RAIN_SHOWN = [["the app's % (proxy)", 'The app now (replayed)'], ["Open-Meteo's own %", 'Open-Meteo alone'], ["Open-Meteo's %, calibrated", 'Open-Meteo, calibrated'], ['both, calibrated', 'Calibrated blend']];
function rainBlock(block, unit) {
  if (!block) return missing('rain');
  const bands = [...new Set(Object.values(block.methods).flatMap((m) => m.reliability.map((b) => b.bin)))].sort((x, y) => parseInt(x) - parseInt(y));
  const rel = table(['When it said', ...RAIN_SHOWN.map(([, l]) => `${esc(l)}<br><span class="muted">it rained</span>`)], bands.map((bin) => [bin.replace('-', '–'),
    ...RAIN_SHOWN.map(([k]) => { const b = block.methods[k].reliability.find((x) => x.bin === bin); return b ? `${Math.round(b.happened * 10)} in 10 <span class="muted">(${b.n})</span>` : '—'; })]));
  const regions = Object.keys(block.methods["the app's % (proxy)"].byRegion);
  const reg = table(['Where', `The app now<br><span class="muted">said rain (≥ 50 %) → it rained</span>`, 'rain '+unit+' it warned (≥ 50 %)', 'Calibrated blend<br><span class="muted">said rain → it rained</span>', `rain ${unit} it warned`],
    regions.map((g) => { const a = block.methods["the app's % (proxy)"].byRegion[g], c = block.methods['both, calibrated'].byRegion[g];
      return [esc(g), `${a.said50Rained} of ${a.said50}`, `${a.warned50} of ${a.rainDays}`, `${c.said50Rained} of ${c.said50}`, `${c.warned50} of ${c.rainDays}`]; }));
  const brier = table(['', 'Score (lower = better)', 'vs the app now', 'vs Open-Meteo alone'], RAIN_SHOWN.map(([k, l]) => {
    const b = block.boot?.[k], o = block.bootVsOm?.[k];
    const ci = (x) => (x ? `${x.diff > 0 ? '+' : ''}${x.diff.toFixed(3)} [${x.lo.toFixed(3)}, ${x.hi.toFixed(3)}]` : '—');
    return [esc(l), block.methods[k].brier.toFixed(3), ci(b), ci(o)]; }));
  return `<p class="muted">${block.n} ${unit} at ${esc(RES.rain.stations.length)} airports that report rain; it rained on ${Math.round(block.base * 100)} %.</p>` + rel +
    `<h3>Per region</h3>` + reg + `<h3>The score behind it (Brier, 2026; interval = 95 % range)</h3>` + brier;
}

// ---- "Rain's here" ----
function rainhere() {
  const r = RES.rainhere; if (!r) return missing("Rain's here");
  const rows = Object.entries({ ...r.byRegion, 'All': r.all }).map(([g, t]) => [esc(g), String(t.calls), `${t.dryHour} (${pct(t.dryHour, t.calls)})`, `${t.dryNear} (${pct(t.dryNear, t.calls)})`, `${t.caught} of ${t.rainHours} (${pct(t.caught, t.rainHours)})`]);
  return table(['Where', 'Times it said "Rain\'s here"', 'dry that hour', 'dry within an hour either side', 'rain hours it caught'], rows);
}

// ---- wind, gusts, fog ----
// a method's label for Al: a bare model id becomes its name; Open-Meteo's own blend is called Open-Meteo
const nice = (n) => { const m = n.replace(/^model: /, ''); return esc(MODEL_NAMES[m] ? shortName(m) : m.replace(/best_match/g, 'Open-Meteo')); };
function wind() {
  const w = RES.wind; if (!w) return missing('wind');
  const rows = Object.entries(w.wind).map(([n, s]) => [nice(n), `${f1(s.mae)} km/h`, `${signed(s.bias)} km/h`, `${s.windyCaught} of ${s.windyHours}`, String(s.falseWind)]);
  return table(['Forecast', 'Off by, on average', 'Leans', 'Windy hours caught<br><span class="muted">(airport ≥ 30 km/h, forecast ≥ 25)</span>', 'False windy hours'], rows);
}
function gust() {
  const w = RES.wind; if (!w) return missing('gusts');
  const rows = Object.entries(w.gust).map(([n, s]) => [nice(n), `${f1(s.mae)} km/h`, `${signed(s.bias)} km/h`, `${s.bigCaught} of ${s.bigGusts}`, String(s.falseBig)]);
  return table(['Forecast', 'Off by, on average', 'Leans', 'Gusts ≥ 55 km/h caught', 'False big gusts'], rows);
}
function fog() {
  const w = RES.wind; if (!w) return missing('fog');
  const rows = Object.entries(w.fog).map(([n, s]) => [nice(n), `${s.hits} of ${s.fogHours}`, String(s.falseAlarms), `${s.hits + s.falseAlarms ? Math.round((s.hits / (s.hits + s.falseAlarms)) * 10) : 0} in 10`]);
  const st = ['FACT', 'FAGG', 'FAPE', 'FALE'].filter((id) => w.fogByStation[id]).map((id) => { const d = w.fogByStation[id]["the app's fog detector (replayed)"]; return `${id}: ${d.hits} of ${d.fogHours} caught, ${d.falseAlarms} false`; }).join(' · ');
  return table(['Fog call', 'Fog hours caught', 'False fog hours', 'When it said fog, it was fog'], rows) + `<p class="muted">The app's detector by airport: ${esc(st)}.</p>`;
}

// ---- the Karoo and KZN inland (synoptic reports) ----
function synop() {
  const s = RES.synop1; if (!s) return missing('Karoo / KZN inland');
  const out = [];
  for (const [label, res] of [['The day before', RES.synop1], ['The same morning', RES.synop0]]) {
    if (!res) continue;
    const rows = Object.entries(res.byRegion).map(([g, m]) => {
      const models = Object.keys(MODEL_NAMES).map((k) => [k, m[`model: ${k}`]?.mae]).filter(([, x]) => isNum(x)).sort((a, b) => a[1] - b[1]);
      const b = V.map((v) => res.boot[g][v]).filter(Boolean);
      return [esc(g), deg(range(m, 'app now', 'mae')), `<b>${deg([Math.min(...V.map((v) => m[`mix α=0.5 (${v})`]?.mae)), Math.max(...V.map((v) => m[`mix α=0.5 (${v})`]?.mae))])}</b>`,
        b.every((x) => x.hi < 0) ? 'better, all three' : b.some((x) => x.lo > 0) ? 'worse' : 'within noise', `${esc(shortName(models[0][0]))} ${f1(models[0][1])} °C`];
    });
    out.push(`<h3>${label}</h3>` + table(['Where', 'The app now', 'After', 'Clear?', 'Best single model'], rows));
  }
  return out.join('') + `<p class="muted">Towns: ${esc(s.stations.join(', '))}.</p>`;
}

// ---- the live sources (the recorder) ----
function votes() {
  const v = RES.votes; if (!v) return missing('live votes');
  const rows = Object.entries(v.sources).map(([n, t]) => [esc(n), `${t.rainVotes} <span class="muted">(${t.rainVotesDry} dry)</span>`, `${t.fogVotes} <span class="muted">(${t.fogVotesNoFog} without fog)</span>`]);
  return `<p class="muted">${v.readings} hourly readings at six airports, ${esc(String(v.from).slice(0, 16).replace('T', ' '))} → ${esc(String(v.to).slice(0, 16).replace('T', ' '))} UTC.</p>` +
    table(['Source', 'Said rain', 'Said fog'], rows);
}

const GEN = { temps: () => (RES.t1 ? regionTable(RES.t1, 'Tomorrow, as seen the day before (the harder test)') : missing('temps')) + (RES.t0 ? regionTable(RES.t0, 'Today, as seen the same morning') : ''),
  frost, rainToday: () => rainBlock(RES.rain?.today, 'days'), rain3h: () => rainBlock(RES.rain?.next3h, '3-hour windows'), rainhere, wind, gust, fog, synop, votes };

const css = readFileSync(path.join(here, 'page.css'), 'utf8');
const js = readFileSync(path.join(here, 'page.js'), 'utf8');
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Forecast precision — for Al</title>
<style>${css}</style>
</head>
<body>
<main>
<h1>${esc(CONTENT.title)}</h1>
<p class="lede">${CONTENT.lede}</p>
${CONTENT.top}
${CONTENT.blocks.map((b) => `<h2>${b.h2}</h2>${b.lede ? `<p class="lede">${b.lede}</p>` : ''}${b.gen ? GEN[b.gen]() : ''}${b.after || ''}`).join('\n')}
${(CONTENT.questions || []).length ? '<h2>Questions</h2><div id="questions"></div>' : ''}
<textarea id="out" readonly></textarea>
</main>
<div class="bar"><span id="count" class="muted"></span><button id="export">Export precision-ruled.json</button><button id="copy" class="ghost">Copy JSON</button></div>
<div class="zoom" id="zoom"><img alt=""></div>
<script>
var QUESTIONS = ${JSON.stringify(CONTENT.questions || [])};
${js}
</script>
</body>
</html>
`;
writeFileSync(OUT, html);
console.log(`wrote ${OUT} (${Math.round(html.length / 1024)} KB)`);
