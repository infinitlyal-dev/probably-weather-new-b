// Live guard (PLAN §5, report only): the recorder's served payloads since 25 Sept at the airports whose region ships
// (Cape Town, Gqeberha, Durban), against the next METAR after each reading — what the app said, and what the station
// layer would have said on that same payload with the reports the recorder had in hand (received before the reading).
//   node review/accuracy/stations/live-guard.mjs
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { stationNow, parseMetarWind } from '../../../api/_lib/station-now.js';
import { snapCoord } from '../../../api/_lib/weather-cache.js';

const LIVE = 'C:/Users/27741/OneDrive/Desktop/Probably weather new/probably-weather-new-c/review/accuracy/live';
const recs = readdirSync(LIVE).filter((f) => /^2026-09-\d\d\.jsonl$/.test(f)).sort()
  .flatMap((f) => readFileSync(path.join(LIVE, f), 'utf8').trim().split('\n').map((l) => { try { return JSON.parse(l); } catch { return null; } })).filter(Boolean);
const reports = new Map();   // icao → [{ t, receipt, raw }]
for (const r of recs) for (const m of r.metar?.reports ?? []) {
  const k = `${m.icaoId}|${m.reportTime}`;
  if (!reports.has(m.icaoId)) reports.set(m.icaoId, new Map());
  const cur = reports.get(m.icaoId).get(k);
  const rec = { t: Date.parse(m.reportTime), receipt: Date.parse(m.receiptTime), raw: m.rawOb };
  if (!cur || rec.receipt < cur.receipt) reports.get(m.icaoId).set(k, rec);
}
for (const [id, m] of reports) reports.set(id, [...m.values()].sort((a, b) => a.t - b.t));
const cls = (w) => (!w ? null : (w.meanKph >= 30 || (w.gustKph ?? 0) >= 50) ? 'pumping' : w.meanKph < 20 && (w.gustKph ?? 0) < 35 ? 'calm' : 'between');
const out = {};
for (const r of recs) {
  const id = r.icao, p = r.api?.payload, reps = reports.get(id);
  if (!['FACT', 'FAPE', 'FALE'].includes(id) || !p?.now || !p.meta?.wind || !reps) continue;   // meta.wind: payloads since 28 Sept (v5)
  const tau = Date.parse(r.runAtUtc);
  const truthRep = reps.find((x) => x.t > tau && x.t - tau <= 90 * 60e3);
  const truth = cls(truthRep && parseMetarWind(truthRep.raw));
  if (!truth) continue;
  const last = [...reps].reverse().find((x) => x.receipt <= tau);
  const w = p.meta?.wind;
  const obs = last ? { reports: { [id]: { obsUtc: new Date(last.t).toISOString(), ...parseMetarWind(last.raw) } } } : null;
  const word = w && stationNow({ lat: Number(snapCoord(r.lat)), lon: Number(snapCoord(r.lon)), obs, nowMs: tau,
    shownWindKph: w.kph, heroWindKph: w.heroKph, windLineKph: w.heroThresholdKph, shownGustKph: w.gust?.kph, heroGustKph: w.gust?.heroKph, gustLineKph: w.gust?.lineKph });
  const served = p.now.conditionKey === 'wind';
  const withStation = served || Boolean(word?.windy);
  const o = (out[id] ??= { readings: 0, covered: 0, pumping: 0, calm: 0, servedCaught: 0, stationCaught: 0, servedFalse: 0, stationFalse: 0, servedOffBy: 0, stationOffBy: 0, n: 0 });
  o.readings++; if (word) o.covered++;
  if (truth === 'pumping') { o.pumping++; if (served) o.servedCaught++; if (withStation) o.stationCaught++; }
  if (truth === 'calm') { o.calm++; if (served) o.servedFalse++; if (withStation) o.stationFalse++; }
  const tw = parseMetarWind(truthRep.raw).meanKph;
  o.servedOffBy += Math.abs(p.now.windKph - tw); o.stationOffBy += Math.abs((word?.shownWindKph ?? p.now.windKph) - tw); o.n++;
}
for (const [id, o] of Object.entries(out)) console.log(`${id}: ${o.readings} readings (${o.covered} with a station word); pumping next report ${o.pumping}: app Windy ${o.servedCaught}, with the station ${o.stationCaught}; calm ${o.calm}: app Windy ${o.servedFalse}, with the station ${o.stationFalse}; mean wind off by ${(o.servedOffBy / o.n).toFixed(1)} → ${(o.stationOffBy / o.n).toFixed(1)} km/h`);
