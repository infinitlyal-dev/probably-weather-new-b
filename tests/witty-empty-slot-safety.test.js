import { describe, expect, it } from 'vitest';
import { WEATHER_COPY } from '../assets/weather-copy.js';

// ---------------------------------------------------------------------------
// Witty empty-slot safety (2026-07-02, language-bank realignment).
//
// The partly-cloudy AF/ZU/ST realignment and the lc-clear zu/xh/st shift leave
// some indices as intentional empty-string placeholders ("") pending native
// gap-fill. Two invariants keep that safe:
//   1. Every bin's arrays are the SAME LENGTH across all five languages, so a
//      row-keyed native review can address the same index in every language.
//   2. No bin/language/index path can surface an empty line: the picker filters
//      empties, and every pool always has at least one non-empty line to pick.
// This mirrors the runtime filter in app.js pickWittyLine / api/og.js pickWitty.
// ---------------------------------------------------------------------------

const LANGS = ['en', 'af', 'zu', 'xh', 'st'];
const nonEmpty = (arr) =>
  (Array.isArray(arr) ? arr : []).filter((s) => typeof s === 'string' && s.trim() !== '');

// Collect every {group, bin} that has parallel per-language string arrays.
const groups = [
  ['witty', WEATHER_COPY.witty],
  ['witty_low_confidence', WEATHER_COPY.witty_low_confidence],
];
const bins = [];
for (const [group, obj] of groups) {
  for (const bin of Object.keys(obj)) {
    if (bin === '_meta') continue;
    const entry = obj[bin];
    if (entry && typeof entry === 'object' && Array.isArray(entry.en)) bins.push([group, bin, entry]);
  }
}

describe('witty bins — equal array length across all five languages', () => {
  for (const [group, bin, entry] of bins) {
    it(`${group}.${bin} has equal length in en/af/zu/xh/st`, () => {
      const lens = LANGS.map((l) => (Array.isArray(entry[l]) ? entry[l].length : -1));
      expect(new Set(lens).size, `${group}.${bin} lengths = ${lens.join('/')}`).toBe(1);
    });
  }
});

describe('witty bins — the picker can never surface an empty line', () => {
  for (const [group, bin, entry] of bins) {
    for (const lang of LANGS) {
      it(`${group}.${bin}.${lang} has at least one non-empty line`, () => {
        // After the picker's empty-filter there must still be something to pick.
        expect(nonEmpty(entry[lang]).length).toBeGreaterThanOrEqual(1);
      });
    }
  }
});

describe('witty bins — realignment empties are exactly where expected', () => {
  // Locks the intentional empty slots from the 2026-07-02 realignment so a later
  // edit can't silently blank a different index. (XH lc-clear[2] and XH
  // partly-cloudy are refilled by the Xhosa application step, G2.)
  const emptiesOf = (arr) =>
    (Array.isArray(arr) ? arr : []).map((s, i) => (typeof s === 'string' && s.trim() === '' ? i : -1)).filter((i) => i >= 0);
  const pc = WEATHER_COPY.witty['partly-cloudy'];
  const lc = WEATHER_COPY.witty_low_confidence.clear;
  it('partly-cloudy AF has no empties (owner filled the gap-fill slots, G0)', () => expect(emptiesOf(pc.af)).toEqual([]));
  it('partly-cloudy ZU empties at [3,6,7,8]', () => expect(emptiesOf(pc.zu)).toEqual([3, 6, 7, 8]));
  it('partly-cloudy ST empties at [4]', () => expect(emptiesOf(pc.st)).toEqual([4]));
  it('lc-clear ZU/ST empty at [2]', () => {
    expect(emptiesOf(lc.zu)).toEqual([2]);
    expect(emptiesOf(lc.st)).toEqual([2]);
  });
});
