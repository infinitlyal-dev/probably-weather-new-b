// Data for review/accuracy/v7 (gusts, 28 Sept 2026): every SA Weather Service SYNOP in WMO block 68 from Ogimet
// (a week per request, 25 s apart), the station list with coordinates (NOAA ISD history), the 23 airports' METARs
// from the Iowa Environmental Mesonet, then Open-Meteo's historical-forecast archive (wind, gust, direction, temperature;
// six models) at every gust-reporting SA station and airport, paced. Resumable: a file on disk is not fetched again
// (the last week and the METARs are re-fetched when --fresh is given).
// Data → review/accuracy/v2/data/v7/.
//   node review/accuracy/v7/fetch7.mjs [--fresh]
import { existsSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { STATIONS } from '../v2/stations.mjs';
import { DATA, loadIsd } from './common.mjs';

export { DATA, loadIsd };
export const FROM = '2026-03-01';
export const TO = new Date().toISOString().slice(0, 10);
// Two passes to stay inside the free tier (a request counts ~ variables/10 × days/14 calls; 5,000 an hour, 10,000 a
// day): A = the three gust models with wind, gust, direction, temperature (~18 calls a place, 8 s apart); B = the
// three mean-only models with wind and temperature (~15 calls a place, 17 s apart).
export const PASSES = [
  { tag: 'om', models: ['best_match', 'ecmwf_ifs025', 'gfs_seamless'], vars: ['wind_speed_10m', 'wind_gusts_10m', 'wind_direction_10m', 'temperature_2m'], gapMs: 8_000 },
  { tag: 'omb', models: ['icon_seamless', 'ukmo_seamless', 'meteofrance_seamless'], vars: ['wind_speed_10m', 'temperature_2m'], gapMs: 17_000 },
];
const UA = 'probably-weather accuracy check (research, low volume)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LOG = path.join(DATA, 'fetch.log');
const log = (s) => { const l = `${new Date().toISOString()} ${s}`; console.log(l); appendFileSync(LOG, l + '\n'); };
const fresh = process.argv.includes('--fresh');

async function get(url, ok, tries = 4) {
  for (let tr = 1; tr <= tries; tr++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(180_000) });
      const t = await r.text();
      if (r.ok && ok(t)) return t;
      log(`${url.slice(0, 100)}: HTTP ${r.status} ${t.slice(0, 100).replace(/\s+/g, ' ')} (try ${tr})`); await sleep(60_000 * tr);
    } catch (e) { log(`${url.slice(0, 100)}: ${e.message} (try ${tr})`); await sleep(30_000 * tr); }
  }
  return null;
}

async function ogimet() {
  const today = new Date();
  for (let d = new Date(`${FROM}T00:00:00Z`); d <= today; d = new Date(d.getTime() + 7 * 864e5)) {
    const end = new Date(Math.min(d.getTime() + 7 * 864e5 - 3600e3, today.getTime()));
    const tag = d.toISOString().slice(0, 10).replace(/-/g, '');
    const file = path.join(DATA, `synop68-${tag}.txt`);
    const last = end.getTime() + 3600e3 >= today.getTime();
    if (existsSync(file) && !(last && fresh)) continue;
    const st = (x) => x.toISOString().slice(0, 13).replace(/[-T]/g, '') + '00';
    const t = await get(`https://www.ogimet.com/cgi-bin/getsynop?block=68&begin=${st(d)}&end=${st(end)}`, (x) => /^68\d{3},/m.test(x));
    if (t !== null) { writeFileSync(file, t); log(`synop68-${tag}: ${t.trim().split('\n').length} reports`); }
    await sleep(25_000);
  }
  log('OGIMET DONE');
}

async function isdAndMetar() {
  const isd = path.join(DATA, 'isd-history.csv');
  if (!existsSync(isd)) {
    const t = await get('https://www.ncei.noaa.gov/pub/data/noaa/isd-history.csv', (x) => x.startsWith('"USAF"'));
    if (t) { writeFileSync(isd, t.split('\n').filter((l, i) => i === 0 || /^"68\d{4}"/.test(l)).join('\n')); log('isd-history: block 68 kept'); }
  }
  const [fy, fm, fd] = FROM.split('-').map(Number);
  const end = new Date(Date.now() + 864e5);
  for (const s of STATIONS) {
    const file = path.join(DATA, `metar-${s.id}.csv`);
    if (existsSync(file) && !fresh) continue;
    const url = `https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?station=${s.id}&data=all&year1=${fy}&month1=${fm}&day1=${fd}&year2=${end.getUTCFullYear()}&month2=${end.getUTCMonth() + 1}&day2=${end.getUTCDate()}&tz=Etc/UTC&format=onlycomma&latlon=no&elev=no&missing=M&trace=T&direct=no&report_type=3&report_type=4`;
    const t = await get(url, (x) => x.startsWith('station,'));
    if (t) { writeFileSync(file, t); log(`metar-${s.id}: ${t.split('\n').length - 2} rows`); }
    await sleep(3_000);
  }
  log('METAR DONE');
}

async function openMeteo(points) {
  for (const pass of PASSES) {
    for (const p of points) {
      const file = path.join(DATA, `${pass.tag}-${p.id}.json`);
      if (existsSync(file) && !fresh) continue;
      const url = `https://historical-forecast-api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&hourly=${pass.vars.join(',')}&start_date=${FROM}&end_date=${TO}&timezone=Africa%2FJohannesburg&models=${pass.models.join(',')}`;
      const t = await get(url, (x) => { try { return Boolean(JSON.parse(x).hourly); } catch { return false; } });
      if (t) { writeFileSync(file, t); log(`${pass.tag}-${p.id}: ${Math.round(t.length / 1024)} KB`); }
      await sleep(pass.gapMs);
    }
    log(`OPEN-METEO ${pass.tag} DONE (${points.length} points)`);
  }
}

if (process.argv[1] && process.argv[1].endsWith('fetch7.mjs')) {
  await Promise.all([ogimet(), isdAndMetar()]);
  // The stations to fetch models for: every block-68 station inside South Africa that sent a 910ff gust at least
  // 100 times since March, plus the airports.
  const { gustStationsFromDisk } = await import('./synop7.mjs');
  // Airports: those with no SYNOP station within 3 km (their own truth), and the recorder's six (the fidelity check).
  const gs = gustStationsFromDisk(100);
  const RECORDER = ['FACT', 'FAOR', 'FALE', 'FAPE', 'FABL', 'FAGG'];
  const kmTo = (a, b) => 111 * Math.hypot(a.lat - b.lat, (a.lon - b.lon) * Math.cos(a.lat * Math.PI / 180));
  const air = STATIONS.filter((a) => !a.skip && (RECORDER.includes(a.id) || !gs.some((s) => kmTo(a, s) <= 3)));
  const pts = [...gs, ...air].map((s) => ({ id: s.id, lat: s.lat, lon: s.lon }));
  log(`model points: ${pts.length}`);
  await openMeteo(pts);
  log('V7 FETCH DONE');
}
