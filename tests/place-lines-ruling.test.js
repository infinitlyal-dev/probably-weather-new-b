import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { REGION_BOXES } from '../assets/geo-regions.js';
import { heroCropKey } from '../assets/hero-crop.js';
import * as heroLines from '../assets/hero-lines.js';
import * as heroLinesAf from '../assets/hero-lines-af.js';
import { WEATHER_COPY } from '../assets/weather-copy.js';
import { WITTY_DAY_TAGS, contextTagAllows, eligibleWittyPool, regionTagAllows } from '../assets/witty-day-tags.js';

// Al's place ruling, review/place-lines-ruled.json (2026-09-23), wired by
// scripts/apply-place-ruling.mjs. A line that names a place shows only inside the
// region Al ruled — on its photograph (English and Afrikaans, HERO_LINE_TAGS) and in
// the condition bank, which is what isiZulu, isiXhosa, Sesotho and the share cards
// serve (WITTY_DAY_TAGS). P46 and P47 name the N1, which runs through four boxes, so
// their region is a LIST: the line shows to anyone inside any of them.

const read = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));
const RULED = read('../review/place-lines-ruled.json').rulings;
const PAGE = new Map(read('../review/place-lines-worklist.json').rows.map((r) => [r.key, r]));
const byKey = new Map(RULED.map((r) => [r.key, r]));
const N1 = ['western-cape', 'karoo', 'free-state', 'gauteng'];
const P = {
  strand: { lat: -34.1163, lon: 18.8362 },
  beaufortWest: { lat: -32.3567, lon: 22.583 },
  bloemfontein: { lat: -29.0852, lon: 26.1596 },
  joburg: { lat: -26.2041, lon: 28.0473 },
  durban: { lat: -29.8587, lon: 31.0218 },
  gqeberha: { lat: -33.9608, lon: 25.6022 },
  nelspruit: { lat: -25.4658, lon: 30.9853 },
};
const ON_THE_N1 = ['strand', 'beaufortWest', 'bloemfontein', 'joburg'];
const OFF_THE_N1 = ['durban', 'gqeberha', 'nelspruit'];
const bankRow = (key, en) => {
  const [ns, rest] = key.split(':');
  const bin = rest.split('#')[0];
  const i = WEATHER_COPY[ns][bin].en.indexOf(en);
  return { ns, bin, i, tag: WITTY_DAY_TAGS[ns]?.[bin]?.[i] };
};

afterEach(() => vi.restoreAllMocks());

describe('a region tag can be a list of boxes', () => {
  it('the ruling really does carry a list for P46 and P47', () => {
    expect(byKey.get('P46').region).toEqual(N1);
    expect(byKey.get('P47').region).toEqual(N1);
  });

  it('the line shows inside any listed box and nowhere else', () => {
    for (const p of ON_THE_N1) expect(regionTagAllows(N1, P[p].lat, P[p].lon), p).toBe(true);
    for (const p of OFF_THE_N1) expect(regionTagAllows(N1, P[p].lat, P[p].lon), p).toBe(false);
  });

  it('a one-box list behaves exactly like the bare box name', () => {
    for (const p of Object.keys(P)) {
      for (const box of Object.keys(REGION_BOXES)) {
        expect(regionTagAllows([box], P[p].lat, P[p].lon), `${box} at ${p}`).toBe(regionTagAllows(box, P[p].lat, P[p].lon));
      }
    }
  });

  it('with no coordinates a list fails open, as a single box does', () => {
    expect(regionTagAllows(N1, undefined, undefined)).toBe(true);
    expect(contextTagAllows({ region: N1 }, {})).toBe(true);
  });

  it('every region name anywhere is a real box — an unknown name would show everywhere', () => {
    const names = [];
    for (const ns of Object.values(WITTY_DAY_TAGS)) for (const bin of Object.values(ns)) for (const t of Object.values(bin)) {
      if (t && typeof t === 'object' && t.region) names.push(...[].concat(t.region));
    }
    for (const t of Object.values(heroLines.HERO_LINE_TAGS)) if (t.region) names.push(...[].concat(t.region));
    expect(names.length).toBeGreaterThan(100);
    for (const n of names) expect(REGION_BOXES[n], n).toBeTruthy();
  });
});

