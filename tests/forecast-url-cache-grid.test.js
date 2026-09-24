// Launch run (2026-09-25): the app asks for the forecast on the server's cache
// grid, so a crowd in one ~2.2 km cell sends ONE URL and Vercel's edge serves
// them all from one copy. The client's snap must produce exactly the server's
// cache-key string, or the edge and the Redis cache would disagree about cells.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { snapCoord, SNAP_DEGREES, weatherCacheKey } from '../api/_lib/weather-cache.js';

const js = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
const start = js.indexOf('const snapToCacheGrid = (v) => {');
const source = js.slice(start, js.indexOf('\n  };', start) + 5);
const snapToCacheGrid = new Function(`${source}; return snapToCacheGrid;`)();

describe('forecast URL on the cache grid', () => {
  it('uses the server grid size', () => {
    expect(start).toBeGreaterThan(-1);
    expect(source).toContain(`n / ${SNAP_DEGREES})`);
    expect(source).toContain(`* ${SNAP_DEGREES} + 0).toFixed(2)`);
  });

  it('matches the server cache key for every coordinate', () => {
    const values = [0, -0.01, 0.01, -0.0100001, 0.03, -34.1163, 18.8362, -26.2041, 28.0473, -29.8587, 31.0218, -33.9249, 18.4241, 89.99, -89.99, 179.99, -179.99];
    for (let i = 0; i < 20000; i++) values.push((Math.random() - 0.5) * 180, (Math.random() - 0.5) * 360);
    for (const v of values) expect(snapToCacheGrid(v), String(v)).toBe(snapCoord(v));
    // Coordinates arrive as strings from the geocoder; same answer.
    expect(snapToCacheGrid('-29.8587')).toBe(snapCoord(-29.8587));
  });

  it('a missing coordinate is sent as before, so the server still refuses it', () => {
    // Number(null) and Number('') are 0 — snapping them would forecast 0°N 0°E without an error.
    expect(snapToCacheGrid(null)).toBe('null');
    expect(snapToCacheGrid(undefined)).toBe('undefined');
    expect(snapToCacheGrid('')).toBe('');
    expect(snapToCacheGrid('abc')).toBe('abc');
    expect(snapToCacheGrid(NaN)).toBe('NaN');
  });

  it('the server re-snapping the snapped URL lands in the same cell (idempotent, same Redis key)', () => {
    const values = [34.11, -34.11, 34.13, 0.29, 0.31, -0.01, 18.8362, -26.2041];
    for (let i = 0; i < 20000; i++) values.push((Math.random() - 0.5) * 180);
    for (const v of values) {
      const sent = snapToCacheGrid(v);
      expect(snapCoord(Number(sent)), String(v)).toBe(sent);
      expect(weatherCacheKey(Number(sent), Number(sent)), String(v)).toBe(weatherCacheKey(v, v));
    }
  });

  it('two phones in the same cell ask for the same URL', () => {
    expect(snapToCacheGrid(-34.1163)).toBe(snapToCacheGrid(-34.1151));
    expect(snapToCacheGrid(18.8362)).toBe(snapToCacheGrid(18.8391));
    expect(snapToCacheGrid(-34.1163)).toBe('-34.12');
  });

  it('fetchProbable builds its URL from the snapped coordinates', () => {
    const at = js.indexOf('async function fetchProbable(');
    const body = js.slice(at, js.indexOf('\n', js.indexOf('const url =', at)));
    expect(body).toContain('lat=${snapToCacheGrid(place.lat)}&lon=${snapToCacheGrid(place.lon)}');
  });
});
