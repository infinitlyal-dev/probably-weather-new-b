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
    expect(css()).toMatch(/main#home-screen\.main::before\s*{[^}]*linear-gradient\(to right,\s*rgba\(0,\s*0,\s*0,\s*0\.55\)/s);
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
