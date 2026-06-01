// Per-IP rate limiting — pure logic (api/_lib/rate-limit.js).
//
// The last hardening item: /api/weather, /api/geocode, /api/errors had no
// inbound per-IP limit (errors.js even noted it as the deferred complement to
// origin-gating). These tests pin the two invariants that matter most:
//   · the client IP is read from Vercel's proxy headers (not a placeholder), and
//   · the limiter FAILS OPEN — a rate-limiter outage (Upstash unreachable) or a
//     missing config must NEVER block a real request. The app must not go down
//     because the rate limiter did.
//
// These test the pure decision layer with an injected limiter, so they need no
// real Upstash and don't import @upstash at all.

import { describe, expect, it, vi } from 'vitest';
import { getClientIp, checkRateLimit } from '../api/_lib/rate-limit.js';

const reqWith = (headers) => ({ headers });

describe('getClientIp — real client IP behind Vercel\'s proxy', () => {
  it('PREFERS x-real-ip (Vercel overwrites it; not a forgeable chain)', () => {
    // Even when a client forges a leftmost x-forwarded-for, x-real-ip wins.
    expect(getClientIp(reqWith({ 'x-real-ip': '41.9.9.9', 'x-forwarded-for': '6.6.6.6, 10.0.0.1' }))).toBe('41.9.9.9');
    expect(getClientIp(reqWith({ 'x-real-ip': '41.9.9.9' }))).toBe('41.9.9.9');
  });
  it('falls back to the FIRST x-forwarded-for entry when x-real-ip is absent', () => {
    expect(getClientIp(reqWith({ 'x-forwarded-for': '41.2.3.4, 10.0.0.1, 10.0.0.2' }))).toBe('41.2.3.4');
  });
  it('trims whitespace around the resolved IP', () => {
    expect(getClientIp(reqWith({ 'x-real-ip': '  41.9.9.9  ' }))).toBe('41.9.9.9');
    expect(getClientIp(reqWith({ 'x-forwarded-for': '  41.2.3.4  , 10.0.0.1' }))).toBe('41.2.3.4');
  });
  it('returns a stable default when no IP header is present', () => {
    expect(getClientIp(reqWith({}))).toBe('0.0.0.0');
    expect(getClientIp({})).toBe('0.0.0.0');
  });
});

describe('checkRateLimit', () => {
  const req = reqWith({ 'x-forwarded-for': '41.2.3.4' });

  it('ALLOWS normal use (limiter reports success)', async () => {
    const r = await checkRateLimit(req, { limit: async () => ({ success: true, remaining: 59 }) });
    expect(r.allowed).toBe(true);
  });

  it('BLOCKS abuse (limiter reports not-success → caller sends 429)', async () => {
    const r = await checkRateLimit(req, { limit: async () => ({ success: false, remaining: 0 }) });
    expect(r.allowed).toBe(false);
  });

  it('keys the limiter on the client IP', async () => {
    const spy = vi.fn(async () => ({ success: true }));
    await checkRateLimit(req, { limit: spy });
    expect(spy).toHaveBeenCalledWith('41.2.3.4');
  });

  it('FAILS OPEN when Upstash throws (outage must never block the request)', async () => {
    const r = await checkRateLimit(req, { limit: async () => { throw new Error('upstash unreachable'); } });
    expect(r.allowed).toBe(true);
  });

  it('FAILS OPEN when rate limiting is disabled (null/undefined limiter — e.g. env missing)', async () => {
    expect((await checkRateLimit(req, null)).allowed).toBe(true);
    expect((await checkRateLimit(req, undefined)).allowed).toBe(true);
  });

  it('FAILS OPEN on a malformed limiter response (only an explicit success:false blocks)', async () => {
    expect((await checkRateLimit(req, { limit: async () => ({}) })).allowed).toBe(true);            // no success field
    expect((await checkRateLimit(req, { limit: async () => ({ success: undefined }) })).allowed).toBe(true);
    expect((await checkRateLimit(req, { limit: async () => null })).allowed).toBe(true);            // null result
    expect((await checkRateLimit(req, { limit: async () => ({ success: false }) })).allowed).toBe(false); // explicit over-limit still blocks
  });
});
