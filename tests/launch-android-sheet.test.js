// Launch run (2026-09-25), Al's ticked list "android-sheet": Android's bigger install sheet shows
// the manifest's description and screenshots. The screenshots are rendered from the built app by
// review/launch/scripts/manifest-shots.mjs (re-run it once Al picks a Home design).

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';

const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));

describe('android-sheet', () => {
  it('has a description', () => {
    expect(manifest.description?.length).toBeGreaterThan(20);
  });
  it('three narrow screenshots and one wide, each file the size it says', async () => {
    const shots = manifest.screenshots;
    expect(shots.filter((s) => s.form_factor === 'narrow')).toHaveLength(3);
    expect(shots.filter((s) => s.form_factor === 'wide')).toHaveLength(1);
    for (const s of shots) {
      const file = fileURLToPath(new URL(`..${s.src}`, import.meta.url));
      expect(existsSync(file), s.src).toBe(true);
      const meta = await sharp(file).metadata();
      expect(`${meta.width}x${meta.height}`, s.src).toBe(s.sizes);
      expect(s.type).toBe('image/webp');
      expect(s.label.length).toBeGreaterThan(3);
    }
  });
});
