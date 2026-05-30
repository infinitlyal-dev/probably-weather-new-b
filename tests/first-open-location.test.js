// First-open location coordinator.
//
// Bug (confirmed on a real phone, 2026-05-30): a first-time user with NO saved
// location stared at a blank "Locating…" screen for up to 8 seconds because the
// cold-open branch only fell back to IP geolocation AFTER getCurrentPosition
// errored or timed out (timeout: 8000). IP was serialized behind GPS failure.
//
// Fix: fire GPS immediately, start a ~1s grace timer in parallel. If GPS lands
// within the grace window, use it (no IP call). If the grace fires first, paint
// from IP straight away (~1.5–2s) and let a late GPS resolve UPGRADE to precise
// coords — but only if the user hasn't navigated away in the meantime.
//
// The race this guards (and what codex must hammer): a late GPS resolve must
// never clobber a place the user chose after the IP paint, an in-flight IP
// fetch must never downgrade a GPS fix that already won, and there must be no
// infinite spinner if both sources fail.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import {
  GPS_GRACE_MS,
  startFirstOpenLocation,
} from '../assets/first-open-location.js';

function makeDeferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

// Two microtask ticks: enough to drain the `await fetchIpPlace()` continuation
// in the coordinator's IP path.
const tick = async () => { await Promise.resolve(); await Promise.resolve(); };

// Test harness mirroring the app.js runtime: `activePlace` starts null (the
// "Locating…" screen, before anything is rendered) and is set by paint(), the
// same way loadAndRender() assigns activePlace in the app.
function makeHarness() {
  let activePlace = null;
  let persistedHome = null;
  let graceCb = null;
  let graceCancelled = false;
  let onGpsSuccess = null;
  let onGpsError = null;
  let ipFetchCount = 0;
  let ipDeferred = null;
  const paints = [];
  const toasts = [];

  const deps = {
    getCurrentPosition: (onS, onE) => { onGpsSuccess = onS; onGpsError = onE; },
    gpsPlaceFromCoords: (coords) => ({
      name: 'My Location', lat: coords.latitude, lon: coords.longitude, mode: 'gps', src: 'gps',
    }),
    fetchIpPlace: () => {
      ipFetchCount += 1;
      ipDeferred = makeDeferred();
      return ipDeferred.promise;
    },
    paint: (place) => { activePlace = place; paints.push(place); },
    persistHome: (place) => { persistedHome = place; },
    getActivePlace: () => activePlace,
    onApproxToast: (err) => { toasts.push(err); },
    setTimeoutFn: (cb) => { graceCb = cb; return 'grace-handle'; },
    clearTimeoutFn: () => { graceCancelled = true; },
  };

  return {
    deps,
    start: () => startFirstOpenLocation(deps),
    fireGrace: () => { if (graceCb) graceCb(); },
    fireGpsSuccess: (coords) => onGpsSuccess(coords),
    fireGpsError: (err) => onGpsError(err),
    resolveIp: async (place) => {
      ipDeferred.resolve(place ?? { name: 'Joburg, ZA', lat: -26.2, lon: 28.0, mode: 'gps', src: 'ip' });
      await tick();
    },
    userPicks: (place) => { activePlace = place; },  // user search/saved-place tap
    get paints() { return paints; },
    get toasts() { return toasts; },
    get persistedHome() { return persistedHome; },
    get graceCancelled() { return graceCancelled; },
    get ipFetchCount() { return ipFetchCount; },
    get activePlace() { return activePlace; },
  };
}

describe('startFirstOpenLocation — exports', () => {
  it('exposes a ~1s grace window constant', () => {
    expect(GPS_GRACE_MS).toBeGreaterThanOrEqual(500);
    expect(GPS_GRACE_MS).toBeLessThanOrEqual(2000);
  });
});

