import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = () => readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = () => readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
const css = () => readFileSync(new URL('../assets/app.css', import.meta.url), 'utf8');

describe('search panel my-location entry point', () => {
  it('renders the Use my location button above the search input', () => {
    const source = html();
    const buttonIndex = source.indexOf('id="useMyLocationBtn"');
    const inputIndex = source.indexOf('id="searchInput"');

    expect(buttonIndex).toBeGreaterThan(-1);
    expect(inputIndex).toBeGreaterThan(-1);
    expect(buttonIndex).toBeLessThan(inputIndex);
    expect(source).toMatch(/id="useMyLocationBtn"[^>]*class="use-location-btn"[\s\S]*📍[\s\S]*Use my location/);
    expect(css()).toMatch(/\.use-location-btn\s*{/);
  });

  it('tapping Use my location triggers the shared geolocation flow', () => {
    expect(app()).toMatch(/const useMyLocationBtn\s*=\s*\$\('#useMyLocationBtn'\)/);
    expect(app()).toMatch(/async function getCurrentLocation\(/);
    expect(app()).toMatch(/useMyLocationBtn\?\.addEventListener\('click'[\s\S]*getCurrentLocation/);
  });

  it('removes the old top-right My Location button from the DOM and CSS', () => {
    expect(html()).not.toMatch(/id="myLocationBtn"|my-location-btn/);
    expect(app()).not.toMatch(/myLocationBtn/);
    expect(css()).not.toMatch(/my-location-btn/);
  });
});
