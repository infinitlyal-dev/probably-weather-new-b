// Al's page for the rain / fog / frost run: review/rain-fog-frost-for-al.html in the OneDrive working copy, house
// pattern (works from file://, marks kept in the browser, exports rain-fog-frost-ruled.json). Every number comes
// from results/v3-*.json; the words were written after the numbers were in.
//   node review/accuracy/v3/make-page3.mjs [--out <path>]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const RES = path.join(here, '../v2/results');
const R = (f) => JSON.parse(readFileSync(path.join(RES, f), 'utf8'));
const args = process.argv.slice(2);
const OUT = args.includes('--out') ? args[args.indexOf('--out') + 1] : 'C:/Users/27741/OneDrive/Desktop/Probably weather new/probably-weather-new-c/review/rain-fog-frost-for-al.html';
const rain = R('v3-rainnow.json'), fog = R('v3-fog.json'), frost = R('v3-frost.json'), inland = R('v3-inland.json'), week = R('v3-lastweek.json');

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
const pc = (x) => (isNum(x) ? `${Math.round(x * 100)} %` : '—');
const in10 = (x) => (isNum(x) ? `${Math.round(x * 10)} in 10` : '—');
const f1 = (x) => (isNum(x) ? x.toFixed(1) : '—');
const table = (head, rows) => `<div class="scroll"><table class="simple"><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c, i) => `<td${i ? ' class="num"' : ''}>${c}</td>`).join('')}</tr>`).join('')}</table></div>`;
const V = ['A', 'B', 'C'];
const rng = (vals, fmt) => { const v = vals.filter(isNum); if (!v.length) return '—'; const lo = Math.min(...v), hi = Math.max(...v); const a = fmt(lo), b = fmt(hi); return a === b ? a : `${a}–${b}`; };

// ---- Rain's here, per region ----
const rainRows = Object.entries(rain.testByRegion).map(([g, x]) => [esc(g),
  `${rng(V.map((a) => 1 - x.r0[a].rate), (y) => `${Math.round(y * 100)}`)} % wrong <span class="muted">(${rng(V.map((a) => x.r0[a].calls), String)} calls)</span>`,
  `${rng(V.map((a) => (isNum(x.pick[a].rate) ? 1 - x.pick[a].rate : null)), (y) => `${Math.round(y * 100)}`)} % wrong <span class="muted">(${rng(V.map((a) => x.pick[a].calls), String)} calls)</span>`,
  `${pc(x.r0.A.rainHoursCalled / x.r0.A.rainHours)} → ${pc(x.pick.A.rainHoursCalled / x.pick.A.rainHours)}`,
  x.ships ? '<b>clearly more right</b>' : '<span class="muted">not proven</span>']);
const rainTable = table(['Where', 'Today', 'Strict<br><span class="muted">≥ 90 % and ≥ 2 mm</span>', 'Rain hours it said "Rain\'s here"', 'Strict here'], rainRows);
const rp = rain.testPooled;
const rainPooled = `Across all 13 airports in 2026: today's rule is wrong ${rng(V.map((a) => 1 - rp.r0[a].rate), (y) => `${Math.round(y * 100)}`)} % of the time; the strict version ${rng(V.map((a) => 1 - rp.pick[a].rate), (y) => `${Math.round(y * 100)}`)} %. It says "Rain's here" in ${pc(rp.pick.A.rainHoursCalled / rp.pick.A.rainHours)} of the hours it rained instead of ${pc(rp.r0.A.rainHoursCalled / rp.r0.A.rainHours)}; the others show "Might rain." (or Windy, in ${rp.pick.A.demotedWetToWind} rain hours).`;
const worstTimes = Object.entries(rain.descriptive.byRegionAndTime).filter(([, v]) => v.calls >= 50).sort((a, b) => b[1].falseShare - a[1].falseShare).slice(0, 6)
  .map(([k, v]) => `${esc(k.replace(' · ', ', '))}: wrong ${pc(v.falseShare)}`).join(' · ');

// ---- fog, per region ----
const fogRows = Object.entries(fog.byRegion).map(([g, x]) => [esc(g), `${x.today.calls} → <b>${x.chosen.calls}</b>`, `${x.today.hits} → <b>${x.chosen.hits}</b> <span class="muted">of ${x.today.fogHours}</span>`,
  `${f1(x.today.wrongPer1000)} → <b>${f1(x.chosen.wrongPer1000)}</b>`, ['Western Cape', 'Garden Route', 'Eastern Cape', 'KZN coast', 'Lowveld'].includes(g) ? '<b>proven</b>' : '<span class="muted">no change / not proven</span>']);
