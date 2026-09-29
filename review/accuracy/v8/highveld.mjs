// v8 §4: the Highveld wind weights re-scored under v6's bar (PLAN §4 and §6 change 8). Committed before it is run.
//   node review/accuracy/v8/highveld.mjs   → v8/results-highveld.json + printed summary
// The rows are built exactly as review/accuracy/v6/score6.mjs builds them (copied lines, same order); the weights are
// v6's, frozen (v2/results/v6-score.json live.LW); the proof is every reading after v6's split at each airport, to the
// recorder's latest; "new days" = readings after v6's window end (28 Sept 11:10 UTC).
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isNum, mean, round, bootDiff, RESULTS } from '../v2/lib.mjs';
import { shapeWind } from '../../../api/_lib/wind.js';
import { WIND_TABLE } from '../../../api/_lib/wind-table.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const LIVE_DIR = 'C:/Users/27741/OneDrive/Desktop/Probably weather new/probably-weather-new-c/review/accuracy/live';
const V6 = JSON.parse(readFileSync(path.join(RESULTS, 'v6-score.json'), 'utf8'));
const SRC = ['Open-Meteo', 'WeatherAPI', 'Pirate Weather', 'MET Norway', 'Tomorrow.io'];
const H4 = [0, 1, 3, 4];
const T_WINDY = WIND_TABLE.headline.thresholdKph, BIG_GUST = 55;
const wavg = (vals, w) => { let s = 0, ws = 0; vals.forEach((v, i) => { if (isNum(v) && w[i] > 0) { s += v * w[i]; ws += w[i]; } }); return ws ? s / ws : null; };
const LIVE_REGIONS = { FACT: 'Western Cape', FAOR: 'Highveld', FALE: 'KZN coast', FAPE: 'Eastern Cape', FABL: 'Free State', FAGG: 'Garden Route' };
const COORD = { FACT: [-33.9648, 18.6017], FAOR: [-26.1392, 28.246], FALE: [-29.6144, 31.1197], FAPE: [-33.9849, 25.6173], FABL: [-29.0927, 26.3024], FAGG: [-34.0056, 22.3789] };
const sastOf = (ms) => { const d = new Date(ms + 2 * 3600e3); return { day: d.toISOString().slice(0, 10), h: d.getUTCHours(), month: d.getUTCMonth() + 1 }; };
const V6_END = Date.parse(V6.live.window.to);
const out = { plan: 'review/accuracy/v8/PLAN.md §4, §6.8', frozenFrom: 'v2/results/v6-score.json live.LW', v6WindowEnd: V6.live.window.to };

// ---- rows: score6.mjs lines 34–66, unchanged ----
const recs = [];
for (const f of readdirSync(LIVE_DIR).filter((x) => x.endsWith('.jsonl')).sort()) for (const line of readFileSync(path.join(LIVE_DIR, f), 'utf8').trim().split('\n')) {
  let x; try { x = JSON.parse(line); } catch { continue; }
  const p = x.api?.payload; if (!p?.meta?.sourceNow) continue;
  const at = Date.parse(p.meta.updatedAtLabel || x.runAtUtc); if (!isNum(at)) continue;
  recs.push({ x, p, at });
}
out.window = { from: new Date(Math.min(...recs.map((r) => r.at))).toISOString(), to: new Date(Math.max(...recs.map((r) => Date.parse(r.x.runAtUtc)))).toISOString() };
function srcVals(p) { const by = Object.fromEntries(p.meta.sourceNow.map((s) => [s.name, s])); return { w: SRC.map((n) => (isNum(by[n]?.windKph) ? by[n].windKph : null)), g: SRC.map((n) => (isNum(by[n]?.gustKph) ? by[n].gustKph : null)) }; }
const rawOf = (p) => (isNum(p.meta.wind?.rawKph) ? p.meta.wind.rawKph : p.now.windKph);
const hourlyWOf = (p) => { const w = SRC.map((n) => p.meta.sourceWeights?.[n] ?? null); return H4.map((i) => w[i]); };
const airport = [];
{
  const seen = new Set();
  for (const { x, p, at } of recs) {
    if (!x.icao || !LIVE_REGIONS[x.icao]) continue;
    const key = `${x.icao}|${new Date(at).toISOString()}`; if (seen.has(key)) continue;
    const rep = (x.metar?.reports || []).map((m) => ({ m, d: Math.abs((m.obsTime ?? 0) * 1000 - at) })).filter((y) => y.d <= 40 * 60e3).sort((a, b) => a.d - b.d)[0]?.m;
    if (!rep || !isNum(rep.wspd)) continue;
    seen.add(key);
    const s = sastOf(at), { w, g } = srcVals(p), [lat, lon] = COORD[x.icao];
    const bc = shapeWind({ raw: rawOf(p), values: w, lat, lon, month: s.month, hour: s.h });
    const h4w = hourlyWOf(p);
    const bc4raw = wavg(H4.map((i) => w[i]), h4w);
    airport.push({ icao: x.icao, region: LIVE_REGIONS[x.icao], at, day: s.day, h: s.h, block6: `${x.icao}|${Math.floor(at / 6 / 3600e3)}`, blockDay: `${x.icao}|${s.day}`,
      obs: rep.wspd * 1.852, obsGust: isNum(rep.wgst) ? rep.wgst * 1.852 : null, w, g, n: w.filter(isNum).length,
      BC: bc.kph, bcRatio: bc.ratio, BC4: isNum(bc4raw) ? bc4raw * bc.ratio : null });
  }
}
airport.sort((a, b) => a.at - b.at);

