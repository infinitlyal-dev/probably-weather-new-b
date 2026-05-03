import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = () => readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
const css = () => readFileSync(new URL('../assets/app.css', import.meta.url), 'utf8');

const expectedLanguages = {
  en: 'Save',
  af: 'Stoor',
  zu: 'Londoloza',
  xh: 'Gcina',
  st: 'Boloka',
};

describe('tier 2 pre-resubmission fixes', () => {
  it('times out hanging weather fetches after 10 seconds and shows a localized toast', () => {
    const source = app();
    const fetchBlock = source.match(/async function fetchProbable\(place[\s\S]*?\n  function normalizePayload/)?.[0] || '';

    expect(fetchBlock).toMatch(/new AbortController\(\)/);
    expect(fetchBlock).toMatch(/setTimeout\([\s\S]*abort\(\)[\s\S]*10000\)/);
    expect(fetchBlock).toMatch(/fetch\(url,\s*\{ signal/);
    expect(fetchBlock).toMatch(/clearTimeout\(timeoutId\)/);
    expect(fetchBlock).toMatch(/showToast\(t\('toasts',\s*'weatherTimeout'\)/);
    expect(source).toMatch(/weatherTimeout:\s*\{[\s\S]*en:\s*"Weather lookup taking too long\. Try again\."[\s\S]*st:\s*"Ho sheba boemo ba leholimo ho nka nako e telele\. Leka hape\."/);
  });

  it('guards weather rendering against stale rapid location selections', () => {
    const source = app();
    const loadBlock = source.match(/async function loadAndRender\(place\) \{[\s\S]*?\n  \}/)?.[0] || '';

    expect(source).toMatch(/let activeLocationSeq\s*=\s*0/);
    expect(source).toMatch(/let activeWeatherController\s*=\s*null/);
    expect(loadBlock).toMatch(/const thisSeq\s*=\s*\+\+activeLocationSeq/);
    expect(loadBlock).toMatch(/activeWeatherController\?\.abort\(\)/);
    expect(loadBlock).toMatch(/fetchProbable\(place,\s*\{ signal: requestController\.signal \}\)/);
    expect(loadBlock).toMatch(/if \(thisSeq !== activeLocationSeq\) return/);
    expect(loadBlock).toMatch(/renderHome\(norm\)/);
  });

  it('updates the Save button label from translations for all five languages', () => {
    const source = app();

    for (const [lang, word] of Object.entries(expectedLanguages)) {
      expect(source).toMatch(new RegExp(`${lang}:\\s*"${word}"`));
    }
    expect(source).toMatch(/save:\s*\{[\s\S]*en:\s*"Save"[\s\S]*st:\s*"Boloka"/);
    expect(source).toMatch(/saveCurrent\.textContent\s*=\s*`☆ \$\{t\('misc',\s*'save'\)\}`/);
  });

  it('uses standalone-specific location permission copy in PWA mode', () => {
    const source = app();

    expect(source).toMatch(/function isStandaloneMode\(\)/);
    expect(source).toMatch(/matchMedia\??\.\('\(display-mode: standalone\)'\)|matchMedia\('\(display-mode: standalone\)'\)/);
    expect(source).toMatch(/navigator\.standalone === true/);
    expect(source).toMatch(/permissionDeniedBrowser:\s*\{/);
    expect(source).toMatch(/permissionDeniedStandalone:\s*\{/);
    expect(source).toMatch(/isStandaloneMode\(\)\s*\?\s*t\('toasts',\s*'permissionDeniedStandalone'\)\s*:\s*t\('toasts',\s*'permissionDeniedBrowser'\)/);
  });

  it('hides the tagline below 380px while leaving it visible from 400px upward', () => {
    const source = css();
    const smallPhoneRule = source.match(/@media\s*\(max-width:\s*379px\)\s*\{[\s\S]*?\.tagline\s*\{[\s\S]*?display:\s*none;[\s\S]*?\}\s*\}/)?.[0] || '';

    expect(smallPhoneRule).toContain('.tagline');
    expect(smallPhoneRule).toMatch(/display:\s*none/);
    expect(source).not.toMatch(/@media\s*\(max-width:\s*(38\d|39\d)px\)\s*\{[\s\S]*?\.tagline\s*\{[\s\S]*?display:\s*none/);
  });
});
