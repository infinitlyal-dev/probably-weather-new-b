// Credit links on the Sources page (Al: DO IT, launch-run-ruled.json, 25 Sept 2026). Each source's
// name in the translated sentence is a link, in all five languages, and the marks the services
// require follow: "Search by LocationIQ.com" (LocationIQ free plan), the OpenStreetMap credit, and
// Open-Meteo's CC BY 4.0 licence.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const js = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../assets/app.css', import.meta.url), 'utf8');

const block = (start, end) => {
  const i = js.indexOf(start);
  expect(i, start).toBeGreaterThan(-1);
  return js.slice(i, js.indexOf(end, i) + end.length);
};
const attribution = new Function(`return ${block('attribution: {', '\n      }').replace(/^attribution: /, '')};`)();

function fakeDocument() {
  const node = (tag) => {
    const n = { tag, children: [], attrs: {}, appendChild(c) { this.children.push(c); return c; } };
    let text = '';
    Object.defineProperty(n, 'textContent', {
      get: () => (n.children.length ? n.children.map(flat).join('') : text),
      set: (v) => { n.children = []; text = v; },
    });
    return n;
  };
  const flat = (n) => (n.tag === '#text' ? n.text : n.textContent);
  return { createElement: node, createTextNode: (s) => ({ tag: '#text', text: s }), node };
}

const render = (sentence) => {
  const document = fakeDocument();
  const src = `${block('const SOURCE_LINKS = [', '\n  ];')}\n${block('const CREDIT_MARKS = [', '\n  ];')}\n${block('function renderSourcesAttribution(el, sentence) {', '\n  }')}\nreturn renderSourcesAttribution;`;
  const fn = new Function('document', src)(document);
  const el = document.node('p');
  fn(el, sentence);
  return el;
};
const links = (n, out = []) => { if (n.tag === 'a') out.push([n.textContent, n.href, n.rel, n.target]); (n.children || []).forEach((c) => links(c, out)); return out; };

describe('credit links on the Sources page', () => {
  it.each(['en', 'af', 'zu', 'xh', 'st'])('%s: every source name is a link, and the sentence reads as before', (lang) => {
    const el = render(attribution[lang]);
    const got = links(el);
    for (const [name, href] of [['Open-Meteo', 'https://open-meteo.com/'], ['WeatherAPI.com', 'https://www.weatherapi.com/'], ['MET Norway', 'https://www.met.no/en'], ['Pirate Weather', 'https://pirateweather.net/'], ['Tomorrow.io', 'https://www.tomorrow.io/']]) {
      expect(got, `${lang} ${name}`).toContainEqual([name, href, 'noopener noreferrer', '_blank']);
    }
    expect(el.children[el.children.length - 1].className).toBe('sources-credit-marks');
    expect(el.textContent.startsWith(attribution[lang])).toBe(true);
  });

  it('the required marks follow, each a link', () => {
    const got = links(render(attribution.en));
    expect(got).toContainEqual(['Search by LocationIQ.com', 'https://locationiq.com/', 'noopener noreferrer', '_blank']);
    expect(got).toContainEqual(['© OpenStreetMap contributors', 'https://www.openstreetmap.org/copyright', 'noopener noreferrer', '_blank']);
    expect(got).toContainEqual(['Open-Meteo: CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/', 'noopener noreferrer', '_blank']);
  });

  it('is wired where the sentence was set, and styled as links in the same ink', () => {
    expect(js).toContain("if (sourcesAttributionEl) renderSourcesAttribution(sourcesAttributionEl, t('sources', 'attribution'));");
    expect(css).toContain('.sources-attribution a { color: inherit; text-decoration: underline; text-underline-offset: 2px; }');
  });
});