// ---- frozen weights, v6's split ----
const LW = V6.live.LW;
const split = Object.fromEntries(Object.entries(V6.live.n).map(([id, n]) => [id, n.split ? Date.parse(n.split) : null]));
const lwOf = (r) => { const m = LW[r.region]; const b = m ? wavg(r.w, m.weights) : null; return isNum(b) ? b * m.k.k : null; };
const lw4Of = (r) => { const m = LW[r.region]; const b = m ? wavg(H4.map((i) => r.w[i]), H4.map((i) => m.weights[i])) : null; return isNum(b) ? b * m.k4.k : null; };
const prove = airport.filter((r) => split[r.icao] && r.at >= split[r.icao]);
const mae = (L, f) => mean(L.map((r) => (isNum(f(r)) ? Math.abs(f(r) - r.obs) : null)));
const boot = (L, fa, fb) => bootDiff(L.map((r) => { const a = fa(r), b = fb(r); return isNum(a) && isNum(b) ? { day: r.blockDay, a: Math.abs(a - r.obs), b: Math.abs(b - r.obs) } : null; }).filter(Boolean), 1000, 7);

// ---- the bar (v6 minEvidence with §6.8's two-thirds block rule) ----
function minEvidence(L, fa, fb) {
  const d = mae(L, fa) - mae(L, fb);
  const blocks = [...new Set(L.map((r) => r.block6))].map((k) => { const B = L.filter((r) => r.block6 === k); return mae(B, fa) - mae(B, fb); }).filter(isNum);
  const better = blocks.filter((x) => x < 0).length, worse = blocks.filter((x) => x > 0).length;
  const full5 = L.filter((r) => r.n === 5).length;
  const needBetter = Math.max(4, Math.ceil((2 / 3) * blocks.length));
  return { n: L.length, maeBC: round(mae(L, fb), 3), maeLW: round(mae(L, fa), 3), diff: round(d, 3), blocks: blocks.length, better, needBetter, worse, full5,
    ships: d <= -1.0 && better >= needBetter && full5 >= 24, blocked: d >= 1.0 || worse > blocks.length / 2 };
}
function saidWindy(r, kph, factor, T) {
  const gmax = Math.max(...r.g.filter(isNum), -1);
  if (!((isNum(kph) && kph >= T) || gmax >= BIG_GUST)) return false;
  let support = 0; for (let i = 0; i < 5; i++) if ((isNum(r.w[i]) && r.w[i] * factor >= 0.8 * T) || (isNum(r.g[i]) && r.g[i] >= 0.8 * BIG_GUST)) support++;
  return support >= 2;
}
const truthWindy = (r) => r.obs >= 30 || (isNum(r.obsGust) && r.obsGust >= BIG_GUST);
const calm = (r) => r.obs < 22 && !(isNum(r.obsGust) && r.obsGust >= 44);
function windy(L, reg) {
  const bcSaid = (r) => saidWindy(r, r.BC, r.bcRatio, T_WINDY), lwSaid = (r) => saidWindy(r, lwOf(r), LW[reg].k.k, T_WINDY);
  const f = { windyHours: L.filter(truthWindy).length, calmHours: L.filter(calm).length, caughtBC: L.filter((r) => truthWindy(r) && bcSaid(r)).length, caughtLW: L.filter((r) => truthWindy(r) && lwSaid(r)).length,
    falseBC: L.filter((r) => calm(r) && bcSaid(r)).length, falseLW: L.filter((r) => calm(r) && lwSaid(r)).length };
  f.blocksLW = f.falseLW > 2 * f.falseBC && f.falseLW - f.falseBC >= 3;
  return f;
}

