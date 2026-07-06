import { describe, expect, it } from 'vitest';
import { detectAdvectionFog, conditionKeyToVoteBucket } from '../api/weather.js';

// ---------------------------------------------------------------------------
// Layer A — visibility-aware advection-fog detector (2026-05-21, Bug 1).
//
// Bug: on 2026-05-21 Al stood in real fog in Somerset West while the app's
// home screen read "Clear skies". The five model sources all reported clear —
// coastal advection fog out-ran the numerical models, and PW fetched no
// visibility data at all. detectAdvectionFog() closes that blind spot by
// reading Open-Meteo's free hourly `visibility` + `dew_point_2m`.
//
// Adversarial-review requirement: low visibility ALONE is not fog (rain, haze
// and smoke also drop visibility), so the detector must NOT fire on a rainy
// day. The three core cases below lock that in.
// ---------------------------------------------------------------------------

// Build a 48-slot Open-Meteo hourly object where every hour holds the same
// values, then optionally override specific hours. Mirrors the shape of
// hourlies[0] in api/weather.js (visibility/humidity/temps/dewPoints/rains/
// precipMm).
function omHourly(base, overrides = {}) {
  const fill = (v) => Array.from({ length: 48 }, () => v);
  const h = {
    visibility: fill(base.visM),
    humidity:   fill(base.rh),
    temps:      fill(base.tempC),
    dewPoints:  fill(base.dewC),
    rains:      fill(base.precipProb),
    precipMm:   fill(base.precipMm),
  };
  for (const [hour, vals] of Object.entries(overrides)) {
    for (const [field, value] of Object.entries(vals)) {
      h[field][Number(hour)] = value;
    }
  }
  return h;
}

describe('detectAdvectionFog — the three core cases', () => {
  it('CASE 1 (fog day): Strand-style foggy evening — vis ~1km, RH 97%, no rain → fires', () => {
    // The 2026-05-21 21:00 SAST case from the diagnosis: visibility collapsed
    // to ~1km, air saturated, no precipitation.
    const h = omHourly({ visM: 1040, rh: 97, tempC: 15, dewC: 14.6, precipProb: 0, precipMm: 0 });
    const r = detectAdvectionFog(h, 21);
    expect(r.available).toBe(true);
    expect(r.currentFog).toBe(true);
    expect(r.visKm).toBe(1);
  });

  it('CASE 2 (clear Karoo noon): high vis, dry air → does NOT fire', () => {
    const h = omHourly({ visM: 30000, rh: 20, tempC: 32, dewC: 4, precipProb: 0, precipMm: 0 });
    const r = detectAdvectionFog(h, 12);
    expect(r.available).toBe(true);
    expect(r.currentFog).toBe(false);
    expect(r.trendFog).toBe(false);
  });

  it('CASE 3 (rainy Cape Town): saturated air but it is RAINING → does NOT fire (fog ≠ rain)', () => {
    // RH 97% and low visibility, but precipitation is present — this is rain,
    // not fog. The precip gate must veto the fog verdict.
    const h = omHourly({ visM: 2500, rh: 97, tempC: 12, dewC: 11.8, precipProb: 85, precipMm: 2.1 });
    const r = detectAdvectionFog(h, 9);
    expect(r.available).toBe(true);
    expect(r.currentFog).toBe(false);
  });
});

describe('detectAdvectionFog — trend detection', () => {
  it('clear now, fog forming 2 hours out → trendFog true, currentFog false', () => {
    const h = omHourly(
      { visM: 22000, rh: 68, tempC: 19, dewC: 9, precipProb: 0, precipMm: 0 },
      { 19: { visibility: 900, humidity: 97, temps: 14, dewPoints: 13.2, rains: 0 } },
    );
    const r = detectAdvectionFog(h, 17); // hour 17, fog at 19 (idx+2)
    expect(r.currentFog).toBe(false);
    expect(r.trendFog).toBe(true);
  });

  it('CALIBRATION (live, Somerset West 2026-05-21): real fog forecast at RH 92% must trend', () => {
    // Verified against live Open-Meteo: at 21:00 SAST visibility was 27km but
    // the model forecast it crashing to 0.3-1.0km within 1-2 hours, at RH ~92%.
    // The original rh>=95 trend gate silently missed this — the fix lowered it
    // to rh>=90 with a visibility-forecast-driven primary signal.
    const h = omHourly(
      { visM: 27100, rh: 90, tempC: 16, dewC: 14.5, precipProb: 0, precipMm: 0 },
      { 22: { visibility: 1000, humidity: 92, temps: 15, dewPoints: 13.7, rains: 0 } },
    );
    const r = detectAdvectionFog(h, 21);
    expect(r.currentFog).toBe(false);
    expect(r.trendFog).toBe(true);
  });

  it('high visibility forecast (>2km) does NOT trend even at high humidity', () => {
    const h = omHourly(
      { visM: 20000, rh: 70, tempC: 19, dewC: 12, precipProb: 0, precipMm: 0 },
      { 14: { visibility: 8000, humidity: 96, temps: 16, dewPoints: 15.5, rains: 0 } },
    );
    expect(detectAdvectionFog(h, 12).trendFog).toBe(false);
  });
});

