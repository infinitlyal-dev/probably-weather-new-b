import { describe, expect, it } from 'vitest';
import { detectAdvectionFog } from '../api/weather.js';

// ---------------------------------------------------------------------------
// Second visibility signal — Tomorrow.io (2026-08-03, fog-incident-20260803).
//
// Incident: Al stood in thick fog in Strand at 16:29 SAST while the app read
// "Partly cloudy". Every source missed it, but the detector's blindness had a
// specific shape — it read visibility from Open-Meteo ALONE, and Open-Meteo's
// grid reported 35 300 m. That is the SECOND time OM has reported 35-44 km
// inside dense ground fog at this exact location (2026-06-01: 43.7 km).
//
// Fix under test: detectAdvectionFog takes the MINIMUM of every available
// visibility read. Thresholds are untouched — only the number they see.
//
// UNIT HAZARD, which is the whole reason these tests exist: Tomorrow.io
// publishes visibility in KILOMETRES, Open-Meteo in METRES. A missed conversion
// turns 0.8 km into 0.8 m (fires on everything) or 35 300 m into 35 300 km
// (fires on nothing). Both directions are locked below.
// ---------------------------------------------------------------------------

// Mirrors hourlies[0] in api/weather.js — Open-Meteo, visibility in METRES.
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
    for (const [field, value] of Object.entries(vals)) h[field][Number(hour)] = value;
  }
  return h;
}

// Mirrors hourlies[3] in api/weather.js — Tomorrow.io, visibility in KILOMETRES.
function tioHourly(visKm, overrides = {}) {
  const h = { visibilityKm: Array.from({ length: 48 }, () => visKm) };
  for (const [hour, value] of Object.entries(overrides)) h.visibilityKm[Number(hour)] = value;
  return h;
}

// Saturated air + no precipitation: every gate EXCEPT visibility is satisfied,
// so each case below isolates the visibility number and nothing else.
const FOGGY_AIR = { rh: 95, tempC: 15, dewC: 14.2, precipProb: 0, precipMm: 0 };

describe('second visibility signal — Tomorrow.io absent ⇒ Open-Meteo-only, unchanged', () => {
  it('third argument omitted entirely → identical result to the pre-change call', () => {
    const h = omHourly({ visM: 1040, ...FOGGY_AIR });
    const withoutArg = detectAdvectionFog(h, 21);
    expect(withoutArg.available).toBe(true);
    expect(withoutArg.currentFog).toBe(true);
    expect(withoutArg.visKm).toBe(1);
    expect(withoutArg.omVisM).toBe(1040);
    expect(withoutArg.tioVisM).toBe(null);
    expect(withoutArg.visSource).toBe('Open-Meteo');
  });

  it('explicit null / undefined / empty object all degrade to Open-Meteo-only', () => {
    const h = omHourly({ visM: 35300, ...FOGGY_AIR });
    for (const tio of [null, undefined, {}, { visibilityKm: [] }]) {
      const r = detectAdvectionFog(h, 16, tio);
      expect(r.visKm).toBe(35.3);
      expect(r.tioVisM).toBe(null);
      expect(r.currentFog).toBe(false);
    }
  });

  it('Tomorrow.io present but null AT THIS HOUR (pre-"now" slot) → Open-Meteo-only', () => {
    // Tomorrow.io starts at the current hour, so earlier slots are legitimately
    // null. A null must not poison the minimum or produce NaN.
    const h = omHourly({ visM: 900, ...FOGGY_AIR });
    const tio = tioHourly(null);
    const r = detectAdvectionFog(h, 8, tio);
    expect(r.tioVisM).toBe(null);
    expect(r.visKm).toBe(0.9);
    expect(Number.isNaN(r.visKm)).toBe(false);
    expect(r.currentFog).toBe(true);
  });

  it('non-numeric Tomorrow.io values (NaN, string, false, Infinity) are rejected, not coerced', () => {
    const h = omHourly({ visM: 20000, ...FOGGY_AIR });
    for (const junk of [NaN, '0.5', false, {}, Infinity, -Infinity]) {
      const r = detectAdvectionFog(h, 16, tioHourly(junk));
      expect(r.tioVisM).toBe(null);
      expect(r.visKm).toBe(20);
      expect(r.currentFog).toBe(false);
    }
  });

  it('REGRESSION (Codex adversarial review): negative sentinels must not force fog', () => {
    // isNum() accepts negatives. Before the guard, a provider "no data" sentinel
    // became the minimum and fired currentFog on EVERY request — a permanent
    // false positive. -1 / -999 / -9999 are all common encodings.
    const h = omHourly({ visM: 35000, ...FOGGY_AIR });
    for (const sentinel of [-1, -999, -9999, -0.1]) {
      const r = detectAdvectionFog(h, 16, tioHourly(sentinel));
      expect(r.tioVisM).toBe(null);
      expect(r.visSource).toBe('Open-Meteo');
      expect(r.visKm).toBe(35);
      expect(r.currentFog).toBe(false);
    }
  });

  it('a negative sentinel in the TREND window is rejected too', () => {
    const h = omHourly({ visM: 30000, rh: 95, tempC: 15, dewC: 14.2, precipProb: 0, precipMm: 0 });
    const r = detectAdvectionFog(h, 16, tioHourly(30, { 18: -999 }));
    expect(r.trendFog).toBe(false);
  });

  it('zero IS kept — 0.0 km is a real whiteout, and matches the Open-Meteo path', () => {
    const h = omHourly({ visM: 35000, ...FOGGY_AIR });
    const r = detectAdvectionFog(h, 16, tioHourly(0));
    expect(r.tioVisM).toBe(0);
    expect(r.visKm).toBe(0);
    expect(r.currentFog).toBe(true);
  });
});

