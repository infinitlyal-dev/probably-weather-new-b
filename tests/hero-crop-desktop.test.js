// Desktop polaroid crops (2026-09-23). The postcard's #bgImg used `center 25%` for every
// photograph; it now reads the anchor Al ruled per photograph in
// review/set-001-crop-anchors.json, and the desktop default only where he ruled none.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { heroCropFor, heroCropDesktopFor, applyHeroCropDesktop, HERO_CROP_DESKTOP_OVERRIDES } from '../assets/hero-crop.js';

const root = new URL('..', import.meta.url);
const anchors = JSON.parse(readFileSync(new URL('review/set-001-crop-anchors.json', root), 'utf8')).anchors;
const FOLDERS = ['clear', 'cloudy', 'cold', 'cold-clear', 'fog', 'heat', 'rain', 'storm', 'wind'];
const TIMES = ['dawn', 'day', 'dusk', 'night'];
let photos;

beforeAll(() => {
  photos = new Map();
  for (const f of FOLDERS) for (let w = 1; w <= 4; w++) for (const t of TIMES) for (let i = 1; i <= 7; i++) {
    const rel = `${f}/week_${w}/${t}/${i}.webp`;
    const bytes = readFileSync(new URL(`assets/images/bg/${rel}`, root));
    const sha1 = createHash('sha1').update(bytes).digest('hex').slice(0, 12);
    if (!photos.has(sha1)) photos.set(sha1, { sha256: createHash('sha256').update(bytes).digest('hex'), paths: [] });
    photos.get(sha1).paths.push(rel);
  }
}, 60000);

describe('desktop polaroid reads Al\'s ruled anchor for every photograph', () => {
  it('every photograph in the tree resolves to its anchors-file value, in both key shapes the picker emits', () => {
    expect(photos.size).toBe(294);
    let ruled = 0;
    for (const [sha1, p] of photos) {
      const want = anchors[sha1] ? anchors[sha1].anchorY : null;
      if (want !== null) ruled++;
      expect(heroCropDesktopFor(`assets/images/bg-canonical/${p.sha256}.webp?v=20260906-grid`), `canonical ${sha1}`).toBe(want);
      for (const rel of p.paths) expect(heroCropDesktopFor(`assets/images/bg/${rel}`), `${rel}`).toBe(want);
    }
    expect(ruled).toBeGreaterThanOrEqual(270);
  });

  it('the dog in the grey jumper: ruled 100% (bottom of the frame), was cut off at 25%', () => {
    expect(anchors['018a0573e433'].anchorY).toBe(100);
    expect(heroCropDesktopFor('assets/images/bg-canonical/f20554e03039b5158b9906ea13eefcaae5b746a1f8d463d7aefe8adc7588f6a3.webp')).toBe(100);
  });

  it('the phone is untouched: an anchor at 78% stays the phone CSS default, a re-shoot keeps its phone offset', () => {
    const at78 = Object.entries(anchors).find(([sha1, a]) => a.anchorY === 78 && photos.has(sha1));
    expect(at78, 'no photograph anchored at 78% to test').toBeTruthy();
    const p78 = photos.get(at78[0]);
    expect(heroCropFor(`assets/images/bg-canonical/${p78.sha256}.webp`)).toBe(null);
    expect(heroCropDesktopFor(`assets/images/bg-canonical/${p78.sha256}.webp`)).toBe(78);
    const unruled = [...photos].find(([sha1, p]) => !anchors[sha1] && heroCropFor(`assets/images/bg-canonical/${p.sha256}.webp`) !== null);
    expect(unruled, 'no re-shoot with a phone offset to test').toBeTruthy();
    expect(heroCropDesktopFor(`assets/images/bg-canonical/${unruled[1].sha256}.webp`)).toBe(null);
  });

  it('an unknown or malformed src falls back to the desktop CSS default', () => {
    for (const src of ['', null, 'assets/images/bg/default.jpg', 'data:image/webp;base64,AA']) expect(heroCropDesktopFor(src)).toBe(null);
    expect(heroCropDesktopFor('assets/images/bg-canonical/x.webp', {}, { 'bg-canonical/x.webp': 140 })).toBe(null);
  });

  it('applyHeroCropDesktop sets and clears only --hero-crop-desktop', () => {
    const props = new Map();
    const el = { style: { setProperty: (k, v) => props.set(k, v), removeProperty: (k) => props.delete(k) } };
    applyHeroCropDesktop(el, 64);
    expect(props.get('--hero-crop-desktop')).toBe('64%');
    applyHeroCropDesktop(el, null);
    expect(props.has('--hero-crop-desktop')).toBe(false);
    expect(props.has('--hero-crop')).toBe(false);
  });

  it('the desktop #bgImg reads the variable with 25% as its default', () => {
    const css = readFileSync(new URL('assets/app.css', root), 'utf8');
    expect(css).toMatch(/object-position:\s*center var\(--hero-crop-desktop,\s*25%\)/);
    expect(css).not.toMatch(/object-position:\s*center 25%;/);
  });

  it('the generated overrides are in sync with the anchors file', () => {
    expect(Object.keys(HERO_CROP_DESKTOP_OVERRIDES).length).toBeGreaterThan(0);
    const out = execFileSync(process.execPath, ['scripts/build-hero-crop-desktop.mjs', '--check'], { cwd: new URL('.', root), encoding: 'utf8' });
    expect(out).toMatch(/in sync/);
  });
});
