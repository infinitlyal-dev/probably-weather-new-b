import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = () => readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = () => readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
const css = () => readFileSync(new URL('../assets/app.css', import.meta.url), 'utf8');

describe('search panel my-location entry point', () => {
  // M3 (Al, 2026-08-08) splits this into two contracts that pull opposite ways.
  // .screen-panel-header is flex-direction:column UNSCOPED, so DOM order is the
  // >=769px visual order — reordering the markup would silently rearrange the
  // desktop screen. So the MARKUP keeps the pre-M3 order (CTA above input) and
  // the approved Plekke order (search field primary) is produced by `order`
  // inside the <=768px block. Both halves are guarded, because satisfying
  // either one alone is a regression of the other.
  it('keeps the pre-M3 DOM order so the >=769px screen is unchanged', () => {
    const source = html();
    const buttonIndex = source.indexOf('id="useMyLocationBtn"');
    const inputIndex = source.indexOf('id="searchInput"');

    expect(buttonIndex).toBeGreaterThan(-1);
    expect(inputIndex).toBeGreaterThan(-1);
    expect(buttonIndex).toBeLessThan(inputIndex);
    expect(source).toMatch(/id="useMyLocationBtn"[^>]*class="use-location-btn"[\s\S]*📍[\s\S]*Use my location/);
    expect(css()).toMatch(/\.use-location-btn\s*{/);
  });

  it('puts the search field first on mobile via CSS order, not markup order', () => {
    const sheet = css();
    const mobileBlock = sheet.slice(sheet.indexOf('MOBILE FACELIFT M3'));
    const orderOf = (sel) => {
      const rule = new RegExp(`${sel}\\s*\\{[^}]*?order:\\s*(\\d+)`, 's').exec(mobileBlock);
      return rule ? Number(rule[1]) : null;
    };
    const input = orderOf('#searchInput');
    const cta = orderOf('#useMyLocationBtn');
    expect(input, 'search input has no mobile order').not.toBeNull();
    expect(cta, 'location CTA has no mobile order').not.toBeNull();
    expect(input).toBeLessThan(cta);
  });

  it('tapping Use my location triggers the shared geolocation flow', () => {
    expect(app()).toMatch(/const useMyLocationBtn\s*=\s*\$\('#useMyLocationBtn'\)/);
    expect(app()).toMatch(/async function getCurrentLocation\(/);
    expect(app()).toMatch(/useMyLocationBtn\?\.addEventListener\('click'[\s\S]*getCurrentLocation/);
  });

  it('places a My Location button in the home action row, wired to the shared geolocation flow', () => {
    // Valk's UI wave: My Location took Save's old home right-slot — one tap
    // back to the user's own weather (GPS or saved home) via getCurrentLocation.
    // (Supersedes the earlier "no my-location button on home" guard.)
    const source = html();
    expect(source).toMatch(/id="myLocationHome"[^>]*class="my-location-btn"/);
    expect(source).toMatch(/id="myLocationHome"[\s\S]*📍/);
    expect(css()).toMatch(/\.my-location-btn\s*\{/);
    expect(app()).toMatch(/const myLocationHome\s*=\s*\$\('#myLocationHome'\)/);
    expect(app()).toMatch(/myLocationHome\?\.addEventListener\('click'[\s\S]*getCurrentLocation/);
  });

  it('relocates the Save button out of the home action row into the Search flow', () => {
    const source = html();
    const searchIdx = source.indexOf('id="search-screen"');
    const saveIdx = source.indexOf('id="saveCurrent"');
    expect(saveIdx).toBeGreaterThan(-1);
    expect(searchIdx).toBeGreaterThan(-1);
    // Save now lives inside the search screen (the favourites hub), not the
    // home action row — its markup appears after the search-screen opens.
    expect(saveIdx).toBeGreaterThan(searchIdx);
    // And it is no longer the fixed bottom-right home pill.
    expect(source).not.toMatch(/id="saveCurrent"[^>]*class="save-current-btn"/);
  });
});