describe('the N1 lines through every path that serves them', () => {
  const P46 = byKey.get('P46').en;
  const P47 = byKey.get('P47').en;

  it('condition bank (isiZulu, isiXhosa, Sesotho screens and every share card): in on the N1, out off it', () => {
    const r8 = bankRow('witty:rain#8', P46);
    const r56 = bankRow('witty:rain#56', P47);
    expect(r8.tag.region).toEqual(N1);
    expect(r56.tag.region).toEqual(N1);
    // A Wednesday in November at 13:00 — rain#56 is a daytime, October–March line.
    for (const lang of ['en', 'zu', 'xh', 'st']) {
      const bank = WEATHER_COPY.witty.rain[lang];
      for (const p of ON_THE_N1) {
        const { pool } = eligibleWittyPool({ copy: WEATHER_COPY, condition: 'rain', lang, context: { day: 3, hour: 13, month: 11, ...P[p] } });
        expect(pool, `${lang} ${p}`).toContain(bank[r8.i]);
        expect(pool, `${lang} ${p}`).toContain(bank[r56.i]);
      }
      for (const p of OFF_THE_N1) {
        const { pool } = eligibleWittyPool({ copy: WEATHER_COPY, condition: 'rain', lang, context: { day: 3, hour: 13, month: 11, ...P[p] } });
        expect(pool, `${lang} ${p}`).not.toContain(bank[r8.i]);
        expect(pool, `${lang} ${p}`).not.toContain(bank[r56.i]);
      }
    }
  });

  it('the share card builds its witty context with the viewer\'s coordinates', () => {
    const og = readFileSync(new URL('../api/og.js', import.meta.url), 'utf8');
    expect(og).toMatch(/const wittyContext = \{[^}]*lat: locationLat, lon: locationLon[^}]*\}/);
    expect(og).toMatch(/eligibleWittyPool\(/);
  });

  // The real bespoke block, lifted out of assets/app.js (as bespoke-line-season.test.js does).
  const src = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
  const block = src.slice(src.indexOf('  const __lineMemo = new Map();'), src.indexOf('  function setBackgroundFor('));
  const key = Object.keys(heroLines.HERO_LINES).find((k) => k.startsWith('bg/') && heroLines.HERO_LINES[k].includes(P46));
  const srcFor = (k) => {
    for (const prefix of ['assets/images/', '/assets/images/', '']) if (heroCropKey(prefix + k) === k) return prefix + k;
    throw new Error(`no src resolves to ${k}`);
  };
  async function rotation(lang, context) {
    const shown = new Set();
    const make = new Function('headlineEl', 'settings', 'safeText', 'debugLog', 'heroCropKey', '__importEn', '__importAf',
      'contextTagAllows', 'bespokeTagContext',
      `${block.replace("import('./hero-lines.js')", '__importEn()').replace("import('./hero-lines-af.js')", '__importAf()')}\nreturn { applyBespokeLine, loadBespokeTable };`);
    for (let i = 0; i < 16; i++) {
      vi.spyOn(Math, 'random').mockReturnValue((i + 0.5) / 16);
      const headlineEl = { textContent: 'Condition line' };
      const api = make(headlineEl, { lang }, (el, t) => { el.textContent = t; }, () => {}, heroCropKey,
        async () => heroLines, async () => heroLinesAf, contextTagAllows, () => context);
      await api.loadBespokeTable('en'); await api.loadBespokeTable(lang);
      if (api.applyBespokeLine(srcFor(key))) shown.add(headlineEl.textContent);
      vi.restoreAllMocks();
    }
    return [...shown];
  }

  it('photograph (English and Afrikaans): the real bespoke path shows them on the N1 and not off it', async () => {
    expect(key, 'no photograph carries P46').toBeTruthy();
    expect(heroLines.HERO_LINE_TAGS[P46].region).toEqual(N1);
    expect(heroLines.HERO_LINE_TAGS[P47].region).toEqual(N1);
    for (const lang of ['en', 'af']) {
      const want = lang === 'en' ? [P46, P47] : [heroLinesAf.heroLineAf(P46), heroLinesAf.heroLineAf(P47)];
      expect(want.every(Boolean), `${lang}: missing a translation`).toBe(true);
      for (const p of ON_THE_N1) {
        const shown = await rotation(lang, { ...P[p], month: 11 });
        for (const w of want) expect(shown, `${lang} ${p}`).toContain(w);
      }
      for (const p of OFF_THE_N1) {
        const shown = await rotation(lang, { ...P[p], month: 11 });
        for (const w of want) expect(shown, `${lang} ${p}`).not.toContain(w);
      }
    }
  });
});

