import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sw = () => readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

/**
 * Offline-fallback verification (SA4 polish bundle).
 *
 * Confirms the service worker actually delivers the "last-known-weather"
 * UX promise when the device is offline:
 *
 *   1. Core shell (HTML + critical JS/CSS) is pre-cached on install so a
 *      cold offline boot still serves the app frame.
 *   2. /api/weather is network-first with a cache fallback so the last
 *      successful JSON payload survives a connection drop.
 *   3. The HTML branch also falls back to a cached '/index.html' even
 *      when the requested URL itself isn't cached (deep-link recovery).
 *   4. Default branch falls back to cache.match on fetch failure so any
 *      previously-touched resource has a survival path.
 *
 * If any of these guarantees regress, install/restart in airplane mode
 * will surface a broken app — these checks are the static tripwire.
 */
describe('Offline fallback guarantees', () => {
  it('pre-caches the app shell on install', () => {
    const src = sw();
    expect(src).toMatch(/CORE_ASSETS\s*=\s*\[/);
    expect(src).toMatch(/['"]\/index\.html['"]/);
    expect(src).toMatch(/['"]\/assets\/app\.js['"]/);
    expect(src).toMatch(/['"]\/assets\/app\.css['"]/);
    expect(src).toMatch(/['"]\/manifest\.json['"]/);
    expect(src).toMatch(/addEventListener\(['"]install['"][\s\S]*?caches\.open\(CORE_CACHE\)[\s\S]*?\.addAll\(CORE_ASSETS\)/);
  });

  it('serves a cached weather response when the network is unreachable', () => {
    const src = sw();
    // The weather branch must catch network failure and look the request
    // up in the API cache before falling back to the offline 503 stub.
    expect(src).toMatch(/isWeatherApi\(url\)/);
    const weatherBlock = src.match(/if \(isWeatherApi\(url\)\) \{[\s\S]*?\}\)\(\)\);\s*\n\s*return;\s*\}/);
    expect(weatherBlock, 'weather fetch handler found').toBeTruthy();
    expect(weatherBlock[0]).toMatch(/catch\s*\{[\s\S]*?caches\.open\(API_CACHE\)[\s\S]*?cache\.match\(req\)/);
    expect(weatherBlock[0]).toMatch(/['"]sw-offline['"]/);
  });

  it('marks offline weather payloads so the UI can tell the user', () => {
    // The 'sw-offline' header lets app.js surface a "last updated X ago"
    // banner. Drop it and offline mode becomes silently confusing.
    expect(sw()).toMatch(/headers\.set\(['"]sw-offline['"],\s*['"]true['"]\)/);
  });

  it('falls back to cached index.html for any HTML navigation when offline', () => {
    const src = sw();
    const htmlBlock = src.match(/if \(isHtml\(req\) \|\| isCoreAsset\(url\)\) \{[\s\S]*?\}\)\(\)\);\s*\n\s*return;\s*\}/);
    expect(htmlBlock, 'HTML/core-asset fetch handler found').toBeTruthy();
    expect(htmlBlock[0]).toMatch(/catch\s*\{[\s\S]*?caches\.match\(req\)/);
    expect(htmlBlock[0]).toMatch(/caches\.match\(['"]\/index\.html['"]\)/);
  });

  it('falls back to cache for every other request type on network failure', () => {
    // Catch-all at the bottom: any GET we haven't routed explicitly
    // still gets a cache attempt on failure. Belt-and-braces for
    // first-party resources we don't classify.
    expect(sw()).toMatch(/fetch\(req\)\.catch\(\(\)\s*=>\s*caches\.match\(req\)\)/);
  });

  it('uses stale-while-revalidate for background images so cached art survives offline', () => {
    // Background images are the most visible offline signal — keep the
    // cache-first behaviour locked in.
    const src = sw();
    const imgBlock = src.match(/destination === ['"]image['"][\s\S]*?\}\)\(\)\);\s*\n\s*return;\s*\}/);
    expect(imgBlock, 'image branch found').toBeTruthy();
    // cache.match called before fetchPromise → cache-first behaviour.
    expect(imgBlock[0]).toMatch(/cache\.match\(req\)[\s\S]*?fetch\(req\)/);
    expect(imgBlock[0]).toMatch(/return cached \|\| \(await fetchPromise\)/);
  });

  it('bumps cache version per deploy so stale offline payloads do not linger forever', () => {
    expect(sw()).toMatch(/CACHE_VERSION\s*=\s*'pw-v2026-05-12-004'/);
  });
});
