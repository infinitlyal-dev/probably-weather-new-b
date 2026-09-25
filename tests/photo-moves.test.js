import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';

import { heroCropDesktopFor, heroCropFor } from '../assets/hero-crop.js';
import { HERO_LINES } from '../assets/hero-lines.js';
import { heroLineAf } from '../assets/hero-lines-af.js';
import { scanBackgroundSlots } from '../scripts/image-slot-manifest.mjs';

// Al's photo moves, 2026-09-23 (scripts/apply-photo-moves.mjs): the dog from
// review/cold-move-ruled.json and the MOVE rows of review/bucket-check-ruled.json.
// His method: weeks 2 and 4 of a slot at the same time of day in the new bucket, the
// photograph already there keeps weeks 1 and 3, the moved one is benched from its old
// slots, no two moved photographs share a slot, the crop anchor and the lines travel,
// and a line no longer true in the new bucket is held back.

const read = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));
const bucket = read('../review/bucket-check-ruled.json');
const dogRuling = read('../review/cold-move-ruled.json');
const bench = read('../review/benched-photos.json').benched;
const final = read('../review/set-001-lines-bespoke-final.json');
const anchors = read('../review/set-001-crop-anchors.json').anchors;
const moves = bucket.rows.filter((r) => r.verdict === 'MOVE');
// The pilot pairs (review/pilot-pairs.json, 2026-09-25) filled every old slot of two moved photos (the
// dog, and the washing photo moved to cold-clear). Their bench entries had to leave the bench file —
// an entry with no slots left reads as benched everywhere — and are kept whole in the pairs record.
// The move itself is unchanged: each photo is still served where Al moved it.
const pairsRecord = read('../review/pilot-pairs.json');
const superseded = new Map((pairsRecord.applied?.benchChanges || []).filter((c) => c.removed).map((c) => [c.sha1, c.entry]));
const pairHashAt = new Map((pairsRecord.applied?.applied || []).flatMap((a) => a.slots.map((s) => [s, a.hash])));
const benchOf = new Map([...superseded, ...bench.map((b) => [b.sha1, b])]);
const BG = (rel) => new URL(`../assets/images/bg/${rel}`, import.meta.url);
const sha1Of = (rel) => createHash('sha1').update(readFileSync(BG(rel))).digest('hex').slice(0, 12);
const sha256Of = (rel) => createHash('sha256').update(readFileSync(BG(rel))).digest('hex');
const src = (key) => `assets/images/${key}`;
const WEEKDAY = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|maandag|dinsdag|woensdag|donderdag|vrydag|saterdag|sondag)\b/i;
let scan;
let servedAt;
beforeAll(() => {
  scan = scanBackgroundSlots(new URL('../assets/images/bg/', import.meta.url));
  servedAt = new Map(scan.entries.map((e) => [e.relativePath, e.servedPath.replace(/\\/g, '/').split('/assets/images/bg/')[1]]));
}, 60000);

