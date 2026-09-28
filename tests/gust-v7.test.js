// v7 gusts (review/accuracy/v7/PLAN.md, EVAL §14, 28 Sept 2026): the hero's gust line per region, "enough sources at
// 25 km/h", and the per-station gust correction at the towns listed for it. The table is generated from the results
// (make-gust-table.mjs --check guards drift); these tests pin the mechanics and the table's shape.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { GUST_TABLE } from '../api/_lib/gust-table.js';
import { gustRuleAt, gustFactorAt, gustStationAt, sectorOf, GUST_LINE_TODAY, TOWN_KM } from '../api/_lib/gusts.js';
import { deriveCondition, applyVoteConsensus, WIND_NOW_GUST_KPH } from '../api/weather.js';

const res = JSON.parse(readFileSync(new URL('../review/accuracy/v7/results-score7.json', import.meta.url), 'utf8'));
const calm = { now: true, desc: 'Partly cloudy', rainChance: 0, precipMm: 0, rainVotes: 0, tempC: 18, feelsLikeC: 17, windKph: 18, windThresholdKph: 25,
  uvIndex: 2, cloudPct: 40, isDay: true, dailyHighC: 22, dailyLowC: 12, sourceDescs: ['Partly cloudy'] };

describe('the gust rung', () => {
  it('today: 55 km/h, and the constant agrees with gusts.js', () => {
    expect(GUST_LINE_TODAY).toBe(WIND_NOW_GUST_KPH);
    expect(deriveCondition({ ...calm, gustKph: 54 }).key).not.toBe('wind');
    expect(deriveCondition({ ...calm, gustKph: 55 })).toMatchObject({ key: 'wind', reason: 'gust-wind' });
  });
  it("a region's own gust line", () => {
    expect(deriveCondition({ ...calm, gustKph: 46, gustLineKph: 45 })).toMatchObject({ key: 'wind', reason: 'gust-wind' });
    expect(deriveCondition({ ...calm, gustKph: 44, gustLineKph: 45 }).key).not.toBe('wind');
  });
  it('"enough sources at 25": only where a region ships it', () => {
    expect(deriveCondition({ ...calm, windSourcesAt25: 3 }).key).not.toBe('wind');
    expect(deriveCondition({ ...calm, windSourcesAt25: 2, windSourcesMin: 2 })).toMatchObject({ key: 'wind', reason: 'sources-wind' });
    expect(deriveCondition({ ...calm, windSourcesAt25: 1, windSourcesMin: 2 }).key).not.toBe('wind');
  });
  it('the consensus: a source supports at 80 % of the gust line, after the station correction', () => {
    const norms = [{ windKph: 10, gustKph: 40 }, { windKph: 10, gustKph: 40 }, { windKph: 10, gustKph: null }];
    expect(applyVoteConsensus({ key: 'wind', reason: 'gust-wind', activeNorms: norms, sourceVotes: [] }).key).toBe('clear');   // 40 < 44
    expect(applyVoteConsensus({ key: 'wind', reason: 'gust-wind', activeNorms: norms, sourceVotes: [], gustFactor: 1.2 }).key).toBe('wind');   // 48 ≥ 44
    expect(applyVoteConsensus({ key: 'wind', reason: 'gust-wind', activeNorms: norms, sourceVotes: [], gustLineKph: 50 }).key).toBe('wind');   // 40 ≥ 40
  });
});

describe('gusts.js', () => {
  it('sectors of a FROM bearing', () => {
    expect([0, 22, 23, 90, 135, 180, 225, 270, 315, 337.5, 359, -45].map(sectorOf)).toEqual([0, 0, 1, 2, 3, 4, 5, 6, 7, 0, 0, 7]);
    expect(sectorOf(null)).toBe(null);
  });
  it('outside South Africa: today, no correction', () => {
    expect(gustRuleAt(51.5, -0.12)).toMatchObject({ gustLineKph: GUST_LINE_TODAY, sourcesAt25: 0, rule: 'today' });
    expect(gustFactorAt(51.5, -0.12, 135).factor).toBe(1);
  });
  it('no bearing: no correction even at a covered town', () => {
    for (const s of GUST_TABLE.stations) expect(gustFactorAt(s.towns[0].lat, s.towns[0].lon, null).factor).toBe(1);
  });
});

