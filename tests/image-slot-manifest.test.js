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
  it('P9 represents all 1008 picker slots with the 629 unique image bodies exactly once', () => {
    expect(manifest.entries).toHaveLength(1008);
    expect(manifest.hashes).toHaveLength(629);
    expect(manifest.slots).toHaveLength(1008);
    expect(new Set(manifest.slots).size).toBe(629);
  });

  it('P9 resolves every slot to a byte-equivalent canonical image', () => {
    for (let i = 0; i < manifest.entries.length; i++) {
      const bytes = readFileSync(manifest.entries[i].sourcePath);
      const sourceHash = createHash('sha256').update(bytes).digest('hex');
      expect(manifest.hashes[manifest.slots[i]]).toBe(sourceHash);
    }
  });
});
