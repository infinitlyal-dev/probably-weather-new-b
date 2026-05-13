// Phase 2 Codex S2 — defensive try/catch around the inline-script
// JSON.stringify in api/share.js. ShareSerializationError maps to a
// controlled 400 in the handler rather than a 500 crash. Test exercises
// the failure path via vi.spyOn on JSON.stringify.

import { describe, expect, it, vi, afterEach } from 'vitest';
import handler, { ShareSerializationError, buildShareMetaHtml } from '../api/share.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('share handler — JSON.stringify failure path (S2)', () => {
  it('exports ShareSerializationError as a named class', () => {
    expect(ShareSerializationError.prototype).toBeInstanceOf(Error);
    const err = new ShareSerializationError('boom');
    expect(err.name).toBe('ShareSerializationError');
    expect(err.message).toBe('boom');
  });

  it('buildShareMetaHtml wraps inline-script stringify and throws ShareSerializationError when stringify fails', async () => {
    // Spy on JSON.stringify to force the failure path. Real inputs (a plain
    // URL string) can't trigger this; the catch is defensive against future
    // changes that might pass non-string values.
    // Narrow the spy: only throw when called on the inline-script appUrl
    // value. JSON.stringify is also used internally by Node's undici when
    // the share handler invokes the weather handler — a broad mock would
    // crash unrelated fetch internals.
    const realStringify = JSON.stringify;
    vi.spyOn(JSON, 'stringify').mockImplementation((value, ...rest) => {
      if (typeof value === 'string' && value.includes('probablyweather')) {
        throw new TypeError('Converting circular structure to JSON');
      }
      return realStringify.call(JSON, value, ...rest);
    });

    await expect(buildShareMetaHtml({ lang: 'en' }))
      .rejects.toBeInstanceOf(ShareSerializationError);
  });

  it('handler returns a controlled 400 (not a 500) when ShareSerializationError bubbles up', async () => {
    const realStringify = JSON.stringify;
    vi.spyOn(JSON, 'stringify').mockImplementation((value, ...rest) => {
      if (typeof value === 'string' && value.includes('probablyweather')) {
        throw new TypeError('boom from test');
      }
      return realStringify.call(JSON, value, ...rest);
    });

    let statusCode = null;
    let headers = {};
    let body = null;
    const res = {
      status(code) { statusCode = code; return this; },
      setHeader(key, value) { headers[key] = value; },
      end(payload) { body = payload; return this; },
    };

    // Skip lat/lon so the handler doesn't invoke the weather fetch path —
    // keeps the test hermetic.
    await handler({ query: { lang: 'en' } }, res);

    expect(statusCode).toBe(400);
    expect(headers['Content-Type']).toBe('text/plain; charset=utf-8');
    expect(String(body)).toContain('Share preview unavailable');
    expect(String(body)).toContain('boom from test');
  });

  it('happy path still returns 200 with HTML body', async () => {
    let statusCode = null;
    let body = null;
    const res = {
      status(code) { statusCode = code; return this; },
      setHeader() {},
      end(payload) { body = payload; return this; },
    };

    await handler({ query: { lang: 'en' } }, res);

    expect(statusCode).toBe(200);
    expect(String(body)).toContain('<!doctype html>');
    expect(String(body)).toContain('<script>window.location.replace(');
  });
});