describe('Al\'s place ruling is what is wired', () => {
  const live = new Set(Object.values(heroLines.HERO_LINES).flat());

  // Al's season ruling (review/seasonal-ruled.json, 2026-09-23) came after this one and
  // CUT eleven of the tagged lines. A CUT leaves every language, so for those the region
  // is history: the line must be off every photograph, out of the Afrikaans table and
  // out of the bank. Every other TAG row still carries its region everywhere.
  const SEASON_CUT = new Set(read('../review/seasonal-ruled.json').rulings.filter((r) => r.verdict === 'CUT').map((r) => r.en));

  it('every TAG row carries its region on its photograph and on every bank copy', () => {
    const tagged = RULED.filter((r) => r.verdict === 'TAG');
    expect(tagged.length).toBe(56);
    const stillTagged = tagged.filter((r) => !SEASON_CUT.has(r.en));
    expect(stillTagged.length).toBe(45);
    for (const r of stillTagged) {
      expect(live.has(r.en), r.key).toBe(true);
      expect(heroLines.HERO_LINE_TAGS[r.en]?.region, r.key).toEqual(r.region);
      for (const b of PAGE.get(r.key).alsoBank || []) expect(bankRow(b.key, r.en).tag?.region, `${r.key} ${b.key}`).toEqual(r.region);
    }
  });

  it('a TAG row whose line the season ruling cut is gone from photographs, the Afrikaans table and the bank', () => {
    const cut = RULED.filter((r) => r.verdict === 'TAG' && SEASON_CUT.has(r.en));
    expect(cut.map((r) => r.key)).toEqual(['P02', 'P03', 'P05', 'P06', 'P07', 'P12', 'P24', 'P33', 'P34', 'P51', 'P54']);
    for (const r of cut) {
      expect(live.has(r.en), r.key).toBe(false);
      expect(heroLines.HERO_LINE_TAGS[r.en], r.key).toBeUndefined();
      expect(heroLinesAf.heroLineAf(r.en), r.key).toBeFalsy();
      for (const b of PAGE.get(r.key).alsoBank || []) expect(bankRow(b.key, r.en).i, `${r.key} ${b.key}`).toBe(-1);
    }
  });

  it('P14 names the Northern Cape and is ruled karoo, which has no Northern Cape box of its own', () => {
    expect(REGION_BOXES['northern-cape']).toBeUndefined();
    expect(heroLines.HERO_LINE_TAGS[byKey.get('P14').en].region).toBe('karoo');
  });

  it('P21, P35 and P41 are off every photograph, in English and Afrikaans', () => {
    for (const k of ['P21', 'P35', 'P41']) {
      const r = byKey.get(k);
      expect(r.verdict).toBe('CUT');
      expect(live.has(r.en), k).toBe(false);
      expect(heroLinesAf.heroLineAf(r.en), k).toBeFalsy();
      expect(PAGE.get(k).alsoBank || []).toEqual([]);
    }
  });

  it('P15, P25 and P55 are exactly as they were: two untagged, P55 on its karoo tag', () => {
    for (const k of ['P15', 'P25']) {
      const r = byKey.get(k);
      expect(r.verdict).toBe('KEEP');
      expect(live.has(r.en), k).toBe(true);
      expect(heroLines.HERO_LINE_TAGS[r.en], k).toBeUndefined();
      for (const b of PAGE.get(k).alsoBank) expect(bankRow(b.key, r.en).tag?.region, k).toBeUndefined();
    }
    const p55 = byKey.get('P55');
    expect(heroLines.HERO_LINE_TAGS[p55.en]).toEqual({ region: 'karoo' });
    expect(bankRow('witty:cold-clear#16', p55.en).tag).toEqual({ region: 'karoo', time: ['morning'] });
  });
});
