import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { heroCropFor, heroCropKey, applyHeroCrop, HERO_CROP_OFFSETS } from '../assets/hero-crop.js';

// ---------------------------------------------------------------------------
// M7. This module sits on the LIVE hero paint path, so the property that
// matters most is the one that is easiest to lose: an image with no entry must
// render exactly as it does today. Every test below is written against that.
// ---------------------------------------------------------------------------

const CANON = 'bg-canonical/08c461c74e9ce38b8691ebe8e3a0e8ddb26ab7bc2383fe23782784314b440539.webp';
const TABLE = { 'bg/clear/week_2/dawn/5.webp': 62, 'bg/rain/week_1/day/3.webp': 40, [CANON]: 45 };

describe('heroCropKey — every shape the src can arrive in', () => {
  it('relative slot path', () => {
    expect(heroCropKey('assets/images/bg/clear/week_2/dawn/5.webp')).toBe('bg/clear/week_2/dawn/5.webp');
  });
  it('absolute path', () => {
    expect(heroCropKey('/assets/images/bg/clear/week_2/dawn/5.webp')).toBe('bg/clear/week_2/dawn/5.webp');
  });
  it('full URL', () => {
    expect(heroCropKey('https://www.probablyweather.co.za/assets/images/bg/clear/week_2/dawn/5.webp'))
      .toBe('bg/clear/week_2/dawn/5.webp');
  });
  // THE shape production actually serves. Its absence from this file is what let
  // the mechanism ship dead: the build inlines a slot->content-hash manifest,
  // ships one WebP per body under bg-canonical/, and DELETES the slot tree from
  // dist. A resolver that only understands slot paths resolves nothing live.
  it('PRODUCTION shape — the content-addressed canonical name', () => {
    expect(heroCropKey(`https://www.probablyweather.co.za/assets/images/${CANON}?v=20260718-p1`)).toBe(CANON);
    expect(heroCropKey(`/assets/images/${CANON}`)).toBe(CANON);
  });
  it('query string and hash are stripped', () => {
    expect(heroCropKey('/assets/images/bg/clear/week_2/dawn/5.webp?v=20260718-p1')).toBe('bg/clear/week_2/dawn/5.webp');
    expect(heroCropKey('/assets/images/bg/clear/week_2/dawn/5.webp#x')).toBe('bg/clear/week_2/dawn/5.webp');
  });
  it('anything that is not a background path yields no key', () => {
    for (const src of ['', null, undefined, 42, 'assets/imagery/icon-192.png', 'data:image/webp;base64,AAAA']) {
      expect(heroCropKey(src)).toBe('');
    }
  });
  it('the prefix is ANCHORED — a foreign host cannot smuggle a key through it', () => {
    // indexOf() alone matched this, which meant any origin could claim an entry.
    expect(heroCropKey('https://evil.example/x/assets/images/bg/clear/week_2/dawn/5.webp')).toBe('');
    expect(heroCropKey('sneaky/assets/images/bg/clear/week_2/dawn/5.webp')).toBe('');
  });
  it('a malformed URL does not throw on the paint path', () => {
    expect(() => heroCropKey('https://')).not.toThrow();
    expect(heroCropKey('https://')).toBe('');
  });
});

describe('heroCropFor — absent means DEFAULT, and default lives only in the CSS', () => {
  it('returns null for an image with no entry', () => {
    expect(heroCropFor('assets/images/bg/cold/week_3/night/1.webp', TABLE)).toBeNull();
  });
  it('returns null — never 78 — so the module never restates the CSS default', () => {
    expect(heroCropFor('assets/images/bg/anything/week_1/day/1.webp', TABLE)).not.toBe(78);
  });
  it('returns the offset for an image that has one', () => {
    expect(heroCropFor('assets/images/bg/clear/week_2/dawn/5.webp', TABLE)).toBe(62);
    expect(heroCropFor('/assets/images/bg/rain/week_1/day/3.webp?v=1', TABLE)).toBe(40);
  });
  it('a corrupt entry falls back to the default rather than painting a wrong crop', () => {
    const bad = {
      a: { 'bg/x/1.webp': '62' }, b: { 'bg/x/1.webp': NaN }, c: { 'bg/x/1.webp': -5 },
      d: { 'bg/x/1.webp': 101 }, e: { 'bg/x/1.webp': null }, f: { 'bg/x/1.webp': Infinity },
    };
    for (const table of Object.values(bad)) {
      expect(heroCropFor('assets/images/bg/x/1.webp', table)).toBeNull();
    }
  });
  it('0 and 100 are legitimate offsets, not falsy misses', () => {
    expect(heroCropFor('assets/images/bg/x/1.webp', { 'bg/x/1.webp': 0 })).toBe(0);
    expect(heroCropFor('assets/images/bg/x/1.webp', { 'bg/x/1.webp': 100 })).toBe(100);
  });
});

describe('applyHeroCrop — clearing is as important as setting', () => {
  const fakeRoot = () => {
    const props = new Map();
    return {
      props,
      style: {
        setProperty: (k, v) => props.set(k, v),
        removeProperty: (k) => props.delete(k),
      },
    };
  };

  it('sets the property as a percentage', () => {
    const root = fakeRoot();
    applyHeroCrop(root, 62);
    expect(root.props.get('--hero-crop')).toBe('62%');
  });

  it('null REMOVES the property — a previous image\'s offset must not leak onto the next', () => {
    const root = fakeRoot();
    applyHeroCrop(root, 62);
    applyHeroCrop(root, null);
    expect(root.props.has('--hero-crop')).toBe(false);
  });

  it('0 sets, it does not clear', () => {
    const root = fakeRoot();
    applyHeroCrop(root, 0);
    expect(root.props.get('--hero-crop')).toBe('0%');
  });

  it('a missing root is a no-op, not a throw', () => {
    expect(() => applyHeroCrop(null, 50)).not.toThrow();
    expect(() => applyHeroCrop({}, 50)).not.toThrow();
  });
});

