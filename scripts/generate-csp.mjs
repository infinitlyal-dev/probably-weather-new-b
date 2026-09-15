// generate-csp.mjs — compute the hash-based Content-Security-Policy and write it into
// vercel.json.
//
// ENFORCED since 2026-09-15 (prelaunch P2-3). The flip followed a live measurement:
// every page and route was opened in Chromium under the report-only policy — home at
// 390px and 1440px through Hourly, Weekly, Search, Settings and Sources; /install at both
// widths; /privacy; /share in two languages; /api/og. The ONE violation was /share's
// per-request inline redirect, which is now a constant script (api/_lib/share-redirect.js)
// hashed below. The one external resource production needs is the /install page's QR
// image (assets/install.js → api.qrserver.com, disclosed in privacy.html), allowed by name.
//
// REPORT-ONLY COPY: the identical policy also ships as Content-Security-Policy-Report-Only
// for its first week, until REPORT_ONLY_UNTIL. Both carry report-uri → /api/csp-report,
// which logs [pw-csp] lines. After that date: KEEP_REPORT_ONLY = false, then --write.
// See review/CSP-NOTES.md.
//
// Hashes: the build does NOT minify index.html/install.html inline scripts, so hashing the
// source is equivalent to hashing the served bytes. Both LF and CRLF variants are emitted so
// the policy is correct whether the artifact is served with Windows or Linux line endings
// (local dev is CRLF; the Vercel Linux build is LF).
//
// Usage: node scripts/generate-csp.mjs           (check — fails if vercel.json is stale)
//        node scripts/generate-csp.mjs --write    (patch vercel.json)

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import { SHARE_REDIRECT_SCRIPT } from '../api/_lib/share-redirect.js';

export const KEEP_REPORT_ONLY = true;
export const REPORT_ONLY_UNTIL = '2026-09-22';
export const REPORT_URI = '/api/csp-report';

const hashOf = (text) => 'sha256-' + createHash('sha256').update(text, 'utf8').digest('base64');

export function inlineScriptHashes(htmlFiles) {
  const set = new Set();
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  for (const f of htmlFiles) {
    const raw = readFileSync(f, 'utf8');
    const lf = raw.replace(/\r\n/g, '\n');
    const crlf = lf.replace(/\n/g, '\r\n');
    for (const src of [lf, crlf]) {
      let m;
      const r = new RegExp(re.source, 'g');
      while ((m = r.exec(src)) !== null) set.add('sha256-' + createHash('sha256').update(m[1], 'utf8').digest('base64'));
    }
  }
  return [...set];
}

/** Hash sources for inline scripts a function writes rather than an HTML file: /share. */
export function serverScriptHashes() {
  return [hashOf(SHARE_REDIRECT_SCRIPT)];
}

export function allScriptHashes() {
  return [...new Set([...inlineScriptHashes(['index.html', 'install.html']), ...serverScriptHashes()])];
}

export function buildCsp(hashes) {
  // CSP hash-source expressions MUST be single-quoted, e.g. 'sha256-…'. Bare, they
  // parse as (invalid) host sources and Chromium silently ignores them.
  const scriptSrc = ["'self'", ...hashes.map((h) => `'${h}'`)].join(' ');
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'", // inline style="" attributes in index.html can't be hashed
    // /assets, /cdn (same-origin), canvas data:, share blob:, and the /install page's QR code.
    "img-src 'self' data: blob: https://api.qrserver.com",
    "font-src 'self' data:", // Onest/Caveat woff2 are embedded as data: URIs
    "connect-src 'self'", // /api/* + the Vercel Insights beacon are same-origin
    "worker-src 'self'",
    "manifest-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `report-uri ${REPORT_URI}`,
  ].join('; ');
}

// ADS-READINESS DRAFT (branch ads-readiness; never written to vercel.json): the policy AdSense
// would need. Google supports only a strict CSP for its ad code — script-src on a nonce with
// 'strict-dynamic' and 'unsafe-eval', plus 'unsafe-inline' https: http: as the fallback older
// browsers read — because the hosts the ad code loads from change without notice
// (support.google.com/adsense/answer/16283098). This site is static HTML, so the trust root here
// is the hashes of our inline scripts rather than a per-request nonce, which would need middleware
// rewriting every HTML response; Google documents the nonce form, so the hash form must prove
// itself under Report-Only first. Under 'strict-dynamic' a CSP3 browser ignores 'self' and host
// allowlists in script-src: every parser-inserted <script src> (app.js, the Vercel Insights
// script, install.html's modules) must be loaded by a hashed inline script instead, or it is
// blocked. Both steps come before any enforcement — docs/ads-readiness.md.
// Print it: node scripts/generate-csp.mjs --ads
export function buildAdsCsp(hashes) {
  const scriptSrc = [...hashes.map((h) => `'${h}'`), "'strict-dynamic'", "'unsafe-eval'", "'unsafe-inline'", 'https:', 'http:'].join(' ');
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:", // creatives and measurement pixels come from hosts Google does not list
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "frame-src https:", // ad iframes
    "worker-src 'self'",
    "manifest-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `report-uri ${REPORT_URI}`,
  ].join('; ');
}

/** The header entries for the catch-all block: enforcing, plus the week-one report-only copy. */
export function cspHeaders(csp) {
  const headers = [{ key: 'Content-Security-Policy', value: csp }];
  if (KEEP_REPORT_ONLY) headers.push({ key: 'Content-Security-Policy-Report-Only', value: csp });
  return headers;
}

// CLI: only runs when executed directly (node scripts/generate-csp.mjs), never on import.
const isMain = process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);
if (isMain && process.argv.includes('--ads')) {
  console.log(buildAdsCsp(allScriptHashes()));
} else if (isMain) {
  const WRITE = process.argv.includes('--write');
  const hashes = allScriptHashes();
  const csp = buildCsp(hashes);

  const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
  const catchAll = vercel.headers.find((h) => h.source === '/(.*)');
  if (!catchAll) { console.error('vercel.json: no /(.*) header block'); process.exit(1); }
  // drop any prior CSP header (either variant), then add the current ones
  catchAll.headers = catchAll.headers.filter((h) => h.key !== 'Content-Security-Policy' && h.key !== 'Content-Security-Policy-Report-Only');
  catchAll.headers.push(...cspHeaders(csp));

  const next = JSON.stringify(vercel, null, 2) + '\n';
  const current = readFileSync('vercel.json', 'utf8');
  const label = KEEP_REPORT_ONLY ? `Content-Security-Policy + Report-Only copy until ${REPORT_ONLY_UNTIL}` : 'Content-Security-Policy';
  if (WRITE) {
    writeFileSync('vercel.json', next);
    console.log(`wrote vercel.json — ${label} with ${hashes.length} script hashes.`);
  } else if (next !== current) {
    console.error(`vercel.json CSP is STALE. Run: node scripts/generate-csp.mjs --write`);
    console.error(`(expected ${hashes.length} script hashes, ${label})`);
    process.exit(1);
  } else {
    console.log(`vercel.json CSP is in sync (${hashes.length} hashes, ${label}).`);
  }
}
