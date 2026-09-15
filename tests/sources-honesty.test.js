import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Prelaunch P2-1 (Astra): the Sources page promised five sources "every time
// you open the app" and said they were averaged. What runs is a weighted blend;
// a provider can be left out (fetch failure, validation, budget guard, no key);
// a cache hit replays a recent forecast; and MET Norway's rain % is derived
// from its precipitation amounts. The manifest still said four sources.
//
// Three layers: the copy itself (all five languages present, the retired claims
// gone), the real renderSourcesCount run against a minimal DOM with the payload
// shapes that actually occur, and the wiring that behaviour cannot reach
// (markup ids, the updateUILanguage write, the stylesheet, the manifest).

const src = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../assets/app.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));

const LANGS = ['en', 'af', 'zu', 'xh', 'st'];

function sliceBalanced(text, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return text.slice(openIndex, i + 1);
  }
  throw new Error(`unbalanced block at ${openIndex}`);
}

function sliceFunction(name) {
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`${name} not found in assets/app.js`);
  const open = src.indexOf('{', start);
  return src.slice(start, open) + sliceBalanced(src, open);
}

// T.sources, evaluated from app.js's own literal. It is the `sources: {` that
// holds `explainer` — the nav and screen-title entries of the same name come
// earlier and carry plain labels.
const SOURCES = (() => {
  const at = src.indexOf('explainer: {');
  const open = src.indexOf('{', src.lastIndexOf('sources: {', at));
  return new Function(`return ${sliceBalanced(src, open)};`)();
})();

class FakeEl {
  constructor(tag) { this.tag = tag; this.children = []; this.className = ''; this.hidden = false; this.ownText = ''; }
  get textContent() { return this.ownText + this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this.ownText = String(v); this.children = []; }
  appendChild(c) { this.children.push(c); return c; }
  replaceChildren(...cs) { this.ownText = ''; this.children = []; cs.forEach((c) => this.appendChild(c)); }
}

function countLine(lang = 'en') {
  const el = new FakeEl('p');
  el.hidden = true; // as shipped in index.html
  const t = (category, key) => {
    const row = category === 'sources' ? SOURCES[key] : null;
    return row?.[lang] || row?.en || key;
  };
  const render = new Function('document', '$', 't', `${sliceFunction('renderSourcesCount')}\nreturn renderSourcesCount;`)(
    { createElement: (tag) => new FakeEl(tag) },
    (sel) => (sel === '#sourcesCount' ? el : null),
    t,
  );
  return {
    render,
    read: () => ({ hidden: el.hidden, parts: el.children.map((c) => c.textContent) }),
  };
}

