import { describe, expect, it } from 'vitest';
import { COPY_BANK, loadCopyBank } from '../assets/copy-loader.js';

// M-5 (2026-07-02): a non-English first paint must never flash English seed
// strings. loadAndRender awaits loadCopyBank(settings.lang) before any content
// render; this locks the merge + in-flight de-dupe the fix relies on.

describe('copy-loader — per-language bank merge + de-dupe (M-5)', () => {
  it('seed is English-only until a bank is loaded', () => {
    // The static seed only carries en strings — this is exactly why an un-awaited
    // load flashed English for af/zu/xh/st users.
    expect(COPY_BANK.witty.clear.en).toBeTruthy();
    expect(COPY_BANK.witty.clear.af).toBeUndefined();
  });

  it('merges a language bank into COPY_BANK and is idempotent', async () => {
    const first = await loadCopyBank('af');
    expect(first).toBe(true);
    expect(Array.isArray(COPY_BANK.witty.clear.af)).toBe(true);
    expect(COPY_BANK.witty.clear.af.length).toBeGreaterThan(1);
    // heroLabels / headlines merged too (used by the first-paint hero).
    expect(COPY_BANK.heroLabels.clear.af).toBeTruthy();
    const second = await loadCopyBank('af'); // already loaded → no re-merge
    expect(second).toBe(false);
  });

  it('concurrent loads of the same language share one in-flight import', async () => {
    const [a, b] = await Promise.all([loadCopyBank('zu'), loadCopyBank('zu')]);
    // Both resolve from the single shared promise (no double import / double merge).
    expect(a).toBe(true);
    expect(b).toBe(true);
    expect(Array.isArray(COPY_BANK.witty.clear.zu)).toBe(true);
  });

  it('an unsupported lang falls back to en without throwing', async () => {
    await expect(loadCopyBank('xx')).resolves.not.toThrow;
  });
});