describe('the generated table matches the results', () => {
  it('regions ship only where the verdict says so, with a tested setting', () => {
    for (const [name, r] of Object.entries(GUST_TABLE.regions)) {
      expect(res.regions[name].verdict).toBe('ships');
      expect([40, 45, 50, 55, 60]).toContain(r.gustLineKph);
      expect([0, 2, 3]).toContain(r.sourcesAt25);
    }
    for (const [name, r] of Object.entries(res.regions)) if (name !== 'Strand zone' && r.verdict !== 'ships') expect(GUST_TABLE.regions[name]).toBeUndefined();
  });
  it('stations: passed §4, eight sectors inside the clamp, towns within 12 km of the station', () => {
    for (const s of GUST_TABLE.stations) {
      expect(res.corrections[s.id].ships).toBe(true);
      expect(s.sectors).toHaveLength(8);
      for (const f of s.sectors) { expect(f).toBeGreaterThanOrEqual(0.8); expect(f).toBeLessThanOrEqual(1.8); }
      expect(s.towns.length).toBeGreaterThan(0);
      for (const t of s.towns) {
        const d = 111.2 * Math.hypot(t.lat - s.lat, (t.lon - s.lon) * Math.cos((s.lat * Math.PI) / 180));
        expect(d, `${t.name} from ${s.id}`).toBeLessThanOrEqual(12);
        expect(gustStationAt(t.lat, t.lon)?.station.id).toBe(s.id);
      }
    }
    expect(TOWN_KM).toBe(5);
  });
});

// Al, Strand, 28 Sept 14:16 SAST: "it is pumping outside ... and our app is saying cloudy vibes". The recorder at
// 14:10 SAST: OM 12.8 (gust 36), WA 9.7, Pirate 30, MET 37, TI 18 → served 21.7 km/h, cloudy; 68911 at 12 UTC:
// 28 km/h from 140°, gust 59. The Strand zone's shipped rule ("two sources at 25+") calls it Windy; today's did not.
describe("Al's afternoon at Strand, replayed", () => {
  const STRAND = { lat: -34.1163, lon: 18.8362 };
  const sources = [{ windKph: 12.8, gustKph: 36 }, { windKph: 9.7, gustKph: 20 }, { windKph: 30, gustKph: 33 }, { windKph: 37, gustKph: null }, { windKph: 18, gustKph: null }];
  const at25 = sources.filter((s) => s.windKph >= 25).length;
  it('the Strand zone rule', () => {
    expect(gustRuleAt(STRAND.lat, STRAND.lon)).toMatchObject({ rule: GUST_TABLE.strandZone?.rule ?? 'today' });
  });
  it('Windy now; the sky before', () => {
    const r = gustRuleAt(STRAND.lat, STRAND.lon);
    const inputs = { ...calm, windKph: 21.7, gustKph: 36, cloudPct: 85, windSourcesAt25: at25 };
    expect(deriveCondition(inputs).key).not.toBe('wind');
    const now = deriveCondition({ ...inputs, gustLineKph: r.gustLineKph, windSourcesMin: r.sourcesAt25 });
    expect(now).toMatchObject({ key: 'wind', reason: 'sources-wind' });
    // and the consensus holds it: Pirate and MET each at 25+ support wind (mean ≥ 20 on the raw blend's line)
    expect(applyVoteConsensus({ ...now, activeNorms: sources, sourceVotes: [], gustLineKph: r.gustLineKph }).key).toBe('wind');
  });
});
