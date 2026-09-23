// The skip link at the top of index.html ("Skip to main content") is read out by
// screen readers and shown on keyboard focus. It was English in every language
// (launch eval, 2026-09-24): it now comes from the catalogue, and the language
// pass that relabels the nav and the picker writes it too.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('skip link follows the language', () => {
  it('the catalogue carries it in all five languages, none of them the English', () => {
    const m = app.match(/skipToContent: \{ en: "([^"]+)", af: "([^"]+)", zu: "([^"]+)", xh: "([^"]+)", st: "([^"]+)" \}/);
    expect(m, 'T.misc.skipToContent').toBeTruthy();
    const [, en, ...rest] = m;
    expect(en).toBe('Skip to main content');
    for (const s of rest) expect(s).not.toBe(en);
  });

  it('index.html still has the link, and the language pass writes its text from the catalogue', () => {
    expect(html).toMatch(/<a href="#home-screen" class="skip-link">/);
    expect(app).toMatch(/document\.querySelector\('\.skip-link'\)[\s\S]{0,80}textContent = t\('misc', 'skipToContent'\)/);
  });
});
