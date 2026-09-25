// Launch run (2026-09-25), Al's ticked list "week-compact": Week shows all 7 days on one screen
// (5½ fitted). Measured at 414×715, 360×640, 390×844 and 768×1024 by
// review/launch/scripts/ui-probe.mjs (review/launch/results/ui-after.json).

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const js = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../assets/app.css', import.meta.url), 'utf8');
const sliceFn = (name) => {
  const start = js.indexOf(`function ${name}(`);
  expect(start, `${name} missing`).toBeGreaterThan(-1);
  let depth = 0;
  for (let i = js.indexOf('{', start); i < js.length; i++) {
    if (js[i] === '{') depth++;
    else if (js[i] === '}' && --depth === 0) return js.slice(start, i + 1);
  }
  throw new Error(`unbalanced ${name}`);
};

describe('week-compact', () => {
  const fit = ({ adShown, hidden = false }) => {
    const body = { style: { minHeight: 'unset-marker' }, getBoundingClientRect: () => ({ top: 150 }) };
    const slot = { hidden: !adShown };
    const screenWeek = {
      clientHeight: 715, scrollTop: 0, getBoundingClientRect: () => ({ top: 0 }),
      classList: { contains: (c) => c === 'hidden' && hidden },
      querySelector: (sel) => (sel === ':scope > .screen-panel-body' ? body : sel === ':scope > .ad-slot' ? slot : null),
    };
    const fitWeekToScreen = new Function('deps', `with (deps) { ${sliceFn('fitWeekToScreen')}\nreturn fitWeekToScreen; }`)({
      screenWeek, getComputedStyle: () => ({ display: 'block' }),
    });
    fitWeekToScreen();
    return body.style.minHeight;
  };
  it('with an ad card below, the list fills exactly the visible screen', () => {
    expect(fit({ adShown: true })).toBe('565px');
  });
  it('no ad card, or Week not showing: nothing is set', () => {
    expect(fit({ adShown: false })).toBe('');
    expect(fit({ adShown: true, hidden: true })).toBe('');
  });
  it('runs whenever Week is shown and on resize; rows a little shorter on a phone', () => {
    expect(sliceFn('showScreen')).toContain('requestAnimationFrame(fitWeekToScreen)');
    expect(js).toContain("window.addEventListener('resize', () => { if (screenWeek && !screenWeek.classList.contains('hidden')) fitWeekToScreen(); });");
    expect(css).toContain('#week-screen .daily-row { padding-top: 8px; padding-bottom: 8px; }');
    expect(css).toContain('body.ads-slots #week-screen .daily-cards > .daily-header { flex: none !important; }');
  });
});
