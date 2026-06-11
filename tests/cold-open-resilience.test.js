// MEDIUM fixes — cold-open background resilience (M-ii) and the build drift
// gate (M-iii).

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const build = readFileSync(new URL('../scripts/build.mjs', import.meta.url), 'utf8');

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
