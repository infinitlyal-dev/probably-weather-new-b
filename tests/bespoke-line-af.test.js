import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { heroCropKey } from '../assets/hero-crop.js';
import * as heroLines from '../assets/hero-lines.js';
import * as heroLinesAf from '../assets/hero-lines-af.js';
import { contentProblems } from '../scripts/lang-check/lib/af-content.mjs';
import { contextTagAllows } from '../assets/witty-day-tags.js';

// Afrikaans bespoke lines (2026-09-15, close-out item H). applyBespokeLine opened
// for Afrikaans through a per-language table: assets/hero-lines-af.js, written
// only by the language gate (scripts/lang-check/apply-af-accepted.mjs) for lines
// that cleared lang-check and review/af-voice.md. zu/xh/st have no table and keep
// the condition bank.
//
// Behavioural: the real bespoke block is lifted out of assets/app.js and run in
// all five languages against the shipped tables.

const src = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');

function bespokeBlock() {
  const start = src.indexOf('  const __lineMemo = new Map();');
  const end = src.indexOf('  function setBackgroundFor(');
  if (start < 0 || end < start) throw new Error('bespoke block not found in assets/app.js');
  return src.slice(start, end);
}

function harness({ lang, importEn = vi.fn(async () => heroLines), importAf = vi.fn(async () => heroLinesAf) }) {
  const headlineEl = { textContent: 'Condition line' };
  const settings = { lang };
  const body = bespokeBlock()
    .replace("import('./hero-lines.js')", '__importEn()')
    .replace("import('./hero-lines-af.js')", '__importAf()');
  const make = new Function('headlineEl', 'settings', 'safeText', 'debugLog', 'heroCropKey', '__importEn', '__importAf',
    'contextTagAllows', 'bespokeTagContext',
    `${body}\nreturn { applyBespokeLine, loadBespokeTable };`);
  // No place and no month: the season/place gate fails open, as it does before a forecast.
  const api = make(headlineEl, settings, (el, text) => { el.textContent = text; }, () => {}, heroCropKey, importEn, importAf,
    contextTagAllows, () => ({}));
  return { ...api, headlineEl, settings, importEn, importAf };
}

const srcFor = (key) => {
  for (const prefix of ['assets/images/', '/assets/images/', '']) if (heroCropKey(prefix + key) === key) return prefix + key;
  throw new Error(`no src resolves to ${key}`);
};
const afFor = (lines) => lines.map((line) => heroLinesAf.heroLineAf(line)).filter(Boolean);
const slotKeys = Object.keys(heroLines.HERO_LINES).filter((k) => k.startsWith('bg/'));
// Any photograph with a rotation to test. Full Afrikaans coverage is now the norm.
const subjectKey = slotKeys.find((k) => {
  const lines = heroLines.HERO_LINES[k];
  return lines.length >= 3 && afFor(lines).length === lines.length;
});
if (!subjectKey) throw new Error('no photograph with three lines and full Afrikaans — the tables are not in a testable state');

// A photograph only some of whose lines cleared the gate, so the Afrikaans rotation
// has to filter. This USED to be found in the shipped table — until the provenance
// cull (2026-09-20) took out the lines that carried the gaps and left every
// surviving photograph fully translated. The behaviour under test is
// applyBespokeLine's per-language pool, not the completeness of the AF table, so
// when the table has no gap the gap is made: one line withheld from a stub.
const realPartial = slotKeys.find((k) => {
  const n = afFor(heroLines.HERO_LINES[k]).length;
  return n >= 2 && n < heroLines.HERO_LINES[k].length;
});
const partial = realPartial
  ? { key: realPartial, importAf: undefined, af: afFor(heroLines.HERO_LINES[realPartial]) }
  : (() => {
    const lines = heroLines.HERO_LINES[subjectKey];
    const withheld = lines[lines.length - 1];
    const af = lines.filter((l) => l !== withheld).map((l) => heroLinesAf.heroLineAf(l));
    return {
      key: subjectKey,
      importAf: () => vi.fn(async () => ({ heroLineAf: (en) => (en === withheld ? null : heroLinesAf.heroLineAf(en)) })),
      af,
    };
  })();
const flush = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => vi.restoreAllMocks());

