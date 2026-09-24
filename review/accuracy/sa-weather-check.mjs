// SA WEATHER CHECK (launch run, 2026-09-25) — the weather that matters most in South Africa, from
// the resolver replay (run-eval.mjs → results/<tag>-hours.csv, what the phone showed each hour)
// and the day rows of forecast-candidates.mjs. Winter sample (24 Jun → 22 Sep 2026): fronts, the
// south-easter, fog and frost are in it; Highveld storms and KZN heat mostly are not — the counts say so.
//
//   node review/accuracy/run-eval.mjs --tag launch && node review/accuracy/forecast-candidates.mjs
//   node review/accuracy/sa-weather-check.mjs [--tag launch]
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ACCURACY_ROOT } from './lib/sources.mjs';

const TAG = process.argv.includes('--tag') ? process.argv[process.argv.indexOf('--tag') + 1] : 'launch';
const csv = readFileSync(path.join(ACCURACY_ROOT, 'results', `${TAG}-hours.csv`), 'utf8').trim().split(/\r?\n/);
const head = csv[0].split(',');
const H = csv.slice(1).map((l) => { const c = l.split(','); const o = {}; head.forEach((h, i) => { o[h] = c[i]; }); return o; });
const days = JSON.parse(readFileSync(path.join(ACCURACY_ROOT, 'results', 'forecast-candidates-days.json'), 'utf8'));
const WET = new Set(['rain', 'rain-possible', 'storm', 'thunder', 'hail']);
const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);
const num = (v) => (v === '' || v == null ? null : Number(v));
const dirOf = (metar) => { const m = /\s(\d{3})(\d{2,3})(G\d{2,3})?KT/.exec(metar || ''); return m ? Number(m[1]) : null; };
const out = [];
const row = (name, where, n, caught, what, note = '') => out.push({ name, where, n, caught, share: pct(caught, n), what, note });

// Cape cold front hours: rain reported AND a fresh wind at FACT.
{ const hs = H.filter((h) => h.icao === 'FACT' && h.obsPrecip === 'true' && h.obsWindy === 'true');
  row('Cape cold front (rain + wind)', 'Cape Town', hs.length, hs.filter((h) => WET.has(h.display) || h.display === 'wind').length, 'phone showed rain, might-rain, storm or wind'); }
// South-easter: SE quadrant (100–170°), windy, dry.
{ const hs = H.filter((h) => h.icao === 'FACT' && h.obsWindy === 'true' && h.obsPrecip !== 'true' && (() => { const d = dirOf(h.metar); return d != null && d >= 100 && d <= 170; })());
  row('South-easter (dry, SE, ≥30 km/h or gusts ≥45)', 'Cape Town', hs.length, hs.filter((h) => h.display === 'wind').length, 'phone showed wind', 'winter sample: the south-easter is a summer wind'); }
// Coastal fog: FG reported.
for (const [icao, city] of [['FACT', 'Cape Town'], ['FAPE', 'Gqeberha'], ['FAGG', 'George'], ['FALE', 'Durban']]) {
  const hs = H.filter((h) => h.icao === icao && h.obsFog === 'true');
  row('Fog (FG reported)', city, hs.length, hs.filter((h) => h.display === 'fog').length, 'phone showed fog');
}
// Highveld storms: thunder reported.
for (const [icao, city] of [['FAOR', 'Johannesburg'], ['FABL', 'Bloemfontein']]) {
  const hs = H.filter((h) => h.icao === icao && h.obsThunder === 'true');
  row('Thunderstorm (TS reported)', city, hs.length, hs.filter((h) => h.display === 'storm' || h.display === 'thunder' || WET.has(h.display)).length, 'phone showed storm or rain', 'Highveld storm season starts in October — few in this sample');
}
// Frost nights: observed minimum ≤ 2 °C — the served low's miss.
const frost = [];
for (const [icao, city] of [['FAOR', 'Johannesburg'], ['FABL', 'Bloemfontein'], ['FAGG', 'George']]) {
  const ds = days.filter((d) => d.icao === icao && d.obsMin <= 2);
  const mae = (k) => (ds.length ? Math.round((ds.reduce((s, d) => s + Math.abs(d.low[k] - d.obsMin), 0) / ds.length) * 10) / 10 : null);
  const bias = (k) => (ds.length ? Math.round((ds.reduce((s, d) => s + (d.low[k] - d.obsMin), 0) / ds.length) * 10) / 10 : null);
  const saidFrosty = ds.filter((d) => d.low.current <= 3).length;
  frost.push({ city, nights: ds.length, currentMae: mae('current'), currentBias: bias('current'), noPirateMae: mae('noPirate'), omOnlyMae: mae('omOnly'), saidLowAtMost3: saidFrosty });
}
// KZN heat: Durban days ≥ 28 °C observed.
const hot = days.filter((d) => d.icao === 'FALE' && d.obsMax >= 28);
const heat = { city: 'Durban', days: hot.length, highBias: hot.length ? Math.round((hot.reduce((s, d) => s + (d.high6 - d.obsMax), 0) / hot.length) * 10) / 10 : null };

const md = ['# SA weather check — what the phone showed in the weather that matters (launch run)', '',
  `Resolver replay \`results/${TAG}-hours.csv\` (the shipped rules, 24 Jun → 22 Sep 2026, six airports, stand-ins for four sources) and the day rows of \`forecast-candidates.mjs\`. Winter sample.`, '',
  '| weather | where | hours | phone got it | share | what counts | note |', '|---|---|---:|---:|---:|---|---|',
  ...out.map((r) => `| ${r.name} | ${r.where} | ${r.n} | ${r.caught} | ${r.share ?? '—'}% | ${r.what} | ${r.note} |`), '',
  '**Frost nights** (airport minimum ≤ 2 °C) — the served overnight low (as served at 06:00):', '',
  '| where | nights | served low MAE (bias) | said ≤ 3 °C | drop Pirate MAE | Open-Meteo alone MAE |', '|---|---:|---|---:|---:|---:|',
  ...frost.map((f) => `| ${f.city} | ${f.nights} | ${f.currentMae} (${f.currentBias}) | ${f.saidLowAtMost3} | ${f.noPirateMae} | ${f.omOnlyMae} |`), '',
  `**KZN heat:** Durban days with an observed high ≥ 28 °C: ${heat.days} (served high bias ${heat.highBias ?? '—'} °C). Summer heat is not in this sample.`];
writeFileSync(path.join(ACCURACY_ROOT, 'results', 'sa-weather-check.md'), md.join('\n') + '\n');
console.log(md.join('\n'));
