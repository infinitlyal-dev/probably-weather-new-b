// Dependency security floor.
//
// Two separate field failures are pinned here.
//
// 1) Vulnerable image/compression stack. `npm audit` flagged sharp (libvips
//    CVE-2026-33327/33328/35590/35591 + libheif GHSA-rgj7-g3m4-5g8c) and fflate
//    (GHSA-px8p-9vwx-vf98, reached through satori → @shuding/opentype.js).
//    Both render the share/OG card, so both run on attacker-supplied-ish input.
//
// 2) The July OG outage. package-lock.json is generated on Windows and once
//    shipped with ONLY the @img/sharp-win32-x64 binary. Vercel's Linux build
//    therefore had no sharp binary at all and /api/og returned 500 for 20
//    minutes. The lockfile must always carry the linux-x64 sharp binary AND its
//    libvips sidecar, at the same version the rest of the tree resolved to.
//
// A lockfile regenerated with `npm install --os=win32` alone will fail this file.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));

// Patched releases installed 2026-09-14. Raise these, never lower them.
const SHARP_FLOOR = '0.35.4';

// fflate GHSA-px8p-9vwx-vf98 was fixed on TWO branches, so a simple floor is
// wrong: ">= 0.7.5" would happily accept 0.8.0-0.8.2, which are still
// vulnerable. Encode the advisory's affected ranges and reject membership.
const FFLATE_AFFECTED = [
  { min: '0.0.0', max: '0.7.4' },
  { min: '0.8.0', max: '0.8.2' },
];

// Numeric semver compare, prerelease-aware enough for this purpose: any
// prerelease (0.35.4-rc.0) sorts BELOW its release, which matters because the
// sharp advisory's last vulnerable version is exactly 0.35.4-rc.0.
function compareSemver(a, b) {
  const [aCore, aPre] = String(a).split('-');
  const [bCore, bPre] = String(b).split('-');
  const aParts = aCore.split('.').map(Number);
  const bParts = bCore.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    if ((aParts[i] || 0) !== (bParts[i] || 0)) return (aParts[i] || 0) < (bParts[i] || 0) ? -1 : 1;
  }
  if (aPre && !bPre) return -1;
  if (!aPre && bPre) return 1;
  if (aPre && bPre && aPre !== bPre) return aPre < bPre ? -1 : 1;
  return 0;
}

const resolved = (path) => lock.packages?.[path]?.version;

const isAffected = (version, ranges) => ranges.some(
  ({ min, max }) => compareSemver(version, min) >= 0 && compareSemver(version, max) <= 0,
);

describe('dependency security floor', () => {
  it('compareSemver ranks releases above their own prereleases', () => {
    expect(compareSemver('0.35.4', '0.35.4-rc.0')).toBe(1);
    expect(compareSemver('0.35.4', '0.34.5')).toBe(1);
    expect(compareSemver('0.7.4', '0.7.5')).toBe(-1);
    expect(compareSemver('1.3.3', '1.3.3')).toBe(0);
  });

  it('package.json requests a sharp range that starts at or above the patched release', () => {
    const declared = pkg.dependencies?.sharp;
    expect(declared, 'sharp must stay a direct dependency').toBeTruthy();
    const minimum = declared.replace(/^[\^~>=\s]+/, '');
    expect(
      compareSemver(minimum, SHARP_FLOOR),
      `package.json requests sharp ${declared}, which allows a version below ${SHARP_FLOOR}`,
    ).toBeGreaterThanOrEqual(0);
  });

  it('resolves sharp at or above the patched release', () => {
    const version = resolved('node_modules/sharp');
    expect(version, 'sharp missing from package-lock.json').toBeTruthy();
    expect(
      compareSemver(version, SHARP_FLOOR),
      `lockfile resolves sharp ${version}, below the patched ${SHARP_FLOOR}`,
    ).toBeGreaterThanOrEqual(0);
  });

  it('knows which fflate versions the advisory actually covers', () => {
    // Both fixed branches are clean; everything the advisory names is not.
    expect(isAffected('0.7.5', FFLATE_AFFECTED)).toBe(false);
    expect(isAffected('0.8.3', FFLATE_AFFECTED)).toBe(false);
    expect(isAffected('0.7.4', FFLATE_AFFECTED)).toBe(true);
    expect(isAffected('0.8.0', FFLATE_AFFECTED)).toBe(true);
    expect(isAffected('0.8.2', FFLATE_AFFECTED)).toBe(true);
  });

  it('resolves fflate outside every range the advisory affects', () => {
    const version = resolved('node_modules/fflate');
    expect(version, 'fflate missing from package-lock.json').toBeTruthy();
    expect(
      isAffected(version, FFLATE_AFFECTED),
      `lockfile resolves fflate ${version}, which GHSA-px8p-9vwx-vf98 still affects`,
    ).toBe(false);
  });

  it('carries the linux-x64 sharp binary at the resolved sharp version', () => {
    const sharpVersion = resolved('node_modules/sharp');
    const linuxVersion = resolved('node_modules/@img/sharp-linux-x64');
    expect(
      linuxVersion,
      'package-lock.json has no @img/sharp-linux-x64 — Vercel would build without a sharp binary and /api/og would 500',
    ).toBeTruthy();
    expect(linuxVersion).toBe(sharpVersion);
  });

  it('carries the linux-x64 libvips sidecar at the version the linux binary asks for', () => {
    const linuxEntry = lock.packages?.['node_modules/@img/sharp-linux-x64'];
    // sharp declares its libvips sidecar under optionalDependencies, not
    // dependencies. Reading the wrong key left this assertion undefined and it
    // skipped itself — a stale 1.2.4 sidecar passed. Require it, compare always.
    const wanted = linuxEntry?.optionalDependencies?.['@img/sharp-libvips-linux-x64'];
    expect(
      wanted,
      '@img/sharp-linux-x64 declares no libvips sidecar in optionalDependencies — the lockfile entry shape changed, fix this test',
    ).toBeTruthy();
    const libvipsVersion = resolved('node_modules/@img/sharp-libvips-linux-x64');
    expect(
      libvipsVersion,
      'package-lock.json has no @img/sharp-libvips-linux-x64 — the linux sharp binary has no libvips to load',
    ).toBeTruthy();
    expect(
      libvipsVersion,
      `linux sharp wants libvips ${wanted} but the lockfile pins ${libvipsVersion}`,
    ).toBe(wanted.replace(/^[\^~>=\s]+/, ''));
  });

  it('keeps the win32-x64 binary so the local suite still runs', () => {
    const sharpVersion = resolved('node_modules/sharp');
    const winVersion = resolved('node_modules/@img/sharp-win32-x64');
    expect(winVersion, 'package-lock.json has no @img/sharp-win32-x64').toBeTruthy();
    expect(winVersion).toBe(sharpVersion);
  });
});
