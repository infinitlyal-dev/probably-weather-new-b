// LIVE RECORDER — once an hour, what production served at the six harness airports, next to
// what those airports reported. Raw evidence only: scoring lives in score.mjs, so this file
// imports nothing from the repo and can run from a copy outside it (install-recorder.ps1).
//
//   node review/accuracy/live/record.mjs [--out <dir>]
//
// Per run: 1 GET /api/version + 6 GET /api/weather (one per airport) + 2 for Al's spots (below) + 1 METAR call for all six
// stations (aviationweather.gov, last 3 h), all at once. One retry on a network error or a 5xx,
// none after a timeout, so a run ends inside ~50 s even when production is slow. Appends one JSON
// line per airport to <out>/<SAST date>.jsonl and one status line to <out>/recorder.log. Six cities
// an hour is the cost Al ruled fine.
//
// A replayed (cached) payload keeps the numbers of the moment it was computed while its
// meta.localHour is refreshed — align on meta.updatedAtLabel, never on localHour (score.mjs does).
//
// The coordinates are lib/sources.mjs CITIES, copied (score.mjs checks every record against them).
//
// Al's own spots (25 Sept 2026, the rain / fog / frost run): Strand and Cape Town city, read the same way so
// there is a record of what the app says where Al looks. No airport reports there, so their lines carry
// `icao: null`, a `spot` name and no METAR; score.mjs and the v2 live scorers skip them.

import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = 'https://www.probablyweather.co.za';
const AWC = 'https://aviationweather.gov/api/data/metar';
const UA = 'probably-weather accuracy recorder (review/accuracy/live/record.mjs; howzit@probablyweather.co.za)';
const CITIES = {
  FACT: { name: 'Cape Town',    lat: -33.9648, lon: 18.6017 },
  FAOR: { name: 'Johannesburg', lat: -26.1392, lon: 28.2460 },
  FALE: { name: 'Durban',       lat: -29.6144, lon: 31.1197 },
  FAPE: { name: 'Gqeberha',     lat: -33.9849, lon: 25.6173 },
  FABL: { name: 'Bloemfontein', lat: -29.0927, lon: 26.3024 },
  FAGG: { name: 'George',       lat: -34.0056, lon: 22.3789 },
};
const SPOTS = {
  Strand:           { lat: -34.1163, lon: 18.8362 },
  'Cape Town city': { lat: -33.9249, lon: 18.4241 },
};
const HOURLY_KEEP = 48;   // the next two days of hours — the forecast lead times the scorer reads
const TIMEOUT_MS = 20000;

const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(argOf('--out', HERE));
// Where a line goes if OneDrive holds the data file: next to this script.
const FALLBACK = HERE;

async function getOnce(url) {
  const t0 = Date.now();
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const text = await r.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = null; }
  const h = (k) => r.headers.get(k);
  return {
    status: r.status, ms: Date.now() - t0, body,
    headers: { 'x-vercel-cache': h('x-vercel-cache'), 'x-vercel-id': h('x-vercel-id'), age: h('age') },
    bodyError: body ? null : text.slice(0, 200),
  };
}
const isTimeout = (e) => e?.name === 'TimeoutError' || e?.name === 'AbortError';
// One retry on a network error or a 5xx; a timeout is not retried (it would double the run).
async function getWithOneRetry(url) {
  const atUtc = new Date().toISOString();
  let first;
  try {
    first = await getOnce(url);
    if (first.status < 500) return { atUtc, attempts: 1, ...first };
  } catch (e) {
    if (isTimeout(e)) return { atUtc, attempts: 1, error: `timeout after ${TIMEOUT_MS} ms` };
    first = { error: String(e?.message || e) };
  }
  try { return { atUtc, attempts: 2, firstError: first.error ?? `HTTP ${first.status}`, ...(await getOnce(url)) }; } catch (e) {
    return { atUtc, attempts: 2, firstError: first.error ?? `HTTP ${first.status}`, error: isTimeout(e) ? `timeout after ${TIMEOUT_MS} ms` : String(e?.message || e) };
  }
}

// What the scorer reads. The whole payload minus hours beyond HOURLY_KEEP.
function pickPayload(b) {
  if (!b || typeof b !== 'object') return null;
  return {
    ok: b.ok, location: b.location, now: b.now, consensus: b.consensus,
    windKph: b.wind_kph ?? null, maxWindKph: b.maxWindKph ?? null, gustKph: b.gustKph ?? null, windDir: b.windDir ?? null,
    daily: b.daily ?? null,
    hourly: Array.isArray(b.hourly) ? b.hourly.slice(0, HOURLY_KEEP) : null,
    meta: b.meta ?? null,
  };
}

