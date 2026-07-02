import { describe, expect, it } from 'vitest';
import { WEATHER_COPY } from '../assets/weather-copy.js';
import { WITTY_DAY_TAGS, dayTagAllows, dayAwarePool } from '../assets/witty-day-tags.js';

// ---------------------------------------------------------------------------
// Structural day-tagging (2026-07-02, H-1 + M-1). Replaces the old
// WEEKDAY_ONLY_FRAGMENTS substring blocklist. dayAwarePool() is the single
// enforcement point; these tests probe it across all 7 days × 5 languages.
// ---------------------------------------------------------------------------

const LANGS = ['en', 'af', 'zu', 'xh', 'st'];
const DAYS = [0, 1, 2, 3, 4, 5, 6];
const groups = { witty: WEATHER_COPY.witty, witty_low_confidence: WEATHER_COPY.witty_low_confidence };

describe('dayTagAllows — semantics', () => {
  it('weekday = Mon–Fri only', () => {
    expect(DAYS.map((d) => dayTagAllows('weekday', d, 12))).toEqual([false, true, true, true, true, true, false]);
  });
  it('weekend = Sat/Sun + Fri-evening', () => {
    expect(DAYS.map((d) => dayTagAllows('weekend', d, 12))).toEqual([true, false, false, false, false, false, true]);
    expect(dayTagAllows('weekend', 5, 17)).toBe(true); // Fri 17:00
    expect(dayTagAllows('weekend', 5, 10)).toBe(false); // Fri morning
  });
  it('day-named = that day only', () => {
    expect(DAYS.map((d) => dayTagAllows('tue', d, 12))).toEqual([false, false, true, false, false, false, false]);
    expect(DAYS.map((d) => dayTagAllows('sat', d, 12))).toEqual([false, false, false, false, false, false, true]);
    expect(DAYS.map((d) => dayTagAllows('mon', d, 12))).toEqual([false, true, false, false, false, false, false]);
  });
  it('absent tag = any day', () => {
    expect(DAYS.every((d) => dayTagAllows(undefined, d, 12))).toBe(true);
  });
});

describe('no day-named line can render on the wrong day (7 days × 5 langs)', () => {
  // For every day-specific tag, the tagged line at that index must be absent from
  // the pool on disallowed days and present on allowed days, in EVERY language.
  const dayTags = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  for (const [ns, binMap] of Object.entries(WITTY_DAY_TAGS)) {
    for (const [bin, tags] of Object.entries(binMap)) {
      for (const [idxStr, tag] of Object.entries(tags)) {
        if (!dayTags.includes(tag)) continue;
        const idx = Number(idxStr);
        for (const lang of LANGS) {
          const arr = groups[ns][bin][lang];
          const line = arr[idx];
          it(`${ns}.${bin}[${idx}] (${tag}) "${String(line).slice(0, 24)}" — ${lang}: only on its day`, () => {
            for (const day of DAYS) {
              const pool = dayAwarePool(tags, arr, day, 12);
              const present = pool.includes(line);
              // present iff the tag allows this day (fallback can't resurrect it
              // because other lines in the bin are always available)
              expect(present).toBe(dayTagAllows(tag, day, 12));
            }
          });
        }
      }
    }
  }
});

describe('braai plan is weekend-gated, imagery is any-day', () => {
  const pc = WEATHER_COPY.witty['partly-cloudy'];
  it('"Almost a braai day." (plan) absent on weekdays, present on weekend', () => {
    const line = pc.en[12];
    expect(dayAwarePool(WITTY_DAY_TAGS.witty['partly-cloudy'], pc.en, 2, 12).includes(line)).toBe(false); // Tue
    expect(dayAwarePool(WITTY_DAY_TAGS.witty['partly-cloudy'], pc.en, 6, 12).includes(line)).toBe(true);  // Sat
  });
  it('braai imagery ("The braai is cancelled.") shows any day', () => {
    const line = WEATHER_COPY.witty.storm.en[9];
    for (const day of DAYS) {
      expect(dayAwarePool(WITTY_DAY_TAGS.witty.storm, WEATHER_COPY.witty.storm.en, day, 12).includes(line)).toBe(true);
    }
  });
});

describe('every bin/lang/day yields a non-empty pool (never-empty fallback)', () => {
  for (const [ns, obj] of Object.entries(groups)) {
    for (const bin of Object.keys(obj)) {
      if (bin === '_meta') continue;
      const entry = obj[bin];
      if (!entry || !Array.isArray(entry.en)) continue;
      const tags = (WITTY_DAY_TAGS[ns] || {})[bin];
      for (const lang of LANGS) {
        for (const day of DAYS) {
          it(`${ns}.${bin}.${lang} day ${day} non-empty`, () => {
            const pool = dayAwarePool(tags, entry[lang], day, 12);
            expect(pool.length).toBeGreaterThanOrEqual(1);
            expect(pool.every((s) => typeof s === 'string' && s.trim() !== '')).toBe(true);
          });
        }
      }
    }
  }
});
