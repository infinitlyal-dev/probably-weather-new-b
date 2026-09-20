import { existsSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { heroCropKey } from '../assets/hero-crop.js';
import * as heroLines from '../assets/hero-lines.js';
import * as heroLinesAf from '../assets/hero-lines-af.js';
import { WEATHER_COPY } from '../assets/weather-copy.js';
import { WITTY_DAY_TAGS, contextTagAllows } from '../assets/witty-day-tags.js';

// The season and place gate on the bespoke lines (2026-09-19). A line written for a
// photograph can name a month, a season or a place, and the photograph comes round all
// year: "the start of November" was on screen in September (review/LINE-AUDIT-2026-09-19.md).
// applyBespokeLine now passes every line through contextTagAllows — the condition bank's
// own gate — with the tag from HERO_LINE_TAGS, and falls back to the condition line when
// nothing on the photograph is in season.
//
// Behavioural: the real bespoke block is lifted out of assets/app.js and run against the
// shipped tables, with the month and place the gate reads under the test's control.

const src = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
const bespokeBlock = () => {
  const start = src.indexOf('  const __lineMemo = new Map();');
  const end = src.indexOf('  function setBackgroundFor(');
  if (start < 0 || end < start) throw new Error('bespoke block not found in assets/app.js');
  return src.slice(start, end);
};

const STRAND = { lat: -34.1163, lon: 18.8362 };
const JOBURG = { lat: -26.2041, lon: 28.0473 };

function harness({ lang = 'en', en = heroLines, context }) {
  const headlineEl = { textContent: 'Condition line' };
  const settings = { lang };
  const ctx = { ...context };
  const body = bespokeBlock()
    .replace("import('./hero-lines.js')", '__importEn()')
    .replace("import('./hero-lines-af.js')", '__importAf()');
  const make = new Function('headlineEl', 'settings', 'safeText', 'debugLog', 'heroCropKey', '__importEn', '__importAf',
    'contextTagAllows', 'bespokeTagContext', `${body}\nreturn { applyBespokeLine, loadBespokeTable };`);
  const api = make(headlineEl, settings, (el, t) => { el.textContent = t; }, () => {}, heroCropKey,
    async () => en, async () => heroLinesAf, contextTagAllows, () => ctx);
  return { ...api, headlineEl, settings, ctx };
}

const srcFor = (key) => {
  for (const prefix of ['assets/images/', '/assets/images/', '']) if (heroCropKey(prefix + key) === key) return prefix + key;
  throw new Error(`no src resolves to ${key}`);
};
const TAGS = heroLines.HERO_LINE_TAGS;
const slotKeys = Object.keys(heroLines.HERO_LINES).filter((k) => k.startsWith('bg/'));
// Every line the real code will put on screen for this photograph in this context.
async function rotation(key, { lang = 'en', context, en } = {}) {
  const shown = new Set();
  for (let i = 0; i < 16; i++) {
    vi.spyOn(Math, 'random').mockReturnValue((i + 0.5) / 16);
    const h = harness({ lang, context, en });
    await h.loadBespokeTable('en'); await h.loadBespokeTable(lang);
    if (h.applyBespokeLine(srcFor(key))) shown.add(h.headlineEl.textContent);
    vi.restoreAllMocks();
  }
  return [...shown];
}
const monthsOnly = (line) => TAGS[line]?.months && !TAGS[line]?.region;
// A photograph with a winter-only line beside lines that run all year.
const winterKey = slotKeys.find((k) => {
  const ls = heroLines.HERO_LINES[k];
  return ls.some((l) => monthsOnly(l) && TAGS[l].months.includes(7) && !TAGS[l].months.includes(1)) && ls.some((l) => !TAGS[l]);
});
const winterLine = heroLines.HERO_LINES[winterKey].find((l) => monthsOnly(l) && TAGS[l].months.includes(7) && !TAGS[l].months.includes(1));
// A photograph with a Western Cape line beside untagged lines.
const capeKey = slotKeys.find((k) => {
  const ls = heroLines.HERO_LINES[k];
  return ls.some((l) => TAGS[l]?.region === 'western-cape' && !TAGS[l].months) && ls.some((l) => !TAGS[l]);
});
const capeLine = heroLines.HERO_LINES[capeKey].find((l) => TAGS[l]?.region === 'western-cape' && !TAGS[l].months);

afterEach(() => vi.restoreAllMocks());

describe('bespoke lines — season and place gate', () => {
  it('app.js gates the bespoke pool through the bank\'s contextTagAllows', () => {
    const block = bespokeBlock();
    expect(src).toMatch(/import \{[^}]*\bcontextTagAllows\b[^}]*\} from '\.\/witty-day-tags\.js';/);
    expect(block).toMatch(/written\.filter\(\(l\) => contextTagAllows\(tags\[l\], context\)\)/);
    expect(block).toMatch(/bespokeTagContext\(\)/);
  });

  it('a winter-only line is never shown in January and is in rotation in July', async () => {
    expect(winterKey, 'no photograph with a winter-only line beside all-year lines').toBeTruthy();
    const jan = await rotation(winterKey, { context: { ...STRAND, month: 1 } });
    const jul = await rotation(winterKey, { context: { ...STRAND, month: 7 } });
    expect(jan.length).toBeGreaterThan(0);
    expect(jan).not.toContain(winterLine);
    expect(jul).toContain(winterLine);
  });

  it('a Western Cape line is shown in Strand and not in Johannesburg', async () => {
    expect(capeKey, 'no photograph with a Western Cape line beside untagged lines').toBeTruthy();
    expect(await rotation(capeKey, { context: { ...STRAND, month: 7 } })).toContain(capeLine);
    expect(await rotation(capeKey, { context: { ...JOBURG, month: 7 } })).not.toContain(capeLine);
  });

  it('Afrikaans inherits the tag of the English line it translates', async () => {
    const af = heroLinesAf.heroLineAf(winterLine);
    expect(af, 'the winter line has no Afrikaans').toBeTruthy();
    expect(await rotation(winterKey, { lang: 'af', context: { ...STRAND, month: 1 } })).not.toContain(af);
    expect(await rotation(winterKey, { lang: 'af', context: { ...STRAND, month: 7 } })).toContain(af);
  });

  it('a photograph with nothing in season keeps the condition line — never blank', async () => {
    const key = slotKeys[0];
    const allWinter = Object.fromEntries(heroLines.HERO_LINES[key].map((l) => [l, { months: [6, 7, 8] }]));
    const en = { ...heroLines, HERO_LINE_TAGS: allWinter };
    const h = harness({ en, context: { ...STRAND, month: 1 } });
    await h.loadBespokeTable('en');
    expect(h.applyBespokeLine(srcFor(key))).toBe(false);
    expect(h.headlineEl.textContent).toBe('Condition line');
    h.ctx.month = 7;
    expect(h.applyBespokeLine(srcFor(key))).toBe(true);
    expect(heroLines.HERO_LINES[key]).toContain(h.headlineEl.textContent);
  });

  it('a remembered line that has gone out of season is re-picked from what is in season', async () => {
    const lines = heroLines.HERO_LINES[winterKey];
    const idx = lines.indexOf(winterLine);
    vi.spyOn(Math, 'random').mockReturnValue((idx + 0.5) / lines.length);
    const h = harness({ context: { ...STRAND, month: 7 } });
    await h.loadBespokeTable('en');
    h.applyBespokeLine(srcFor(winterKey));
    expect(h.headlineEl.textContent).toBe(winterLine);
    h.ctx.month = 1;
    h.applyBespokeLine(srcFor(winterKey));
    expect(h.headlineEl.textContent).not.toBe(winterLine);
    expect(lines).toContain(h.headlineEl.textContent);
  });
});

