import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Prelaunch P2-2 (Astra): with Fahrenheit selected, the Sources list still
// printed raw Celsius ranges (Open-Meteo "15°–18°" for Strand) while the range
// chart converted. On mobile the chart is aria-hidden and the list is the
// accessible copy; at >=769px the list is the only copy. Both must follow the
// selected unit.
//
// Behavioural: the real renderSourcesScreen and renderSourcesRangeChart, and
// the real isNum / round0 / convertTemp helpers, are lifted out of
// assets/app.js and run against a minimal DOM with the unit toggled both ways.

const src = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');

function sliceFunction(name) {
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`${name} not found in assets/app.js`);
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(start, i + 1);
  }
  throw new Error(`unbalanced function ${name}`);
}

function sliceConst(name) {
  const m = src.match(new RegExp(`^\\s*const ${name} = .*;$`, 'm'));
  if (!m) throw new Error(`const ${name} not found in assets/app.js`);
  return m[0].trim();
}

class FakeEl {
  constructor(tag) {
    this.tag = tag; this.children = []; this.attrs = {}; this.style = {};
    this.className = ''; this.hidden = false; this.ownText = '';
    const set = new Set();
    this.classList = {
      add: (c) => set.add(c),
      remove: (c) => set.delete(c),
      toggle: (c, on) => ((on ?? !set.has(c)) ? set.add(c) : set.delete(c)),
      contains: (c) => set.has(c),
    };
  }
  get textContent() { return this.ownText + this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this.ownText = String(v); this.children = []; }
  set innerHTML(v) { this.ownText = ''; this.children = []; }
  appendChild(c) { if (c.tag === '#fragment') this.children.push(...c.children); else this.children.push(c); return c; }
  append(...cs) { cs.forEach((c) => this.appendChild(c)); }
  replaceChildren(...cs) { this.ownText = ''; this.children = []; cs.forEach((c) => this.appendChild(c)); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
}

const byClass = (el, cls, out = []) => {
  if (String(el.className).split(/\s+/).includes(cls)) out.push(el);
  el.children.forEach((c) => byClass(c, cls, out));
  return out;
};

// One page, re-rendered in place — the way applySettings re-runs it.
function sourcesPage() {
  const settings = { temp: 'C', lang: 'en' };
  const nodes = {
    '#sourcesList': new FakeEl('ul'),
    '#sourcesRangeChart': new FakeEl('div'),
    '.sources-page': new FakeEl('div'),
  };
  const document = {
    createElement: (tag) => new FakeEl(tag),
    createDocumentFragment: () => new FakeEl('#fragment'),
    getElementById: () => null,
  };
  const body = [
    sliceConst('isNum'), sliceConst('round0'), sliceConst('convertTemp'),
    sliceFunction('renderSourcesRangeChart'), sliceFunction('renderSourcesCount'),
    sliceFunction('renderSourcesScreen'),
    'return renderSourcesScreen;',
  ].join('\n');
  const render = new Function('document', '$', 'settings', 't', body)(
    document, (sel) => nodes[sel] ?? null, settings, (_category, key) => key,
  );
  return { settings, nodes, render };
}

// Strand-shaped payload: three sources with ranges, Probably's own band.
const norm = {
  sourceRanges: [
    { name: 'Open-Meteo', minTemp: 14.9, maxTemp: 17.9 },
    { name: 'WeatherAPI', minTemp: 15.2, maxTemp: 18.4 },
    { name: 'MET Norway', minTemp: 14.1, maxTemp: 17.0 },
  ],
  todayLow: 14.9,
  todayHigh: 17.9,
  used: ['Open-Meteo', 'WeatherAPI', 'MET Norway'],
  failed: [],
};

const CELSIUS = ['15° – 18°', '15° – 18°', '14° – 17°'];
const FAHRENHEIT = ['59° – 64°', '59° – 65°', '57° – 63°'];

describe('Sources rows follow the selected temperature unit (P2-2)', () => {
  it('list rows, chart values and chart caption agree, toggled C → F → C', () => {
    const { settings, nodes, render } = sourcesPage();
    const listRanges = () => byClass(nodes['#sourcesList'], 'sources-list-range').map((e) => e.textContent);
    const chartRanges = () => byClass(nodes['#sourcesRangeChart'], 'range-val').map((e) => e.textContent);
    const caption = () => byClass(nodes['#sourcesRangeChart'], 'chart-caption')[0]?.textContent;

    for (const [unit, expected] of [['C', CELSIUS], ['F', FAHRENHEIT], ['C', CELSIUS]]) {
      settings.temp = unit;
      render(norm);
      // The accessible copy (the list) is what a screen reader and the >=769px
      // frame read; it must say what the chart draws.
      expect(listRanges(), `list in °${unit}`).toEqual(expected);
      expect(chartRanges(), `chart in °${unit}`).toEqual(expected);
      expect(caption()).toContain(`°${unit}`);
    }
  });

  it('keeps a missing range as "--" in both units instead of converting nothing', () => {
    const { settings, nodes, render } = sourcesPage();
    const partial = { ...norm, sourceRanges: [...norm.sourceRanges, { name: 'Tomorrow.io', minTemp: null, maxTemp: 18 }] };
    for (const unit of ['F', 'C']) {
      settings.temp = unit;
      render(partial);
      const rows = byClass(nodes['#sourcesList'], 'sources-list-range').map((e) => e.textContent);
      expect(rows[3]).toBe('--');
    }
  });
});