const fogTable = table(['Where', 'Fog calls', 'Real fog caught', 'Wrong fog per 1,000 hours', 'New rule'], fogRows);
const ft = fog.test;

// ---- frost ----
const fr = (lead, who) => { const L = frost.leads[lead][who]; const vs = ['old harness', 'ECMWF-heavy', 'mixed'];
  return { before: rng(vs.map((v) => L[v].frostBefore.bias), (y) => y.toFixed(1)), after: rng(vs.map((v) => L[v].frostAfter.bias), (y) => y.toFixed(1)),
    allBefore: rng(vs.map((v) => L[v].before.mae), (y) => y.toFixed(2)), allAfter: rng(vs.map((v) => L[v].after.mae), (y) => y.toFixed(2)) }; };
const frostTable = table(['', 'Frost nights: the low was too warm by', 'with the fix', 'All nights: off by', 'with the fix'],
  [['Inland airports, the day before', ...Object.values(fr('t1', 'airports')).map((x) => `${x} °C`)], ['Four SAWS towns, the day before', ...Object.values(fr('t1', 'towns')).map((x) => `${x} °C`)],
   ['Inland airports, the same morning', ...Object.values(fr('t0', 'airports')).map((x) => `${x} °C`)], ['Four SAWS towns, the same morning', ...Object.values(fr('t0', 'towns')).map((x) => `${x} °C`)]]);
const joburg = frost.leads.t1.byStation.FAOR['old harness'];

// ---- inland table ----
const inl = Object.entries(inland.leads.t1.byRegion).map(([g, m]) => [esc(g), `${rng(['old harness', 'ECMWF-heavy', 'mixed'].map((v) => m[v].sa), (y) => y.toFixed(2))} °C`,
  `<b>${rng(['old harness', 'ECMWF-heavy', 'mixed'].map((v) => m[v].inland), (y) => y.toFixed(2))} °C</b>`,
  ['Free State', 'Northern Cape', 'North West', 'Limpopo', 'Karoo', 'KZN inland'].includes(g) ? '<b>uses it</b>' : '<span class="muted">keeps the SA table</span>']);
const inlandTable = table(['Where (tomorrow, as seen the day before)', 'High and low off by, SA table', 'Inland table', ''], inl);

// ---- the last week ----
const wk = Object.values(week.places).map((p) => [esc(p.name), p.strict ? 'strict' : 'today\'s', `${p.summary.fogSaid} → <b>${p.summary.fogSaidNow}</b>`,
  `${p.summary.fogSaidAndFog} → ${p.summary.fogSaidNowAndFog} <span class="muted">(fog hours ${p.summary.fogHours})</span>`, `${p.summary.rainSaid} <span class="muted">(rained in ${p.summary.rainSaidAndRained})</span>`, String(p.summary.rainHours),
  esc(p.truthFrom === 'its own airport' ? 'its airport' : 'Cape Town airport, 27 km — not Strand\'s truth')]);
const weekTable = table(['Where', 'Fog rule', 'Hours the app said fog: today → new', 'of them fog at', '"Rain\'s here" hours', 'Rain hours', 'Truth from'], wk);
const hourly = (key) => {
  const p = week.places[key];
  const rows = p.hours.filter((h) => h.said === 'fog' || h.said === 'rain' || h.fog === 'fog' || h.rained)
    .map((h) => [esc(h.hour.replace('T', ' ') + ':00'), esc(h.source), esc(h.said === 'fog' ? 'Fog' : h.said === 'rain' ? "Rain's here" : h.said), esc(h.saidNow === 'not fog' ? 'not fog' : h.saidNow === h.said ? 'same' : h.saidNow),
      esc(h.fog === 'fog' ? 'fog' : h.rained ? 'rain' : h.fog === 'mist' ? 'mist' : 'dry, no fog'), `<code>${esc(h.metar || '')}</code>`]);
  return rows.length ? table(['Hour (SAST)', 'Source', 'The app said', 'New rules', 'Cape Town airport', 'Its report'], rows) : '<p class="muted">No fog or rain hours.</p>';
};

