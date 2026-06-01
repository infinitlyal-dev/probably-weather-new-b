// Fog bug fix (2026-06-01) — humidity-corroborated single-source fog.
//
// Two production failures (live /api/weather pulls, ~06:00 SAST 2026-06-01):
//   · STRAND foggy on the ground but rendered "cloudy" — only Open-Meteo feeds
//     the visibility detector, and OM's global grid mis-forecast Strand's
//     visibility (43.7km in dense fog), so Pirate's lone "Fog" vote had no path.
//   · STELLENBOSCH (not foggy) rendered "clear" — two real "Fog" votes were
//     discarded by majority-override-clear, whose vote count omitted 'fog'.
//
// CHANGE 1 (countsAsWeatherVote): a 'fog' vote counts as real weather, so it can
//   never be flipped to clear. Pure bug fix, no thresholds.
// CHANGE 2 (corroboratedFogUpgrade): a fog VOTE is required (humidity alone never
//   fogs); consensus humidity+wind decide whether one/low-count fog vote is
//   believable. Thresholds calibrated to the four live fixtures below.

import { describe, expect, it } from 'vitest';
import {
  countsAsWeatherVote,
  corroboratedFogUpgrade,
  FOG_VOTE_MIN_HUMIDITY,
  FOG_VOTE_MAX_WIND_KPH,
  detectAdvectionFog,
} from '../api/weather.js';

describe('CHANGE 1 — fog votes count as real weather (block majority-override-clear)', () => {
  it("'fog' now counts as a weather vote", () => {
    expect(countsAsWeatherVote('fog')).toBe(true);
  });
  it('rain/cloudy/storm still count; clear does not', () => {
    expect(countsAsWeatherVote('rain')).toBe(true);
    expect(countsAsWeatherVote('cloudy')).toBe(true);
    expect(countsAsWeatherVote('storm')).toBe(true);
    expect(countsAsWeatherVote('clear')).toBe(false);
  });
  it('STELLENBOSCH: 2 fog votes register as ≥2 weather votes → override-to-clear does NOT fire', () => {
    const votes = ['fog', 'fog', 'clear', 'clear', 'clear'];
    const weatherVotes = votes.filter(countsAsWeatherVote).length;
    // majority-override-clear flips to clear only when weatherVotes < 2.
    expect(weatherVotes).toBeGreaterThanOrEqual(2);
  });
});

describe('CHANGE 2 — corroborated fog: thresholds separate the live fixtures', () => {
  it('humidity threshold sits between Stellenbosch (66) and Strand (80.4)', () => {
    expect(FOG_VOTE_MIN_HUMIDITY).toBeGreaterThan(66);
    expect(FOG_VOTE_MIN_HUMIDITY).toBeLessThanOrEqual(80.4);
  });
  it('wind threshold admits Strand (4.4 km/h)', () => {
    expect(FOG_VOTE_MAX_WIND_KPH).toBeGreaterThanOrEqual(4.4);
  });

  // ---- the four authoritative live fixtures ----
  it('STRAND: cloudy, 1 fog vote, humidity 80.4%, wind 4.4 km/h → fog', () => {
    expect(corroboratedFogUpgrade({ conditionKey: 'cloudy', fogVoteCount: 1, humidity: 80.4, windKph: 4.4 })).toBe(true);
  });
  it('STELLENBOSCH: cloudy, 2 fog votes, humidity 66% → NOT fog (corroboration fails)', () => {
    expect(corroboratedFogUpgrade({ conditionKey: 'cloudy', fogVoteCount: 2, humidity: 66, windKph: 5 })).toBe(false);
  });
  it('SYNTHETIC GUARD: clear coastal morning, humidity 85%, ZERO fog votes → NOT fog', () => {
    expect(corroboratedFogUpgrade({ conditionKey: 'clear', fogVoteCount: 0, humidity: 85, windKph: 2 })).toBe(false);
  });

  // ---- guard rails the architect asked codex to attack ----
  it('humidity alone never fogs — 100% RH, dead calm, but zero votes', () => {
    expect(corroboratedFogUpgrade({ conditionKey: 'clear', fogVoteCount: 0, humidity: 100, windKph: 0 })).toBe(false);
  });
  it('high wind disperses fog — fog vote + saturated air but 30 km/h → NOT fog', () => {
    expect(corroboratedFogUpgrade({ conditionKey: 'cloudy', fogVoteCount: 1, humidity: 95, windKph: 30 })).toBe(false);
  });
  it('does not upgrade rain/storm to fog (only clear/partly-cloudy/cloudy)', () => {
    expect(corroboratedFogUpgrade({ conditionKey: 'rain-possible', fogVoteCount: 2, humidity: 95, windKph: 1 })).toBe(false);
    expect(corroboratedFogUpgrade({ conditionKey: 'storm', fogVoteCount: 2, humidity: 95, windKph: 1 })).toBe(false);
    expect(corroboratedFogUpgrade({ conditionKey: 'fog', fogVoteCount: 2, humidity: 95, windKph: 1 })).toBe(false); // already fog
  });
  it('missing humidity/wind data → no upgrade (cannot corroborate)', () => {
    expect(corroboratedFogUpgrade({ conditionKey: 'cloudy', fogVoteCount: 1, humidity: null, windKph: 4 })).toBe(false);
    expect(corroboratedFogUpgrade({ conditionKey: 'cloudy', fogVoteCount: 1, humidity: 85, windKph: null })).toBe(false);
  });
});

describe('MASIPHUMELELE — detector path unchanged (fog via visibility, not vote)', () => {
  it('detector still fires for dense ground fog (visKm 0.2, hum 93, dewSpread 1.1)', () => {
    const idx = 6;
    const mk = (val) => { const a = new Array(12).fill(null); a[idx] = val; return a; };
    const h = {
      visibility: mk(200),   // 0.2 km, in metres
      humidity:   mk(93),
      temps:      mk(12.1),
      dewPoints:  mk(11.0),  // dewSpread = 1.1
      rains:      mk(0),
      precipMm:   mk(0),
    };
    const r = detectAdvectionFog(h, idx);
    expect(r.currentFog).toBe(true);
    expect(r.visKm).toBe(0.2);
  });
});