describe('detectAdvectionFog — boundaries and edge cases', () => {
  // 2026-07-06 tightening: the current-fog visibility gate moved 5km → 1.5km.
  // 1-5km is the MIST band (industry convention: fog <1km, mist 1-5km) and
  // must not present as the fog condition — the old 4.9km-fires behaviour was
  // the light-mist false-positive class from the Strand field report.
  it('visibility 1.5km does NOT fire (strict < 1.5km — mist band starts here)', () => {
    const h = omHourly({ visM: 1500, rh: 97, tempC: 15, dewC: 14.5, precipProb: 0, precipMm: 0 });
    expect(detectAdvectionFog(h, 10).currentFog).toBe(false);
  });

  it('visibility 1.4km with saturated air DOES fire (fog-grade murk)', () => {
    const h = omHourly({ visM: 1400, rh: 95, tempC: 15, dewC: 13.5, precipProb: 0, precipMm: 0 });
    expect(detectAdvectionFog(h, 10).currentFog).toBe(true);
  });

  it('visibility 1450m fires — the gate compares RAW metres, not the 0.1-rounded visKm (Codex finding)', () => {
    // 1450m rounds to visKm 1.5; a rounded compare would wrongly miss it.
    const h = omHourly({ visM: 1450, rh: 95, tempC: 15, dewC: 14, precipProb: 0, precipMm: 0 });
    const r = detectAdvectionFog(h, 10);
    expect(r.visKm).toBe(1.5);
    expect(r.currentFog).toBe(true);
  });

  it('visibility 3km with saturated air does NOT fire — mist must fall through', () => {
    const h = omHourly({ visM: 3000, rh: 95, tempC: 15, dewC: 13.5, precipProb: 0, precipMm: 0 });
    expect(detectAdvectionFog(h, 10).currentFog).toBe(false);
  });

  it('humidity 89% (just below the 90% gate) does NOT fire', () => {
    const h = omHourly({ visM: 1000, rh: 89, tempC: 15, dewC: 14, precipProb: 0, precipMm: 0 });
    expect(detectAdvectionFog(h, 10).currentFog).toBe(false);
  });

  it('dew-point spread 2.5°C (air not saturated enough) does NOT fire', () => {
    const h = omHourly({ visM: 1000, rh: 92, tempC: 15, dewC: 12.5, precipProb: 0, precipMm: 0 });
    expect(detectAdvectionFog(h, 10).currentFog).toBe(false);
  });

  it('null Open-Meteo hourly → available false, no fog (Open-Meteo outage)', () => {
    const r = detectAdvectionFog(null, 12);
    expect(r.available).toBe(false);
    expect(r.currentFog).toBe(false);
    expect(r.trendFog).toBe(false);
  });

  it('missing visibility array → available false (partial data)', () => {
    const h = omHourly({ visM: 1000, rh: 97, tempC: 15, dewC: 14.5, precipProb: 0, precipMm: 0 });
    h.visibility = [];
    expect(detectAdvectionFog(h, 12).available).toBe(false);
  });

  it('out-of-bounds hour index → available false, no crash', () => {
    const h = omHourly({ visM: 1000, rh: 97, tempC: 15, dewC: 14.5, precipProb: 0, precipMm: 0 });
    expect(() => detectAdvectionFog(h, 999)).not.toThrow();
    expect(detectAdvectionFog(h, 999).available).toBe(false);
  });
});

describe('conditionKeyToVoteBucket — maps final condition to the vote space', () => {
  it('partly-cloudy collapses to the clear bucket (matches categorizeDesc)', () => {
    expect(conditionKeyToVoteBucket('partly-cloudy')).toBe('clear');
  });
  it('rain-possible maps to rain, thunder/hail map to storm', () => {
    expect(conditionKeyToVoteBucket('rain-possible')).toBe('rain');
    expect(conditionKeyToVoteBucket('thunder')).toBe('storm');
    expect(conditionKeyToVoteBucket('hail')).toBe('storm');
  });
  it('fog maps to fog; wind/heat/uv fall to clear', () => {
    expect(conditionKeyToVoteBucket('fog')).toBe('fog');
    expect(conditionKeyToVoteBucket('wind')).toBe('clear');
    expect(conditionKeyToVoteBucket('heat')).toBe('clear');
  });
});