out.pooled = { LW: { mae: round(mae(prove, lwOf), 3), bc: round(mae(prove, (r) => r.BC), 3), boot: boot(prove, lwOf, (r) => r.BC) },
  LW4: { mae: round(mae(prove, lw4Of), 3), bc4: round(mae(prove, (r) => r.BC4), 3), boot: boot(prove, lw4Of, (r) => r.BC4) } };
out.pooled.gate = isNum(out.pooled.LW.boot?.hi) && out.pooled.LW.boot.hi < 0;
const L = prove.filter((r) => r.icao === 'FAOR'), Lnew = L.filter((r) => r.at > V6_END);
out.highveld = {
  union: minEvidence(L, lwOf, (r) => r.BC),
  v6ProofOnly: minEvidence(L.filter((r) => r.at <= V6_END), lwOf, (r) => r.BC),
  newOnly: minEvidence(Lnew, lwOf, (r) => r.BC),
  lw4: { union: round(mae(L, lw4Of) - mae(L, (r) => r.BC4), 3), newOnly: round(mae(Lnew, lw4Of) - mae(Lnew, (r) => r.BC4), 3) },
  windy: windy(L, 'Highveld'),
  weights: LW.Highveld,
};
const H = out.highveld;
H.ships = H.union.ships && !H.union.blocked && out.pooled.gate && !H.windy.blocksLW && isNum(H.newOnly.diff) && H.newOnly.diff < 0;
H.why = H.ships ? 'passes: gain ≥ 1 km/h, ⅔ of blocks better, ≥ 24 full-five hours, pooled gate, Windy not doubled, new days better'
  : [!(H.union.diff <= -1) && 'gain under 1 km/h', !(H.union.better >= H.union.needBetter) && `better in ${H.union.better} of ${H.union.blocks} blocks (need ${H.union.needBetter})`,
    !(H.union.full5 >= 24) && `${H.union.full5} full-five hours (need 24)`, H.union.blocked && 'worse in more than half the blocks', !out.pooled.gate && 'pooled gate not met',
    H.windy.blocksLW && 'false Windy doubled', !(H.newOnly.diff < 0) && 'the new days alone are not better'].filter(Boolean).join('; ');
writeFileSync(path.join(here, 'results-highveld.json'), JSON.stringify(out, null, 1));
console.log(`window ${out.window.from} → ${out.window.to}; FAOR proof ${L.length} readings (${Lnew.length} new)`);
for (const k of ['union', 'v6ProofOnly', 'newOnly']) { const m = H[k]; console.log(`  ${k}: today ${m.maeBC} → weights ${m.maeLW} (${m.diff}); better ${m.better}/${m.blocks} (need ${m.needBetter}), worse ${m.worse}; full-five ${m.full5}`); }
console.log(`  pooled LW ${out.pooled.LW.bc} → ${out.pooled.LW.mae} [${out.pooled.LW.boot?.lo}, ${out.pooled.LW.boot?.hi}] gate ${out.pooled.gate}; LW4 union ${H.lw4.union}, new ${H.lw4.newOnly}`);
console.log(`  Windy: windy hours ${H.windy.windyHours} caught ${H.windy.caughtBC}→${H.windy.caughtLW}; calm ${H.windy.calmHours} false ${H.windy.falseBC}→${H.windy.falseLW}`);
console.log(`HIGHVELD: ${H.ships ? 'SHIPS' : 'does not ship'} — ${H.why}`);
