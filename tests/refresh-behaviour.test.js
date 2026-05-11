// Refresh & auto-update behaviour for the tester rollout.
// Item 1: Auto-update location on launch + visibilitychange
// Item 2: Pull-to-refresh on the Home tab

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

import {
  FRESHNESS_MS,
  SIGNIFICANT_MOVE_KM,
  PLACE_MODE_GPS,
  PLACE_MODE_PINNED,
  haversineKm,
  shouldRefetchWeather,
  shouldUpdateLocation,
  PTR_THRESHOLD_PX,
  PTR_MAX_OVERSCROLL_PX,
  PTR_RESISTANCE,
  PTR_COPY,
} from '../assets/refresh-behaviour.js';

// ---------------------------------------------------------------------------
// Pure-helper unit tests
// ---------------------------------------------------------------------------

describe('haversineKm — great-circle distance', () => {
  it('returns 0 for identical points', () => {
    expect(haversineKm({ lat: -34.1, lon: 18.83 }, { lat: -34.1, lon: 18.83 })).toBe(0);
  });

  it('Strand → Paarl is ~50km (the actual bug scenario)', () => {
    // Strand: -34.12, 18.83 ; Paarl: -33.73, 18.97
    const d = haversineKm({ lat: -34.12, lon: 18.83 }, { lat: -33.73, lon: 18.97 });
    expect(d).toBeGreaterThan(40);
    expect(d).toBeLessThan(55);
  });

  it('Cape Town → Johannesburg is ~1260km', () => {
    // CT: -33.92, 18.42 ; JHB: -26.20, 28.05
    const d = haversineKm({ lat: -33.92, lon: 18.42 }, { lat: -26.20, lon: 28.05 });
    expect(d).toBeGreaterThan(1200);
    expect(d).toBeLessThan(1320);
  });

  it('returns NaN when either input lacks coords', () => {
    expect(haversineKm(null, { lat: 0, lon: 0 })).toBeNaN();
    expect(haversineKm({ lat: 0 }, { lat: 0, lon: 0 })).toBeNaN();
    expect(haversineKm({ lat: 0, lon: 0 }, undefined)).toBeNaN();
  });
});

describe('shouldRefetchWeather — freshness gate', () => {
  it("'pull-to-refresh' source always returns true (user intent overrides)", () => {
    expect(shouldRefetchWeather({ lastFetchTime: Date.now(), source: 'pull-to-refresh' })).toBe(true);
  });

  it("data <15min old → false (no fetch)", () => {
    expect(shouldRefetchWeather({ lastFetchTime: Date.now() - 5 * 60 * 1000, source: 'visibilitychange' })).toBe(false);
  });

  it("data >15min old → true (refetch)", () => {
    expect(shouldRefetchWeather({ lastFetchTime: Date.now() - 20 * 60 * 1000, source: 'visibilitychange' })).toBe(true);
  });

  it("data at exactly 15min boundary → false (must EXCEED 15 min)", () => {
    expect(shouldRefetchWeather({ lastFetchTime: Date.now() - 15 * 60 * 1000, source: 'visibilitychange' })).toBe(false);
  });

  it("lastFetchTime null/undefined → true (no record yet)", () => {
    expect(shouldRefetchWeather({ lastFetchTime: null, source: 'launch' })).toBe(true);
    expect(shouldRefetchWeather({ lastFetchTime: undefined, source: 'launch' })).toBe(true);
  });

  it("FRESHNESS_MS is exactly 15 minutes", () => {
    expect(FRESHNESS_MS).toBe(15 * 60 * 1000);
  });
});

