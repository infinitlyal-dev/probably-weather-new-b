// generate-csp.mjs — compute the hash-based Content-Security-Policy and write it into
// vercel.json as Content-Security-Policy-Report-Only.
//
// Why Report-Only (this session): the policy is verified locally, but three production-only
// surfaces can't be exercised in a local headless harness — the real Vercel Insights beacon,
// the PWA install/Web-Share intents, and the install-page QR (api.qrserver.com, an EXTERNAL
// image the strict "self + Insights" source list intentionally omits). Report-Only bakes the
// telemetry with ZERO risk of breaking the app; flip the header name to
// Content-Security-Policy (enforce) only after a report-clean period on live. See review/CSP-NOTES.md.
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

const REPORT_ONLY = true; // flip to false only after a report-clean period on live

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

export function buildCsp(hashes) {
  // CSP hash-source expressions MUST be single-quoted, e.g. 'sha256-…'. Bare, they
  // parse as (invalid) host sources and Chromium silently ignores them.
  const scriptSrc = ["'self'", ...hashes.map((h) => `'${h}'`)].join(' ');
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'", // inline style="" attributes in index.html can't be hashed
    "img-src 'self' data: blob:", // /assets, /cdn (same-origin), canvas data:, share blob:
    "font-src 'self'",
    "connect-src 'self'", // /api/* + the Vercel Insights beacon are same-origin
    "worker-src 'self'",
    "manifest-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join('; ');
}

// CLI: only runs when executed directly (node scripts/generate-csp.mjs), never on import.
const isMain = process.argv[1] && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);
if (isMain) {
  const WRITE = process.argv.includes('--write');
  const hashes = inlineScriptHashes(['index.html', 'install.html']);
  const csp = buildCsp(hashes);
  const headerKey = REPORT_ONLY ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';

  const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
  const catchAll = vercel.headers.find((h) => h.source === '/(.*)');
  if (!catchAll) { console.error('vercel.json: no /(.*) header block'); process.exit(1); }
  // drop any prior CSP header (either variant), then add the current one
  catchAll.headers = catchAll.headers.filter((h) => h.key !== 'Content-Security-Policy' && h.key !== 'Content-Security-Policy-Report-Only');
  catchAll.headers.push({ key: headerKey, value: csp });

  const next = JSON.stringify(vercel, null, 2) + '\n';
  const current = readFileSync('vercel.json', 'utf8');
  if (WRITE) {
    writeFileSync('vercel.json', next);
    console.log(`wrote vercel.json — ${headerKey} with ${hashes.length} script hashes (LF+CRLF).`);
  } else if (next !== current) {
    console.error(`vercel.json CSP is STALE. Run: node scripts/generate-csp.mjs --write`);
    console.error(`(expected ${hashes.length} script hashes under ${headerKey})`);
    process.exit(1);
  } else {
    console.log(`vercel.json CSP is in sync (${hashes.length} hashes, ${headerKey}).`);
  }
}
