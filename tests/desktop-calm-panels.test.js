import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../assets/app.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');

function mediaBlock(query) {
  const start = css.indexOf(`${query} {`);
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < css.length; index += 1) {
    if (css[index] === '{') depth += 1;
    if (css[index] === '}') depth -= 1;
    if (depth === 0) return css.slice(start, index + 1);
  }
  return '';
}

describe('calm non-home Postcard destinations', () => {
  it('uses the existing home-active state as the desktop-only presentation switch', () => {
    expect(app).toMatch(/classList\.toggle\('home-active',\s*which\s*===\s*screenHome\)/);
    expect(mediaBlock('@media (min-width: 1024px)')).toContain('body:not(.home-active) #bgImg');
  });

  it('removes every sharp Home artifact while a desktop destination is active', () => {
    const postcard = mediaBlock('@media (min-width: 1024px)');
    expect(postcard).toMatch(/body:not\(\.home-active\) #bgImg,[\s\S]*#scrim,[\s\S]*#headline,[\s\S]*#location,[\s\S]*\.sidebar\s*{[^}]*display:\s*none\s*!important/);
  });

  it('keeps one centred glass panel over the current-weather backdrop', () => {
    const postcard = mediaBlock('@media (min-width: 1024px)');
    expect(postcard).toMatch(/#bg::before\s*{[^}]*background-image:\s*var\(--hero-url, none\)[^}]*blur\(28px\)/s);
    expect(postcard).toMatch(/body:not\(\.home-active\) \.screenPanel\s*{[^}]*left:\s*50%[^}]*width:\s*min\(520px,[^}]*max-width:\s*520px[^}]*translateX\(-50%\)/s);
  });
});
