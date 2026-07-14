import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../assets/app.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function mediaBlock(query) {
  const start = css.indexOf(query);
  if (start < 0) return '';
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < css.length; index++) {
    if (css[index] === '{') depth += 1;
    if (css[index] === '}') depth -= 1;
    if (depth === 0) return css.slice(start, index + 1);
  }
  return '';
}

const postcard = mediaBlock('@media (min-width: 1024px)');

describe('desktop Postcard home', () => {
  it('postcard activates only when the viewport has room above the tablet band', () => {
    expect(postcard).toBeTruthy();
    expect(postcard).toContain('--postcard-unit');
    expect(postcard).not.toMatch(/@media\s*\(max-width:/);
    expect(css).toContain('@media (min-width: 769px)');
  });

  it('postcard reuses the landed hero URL for a 28px darkened backdrop', () => {
    const backdrop = postcard.match(/#bg::before\s*{([^}]*)}/)?.[1] || '';
    expect(backdrop).toContain('background-image: var(--hero-url, none)');
    expect(backdrop).toMatch(/blur\(28px\)/);
    expect(backdrop).toMatch(/brightness\(0\.45\)/);
  });

  it('postcard makes the existing witty headline the cream handwritten caption', () => {
    expect((html.match(/id="headline"/g) || [])).toHaveLength(1);
    expect(app).toMatch(/safeText\(headlineEl,\s*getWittyLine\(/);
    expect(postcard).toMatch(/#headline\s*{[^}]*font-family:\s*"Segoe Print"/);
    expect(postcard).toMatch(/#headline\s*{[^}]*color:\s*#(?:24211d|2b2722)/i);
  });

  it('postcard keeps the voice above every backdrop and scrim layer', () => {
    expect(postcard).toMatch(/#bg\s*{[^}]*z-index:\s*-1/);
    expect(postcard).toMatch(/#home-screen\s*{[^}]*z-index:\s*30/);
    expect(postcard).toMatch(/#headline\s*{[^}]*z-index:\s*31/);
    expect(postcard).toMatch(/#bgImg\s*{[^}]*border:\s*16px solid #f6f2e8/i);
  });

  it('postcard neutralises the mobile home scrim before it can cross the polaroid', () => {
    expect(postcard).toMatch(/main#home-screen\.main::before\s*{[^}]*content:\s*none/);
  });

  it('postcard keeps the range unbroken and turns particles off above 1024px', () => {
    expect(postcard).toMatch(/\.hero-range\s*{[^}]*white-space:\s*nowrap/);
    expect(postcard).toMatch(/#particles\s*{[^}]*display:\s*none\s*!important/);
  });

  it('postcard exposes a compact seven-day strip only while Home is active', () => {
    expect(postcard).toMatch(/body\.home-active\s+#week-screen\.hidden\s*{[^}]*display:\s*flex\s*!important/);
    expect(postcard).toMatch(/body\.home-active\s+#week-screen\s+\.daily-cards\s*{[^}]*grid-template-columns:\s*repeat\(7,/);
  });
});