describe('bespoke lines — five languages', () => {
  it('each language rotates through exactly the lines it has for the photograph', async () => {
    const photo = srcFor(partial.key);
    const english = heroLines.HERO_LINES[partial.key];
    const pools = { en: english, af: partial.af, zu: [], xh: [], st: [] };

    for (const [lang, pool] of Object.entries(pools)) {
      const shown = new Set();
      const picks = Math.max(pool.length, 1);
      for (let i = 0; i < picks; i++) {
        vi.spyOn(Math, 'random').mockReturnValue((i + 0.5) / picks);
        const h = harness({ lang, ...(partial.importAf ? { importAf: partial.importAf() } : {}) });
        if (pool.length) {
          await h.loadBespokeTable('en');
          await h.loadBespokeTable(lang);
          expect(h.applyBespokeLine(photo)).toBe(true);
          shown.add(h.headlineEl.textContent);
        } else {
          expect(h.applyBespokeLine(photo)).toBe(false);
          await flush();
          expect(h.headlineEl.textContent).toBe('Condition line');
          expect(h.importEn).not.toHaveBeenCalled();
          expect(h.importAf).not.toHaveBeenCalled();
        }
        vi.restoreAllMocks();
      }
      expect([...shown].sort(), lang).toEqual([...new Set(pool)].sort());
    }

    // Afrikaans shows no English line, and fewer lines than English here: the held-back ones.
    for (const line of pools.af) expect(english).not.toContain(line);
    expect(pools.af.length).toBeLessThan(english.length);
  });

  it('an Afrikaans session loads both tables and captions in Afrikaans when they land', async () => {
    let resolveAf;
    const importAf = vi.fn(() => new Promise((r) => { resolveAf = r; }));
    const h = harness({ lang: 'af', importAf });
    const photo = srcFor(subjectKey);
    expect(h.applyBespokeLine(photo)).toBe(false);
    expect(h.importEn).toHaveBeenCalledTimes(1);
    expect(importAf).toHaveBeenCalledTimes(1);
    await flush();
    expect(h.headlineEl.textContent).toBe('Condition line');
    resolveAf(heroLinesAf);
    await flush();
    expect(afFor(heroLines.HERO_LINES[subjectKey])).toContain(h.headlineEl.textContent);
  });

  it('a language switch before the tables land leaves the new language\'s headline alone', async () => {
    let resolveAf;
    const h = harness({ lang: 'af', importAf: vi.fn(() => new Promise((r) => { resolveAf = r; })) });
    h.applyBespokeLine(srcFor(subjectKey));
    h.settings.lang = 'zu';
    resolveAf(heroLinesAf);
    await flush();
    expect(h.headlineEl.textContent).toBe('Condition line');
  });

  it('switching between English and Afrikaans on one photograph gives each its own line', async () => {
    const h = harness({ lang: 'en' });
    await h.loadBespokeTable('en');
    await h.loadBespokeTable('af');
    const photo = srcFor(subjectKey);
    h.applyBespokeLine(photo);
    expect(heroLines.HERO_LINES[subjectKey]).toContain(h.headlineEl.textContent);
    h.settings.lang = 'af';
    h.applyBespokeLine(photo);
    expect(afFor(heroLines.HERO_LINES[subjectKey])).toContain(h.headlineEl.textContent);
  });

  it('a photograph with no Afrikaans for any of its lines keeps the condition line', async () => {
    const h = harness({ lang: 'af', importAf: vi.fn(async () => ({ heroLineAf: () => null })) });
    await h.loadBespokeTable('en');
    await h.loadBespokeTable('af');
    expect(h.applyBespokeLine(srcFor(subjectKey))).toBe(false);
    expect(h.headlineEl.textContent).toBe('Condition line');
  });
});

describe('the Afrikaans table is the gate\'s output', () => {
  const wired = new Set(Object.values(heroLines.HERO_LINES).flat());
  const rows = Object.entries(heroLinesAf.HERO_LINES_AF);

  it('is generated by the gate and keyed only by wired English lines', () => {
    const file = readFileSync(new URL('../assets/hero-lines-af.js', import.meta.url), 'utf8');
    expect(file).toMatch(/GENERATED by\s*\n?\/\/\s*scripts\/lang-check\/apply-af-accepted\.mjs/);
    expect(rows.length).toBeGreaterThan(1000);
    for (const [english, afrikaans] of rows) {
      expect(wired.has(english), english).toBe(true);
      expect(afrikaans.trim()).not.toBe('');
      expect(afrikaans).not.toBe(english);
    }
  });

  it('adds no day, no braai and no untranslated "Probably" the English does not have', () => {
    // Al's own rulings are exempt, as they are at the gate: he is the native author
    // (B182 "wie braai", 2026-09-15). Every other row must be clean.
    const alRuled = new Set(JSON.parse(readFileSync(new URL('../review/af-al-decisions.json', import.meta.url), 'utf8')).decisions.map((d) => d.english));
    const problems = rows.filter(([english]) => !alRuled.has(english)).map(([english, afrikaans]) => [english, contentProblems(english, afrikaans)]).filter(([, p]) => p.length);
    expect(problems).toEqual([]);
  });
});
