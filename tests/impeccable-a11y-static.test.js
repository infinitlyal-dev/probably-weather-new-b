import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = () => readFileSync(new URL('../assets/app.css', import.meta.url), 'utf8');
const html = () => readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('Impeccable accessibility hardening', () => {
  it('enforces 44px minimum touch targets for buttons and role buttons', () => {
    expect(css()).toMatch(/button,\s*\[role="button"\]\s*{[^}]*min-block-size:\s*44px;[^}]*min-inline-size:\s*44px;/s);
  });

  it('announces factual weather updates without making witty copy a live region', () => {
    expect(html()).toMatch(/id="weatherStatus"[^>]*role="status"[^>]*aria-live="polite"/);
    expect(html()).toMatch(/<p id="headline" class="headline">Loading…<\/p>/);
  });

  it('adds solid byline text and a localized home text scrim for photo contrast', () => {
    expect(css()).toMatch(/\.weather-byline\s*{[^}]*color:\s*#fff;/s);
    expect(css()).toMatch(/main#home-screen\.main::before\s*{[^}]*radial-gradient\(ellipse at 30% 50%,\s*rgba\(0,\s*0,\s*0,\s*0\.55\)/s);
  });

  it('keeps the home scrim out of text flow and avoids mid-word headline wrapping', () => {
    const source = css();
    const homeScrimRule = source.match(/main#home-screen\.main::before\s*{(?<rule>[^}]*)}/s)?.groups?.rule || '';
    const allHomeRules = Array.from(source.matchAll(/#home-screen\s*{(?<rule>[^}]*)}/gs), (match) => match.groups?.rule || '').join('\n');
    const headlineRules = Array.from(source.matchAll(/\.headline\s*{(?<rule>[^}]*)}/gs), (match) => match.groups?.rule || '');
    const mobileHeadlineRule = headlineRules.find((rule) => rule.includes('font-size: clamp(1.4rem')) || '';

    expect(homeScrimRule).toMatch(/inset:/);
    expect(homeScrimRule).not.toMatch(/width:/);
    expect(homeScrimRule).not.toMatch(/height:/);
    expect(allHomeRules).not.toMatch(/max-width:\s*65%/);
    expect(mobileHeadlineRule).toMatch(/word-break:\s*normal;/);
    expect(mobileHeadlineRule).toMatch(/overflow-wrap:\s*normal;/);
  });

  it('uses the system font stack without render-blocking Google Fonts', () => {
    expect(css()).not.toMatch(/fonts\.googleapis|Poppins|Montserrat/);
    expect(css()).toMatch(/--font-system:\s*-apple-system,\s*BlinkMacSystemFont,\s*"Segoe UI",\s*Roboto,\s*sans-serif;/);
  });

  it('does not globally hide page overflow on html and body', () => {
    const globalBodyRule = css().match(/body,\s*html\s*{(?<body>[^}]*)}/s)?.groups?.body || '';
    expect(globalBodyRule).not.toMatch(/overflow:\s*hidden/);
  });
});
