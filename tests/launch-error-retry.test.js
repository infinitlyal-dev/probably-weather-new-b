// Launch run (2026-09-25), Al's ticked list "error-retry": when the weather cannot load, a plain
// sentence and a Try again button (it was "Error" in handwriting with nothing to tap). The error
// state in every language is exercised through the real app code in tests/language-leaks.test.js.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const js = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
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

describe('error-retry', () => {
  it('the error state writes no "Error" on the photograph and shows the button', () => {
    const body = sliceFn('renderError');
    expect(body).not.toContain("t('misc', 'error')");
    expect(body).toContain("safeText(headlineEl, '')");
    expect(body).toContain('showRetry(true)');
    expect(html).toContain('<button type="button" id="retryWeather" class="retry-weather" hidden>Try again</button>');
    expect(sliceFn('renderHome')).toContain('showRetry(false)');
    expect(sliceFn('renderLoading')).toContain('showRetry(false)');
  });
  it('showRetry shows the button in the reader\'s language, and hides it', () => {
    const btn = { hidden: true, textContent: 'Try again' };
    const showRetry = new Function('deps', `with (deps) { ${sliceFn('showRetry')}\nreturn showRetry; }`)({
      document: { getElementById: (id) => (id === 'retryWeather' ? btn : null) },
      t: (c, k) => (c === 'misc' && k === 'tryAgain' ? 'Probeer weer' : k),
    });
    showRetry(true);
    expect(btn).toEqual({ hidden: false, textContent: 'Probeer weer' });
    showRetry(false);
    expect(btn.hidden).toBe(true);
  });
  it('the button asks for the same place again', () => {
    expect(js).toContain("document.getElementById('retryWeather')?.addEventListener('click', () => {\n    showRetry(false);\n    const place = activePlace || homePlace;\n    if (place) loadAndRender(place); else location.reload();\n  });");
  });
  it('Try again in all five languages', () => {
    expect(js).toContain('tryAgain: { en: "Try again", af: "Probeer weer", zu: "Zama futhi", xh: "Zama kwakhona", st: "Leka hape" }');
  });
});
