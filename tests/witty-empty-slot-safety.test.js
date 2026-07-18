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
  // Locks the intentional empty slots so a later edit can't silently blank a
  // different index. Updated 2026-07-18: the provisional apply
  // (scripts/apply-provisional-drafts.mjs) folded the checker-PASSED zu/xh/st
  // drafts into these bins and recorded each in lang-packs/<lang>/provisional-manifest.jsonl.
  // That closed partly-cloudy zu[3,7,8] + st[4] and lc-clear zu/st[2]; zu
  // partly-cloudy[6] stays a FLAG debt (empty) pending native review. The
  // sanctioned-fill guarantee (filled ⟺ in the manifest, byte-identical) is
  // enforced by review/tools/verify-lines.mjs; this block pins the residual empties.
  const emptiesOf = (arr) =>
    (Array.isArray(arr) ? arr : []).map((s, i) => (typeof s === 'string' && s.trim() === '' ? i : -1)).filter((i) => i >= 0);
  const pc = WEATHER_COPY.witty['partly-cloudy'];
  const lc = WEATHER_COPY.witty_low_confidence.clear;
  it('partly-cloudy AF has no empties (owner filled the gap-fill slots, G0)', () => expect(emptiesOf(pc.af)).toEqual([]));
  it('partly-cloudy ZU empty at [6] only (FLAG debt; PASS drafts filled [3,7,8])', () => expect(emptiesOf(pc.zu)).toEqual([6]));
  it('partly-cloudy ST has no empties (provisional apply filled [4])', () => expect(emptiesOf(pc.st)).toEqual([]));
  it('lc-clear ZU/ST have no empties (provisional apply filled [2])', () => {
    expect(emptiesOf(lc.zu)).toEqual([]);
    expect(emptiesOf(lc.st)).toEqual([]);
  });
});
