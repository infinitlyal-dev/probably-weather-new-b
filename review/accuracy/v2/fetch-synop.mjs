// SA Weather Service synoptic reports for the two regions with no hourly airport record — the Karoo and
// KZN inland — from the Ogimet archive (WMO SYNOP, 3-hourly), a month and a block of stations per request,
// 25 s apart. Resumable. Data → review/accuracy/v2/data/synop-<block>-<yyyymm>.txt
//   node review/accuracy/v2/fetch-synop.mjs
import { existsSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { DATA } from './lib.mjs';

export const SYNOP_STATIONS = [
  { id: '68727', name: 'Beaufort West', region: 'Karoo', lat: -32.350, lon: 22.550, elev: 899 },
  { id: '68737', name: 'Graaff-Reinet', region: 'Karoo', lat: -32.200, lon: 24.550, elev: 790 },
  { id: '68581', name: 'Pietermaritzburg', region: 'KZN inland', lat: -29.633, lon: 30.400, elev: 673 },
  { id: '68479', name: 'Ladysmith', region: 'KZN inland', lat: -28.567, lon: 29.767, elev: 1069 },
];
const BLOCKS = [...new Set(SYNOP_STATIONS.map((s) => s.id.slice(0, 3)))];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LOG = path.join(DATA, 'fetch.log');
const log = (s) => { const l = `${new Date().toISOString()} ${s}`; console.log(l); appendFileSync(LOG, l + '\n'); };

if (process.argv[1] && process.argv[1].endsWith('fetch-synop.mjs')) {
  mkdirSync(DATA, { recursive: true });
  const months = [];
  for (let y = 2025, m = 1; y < 2026 || (y === 2026 && m <= 9); m === 12 ? (y++, m = 1) : m++) months.push([y, m]);
  for (const b of BLOCKS) for (const [y, m] of months) {
    const tag = `${y}${String(m).padStart(2, '0')}`;
    const file = path.join(DATA, `synop-${b}-${tag}.txt`);
    if (existsSync(file)) continue;
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const url = `https://www.ogimet.com/cgi-bin/getsynop?block=${b}&begin=${tag}010000&end=${tag}${last}2100`;
    for (let tr = 1; tr <= 4; tr++) {
      try {
        const r = await fetch(url, { headers: { 'User-Agent': 'probably-weather precision check (research, low volume)' }, signal: AbortSignal.timeout(120_000) });
        const t = await r.text();
        if (r.ok && /AAXX/.test(t)) { writeFileSync(file, t); log(`synop-${b}-${tag}: ${Math.round(t.length / 1024)} KB`); break; }
        log(`synop-${b}-${tag}: HTTP ${r.status} ${t.slice(0, 80).replace(/\s+/g, ' ')} (try ${tr})`); await sleep(60_000 * tr);
      } catch (e) { log(`synop-${b}-${tag}: ${e.message} (try ${tr})`); await sleep(30_000 * tr); }
    }
    await sleep(25_000);
  }
  log('SYNOP DONE');
}
