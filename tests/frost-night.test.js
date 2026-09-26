// Frost nights (review/accuracy/v4/PLAN.md §4, results/v4-frost.json): on a night Open-Meteo forecasts clear and
// calm, in the regions where it was proven and 500 m up, the day's low moves toward the coldest of the five models
// by k × the gap (at most 5 °C). Anything missing leaves the low exactly as it was.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { frostNightLow, frostNightHours, FROST_REGIONS, FROST_K, FROST_MAX_CLOUD, FROST_MAX_WIND, FROST_MAX_DELTA, FROST_MIN_ELEVATION, FROST_BLOCKED_CELLS } from '../api/_lib/frost.js';
import { stationCellOf, regionOf } from '../api/_lib/regions.js';
import { PRECISION_MODELS } from '../api/_lib/precision.js';

const res = JSON.parse(readFileSync(new URL('../review/accuracy/v2/results/v4-frost.json', import.meta.url), 'utf8'));
const fill = (n, v) => Array.from({ length: n }, () => v);
// 48 hourly values from local midnight today; the models' coldest hour sits at 05:00 each day
const temps = (low) => Array.from({ length: 72 }, (_, h) => (h % 24 === 5 ? low : low + 8));
const models = (lows) => Object.fromEntries(PRECISION_MODELS.map((m, i) => [`temperature_2m_${m}`, temps(lows[i])]));
const night = (over = {}) => ({ day: 0, lowC: 4, region: 'Free State', elevation: 1350, clouds: fill(48, 10), winds: fill(48, 6),
  bestMatch: temps(3), models: models([2, 1, 0, 3]), modelNames: PRECISION_MODELS, ...over });

describe('the rule is the one that was tested', () => {
  it('gate, k and cap are the chosen cell (spread form, cloud ≤ 40 %, wind ≤ 12 km/h, k from 2025)', () => {
    expect(res.chosen).toMatchObject({ form: 'spread', C: FROST_MAX_CLOUD, W: FROST_MAX_WIND });
    expect(FROST_K[0]).toBeCloseTo(res.leads.t0.kAll, 2);
    expect(FROST_K[1]).toBeCloseTo(res.leads.t1.kAll, 2);
    expect(FROST_MAX_DELTA).toBe(5);
    expect(FROST_MIN_ELEVATION).toBe(500);
  });
  it('ships only where the test said so: passed, and the regions neither guard blocked', () => {
    expect(res.ships).toBe(true);
    expect([...FROST_REGIONS].sort()).toEqual([...res.shipsIn].sort());
    for (const g of [...res.trainBlocked, ...res.testBlocked]) expect(FROST_REGIONS).not.toContain(g);
    expect(FROST_REGIONS).not.toContain('Lowveld');
  });
  it('the station cells wholly worse on 2026 are blocked (Johannesburg airport, Beaufort West — added after the test, only removes the change)', () => {
    expect([...FROST_BLOCKED_CELLS].sort()).toEqual([...res.stationsBlocked].sort());
    expect(FROST_BLOCKED_CELLS).toContain('FAOR');
    expect(stationCellOf(-26.13, 28.24)).toBe('FAOR');     // Johannesburg
    expect(stationCellOf(-26.20, 28.05)).toBe('FAOR');     // Johannesburg CBD
    expect(stationCellOf(-25.75, 28.19)).toBe('FAWB');     // Pretoria keeps it
    expect(regionOf(-25.75, 28.19)).toBe('Highveld');
  });
});

