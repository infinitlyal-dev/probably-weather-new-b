// Launch run (2026-09-25, F2b): an edge copy of a forecast must not outlive the
// local day it was made for. After midnight Vercel's CDN would otherwise replay
// yesterday's hours (hourly[0] = yesterday 00:00) without the function running.

import { describe, expect, it } from 'vitest';
import { edgeCacheControl } from '../api/weather.js';

const SAST = 7200;
const at = (hhmmss) => Date.parse(`2026-09-25T${hhmmss}+02:00`);
const parse = (h) => { const m = /^s-maxage=(\d+), stale-while-revalidate=(\d+)$/.exec(h); return m ? { s: Number(m[1]), w: Number(m[2]) } : null; };
const secondsToMidnight = (ms) => (Date.parse('2026-09-26T00:00:00+02:00') - ms) / 1000;

describe('edgeCacheControl — the edge copy ends at local midnight', () => {
  it('is the usual header through the day', () => {
    expect(edgeCacheControl(SAST, at('12:00:00'))).toBe('s-maxage=300, stale-while-revalidate=60');
    expect(edgeCacheControl(SAST, at('23:53:00'))).toBe('s-maxage=300, stale-while-revalidate=60');
    expect(edgeCacheControl(SAST, at('12:00:00'), 30, 60)).toBe('s-maxage=30, stale-while-revalidate=60');
  });

  it('is trimmed in the last minutes so cache + stale never reach midnight', () => {
    for (const t of ['23:54:30', '23:56:00', '23:57:30', '23:58:59', '23:59:20']) {
      const h = parse(edgeCacheControl(SAST, at(t)));
      expect(h, t).not.toBeNull();
      expect(h.s + h.w, t).toBeLessThan(secondsToMidnight(at(t)));
      expect(h.s, t).toBeGreaterThan(0);
    }
  });

  it('caches nothing in the last half minute', () => {
    expect(edgeCacheControl(SAST, at('23:59:40'))).toBe('no-store');
    expect(edgeCacheControl(SAST, at('23:59:59'))).toBe('no-store');
  });

  it('uses the payload offset, not the server clock zone', () => {
    // 23:58 in Cape Town is 21:58 UTC; for a place at UTC+0 that is not near its midnight.
    expect(edgeCacheControl(0, at('23:58:00'))).toBe('s-maxage=300, stale-while-revalidate=60');
  });

  it('falls back to the plain header without an offset', () => {
    expect(edgeCacheControl(null, at('23:59:50'))).toBe('s-maxage=300, stale-while-revalidate=60');
    expect(edgeCacheControl(undefined, at('23:59:50'), 30, 60)).toBe('s-maxage=30, stale-while-revalidate=60');
  });
});