describe("second visibility signal — today's miss shape", () => {
  it('TIO 0.8 km + OM 35 km → detector sees 800 m and fires (saturated air)', () => {
    // The shape the incident would have needed: OM blind at 35 km, a second
    // source seeing the real murk at 0.8 km.
    const h = omHourly({ visM: 35000, ...FOGGY_AIR });
    const r = detectAdvectionFog(h, 16, tioHourly(0.8));
    expect(r.omVisM).toBe(35000);
    expect(r.tioVisM).toBe(800);
    expect(r.visKm).toBe(0.8);
    expect(r.visSource).toBe('Tomorrow.io');
    expect(r.currentFog).toBe(true);
  });

  it('TIO 0.8 km + OM 35 km but DRY air → still does NOT fire (humidity gate intact)', () => {
    // Guards the scope boundary: the minimum feeds the same gates, it does not
    // bypass them. Low visibility alone has never been fog and still isn't.
    const h = omHourly({ visM: 35000, rh: 55, tempC: 24, dewC: 9, precipProb: 0, precipMm: 0 });
    const r = detectAdvectionFog(h, 16, tioHourly(0.8));
    expect(r.visKm).toBe(0.8);
    expect(r.currentFog).toBe(false);
  });

  it('TIO 0.8 km + OM 35 km but dew spread too wide → still does NOT fire', () => {
    const h = omHourly({ visM: 35000, rh: 95, tempC: 20, dewC: 14, precipProb: 0, precipMm: 0 });
    const r = detectAdvectionFog(h, 16, tioHourly(0.8));
    expect(r.visKm).toBe(0.8);
    expect(r.dewSpread).toBe(6);
    expect(r.currentFog).toBe(false);
  });

  it('TIO 0.8 km + OM 35 km but RAINING → still does NOT fire (precip gate intact)', () => {
    const h = omHourly({ visM: 35000, rh: 97, tempC: 12, dewC: 11.6, precipProb: 85, precipMm: 2.1 });
    const r = detectAdvectionFog(h, 16, tioHourly(0.8));
    expect(r.visKm).toBe(0.8);
    expect(r.currentFog).toBe(false);
  });
});

