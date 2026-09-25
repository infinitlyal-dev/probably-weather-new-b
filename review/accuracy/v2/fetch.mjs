// Download the precision check's inputs (resumable: files already on disk are skipped).
//   node review/accuracy/v2/fetch.mjs [--only metar|runs|hist]
// Observations: IEM METAR archive (routine + special reports, UTC), one request per station.
// Forecasts:    Open-Meteo's free research endpoints (the paid key lives only in Vercel), paced under
//               their limits (600/min, 5,000/hour, 10,000/day in weighted calls: one request here is
//               ~45 weighted calls — 21 months in 2-week blocks, ≤ 10 variables).
// Data goes to review/accuracy/v2/data/ (git-ignored).
import { existsSync, mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STATIONS, SCORED, PERIOD, RUN_MODELS, RUN_VARS, HIST_MODELS, HIST_VARS } from './stations.mjs';
import { SYNOP_STATIONS } from './fetch-synop.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(here, 'data');
mkdirSync(DATA, { recursive: true });
const LOG = path.join(DATA, 'fetch.log');
const log = (s) => { const line = `${new Date().toISOString()} ${s}`; console.log(line); appendFileSync(LOG, line + '\n'); };
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, file, { tries = 5, wait = 60_000 } = {}) {
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'probably-weather precision check (research, low volume)' }, signal: AbortSignal.timeout(180_000) });
      const body = await r.text();
      if (r.status === 429 || r.status >= 500) { log(`${file}: HTTP ${r.status}, waiting ${wait / 1000}s (try ${i}) ${body.slice(0, 120)}`); await sleep(wait * i); continue; }
      if (!r.ok) { log(`${file}: HTTP ${r.status} ${body.slice(0, 200)}`); return false; }
      // A 200 can still carry a streamed error instead of data ("Unexpected error while streaming data:
      // timeoutReached", 25 Sept) — never save what does not parse.
      try { JSON.parse(body); } catch { log(`${file}: not JSON, waiting ${wait / 1000}s (try ${i}) ${body.slice(0, 120)}`); await sleep(wait * i); continue; }
      writeFileSync(path.join(DATA, file), body);
      log(`${file}: ${Math.round(body.length / 1024)} KB`);
      return true;
    } catch (e) { log(`${file}: ${e.message} (try ${i})`); await sleep(15_000 * i); }
  }
  return false;
}

const [fy, fm, fd] = PERIOD.from.split('-').map(Number);
const end = new Date(`${PERIOD.to}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 2);

if (!only || only === 'metar') {
  for (const s of STATIONS) {
    const file = `metar-${s.id}.csv`;
    if (existsSync(path.join(DATA, file))) continue;
    const url = `https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?station=${s.id}&data=all&year1=${fy}&month1=${fm}&day1=${fd}&year2=${end.getUTCFullYear()}&month2=${end.getUTCMonth() + 1}&day2=${end.getUTCDate()}&tz=Etc/UTC&format=onlycomma&latlon=no&elev=no&missing=M&trace=T&direct=no&report_type=3&report_type=4`;
    await get(url, file, { wait: 30_000 });
    await sleep(4_000);
  }
}

const jobs = [];
if (!only || only === 'runs') for (const s of SCORED) for (const m of RUN_MODELS) jobs.push({ file: `runs-${s.id}-${m}.json`, url: `https://previous-runs-api.open-meteo.com/v1/forecast?latitude=${s.lat}&longitude=${s.lon}&hourly=${RUN_VARS.join(',')}&start_date=${PERIOD.from}&end_date=${PERIOD.to}&timezone=Africa%2FJohannesburg&models=${m}` });
// --only synop-runs: past runs for the synoptic stations (the Karoo and KZN inland)
if (only === 'synop-runs') for (const s of SYNOP_STATIONS) for (const m of RUN_MODELS) jobs.push({ file: `runs-${s.id}-${m}.json`, url: `https://previous-runs-api.open-meteo.com/v1/forecast?latitude=${s.lat}&longitude=${s.lon}&hourly=${RUN_VARS.join(',')}&start_date=${PERIOD.from}&end_date=${PERIOD.to}&timezone=Africa%2FJohannesburg&models=${m}` });
if (!only || only === 'hist') for (const s of SCORED) for (const m of HIST_MODELS) jobs.push({ file: `hist-${s.id}-${m}.json`, url: `https://historical-forecast-api.open-meteo.com/v1/forecast?latitude=${s.lat}&longitude=${s.lon}&hourly=${HIST_VARS.join(',')}&start_date=${PERIOD.from}&end_date=${PERIOD.to}&timezone=Africa%2FJohannesburg&models=${m}` });
const todo = jobs.filter((j) => !existsSync(path.join(DATA, j.file)));
log(`forecast requests to do: ${todo.length} of ${jobs.length}`);
for (const [i, j] of todo.entries()) {
  await get(j.url, j.file);
  // ~33 s apart ≈ 110 requests an hour ≈ 4,900 weighted calls: just under the 5,000-an-hour limit
  if (i < todo.length - 1) await sleep(Number(process.env.PACE_MS || 45_000));
}
log('DONE');
