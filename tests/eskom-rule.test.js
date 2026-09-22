// The Eskom and load-shedding rule — Al, 22 Sept 2026.
//
// CLAUDE.md used to say "No Eskom jokes on home screen". Nothing enforced it, and
// by 2026-09-19 seven Eskom lines were live: four hand-matched onto photographs by
// Al himself, three in the condition bank. He ruled each one on
// review/eskom-lines.html (export: review/eskom-ruled.json): five KEEP, two CUT.
//
// The rule that replaces the ban: those five are approved; no new Eskom or
// load-shedding material ships without Al's ruling. A rule nobody checks drifts,
// so this is the check. It scans every string the app can put on screen — the
// condition bank in all five languages and the bespoke photograph tables in
// English and Afrikaans — and fails on any Eskom / load-shedding / beurtkrag
// line that is not one of the five or a translation of one of the five.
//
// To approve a new line: Al rules it, and its English goes into APPROVED below
// with the date of his ruling. Nothing else.
import { describe, expect, it } from 'vitest';

import { WEATHER_COPY } from '../assets/weather-copy.js';
import { HERO_LINES } from '../assets/hero-lines.js';
import { HERO_LINES_AF } from '../assets/hero-lines-af.js';

// review/eskom-ruled.json, 2026-09-22 — the English of every line Al kept.
const APPROVED = new Set([
  "Nature's doing its own load shedding.",          // witty:storm#5
  'Eskom wishes it had this power.',                 // witty:storm#12
  "Lightning's putting Eskom's grid to shame.",      // witty:storm#13
  'Eskom-friendly weather. No solar today.',         // witty:cloudy#10
  "Stars out, load shedding can't touch this.",      // witty:night#0
]);
// Cut on the same ruling. They must not come back by any route.
const CUT = new Set([
  'The kind of day that makes you forget load shedding.',
  'Days like this is why we put up with the load shedding.',
]);

// "load shedding" survives as a loanword in isiZulu, isiXhosa and Sesotho
// ("i-load shedding", "nge-load shedding"); Afrikaans says "beurtkrag".
const TERM = /eskom|load.?shed|beurtkrag/i;
const LANGS = ['en', 'af', 'zu', 'xh', 'st'];

// Every bank string with the English it belongs to, across every namespace.
function bankRows() {
  const rows = [];
  for (const [ns, bins] of Object.entries(WEATHER_COPY)) {
    for (const [bin, v] of Object.entries(bins || {})) {
      if (!v || typeof v !== 'object' || !('en' in v)) continue;
      const en = Array.isArray(v.en) ? v.en : [v.en];
      for (const lang of LANGS) {
        const arr = Array.isArray(v[lang]) ? v[lang] : [v[lang]];
        arr.forEach((text, i) => { if (typeof text === 'string') rows.push({ where: `${ns}:${bin}#${i}`, lang, text, en: en[i] }); });
      }
    }
  }
  return rows;
}

describe('Eskom and load-shedding lines — only what Al approved (2026-09-22)', () => {
  it('every Eskom line in the condition bank, in any language, belongs to an approved English line', () => {
    const stray = bankRows().filter((r) => TERM.test(r.text) && !APPROVED.has(r.en))
      .map((r) => `${r.where} ${r.lang}: "${r.text}" (English: "${r.en}")`);
    expect(stray, 'new Eskom/load-shedding material needs Al\'s ruling first').toEqual([]);
  });

  it('every Eskom line on a photograph, in English or Afrikaans, is approved', () => {
    const english = [...new Set(Object.values(HERO_LINES).flat())];
    const strayEn = english.filter((t) => TERM.test(t) && !APPROVED.has(t));
    const strayAf = Object.entries(HERO_LINES_AF).filter(([en, af]) => TERM.test(af) && !APPROVED.has(en))
      .map(([en, af]) => `"${af}" (English: "${en}")`);
    expect([...strayEn, ...strayAf]).toEqual([]);
  });

  it('the two lines Al cut are gone from the bank and from every photograph', () => {
    const everywhere = new Set([
      ...bankRows().map((r) => r.text),
      ...Object.values(HERO_LINES).flat(),
      ...Object.keys(HERO_LINES_AF),
    ]);
    expect([...CUT].filter((t) => everywhere.has(t))).toEqual([]);
  });

  it('the five approved lines are still live in the bank, with all five languages', () => {
    const rows = bankRows();
    for (const en of APPROVED) {
      const langs = new Set(rows.filter((r) => r.en === en && r.text && r.text.trim()).map((r) => r.lang));
      expect([...langs].sort(), en).toEqual([...LANGS].sort());
    }
  });
});