describe('frostNightLow', () => {
  it('a clear, calm night lowers the low by k × (low − coldest model)', () => {
    const r = frostNightLow(night());
    expect(r.applied).toBe(true);
    expect(r.coldest).toBe(0);
    expect(r.deltaC).toBeCloseTo(FROST_K[0] * 4, 1);
    expect(r.lowC).toBeCloseTo(4 - FROST_K[0] * 4, 1);
  });
  it('tomorrow uses k for day 1 and the night from 20:00 today', () => {
    expect(frostNightHours(1)).toEqual([20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32]);
    const r = frostNightLow(night({ day: 1 }));
    expect(r.deltaC).toBeCloseTo(FROST_K[1] * 4, 1);
  });
  it('the step is capped at 5 °C', () => {
    const r = frostNightLow(night({ lowC: 14 }));
    expect(r.deltaC).toBe(5);
    expect(r.lowC).toBe(9);
  });
  it('never raises the low: a coldest model warmer than the low changes nothing', () => {
    const r = frostNightLow(night({ lowC: -1 }));
    expect(r.applied).toBe(false);
    expect(r.lowC).toBe(-1);
  });
  it('cloudy or windy nights are left alone', () => {
    expect(frostNightLow(night({ clouds: fill(48, 60) })).applied).toBe(false);
    expect(frostNightLow(night({ winds: fill(48, 20) })).applied).toBe(false);
    expect(frostNightLow(night({ clouds: fill(48, 40), winds: fill(48, 12) })).applied).toBe(true);   // the edges are inside
  });
  it("Johannesburg's cell is left alone; Pretoria's, in the same region, gets the step", () => {
    expect(frostNightLow(night({ region: 'Highveld', cell: 'FAOR' }))).toMatchObject({ lowC: 4, applied: false, reason: 'cell' });
    expect(frostNightLow(night({ region: 'Highveld', cell: 'FAWB' })).applied).toBe(true);
  });
  it('day 1 reads its own night (20:00 today → 08:00 tomorrow) and its own model minimum (Fable, diff review 3)', () => {
    // cloudy all of today's small hours, clear only 20:00 → 08:00 tomorrow; the models' lows differ by day
    const clouds = Array.from({ length: 48 }, (_, h) => (h >= 20 && h <= 32 ? 5 : 90));
    const dayLows = (d0, d1) => Array.from({ length: 72 }, (_, h) => (h % 24 === 5 ? (h < 24 ? d0 : d1) : 12));
    const m = Object.fromEntries(PRECISION_MODELS.map((x) => [`temperature_2m_${x}`, dayLows(3, -2)]));
    const base = { lowC: 4, region: 'Free State', elevation: 1350, clouds, winds: fill(48, 6), bestMatch: dayLows(3, 1), models: m, modelNames: PRECISION_MODELS };
    expect(frostNightLow({ ...base, day: 0 })).toMatchObject({ applied: false, reason: 'not-clear-and-calm', lowC: 4 });
    const d1 = frostNightLow({ ...base, day: 1 });
    expect(d1).toMatchObject({ applied: true, coldest: -2 });
    expect(d1.deltaC).toBeCloseTo(FROST_K[1] * 6, 1);
  });
  it('a missing low outside its regions records "region", not "not-a-frost-day" (Fable, diff review 1)', () => {
    expect(frostNightLow(night({ region: 'Western Cape', lowC: null })).reason).toBe('region');
  });
  it('outside its regions, below 500 m, or past day 1 the low stands', () => {
    for (const region of ['North West', 'Eastern Cape', 'Lowveld', 'Western Cape', null]) expect(frostNightLow(night({ region })).lowC).toBe(4);
    expect(frostNightLow(night({ elevation: 499 })).lowC).toBe(4);
    expect(frostNightLow(night({ elevation: null })).lowC).toBe(4);
    expect(frostNightLow(night({ day: 2 })).lowC).toBe(4);
  });
  it('a missing model hour, missing cloud or wind hours, or no models at all leave the low exactly as it was', () => {
    const gap = models([2, 1, 0, 3]); gap[`temperature_2m_${PRECISION_MODELS[2]}`][5] = null;
    expect(frostNightLow(night({ models: gap })).lowC).toBe(4);
    expect(frostNightLow(night({ models: null })).lowC).toBe(4);
    expect(frostNightLow(night({ clouds: fill(48, null) })).lowC).toBe(4);
    expect(frostNightLow(night({ winds: [] })).lowC).toBe(4);
    expect(frostNightLow(night({ lowC: null })).applied).toBe(false);
  });
});

describe('the API', () => {
  it('applies the step after the precision mix and records it in meta.precision.frost', () => {
    const src = readFileSync(new URL('../api/weather.js', import.meta.url), 'utf8');
    expect(src).toMatch(/frostNightLow\(\{ day: i, lowC: mixed\.lowC/);
    expect(src).toMatch(/frost: frostLog/);
  });
});
