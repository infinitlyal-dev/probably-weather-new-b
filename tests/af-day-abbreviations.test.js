// Afrikaans day-of-week abbreviations. Tester flagged the previous values
// (mon=Maa, tue=Din, wed=Woe) were wrong. Required per spec:
//   Maandag → Ma, Dinsdag → Dins, Woensdag → Wo, Donderdag → Don,
//   Vrydag → Vry, Saterdag → Sat, Sondag → Son.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const appSrc = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');

// Extract just the T.days block so the regex tests don't pick up stray
// mentions elsewhere in the file (witty pools, weekday-only-fragments, etc.).
const daysBlock = appSrc.match(/days:\s*\{[\s\S]*?\n\s{4}\},/)?.[0] ?? '';

describe('Afrikaans day-of-week abbreviations', () => {
  it('extracts the T.days block from app.js', () => {
    expect(daysBlock).toBeTruthy();
    // Sanity: block contains all seven day keys
    for (const key of ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']) {
      expect(daysBlock).toMatch(new RegExp(`\\b${key}:\\s*\\{`));
    }
  });

  // The full Afrikaans contract — one assertion per day so failures point
  // directly at the wrong abbreviation rather than a single mega-regex.
  const AF_EXPECTED = {
    sun: 'Son',  // Sondag
    mon: 'Ma',   // Maandag  (was: Maa)
    tue: 'Dins', // Dinsdag  (was: Din)
    wed: 'Wo',   // Woensdag (was: Woe)
    thu: 'Don',  // Donderdag
    fri: 'Vry',  // Vrydag
    sat: 'Sat',  // Saterdag
  };
  for (const [key, expected] of Object.entries(AF_EXPECTED)) {
    it(`${key}: af === "${expected}"`, () => {
      // Match: "<key>: { ... af: "<value>" ... }"
      const lineRe = new RegExp(`\\b${key}:\\s*\\{[^}]*?af:\\s*"([^"]+)"`);
      const match = daysBlock.match(lineRe);
      expect(match, `${key} entry not found`).toBeTruthy();
      expect(match[1]).toBe(expected);
    });
  }
});

describe('Day abbreviations — no regression on other languages', () => {
  // Guard against accidental edits to en / zu / xh / st. The spec was
  // explicit: don't touch them in this pass.
  const NON_AF_CONTRACT = {
    sun: { en: 'Sun', zu: 'Son',   xh: 'Caw',   st: 'Sont' },
    mon: { en: 'Mon', zu: 'Mso',   xh: 'Mvu',   st: 'Mant' },
    tue: { en: 'Tue', zu: 'Bil',   xh: 'Lwes',  st: 'Lab' },
    wed: { en: 'Wed', zu: 'Tha',   xh: 'Tha',   st: 'Lar' },
    thu: { en: 'Thu', zu: 'Sin',   xh: 'Sin',   st: 'Labo' },
    fri: { en: 'Fri', zu: 'Hla',   xh: 'Hlanu', st: 'Laboh' },
    sat: { en: 'Sat', zu: 'Mgq',   xh: 'Mgqi',  st: 'Moq' },
  };
  for (const [key, langs] of Object.entries(NON_AF_CONTRACT)) {
    for (const [lang, expected] of Object.entries(langs)) {
      it(`${key}: ${lang} === "${expected}" (unchanged)`, () => {
        const lineRe = new RegExp(`\\b${key}:\\s*\\{[^}]*?${lang}:\\s*"([^"]+)"`);
        const match = daysBlock.match(lineRe);
        expect(match, `${key}.${lang} entry not found`).toBeTruthy();
        expect(match[1]).toBe(expected);
      });
    }
  }
});

describe('Layout: longest Afrikaans abbreviation "Dins" fits the Week-tab column', () => {
  const cssSrc = readFileSync(new URL('../assets/app.css', import.meta.url), 'utf8');

  it("the Week-tab .daily-row grid first column is flexible (1fr), not fixed-width", () => {
    // .d-day uses the first grid column. If it's `1fr` (flexible), 4-char
    // "Dins" fits naturally. If it's a fixed small width, "Dins" risks
    // truncation/wrap. This test guards against a future regression where
    // someone tightens the layout and breaks Afrikaans.
    const rowRule = cssSrc.match(/\.daily-row\s*\{[\s\S]*?grid-template-columns:\s*([^;]+);/);
    expect(rowRule, '.daily-row grid-template-columns rule not found').toBeTruthy();
    const cols = rowRule[1].trim();
    // First column must be 1fr (flexible). If anyone changes it to a small
    // px value, this test catches it.
    expect(cols).toMatch(/^1fr\b/);
  });
});
