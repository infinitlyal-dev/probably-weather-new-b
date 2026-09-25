// Launch run (2026-09-25), Al's ticked list "desktop-tomorrow": on a computer at night the big
// numbers are already tomorrow's range; they now say so. The phone hero is unchanged.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const js = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../assets/app.css', import.meta.url), 'utf8');
const sliceFn = (name) => {
  const start = js.indexOf(`function ${name}(`);
  expect(start, `${name} missing`).toBeGreaterThan(-1);
  let depth = 0;
  for (let i = js.indexOf('{', start); i < js.length; i++) {
    if (js[i] === '{') depth++;
    else if (js[i] === '}' && --depth === 0) return js.slice(start, i + 1);
  }
  throw new Error(`unbalanced ${name}`);
};

describe('desktop-tomorrow', () => {
  const getHeroRange = new Function('isNum', `${sliceFn('getHeroRange')}\nreturn getHeroRange;`)((v) => typeof v === 'number' && Number.isFinite(v));
  it('marks tomorrow\'s range at night only', () => {
    const norm = { todayLow: 12, todayHigh: 20, daily: [{ lowC: 12, highC: 20 }, { lowC: 17, highC: 21 }], hourly: [] };
    expect(getHeroRange(norm, 'night')).toEqual({ low: 17, high: 21, format: 'range', tomorrow: true });
    expect(getHeroRange(norm, 'day').tomorrow).toBeUndefined();
  });
  it('renderHome passes the word; only the desktop postcard shows it', () => {
    expect(js).toContain("rangeIsTomorrow ? t('weather', 'tomorrow') : null");
    expect(css).toMatch(/@media \(max-width: 768px\) \{ \.temp \.hero-when \{ display: none; \} \}/);
  });
  it('Tomorrow in all five languages', () => {
    expect(js).toContain('tomorrow: { en: "Tomorrow", af: "Môre", zu: "Kusasa", xh: "Ngomso", st: "Hosane" }');
  });
});
