import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../assets/app.css', import.meta.url), 'utf8');

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

describe('ruled home action order', () => {
  it('orders DOM and keyboard traversal as Share, Hourly, My Location', () => {
    const share = html.indexOf('id="shareBtn"');
    const hourly = html.indexOf('id="navHourlyHome"');
    const location = html.indexOf('id="myLocationHome"');
    expect(share).toBeGreaterThan(-1);
    expect(share).toBeLessThan(hourly);
    expect(hourly).toBeLessThan(location);
  });

  it('pins equal mobile thirds as Share left, Hourly centre, My Location right', () => {
    const mobile = mediaBlock('@media (max-width: 768px)');
    expect(mobile).toMatch(/\.share-btn\s*{[^}]*left:\s*12px/);
    expect(mobile).toMatch(/\.nav-hourly-pill\s*{[^}]*left:\s*50%[^}]*translateX\(-50%\)/);
    expect(mobile).toMatch(/\.my-location-btn\s*{[^}]*right:\s*12px/);
    expect(mobile).toMatch(/width:\s*calc\(\(100% - 40px\) \/ 3\)/);
  });

  it('keeps Share first and visually weighted on the desktop Postcard', () => {
    const postcard = mediaBlock('@media (min-width: 1024px)');
    expect(postcard).toContain('--postcard-share-w: clamp(146px, 12vw, 172px)');
    expect(postcard).toMatch(/\.share-btn\s*{[^}]*left:\s*var\(--postcard-voice-left\)[^}]*width:\s*var\(--postcard-share-w\)/);
    expect(postcard).toMatch(/\.nav-hourly-pill\s*{[^}]*left:\s*calc\(var\(--postcard-voice-left\) \+ var\(--postcard-share-w\) \+ 10px\)/);
    expect(postcard).toMatch(/\.my-location-btn\s*{[^}]*left:\s*calc\(var\(--postcard-voice-left\) \+ var\(--postcard-share-w\) \+ var\(--postcard-hourly-w\) \+ 20px\)/);
  });
});
