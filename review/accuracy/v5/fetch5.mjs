// Data for review/accuracy/v5 (PLAN.md §6): Strand's SYNOP station 68911 from Ogimet, a month per request, 25 s
// apart, and Open-Meteo's past runs (six models) and short-lead gusts (three) at 68911's own coordinates. Resumable.
// Data → review/accuracy/v2/data/ (synop-68911-<yyyymm>.txt, runs-68911-<model>.json, hist-68911-<model>.json).
//   node review/accuracy/v5/fetch5.mjs
import { existsSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { DATA } from '../v2/lib.mjs';
import { RUN_MODELS, RUN_VARS, HIST_MODELS, HIST_VARS } from '../v2/stations.mjs';

export const STRAND = { id: '68911', name: 'Strand', region: 'Western Cape', lat: -34.1408, lon: 18.8483, elev: 7 };
const FROM = '2025-01-01', TO = '2026-09-28';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LOG = path.join(DATA, 'fetch.log');
const log = (s) => { const l = `${new Date().toISOString()} ${s}`; console.log(l); appendFileSync(LOG, l + '\n'); };
const UA = 'probably-weather accuracy check (research, low volume)';

async function get(url, ok) {
  for (let tr = 1; tr <= 4; tr++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(180_000) });
      const t = await r.text();
      if (r.ok && ok(t)) return t;
      log(`${url.slice(0, 90)}: HTTP ${r.status} ${t.slice(0, 80).replace(/\s+/g, ' ')} (try ${tr})`); await sleep(60_000 * tr);
    } catch (e) { log(`${url.slice(0, 90)}: ${e.message} (try ${tr})`); await sleep(30_000 * tr); }
  }
  return null;
}

const isJson = (t) => { try { return Boolean(JSON.parse(t).hourly); } catch { return false; } };
for (const [kind, models, vars, host] of [['runs', RUN_MODELS, RUN_VARS, 'previous-runs-api'], ['hist', HIST_MODELS, HIST_VARS, 'historical-forecast-api']]) {
  for (const m of models) {
    const file = path.join(DATA, `${kind}-${STRAND.id}-${m}.json`);
    if (existsSync(file)) continue;
    const t = await get(`https://${host}.open-meteo.com/v1/forecast?latitude=${STRAND.lat}&longitude=${STRAND.lon}&hourly=${vars.join(',')},wind_direction_10m&start_date=${FROM}&end_date=${TO}&timezone=Africa%2FJohannesburg&models=${m}`, isJson);
    if (t) { writeFileSync(file, t); log(`${kind}-${STRAND.id}-${m}: ${Math.round(t.length / 1024)} KB`); }
    await sleep(3_000);
  }
}
for (let y = 2025, mo = 1; y < 2026 || (y === 2026 && mo <= 9); mo === 12 ? (y++, mo = 1) : mo++) {
  const tag = `${y}${String(mo).padStart(2, '0')}`;
  const file = path.join(DATA, `synop-${STRAND.id}-${tag}.txt`);
  if (existsSync(file)) continue;
  const last = y === 2026 && mo === 9 ? 28 : new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const t = await get(`https://www.ogimet.com/cgi-bin/getsynop?block=${STRAND.id}&begin=${tag}010000&end=${tag}${String(last).padStart(2, '0')}2300`, (x) => /68911/.test(x) || x.trim() === '');
  if (t !== null) { writeFileSync(file, t); log(`synop-${STRAND.id}-${tag}: ${t.trim().split('\n').filter(Boolean).length} reports`); }
  await sleep(25_000);
}
log('V5 FETCH DONE');