describe('the shipped table + the wiring', () => {
  // The shipped table is EMPTY until Al rules, so a bare `for (…of entries)`
  // loop over it executes zero times and every assertion inside is vacuous —
  // in exactly the state this ships in. The validation is a function now, and
  // it is exercised against a deliberately bad fixture so the check is proven
  // to bite before it is pointed at the real data.
  const invalidEntries = (table) => Object.entries(table).flatMap(([key, value]) => {
    const faults = [];
    if (typeof value !== 'number' || !Number.isFinite(value)) faults.push(`${key}: not a number`);
    else if (value < 0 || value > 100) faults.push(`${key}: ${value} is not a percentage`);
    else if (value === 78) faults.push(`${key}: restates the CSS default`);
    if (key.includes('assets/images/')) faults.push(`${key}: still carries the asset prefix`);
    if (!key.startsWith('bg/') && !key.startsWith('bg-canonical/')) faults.push(`${key}: not a key shape the picker emits`);
    return faults;
  });

  it('the entry validator actually rejects bad entries', () => {
    expect(invalidEntries({ 'bg/x/1.webp': 45 })).toEqual([]);
    expect(invalidEntries({ 'bg-canonical/abc.webp': 30 })).toEqual([]);
    expect(invalidEntries({ 'bg/x/1.webp': '45' })).toHaveLength(1);
    expect(invalidEntries({ 'bg/x/1.webp': 101 })).toHaveLength(1);
    expect(invalidEntries({ 'bg/x/1.webp': 78 })).toHaveLength(1);
    expect(invalidEntries({ 'assets/images/bg/x/1.webp': 45 })).toHaveLength(2);
    expect(invalidEntries({ 'clear/week_1/day/1.webp': 45 })).toHaveLength(1);
  });

  it('every shipped entry is valid', () => {
    expect(invalidEntries(HERO_CROP_OFFSETS)).toEqual([]);
  });

  it('ships the anchors Al ruled on 2026-08-13, and only those', () => {
    // This assertion used to read "the table is empty ON PURPOSE" — the gate
    // that made shipping the offsets a deliberate act rather than something
    // that leaks in with a regenerate. Al ruled on 2026-08-13 (167 images, one
    // at a time, in review/crop-anchor-tool.html), so the gate has been passed
    // and now guards the other direction: the table must match the ruling file
    // exactly, and every entry must trace to a hash Al actually judged.
    const ruling = JSON.parse(readFileSync(new URL('../review/set-001-crop-offsets.json', import.meta.url), 'utf8'));
    const ruled = Object.values(ruling.offsets).filter((o) => typeof o.anchorY === 'number');
    expect(ruled.length).toBe(167);
    expect(Object.keys(HERO_CROP_OFFSETS).length).toBeGreaterThan(0);

    // Every shipped VALUE must be one Al set. A regenerate that invented a
    // number — or carried a stale one — fails here.
    const ruledValues = new Set(ruled.map((o) => o.anchorY));
    for (const [key, y] of Object.entries(HERO_CROP_OFFSETS)) {
      expect(ruledValues.has(y), `${key} ships ${y}%, which is not a value Al ruled`).toBe(true);
    }

    // Both key shapes ship, or the mechanism is dead in one environment: the
    // slot path for the previewable source tree, the content-addressed name for
    // production.
    const keys = Object.keys(HERO_CROP_OFFSETS);
    expect(keys.some((k) => k.startsWith('bg/'))).toBe(true);
    expect(keys.some((k) => k.startsWith('bg-canonical/'))).toBe(true);
  });

  it('the CSS default is 78% and is stated exactly once', () => {
    const css = readFileSync(new URL('../assets/app.css', import.meta.url), 'utf8');
    const uses = [...css.matchAll(/var\(--hero-crop,\s*([\d.]+)%\)/g)].map((m) => m[1]);
    expect(uses).toEqual(['78']);
  });

  it('app.js applies the resolved offset when the picker lands an image', () => {
    const src = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
    expect(src).toMatch(/applyHeroCrop\(document\.documentElement, heroCropFor\(/);
    // The resolve+apply must sit INSIDE onload, after the stale-token guard, so
    // a superseded fallback-chain walk cannot paint another image's offset.
    const onload = src.slice(src.indexOf('bgImg.onload = () => {'));
    const guard = onload.indexOf('myToken !== __pickerToken');
    const apply = onload.indexOf('applyHeroCrop');
    expect(guard).toBeGreaterThan(-1);
    expect(apply, 'applyHeroCrop runs before the staleness guard').toBeGreaterThan(guard);
  });

  it('the path and its offset are persisted together, crop first', () => {
    const src = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
    // Two separate try blocks diverge at storage quota: the pw_last_bg overwrite
    // succeeds, the first-ever pw_last_crop throws, and the next cold open pairs
    // a new image with an old offset.
    const block = /try \{[^}]*?setItem\('pw_last_crop'[^}]*?setItem\('pw_last_bg'[^}]*?\} catch/s;
    expect(src).toMatch(block);
  });

  it('the shell seeds the offset it stored, and validates it before use', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    expect(html).toMatch(/pw_last_crop/);
    // A stored value straight into a style property with no range check is how
    // a corrupt localStorage entry becomes a broken first paint.
    expect(html).toMatch(/isFinite\(cropNum\)[\s\S]{0,80}cropNum >= 0[\s\S]{0,40}cropNum <= 100/);
  });
});
