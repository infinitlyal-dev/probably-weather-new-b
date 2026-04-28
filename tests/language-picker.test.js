import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { resolveInitialLanguage } from '../assets/language-preferences.js';

const html = () => readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = () => readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
const css = () => readFileSync(new URL('../assets/app.css', import.meta.url), 'utf8');

describe('home language picker', () => {
  it('renders a Language pill with fixed text regardless of active language', () => {
    expect(html()).toMatch(/id="languageBtn"[^>]*class="language-btn"[^>]*aria-label="Change language"[^>]*aria-haspopup="listbox"[^>]*aria-expanded="false"[^>]*>\s*Language\s*<\/button>/);
  });

  it('opens the dropdown from the pill and marks aria-expanded true', () => {
    expect(app()).toMatch(/languageBtn\?\.addEventListener\('click'[\s\S]*openLanguageMenu/);
    expect(app()).toMatch(/languageBtn\.setAttribute\('aria-expanded',\s*'true'\)/);
    expect(html()).toMatch(/id="languageMenu"[^>]*role="listbox"/);
    expect(css()).toMatch(/\.language-menu\.open\s*{/);
  });

  it('closes the dropdown from outside tap or Escape and marks aria-expanded false', () => {
    expect(app()).toMatch(/document\.addEventListener\('click'[\s\S]*closeLanguageMenu/);
    expect(app()).toMatch(/document\.addEventListener\('keydown'[\s\S]*Escape[\s\S]*closeLanguageMenu/);
    expect(app()).toMatch(/languageBtn\.setAttribute\('aria-expanded',\s*'false'\)/);
  });

  it('selecting a language persists localStorage and rerenders the current UI', () => {
    expect(app()).toMatch(/function applyLanguageSelection\(lang\)/);
    expect(app()).toMatch(/settings\.lang\s*=\s*lang/);
    expect(app()).toMatch(/saveSettings\(\)/);
    expect(app()).toMatch(/applySettings\(\)/);
    expect(app()).toMatch(/lastPayload[\s\S]*renderHome/);
  });

  it('first launch detects Afrikaans from navigator.language', () => {
    expect(resolveInitialLanguage({ stored: null, navigatorLanguage: 'af-ZA' })).toBe('af');
  });

  it('first launch falls back to English for unsupported navigator.language', () => {
    expect(resolveInitialLanguage({ stored: null, navigatorLanguage: 'fr-FR' })).toBe('en');
  });
});
