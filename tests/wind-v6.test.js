// Wind's own weights (review/accuracy/v6/PLAN.md, results v6-score.json, EVAL §13): where the pre-registered live
// test passed — the Eastern Cape only — the now-wind is each real source's own wind weighted by its record at the
// region's airport × k, and the hours (OM, WA, MET, TI) the same weights renormalised × k4. Everywhere else the v5
// rule stands unchanged; Strand keeps today's blend (its station said the live weights read far too high there).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { WIND_WEIGHTS } from '../api/_lib/wind-weights.js';
import { WIND_TABLE } from '../api/_lib/wind-table.js';
import { shapeWind, windLine } from '../api/_lib/wind.js';

const res = JSON.parse(readFileSync(new URL('../review/accuracy/v2/results/v6-score.json', import.meta.url), 'utf8'));
const GQEBERHA = { lat: -33.9849, lon: 25.6173 }, EAST_LONDON = { lat: -33.036, lon: 27.826 };
const CT_CITY = { lat: -33.9249, lon: 18.4241 }, STRAND = { lat: -34.1163, lon: 18.8362 }, JHB = { lat: -26.1392, lon: 28.246 }, LONDON = { lat: 51.5, lon: -0.12 };
const r1 = (x) => Math.round(x * 10) / 10;
const wmean = (v, w) => { let s = 0, ws = 0; v.forEach((x, i) => { if (Number.isFinite(x) && w[i] > 0) { s += x * w[i]; ws += w[i]; } }); return s / ws; };

describe('the weights are the ones that were tested', () => {
  it('only the regions whose decision was LW carry weights, unrefit from the results', () => {
    // v8 (review/accuracy/v8/PLAN.md §4): the Highveld's frozen v6 weights passed v6's bar on the recorder's extra days.
    const v8 = JSON.parse(readFileSync(new URL('../review/accuracy/v8/results-highveld.json', import.meta.url), 'utf8'));
    expect(v8.highveld.ships).toBe(true);
    const ships = [...Object.entries(res.decisions.regions).filter(([, d]) => d.rule === 'LW').map(([r]) => r), 'Highveld'].sort();
    expect(Object.keys(WIND_WEIGHTS.regions).sort()).toEqual(ships);
    expect(ships).toEqual(['Eastern Cape', 'Highveld']);
    for (const reg of ships) {
      expect(WIND_WEIGHTS.regions[reg].weights).toEqual(res.live.LW[reg].weights);
      expect(WIND_WEIGHTS.regions[reg].k).toBe(res.live.LW[reg].k.k);
      expect(WIND_WEIGHTS.regions[reg].k4).toBe(res.live.LW[reg].k4.k);
    }
    expect(WIND_WEIGHTS.hourlyFollows).toBe(res.decisions.hourlyFollowsLW);
    expect(res.decisions.strandZone).toBe('today');
  });
  it('every weight sits inside the clamp and k inside [0.7, 1.6] (Fable, plan review 2)', () => {
    for (const r of Object.values(WIND_WEIGHTS.regions)) {
      const s = r.weights.reduce((a, b) => a + b, 0);
      expect(s).toBeCloseTo(1, 3);
      for (const w of r.weights) { expect(w).toBeGreaterThanOrEqual(0.05 / 1.2); expect(w).toBeLessThanOrEqual(0.5); }
      for (const k of [r.k, r.k4]) { expect(k).toBeGreaterThanOrEqual(0.7); expect(k).toBeLessThanOrEqual(1.6); }
    }
  });
});

describe('the Eastern Cape: each source by its record', () => {
  const lw = WIND_WEIGHTS.regions['Eastern Cape'];
  const five = [10, 14, 30, 20, 8];
  it('now: the five in their slots, weighted, × k; the rule, ratio and weights are recorded', () => {
    for (const place of [GQEBERHA, EAST_LONDON]) {
      const out = shapeWind({ raw: 15.3, values: five, slots: five, kind: 'now', ...place, month: 9, hour: 14 });
      expect(out).toMatchObject({ rule: 'LW', ratio: lw.k, region: 'Eastern Cape', rawKph: 15.3, weights: lw.weights });
      expect(out.kph).toBe(r1(wmean(five, lw.weights) * lw.k));
    }
  });
  it('a source that did not answer: the others renormalise, slots keep their places', () => {
    const slots = [10, null, 30, 20, 8];
    const out = shapeWind({ raw: 15, values: [10, 30, 20, 8], slots, kind: 'now', ...GQEBERHA, month: 9, hour: 14 });
    expect(out.kph).toBe(r1(wmean(slots, lw.weights) * lw.k));
    expect(out.kph).not.toBe(r1(wmean([10, 30, 20, 8, null], lw.weights) * lw.k));   // a shifted slot would read this
  });
  it('an hour: OM, WA, MET, TI with the same weights renormalised × k4', () => {
    const four = [10, 14, 20, 8];
    const w4 = [0, 1, 3, 4].map((i) => lw.weights[i]);
    const out = shapeWind({ raw: 12, values: four, slots: four, kind: 'hour', ...GQEBERHA, month: 9, hour: 14 });
    expect(out).toMatchObject({ rule: 'LW', ratio: lw.k4, weights: w4 });
    expect(out.kph).toBe(r1(wmean(four, w4) * lw.k4));
  });
  it('the Windy line reads the weighted number at 27.5 and the consensus multiplies by k (Fable, plan review 7)', () => {
    const out = shapeWind({ raw: 15, values: five, slots: five, kind: 'now', ...GQEBERHA, month: 9, hour: 14 });
    expect(windLine(out)).toEqual({ kph: out.kph, thresholdKph: WIND_TABLE.headline.thresholdKph, sourceFactor: lw.k });
  });
  it('no slots (an old caller) → the v5 rule, never a silent zero', () => {
    const out = shapeWind({ raw: 15, values: five, ...GQEBERHA, month: 9, hour: 14 });
    expect(out.rule).toBe(WIND_TABLE.rule);
  });
});

describe('everywhere else: unchanged', () => {
  const five = [10, 14, 30, 20, 8];
  it('Cape Town city keeps the v5 table, Johannesburg takes the Highveld weights (v8); Strand and London keep today\'s blend', () => {
    const ct = shapeWind({ raw: 18, values: five, slots: five, kind: 'now', ...CT_CITY, month: 9, hour: 9 });
    expect(ct).toMatchObject({ rule: 'BC', region: 'Western Cape', kph: r1(18 * WIND_TABLE.ratios['Western Cape'].SON.morning) });
    expect(ct.weights).toBeUndefined();
    expect(shapeWind({ raw: 18, values: five, slots: five, kind: 'now', ...JHB, month: 9, hour: 9 })).toMatchObject({ rule: 'LW', region: 'Highveld' });
    expect(shapeWind({ raw: 19.2, values: five, slots: five, kind: 'now', ...STRAND, month: 9, hour: 9 })).toMatchObject({ rule: 'today', kph: 19.2 });
    expect(shapeWind({ raw: 6.1, values: five, slots: five, kind: 'now', ...LONDON, month: 9, hour: 9 })).toMatchObject({ rule: 'today', kph: 6.1 });
  });
});
