import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// renderHome stamps hero-<condition> on the caption and the temperature, and
// clears the previous one by exact token. If the clear-list is narrower than the
// set of conditions computeHomeDisplayCondition can return, two hero classes end
// up on one element — invisible while those keys carry no colour, and two inks
// fighting the moment the caption ink is condition-mapped.
const js = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');

const returned = () => {
  const start = js.indexOf('function computeHomeDisplayCondition');
  const body = js.slice(start, js.indexOf('\n  }', start));
  return [...body.matchAll(/return '([a-z-]+)'/g)].map((m) => m[1]);
};

const cleared = () => {
  const start = js.indexOf('const hc = [');
  const block = js.slice(start, js.indexOf('];', start));
  return [...block.matchAll(/'hero-([a-z-]+)'/g)].map((m) => m[1]);
};

describe('hero condition classes', () => {
  it('clears every condition renderHome can stamp', () => {
    const keys = [...new Set(returned())];
    // partly-cloudy is aliased to cloudy before the class is built, so it is the
    // one key that legitimately never appears as a hero- token.
    const expected = keys.filter((k) => k !== 'partly-cloudy');
    const list = cleared();
    expect(expected.length).toBeGreaterThanOrEqual(12);
    for (const key of expected) {
      expect(list, `hero-${key} is stamped but never cleared`).toContain(key);
    }
  });

  it('aliases partly-cloudy rather than inventing a class for it', () => {
    expect(js).toMatch(/const heroVariant = displayCondition === 'partly-cloudy' \? 'cloudy' : displayCondition;/);
  });
});
