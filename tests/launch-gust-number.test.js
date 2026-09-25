// Launch run (2026-09-25): in af/zu (and xh/st) the ellipsis ate the gust number on Home
// ("NE · kufika ku…"). The words take the ellipsis now; the number stays. Measured in a browser,
// review/launch/results/gust-check.json: pixel-identical wherever the line already fitted.

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

describe('the gust number is never cut', () => {
  const render = (lang, gustKph) => {
    const el = { innerHTML: '', hidden: false };
    const gusts = { en: 'gusts', af: 'windstote', zu: 'kufika ku' };
    const renderStatsRow = new Function('deps', `with (deps) { ${sliceFn('renderStatsRow')}\nreturn renderStatsRow; }`)({
      statsRowEl: el, isNum: (v) => typeof v === 'number', round0: Math.round, settings: { wind: 'kmh' },
      windCompass: () => 'NE', formatWind: (k) => `${Math.round(k)} km/h`,
      t: (c, k) => (k === 'gusts' ? gusts[lang] : k), rainStatWord: () => 'none',
    });
    renderStatsRow({ windKph: 20, gustKph, windDir: 45 });
    return el.innerHTML;
  };
  it('the words take the ellipsis; the number keeps its place', () => {
    expect(render('zu', 45)).toContain('<div class="stat-sub stat-sub-split"><span class="stat-sub-cut">NE · kufika ku</span><span class="stat-sub-keep"> 45</span></div>');
    expect(render('af', 45)).toContain('<span class="stat-sub-cut">NE · windstote</span><span class="stat-sub-keep"> 45</span>');
    // overflow:hidden alone lets the words shrink (a clipped flex item's automatic minimum is 0).
    expect(css).toContain('.stats-row .stat-sub-split > .stat-sub-cut { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }');
    expect(css).toContain('.stats-row .stat-sub-split > .stat-sub-keep { flex: none; white-space: pre; }');
  });
  it('no gust worth naming: the one plain line as before', () => {
    expect(render('af', 22)).toContain('<div class="stat-sub">NE</div>');
  });
});
