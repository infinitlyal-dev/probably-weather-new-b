import { describe, expect, it } from 'vitest';
import { WEATHER_COPY } from '../assets/weather-copy.js';

// ---------------------------------------------------------------------------
// Layer B — confidence-aware copy register (2026-05-21, Bug 1).
//
// When the API flags a verdict as low-confidence (fog trend incoming, or the
// sources disagree), getWittyLine() in app.js picks from
// WEATHER_COPY.witty_low_confidence instead of the normal witty bank. These
// tests lock the shape of that data so the picker never lands on an empty or
// malformed pool.
// ---------------------------------------------------------------------------

const LANGS = ['en', 'af', 'zu', 'xh', 'st'];

describe('witty_low_confidence — structure', () => {
  it('exists on WEATHER_COPY', () => {
    expect(WEATHER_COPY.witty_low_confidence).toBeTypeOf('object');
  });

  it('_meta flags zu/xh/st as requiring native review', () => {
    const meta = WEATHER_COPY.witty_low_confidence._meta;
    expect(meta).toBeTruthy();
    expect(meta.requires_native_review).toEqual(expect.arrayContaining(['zu', 'xh', 'st']));
  });
});

const conditionKeys = Object.keys(WEATHER_COPY.witty_low_confidence).filter(k => k !== '_meta');

describe('witty_low_confidence — every condition pool is well-formed', () => {
  it('covers the expected home-screen conditions', () => {
    // The conditions frequent enough to warrant a hedged register. thunder /
    // hail / uv intentionally omitted — getWittyLine falls back to witty.
    expect(conditionKeys.sort()).toEqual(
      ['clear', 'cloudy', 'cold', 'fog', 'heat', 'night', 'partly-cloudy', 'rain', 'rain-possible', 'storm', 'wind'].sort(),
    );
  });

  for (const cond of conditionKeys) {
    for (const lang of LANGS) {
      it(`${cond}/${lang}: 5-8 non-empty lines, no duplicates`, () => {
        const pool = WEATHER_COPY.witty_low_confidence[cond][lang];
        expect(Array.isArray(pool)).toBe(true);
        expect(pool.length).toBeGreaterThanOrEqual(5);
        expect(pool.length).toBeLessThanOrEqual(8);
        pool.forEach(line => {
          expect(typeof line).toBe('string');
          expect(line.trim().length).toBeGreaterThan(0);
        });
        expect(new Set(pool).size).toBe(pool.length); // no duplicate lines
      });
    }
  }
});

describe('witty_low_confidence — register parity with the normal witty bank', () => {
  it('every low-confidence condition also exists in the high-confidence bank', () => {
    // Guarantees getWittyLine can always fall back if confidence flips.
    for (const cond of conditionKeys) {
      expect(WEATHER_COPY.witty[cond], `witty.${cond} missing`).toBeTruthy();
    }
  });

  it('Afrikaans low-confidence lines use the in-character "Waarskynlik", never "Probably"', () => {
    for (const cond of conditionKeys) {
      for (const line of WEATHER_COPY.witty_low_confidence[cond].af) {
        expect(line).not.toMatch(/\bProbably\b/);
      }
    }
  });
});
