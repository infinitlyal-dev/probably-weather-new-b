// Prelaunch item 12 — the release gate.
//
// Two invariants, both broken before this file existed:
//
//   1. THE SUITE MUST GATE THE DEPLOY. vercel.json's buildCommand is
//      `npm run build`, and package.json kept `vitest run` in a SEPARATE
//      `test` script that no deploy path ever invoked (and the repo has no
//      test-running GitHub Actions workflow). A red suite shipped to prod.
//      The suite therefore has to run INSIDE the build script, chained with
//      && so a non-zero vitest exit aborts the build.
//
//   2. THE COPY-DRIFT GATE MUST COMPARE TEXT, NOT LINE ENDINGS. .gitattributes
//      marks the tree `* text=auto` and the index stores assets/copy/<lang>.js
//      with LF, so a Windows checkout with core.autocrlf=true writes them to
//      the working tree as CRLF (`git ls-files --eol` → `i/lf w/crlf`).
//      buildModuleSource() always emits LF, so the byte-exact comparison in
//      scripts/build.mjs reported ALL FIVE banks stale on a clean Windows
//      clone while a Linux clone passed — a false failure loud enough to
//      train people to ignore the gate that catches real drift.
//
// Both halves are asserted here so neither can quietly regress.

import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

import { LANGS, buildModuleSource } from '../scripts/generate-copy-splits.mjs';
import { CLEARED_ENV_NAMES, CLEARED_ENV_PREFIXES } from './setup/clear-runtime-env.js';

const readRoot = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const pkg = JSON.parse(readRoot('package.json'));

// Imported lazily so the package.json assertions below still run (and fail on
// their own merits) when the helper module does not exist yet.
const loadSync = () => import('../scripts/copy-bank-sync.mjs');

describe('the Vercel build runs the test suite', () => {
  it('the build script invokes vitest', () => {
    expect(pkg.scripts.build).toMatch(/\bvitest run\b/);
  });

  it('vitest runs before the image-budget check and the build script', () => {
    const build = pkg.scripts.build;
    const atVitest = build.indexOf('vitest run');
    expect(atVitest).toBeGreaterThanOrEqual(0);
    expect(atVitest).toBeLessThan(build.indexOf('scripts/verify-bg-image-budget.mjs'));
    expect(atVitest).toBeLessThan(build.indexOf('scripts/build.mjs'));
  });

  it('a failing suite aborts the build (&&-chained, never tolerated)', () => {
    const build = pkg.scripts.build;
    // && short-circuits on non-zero exit; `;` or `||` would run the build anyway.
    expect(build).toMatch(/vitest run\s*&&/);
    expect(build).not.toMatch(/\|\|/);
    // --passWithNoTests would turn an empty upload into a silent green gate.
    expect(build).not.toMatch(/--passWithNoTests/);
  });

  it('vercel.json still builds through npm run build', () => {
    expect(JSON.parse(readRoot('vercel.json')).buildCommand).toBe('npm run build');
  });

  it('the deploy uploads tests/, so the gate has something to run', () => {
    // vitest exits 1 with "No test files found" — leaving tests/ excluded from
    // the upload would break every deploy instead of gating it.
    const file = fileURLToPath(new URL('../.vercelignore', import.meta.url));
    if (!existsSync(file)) return; // absent in the build container → nothing to assert
    const patterns = readFileSync(file, 'utf8')
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));
    expect(patterns).not.toContain('tests/');
    expect(patterns).not.toContain('tests');
  });
});

describe('the copy-drift gate ignores CRLF/LF but still catches real drift', () => {
  const generated = buildModuleSource('en');

  it('an unchanged LF bank is in sync', async () => {
    const { isCopyBankInSync } = await loadSync();
    expect(isCopyBankInSync(generated, generated)).toBe(true);
  });

  it('a CRLF-ended on-disk bank is in sync', async () => {
    const { isCopyBankInSync } = await loadSync();
    const crlf = generated.replace(/\n/g, '\r\n');
    // The variant really is a different byte sequence — this is not a no-op.
    expect(crlf).not.toBe(generated);
    expect(crlf).toContain('\r\n');
    expect(isCopyBankInSync(crlf, generated)).toBe(true);
  });

  it('a genuinely changed bank is still flagged stale', async () => {
    const { isCopyBankInSync } = await loadSync();
    expect(isCopyBankInSync(generated.replace('heroLabels', 'heroLabelz'), generated)).toBe(false);
    expect(isCopyBankInSync(`${generated}export const EXTRA = 1;\n`, generated)).toBe(false);
    // Drift hidden inside a CRLF file is caught too — normalisation is not a bypass.
    expect(isCopyBankInSync(generated.replace(/\n/g, '\r\n').replace('heroLabels', 'heroLabelz'), generated))
      .toBe(false);
  });

  it('a missing bank is stale', async () => {
    const { isCopyBankInSync } = await loadSync();
    expect(isCopyBankInSync(null, generated)).toBe(false);
    expect(isCopyBankInSync(undefined, generated)).toBe(false);
  });

  it('normalizeEol collapses CRLF and leaves everything else alone', async () => {
    const { normalizeEol } = await loadSync();
    expect(normalizeEol('a\r\nb\r\n')).toBe('a\nb\n');
    expect(normalizeEol('a\nb\n')).toBe('a\nb\n');
    expect(normalizeEol('no newlines')).toBe('no newlines');
  });

  it('every checked-in bank passes the gate exactly as it sits in the working tree', async () => {
    const { isCopyBankInSync } = await loadSync();
    for (const lang of LANGS) {
      const onDisk = readFileSync(new URL(`../assets/copy/${lang}.js`, import.meta.url), 'utf8');
      expect(isCopyBankInSync(onDisk, buildModuleSource(lang)), `${lang}.js`).toBe(true);
    }
  });
});

