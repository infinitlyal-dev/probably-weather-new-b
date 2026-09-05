// Al's routing ruling, 2026-09-05 (review/ROUTING-CONFLICTS.md class A): the weekend bin is
// ADDITIVE on clear/heat, not a replacement. Before this, eligibleWittyPool returned the
// weekend pool alone on Sat/Sun/Fri-evening, so no clear or heat line could fire on a
// weekend in the condition bank — the surface that serves af/zu/xh/st in-app and every
// share card.
//
// Class B (night stays exclusive) and class C (the one weekday-slot weekend line stays
// weekend-gated) were ruled UNCHANGED, and are asserted here so a later edit cannot quietly
// widen this ruling into them.
import { describe, it, expect } from 'vitest';
import { WEATHER_COPY } from '../assets/weather-copy.js';
import { WITTY_DAY_TAGS, eligibleWittyPool, dayAwarePool } from '../assets/witty-day-tags.js';

const LANGS = ['en', 'af', 'zu', 'xh', 'st'];
const call = (condition, context, lang = 'en') => eligibleWittyPool({
  copy: WEATHER_COPY, tags: WITTY_DAY_TAGS, condition, lang, context,
});

describe('class A — weekend is additive on clear/heat', () => {
  // Sat=6, Sun=0, Fri(5) from 16:00 are the weekend contexts.
  const weekendContexts = [
    ['Saturday', { day: 6, hour: 12, month: 7 }],
    ['Sunday', { day: 0, hour: 12, month: 7 }],
    ['Friday 17:00', { day: 5, hour: 17, month: 7 }],
  ];

  for (const [label, context] of weekendContexts) {
    for (const condition of ['clear', 'heat']) {
      it(`${label}: ${condition} lines AND weekend lines are both eligible`, () => {
        const { pool, bin, mergedBins } = call(condition, context);
        const weekendAllowed = dayAwarePool(WITTY_DAY_TAGS.witty.weekend, WEATHER_COPY.witty.weekend.en, context);
        const conditionAllowed = dayAwarePool(WITTY_DAY_TAGS.witty[condition], WEATHER_COPY.witty[condition].en, context);

        expect(bin).toBe('weekend');
        expect(mergedBins).toEqual(['weekend', condition]);
        expect(pool.length).toBe(weekendAllowed.length + conditionAllowed.length);
        // The regression this ruling fixes: a condition line must be reachable on a weekend.
        expect(pool).toContain(conditionAllowed[0]);
        expect(pool).toContain(weekendAllowed[0]);
      });
    }
  }

  it('day-named weekend lines are still day-filtered inside the merged pool', () => {
    // weekend[19] is tagged 'sat' — present on Saturday, absent on Sunday, in every language.
    for (const lang of LANGS) {
      const line = WEATHER_COPY.witty.weekend[lang][19];
      expect(call('clear', { day: 6, hour: 12, month: 7 }, lang).pool).toContain(line);
      expect(call('clear', { day: 0, hour: 12, month: 7 }, lang).pool).not.toContain(line);
    }
  });

  it('weekdays are untouched — the weekend pool stays out of Tuesday', () => {
    const { pool, bin } = call('clear', { day: 2, hour: 12, month: 7 });
    expect(bin).toBe('clear');
    expect(pool).not.toContain(WEATHER_COPY.witty.weekend.en[0]);
  });

  it('conditions other than clear/heat never merge the weekend pool', () => {
    for (const condition of ['storm', 'rain', 'fog', 'cold']) {
      const { pool, bin } = call(condition, { day: 6, hour: 12, month: 7 });
      expect(bin).toBe(condition);
      expect(pool).not.toContain(WEATHER_COPY.witty.weekend.en[0]);
    }
  });

  it('merged pools are non-empty in all five languages, both conditions, both weekend days', () => {
    for (const lang of LANGS) {
      for (const condition of ['clear', 'heat']) {
        for (const day of [0, 6]) {
          const { pool } = call(condition, { day, hour: 12, month: 7 }, lang);
          expect(pool.length).toBeGreaterThan(0);
          expect(pool.every((s) => typeof s === 'string' && s.trim() !== '')).toBe(true);
        }
      }
    }
  });
});

describe('class B — night stays exclusive (ruled unchanged)', () => {
  it('the night bin does not merge the clear pool inside the night window', () => {
    const { pool, bin } = call('night', { day: 6, hour: 22, month: 7, fallbackCondition: 'clear' });
    expect(bin).toBe('night');
    const clearAllowed = dayAwarePool(WITTY_DAY_TAGS.witty.clear, WEATHER_COPY.witty.clear.en, { day: 6, hour: 22, month: 7 });
    expect(pool).not.toContain(clearAllowed[0]);
  });
});

describe('class C — the weekday-slot weekend line stays weekend-gated (ruled unchanged)', () => {
  it('"If you\'re working today, we feel sorry for you." cannot fire on a Wednesday', () => {
    const line = "If you're working today, we feel sorry for you.";
    expect(WEATHER_COPY.witty.weekend.en).toContain(line);
    expect(call('clear', { day: 3, hour: 12, month: 7 }).pool).not.toContain(line);
    expect(call('clear', { day: 6, hour: 12, month: 7 }).pool).toContain(line);
  });
});
