// Wind (review/accuracy/v5/PLAN.md, results/v5-score.json, EVAL §12): the now-wind and the hourly winds are today's
// weighted blend × the wind table's ratio (region × season × day-part) where that rule passed; today's blend
// everywhere else. The hero's Windy line reads the corrected number at the line chosen on 2025. Strand's own station
// (68911) found the rule too high there, so it is blocked within 15 km of it.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { WIND_TABLE } from '../api/_lib/wind-table.js';
import { shapeWind, windLine, windRegionAt, median, seasonOf, partOf, WIND_MEAN_KPH_TODAY } from '../api/_lib/wind.js';
import { deriveCondition, applyVoteConsensus } from '../api/weather.js';

const res = JSON.parse(readFileSync(new URL('../review/accuracy/v2/results/v5-score.json', import.meta.url), 'utf8'));
const dec = res.decisions;
const STRAND = { lat: -34.1163, lon: 18.8362 };          // the recorder's Strand spot
const CT_CITY = { lat: -33.9249, lon: 18.4241 };
const CT_AIRPORT = { lat: -33.9648, lon: 18.6017 };

describe('the table is the one that was tested', () => {
  it('rule, ratios, blocks and the Windy line come from the results, unrefit', () => {
    expect(WIND_TABLE.rule).toBe(dec.wind.ship);
    expect(WIND_TABLE.ratios).toEqual(dec.wind.ship === 'BC' ? res.tables.B : res.tables.M);
    const blocked = [...new Set([...(dec.wind[dec.wind.ship].blocked || []), ...(dec.wind[dec.wind.ship].liveSignBlocked || [])])].sort();
    expect(WIND_TABLE.blockedRegions).toEqual(blocked);
    expect(WIND_TABLE.strandBlocked).toBe(Boolean(dec.wind.strandBlocked));
    expect(WIND_TABLE.headline).toEqual({ ships: Boolean(dec.headline.ships), thresholdKph: dec.headline.T });
  });
  it('every ratio sits inside the display clamp [0.7, 1.6] (Fable, plan item 2)', () => {
    for (const reg of Object.values(WIND_TABLE.ratios)) for (const s of Object.values(reg)) for (const r of Object.values(s)) {
      expect(r).toBeGreaterThanOrEqual(0.7); expect(r).toBeLessThanOrEqual(1.6);
    }
  });
  it('the pass is the plan\'s: clearly better under all three guesses, the median alone failed', () => {
    expect(dec.wind[dec.wind.ship].passes).toBe(true);
    expect(dec.wind.M.passes).toBe(false);
    expect(dec.gust.ship).toBe(null);
    expect(dec.sky.S5.passes).toBe(false);
  });
});

describe('where the rule applies', () => {
  it('Cape Town (city and airport) take the Western Cape ratio; Strand keeps today\'s blend (68911)', () => {
    expect(windRegionAt(CT_CITY.lat, CT_CITY.lon)).toBe('Western Cape');
    expect(windRegionAt(CT_AIRPORT.lat, CT_AIRPORT.lon)).toBe('Western Cape');
    expect(windRegionAt(STRAND.lat, STRAND.lon)).toBe(WIND_TABLE.strandBlocked ? null : 'Western Cape');
    expect(windRegionAt(-34.08, 18.85)).toBe(WIND_TABLE.strandBlocked ? null : 'Western Cape');   // Somerset West coast, < 15 km
  });
  it('no table, a blocked region or outside South Africa → today\'s blend exactly', () => {
    expect(windRegionAt(-32.35, 22.55)).toBe(null);       // Beaufort West: Karoo, no airport learned there
    expect(windRegionAt(51.5, -0.12)).toBe(null);         // London
    for (const reg of WIND_TABLE.blockedRegions) expect(WIND_TABLE.regions).toContain(reg);
    const out = shapeWind({ raw: 19.2, values: [11, 10, 22, 39, 18], lat: 51.5, lon: -0.12, month: 9, hour: 9 });
    expect(out).toMatchObject({ kph: 19.2, rawKph: 19.2, rule: 'today', ratio: 1 });
    expect(windLine(out)).toEqual({ kph: 19.2, thresholdKph: WIND_MEAN_KPH_TODAY, sourceFactor: 1 });
  });
  it('the ratio is the cell for the region, season and day-part', () => {
    const r = WIND_TABLE.ratios['Western Cape'][seasonOf(9)][partOf(9)];
    const out = shapeWind({ raw: 20, values: [20, 20, 20, 20, 20], lat: CT_CITY.lat, lon: CT_CITY.lon, month: 9, hour: 9 });
    expect(out).toMatchObject({ rule: WIND_TABLE.rule, ratio: r, region: 'Western Cape', rawKph: 20, kph: Math.round(20 * r * 10) / 10 });
    expect(seasonOf(12)).toBe('DJF'); expect(seasonOf(3)).toBe('MAM'); expect(seasonOf(7)).toBe('JJA'); expect(seasonOf(10)).toBe('SON');
    expect([partOf(0), partOf(6), partOf(12), partOf(18), partOf(23)]).toEqual(['night', 'morning', 'afternoon', 'evening', 'evening']);
    expect(median([3, 1, 2])).toBe(2); expect(median([4, 1, 3, 2])).toBe(2.5); expect(median([null, 5])).toBe(5); expect(median([])).toBe(null);
  });
  it('every region the table covers has a finite ratio for every month and hour (a key mismatch would silently read 1) — Fable, diff review 5', () => {
    for (const [reg, seasons] of Object.entries(WIND_TABLE.ratios)) for (let m = 1; m <= 12; m++) for (let h = 0; h < 24; h++) {
      const r = seasons[seasonOf(m)]?.[partOf(h)];
      expect(Number.isFinite(r), `${reg} month ${m} hour ${h}`).toBe(true);
    }
    expect(Object.keys(WIND_TABLE.ratios).sort()).toEqual([...WIND_TABLE.regions].sort());
  });
  it('a missing raw blend never becomes a number', () => {
    expect(shapeWind({ raw: null, values: [], lat: CT_CITY.lat, lon: CT_CITY.lon, month: 9, hour: 9 }).kph).toBe(null);
  });
});