describe('Sources copy says what runs (P2-1)', () => {
  it('ships every Sources key in all five languages', () => {
    for (const key of ['explainer', 'metRain', 'inThisForecast', 'leftOut', 'attribution']) {
      for (const lang of LANGS) {
        const value = SOURCES[key]?.[lang];
        expect(typeof value, `sources.${key}.${lang}`).toBe('string');
        expect(value.trim().length, `sources.${key}.${lang}`).toBeGreaterThan(0);
      }
    }
  });

  it('no longer claims averaging or a fresh five-source check on every open', () => {
    const e = SOURCES.explainer;
    expect(e.en).not.toMatch(/average/i);
    expect(e.en).not.toMatch(/every time you open/i);
    expect(e.en).toMatch(/weigh/i); // weighted, not averaged
    expect(e.en).toMatch(/hit its limit/i); // a provider can sit a forecast out
    expect(e.en).toMatch(/last few minutes/i); // a cache hit reuses a recent forecast
    // The retired claim's own words in each language ("average", "every time").
    expect(e.af).not.toMatch(/gemiddeld|elke keer wat jy/i);
    expect(e.zu).not.toMatch(/amalinganiso|ngaso sonke isikhathi/i);
    expect(e.xh).not.toMatch(/imilinganiselo|ngalo lonke ixesha/i);
    expect(e.st).not.toMatch(/karolelano|nako e nngwe le e nngwe/i);
    // And not parked under some other key either.
    for (const [key, row] of Object.entries(SOURCES)) {
      if (typeof row?.en !== 'string') continue;
      expect(row.en, `sources.${key}`).not.toMatch(/We average them|every time you open the app/);
    }
  });

  it('discloses that MET Norway rain chance is worked out from its precipitation — and the server really does that', () => {
    expect(SOURCES.metRain.en).toMatch(/MET Norway doesn't give a chance of rain/);
    expect(SOURCES.metRain.en).toMatch(/work one out from how much rain it expects/);
    const weather = readFileSync(new URL('../api/weather.js', import.meta.url), 'utf8');
    expect(weather).toMatch(/const rainProxy = maxPrecip === null/);
  });
});

describe('the count line describes the forecast on screen', () => {
  it('four of five, naming the provider that sat out (Astra: Johannesburg, Open-Meteo unavailable)', () => {
    const c = countLine();
    c.render({ used: ['WeatherAPI', 'Pirate Weather', 'MET Norway', 'Tomorrow.io'], failed: ['Open-Meteo'] });
    expect(c.read()).toEqual({ hidden: false, parts: ['Sources in this forecast: 4/5', 'Sitting this one out: Open-Meteo'] });
  });

  it('five of five has no sat-out line', () => {
    const c = countLine();
    c.render({ used: ['Open-Meteo', 'WeatherAPI', 'Pirate Weather', 'MET Norway', 'Tomorrow.io'], failed: [] });
    expect(c.read()).toEqual({ hidden: false, parts: ['Sources in this forecast: 5/5'] });
  });

  it('counts a keyless or budget-blocked provider against the total, as the API reports it', () => {
    // api/weather.js pushes a provider onto `failures` in its no-key / budget
    // else-branch, so meta.sources lists it with ok:false.
    const c = countLine();
    c.render({ used: ['Open-Meteo', 'WeatherAPI', 'MET Norway'], failed: ['Pirate Weather', 'Tomorrow.io'] });
    expect(c.read().parts).toEqual(['Sources in this forecast: 3/5', 'Sitting this one out: Pirate Weather, Tomorrow.io']);
  });

  it('never counts a name twice', () => {
    const c = countLine();
    c.render({ used: ['Open-Meteo', 'Open-Meteo', 'MET Norway'], failed: ['MET Norway', 'WeatherAPI', 'WeatherAPI'] });
    expect(c.read().parts).toEqual(['Sources in this forecast: 2/3', 'Sitting this one out: WeatherAPI']);
  });

  it('hides itself when the payload carries no source list', () => {
    const c = countLine();
    c.render({ used: [], failed: [] });
    expect(c.read()).toEqual({ hidden: true, parts: [] });
    c.render(null);
    expect(c.read().hidden).toBe(true);
  });

  it('re-renders in place (language switch, new payload) without stacking lines', () => {
    const c = countLine();
    c.render({ used: ['A', 'B', 'C', 'D'], failed: ['E'] });
    c.render({ used: ['A', 'B', 'C', 'D', 'E'], failed: [] });
    expect(c.read().parts).toEqual(['Sources in this forecast: 5/5']);
  });

  it('speaks the selected language', () => {
    const c = countLine('af');
    c.render({ used: ['WeatherAPI', 'Pirate Weather', 'MET Norway', 'Tomorrow.io'], failed: ['Open-Meteo'] });
    expect(c.read().parts).toEqual(['Bronne in hierdie voorspelling: 4/5', 'Hierdie keer uitgelaat: Open-Meteo']);
  });
});

describe('wiring', () => {
  it('index.html carries the count line (hidden until filled) and the MET note', () => {
    expect(html).toMatch(/<p id="sourcesCount" class="sources-count" hidden><\/p>/);
    expect(html).toMatch(/<p id="sourcesMetNote" class="sources-attribution"><\/p>/);
  });

  it('updateUILanguage writes the MET note from the catalogue', () => {
    expect(sliceFunction('updateUILanguage')).toMatch(/sourcesMetNoteEl\.textContent = t\('sources', 'metRain'\)/);
  });

  it('renderSourcesScreen draws the count line before its empty-payload early return', () => {
    const body = sliceFunction('renderSourcesScreen');
    const call = body.indexOf('renderSourcesCount(norm)');
    expect(call).toBeGreaterThan(-1);
    expect(call).toBeLessThan(body.indexOf('if (sr.length === 0)'));
  });

  it('gives the count line no author display, so its hidden attribute keeps working', () => {
    const start = css.indexOf('.sources-count {');
    expect(start).toBeGreaterThan(-1);
    expect(css.slice(start, css.indexOf('}', start))).not.toMatch(/display\s*:/);
  });

  it('the manifest says five sources', () => {
    expect(manifest.description).toMatch(/\b5 sources\b/);
    expect(manifest.description).not.toMatch(/\b4 sources\b/);
  });
});
