import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// WARMTH PASS (Al's ruling 2026-08-10). Static guards on the four things this
// pass must not lose: the warm base, a texture that stays cheap, the polaroid
// stock kept OFF the data surfaces, and voice copy that cannot ship in a
// language Al has not approved.
const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const css = read('assets/app.css');
const js = read('assets/app.js');
const html = read('index.html');
// Comments record what a value USED to be; only declarations paint. Every
// "is it gone" assertion below runs against the stripped sheet, or the M1 note
// naming the four retired hexes would fail the very guard it documents.
const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, '');

const warmthBlock = () => {
  const start = css.indexOf('WARMTH PASS W1');
  expect(start, 'warmth block missing from app.css').toBeGreaterThan(-1);
  return css.slice(start);
};

describe('warmth pass — the base', () => {
  it('paints every surface from a warm charcoal, not the old blue-grey', () => {
    expect(css).toMatch(/--page-bg:\s*#14110d/);
    expect(css).toMatch(/--surface:\s*#1f1a14/);
    expect(css).toMatch(/--ink:\s*#fffaf3/);
    expect(css).toMatch(/--ink-2:\s*#b5ab9d/);
    // The retired values must not survive as declarations — that is how a cool
    // surface creeps back one rule at a time.
    for (const dead of ['#0d0d12', '#16171d', '#0a0a0e', '#aab0bd']) {
      expect(cssCode, `${dead} is still painting something`).not.toMatch(new RegExp(dead, 'i'));
    }
  });

  it('defines the one secondary ink at every width, so the desktop rules can use it', () => {
    // --ink-2 used to live inside @media (max-width: 768px), which is why two
    // unscoped rules carried the grey as a literal.
    const rootBlock = css.slice(0, css.indexOf('* { box-sizing'));
    expect(rootBlock).toMatch(/--ink-2:\s*#b5ab9d/);
    expect(css).toMatch(/\.hourly-row \.h-dir\s*{[^}]*color:\s*var\(--ink-2\)/s);
    expect(css).toMatch(/\.settings-row \.settings-row-value\s*{\s*color:\s*var\(--ink-2\)/);
  });
});

describe('warmth pass — the grain', () => {
  it('is a committed static tile, not a runtime filter', () => {
    expect(warmthBlock()).toMatch(/--grain:\s*url\("images\/grain\.png"\)/);
    // No feTurbulence / SVG filter anywhere: a filter is rasterised on the main
    // thread at viewport size, in the LCP window.
    expect(cssCode).not.toMatch(/feTurbulence|filter:\s*url\(#/);
    const bytes = statSync(new URL('../assets/images/grain.png', import.meta.url)).size;
    expect(bytes, 'grain tile must stay cheap').toBeLessThan(8 * 1024);
  });

  it('paints the three surfaces that actually carry the page colour', () => {
    // body, NOT #bg. #bg is position:fixed at z-index:-1, and negative-z
    // stacking contexts paint BEFORE in-flow block boxes — body's own opaque
    // background covers it, so a tile on #bg is invisible on Home. This is the
    // regression guard for that (it shipped that way for one build).
    expect(warmthBlock()).toMatch(/body,\s*\n\s*\.screenPanel,\s*\n\s*\.nav\s*{[^}]*background-image:\s*var\(--grain\)/s);
    expect(warmthBlock()).not.toMatch(/#bg,\s*\n\s*\.screenPanel/);
    expect(warmthBlock()).toMatch(/background-size:\s*64px 64px/);
  });
});

describe('warmth pass — the caption is the thing you screenshot', () => {
  it('raises the whole size curve, not just the ceiling', () => {
    // At 375x812 the MIDDLE term binds, so a ceiling-only bump would have
    // changed nothing on Al's own phone.
    expect(css).toMatch(/--cap-fs:\s*clamp\(0\.86rem, min\(2\.95vh, 6\.4vw\), 2rem\)/);
  });

  it('inks the foot with the print ink, never the gold', () => {
    expect(css).toMatch(/--print-ink:\s*#1b1813/);
    // The per-condition classes repaint the caption gold at 0,0,2,0; M9 beats
    // them. Gold on cream is unreadable and this is the guard for it.
    expect(css).toMatch(/main#home-screen\.main > \.hero-caption\.hero-storm[\s\S]*?color:\s*var\(--print-ink\)/);
  });
});

describe('warmth pass — the stock travels in small doses', () => {
  it('warms section labels and the two accent surfaces', () => {
    const block = warmthBlock();
    // The accents are the print's own stock (#f6f2e8 = 246,242,232), not a
    // second cream picked by eye.
    expect(css).toMatch(/--print-stock:\s*#f6f2e8/);
    expect(block).toMatch(/--paper-ink:\s*rgba\(246, 242, 232, 0\.74\)/);
    expect(block).toMatch(/--paper-tint:\s*rgba\(246, 242, 232, 0\.05\)/);
    expect(block).toMatch(/\.range-legend\s*{[^}]*background:\s*var\(--paper-tint\)/s);
    expect(block).toMatch(/\.sources-list-empty,\s*\n\s*\.list-empty\s*{[^}]*background:\s*var\(--paper-tint\)/s);
    // The empty state must be a class, not an inline opacity, or it cannot be
    // themed at all.
    // BOTH empty lists — Recent and Favourites. The first pass themed one and
    // left the other on the inline opacity twenty lines below it.
    expect(js).toMatch(/<li class="list-empty">\$\{t\('search', 'noRecent'\)\}<\/li>/);
    expect(js).toMatch(/<li class="list-empty">\$\{t\('search', 'noSaved'\)\}<\/li>/);
    expect(js).not.toMatch(/<li style="opacity:0\.6;cursor:default;">/);
    // Replacing the inline style must not change the >=769px frame: the base
    // rule outside the media query keeps the old dimmed look there.
    expect(cssCode).toMatch(/\.list-empty\s*{\s*list-style: none;\s*cursor: default;\s*opacity: 0\.6;\s*}/);
  });

  it('leaves every data surface dark', () => {
    // The credibility argument is made on dark, legible data. If the cream ever
    // reaches the rows, the plot or the bars, this fails.
    const block = warmthBlock();
    for (const sel of ['.range-plot', '.range-bar', '.range-track', '.hourly-row', '.daily-row', '.stats-row']) {
      expect(block, `${sel} must not take a paper surface`)
        .not.toMatch(new RegExp(`\\${sel}\\s*{[^}]*--paper`, 's'));
    }
    expect(block).not.toMatch(/background:\s*var\(--paper\)\s*;/);
  });

  it('turns the secondary-screen weather icons warm, and only those', () => {
    expect(warmthBlock()).toMatch(/#hourly-screen \.hourly-row \.h-icon,\s*\n\s*#week-screen \.daily-row \.d-icon,\s*\n\s*\.hourly-chart \.chart-icon\s*{\s*color:\s*var\(--brand-gold\)/);
  });

  it('never reaches the >=769px frame or the postcard', () => {
    const block = warmthBlock();
    expect(block).toMatch(/@media \(max-width: 768px\)/);
    expect(block).not.toMatch(/@media \(min-width:/);
  });
});

describe('warmth pass — screen-header voice', () => {
  it('keeps voice copy out of t(), which falls back to English', () => {
    expect(js).toMatch(/const VOICE = {/);
    expect(js).toMatch(/const voiceLine = \(line\) => \(line && line\[settings\.lang \|\| 'en'\]\) \|\| '';/);
    // The whole point: NO English fallback inside voiceLine, so an unapproved
    // language shows no voice line instead of an English one.
    const voice = js.slice(js.indexOf('const VOICE = {'), js.indexOf('const voiceLine'));
    expect(voice).not.toMatch(/\baf:/);
    expect(voice).not.toMatch(/\b(zu|xh|st):/);
    // EN signed off 2026-08-10; the other four are still absent BY DESIGN, and
    // the comment has to keep saying so or the next reader "fixes" it.
    expect(js).toMatch(/EN APPROVED by Al 2026-08-10/);
    expect(js).toMatch(/requires_native_review/);
  });

  it('bins the Hourly line by the LOCATION hour, not the device clock', () => {
    // hourlyChartLon, NOT activePlace: the name and the hour must describe the
    // same place, and the live activePlace lets them disagree mid-switch.
    expect(js).toMatch(/hourlyVoice\(getLocationHour\(hourlyChartLon\)\)/);
    expect(js).toMatch(/hourlyChartLon = activePlace\?\.lon \?\? null;/);
    // Al's two named lines must both exist, spelled exactly as he wrote them.
    expect(js).toContain('"Through the night"');
    expect(js).toContain('"Next few hours"');
    // The pre-voice behaviour is the fallback, not an empty subtitle.
    expect(js).toMatch(/\|\| t\('misc', 'todayLabel'\)/);
  });

  it('gives Weekly a slot that collapses when there is no approved line', () => {
    expect(html).toMatch(/<p id="weekSubtitle" class="page-sub m-only" hidden><\/p>/);
    expect(js).toMatch(/weekSub\.hidden = !line;/);
    expect(css).toMatch(/\.page-sub\[hidden\]\s*{\s*display:\s*none;\s*}/);
  });
});
