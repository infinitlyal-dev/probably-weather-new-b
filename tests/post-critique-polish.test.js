import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = () => readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = () => readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
const css = () => readFileSync(new URL('../assets/app.css', import.meta.url), 'utf8');

describe('post-critique polish fixes', () => {
  it('scopes the Language pill to the active home screen only', () => {
    expect(app()).toMatch(/classList\.toggle\('home-active',\s*which\s*===\s*screenHome\)/);
    expect(css()).toMatch(/body:not\(\.home-active\)\s+\.language-picker\s*{[\s\S]*display:\s*none/);
  });

  it('hides the footer at mobile viewport widths', () => {
    expect(css()).toMatch(/@media\s*\(max-width:\s*480px\)\s*{[\s\S]*\.footer\s*{[\s\S]*display:\s*none/);
  });

  it('keeps the footer visible at tablet and larger viewport widths', () => {
    expect(css()).toMatch(/\.footer\s*{[\s\S]*position:\s*fixed/);
    expect(css()).not.toMatch(/@media\s*\(min-width:\s*481px\)[\s\S]*\.footer\s*{[\s\S]*display:\s*none/);
  });

  it('hides search maintenance actions and per-item remove buttons by default', () => {
    expect(html()).toMatch(/class="screen-panel-footer search-maintenance"/);
    expect(css()).toMatch(/\.search-maintenance\s*{[\s\S]*display:\s*none/);
    expect(app()).toMatch(/const searchEditToggle\s*=\s*\$\('#searchEditToggle'\)/);
    expect(app()).toMatch(/const rb\s*=\s*searchEditMode\s*\?/);
  });

  it('reveals search maintenance actions and remove buttons in edit mode', () => {
    expect(html()).toMatch(/id="searchEditToggle"[^>]*class="search-edit-toggle"/);
    expect(css()).toMatch(/\.search-screen\.is-editing\s+\.search-maintenance\s*{[\s\S]*display:\s*flex/);
    expect(app()).toMatch(/searchEditMode\s*=\s*!searchEditMode/);
    expect(app()).toMatch(/screenSearch\?\.classList\.toggle\('is-editing',\s*searchEditMode\)/);
  });
});
