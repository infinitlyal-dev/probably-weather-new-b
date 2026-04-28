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
});
