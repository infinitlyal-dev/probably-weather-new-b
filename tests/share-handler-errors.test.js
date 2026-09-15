// /share's redirect under the enforcing Content-Security-Policy (2026-09-15).
//
// The page used to carry `window.location.replace(<JSON of the app URL>)` — a
// different inline script on every request, which no CSP hash can allow; the
// live report-only policy flagged it on every share open. It is now ONE
// constant script (api/_lib/share-redirect.js) that reads its destination from
// the meta refresh the server already escaped, and scripts/generate-csp.mjs
// puts that constant's sha256 in script-src. The old JSON.stringify failure
// path (Phase 2 Codex S2: ShareSerializationError → 400) went with the
// per-request script — nothing request-derived is serialised into a script now.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import handler, { buildShareMetaHtml } from '../api/share.js';
import { SHARE_REDIRECT_SCRIPT } from '../api/_lib/share-redirect.js';
import { SHARE_ORIGIN } from '../assets/share-url.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const inlineScripts = (html) => [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

// Runs the page's script against the page's own meta refresh, as a browser
// would: the attribute value is HTML-decoded before the script reads it.
function redirectTarget(html) {
  const meta = /<meta http-equiv="refresh" content="([^"]*)"\/>/.exec(html);
  const content = meta[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  let replacedWith = null;
  const document = { querySelector: (sel) => (sel === 'meta[http-equiv="refresh"]' ? { content } : null) };
  const location = { replace: (url) => { replacedWith = url; } };
  new Function('document', 'location', inlineScripts(html)[0])(document, location);
  return replacedWith;
}

describe('/share redirect is CSP-hashable', () => {
  it('carries exactly one inline script, byte-identical to the shared constant, whatever the request', async () => {
    for (const query of [{ lang: 'en' }, { lang: 'af' }, { lang: 'zz' }]) {
      expect(inlineScripts(await buildShareMetaHtml(query))).toEqual([SHARE_REDIRECT_SCRIPT]);
    }
  });

  it('replaces the location (no history entry) with the app URL the meta refresh carries', async () => {
    const html = await buildShareMetaHtml({ lang: 'af' });
    expect(redirectTarget(html)).toBe(`${SHARE_ORIGIN}/?lang=af`);
  });

  it('decodes the escaped ampersands of a coordinate link before redirecting', async () => {
    // Valid coords make the page look up the weather for its description; a
    // failed lookup falls back to the static description, which is all we need.
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline in test'); }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const html = await buildShareMetaHtml({ lat: '-33.92', lon: '18.42', lang: 'zu' });
    expect(html).toContain(`url=${SHARE_ORIGIN}/?lat=-33.92&amp;lon=18.42&amp;lang=zu`);
    expect(redirectTarget(html)).toBe(`${SHARE_ORIGIN}/?lat=-33.92&lon=18.42&lang=zu`);
    // Nothing request-derived is inside a script.
    expect(inlineScripts(html).join('')).not.toMatch(/33\.92|18\.42|zu/);
  });

  it("the script's sha256 is in the enforcing script-src", () => {
    const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
    const csp = vercel.headers.find((h) => h.source === '/(.*)').headers.find((h) => h.key === 'Content-Security-Policy');
    const hash = `'sha256-${createHash('sha256').update(SHARE_REDIRECT_SCRIPT, 'utf8').digest('base64')}'`;
    expect(csp.value).toContain(hash);
  });

  it('handler returns 200 HTML with the meta refresh and the constant script', async () => {
    let statusCode = null;
    const headers = {};
    let body = null;
    const res = {
      status(code) { statusCode = code; return this; },
      setHeader(key, value) { headers[key] = value; },
      end(payload) { body = payload; return this; },
    };

    await handler({ query: { lang: 'en' } }, res);

    expect(statusCode).toBe(200);
    expect(headers['Content-Type']).toBe('text/html; charset=utf-8');
    expect(String(body)).toContain('<!doctype html>');
    expect(String(body)).toContain('<meta http-equiv="refresh" content="0; url=');
    expect(String(body)).toContain(`<script>${SHARE_REDIRECT_SCRIPT}</script>`);
  });
});
