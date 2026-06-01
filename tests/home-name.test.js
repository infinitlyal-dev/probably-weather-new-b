// GPS-home name persistence (fix: returning-user open showed raw coords).
//
// Bug: the weather endpoint's location.name ("Strand, Western Cape") resolves
// cleanly but was DISPLAY-ONLY — renderHome never wrote it to STORAGE.home. The
// stored homePlace.name came from buildLocationName paths that coords-fall-back
// ("34.1°S, 18.8°E") when /api/weather?reverse=1 returns ok:false, and the only
// self-heal (renderHome's reverseGeocode block) fires only for placeholder
// names — a coords string is not a placeholder, so it stuck forever. Returning
// users then saw coords until they tapped "use my location".
//
// Fix: persist norm.locationName onto the GPS home when it's a real name and the
// active place IS that home. Guarded so a coords-shaped server name is NEVER
// re-seeded, and a pinned search / shared-link place is never clobbered.

import { describe, expect, it } from 'vitest';
import { isCoordsName, isPlaceholderName, shouldPersistHomeName } from '../assets/home-name.js';

const HOME = { name: 'My Location', lat: -34.1163, lon: 18.8362 };
const COORDS_STUCK = { name: '34.1°S, 18.8°E', lat: -34.1163, lon: 18.8362 };
const ACTIVE_HOME = { lat: -34.1163, lon: 18.8362 };

describe('isCoordsName — matches exactly the buildLocationName coords shape', () => {
  it('matches "X°S, Y°E" coordinate strings', () => {
    expect(isCoordsName('34.1°S, 18.8°E')).toBe(true);
    expect(isCoordsName('26.2°S, 28.0°E')).toBe(true);
    expect(isCoordsName('1.5°N, 103.8°W')).toBe(true);
  });
  it('does NOT match real place names or empties', () => {
    expect(isCoordsName('Strand, Western Cape')).toBe(false);
    expect(isCoordsName('Cape Town')).toBe(false);
    expect(isCoordsName('George')).toBe(false);
    expect(isCoordsName('')).toBe(false);
    expect(isCoordsName(null)).toBe(false);
  });
});

describe('shouldPersistHomeName', () => {
  it('(1) heals a coords-stuck home with the good weather name', () => {
    expect(shouldPersistHomeName({
      locationName: 'Strand, Western Cape', homePlace: COORDS_STUCK, activePlace: ACTIVE_HOME,
    })).toBe(true);
  });
  it('(1b) heals a placeholder "My Location" home too', () => {
    expect(shouldPersistHomeName({
      locationName: 'Strand, Western Cape', homePlace: HOME, activePlace: ACTIVE_HOME,
    })).toBe(true);
  });
  it('(2) does NOT persist a coords-shaped weather name (never re-seed the bug)', () => {
    expect(shouldPersistHomeName({
      locationName: '34.1°S, 18.8°E', homePlace: HOME, activePlace: ACTIVE_HOME,
    })).toBe(false);
  });
  it('(2b) does NOT persist a placeholder/empty weather name', () => {
    expect(shouldPersistHomeName({ locationName: 'My Location', homePlace: HOME, activePlace: ACTIVE_HOME })).toBe(false);
    expect(shouldPersistHomeName({ locationName: 'Unknown location', homePlace: HOME, activePlace: ACTIVE_HOME })).toBe(false);
    expect(shouldPersistHomeName({ locationName: '', homePlace: HOME, activePlace: ACTIVE_HOME })).toBe(false);
    expect(shouldPersistHomeName({ locationName: null, homePlace: HOME, activePlace: ACTIVE_HOME })).toBe(false);
  });
  it('(3) never clobbers a pinned search result (active place ≠ home coords)', () => {
    const durbanSearch = { lat: -29.85, lon: 31.02 };
    expect(shouldPersistHomeName({
      locationName: 'Durban', homePlace: COORDS_STUCK, activePlace: durbanSearch,
    })).toBe(false);
  });
  it('(3b) never clobbers a shared-link place (different coords)', () => {
    const sharedPlace = { lat: -33.92, lon: 18.42, shared: true };
    expect(shouldPersistHomeName({
      locationName: 'Cape Town', homePlace: COORDS_STUCK, activePlace: sharedPlace,
    })).toBe(false);
  });
  it('no-ops when the stored name already equals the good name', () => {
    expect(shouldPersistHomeName({
      locationName: 'Strand, Western Cape',
      homePlace: { name: 'Strand, Western Cape', lat: -34.1163, lon: 18.8362 },
      activePlace: ACTIVE_HOME,
    })).toBe(false);
  });
  it('no-ops with missing homePlace or activePlace', () => {
    expect(shouldPersistHomeName({ locationName: 'Strand', homePlace: null, activePlace: ACTIVE_HOME })).toBe(false);
    expect(shouldPersistHomeName({ locationName: 'Strand', homePlace: HOME, activePlace: null })).toBe(false);
  });
});

describe('isPlaceholderName (module copy mirrors app.js semantics)', () => {
  it('flags empty / unknown / my location', () => {
    expect(isPlaceholderName('')).toBe(true);
    expect(isPlaceholderName('Unknown location')).toBe(true);
    expect(isPlaceholderName('My Location')).toBe(true);
    expect(isPlaceholderName('Strand')).toBe(false);
  });
});

// app.js wiring — renderHome must call the predicate and persist to STORAGE.home.
import { readFileSync } from 'node:fs';
describe('app.js wiring — renderHome persists the resolved GPS-home name', () => {
  const appSrc = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
  it('imports shouldPersistHomeName', () => {
    expect(appSrc).toMatch(/shouldPersistHomeName/);
  });
  it('persists norm.locationName to STORAGE.home behind the predicate', () => {
    expect(appSrc).toMatch(/shouldPersistHomeName\(\{[\s\S]*?locationName:\s*norm\.locationName/);
    expect(appSrc).toMatch(/homePlace\.name\s*=\s*norm\.locationName[\s\S]*?saveJSON\(STORAGE\.home/);
  });
});
