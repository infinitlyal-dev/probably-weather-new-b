import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';

import { scanBackgroundSlots } from '../scripts/image-slot-manifest.mjs';

const imageRoot = new URL('../assets/images/bg/', import.meta.url);
let manifest;

beforeAll(() => {
  manifest = scanBackgroundSlots(imageRoot);
}, 30000);

describe('P9 background slot manifest', () => {
  // 294 unique bodies since 2026-09-06, not 644: Al ruled the app serves set-001 only, so the
  // 532 slots that held uncurated photographs (and therefore could never carry a bespoke
  // line) now hold copies of curated ones from the same condition and time-of-day. set-002
  // raises this again as new curated photographs replace those repeats.
  it('P9 represents all 1008 picker slots with the 294 unique image bodies exactly once', () => {
    expect(manifest.entries).toHaveLength(1008);
    expect(manifest.hashes).toHaveLength(294);
    expect(manifest.slots).toHaveLength(1008);
    expect(new Set(manifest.slots).size).toBe(294);
  });

  it('P9 resolves every slot to a byte-equivalent canonical image', () => {
    for (let i = 0; i < manifest.entries.length; i++) {
      const bytes = readFileSync(manifest.entries[i].sourcePath);
      const sourceHash = createHash('sha256').update(bytes).digest('hex');
      expect(manifest.hashes[manifest.slots[i]]).toBe(sourceHash);
    }
  });
});
