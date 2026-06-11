// Group 6 — generated per-language copy banks must never drift from the
// single source of truth (assets/weather-copy.js).
//
// assets/copy/<lang>.js are CHECKED-IN build artifacts (so the source tree
// runs with zero build). Anyone editing weather-copy.js must re-run
//   node scripts/generate-copy-splits.mjs
// — this suite fails loudly if they forget.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { LANGS, buildModuleSource } from '../scripts/generate-copy-splits.mjs';
import { WEATHER_COPY } from '../assets/weather-copy.js';

describe('generated copy splits are in sync with weather-copy.js', () => {
  for (const lang of LANGS) {
    it(`assets/copy/${lang}.js matches a fresh regeneration`, () => {
      const onDisk = readFileSync(new URL(`../assets/copy/${lang}.js`, import.meta.url), 'utf8');
      expect(onDisk).toBe(buildModuleSource(lang));
    });
  }

  it('each split carries its language plus the en fallback, nothing else', async () => {
    const { WEATHER_COPY: af } = await import('../assets/copy/af.js');
    expect(af.witty.weekend.af).toEqual(WEATHER_COPY.witty.weekend.af);
    expect(af.witty.weekend.en).toEqual(WEATHER_COPY.witty.weekend.en);
    expect(af.witty.weekend.zu).toBeUndefined();
    expect(af.headlines.clear.xh).toBeUndefined();
  });

  it('the en split is en-only', async () => {
    const { WEATHER_COPY: en } = await import('../assets/copy/en.js');
    expect(en.heroLabels.clear).toEqual({ en: WEATHER_COPY.heroLabels.clear.en });
  });

  it('every split preserves the weekend Saturday-named line for the day filter', async () => {
    for (const lang of LANGS) {
      const { WEATHER_COPY: bank } = await import(`../assets/copy/${lang}.js`);
      const pool = bank.witty.weekend[lang] || bank.witty.weekend.en;
      const tagged = pool.filter((l) => /saturday energy|saterdagenergie|mgqibelo|moqebelo/i.test(l));
      expect(tagged.length, `${lang} weekend pool keeps its day-named line`).toBe(1);
    }
  });
});
