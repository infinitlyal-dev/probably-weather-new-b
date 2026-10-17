// Hero pairs (Al + Maat, 14 Oct 2026): a photograph and its line made as one idea, served outside the slot grid by its
// own rules — a condition folder, the times of day and the SAST weekdays it fits — taking ONE of those days per week
// in its cell while the library serves the others (assets/image-picker.js pickHeroPair, review/hero-pairs.json).
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import sharp from 'sharp';
import {
  DAY_MS, WEEK_ANCHOR_MS, WEEK_MS, HERO_PAIRS, HERO_PAIRS_URL_VERSION,
  getAbsoluteWeek, getRotationDay, heroPairPath, pickHeroPair,
} from '../assets/image-picker.js';
import { heroCropKey } from '../assets/hero-crop.js';
import { HERO_LINES, heroLinesForKey } from '../assets/hero-lines.js';
import { heroLineAf } from '../assets/hero-lines-af.js';
import { loadHeroPairs, heroPairsBlock } from '../scripts/build-hero-pairs.mjs';

// Noon SAST on weekday `day` (Mon=1 … Sun=7) of absolute week `week`.
const at = (week, day) => WEEK_ANCHOR_MS + week * WEEK_MS + (day - 1) * DAY_MS + 12 * 3600 * 1000;
const FIXTURE = [
  { id: 'weekday', folder: 'clear', times: ['dawn'], days: [1, 2, 3, 4, 5] },
  { id: 'weekend', folder: 'clear', times: ['dawn'], days: [6, 7] },
  { id: 'anyday', folder: 'clear', times: ['dawn'], days: [1, 2, 3, 4, 5, 6, 7] },
  { id: 'other', folder: 'rain', times: ['night'], days: [1, 2, 3, 4, 5, 6, 7] },
];
const daysOf = (id, week, folder = 'clear', time = 'dawn', pairs = FIXTURE) =>
  [1, 2, 3, 4, 5, 6, 7].filter((d) => pickHeroPair(folder, time, at(week, d), pairs)?.id === id);

describe('pickHeroPair — the rotation rule', () => {
  it('the clock helpers agree with the fixture dates', () => {
    for (let d = 1; d <= 7; d++) expect(getRotationDay(at(9, d))).toBe(d);
    expect(getAbsoluteWeek(at(9, 3))).toBe(9);
    expect(getAbsoluteWeek(WEEK_ANCHOR_MS - 1)).toBe(0);
    expect(getAbsoluteWeek(NaN)).toBe(0);
  });

  it('serves a pair only in its own folder and time of day', () => {
    for (let w = 0; w < 6; w++) for (let d = 1; d <= 7; d++) {
      expect(pickHeroPair('cloudy', 'dawn', at(w, d), FIXTURE)).toBeNull();
      expect(['other', undefined]).toContain(pickHeroPair('rain', 'night', at(w, d), FIXTURE)?.id);
      expect(pickHeroPair('clear', 'day', at(w, d), FIXTURE)).toBeNull();
    }
  });

  it('gives each pair exactly one day a week, always one of its own days', () => {
    for (let w = 0; w < 30; w++) {
      for (const p of FIXTURE) {
        const got = daysOf(p.id, w, p.folder, p.times[0]);
        expect(got, `${p.id} in week ${w}`).toHaveLength(1);
        expect(p.days).toContain(got[0]);
      }
    }
  });

  it('never gives two pairs in one cell the same day, and leaves the library the rest of the week', () => {
    for (let w = 0; w < 30; w++) {
      const ids = [1, 2, 3, 4, 5, 6, 7].map((d) => pickHeroPair('clear', 'dawn', at(w, d), FIXTURE)?.id).filter(Boolean);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).toHaveLength(3);
    }
  });

  it('a one-day pair is never crowded out by an any-day pair in the same cell', () => {
    const pairs = [{ id: 'any', folder: 'heat', times: ['day'], days: [1, 2, 3, 4, 5, 6, 7] }, { id: 'sat', folder: 'heat', times: ['day'], days: [6] }];
    for (let w = 0; w < 30; w++) {
      expect(daysOf('sat', w, 'heat', 'day', pairs), `week ${w}`).toEqual([6]);
      const any = daysOf('any', w, 'heat', 'day', pairs);
      expect(any).toHaveLength(1);
      expect(any[0]).not.toBe(6);
    }
  });

  it('moves through every allowed day over the weeks', () => {
    for (const p of FIXTURE.slice(0, 3)) {
      const seen = new Set();
      for (let w = 0; w < 40; w++) seen.add(daysOf(p.id, w)[0]);
      expect([...seen].sort(), p.id).toEqual([...p.days].sort());
    }
  });

  it('is deterministic for a cell and a day', () => {
    const t = at(12, 4);
    expect(pickHeroPair('clear', 'dawn', t, FIXTURE)).toBe(pickHeroPair('clear', 'dawn', t + 3600 * 1000, FIXTURE));
  });
});

