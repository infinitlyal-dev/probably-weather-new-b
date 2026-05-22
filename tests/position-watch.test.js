import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  shouldAcceptWatchUpdate,
  WATCH_DEBOUNCE_MS,
  MANUAL_OVERRIDE_GRACE_MS,
  SIGNIFICANT_MOVE_KM,
  haversineKm,
  PLACE_MODE_GPS,
  PLACE_MODE_PINNED,
} from '../assets/refresh-behaviour.js';

// ---------------------------------------------------------------------------
// Bug 3 — continuous position watch (2026-05-24).
//
// The diagnosis: no watchPosition listener, a 30-min re-detect interval, and a
// 5 km move threshold larger than the real Strand→Somerset West suburb
// distance (~3 km). Fix: watchPosition + a 1.5 km threshold + a 60 s debounce
// + a 30-min manual-override grace window.
//
// shouldAcceptWatchUpdate() is the pure decision gate — tested here directly.
// ---------------------------------------------------------------------------

const T0 = 1_700_000_000_000; // arbitrary fixed "now"
const STRAND = { lat: -34.1163, lon: 18.8362, mode: PLACE_MODE_GPS, name: 'Strand' };

// Build a point a given north-south distance (km) from a base point.
// 1° latitude ≈ 111.19 km (haversine, R=6371).
function pointKmNorth(base, km) {
  return { lat: base.lat + km / 111.19, lon: base.lon };
}

describe('constants', () => {
  it('SIGNIFICANT_MOVE_KM lowered to 1.5 km (was 5 km — Bug 3)', () => {
    expect(SIGNIFICANT_MOVE_KM).toBe(1.5);
  });
  it('WATCH_DEBOUNCE_MS is 60 seconds', () => {
    expect(WATCH_DEBOUNCE_MS).toBe(60 * 1000);
  });
  it('MANUAL_OVERRIDE_GRACE_MS is 30 minutes', () => {
    expect(MANUAL_OVERRIDE_GRACE_MS).toBe(30 * 60 * 1000);
  });
});

describe('shouldAcceptWatchUpdate — debounce', () => {
  const farMove = pointKmNorth(STRAND, 3); // well past the 1.5km gate

  it('rejects a second update within 60s of the last accepted one', () => {
    const accepted = shouldAcceptWatchUpdate({
      now: T0 + 30_000,            // 30s after the last accept
      lastAcceptedAt: T0,
      manualSetAt: 0,
      activePlace: STRAND,
      newGps: farMove,
    });
    expect(accepted).toBe(false);
  });

  it('accepts an update once 60s+ has passed since the last accept', () => {
    const accepted = shouldAcceptWatchUpdate({
      now: T0 + 61_000,
      lastAcceptedAt: T0,
      manualSetAt: 0,
      activePlace: STRAND,
      newGps: farMove,
    });
    expect(accepted).toBe(true);
  });
});

describe('shouldAcceptWatchUpdate — distance threshold (1.5 km)', () => {
  it('a 1.4 km move is IGNORED (below 1.5 km)', () => {
    const near = pointKmNorth(STRAND, 1.4);
    expect(haversineKm(STRAND, near)).toBeLessThan(1.5);
    expect(shouldAcceptWatchUpdate({
      now: T0, lastAcceptedAt: 0, manualSetAt: 0, activePlace: STRAND, newGps: near,
    })).toBe(false);
  });

  it('a 1.6 km move TRIGGERS a refresh (above 1.5 km)', () => {
    const far = pointKmNorth(STRAND, 1.6);
    expect(haversineKm(STRAND, far)).toBeGreaterThan(1.5);
    expect(shouldAcceptWatchUpdate({
      now: T0, lastAcceptedAt: 0, manualSetAt: 0, activePlace: STRAND, newGps: far,
    })).toBe(true);
  });

  it('Strand → Somerset West (~3 km) now triggers — the original bug', () => {
    const somersetWest = { lat: -34.0847, lon: 18.8531 };
    expect(haversineKm(STRAND, somersetWest)).toBeGreaterThan(1.5);
    expect(shouldAcceptWatchUpdate({
      now: T0, lastAcceptedAt: 0, manualSetAt: 0, activePlace: STRAND, newGps: somersetWest,
    })).toBe(true);
  });
});

describe('shouldAcceptWatchUpdate — manual-override grace window', () => {
  const farMove = pointKmNorth(STRAND, 5);

  it('a watch update 10 min after a manual "Use my location" is IGNORED', () => {
    expect(shouldAcceptWatchUpdate({
      now: T0,
      lastAcceptedAt: 0,
      manualSetAt: T0 - 10 * 60 * 1000, // 10 min ago — inside the 30-min grace
      activePlace: STRAND,
      newGps: farMove,
    })).toBe(false);
  });

  it('a watch update 31 min after a manual pick is ACCEPTED (grace expired)', () => {
    expect(shouldAcceptWatchUpdate({
      now: T0,
      lastAcceptedAt: 0,
      manualSetAt: T0 - 31 * 60 * 1000,
      activePlace: STRAND,
      newGps: farMove,
    })).toBe(true);
  });
});

describe('shouldAcceptWatchUpdate — pinned places & guards', () => {
  it('a pinned place is never overridden by the watch, even on a big move', () => {
    const pinned = { ...STRAND, mode: PLACE_MODE_PINNED };
    expect(shouldAcceptWatchUpdate({
      now: T0, lastAcceptedAt: 0, manualSetAt: 0,
      activePlace: pinned, newGps: pointKmNorth(STRAND, 50),
    })).toBe(false);
  });

  it('missing activePlace / newGps → false', () => {
    expect(shouldAcceptWatchUpdate({ now: T0, lastAcceptedAt: 0, manualSetAt: 0, activePlace: null, newGps: { lat: 0, lon: 0 } })).toBe(false);
    expect(shouldAcceptWatchUpdate({ now: T0, lastAcceptedAt: 0, manualSetAt: 0, activePlace: STRAND, newGps: null })).toBe(false);
  });

  it('non-finite now → false (defensive)', () => {
    expect(shouldAcceptWatchUpdate({ now: NaN, lastAcceptedAt: 0, manualSetAt: 0, activePlace: STRAND, newGps: pointKmNorth(STRAND, 5) })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Integration via source-reading — verify app.js wires the watch up.
// ---------------------------------------------------------------------------
describe('app.js wiring — Bug 3 position watch', () => {
  const appSrc = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');

  it('imports shouldAcceptWatchUpdate from refresh-behaviour.js', () => {
    expect(appSrc).toMatch(/shouldAcceptWatchUpdate/);
  });
  it('defines and calls setupPositionWatch()', () => {
    expect(appSrc).toMatch(/function setupPositionWatch\(\)/);
    expect(appSrc).toMatch(/\n\s*setupPositionWatch\(\);/);
  });
  it('uses navigator.geolocation.watchPosition', () => {
    expect(appSrc).toMatch(/navigator\.geolocation\.watchPosition\(/);
  });
  it('defines evictWeatherCache and calls it on a watched move', () => {
    expect(appSrc).toMatch(/function evictWeatherCache\(/);
    expect(appSrc).toMatch(/evictWeatherCache\(previousPlace\)/);
  });
  it('records the manual location tap timestamp (manualLocationAt)', () => {
    expect(appSrc).toMatch(/manualLocationAt\s*=\s*Date\.now\(\)/);
  });
  it('the background re-detect interval is 10 minutes (was 30)', () => {
    expect(appSrc).toMatch(/REFRESH_INTERVAL_MS\s*=\s*10\s*\*\s*60\s*\*\s*1000/);
  });
});
