import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  KEEP_REPORT_ONLY,
  REPORT_URI,
  allScriptHashes,
  buildCsp,
  cspHeaders,
  inlineScriptHashes,
} from '../scripts/generate-csp.mjs';
import { SHARE_REDIRECT_SCRIPT } from '../api/_lib/share-redirect.js';

// Drift guard for the hash-based CSP in vercel.json. The build does NOT minify the
// inline scripts in index.html / install.html, so hashing the source is equivalent to
// hashing the served bytes. If an inline script changes, regenerate with
//   node scripts/generate-csp.mjs --write
// and commit vercel.json — otherwise this test fails.
//
// Enforced since 2026-09-15 (prelaunch P2-3), with the identical report-only copy kept
// alongside for its first week (review/CSP-NOTES.md).

const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const catchAll = vercel.headers.find((h) => h.source === '/(.*)');
const enforce = catchAll.headers.find((h) => h.key === 'Content-Security-Policy');
const reportOnly = catchAll.headers.find((h) => h.key === 'Content-Security-Policy-Report-Only');

describe('vercel.json Content-Security-Policy', () => {
  it('enforces the policy in the catch-all block', () => {
    expect(enforce, 'no enforcing Content-Security-Policy header').toBeTruthy();
  });

  it('keeps an identical report-only copy while KEEP_REPORT_ONLY is on, and none after', () => {
    if (KEEP_REPORT_ONLY) expect(reportOnly?.value).toBe(enforce.value);
    else expect(reportOnly).toBeUndefined();
  });

  it('script-src contains every inline-script hash: index + install (LF+CRLF) and the /share redirect', () => {
    expect(inlineScriptHashes(['index.html', 'install.html']).length).toBe(18); // 7 index + 2 install, each LF and CRLF
    const share = 'sha256-' + createHash('sha256').update(SHARE_REDIRECT_SCRIPT, 'utf8').digest('base64');
    const hashes = allScriptHashes();
    expect(hashes).toContain(share);
    for (const h of hashes) {
      expect(enforce.value.includes(`'${h}'`), `missing single-quoted hash ${h} — run: node scripts/generate-csp.mjs --write`).toBe(true);
    }
  });

  it('emits hash sources single-quoted (regression: bare hashes are parsed as invalid host sources)', () => {
    expect(/(^|[\s])sha256-/.test(enforce.value), 'found an unquoted sha256- source').toBe(false);
    expect(enforce.value).toMatch(/'sha256-[A-Za-z0-9+/]+='/);
  });

  it('matches the generator output exactly (directives, hashes and both headers in sync)', () => {
    const actual = catchAll.headers.filter((h) => h.key.startsWith('Content-Security-Policy'));
    expect(actual).toEqual(cspHeaders(buildCsp(allScriptHashes())));
  });

  it('locks the security-relevant directives', () => {
    const v = enforce.value;
    expect(v).toContain("default-src 'self'");
    expect(v).toContain("object-src 'none'");
    expect(v).toContain("frame-ancestors 'none'");
    expect(v).toContain("base-uri 'self'");
    expect(v).toContain("script-src 'self'");
    expect(v).toContain("connect-src 'self'");
    expect(v).toContain(`report-uri ${REPORT_URI}`);
    // no wildcard or unsafe script execution
    expect(v).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(v).not.toMatch(/script-src[^;]*'unsafe-eval'/);
    expect(v).not.toMatch(/script-src[^;]*\*/);
    // exactly one external origin anywhere in the policy — the install QR image
    expect(v.match(/https?:\/\/[^\s;']+/g)).toEqual(['https://api.qrserver.com']);
    expect(v).toMatch(/img-src 'self' data: blob: https:\/\/api\.qrserver\.com;/);
  });

  it('the one external image is really used by /install and disclosed in the privacy policy', () => {
    const install = readFileSync(new URL('../assets/install.js', import.meta.url), 'utf8');
    const privacy = readFileSync(new URL('../privacy.html', import.meta.url), 'utf8');
    expect(install).toContain('https://api.qrserver.com/v1/create-qr-code/');
    expect(privacy).toContain('api.qrserver.com');
  });
});