// OneDrive can hold a file for a moment while it uploads it: retry, then write beside the script.
function appendSafely(file, text) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try { appendFileSync(file, text); return file; } catch (e) {
      if (!['EBUSY', 'EPERM', 'EACCES'].includes(e?.code)) throw e;
      const until = Date.now() + 400 * (attempt + 1); while (Date.now() < until) { /* short wait, no timers needed */ }
    }
  }
  const alt = path.join(FALLBACK, `held-${path.basename(file)}`);
  appendFileSync(alt, text);
  return alt;
}

const sastDate = (ms) => new Date(ms + 2 * 3600e3).toISOString().slice(0, 10);

const runAtUtc = new Date().toISOString();
mkdirSync(OUT, { recursive: true });
const file = path.join(OUT, `${sastDate(Date.parse(runAtUtc))}.jsonl`);
const metarUrl = `${AWC}?ids=${Object.keys(CITIES).join(',')}&format=json&hours=3`;

// getWithOneRetry does not throw; the catch is a second guard so one bad read can never
// cost the other seven their lines.
const settle = (p) => p.catch((e) => ({ atUtc: new Date().toISOString(), attempts: 0, error: String(e?.message || e) }));
const places = [...Object.values(CITIES), ...Object.values(SPOTS)];
const [version, m, ...reads] = await Promise.all([
  settle(getWithOneRetry(`${SITE}/api/version`)),
  settle(getWithOneRetry(metarUrl)),
  ...places.map((c) => settle(getWithOneRetry(`${SITE}/api/weather?lat=${c.lat}&lon=${c.lon}`))),
]);
const cityReads = reads.slice(0, Object.keys(CITIES).length);
const spotReads = reads.slice(Object.keys(CITIES).length);
const servedVersion = version.body?.version ?? version.body?.sha ?? null;
const reports = Array.isArray(m.body) ? m.body : [];

let okCount = 0; const wroteTo = new Set();
Object.entries(CITIES).forEach(([icao, c], k) => {
  const r = cityReads[k];
  const payload = pickPayload(r.body);
  if (r.status === 200 && payload?.ok !== false) okCount++;
  const line = {
    v: 1, runAtUtc, icao, city: c.name, lat: c.lat, lon: c.lon, servedVersion,
    api: {
      url: `${SITE}/api/weather?lat=${c.lat}&lon=${c.lon}`, atUtc: r.atUtc, status: r.status ?? null, ms: r.ms ?? null, attempts: r.attempts,
      error: r.error ?? null, firstError: r.firstError ?? null, apiError: r.body?.ok === false ? (r.body?.error ?? 'ok:false') : null,
      headers: r.headers ?? null, payload,
    },
    metar: { url: metarUrl, status: m.status ?? null, error: m.error ?? null, reports: reports.filter((x) => x.icaoId === icao) },
  };
  wroteTo.add(appendSafely(file, JSON.stringify(line) + '\n'));
});
Object.entries(SPOTS).forEach(([spot, c], k) => {
  const r = spotReads[k];
  const payload = pickPayload(r.body);
  if (r.status === 200 && payload?.ok !== false) okCount++;
  const line = {
    v: 1, runAtUtc, icao: null, spot, city: spot, lat: c.lat, lon: c.lon, servedVersion,
    api: {
      url: `${SITE}/api/weather?lat=${c.lat}&lon=${c.lon}`, atUtc: r.atUtc, status: r.status ?? null, ms: r.ms ?? null, attempts: r.attempts,
      error: r.error ?? null, firstError: r.firstError ?? null, apiError: r.body?.ok === false ? (r.body?.error ?? 'ok:false') : null,
      headers: r.headers ?? null, payload,
    },
    metar: null,
  };
  wroteTo.add(appendSafely(file, JSON.stringify(line) + '\n'));
});

appendSafely(path.join(OUT, 'recorder.log'),
  `${runAtUtc} version=${servedVersion ?? '?'} api_ok=${okCount}/${places.length} metar=${m.status ?? m.error} reports=${reports.length} -> ${[...wroteTo].map((f) => path.basename(f)).join(', ')}\n`);
process.stdout.write(`recorded ${okCount}/${places.length} API reads, ${reports.length} METAR reports -> ${[...wroteTo].join(', ')}\n`);
