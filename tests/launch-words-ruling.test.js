// Al's ruling on the six launch words (review/launch-words-ruled.json, 2 Oct 2026): the EN and AF in
// assets/app.js's T object must be exactly what he ruled OK.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatAge } from '../assets/saved-place-meta.js';

const src = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
const ruled = JSON.parse(readFileSync(new URL('../review/launch-words-ruled.json', import.meta.url), 'utf8'));

// Al agreed in chat after the export that the Afrikaans for misc.agoHours is "{h} uur gelede":
// "h" is not an Afrikaans short form. The export still carries "{h} h gelede"; the chat ruling wins.
const AF_OVERRIDE = { 'misc.agoHours': '{h} uur gelede' };

function cell(key, lang) {
  const leaf = key.split('.')[1];
  const m = new RegExp(String.raw`^\s*${leaf}:\s*\{`, 'm').exec(src);
  if (!m) throw new Error(`no T entry for ${key}`);
  // One-line entry, or a multi-line one that ends at its closing brace on its own line.
  const eol = src.indexOf('\n', m.index);
  const oneLine = /\ben:/.test(src.slice(m.index, eol));
  const body = oneLine ? src.slice(m.index, eol) : src.slice(m.index, src.indexOf('\n      }', m.index));
  const v = new RegExp(`[ {,]${lang}: *"([^"]*)"`).exec(body);
  if (!v) throw new Error(`no ${lang} for ${key}`);
  return v[1];
}

describe('launch words ruling', () => {
  it('the export holds the six keys, all OK', () => {
    expect(ruled.words.map((w) => w.key).sort()).toEqual(
      ['home.fallbackApprox', 'home.fallbackSaved', 'home.pickPlace', 'misc.agoHours', 'misc.agoMins', 'weather.upTo']);
    for (const w of ruled.words) expect(w.verdict).toBe('OK');
  });
  for (const w of ruled.words) {
    it(`${w.key}: EN and AF match the ruling`, () => {
      expect(cell(w.key, 'en')).toBe(w.en);
      expect(cell(w.key, 'af')).toBe(AF_OVERRIDE[w.key] ?? w.af);
    });
  }
  it('the age formatter reads "1 h ago"/"3 h ago" and "1 uur gelede"/"3 uur gelede"', () => {
    const en = { mins: cell('misc.agoMins', 'en'), hours: cell('misc.agoHours', 'en') };
    const af = { mins: cell('misc.agoMins', 'af'), hours: cell('misc.agoHours', 'af') };
    expect(formatAge(60 * 60000, en)).toBe('1 h ago');
    expect(formatAge(3 * 60 * 60000, en)).toBe('3 h ago');
    expect(formatAge(60 * 60000, af)).toBe('1 uur gelede');
    expect(formatAge(3 * 60 * 60000, af)).toBe('3 uur gelede');
  });
});
