// /api/csp-report — the sink both CSP headers report to (2026-09-15).
// Before it existed the report-only policy reported nowhere, so no violation had
// ever reached a log.

import { afterEach, describe, expect, it, vi } from 'vitest';

import handler from '../api/csp-report.js';

const call = async ({ method = 'POST', body } = {}) => {
  let statusCode = 200;
  let payload;
  const req = { method, body, headers: { 'x-forwarded-for': '203.0.113.9' } };
  const res = {
    status(code) { statusCode = code; return this; },
    json(p) { payload = p; return this; },
    end(p) { payload = p; return this; },
    setHeader() {},
  };
  await handler(req, res);
  return { statusCode, payload };
};

const report = (over = {}) => ({
  'csp-report': {
    'document-uri': 'https://www.probablyweather.co.za/share?lat=-33.9249&lon=18.4241&lang=af&c=rain',
    'effective-directive': 'script-src-elem',
    'blocked-uri': 'inline',
    disposition: 'enforce',
    'source-file': 'https://www.probablyweather.co.za/share?lat=-33.9249&lon=18.4241&lang=af',
    'line-number': 22,
    'script-sample': 'window.location.replace("https://www.probablyweather.co.za/?lat=-33.92',
    ...over,
  },
});

afterEach(() => vi.restoreAllMocks());

describe('/api/csp-report', () => {
  it('refuses anything but POST', async () => {
    expect((await call({ method: 'GET' })).statusCode).toBe(405);
  });

  it('logs an enforced violation at error level, with coordinates and the script sample stripped', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { statusCode } = await call({ body: JSON.stringify(report()) });
    expect(statusCode).toBe(204);
    expect(err).toHaveBeenCalledTimes(1);
    const [tag, line] = err.mock.calls[0];
    expect(tag).toBe('[pw-csp]');
    expect(JSON.parse(line)).toEqual({
      disposition: 'enforce',
      directive: 'script-src-elem',
      blocked: 'inline',
      page: '/share?lang=af&c=rain',
      source: '/share?lang=af',
      line: 22,
    });
    expect(line).not.toMatch(/33\.9|18\.4|replace/);
  });

  it('logs a report-only violation at warn level', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await call({ body: JSON.stringify(report({ disposition: 'report' })) })).statusCode).toBe(204);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(err).not.toHaveBeenCalled();
  });

  it('reads the report as a Buffer, a pre-parsed object, or a Reporting API array', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = report({ disposition: 'report' });
    const bodies = [
      Buffer.from(JSON.stringify(r)),
      r,
      [{ type: 'csp-violation', body: { documentURL: 'https://www.probablyweather.co.za/', effectiveDirective: 'img-src', blockedURL: 'https://tracker.example/pixel.gif?id=123', disposition: 'report' } }],
    ];
    for (const body of bodies) expect((await call({ body })).statusCode).toBe(204);
    expect(warn).toHaveBeenCalledTimes(3);
    // A third-party blocked URL keeps origin + path only.
    expect(JSON.parse(warn.mock.calls[2][1]).blocked).toBe('https://tracker.example/pixel.gif');
  });

  it('drops a report about a page that is not ours, without logging it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { statusCode } = await call({ body: JSON.stringify(report({ 'document-uri': 'https://attacker.example/page' })) });
    expect(statusCode).toBe(204);
    expect(warn).not.toHaveBeenCalled();
    expect(err).not.toHaveBeenCalled();
  });

  it('rejects malformed, oversized and report-less bodies', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await call({ body: '{not json' })).statusCode).toBe(400);
    expect((await call({ body: 'x'.repeat(17 * 1024) })).statusCode).toBe(400);
    expect((await call({ body: JSON.stringify({ nothing: true }) })).statusCode).toBe(400);
  });
});