// The helper tests above pass even if scripts/build.mjs stops calling it, so
// pin the build to the shared gate and exercise the real gate function.
describe('the build runs the shared gate, not its own inline compare', () => {
  const buildSrc = readRoot('scripts/build.mjs');

  it('scripts/build.mjs calls findStaleCopyBanks', () => {
    expect(buildSrc).toMatch(/findStaleCopyBanks\s*\(/);
    expect(buildSrc).toMatch(/from '\.\/copy-bank-sync\.mjs'/);
  });

  it('scripts/build.mjs no longer byte-compares the bank itself', () => {
    // The exact shape of the bug, and the general shape of any revival of it.
    expect(buildSrc).not.toMatch(/onDisk\s*!==\s*buildModuleSource/);
    expect(buildSrc).not.toMatch(/onDisk\s*!==/);
    expect(buildSrc).not.toMatch(/buildModuleSource\s*\(\s*lang\s*\)/);
  });

  it('the build still fails the deploy on stale banks', () => {
    expect(buildSrc).toMatch(/per-language copy banks are stale/);
    expect(buildSrc).toMatch(/process\.exit\(1\)/);
  });
});

describe('the real gate function, run against a bank tree on disk', () => {
  const roots = [];
  const makeRoot = (contents) => {
    const root = mkdtempSync(path.join(tmpdir(), 'pw-gate-'));
    roots.push(root);
    mkdirSync(path.join(root, 'assets', 'copy'), { recursive: true });
    if (contents !== null) writeFileSync(path.join(root, 'assets', 'copy', 'en.js'), contents, 'utf8');
    return root;
  };

  afterAll(() => {
    for (const root of roots) rmSync(root, { recursive: true, force: true });
  });

  it('an LF bank is in sync', async () => {
    const { findStaleCopyBanks } = await loadSync();
    const root = makeRoot(buildModuleSource('en'));
    expect(findStaleCopyBanks(root, { langs: ['en'] })).toEqual([]);
  });

  it('a CRLF-ended bank on disk is in sync — the Windows-checkout case', async () => {
    const { findStaleCopyBanks } = await loadSync();
    const root = makeRoot(buildModuleSource('en').replace(/\n/g, '\r\n'));
    const onDisk = readFileSync(path.join(root, 'assets', 'copy', 'en.js'), 'utf8');
    expect(onDisk).toContain('\r\n'); // the fixture really is CRLF on disk
    expect(findStaleCopyBanks(root, { langs: ['en'] })).toEqual([]);
  });

  it('a missing bank is stale', async () => {
    const { findStaleCopyBanks } = await loadSync();
    expect(findStaleCopyBanks(makeRoot(null), { langs: ['en'] })).toEqual(['en.js']);
  });

  it('a genuinely drifted bank is stale, CRLF or not', async () => {
    const { findStaleCopyBanks } = await loadSync();
    const drifted = buildModuleSource('en').replace('heroLabels', 'heroLabelz');
    expect(findStaleCopyBanks(makeRoot(drifted), { langs: ['en'] })).toEqual(['en.js']);
    expect(findStaleCopyBanks(makeRoot(drifted.replace(/\n/g, '\r\n')), { langs: ['en'] })).toEqual(['en.js']);
  });

  it('the repo itself passes the real gate', async () => {
    const { findStaleCopyBanks } = await loadSync();
    expect(findStaleCopyBanks(fileURLToPath(new URL('../', import.meta.url)))).toEqual([]);
  });
});

// The suite runs inside the Vercel build, where the project's env vars are
// populated. Dummy Upstash + provider values turned a green suite into 88
// failures before tests/setup/clear-runtime-env.js existed.
describe('the suite is insulated from the build container environment', () => {
  it('vitest.config.js wires the runtime-env setup file', () => {
    const config = readRoot('vitest.config.js');
    expect(config).toMatch(/setupFiles\s*:/);
    expect(config).toMatch(/tests\/setup\/clear-runtime-env\.js/);
  });

  it('the setup file covers every secret the runtime reads', () => {
    // Anything api/ reads from the environment must be cleared or deliberately kept.
    for (const name of [
      'UPSTASH_KV_REST_API_URL', 'UPSTASH_KV_REST_API_TOKEN', 'WEATHERAPI_KEY',
      'PIRATE_WEATHER_KEY', 'TOMORROWIO_API_KEY', 'LOCATIONIQ_TOKEN',
      'OPEN_METEO_API_KEY', 'MET_USER_AGENT', 'PW_ERROR_ALLOWED_ORIGINS',
    ]) {
      expect(CLEARED_ENV_NAMES, `${name} must be cleared`).toContain(name);
    }
    expect(CLEARED_ENV_PREFIXES).toEqual(expect.arrayContaining(['UPSTASH_', 'KV_', 'REDIS_', 'VERCEL_']));
  });

  it('no runtime secret is actually visible to a running test', () => {
    // Behavioural, not textual: this fails if setupFiles stops being applied.
    for (const name of CLEARED_ENV_NAMES) {
      expect(process.env[name], `${name} leaked into the suite`).toBeUndefined();
    }
    const leaked = Object.keys(process.env)
      .filter((name) => CLEARED_ENV_PREFIXES.some((prefix) => name.startsWith(prefix)));
    expect(leaked).toEqual([]);
  });

  it('getRedis() cannot build a real client under the cleared environment', async () => {
    const { getRedis } = await import('../api/_lib/limiters.js');
    expect(getRedis()).toBeNull();
  });
});