describe('HERO_LINE_TAGS carries every bank line\'s months and region', () => {
  it('each bespoke line that came from the bank keeps its bank months/region tag (or Al\'s ruling)', () => {
    const ruledPath = new URL('../review/seasonal-tags-ruled.json', import.meta.url);
    const ruled = new Set(existsSync(ruledPath)
      ? JSON.parse(readFileSync(ruledPath, 'utf8')).rulings.filter((r) => r.kind === 'bespoke').map((r) => r.en) : []);
    const live = new Set(Object.values(heroLines.HERO_LINES).flat());
    let checked = 0;
    for (const ns of ['witty', 'witty_low_confidence']) for (const [bin, langs] of Object.entries(WEATHER_COPY[ns])) {
      (langs.en || []).forEach((text, i) => {
        const tag = WITTY_DAY_TAGS[ns]?.[bin]?.[i];
        if (!live.has(text) || ruled.has(text) || !tag || typeof tag !== 'object' || !(tag.months || tag.region)) return;
        if (tag.months) expect(TAGS[text]?.months, text).toEqual([...tag.months].sort((a, b) => a - b));
        if (tag.region) expect(TAGS[text]?.region, text).toEqual(tag.region);
        checked += 1;
      });
    }
    // 77 before the provenance cull (2026-09-20), 76 after: one tagged bank line
    // came off its photograph with the 417. The floor guards against tags being
    // dropped in bulk, so it tracks the real count rather than being loosened.
    expect(checked).toBeGreaterThanOrEqual(76);
  });

  it('every tag is keyed by a live English line and carries only months and region', () => {
    const live = new Set(Object.values(heroLines.HERO_LINES).flat());
    for (const [line, tag] of Object.entries(TAGS)) {
      expect(live.has(line), line).toBe(true);
      expect(Object.keys(tag).every((k) => k === 'months' || k === 'region'), line).toBe(true);
    }
  });
});