// This morning (28 Sept 2026, the recorder's 07:10 UTC readings = 09:10 SAST). Strand: OM 11.4, WA 10.4, Pirate 22.5,
// MET 39.2, TI 18.4 → served 19.2 km/h, gust 23; SAWS 68911 at 06 UTC: 28 km/h, gust 50. Cape Town city: OM 24.7
// (gust 69.1), WA 16.9, Pirate 22.5, MET 29.2 → served 23.4 km/h, already Windy by the gust.
const norm = (source, windKph, gustKph = null) => ({ source, windKph, gustKph });
const heroAt = (place, raw, sources, gust) => {
  const shaped = shapeWind({ raw, values: sources.map((s) => s.windKph), lat: place.lat, lon: place.lon, month: 9, hour: 9 });
  const line = windLine(shaped);
  const base = deriveCondition({ now: true, desc: 'Partly cloudy', rainChance: 0, precipMm: 0, rainVotes: 0, tempC: 16, feelsLikeC: 15, windKph: line.kph, windThresholdKph: line.thresholdKph,
    gustKph: gust, uvIndex: 2, cloudPct: 40, isDay: true, dailyHighC: 23, dailyLowC: 11, sourceDescs: sources.map(() => 'Partly cloudy') });
  const votes = sources.map((s) => ({ source: s.source, desc: 'Partly cloudy', vote: 'clear' }));
  return { shaped, line, ...applyVoteConsensus({ ...base, activeNorms: sources, sourceVotes: votes, windSourceFactor: line.sourceFactor, windThresholdKph: line.thresholdKph }) };
};
const strandSources = [norm('Open-Meteo', 11.4, 23), norm('WeatherAPI', 10.4, 15.3), norm('Pirate Weather', 22.5, 16.1), norm('MET Norway', 39.2), norm('Tomorrow.io', 18.4)];

describe('this morning, replayed on the shipped rule', () => {
  it('Strand: the rule is blocked there, so the app would still say 19 km/h and no Windy — said, not hidden', () => {
    const h = heroAt(STRAND, 19.2, strandSources, 23);
    if (WIND_TABLE.strandBlocked) {
      expect(h.shaped.kph).toBe(19.2);
      expect(h.key).not.toBe('wind');
    }
  });
  it('the same five winds in Cape Town (not near Strand\'s station) read higher and the hero says Windy', () => {
    const h = heroAt(CT_CITY, 19.2, strandSources, 23);
    expect(h.shaped.kph).toBeGreaterThan(19.2);
    if (h.shaped.kph >= WIND_TABLE.headline.thresholdKph) expect(h.key).toBe('wind');
  });
  it('the consensus scales each source by the same ratio and checks it against 80 % of the line', () => {
    const cons = applyVoteConsensus({ key: 'wind', reason: 'sustained-wind', activeNorms: [norm('A', 20), norm('B', 20), norm('C', 5)], sourceVotes: [],
      windSourceFactor: 1.2, windThresholdKph: 27.5 });
    expect(cons.key).toBe('wind');                          // 20 × 1.2 = 24 ≥ 22
    const off = applyVoteConsensus({ key: 'wind', reason: 'sustained-wind', activeNorms: [norm('A', 20), norm('B', 20), norm('C', 5)], sourceVotes: [],
      windSourceFactor: 1, windThresholdKph: 27.5 });
    expect(off.key).toBe('clear');                          // 20 < 22
    const today = applyVoteConsensus({ key: 'wind', reason: 'sustained-wind', activeNorms: [norm('A', 20), norm('B', 20), norm('C', 5)], sourceVotes: [] });
    expect(today.key).toBe('wind');                         // today's defaults: 20 ≥ 20
  });
  it('without a threshold the ladder keeps today\'s 25 (payloads cached before this release re-derive the same)', () => {
    const base = { now: true, desc: 'Clear sky', rainChance: 0, precipMm: 0, rainVotes: 0, tempC: 18, feelsLikeC: 18, uvIndex: 2, cloudPct: 10, isDay: true, dailyHighC: 22, dailyLowC: 12, sourceDescs: [] };
    expect(deriveCondition({ ...base, windKph: 26 }).key).toBe('wind');
    expect(deriveCondition({ ...base, windKph: 26, windThresholdKph: 27.5 }).key).not.toBe('wind');
    expect(deriveCondition({ ...base, windKph: 28, windThresholdKph: 27.5 }).key).toBe('wind');
  });
});
