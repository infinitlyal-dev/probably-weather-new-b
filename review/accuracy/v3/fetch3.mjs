// The rain / fog / frost run's extra downloads (25 Sept 2026), into the v2 data folder so the v2 loaders read
// them. Resumable; a reply that is not JSON is never saved (as v2/fetch.mjs, 966ac4c).
//   node review/accuracy/v3/fetch3.mjs
// 1. prev-<id>-best_match.json — Open-Meteo's own cloud, low cloud and dew point as forecast the day before
//    (the previous-runs archive keeps them for the latest run only in v2), for the frost gate at tomorrow's lead.
// (Planned and dropped the same hour: the short-lead archive for the four SA Weather Service towns and Cape
// Columbine. Those stations are automatic and report no present weather and no visibility, so they cannot give
// rain-now or fog truth; the towns stay the frost carry test on their night minima.)
import { existsSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { SCORED, PERIOD } from '../v2/stations.mjs';
import { SYNOP_STATIONS } from '../v2/fetch-synop.mjs';
import { DATA } from '../v2/lib.mjs';

const PACE_MS = Number(process.env.PACE_MS || 33_000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LOG = path.join(DATA, 'fetch.log');
const log = (s) => { const l = `${new Date().toISOString()} ${s}`; console.log(l); appendFileSync(LOG, l + '\n'); };
const range = `start_date=${PERIOD.from}&end_date=${PERIOD.to}&timezone=Africa%2FJohannesburg`;

const jobs = [];
for (const s of [...SCORED, ...SYNOP_STATIONS]) jobs.push({ file: `prev-${s.id}-best_match.json`, url: `https://previous-runs-api.open-meteo.com/v1/forecast?latitude=${s.lat}&longitude=${s.lon}&hourly=cloud_cover_previous_day1,dew_point_2m_previous_day1,cloud_cover_low,cloud_cover_low_previous_day1&${range}&models=best_match` });

async function get(url, file, tries = 5) {
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'probably-weather accuracy check (research, low volume)' }, signal: AbortSignal.timeout(180_000) });
      const body = await r.text();
      if (r.status === 429 || r.status >= 500) { log(`${file}: HTTP ${r.status}, waiting (try ${i}) ${body.slice(0, 120)}`); await sleep(60_000 * i); continue; }
      if (!r.ok) { log(`${file}: HTTP ${r.status} ${body.slice(0, 200)}`); return false; }
      try { JSON.parse(body); } catch { log(`${file}: not JSON (try ${i}) ${body.slice(0, 120)}`); await sleep(60_000 * i); continue; }
      writeFileSync(path.join(DATA, file), body);
      log(`${file}: ${Math.round(body.length / 1024)} KB`);
      return true;
    } catch (e) { log(`${file}: ${e.message} (try ${i})`); await sleep(15_000 * i); }
  }
  return false;
}

if (process.argv[1] && process.argv[1].endsWith('fetch3.mjs')) {
  mkdirSync(DATA, { recursive: true });
  const todo = jobs.filter((j) => !existsSync(path.join(DATA, j.file)));
  log(`v3 requests to do: ${todo.length} of ${jobs.length}`);
  for (const [i, j] of todo.entries()) { await get(j.url, j.file); if (i < todo.length - 1) await sleep(PACE_MS); }
  log('V3 DONE');
}
