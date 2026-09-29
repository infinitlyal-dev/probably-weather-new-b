// "NOW" FOLLOWS THE STATION (review/accuracy/stations/PLAN.md, EVAL §15, 29 Sept 2026). Al, Strand, 29 Sept 08:01:
// "the wind has been pumping all night and is pumping badly now as well ... showing clear is a lie." Where a live
// airport represents the place (api/_lib/station-map.js, generated from the history test), its latest METAR decides
// whether "now" is Windy and which wind and gust numbers show; everywhere else the answer is exactly today's.
//
// The feed: the Iowa Environmental Mesonet's current SA airport reports (public domain, commercial use allowed —
// mesonet.agron.iastate.edu/disclaimer.php). It answers in ~2 s, so a request never waits on it: the last good copy
// lives in Redis, and a request that finds it older than 5 min refreshes it in the background under a lock (one fetch
// per 5 min across all instances). A copy older than 30 min is not used. Any failure → null → today's answer.
import { waitUntil } from '@vercel/functions';
import { STATION_MAP } from './station-map.js';
import { getRedis } from './limiters.js';

export const STATION_FEED_URL = 'https://mesonet.agron.iastate.edu/api/1/currents.json?network=ZA__ASOS';
export const STATION_KEY = 'pw:stations:v1';
const LOCK_KEY = 'pw:stations:lock';
export const REFRESH_MS = 5 * 60e3;
export const MAX_FEED_AGE_MS = 30 * 60e3;
export const MAX_REPORT_AGE_H = 12;          // the carry-forward's longest look back (PLAN §3.3)
export const TOWN_KM = 5;                    // a place takes the station of the nearest listed town within this
export const PUMP_MEAN_KPH = 30, PUMP_GUST_KPH = 50;
// Fable (diff review): the gap is measured against the models' CURRENT numbers, which is what was scored only while
// the report is fresh (the history test's reports were ≤ ~1.5 h old). Airports that go quiet overnight (East London
// sends nothing 19Z–03Z) would carry an 18Z gap against models that have since forecast the drop — so the gap is
// carried at most 3 h (T = 3 tuned within a point of T = 12).
export const GAP_MAX_H = 3;
// A mistyped report never reaches the screen: a mean over 120 or a gust over 160 km/h is dropped.
export const MAX_MEAN_KPH = 120, MAX_GUST_KPH = 160;
const KT = 1.852, MPS = 3.6;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const round1 = (x) => Math.round(x * 10) / 10;

function km(aLat, aLon, bLat, bLon) {
  const R = Math.PI / 180, dLat = (bLat - aLat) * R, dLon = (bLon - aLon) * R;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * R) * Math.cos(bLat * R) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The wind group of a raw METAR → { meanKph, gustKph, dir } (dir null when variable/calm), or null. */