describe('photo moves — Al\'s rulings of 2026-09-23', () => {
  it('all seven MOVE rows are on the bench, benched from exactly their old slots', () => {
    expect(moves.map((r) => r.n).sort((a, b) => a - b)).toEqual([40, 58, 66, 69, 70, 79, 90]);
    for (const r of moves) {
      const b = benchOf.get(r.sha1);
      expect(b, `#${r.n}`).toBeTruthy();
      expect(b.slots).toEqual(r.slots);
      for (const s of r.slots) {
        if (pairHashAt.has(s)) expect(sha1Of(s), `#${r.n} ${s} holds its pilot pair`).toBe(pairHashAt.get(s));
        else expect(servedAt.get(s), `#${r.n} ${s}`).toBe(b.fallback);
      }
    }
  });

  it('the three KEEP rows are untouched: in their slots, off the bench', () => {
    for (const r of bucket.rows.filter((x) => x.verdict === 'KEEP')) {
      expect(benchOf.has(r.sha1), `#${r.n}`).toBe(false);
      for (const s of r.slots) { expect(sha1Of(s)).toBe(r.sha1); expect(servedAt.get(s)).toBe(s); }
    }
  });

  it('the dog is where Al ruled: cold Tuesday dusk, weeks 2 and 4', () => {
    expect(dogRuling.verdict).toBe('YES');
    expect(benchOf.get(dogRuling.photo.sha1).movedTo).toEqual(dogRuling.proposedTo);
  });

  it('each placed photograph takes weeks 2 and 4 of its own weekday, same time of day, in the bucket Al named', () => {
    const placed = moves.filter((r) => benchOf.get(r.sha1).movedTo);
    expect(placed).toHaveLength(6);
    const taken = new Set();
    for (const r of placed) {
      const dest = benchOf.get(r.sha1).movedTo;
      expect(dest).toHaveLength(2);
      const [f2, w2, t2, n2] = dest[0].split('/');
      const [f4, w4, t4, n4] = dest[1].split('/');
      const [, , tOld, nOld] = r.slots[0].split('/');
      expect([f2, f4]).toEqual([r.moveTo, r.moveTo]);
      expect([w2, w4]).toEqual(['week_2', 'week_4']);
      expect([t2, t4]).toEqual([tOld, tOld]);
      expect([n2, n4]).toEqual([nOld, nOld]);
      for (const s of dest) {
        expect(taken.has(s), `two moved photographs on ${s}`).toBe(false);
        taken.add(s);
        expect(sha1Of(s)).toBe(r.sha1);
        expect(servedAt.get(s)).toBe(s);
      }
      // the photograph already there keeps weeks 1 and 3
      const w1 = dest[0].replace('week_2', 'week_1'), w3 = dest[0].replace('week_2', 'week_3');
      expect(sha1Of(w1)).toBe(sha1Of(w3));
      expect(sha1Of(w1)).not.toBe(r.sha1);
      expect(servedAt.get(w1)).toBe(w1);
    }
  });

  it('crop anchors travel: phone and desktop crops at the new slots are the photograph\'s own', () => {
    for (const r of moves.filter((x) => benchOf.get(x.sha1).movedTo)) {
      // keyed by the photograph's own bytes at its new slot (an old slot may now hold a pilot pair)
      const own = benchOf.get(r.sha1).movedTo[0];
      expect(sha1Of(own), `${r.n} ${own}`).toBe(r.sha1);
      const canon = `bg-canonical/${sha256Of(own)}.webp`;
      for (const s of benchOf.get(r.sha1).movedTo) {
        expect(heroCropFor(src(`bg/${s}`)), `${r.n} ${s}`).toBe(heroCropFor(src(canon)));
        expect(heroCropDesktopFor(src(`bg/${s}`)), `${r.n} ${s}`).toBe(anchors[r.sha1]?.anchorY ?? null);
      }
    }
  });

  it('lines travel, and the ones not true in the new bucket are held back and listed', () => {
    const held = final.heldBack || [];
    expect(held.map((h) => h.hash).sort()).toEqual(['c6d4061cbef2', 'd003110fec9f']);
    for (const r of moves.filter((x) => benchOf.get(x.sha1).movedTo)) {
      const entry = final.set.find((e) => e.hash === r.sha1);
      // keyed by the photograph's own bytes at its new slot (an old slot may now hold a pilot pair)
      const own = benchOf.get(r.sha1).movedTo[0];
      expect(sha1Of(own), `${r.n} ${own}`).toBe(r.sha1);
      const canon = `bg-canonical/${sha256Of(own)}.webp`;
      expect(entry.condition).toBe(r.moveTo);
      expect(HERO_LINES[canon]).toEqual(entry.lines);
      for (const s of benchOf.get(r.sha1).movedTo) expect(HERO_LINES[`bg/${s}`]).toEqual(entry.lines);
      for (const h of held.filter((x) => x.hash === r.sha1)) {
        expect(h.reason.length).toBeGreaterThan(20);
        expect(entry.lines).not.toContain(h.line);
      }
    }
  });

  it('#79 is off the cold slots and waits for Al\'s rain slot; it is served nowhere meanwhile', () => {
    const b = benchOf.get('77dad643efa6');
    expect(b.movedTo).toBeNull();
    expect(b.pending).toMatch(/Al names the slot/);
    expect(scan.servedNowhere.has(b.sha256)).toBe(true);
  });

  it('no benched slot serves a photograph whose line names a weekday — it would be on screen on another day', () => {
    for (const b of bench) {
      const h = sha1Of(b.fallback);
      const entry = final.set.find((e) => e.hash === h);
      for (const l of entry?.lines || []) {
        expect(WEEKDAY.test(l), `${b.fallback}: "${l}"`).toBe(false);
        expect(WEEKDAY.test(heroLineAf(l) || ''), `${b.fallback}: "${heroLineAf(l)}"`).toBe(false);
      }
    }
    // cloudy dawn's week-collapse slot carries "…matched my Monday", so #40's Friday slots skip it
    expect(benchOf.get('3bfd9b9470d6').fallback).toBe('cloudy/week_1/dawn/2.webp');
    expect(benchOf.get('3bfd9b9470d6').fallbackSkipped[0]).toMatch(/cloudy\/week_1\/dawn\/1\.webp: "Grey vibes\. The sky matched my Monday\."/);
  });
});
