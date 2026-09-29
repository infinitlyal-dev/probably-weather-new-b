// PLAN §2 (+ §8 change 2): the town radius D, learned on March–June 2026 only. Every pair of SYNOP stations 2–40 km
// apart that passes exposure (both coastal or both inland), height (≤ 150 m coastal, ≤ 250 m inland) and the ridge test
// (no ground on the line more than 150 m above the higher end), counted both ways: over the on-the-hour reports both
// sent, when A is pumping, the share of those hours B is calm. D = the largest bin edge such that every bin up to it has
// ≥ 50 A-pumping hours, a share ≤ 10 % and a Wilson upper bound ≤ 15 %; none → 10 km.
//   node review/accuracy/stations/pairs.mjs   → stations/results-pairs.json
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSynop } from '../v7/synop7.mjs';
import { scoredStations } from './stations.mjs';
import { ensure, isCoastal, ridgeOnLine, groundAt, coastPoints, linePoints, kmBetween } from './geo.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const PUMP_GUST = 50, PUMP_MEAN = 30, CALM_MEAN = 20, CALM_GUST = 35;
export const isPumping = (o) => (o.gust != null && o.gust >= PUMP_GUST) || (o.mean != null && o.mean >= PUMP_MEAN);
export const isCalm = (o) => o.mean != null && o.mean < CALM_MEAN && (o.gust == null || o.gust < CALM_GUST);
export const HEIGHT = { coast: 150, inland: 250 }, RIDGE = 150;
const BINS = [[2, 10], [10, 15], [15, 20], [20, 25], [25, 30], [30, 40]];
const TUNE_END = Date.UTC(2026, 6, 1) - 2 * 3600e3;   // 1 July 00:00 SAST
const wilsonHi = (k, n) => { if (!n) return 1; const z = 1.96, p = k / n; return (p + z * z / (2 * n) + z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / (1 + z * z / n); };

/** Station elevation for the height test: the DEM's ground at its point (ISD elevations are sometimes the barometer's). */
export const heightOf = (p) => { const g = groundAt(p.lat, p.lon); return typeof g === 'number' ? Math.max(0, g) : p.elev; };

/** Does B pass A's exposure / height / ridge tests (tiles must be loaded)? */
export function geoPasses(a, b) {
  const ca = isCoastal(a.lat, a.lon), cb = isCoastal(b.lat, b.lon);
  if (ca === null || cb === null) return { ok: false, why: 'no terrain' };
  if (ca !== cb) return { ok: false, why: 'exposure', coastal: ca };
  const ha = heightOf(a), hb = heightOf(b);
  if (Math.abs(ha - hb) > (ca ? HEIGHT.coast : HEIGHT.inland)) return { ok: false, why: 'height', coastal: ca };
  const ridge = ridgeOnLine(a.lat, a.lon, b.lat, b.lon);
  if (ridge === null) return { ok: false, why: 'no terrain' };
  if (ridge > Math.max(ha, hb) + RIDGE) return { ok: false, why: 'ridge', coastal: ca, ridge };
  return { ok: true, coastal: ca };
}

if (process.argv[1] && process.argv[1].endsWith('pairs.mjs')) {
  const synop = loadSynop();
  const st = scoredStations(synop).filter((s) => s.kind === 'synop');
  const pts = [];
  for (const s of st) pts.push(...coastPoints(s.lat, s.lon));
  const pairs = [];
  for (let i = 0; i < st.length; i++) for (let j = i + 1; j < st.length; j++) {
    const d = kmBetween(st[i].lat, st[i].lon, st[j].lat, st[j].lon);
    if (d >= 2 && d <= 40) { pairs.push([st[i], st[j], d]); pts.push(...linePoints(st[i].lat, st[i].lon, st[j].lat, st[j].lon)); }
  }
  await ensure(pts);
  const cells = { coast: BINS.map(() => ({ pump: 0, calm: 0, pairs: new Set() })), inland: BINS.map(() => ({ pump: 0, calm: 0, pairs: new Set() })) };
  const pairList = [];
  for (const [a, b, d] of pairs) {
    const g = geoPasses(a, b);
    pairList.push({ a: a.id, b: b.id, km: Math.round(d * 10) / 10, ...g });
    if (!g.ok) continue;
    const bin = BINS.findIndex(([lo, hi]) => d >= lo && d < hi); if (bin < 0) continue;
    const cell = cells[g.coastal ? 'coast' : 'inland'][bin];
    const ma = synop.get(a.id), mb = synop.get(b.id);
    for (const [x, y] of [[ma, mb], [mb, ma]]) for (const [t, ra] of x) {
      if (t >= TUNE_END) continue;
      const rb = y.get(t); if (!rb) continue;
      if (!isPumping({ mean: ra.kph, gust: ra.gustKph })) continue;
      cell.pump++; if (isCalm({ mean: rb.kph, gust: rb.gustKph })) cell.calm++;
      cell.pairs.add(`${a.id}-${b.id}`);
    }
  }
  const out = { plan: 'review/accuracy/stations/PLAN.md §2, §8.2', period: '1 March → 30 June 2026 (SAST)', bins: {}, D: {}, pairs: pairList };
  for (const exp of ['coast', 'inland']) {
    out.bins[exp] = BINS.map(([lo, hi], i) => { const c = cells[exp][i]; return { km: `${lo}–${hi}`, pairs: c.pairs.size, aPumping: c.pump, bCalm: c.calm, share: c.pump ? Math.round((c.calm / c.pump) * 1000) / 1000 : null, wilsonHi: Math.round(wilsonHi(c.calm, c.pump) * 1000) / 1000 }; });
    let D = null;
    for (let i = 0; i < BINS.length; i++) { const b = out.bins[exp][i]; if (b.aPumping >= 50 && b.share <= 0.10 && b.wilsonHi <= 0.15) D = BINS[i][1]; else break; }
    out.D[exp] = D ?? 10;
    out.D[`${exp}Why`] = D ? 'every bin up to it passed' : 'no bin qualified from the first → 10 km default';
  }
  writeFileSync(path.join(here, 'results-pairs.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ bins: out.bins, D: out.D }, null, 1));
  const fails = {}; for (const p of pairList) fails[p.ok ? 'ok' : p.why] = (fails[p.ok ? 'ok' : p.why] ?? 0) + 1;
  console.log('pairs by geometry:', fails);
}