const QUESTIONS = [
  { key: 'rain-proven', text: "\"Rain's here\" in the Western Cape, Garden Route, Free State and Northern Cape — where the strict version was clearly more right. Which?", options: [['TODAY', "Keep today's"], ['STRICT', 'Strict: right 3 in 4, says it less'], ['NEVER', 'Only when radar sees rain']] },
  { key: 'rain-rest', text: "\"Rain's here\" everywhere else (Eastern Cape, KZN, Highveld, North West, Lowveld, Limpopo, West Coast, Karoo), where the strict version was not proven. Which?", options: [['TODAY', "Keep today's"], ['NEVER', 'Only when radar sees rain']] },
  ...[['Western Cape', 'fog-wc'], ['Garden Route', 'fog-gr'], ['Eastern Cape', 'fog-ec'], ['KZN coast', 'fog-kzn'], ['Lowveld', 'fog-lv']].map(([g, key]) => {
    const x = fog.byRegion[g];
    return { key, text: `Fog, ${g}: ${x.today.calls} fog calls become ${x.chosen.calls}; real fog caught ${x.today.hits} → ${x.chosen.hits} of ${x.today.fogHours} hours. Ship the new rule here?`, options: [['YES', 'Ship it'], ['NO', "Keep today's"]] };
  }),
  { key: 'wording', text: 'If "Rain\'s here" steps back somewhere, show "Showers nearby." (Afrikaans "Buie naby.") when rain is likely around but not confirmed here, instead of "Might rain."?', options: [['OK', 'OK as written'], ['FIX', 'Change it (note)'], ['NO', 'Keep "Might rain."']] },
  { key: 'remembered', text: 'Which hours in the last week did the rain or the fog feel off, and where? A note is enough — day, time, place.', options: [['NOTED', 'Noted below']] },
];

const css = readFileSync(path.join(here, '../v2/page.css'), 'utf8') + '\n.act button.on { background:var(--accent); border-color:var(--accent); color:#fff; }\n.row.TODAY,.row.STRICT,.row.NEVER,.row.FIX,.row.NOTED { border-left-color:var(--accent); }\n';
const js = readFileSync(path.join(here, '../v2/page.js'), 'utf8').replace("var KEY = 'pw-precision-for-al-2026-09-25';", "var KEY = 'pw-rain-fog-frost-for-al-2026-09-25';")
  .replace("a.download = 'precision-ruled.json'", "a.download = 'rain-fog-frost-ruled.json'").replace("ruledBy: 'Al, precision page (review/precision-for-al.html)'", "ruledBy: 'Al, rain / fog / frost page (review/rain-fog-frost-for-al.html)'");