describe('shouldUpdateLocation — GPS-mode-only move detection', () => {
  it("GPS mode, position moved >5km → true", () => {
    const result = shouldUpdateLocation({
      activePlace: { lat: -34.12, lon: 18.83, mode: PLACE_MODE_GPS, name: 'Strand' },
      newGps:      { lat: -33.73, lon: 18.97 }, // Paarl, ~50km
    });
    expect(result).toBe(true);
  });

  it("GPS mode, position moved <5km → false", () => {
    const result = shouldUpdateLocation({
      activePlace: { lat: -34.12, lon: 18.83, mode: PLACE_MODE_GPS, name: 'Strand' },
      newGps:      { lat: -34.13, lon: 18.84 }, // ~1km drift
    });
    expect(result).toBe(false);
  });

  it("PINNED mode, position moved >5km → false (pinned places are sticky)", () => {
    const result = shouldUpdateLocation({
      activePlace: { lat: -34.12, lon: 18.83, mode: PLACE_MODE_PINNED, name: 'Strand (pinned)' },
      newGps:      { lat: -33.73, lon: 18.97 }, // GPS would show Paarl
    });
    expect(result).toBe(false);
  });

  it("Missing activePlace → false", () => {
    expect(shouldUpdateLocation({ activePlace: null, newGps: { lat: 0, lon: 0 } })).toBe(false);
  });

  it("Missing newGps → false", () => {
    expect(shouldUpdateLocation({ activePlace: { lat: 0, lon: 0, mode: PLACE_MODE_GPS }, newGps: null })).toBe(false);
  });

  it("SIGNIFICANT_MOVE_KM is exactly 5km", () => {
    expect(SIGNIFICANT_MOVE_KM).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// PTR copy — all 5 languages present for all 3 states
// ---------------------------------------------------------------------------

describe('PTR copy — 5 languages × 3 states', () => {
  const LANGS = ['en', 'af', 'zu', 'xh', 'st'];
  const STATES = ['pull', 'release', 'refreshing'];

  it('every state has every language', () => {
    for (const state of STATES) {
      expect(PTR_COPY[state]).toBeDefined();
      for (const lang of LANGS) {
        expect(PTR_COPY[state][lang], `${state}.${lang} missing`).toBeTypeOf('string');
        expect(PTR_COPY[state][lang].length).toBeGreaterThan(0);
      }
    }
  });

  it("'pull' state in English reads 'Pull to refresh'", () => {
    expect(PTR_COPY.pull.en).toBe('Pull to refresh');
  });

  it("'release' state in Afrikaans reads 'Los om te verfris'", () => {
    expect(PTR_COPY.release.af).toBe('Los om te verfris');
  });

  it("'refreshing' state in Zulu uses ellipsis character (not three dots)", () => {
    expect(PTR_COPY.refreshing.zu).toMatch(/…/);
  });
});

describe('PTR thresholds and resistance', () => {
  it('PTR_THRESHOLD_PX is a sensible drag distance (40-100px)', () => {
    expect(PTR_THRESHOLD_PX).toBeGreaterThanOrEqual(40);
    expect(PTR_THRESHOLD_PX).toBeLessThanOrEqual(100);
  });

  it('PTR_MAX_OVERSCROLL_PX caps the affordance stretch beyond threshold', () => {
    expect(PTR_MAX_OVERSCROLL_PX).toBeGreaterThan(PTR_THRESHOLD_PX);
  });

  it('PTR_RESISTANCE is between 0 and 1 (visual feel: slower than finger)', () => {
    expect(PTR_RESISTANCE).toBeGreaterThan(0);
    expect(PTR_RESISTANCE).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Integration via source-reading — verify app.js wires up the helpers
// ---------------------------------------------------------------------------

describe('app.js wiring — auto-refresh + PTR are present', () => {
  const appSrc = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');

  it("imports from refresh-behaviour.js", () => {
    expect(appSrc).toMatch(/from\s+['"]\.\/refresh-behaviour\.js['"]/);
  });

  it("STORAGE.lastGps key is registered (cross-session position memory)", () => {
    expect(appSrc).toMatch(/STORAGE\s*=\s*\{[^}]*lastGps[^}]*\}/);
  });

  it("attemptRefresh function is defined", () => {
    expect(appSrc).toMatch(/function attemptRefresh\(\{\s*source\s*\}\)/);
  });

  it("visibilitychange listener calls attemptRefresh with 'visibilitychange' source", () => {
    expect(appSrc).toMatch(/visibilitychange[^}]*attemptRefresh\(\{\s*source:\s*['"]visibilitychange['"]/);
  });

  it("a launch-trigger fires attemptRefresh with 'launch' source", () => {
    expect(appSrc).toMatch(/attemptRefresh\(\{\s*source:\s*['"]launch['"]/);
  });

  it("PTR setup function is defined and called", () => {
    expect(appSrc).toMatch(/function setupPullToRefresh/);
    expect(appSrc).toMatch(/setupPullToRefresh\(\);/);
  });

  it("PTR calls attemptRefresh with 'pull-to-refresh' source", () => {
    expect(appSrc).toMatch(/attemptRefresh\(\{\s*source:\s*['"]pull-to-refresh['"]/);
  });

  it("Recent/Favorite/Search picks tag the place as PLACE_MODE_PINNED", () => {
    // At least three call sites pass mode: PLACE_MODE_PINNED
    const pinnedMatches = appSrc.match(/mode:\s*PLACE_MODE_PINNED/g) || [];
    expect(pinnedMatches.length).toBeGreaterThanOrEqual(3);
  });

  it("getCurrentLocation success path tags homePlace as PLACE_MODE_GPS", () => {
    expect(appSrc).toMatch(/mode:\s*PLACE_MODE_GPS/);
  });

  it("legacy homePlace records without a mode default to PLACE_MODE_GPS (migration)", () => {
    expect(appSrc).toMatch(/if \(homePlace && !homePlace\.mode\)/);
    expect(appSrc).toMatch(/homePlace\.mode\s*=\s*PLACE_MODE_GPS/);
  });

  it("touchstart bails when scrollY > 0 (don't interfere with scrolling)", () => {
    expect(appSrc).toMatch(/window\.scrollY\s*>\s*SCROLL_TOP_TOLERANCE/);
  });

  it("touchstart bails when starting near the left edge (iOS edge-swipe-back)", () => {
    expect(appSrc).toMatch(/t\.clientX\s*<\s*30/);
  });

  it("touchmove only preventDefaults when actually pulling down (preserves normal scroll)", () => {
    expect(appSrc).toMatch(/ev\.preventDefault\(\)/);
    // The guard should mention dy > 0 and a small threshold
    expect(appSrc).toMatch(/dy\s*>\s*5/);
  });

  it("loadApproximateLocation tags IP-derived place as PLACE_MODE_GPS (auto-derived, retries GPS later)", () => {
    expect(appSrc).toMatch(/loadApproximateLocation[\s\S]{0,300}mode:\s*PLACE_MODE_GPS/);
  });

  it("sharedPlace via URL is forced to PLACE_MODE_PINNED (don't override a shared link with GPS)", () => {
    // The init block re-tags sharedPlace before loadAndRender
    expect(appSrc).toMatch(/sharedPlace[\s\S]{0,200}mode:\s*PLACE_MODE_PINNED/);
  });
});

// ---------------------------------------------------------------------------
// CSS smoke check — PTR styles present
// ---------------------------------------------------------------------------

describe('PTR CSS', () => {
  const cssSrc = readFileSync(new URL('../assets/app.css', import.meta.url), 'utf8');

  it(".ptr-affordance class is defined", () => {
    expect(cssSrc).toMatch(/\.ptr-affordance\s*\{/);
  });

  it(".ptr-armed and .ptr-refreshing state classes exist", () => {
    expect(cssSrc).toMatch(/\.ptr-armed/);
    expect(cssSrc).toMatch(/\.ptr-refreshing/);
  });

  it("spinner uses the Probably yellow brand colour (#FFDD44)", () => {
    expect(cssSrc).toMatch(/#FFDD44/i);
  });

  it("#home-screen has position: relative (anchors absolute PTR affordance)", () => {
    expect(cssSrc).toMatch(/#home-screen[\s\S]{0,300}position:\s*relative/);
  });
});