describe("second visibility signal — today's ACTUAL values must not false-positive", () => {
  it('TIO 14 km + OM 35.3 km → min 14 km, verdict none', () => {
    // Verbatim from review/fog-incident-20260803: Open-Meteo hourly visibility
    // 35 300 m at 16:00, Tomorrow.io realtime visibility 14 km, OM humidity 82%,
    // T 20.6 / dew 17.4 ⇒ spread 3.2. The fix must NOT invent fog from this.
    const h = omHourly({ visM: 35300, rh: 82, tempC: 20.6, dewC: 17.4, precipProb: 0, precipMm: 0 });
    const r = detectAdvectionFog(h, 16, tioHourly(14));
    expect(r.omVisM).toBe(35300);
    expect(r.tioVisM).toBe(14000);
    expect(r.visKm).toBe(14);
    expect(r.visSource).toBe('Tomorrow.io');
    expect(r.humidity).toBe(82);
    expect(r.dewSpread).toBe(3.2);
    expect(r.currentFog).toBe(false);
    expect(r.trendFog).toBe(false);
  });

  it('the incident payload, pre-fix, is reproduced when Tomorrow.io is absent', () => {
    // Locks the "before" state so the change in behaviour is visible in the suite.
    const h = omHourly({ visM: 35300, rh: 82, tempC: 20.6, dewC: 17.4, precipProb: 0, precipMm: 0 });
    const r = detectAdvectionFog(h, 16);
    expect(r.visKm).toBe(35.3);
    expect(r.humidity).toBe(82);
    expect(r.dewSpread).toBe(3.2);
    expect(r.currentFog).toBe(false);
  });
});

describe('second visibility signal — unit conversion is exact', () => {
  it('km → m conversion is exact across the range, including sub-kilometre', () => {
    const cases = [
      [0.2,   200],     // Masi calibration fixture
      [0.8,   800],     // today's miss shape
      [1,     1000],
      [1.5,   1500],    // exactly ON the gate — must be >= 1500, so NOT fog
      [1.45,  1450],    // the rounding trap called out in the detector comment
      [14,    14000],   // today's actual
      [35.3,  35300],
    ];
    for (const [km, expectedM] of cases) {
      const h = omHourly({ visM: 999999, ...FOGGY_AIR });
      const r = detectAdvectionFog(h, 16, tioHourly(km));
      expect(r.tioVisM).toBe(expectedM);
    }
  });

  it('1450 m (1.45 km) fires but 1500 m (1.5 km) does not — gate reads raw metres', () => {
    // The detector comment warns that 1450 m rounds to visKm 1.5 and would wrongly
    // miss a `visKm < 1.5` compare. Confirm the raw-metre gate survives the km path.
    const h = omHourly({ visM: 999999, ...FOGGY_AIR });
    expect(detectAdvectionFog(h, 16, tioHourly(1.45)).currentFog).toBe(true);
    expect(detectAdvectionFog(h, 16, tioHourly(1.5)).currentFog).toBe(false);
  });

  it('no unit mixing: TIO 35.3 (km) never beats OM 900 (m)', () => {
    // If km were compared against metres unconverted, 35.3 < 900 would make
    // Tomorrow.io the minimum and report 0.035 km. Lock that it cannot happen.
    const h = omHourly({ visM: 900, ...FOGGY_AIR });
    const r = detectAdvectionFog(h, 16, tioHourly(35.3));
    expect(r.visKm).toBe(0.9);
    expect(r.visSource).toBe('Open-Meteo');
  });

  it('minimum is taken per-hour, not once for the whole array', () => {
    // OM lower at the current hour, TIO lower two hours out.
    const h = omHourly({ visM: 30000, rh: 92, tempC: 15, dewC: 13.5, precipProb: 0, precipMm: 0 },
      { 16: { visibility: 25000 } });
    const tio = tioHourly(30, { 18: 0.5 });
    const r = detectAdvectionFog(h, 16, tio);
    expect(r.visKm).toBe(25);      // current hour: OM wins
    expect(r.currentFog).toBe(false);
    expect(r.trendFog).toBe(true); // hour 18 via Tomorrow.io's 500 m
  });
});