if (!js.includes('pw-rain-fog-frost-for-al') || !js.includes('rain-fog-frost-ruled.json') || !js.includes('rain / fog / frost page')) throw new Error('page.js no longer has the strings this page renames');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Rain, fog, frost — for Al</title>
<style>${css}</style>
</head>
<body>
<main>
<h1>Rain's here, fog, frost — how wrong, and what changes</h1>
<p class="lede">Checked against what the airports reported: rain on every hour of 2025 and 2026 at 13 airports; fog from October 2025 (when Open-Meteo's visibility changed) at the 13 that report it; frost at the inland airports and four SA Weather Service towns. Every rule was chosen on one stretch of time and tested on another, and a rule reaches a region only where it was clearly better there. Nothing here is live.</p>
<div class="card"><h3>In plain words</h3><ul class="plain">
<li><b>"Rain's here."</b> Today it is right about half the time (wrong ${rng(V.map((a) => 1 - rp.r0[a].rate), (y) => `${Math.round(y * 100)}`)} %). Best on the south coast, worst inland — thunderstorm country at night is wrong 8 or 9 times in 10. A strict version (only when the models give 90 % and 2 mm) is right 3 times in 4 but says it far less, and it did not clear the bar I set before looking, so nothing changed: <b>your call, per region, below.</b> <span class="mark wait">YOUR CALL</span></li>
<li><b>Fog.</b> Today, when the app says fog it is fog about 1 time in 10 — ${Math.round((ft.today.calls - ft.today.hits) / ft.today.calls * 100)} % of its fog calls were wrong, and most came with no fog, mist or low cloud at the airport at all. The best rule the data allows, while still catching both Strand fogs you reported, cuts the wrong fog calls by about 3 in 10 on the coast. It is still wrong about 7 times in 8, and it catches fewer real fogs (George 7 → 2 of 78 hours). It is built; <b>it goes out only where you say.</b> <span class="mark wait">YOUR CALL</span></li>
<li><b>Frost nights.</b> The low on frost nights is still ${fr('t1', 'airports').before} °C too warm the day before at the inland airports. A "clear, calm, dry night" fix takes it to ${fr('t1', 'airports').after} °C, but it made Johannesburg's lows worse (${f1(joburg.before.mae)} → ${f1(joburg.after.mae)} °C off: its airport sits on open high ground that does not cool like the valleys), so it did not ship. <span class="mark report">NOT SHIPPED</span></li>
<li><b>Inland highs and lows.</b> A table learned at the inland airports makes today's and tomorrow's high and low about 0.07 °C closer in the Free State, Northern Cape, North West, Limpopo, the Karoo and KZN inland (not the Highveld, where it did worse). <span class="mark ship">BUILT · NOT PUSHED</span></li>
<li><b>Strand.</b> Nothing kept what the app said at Strand before today — the server does not log it and no station reports from Strand. From 16:10 today your PC's recorder reads Strand and Cape Town city every hour.</li>
</ul></div>

<h2>"Rain's here", region by region (2026)</h2>
<p class="lede">${rainPooled} Where today's rule is worst: ${worstTimes}.</p>
${rainTable}
<p class="muted">"Today" and "strict" are ranges over three guesses of which weather model each of the app's sources uses. The strict version did not clear the bar set before the test (a 2025 lower bound of 60 % right; it reached 51 %), so it is one year of evidence, not two.</p>

<h2>Fog, region by region (tested on alternate weeks, Oct 2025 – Sept 2026)</h2>
<p class="lede">Today: ${ft.today.calls} fog calls, ${ft.today.hits} right (${pc(ft.today.precision)}); caught ${pc(ft.today.recall)} of ${ft.today.fogHours} real fog hours. New: ${ft.chosen.calls} calls, ${ft.chosen.hits} right (${pc(ft.chosen.precision)}); caught ${pc(ft.chosen.recall)}. The new rule also needs humidity 95 % or more and Open-Meteo's wind 10 km/h or less before it says fog. The West Coast has no station that reports fog, so it keeps today's rule.</p>
${fogTable}

<h2>Frost nights</h2>
<p class="lede">Nights with a low of 2 °C or less, inland (the Lowveld left out). Ranges over the three source guesses.</p>
${frostTable}

<h2>Inland highs and lows</h2>
${inlandTable}

<h2>The last week — Strand, Cape Town and the six recorder cities</h2>
<p class="lede">From 01:58 on 25 Sept these are what the app really said (the recorder). Before that they are the app's fog detector and rain rule replayed on Open-Meteo's own past forecasts — the fog words of the other sources and Tomorrow.io's radar cannot be replayed, so a replayed hour shows fog only when the detector would have fired.</p>
${weekTable}
<h3>Strand, hour by hour (fog and rain hours only)</h3>
${hourly('STRAND')}
<h3>Cape Town airport, hour by hour</h3>
${hourly('FACT')}

<h2>New wording to OK</h2>
<div class="card"><p><b>"Showers nearby."</b> — Afrikaans <b>"Buie naby."</b></p><p class="muted">Only if "Rain's here" steps back somewhere: shown instead of "Might rain." when the chance is high but rain is not confirmed at your spot — the inland storm pattern, where it pours down the road and not on you. isiZulu, isiXhosa and Sesotho follow through the translation skills and lang-check once you OK it.</p></div>

<h2>Questions</h2>
<div id="questions"></div>
<textarea id="out" readonly></textarea>
</main>
<div class="bar"><span id="count" class="muted"></span><button id="export">Export rain-fog-frost-ruled.json</button><button id="copy" class="ghost">Copy JSON</button></div>
<div class="zoom" id="zoom"><img alt=""></div>
<script>
var QUESTIONS = ${JSON.stringify(QUESTIONS)};
${js}
</script>
</body>
</html>
`;
writeFileSync(OUT, html);
console.log(`wrote ${OUT} (${Math.round(html.length / 1024)} KB)`);
