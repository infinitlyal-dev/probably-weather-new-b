import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

import { heroCropKey } from '../assets/hero-crop.js';
import * as heroLines from '../assets/hero-lines.js';
import * as heroLinesAf from '../assets/hero-lines-af.js';

// Performance pass (2026-09-15): the bespoke line tables — assets/hero-lines.js
// (~455 KB of a ~640 KB app.js) and its Afrikaans, assets/hero-lines-af.js — are
// not in app.js's static graph; each loads as its own chunk. Once they have
// landed the paint path must caption exactly as before; while they have not, the
// condition line stands, the photograph's own line replaces it when the tables
// arrive, and an older paint never overwrites a newer one.
//
// Behavioural: the real bespoke block is lifted out of assets/app.js (from the
// line memo up to setBackgroundFor) and run with its dynamic imports swapped for
// promises the test controls. The five-language rotation is in
// tests/bespoke-line-af.test.js.

const src = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');

function bespokeBlock() {
  const start = src.indexOf('  const __lineMemo = new Map();');
  const end = src.indexOf('  function setBackgroundFor(');
  if (start < 0 || end < start) throw new Error('bespoke block not found in assets/app.js');
  return src.slice(start, end);
}

function harness({ lang = 'en', importEn, importAf = async () => heroLinesAf }) {
  const headlineEl = { textContent: 'Condition line' };
  const settings = { lang };
  const safeText = (el, text) => { el.textContent = text; };
  const body = bespokeBlock()
    .replace("import('./hero-lines.js')", '__importEn()')
    .replace("import('./hero-lines-af.js')", '__importAf()');
  const make = new Function('headlineEl', 'settings', 'safeText', 'debugLog', 'heroCropKey', '__importEn', '__importAf',
    `${body}\nreturn { applyBespokeLine, loadBespokeTable };`);
  return { ...make(headlineEl, settings, safeText, () => {}, heroCropKey, importEn, importAf), headlineEl, settings };
}

// Two photographs with different lines, addressed the way the picker hands them over.
const slotKeys = Object.keys(heroLines.HERO_LINES).filter((k) => k.startsWith('bg/'));
const srcFor = (key) => {
  for (const prefix of ['assets/images/', '/assets/images/', '']) if (heroCropKey(prefix + key) === key) return prefix + key;
  throw new Error(`no src resolves to ${key}`);
};
const keyA = slotKeys[0];
const linesA = heroLines.HERO_LINES[keyA];
const keyB = slotKeys.find((k) => !heroLines.HERO_LINES[k].some((line) => linesA.includes(line)));
const linesB = heroLines.HERO_LINES[keyB];
const srcA = srcFor(keyA);
const srcB = srcFor(keyB);

const deferred = () => {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
};
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('bespoke line tables — lazy chunks', () => {
  it('app.js loads both tables dynamically, never statically, and starts them at boot', () => {
    expect(src).not.toMatch(/^import .* from '\.\/hero-lines(-af)?\.js';/m);
    expect(src).toMatch(/import\('\.\/hero-lines\.js'\)/);
    expect(src).toMatch(/import\('\.\/hero-lines-af\.js'\)/);
    expect(src).toMatch(/if \(BESPOKE_TABLES\[settings\.lang\]\) \{ loadBespokeTable\('en'\); loadBespokeTable\(settings\.lang\); \}/);
  });

  it('the table resolves the picker path to the photograph written for it', () => {
    expect(heroLines.heroLinesForKey(heroCropKey(srcA))).toBe(linesA);
    expect(heroLines.heroLinesForKey('')).toBeNull();
    expect(heroLines.heroLinesForKey('bg/not-a-photograph.webp')).toBeNull();
  });

  it('keeps the condition line until the table lands, then captions the same photograph', async () => {
    const d = deferred();
    const h = harness({ importEn: vi.fn(() => d.promise) });
    expect(h.applyBespokeLine(srcA)).toBe(false);
    expect(h.headlineEl.textContent).toBe('Condition line');
    d.resolve(heroLines);
    await flush();
    expect(linesA).toContain(h.headlineEl.textContent);
  });

  it('once loaded it captions synchronously, and the line stays put across re-paints', async () => {
    const h = harness({ importEn: vi.fn(async () => heroLines) });
    await h.loadBespokeTable('en');
    expect(h.applyBespokeLine(srcA)).toBe(true);
    const first = h.headlineEl.textContent;
    expect(linesA).toContain(first);
    h.headlineEl.textContent = 'Condition line';
    expect(h.applyBespokeLine(srcA)).toBe(true);
    expect(h.headlineEl.textContent).toBe(first);
  });

  it('a late table never captions an older photograph over a newer one', async () => {
    const d = deferred();
    const h = harness({ importEn: vi.fn(() => d.promise) });
    h.applyBespokeLine(srcA); // first paint, table still loading
    h.applyBespokeLine(srcB); // the fallback chain landed on another photograph
    d.resolve(heroLines);
    await flush();
    expect(linesB).toContain(h.headlineEl.textContent);
  });

  it('a late table leaves a headline that was rewritten in the meantime alone', async () => {
    const d = deferred();
    const h = harness({ importEn: vi.fn(() => d.promise) });
    h.applyBespokeLine(srcA);
    h.headlineEl.textContent = 'Loading…'; // a place change repainted the headline
    d.resolve(heroLines);
    await flush();
    expect(h.headlineEl.textContent).toBe('Loading…');
  });

  it('imports the table once, and retries after a failed load', async () => {
    const importEn = vi.fn()
      .mockImplementationOnce(() => Promise.reject(new Error('offline')))
      .mockImplementation(async () => heroLines);
    const h = harness({ importEn });
    expect(h.applyBespokeLine(srcA)).toBe(false);
    await flush();
    expect(h.headlineEl.textContent).toBe('Condition line');
    h.applyBespokeLine(srcA);
    await flush();
    expect(linesA).toContain(h.headlineEl.textContent);
    h.applyBespokeLine(srcB);
    h.applyBespokeLine(srcA);
    expect(importEn).toHaveBeenCalledTimes(2);
  });

  it('languages without bespoke lines neither load a table nor touch the headline', async () => {
    for (const lang of ['zu', 'xh', 'st']) {
      const importEn = vi.fn(async () => heroLines);
      const importAf = vi.fn(async () => heroLinesAf);
      const h = harness({ lang, importEn, importAf });
      expect(h.applyBespokeLine(srcA)).toBe(false);
      await flush();
      expect(importEn).not.toHaveBeenCalled();
      expect(importAf).not.toHaveBeenCalled();
      expect(h.headlineEl.textContent).toBe('Condition line');
    }
  });
});
