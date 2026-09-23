import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';

import { CURATED_BODIES, loadBench, scanBackgroundSlots } from '../scripts/image-slot-manifest.mjs';

const imageRoot = new URL('../assets/images/bg/', import.meta.url);
let manifest;
let sourceHashes;
const rel = (p) => p.replace(/\\/g, '/').split('/assets/images/bg/')[1];

beforeAll(() => {
  manifest = scanBackgroundSlots(imageRoot);
  sourceHashes = manifest.entries.map((e) => createHash('sha256').update(readFileSync(e.sourcePath)).digest('hex'));
}, 60000);

describe('P9 background slot manifest', () => {
  // 294 unique bodies since 2026-09-06, not 644: Al ruled the app serves set-001 only, so the
  // 532 slots that held uncurated photographs (and therefore could never carry a bespoke
  // line) now hold copies of curated ones from the same condition and time-of-day. set-002
  // raises this again as new curated photographs replace those repeats.
  it('P9 the source tree still holds the 294 curated bodies in 1008 slots', () => {
    expect(manifest.entries).toHaveLength(1008);
    expect(new Set(sourceHashes).size).toBe(CURATED_BODIES);
  });

  it('P9 represents all 1008 picker slots with the curated bodies minus those the bench leaves served nowhere, exactly once', () => {
    expect(manifest.slots).toHaveLength(1008);
    expect(manifest.hashes).toHaveLength(CURATED_BODIES - manifest.servedNowhere.size);
    expect(new Set(manifest.slots).size).toBe(CURATED_BODIES - manifest.servedNowhere.size);
  });

  it('P9 resolves every slot to the bytes it serves: its own, or its fallback when benched', () => {
    for (let i = 0; i < manifest.entries.length; i++) {
      const e = manifest.entries[i];
      const served = createHash('sha256').update(readFileSync(e.servedPath)).digest('hex');
      expect(manifest.hashes[manifest.slots[i]]).toBe(served);
      if (!e.benched) expect(e.servedPath).toBe(e.sourcePath);
    }
  }, 60000);

  it('P9 a benched slot never serves the photograph it was benched from, and falls back within its own folder and time of day', () => {
    const benchedSlots = manifest.entries.filter((x) => x.benched);
    expect(benchedSlots.length).toBeGreaterThan(0);
    for (const e of benchedSlots) {
      const [folder, , time] = e.relativePath.split('/');
      const [f, , t] = rel(e.servedPath).split('/');
      expect(f).toBe(folder);
      expect(t).toBe(time);
      expect(e.hash).not.toBe(e.sourceHash);
    }
  });

  it('P9 a slot-scoped bench entry benches exactly its slots, each onto the fallback it names', () => {
    const bench = loadBench();
    const benchedSlots = new Set(manifest.entries.filter((x) => x.benched).map((x) => x.relativePath));
    const named = [...bench.bySlot.keys()];
    expect(named.length).toBeGreaterThan(0);
    for (const s of named) expect(benchedSlots.has(s), s).toBe(true);
    for (const s of benchedSlots) expect(bench.bySlot.has(s) || bench.everywhere.size > 0, s).toBe(true);
    for (const e of manifest.entries.filter((x) => x.benched)) {
      const fallback = bench.bySlot.get(e.relativePath)?.fallback;
      if (fallback) expect(rel(e.servedPath)).toBe(fallback);
    }
  });

  it('P9 refuses a bench entry that names a slot now holding other bytes', () => {
    const bench = loadBench();
    const [slot, rule] = [...bench.bySlot.entries()][0];
    const lying = { ...bench, bySlot: new Map([[slot, { ...rule, sha256: '0'.repeat(64) }]]) };
    expect(() => scanBackgroundSlots(imageRoot, { bench: lying })).toThrow(/re-rule/);
  });

  it('P9 an entry with no slots still benches its photograph everywhere', () => {
    const dog = manifest.entries.find((e) => e.relativePath === 'cold/week_2/dusk/2.webp');
    const bench = { entries: [{ sha256: dog.sourceHash }], bySlot: new Map(), everywhere: new Set([dog.sourceHash]) };
    const scan = scanBackgroundSlots(imageRoot, { bench });
    const hit = scan.entries.filter((e) => e.sourceHash === dog.sourceHash);
    expect(hit.length).toBeGreaterThan(0);
    for (const e of hit) expect(e.benched).toBe(true);
    expect(scan.servedNowhere.has(dog.sourceHash)).toBe(true);
  }, 60000);

  it('the dog benched on 2026-09-23 leaves cloudy Tuesday dusk to the cyclist and is served in cold Tuesday dusk, weeks 2 and 4', () => {
    const dogSha = manifest.entries.find((e) => e.relativePath === 'cloudy/week_1/dusk/2.webp').sourceHash;
    for (const w of [1, 2, 3, 4]) {
      const e = manifest.entries.find((x) => x.relativePath === `cloudy/week_${w}/dusk/2.webp`);
      expect(e.benched).toBe(true);
      expect(rel(e.servedPath)).toBe('cloudy/week_1/dusk/1.webp');
    }
    for (const w of [2, 4]) expect(manifest.entries.find((x) => x.relativePath === `cold/week_${w}/dusk/2.webp`).hash).toBe(dogSha);
    for (const w of [1, 3]) expect(manifest.entries.find((x) => x.relativePath === `cold/week_${w}/dusk/2.webp`).hash).not.toBe(dogSha);
  });
});