describe('startFirstOpenLocation — source selection', () => {
  it('GPS instant (within grace): uses GPS, never calls IP, persists GPS', () => {
    const h = makeHarness();
    h.start();
    h.fireGpsSuccess({ latitude: -34.1, longitude: 18.8 });

    expect(h.ipFetchCount).toBe(0);            // no IP lookup when GPS is fast
    expect(h.paints).toHaveLength(1);
    expect(h.paints[0].src).toBe('gps');
    expect(h.persistedHome.src).toBe('gps');
    expect(h.graceCancelled).toBe(true);
    expect(h.toasts).toHaveLength(0);

    // A late grace firing must be a no-op (GPS already won).
    h.fireGrace();
    expect(h.ipFetchCount).toBe(0);
    expect(h.paints).toHaveLength(1);
  });

  it('GPS slow-succeeds (after grace): IP paints first, GPS upgrades, persists GPS', async () => {
    const h = makeHarness();
    h.start();
    h.fireGrace();                              // grace beats GPS → start IP
    await h.resolveIp();                        // IP paints fast
    expect(h.paints).toHaveLength(1);
    expect(h.paints[0].src).toBe('ip');
    expect(h.persistedHome.src).toBe('ip');

    h.fireGpsSuccess({ latitude: -34.1, longitude: 18.8 });  // late GPS upgrade
    expect(h.paints).toHaveLength(2);
    expect(h.paints[1].src).toBe('gps');
    expect(h.persistedHome.src).toBe('gps');   // best-available is now GPS
    expect(h.toasts).toHaveLength(0);          // silent upgrade, no error toast
  });

  it('GPS denied fast (before grace): IP paints fast, toast shown, persists IP', async () => {
    const h = makeHarness();
    h.start();
    h.fireGpsError({ code: 1, message: 'denied' });
    expect(h.toasts).toHaveLength(1);          // user told we are using approximate
    expect(h.graceCancelled).toBe(true);
    await h.resolveIp();
    expect(h.paints).toHaveLength(1);
    expect(h.paints[0].src).toBe('ip');
    expect(h.persistedHome.src).toBe('ip');
  });

  it('both fail: IP fallback (Joburg) still paints — no infinite spinner', async () => {
    const h = makeHarness();
    h.start();
    h.fireGpsError({ code: 2, message: 'unavailable' });
    await h.resolveIp({ name: 'Johannesburg, ZA', lat: -26.2, lon: 28.0, mode: 'gps', src: 'ip-fallback' });
    expect(h.paints).toHaveLength(1);          // something rendered
    expect(h.paints[0].src).toBe('ip-fallback');
  });
});

describe('startFirstOpenLocation — race safety', () => {
  it('late GPS does NOT override a manual pick made after the IP paint', async () => {
    const h = makeHarness();
    h.start();
    h.fireGrace();
    await h.resolveIp();                        // IP paints (activePlace = ip)
    expect(h.paints).toHaveLength(1);

    const durban = { name: 'Durban', lat: -29.85, lon: 31.02, mode: 'pinned', src: 'user' };
    h.userPicks(durban);                        // user searches a city

    h.fireGpsSuccess({ latitude: -34.1, longitude: 18.8 });  // GPS lands late
    // Home is still updated to the best-available GPS fix (a useful side effect,
    // separate from the pinned view), but the VIEW is not hijacked.
    expect(h.persistedHome.src).toBe('gps');
    expect(h.paints).toHaveLength(1);          // no second paint
    expect(h.activePlace).toBe(durban);        // user's choice stands
  });

  it('GPS winning mid-IP-fetch is not downgraded when IP later resolves', async () => {
    const h = makeHarness();
    h.start();
    h.fireGrace();                              // IP fetch starts (still in flight)
    h.fireGpsSuccess({ latitude: -34.1, longitude: 18.8 });  // GPS wins first
    expect(h.paints).toHaveLength(1);
    expect(h.paints[0].src).toBe('gps');

    await h.resolveIp();                        // stale IP result arrives
    expect(h.paints).toHaveLength(1);          // IP must NOT repaint over GPS
    expect(h.activePlace.src).toBe('gps');
    expect(h.persistedHome.src).toBe('gps');
  });

  it('a user pick during "Locating…" (before any paint) is never clobbered', async () => {
    const h = makeHarness();
    h.start();
    const city = { name: 'Polokwane', lat: -23.9, lon: 29.45, mode: 'pinned', src: 'user' };
    h.userPicks(city);                          // user picks before grace/IP/GPS

    h.fireGrace();
    await h.resolveIp();                        // IP must not paint over the pick
    h.fireGpsSuccess({ latitude: -34.1, longitude: 18.8 });  // nor GPS

    expect(h.paints).toHaveLength(0);
    expect(h.activePlace).toBe(city);
  });
});

// ---------------------------------------------------------------------------
// Integration via source-reading — the coordinator must be wired into the
// cold-open branch ONLY, leaving the homePlace / savedLoc / sharedPlace fast
// paths byte-for-byte intact.
// ---------------------------------------------------------------------------
describe('app.js wiring — first-open coordinator', () => {
  const appSrc = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');

  it('imports the coordinator module', () => {
    expect(appSrc).toMatch(/from\s+['"]\.\/first-open-location\.js['"]/);
  });

  it('invokes startFirstOpenLocation from the cold-open branch', () => {
    expect(appSrc).toMatch(/startFirstOpenLocation\(/);
  });

  it('still shows the "Locating…" loader on cold open', () => {
    expect(appSrc).toMatch(/renderLoading\("Locating…"\)/);
  });

  it('leaves the returning-user (homePlace) fast path unchanged', () => {
    expect(appSrc).toMatch(/else if \(homePlace\) \{ showScreen\(screenHome\); loadAndRender\(homePlace\); \}/);
  });

  it('leaves the shared-link pinned path unchanged', () => {
    expect(appSrc).toMatch(/loadAndRender\(\{ \.\.\.sharedPlace, mode: PLACE_MODE_PINNED \}\)/);
  });
});
