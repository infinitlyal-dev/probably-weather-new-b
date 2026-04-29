import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sw = () => readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const app = () => readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
const css = () => readFileSync(new URL('../assets/app.css', import.meta.url), 'utf8');
const html = () => readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('production bug batch fixes', () => {
  it('defines a dated service worker cache version constant', () => {
    expect(sw()).toMatch(/const\s+CACHE_VERSION\s*=\s*['"]pw-v\d{4}-\d{2}-\d{2}-\d{3}['"]/);
    expect(sw()).toMatch(/postMessage\(\{[\s\S]*type:\s*['"]PW_UPDATE_AVAILABLE['"]/);
  });

  it('shows permission feedback before falling back from denied geolocation', () => {
    expect(app()).toContain('Location permission needed. Tap the location icon in your browser');
    expect(app()).toMatch(/showGeolocationErrorToast\(err\)[\s\S]*getIPLocation\(\)/);
  });

  it('applies the shared panel background token to screen panels', () => {
    expect(css()).toMatch(/--panel-bg:\s*rgba\(0,\s*0,\s*0,\s*0\.78\)/);
    expect(css()).toMatch(/\.screenPanel\s*{[\s\S]*background:\s*var\(--panel-bg\)/);
    expect(css()).toMatch(/\.search-screen\s*{[\s\S]*background:\s*var\(--panel-bg\)/);
    expect(css()).toMatch(/\.settings-screen\s*{[\s\S]*background:\s*var\(--panel-bg\)/);
  });

  it('removes the unused glass-panel class', () => {
    expect(css()).not.toMatch(/\.glass-panel\s*{/);
  });

  it('uses a soft radial home scrim instead of a hard linear box', () => {
    const homeScrim = css().match(/main#home-screen\.main::before\s*{[\s\S]*?}/)?.[0] || '';
    expect(homeScrim).toContain('radial-gradient');
    expect(homeScrim).not.toContain('linear-gradient');
    expect(homeScrim).toMatch(/border-radius:\s*0\b/);
  });

  it('removes the non-functional temperature range setting from settings', () => {
    expect(html()).not.toContain('Show temperature range');
    expect(html()).not.toContain('id="probRange"');
    expect(app()).not.toContain('display.range');
    expect(app()).not.toContain('probRangeToggle');
  });
});
