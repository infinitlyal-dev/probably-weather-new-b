// Launch run (2026-09-25), Al's ticked list "place-language": the geocoder names the province and
// the country in English; they now follow the reader's language. The town is never translated.
// The isiZulu, isiXhosa and Sesotho names passed lang-check (review/launch/lang-check/).

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const js = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
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
const sliceConst = (name, endMarker) => {
  const start = js.indexOf(`const ${name} = `);
  expect(start, `${name} missing`).toBeGreaterThan(-1);
  return js.slice(start, js.indexOf(endMarker, start) + endMarker.length);
};

describe('place-language', () => {
  const build = (lang) => new Function('settings', 't', `${sliceConst('PLACE_PARTS', '\n  };')}\n${sliceConst('localizePlaceParts', '\n  };')}\n${sliceFn('displayPlaceName')}\nreturn displayPlaceName;`)({ lang }, (_, k) => k);
  it.each([
    ['en', 'Strand, Western Cape, South Africa'],
    ['af', 'Strand, Wes-Kaap, Suid-Afrika'],
    ['zu', 'Strand, iNtshonalanga Kapa, iNingizimu Afrika'],
    ['xh', 'Strand, iNtshona Koloni, uMzantsi Afrika'],
    ['st', 'Strand, Kapa Bophirima, Afrika Borwa'],
  ])('%s', (lang, want) => {
    expect(build(lang)('Strand, Western Cape, South Africa')).toBe(want);
  });
  it('town names, and names with no translation, stay as the geocoder gives them', () => {
    expect(build('af')('Sandton, Gauteng')).toBe('Sandton, Gauteng');
    expect(build('zu')('Durban, KwaZulu-Natal')).toBe('Durban, KwaZulu-Natali');
    expect(build('af')('My Location')).toBe('myLocation');
  });
  it('search results name the country in the reader\'s language too', () => {
    expect(sliceFn('formatSearchResult')).toContain('${localizePlaceParts(a.country)}');
  });
});
