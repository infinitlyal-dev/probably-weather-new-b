import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { inlineScriptHashes, buildCsp } from '../scripts/generate-csp.mjs';

// Drift guard for the hash-based CSP in vercel.json. The build does NOT minify the
// inline scripts in index.html / install.html, so hashing the source is equivalent to
// hashing the served bytes. If an inline script changes, regenerate with
//   node scripts/generate-csp.mjs --write
// and commit vercel.json — otherwise this test fails.

const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const catchAll = vercel.headers.find((h) => h.source === '/(.*)');
const cspHeader = catchAll.headers.find((h) => h.key.startsWith('Content-Security-Policy'));

describe('vercel.json Content-Security-Policy', () => {
  it('has a CSP header in the catch-all block', () => {
    expect(cspHeader, 'no CSP header found').toBeTruthy();
  });

  it('ships as Report-Only until the enforce-flip checklist is done (review/CSP-NOTES.md)', () => {
    expect(cspHeader.key).toBe('Content-Security-Policy-Report-Only');
  });

  it('script-src contains every current inline-script hash (LF+CRLF), so it is not stale', () => {
    const hashes = inlineScriptHashes(['index.html', 'install.html']);
    expect(hashes.length).toBe(18); // 7 index + 2 install, each in LF and CRLF
    for (const h of hashes) {
      expect(cspHeader.value.includes(`'${h}'`), `missing single-quoted hash ${h} — run: node scripts/generate-csp.mjs --write`).toBe(true);
    }
  });

  it('emits hash sources single-quoted (regression: bare hashes are parsed as invalid host sources)', () => {
    // No bare `sha256-…` outside single quotes anywhere in the policy.
    expect(/(^|[\s])sha256-/.test(cspHeader.value), 'found an unquoted sha256- source').toBe(false);
    expect(cspHeader.value).toMatch(/'sha256-[A-Za-z0-9+/]+='/);
  });

  it('matches the generator output exactly (directives + hashes in sync)', () => {
    const expected = buildCsp(inlineScriptHashes(['index.html', 'install.html']));
    expect(cspHeader.value).toBe(expected);
  });

  it('locks the security-relevant directives', () => {
    const v = cspHeader.value;
    expect(v).toContain("default-src 'self'");
    expect(v).toContain("object-src 'none'");
    expect(v).toContain("frame-ancestors 'none'");
    expect(v).toContain("base-uri 'self'");
    expect(v).toContain("script-src 'self'");
    // no wildcard or unsafe script execution
    expect(v).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(v).not.toMatch(/script-src[^;]*'unsafe-eval'/);
    expect(v).not.toMatch(/script-src[^;]*\*/);
  });
});
