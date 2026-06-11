// Production build → dist/ (Group 6).
//
// Probably Weather stays a no-framework ES-module site; this build does NOT
// bundle. It copies the served file tree into dist/ and minifies JS + CSS
// in place there (esbuild, per-file, format=esm — import specifiers are left
// untouched, so every path sw.js precaches and every dynamic import keeps
// resolving byte-for-byte at the same URL).
//
// The SOURCE tree remains fully servable without any build (tests, vercel
// dev, the python static preview). Vercel runs this via buildCommand and
// serves dist/ (outputDirectory in vercel.json); api/** stays serverless
// functions resolved from the repo root, independent of the static output.
//
// Regenerates assets/copy/<lang>.js first so a stale checked-in split can
// never ship even if someone forgot to re-run the generator (the drift test
// also fails the suite in that case).

import { cpSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import esbuild from 'esbuild';

import { LANGS, buildModuleSource } from './generate-copy-splits.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = path.join(root, 'dist');

// What the live site serves (mirror of the .vercelignore SAFE-TO-EXCLUDE
// inventory). Anything not listed here does not ship.
const STATIC_ENTRIES = [
  'index.html',
  'install.html',
  'privacy.html',
  'manifest.json',
  'sw.js',
  'assets',
  'og',
  '.well-known',
];

// M-iii: VERIFY the committed per-language banks match a fresh regeneration —
// fail the build if a copy edit to assets/weather-copy.js skipped the
// generator. The old behaviour regenerated into the source tree, which made
// prod silently self-heal while the committed banks / drift test / local
// preview diverged. Now drift is a hard build error with a one-line fix.
console.log('[build] verifying per-language copy splits are in sync…');
{
  const stale = [];
  for (const lang of LANGS) {
    const file = path.join(root, 'assets', 'copy', `${lang}.js`);
    let onDisk = null;
    try { onDisk = readFileSync(file, 'utf8'); } catch { /* missing → stale */ }
    if (onDisk !== buildModuleSource(lang)) stale.push(`${lang}.js`);
  }
  if (stale.length) {
    console.error(
      `[build] FATAL: per-language copy banks are stale (${stale.join(', ')}).\n` +
      `        assets/weather-copy.js changed without regenerating the splits.\n` +
      `        Run: npm run copy:generate   then commit assets/copy/*.js`
    );
    process.exit(1);
  }
}

console.log('[build] cleaning dist/…');
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

console.log('[build] copying static tree…');
for (const entry of STATIC_ENTRIES) {
  const from = path.join(root, entry);
  cpSync(from, path.join(dist, entry), { recursive: true });
}

// The five-language monolith is server-side only since the Group 6 split
// (api/* imports it from source; no client path fetches it) — keep it out
// of the served output.
rmSync(path.join(dist, 'assets', 'weather-copy.js'), { force: true });

// Collect every .js/.css under dist (assets + sw.js) for in-place minification.
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

// L-ii: weather-copy.js is now server-only and deleted from dist above. If ANY
// client module still imports it, that import 404s at runtime (it minifies and
// ships fine — the missing file only surfaces in the browser). Guard it at
// build time: scan the served JS for an import of weather-copy.js and fail.
const clientJs = walk(path.join(dist, 'assets')).filter((f) => /\.js$/i.test(f));
const offenders = clientJs.filter((f) => /from\s*['"][^'"]*weather-copy\.js['"]|import\(\s*['"][^'"]*weather-copy\.js['"]/.test(readFileSync(f, 'utf8')));
if (offenders.length) {
  console.error(
    '[build] FATAL: client module(s) import the server-only weather-copy.js ' +
    '(deleted from dist — would 404 at runtime):',
    offenders.map((f) => path.relative(dist, f)),
  );
  process.exit(1);
}

const files = walk(dist).filter((f) => /\.(js|css)$/i.test(f));
let before = 0;
let after = 0;

console.log(`[build] minifying ${files.length} JS/CSS files…`);
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  before += Buffer.byteLength(source);
  const isCss = file.endsWith('.css');
  const { code } = esbuild.transformSync(source, {
    loader: isCss ? 'css' : 'js',
    format: isCss ? undefined : 'esm',
    minify: true,
    // Modern PWA targets — matches what the unminified source already
    // requires (optional chaining, ?? , dynamic import, AbortSignal.timeout).
    target: ['es2021'],
  });
  writeFileSync(file, code, 'utf8');
  after += Buffer.byteLength(code);
}

// Build-time invariant: EVERY precached path must resolve in dist — a missing
// one bricks the offline shell on deploy.
//
// L-i: extensionless precache entries (Vercel rewrites like '/' and '/install')
// used to be silently dropped by an extension filter, so the gate's "every
// precache path verified" claim was overstated — a future extensionless entry
// with no served file would slip through. Now the gate parses the CORE_ASSETS
// array directly and resolves EVERY entry: a file with an extension is statted
// as-is; a known rewrite is statted via its target; an UNKNOWN extensionless
// path is a hard failure (it can't be verified, so it must not pass silently).
// Read the precache LIST from the SOURCE sw.js (the dist copy is minified, so
// the CORE_ASSETS array structure isn't reliably parseable there); verify the
// FILES exist in dist.
const swSrc = readFileSync(path.join(root, 'sw.js'), 'utf8');

// Vercel rewrites (see vercel.json): the precached URL → the dist file served.
const REWRITE_TARGETS = {
  '/': 'index.html',
  '/install': 'install.html',
};

const coreBlock = swSrc.match(/CORE_ASSETS\s*=\s*\[([\s\S]*?)\]/);
if (!coreBlock) {
  console.error('[build] FATAL: could not locate CORE_ASSETS in sw.js');
  process.exit(1);
}
const coreAssets = [...coreBlock[1].matchAll(/['"](\/[^'"]*)['"]/g)].map((m) => m[1]);

const missing = [];
const unverifiable = [];
for (const p of coreAssets) {
  let target = null;
  if (/\.[a-z0-9]+$/i.test(p)) target = p;                 // has an extension
  else if (p in REWRITE_TARGETS) target = '/' + REWRITE_TARGETS[p]; // known rewrite
  else { unverifiable.push(p); continue; }                  // extensionless, unmapped
  try { statSync(path.join(dist, target)); } catch { missing.push(`${p} → ${target}`); }
}
if (unverifiable.length) {
  console.error(
    `[build] FATAL: CORE_ASSETS has extensionless path(s) the gate can't verify: ${unverifiable.join(', ')}.\n` +
    `        Add a REWRITE_TARGETS mapping in scripts/build.mjs (and a vercel.json rewrite).`
  );
  process.exit(1);
}
if (missing.length) {
  console.error('[build] FATAL: sw.js precaches paths missing from dist:', missing);
  process.exit(1);
}

console.log(`[build] done. JS/CSS ${Math.round(before / 1024)} KB → ${Math.round(after / 1024)} KB (${Math.round((1 - after / before) * 100)}% smaller). sw.js asset check: ${coreAssets.length}/${coreAssets.length} precache paths OK (incl. rewrites).`);