describe('the shipped pairs', () => {
  const pairs = loadHeroPairs(); // throws on a missing file, moved bytes, bad rules or no stranger-read sentence

  it('the picker table is the one review/hero-pairs.json generates', () => {
    const src = readFileSync(new URL('../assets/image-picker.js', import.meta.url), 'utf8');
    expect(src).toContain(heroPairsBlock(pairs));
    expect(HERO_PAIRS.map((p) => p.id)).toEqual(pairs.map((p) => p.id));
    for (const p of pairs) {
      const t = HERO_PAIRS.find((x) => x.id === p.id);
      expect({ folder: t.folder, times: t.times, days: t.days }).toEqual({ folder: p.folder, times: p.times, days: p.days });
    }
  });

  it('every photograph is a 1008x1792 WebP inside the background budget, with the bytes its line was written about', async () => {
    for (const p of pairs) {
      const file = new URL(`../${p.image}`, import.meta.url);
      const bytes = readFileSync(file);
      expect(createHash('sha1').update(bytes).digest('hex').slice(0, 12), p.id).toBe(p.sha1);
      expect(statSync(file).size, p.id).toBeLessThanOrEqual(300 * 1024);
      const meta = await sharp(bytes).metadata();
      expect([meta.format, meta.width, meta.height], p.id).toEqual(['webp', 1008, 1792]);
    }
  });

  it('the picker URL resolves to the key its line and crop are filed under', () => {
    for (const p of pairs) {
      const url = heroPairPath(p);
      expect(url).toBe(`assets/images/bg-pairs/${p.id}.webp?v=${HERO_PAIRS_URL_VERSION}`);
      expect(heroCropKey(url)).toBe(`bg-pairs/${p.id}.webp`);
      expect(heroLinesForKey(heroCropKey(url))).toEqual(p.lines);
    }
  });

  it('every line ships in English and Afrikaans, and only on its own photograph', () => {
    const owners = new Map();
    for (const [key, lines] of Object.entries(HERO_LINES)) for (const l of lines) owners.set(l, [...(owners.get(l) || []), key]);
    for (const p of pairs) {
      for (const l of p.lines) {
        expect(owners.get(l), l).toEqual([`bg-pairs/${p.id}.webp`]);
        const af = heroLineAf(l);
        expect(af, l).toBe(p.af);
        expect(af).not.toBe(l);
      }
    }
  });

  it('every pair is served somewhere: each takes a day in its cell every week', () => {
    for (const p of pairs) {
      for (let w = 20; w < 24; w++) {
        const got = [1, 2, 3, 4, 5, 6, 7].filter((d) => pickHeroPair(p.folder, p.times[0], at(w, d))?.id === p.id);
        expect(got, `${p.id} in week ${w}`).toHaveLength(1);
      }
    }
  });

  it('app.js puts the pair in front of the slot chain, so the library photograph stays as its fallback', () => {
    const app = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
    expect(app).toContain('const pair = pickHeroPair(folder, timeOfDay);');
    expect(app).toContain('const chain = pair ? [heroPairPath(pair), ...slotChain] : slotChain;');
  });
});
