import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';

import { CURATED_BODIES, loadBenchedHashes, scanBackgroundSlots } from '../scripts/image-slot-manifest.mjs';

const imageRoot = new URL('../assets/images/bg/', import.meta.url);
let manifest;
let sourceHashes;

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

  it('P9 represents all 1008 picker slots with the curated bodies minus the benched ones, exactly once', () => {
    const benchedInTree = new Set(sourceHashes.filter((h) => manifest.benched.has(h)));
    expect(manifest.slots).toHaveLength(1008);
    expect(manifest.hashes).toHaveLength(CURATED_BODIES - benchedInTree.size);
    expect(new Set(manifest.slots).size).toBe(CURATED_BODIES - benchedInTree.size);
  });

  it('P9 resolves every slot to the bytes it serves: its own, or the week-collapse fallback when benched', () => {
    for (let i = 0; i < manifest.entries.length; i++) {
      const e = manifest.entries[i];
      const served = createHash('sha256').update(readFileSync(e.servedPath)).digest('hex');
      expect(manifest.hashes[manifest.slots[i]]).toBe(served);
      if (!e.benched) expect(e.servedPath).toBe(e.sourcePath);
    }
  }, 60000);

  it('P9 a benched photograph is served nowhere, and its slots fall back within the same folder and time of day', () => {
    const benched = loadBenchedHashes();
    expect(benched.size).toBeGreaterThan(0);
    for (const h of benched) expect(manifest.hashes).not.toContain(h);
    for (const e of manifest.entries.filter((x) => x.benched)) {
      const [folder, , time] = e.relativePath.split('/');
      const servedRel = e.servedPath.replace(/\\/g, '/').split('/assets/images/bg/')[1];
      expect(servedRel.split('/')[0]).toBe(folder);
      expect(servedRel.split('/')[2]).toBe(time);
    }
  });

  it('the dog benched on 2026-09-23 leaves cloudy Tuesday dusk to the cyclist from cloudy week_1 dusk slot 1', () => {
    const dog = manifest.entries.filter((e) => e.benched).map((e) => e.relativePath).sort();
    expect(dog).toEqual(['cloudy/week_1/dusk/2.webp', 'cloudy/week_2/dusk/2.webp', 'cloudy/week_3/dusk/2.webp', 'cloudy/week_4/dusk/2.webp']);
    for (const e of manifest.entries.filter((x) => x.benched)) {
      expect(e.servedPath.replace(/\\/g, '/')).toMatch(/cloudy\/week_1\/dusk\/1\.webp$/);
    }
  });
});
