// MEDIUM fixes — cold-open background resilience (M-ii) and the build drift
// gate (M-iii).

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const build = readFileSync(new URL('../scripts/build.mjs', import.meta.url), 'utf8');
const css = readFileSync(new URL('../assets/app.css', import.meta.url), 'utf8');
const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');

describe('M-ii — pw_last_bg upgrade falls back to default on a broken pick', () => {
  it('the bg-upgrade script attaches onerror → default.jpg before setting the stored src', () => {
    // Grab the inline script that reads pw_last_bg.
    const m = html.match(/pw_last_bg[\s\S]*?<\/script>/);
    expect(m, 'pw_last_bg upgrade script present').toBeTruthy();
    const block = m[0];
    expect(block).toMatch(/img\.onerror\s*=/);
    expect(block).toMatch(/assets\/images\/bg\/default\.jpg/);
    // onerror must be wired BEFORE the stored src is assigned, or a synchronous
    // cache error could fire before the handler exists.
    const onerrorIdx = block.indexOf('img.onerror');
    const setSrcIdx = block.indexOf('img.src = last');
    expect(onerrorIdx).toBeGreaterThan(-1);
    expect(setSrcIdx).toBeGreaterThan(onerrorIdx);
  });
});

describe('M-iii — build fails on stale per-language copy banks', () => {
  it('build.mjs verifies committed banks against a fresh regeneration and exits 1 on drift', () => {
    expect(build).toMatch(/buildModuleSource/);
    expect(build).toMatch(/from '\.\/generate-copy-splits\.mjs'/);
    // The verify branch must hard-fail (process.exit(1)), not silently
    // regenerate-overwrite the source as before.
    expect(build).toMatch(/stale[\s\S]*process\.exit\(1\)/);
    // And it must NOT shell out to regenerate into the source tree anymore.
    expect(build).not.toMatch(/execFileSync[\s\S]*generate-copy-splits/);
  });
});

describe('L-i — build precache gate covers extensionless rewrite entries', () => {
  it('maps known rewrites and hard-fails on an unmapped extensionless path', () => {
    expect(build).toMatch(/REWRITE_TARGETS/);
    // Every extensionless CORE_ASSETS entry must be in REWRITE_TARGETS.
    const block = sw.match(/CORE_ASSETS\s*=\s*\[([\s\S]*?)\]/)[1];
    const entries = [...block.matchAll(/['"](\/[^'"]*)['"]/g)].map((m) => m[1]);
    const extensionless = entries.filter((p) => !/\.[a-z0-9]+$/i.test(p));
    const mapBlock = build.match(/REWRITE_TARGETS\s*=\s*{([\s\S]*?)}/)[1];
    for (const p of extensionless) {
      expect(mapBlock, `${p} must be mapped in REWRITE_TARGETS`).toContain(`'${p}'`);
    }
    // The gate must exit(1) on an unverifiable extensionless path.
    expect(build).toMatch(/unverifiable[\s\S]*process\.exit\(1\)/);
  });
});

describe('L-ii — build guards against client imports of server-only weather-copy.js', () => {
  it('build.mjs scans dist client JS for weather-copy imports and fails', () => {
    expect(build).toMatch(/weather-copy\.js/);
    expect(build).toMatch(/offenders[\s\S]*process\.exit\(1\)/);
  });
});

describe('L-iv — focused skip-link renders above the splash', () => {
  it('.skip-link:focus z-index exceeds #pwSplash (2147483000)', () => {
    const focus = css.match(/\.skip-link:focus\s*{([\s\S]*?)}/);
    expect(focus, '.skip-link:focus rule present').toBeTruthy();
    const z = focus[1].match(/z-index:\s*(\d+)/);
    expect(z, 'skip-link:focus sets z-index').toBeTruthy();
    expect(Number(z[1])).toBeGreaterThan(2147483000);
  });
});
