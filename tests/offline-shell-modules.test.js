// Offline shell completeness (audit 2026-05-31, Gap A — FIX-BEFORE-LAUNCH).
//
// index.html loads assets/app.js as an ES module, which statically imports 9
// sibling modules. If any of those isn't in the service-worker cache, a cold
// OFFLINE launch white-screens: app.js loads from cache, then its first
// un-cached `import` rejects. Before this fix only 3 of the 9 were cached
// (app.js + install.js + startup-location.js); the catch-all fetch branch never
// cache.put()s /assets/*.js, and /assets/*.js is served must-revalidate, so the
// other 6 were never available offline.
//
// This test pins the invariant: EVERY module app.js imports must be both
// precached (CORE_ASSETS) and routed through the network-first-with-cache
// branch (isCoreAsset), so the offline shell can boot the whole module graph.

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const appSrc = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
const swSrc = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

// Every local module app.js imports → '/assets/<name>.js'.
const importedModules = [
  ...new Set([...appSrc.matchAll(/from\s+'\.\/([\w-]+\.js)'/g)].map((m) => `/assets/${m[1]}`)),
];

function loadServiceWorkerContext() {
  const context = {
    self: {
      addEventListener() {},
      skipWaiting() {},
      clients: { claim() {} },
      location: { origin: 'https://probablyweather.co.za' },
    },
    caches: {},
    URL,
    Headers,
    Response,
    fetch() {},
    Promise,
    Date,
    console,
  };
  vm.createContext(context);
  vm.runInContext(swSrc, context);
  return context;
}

// Group 6: app.js also DYNAMICALLY imports modules (lazy install.js, the
// per-language copy banks via copy-loader.js), and the L2 dedupe added a
// TRANSITIVE static dep (coord-parse.js via startup-location.js). None of
// these appear in app.js's own `from './x.js'` graph but the offline shell
// still needs every one of them.
const dynamicModules = [
  '/assets/install.js',
  '/assets/coord-parse.js',
  '/assets/copy/en.js',
  '/assets/copy/af.js',
  '/assets/copy/zu.js',
  '/assets/copy/xh.js',
  '/assets/copy/st.js',
];

describe('offline shell — every module app.js imports is in the SW cache', () => {
  it('app.js imports the full module graph (incl. the recently-added ones)', () => {
    // 16 direct static imports. 2026-07-02: weekend-filter.js left app.js's
    // graph (day-filtering moved to structural tags) and witty-day-tags.js
    // joined it; 2026-07-03 adds geo-regions.js for context gating; M5
    // (2026-08-08) adds weather-icons.js, which carries the drawings that
    // replaced the platform emoji.
    // (coord-parse.js is a TRANSITIVE dep via
    // startup-location.js — covered by the dynamicModules precache check below.)
    // The deploy stamp (BUILD_ID) is kept INLINE in app.js — deliberately not a
    // separate imported module — so it never adds a hard offline-boot dependency.
    // 2026-08-19 adds hero-lines.js: Al's bespoke witty lines, keyed to the
    // photograph rather than the condition. It is a hard boot dependency because
    // app.js resolves the caption through it on the paint path.
    expect(importedModules.length).toBe(18);
    for (const mod of [
      '/assets/language-preferences.js',
      '/assets/copy-loader.js',
      '/assets/witty-day-tags.js',
      '/assets/geo-regions.js',
      '/assets/weather-visuals.js',
      '/assets/image-picker.js',
      '/assets/weather-emoji.js',
      '/assets/weather-icons.js',
      '/assets/hero-crop.js',
      '/assets/share-url.js',
      '/assets/refresh-behaviour.js',
      '/assets/first-open-location.js',
      '/assets/home-name.js',
      '/assets/weather-thresholds.js',
      '/assets/search-mini-weather.js',
      '/assets/install-loader.js',
    ]) {
      expect(importedModules).toContain(mod);
    }
    // The static graph must NOT pull the five-language monolith back in —
    // that would undo the per-language split.
    expect(importedModules).not.toContain('/assets/weather-copy.js');
  });

  it('app.js dynamically imports install.js and the per-language banks', () => {
    expect(appSrc).toMatch(/import\(['"]\.\/install\.js['"]\)/);
    expect(appSrc).toMatch(/loadCopyBank\(/);
  });

  it('CORE_ASSETS precaches every dynamically-imported module', () => {
    const coreBlock = swSrc.match(/CORE_ASSETS\s*=\s*\[([\s\S]*?)\]/)[1];
    for (const mod of dynamicModules) {
      expect(coreBlock, `${mod} missing from CORE_ASSETS (precache)`).toContain(`'${mod}'`);
    }
  });

  it('CORE_ASSETS precaches every imported module', () => {
    const coreBlock = swSrc.match(/CORE_ASSETS\s*=\s*\[([\s\S]*?)\]/)[1];
    for (const mod of importedModules) {
      expect(coreBlock, `${mod} missing from CORE_ASSETS (precache)`).toContain(`'${mod}'`);
    }
  });

  it('isCoreAsset() routes every imported module through the cached branch', () => {
    const ctx = loadServiceWorkerContext();
    for (const mod of importedModules) {
      expect(
        ctx.isCoreAsset(new URL(`https://probablyweather.co.za${mod}`)),
        `isCoreAsset() false for ${mod} — would fall to the no-cache catch-all`,
      ).toBe(true);
    }
  });
});
