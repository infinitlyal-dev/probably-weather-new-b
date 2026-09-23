// Offline, sw.js answers /api/weather from its own cache (up to 3 h old) and marks the
// response sw-offline: true + sw-cache-age-ms. The app used to render that copy as a fresh
// forecast with no age shown (launch eval, 2026-09-24: proven in the browser with every
// connection dropped — review/eval/scripts/failure-paths.mjs offline-after-first-visit,
// "offline": null before, "Using cached data (just now)" after). This guards the wiring.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const fetchProbable = app.match(/async function fetchProbable\(place, options = \{\}\) \{(?<body>[\s\S]*?)\n  \}/)?.groups?.body || '';
const loadAndRender = app.match(/async function loadAndRender\(place\) \{(?<body>[\s\S]*?)\n  \}/)?.groups?.body || '';

describe('an offline copy from the service worker says how old it is', () => {
  it('the worker still marks its offline answers', () => {
    expect(sw).toMatch(/sw-offline/);
    expect(sw).toMatch(/sw-cache-age-ms/);
  });

  it('fetchProbable records the age only for a response the worker marked, keyed by the payload object', () => {
    expect(app).toMatch(/const swOfflineAgeMs = new WeakMap\(\);/);
    expect(fetchProbable).toMatch(/if \(resp\.headers\.get\('sw-offline'\) === 'true'\) \{/);
    expect(fetchProbable).toMatch(/swOfflineAgeMs\.set\(data, age\)/);
  });

  it('loadAndRender shows the age, and neither saves the copy as fresh nor counts it as a fetch', () => {
    const branch = loadAndRender.match(/if \(swOfflineAgeMs\.has\(payload\)\) \{(?<b>[\s\S]*?)\n      \}/)?.groups?.b || '';
    expect(branch).toMatch(/showCacheAge\(Date\.now\(\) - swOfflineAgeMs\.get\(payload\)\)/);
    expect(branch).toMatch(/return true;/);
    expect(branch).not.toMatch(/setCachedWeather|lastFetchTime/);
    // the fresh path after it still does both
    expect(loadAndRender).toMatch(/hideCacheAge\(\);\s*setCachedWeather\(place, payload\);\s*lastFetchTime = Date\.now\(\);/);
  });
});