export function parseMetarWind(raw) {
  const m = /\s(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?(KT|MPS)\s/.exec(` ${String(raw ?? '')} `);
  if (!m) return null;
  const u = m[4] === 'KT' ? KT : MPS;
  const meanKph = round1(Number(m[2]) * u), gustKph = m[3] ? round1(Number(m[3]) * u) : null;
  if (meanKph > MAX_MEAN_KPH || (gustKph !== null && gustKph > MAX_GUST_KPH)) return null;
  return { meanKph, gustKph, dir: m[1] === 'VRB' ? null : Number(m[1]) };
}

/** IEM's currents JSON → { fetchedAt, reports: { ICAO: { obsUtc, meanKph, gustKph, dir, raw } } } for the live stations. */
export function parseFeed(json, fetchedAt) {
  const reports = {};
  for (const r of Array.isArray(json?.data) ? json.data : []) {
    if (!STATION_MAP.stations[r?.station]) continue;
    const t = Date.parse(r.utc_valid);
    const w = parseMetarWind(r.raw);
    if (!Number.isFinite(t) || !w) continue;
    reports[r.station] = { obsUtc: new Date(t).toISOString(), ...w, raw: String(r.raw) };
  }
  return { fetchedAt, reports };
}

let memo = null;   // { value, readAt } — one Redis read a minute per instance
export function _resetStationMemo() { memo = null; }

async function refresh(redis, fetchImpl, now) {
  try {
    if (redis) {
      const got = await redis.set(LOCK_KEY, String(now), { nx: true, ex: 30 });
      if (got !== 'OK' && got !== true) return;
    }
    const r = await fetchImpl(STATION_FEED_URL, { headers: { 'User-Agent': 'probablyweather.co.za (station now)' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return;
    const value = parseFeed(await r.json(), Date.now());
    if (!Object.keys(value.reports).length) return;
    memo = { value, readAt: Date.now() };
    if (redis) await redis.set(STATION_KEY, value, { ex: 3600 });
  } catch (e) {
    console.warn(`[stations] feed refresh failed: ${e?.message ?? e}`);
  }
}

/**
 * The latest station reports this request may use, or null. Never throws. It reads the stored copy; when that is older
 * than REFRESH_MS it starts a refresh (kept alive past the response) and waits for it at most `waitMs` — the caller
 * runs this beside the five-source fan-out, so the wait is normally hidden — then returns the freshest copy it has.
 */
export async function readStationObs({ redis = getRedis(), now = Date.now(), fetchImpl = fetch, schedule = waitUntil, waitMs = 1200 } = {}) {
  try {
    let value = memo && now - memo.readAt < 60e3 ? memo.value : null;
    if (!value && redis) {
      value = await redis.get(STATION_KEY);
      if (value && typeof value === 'string') value = JSON.parse(value);
      if (value) memo = { value, readAt: now };
    }
    if (!value && memo) value = memo.value;
    if (!value || !isNum(value.fetchedAt) || now - value.fetchedAt > REFRESH_MS) {
      const p = refresh(redis, fetchImpl, now);
      try { schedule(p); } catch { /* no platform keep-alive (tests, local) — the promise still runs */ }
      let timer;
      await Promise.race([p, new Promise((r) => { timer = setTimeout(r, waitMs); })]).finally(() => clearTimeout(timer));
      if (memo?.value && (!value || memo.value.fetchedAt > (value.fetchedAt ?? 0))) value = memo.value;
    }
    return value && isNum(value.fetchedAt) && now - value.fetchedAt <= MAX_FEED_AGE_MS ? value : null;
  } catch (e) {
    console.warn(`[stations] read failed: ${e?.message ?? e}`);
    return null;
  }
}

/** The live station that represents this point (the weather cache cell's centre), or null. */
export function stationFor(lat, lon) {
  if (!isNum(lat) || !isNum(lon)) return null;
  let best = null;
  for (const [name, tLat, tLon, id] of STATION_MAP.towns) {
    const d = km(lat, lon, tLat, tLon);
    if (d <= TOWN_KM && (!best || d < best.d)) best = { d, town: name, id };
  }
  if (!best) return null;
  const s = STATION_MAP.stations[best.id];
  const dMax = Math.max(STATION_MAP.D.coast, STATION_MAP.D.inland);
  if (!s || km(lat, lon, s.lat, s.lon) > dMax) return null;
  return { id: best.id, town: best.town, ...s };
}

/**
 * The station's word on "now" at this place (PLAN §3.3, the rule its region passed), or null when no live station
 * represents it or its latest report is missing or older than 12 h.
 *   S  — the report is pumping (mean ≥ 30 or gust ≥ 50) and at most F hours old → Windy; the numbers are the report's.
 *   SC — S, or the station-minus-model gap (mean against the shown wind, gust against the hero's gust), fading to
 *        nothing over T hours, lifts the hero's numbers over the place's lines (only a positive gap can); the shown
 *        numbers carry the faded gap either way, never below 0.
 */
export function stationNow({ lat, lon, obs, nowMs = Date.now(), shownWindKph, heroWindKph, windLineKph, shownGustKph, heroGustKph, gustLineKph }) {
  const s = stationFor(lat, lon);
  const rep = s && obs?.reports?.[s.id];
  if (!rep) return null;
  const ageH = (nowMs - Date.parse(rep.obsUtc)) / 3600e3;
  if (!isNum(ageH) || ageH < -0.25 || ageH > MAX_REPORT_AGE_H) return null;
  const age = Math.max(0, ageH);
  const pumping = (isNum(rep.meanKph) && rep.meanKph >= PUMP_MEAN_KPH) || (isNum(rep.gustKph) && rep.gustKph >= PUMP_GUST_KPH);
  const byStation = pumping && age <= STATION_MAP.F;
  const base = { station: s.id, name: s.name, town: s.town, rule: s.rule, obsUtc: rep.obsUtc, ageH: round1(age), meanKph: rep.meanKph, gustKph: rep.gustKph, dir: rep.dir, pumping };
  if (s.rule === 'S' || !isNum(STATION_MAP.T)) {
    return { ...base, windy: byStation, fired: byStation ? 'station' : null,
      shownWindKph: byStation ? rep.meanKph : shownWindKph, shownGustKph: byStation ? rep.gustKph : shownGustKph };
  }
  const fade = age <= GAP_MAX_H ? Math.max(0, 1 - age / STATION_MAP.T) : 0;
  const gapMean = isNum(rep.meanKph) && isNum(shownWindKph) ? rep.meanKph - shownWindKph : null;
  const gapGust = isNum(rep.gustKph) && isNum(heroGustKph) ? rep.gustKph - heroGustKph : null;
  const up = (g) => (isNum(g) && g > 0 ? g * fade : 0);
  const raised = (isNum(heroWindKph) && isNum(windLineKph) && heroWindKph + up(gapMean) >= windLineKph)
    || (isNum(heroGustKph) && isNum(gustLineKph) && heroGustKph + up(gapGust) >= gustLineKph);
  const windy = byStation || raised;
  const numbers = s.numbers !== false;   // the region's shown-number check (make-map.mjs); false → the headline only
  if (!numbers) return { ...base, windy, fired: byStation ? 'station' : raised ? 'gap' : null, fade, shownWindKph, shownGustKph };
  const shownWind = byStation ? rep.meanKph : isNum(shownWindKph) ? round1(Math.max(0, shownWindKph + (gapMean ?? 0) * fade)) : shownWindKph;
  const shownGust = byStation ? rep.gustKph : isNum(shownGustKph) && isNum(gapGust) ? round1(Math.max(0, shownGustKph + gapGust * fade)) : shownGustKph;
  return { ...base, windy, fired: byStation ? 'station' : raised ? 'gap' : null, fade: Math.round(fade * 100) / 100,
    gapMeanKph: isNum(gapMean) ? round1(gapMean) : null, gapGustKph: isNum(gapGust) ? round1(gapGust) : null, shownWindKph: shownWind, shownGustKph: shownGust };
}
