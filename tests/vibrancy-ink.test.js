import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// VIBRANCY V1 + THE INK MAP (Al's rulings 2026-08-10). Static guards on the
// things this stack must not lose, and on the two traps it was built around:
// the wash has to stay BEHIND the data, and the ink has to cover every
// condition key renderHome can stamp.
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const css = read('assets/app.css');
const js = read('assets/app.js');
const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, '');

const block = () => {
  const start = css.indexOf('VIBRANCY V1');
  expect(start, 'vibrancy block missing from app.css').toBeGreaterThan(-1);
  return css.slice(start);
};

describe('vibrancy — the room takes the photograph\'s light', () => {
  it('paints the wash inside #bg, behind the particles, from the hero already loaded', () => {
    expect(block()).toMatch(/#bg::after\s*{[^}]*background-image:\s*var\(--hero-url, none\)/s);
    expect(block()).toMatch(/#bg::after\s*{[^}]*filter:\s*blur\(38px\)/s);
    expect(block()).toMatch(/#bg::after\s*{[^}]*z-index:\s*-1/s);
    // No second copy of the photograph as an <img> or a new element anywhere.
    expect(block()).not.toMatch(/content:\s*url\(/);
  });

  it('makes body transparent so #bg is visible at all', () => {
    // The load-bearing line: negative-z stacking contexts paint BEFORE in-flow
    // block boxes, so an opaque body hides #bg completely. Without this the
    // whole vibrancy stack renders as the old flat charcoal.
    expect(block()).toMatch(/body\s*{\s*background-color:\s*transparent;\s*}/);
    // …and the grain stays on body, which is why it still paints.
    expect(css).toMatch(/body,\s*\n\s*\.screenPanel,\s*\n\s*\.nav\s*{[^}]*background-image:\s*var\(--grain\)/s);
  });

  it('keeps a scrim between the light and the data', () => {
    expect(block()).toMatch(/#bg::before\s*{[^}]*linear-gradient\(/s);
    expect(block()).toMatch(/var\(--page-bg\) 78%/);
    // The panels get their own scrim, ending at the page colour before the rows.
    expect(block()).toMatch(/\.screenPanel\s*{[^}]*var\(--page-bg\) 58%/s);
  });

  it('hides the app header behind the now-translucent panels', () => {
    // The opaque panel used to cover it; take the lid off and "Hourly" lands on
    // top of "Probably Weather". visibility, so nothing reflows.
    expect(block()).toMatch(/body:not\(\.home-active\) \.header\s*{\s*visibility:\s*hidden;\s*}/);
  });

  it('quietens the rain instead of leaving hard white bars on the lit room', () => {
    expect(block()).toMatch(/\.particle\.rain\s*{[^}]*linear-gradient\(/s);
    // No filter on 28 animated elements — that would be a per-frame cost.
    expect(block()).not.toMatch(/\.particle\.rain\s*{[^}]*filter:/s);
  });
});

describe('vibrancy — voice, paper and the print', () => {
  it('gives the wordmark the share card\'s gold', () => {
    expect(block()).toMatch(/\.temp \.hero-probably\s*{[^}]*color:\s*var\(--brand-gold\)/s);
    expect(block()).toMatch(/\.temp \.hero-probably\s*{[^}]*font-size:\s*0\.52em/s);
    // The NUMBER stays white — data stays data.
    expect(block()).not.toMatch(/\.temp \.hero-now\s*{[^}]*color:/s);
  });

  it('prints the evidence on the same stock without touching the values', () => {
    expect(block()).toMatch(/\.stats-row\s*{[^}]*rgba\(246, 242, 232, 0\.055\)/s);
    expect(block()).toMatch(/\.stats-row \.stat-k,\s*\n\s*\.stats-row \.stat-sub\s*{\s*color:\s*var\(--paper-ink\)/);
    // .stat-v (the numbers) must not be re-inked.
    expect(block()).not.toMatch(/\.stats-row \.stat-v\s*{/);
  });

  it('tapes the print down and hides the pin that the tape replaces', () => {
    expect(block()).toMatch(/\.hero-card::after\s*{\s*display:\s*none;\s*}/);
    expect(block()).toMatch(/\.hero-card::before\s*{[^}]*clip-path:\s*polygon/s);
    expect(block()).toMatch(/transform:\s*rotate\(-30deg\)/);
    // The tape starts INSIDE the card: a negative top put its rotated bounding
    // box across the app header on every phone in the matrix.
    expect(block()).toMatch(/top:\s*clamp\(9px, 1\.4vh, 14px\)/);
  });
});

describe('the ink map', () => {
  const INKS = ['--ink-wets:   #0b5c68', '--ink-warm:   #a81259', '--ink-mild:   #1c6b3a',
    '--ink-cold:   #3c2f80', '--ink-wind:   #5a3a22', '--ink-plain:  #1b1813'];

  it('defines the six approved inks', () => {
    for (const ink of INKS) expect(block()).toContain(ink);
  });

  it('covers every condition key renderHome can stamp', () => {
    // The map is worthless if a key falls through to the base ink — and
    // computeHomeDisplayCondition returns thirteen of them, not the nine with
    // image folders.
    const start = js.indexOf('function computeHomeDisplayCondition');
    const keys = [...new Set([...js.slice(start, js.indexOf('\n  }', start)).matchAll(/return '([a-z-]+)'/g)]
      .map((m) => m[1]))].filter((k) => k !== 'partly-cloudy');
    for (const key of keys) {
      expect(block(), `hero-${key} has no ink`).toMatch(new RegExp(`#headline\\.hero-${key}\\b`));
    }
    expect(keys.length).toBeGreaterThanOrEqual(12);
  });

  it('beats the two-id rule that would otherwise win the colour back', () => {
    // main#home-screen.main #headline is 0,2,1,0. Every ink rule has to carry
    // two ids AND two classes or the base ink wins and the map does nothing.
    const inkRules = block().match(/main#home-screen\.main > #headline\.hero-[a-z-]+/g) || [];
    expect(inkRules.length).toBeGreaterThanOrEqual(12);
  });

  it('darkens at night off the same clock the photographs use', () => {
    expect(block()).toMatch(/body\.tod-night\s*{[^}]*--ink-wets:\s*#0e4349/s);
    expect(js).toMatch(/document\.body\.classList\.toggle\('tod-night', getTimeOfDay\(\) === 'night'\)/);
  });

  it('keeps orange and red out of the ink', () => {
    // Comments stripped: the block's own note explains that umber is NOT the
    // warning orange and quotes #ff9800 to make the comparison — history, not a
    // declaration.
    const inkBlock = block().replace(/\/\*[\s\S]*?\*\//g, '');
    const inkOnly = inkBlock.slice(inkBlock.indexOf('--ink-wets'));
    expect(inkOnly).not.toMatch(/#ff9800|#f44336|--warn-high|--warn-max/);
  });

  it('never reaches the >=769px frame', () => {
    expect(block()).not.toMatch(/@media \(min-width:/);
    expect(cssCode.slice(cssCode.indexOf('body.tod-night'))).not.toMatch(/min-width/);
  });
});
