import { readFile } from 'node:fs/promises';

import { describe, expect, it, vi } from 'vitest';

async function loadSearchMiniModule() {
  try {
    return await import('../assets/search-mini-weather.js');
  } catch {
    return {};
  }
}

describe('P2 search mini-weather fan-out', () => {
  it('P2 exposes a three-visible-row fetch limit', async () => {
    const mod = await loadSearchMiniModule();
    expect(mod.SEARCH_MINI_VISIBLE_LIMIT).toBe(3);
  });

  it('P2 coalesces duplicate coordinate loads while the first promise is in flight', async () => {
    const mod = await loadSearchMiniModule();
    expect(typeof mod.createSearchMiniPromiseCache).toBe('function');
    if (typeof mod.createSearchMiniPromiseCache !== 'function') return;

    let resolveLoad;
    const load = vi.fn(() => new Promise((resolve) => { resolveLoad = resolve; }));
    const getOrLoad = mod.createSearchMiniPromiseCache();
    const first = getOrLoad(-34.116, 18.836, load);
    const duplicate = getOrLoad(-34.118, 18.838, load);

    expect(duplicate).toBe(first);
    expect(load).toHaveBeenCalledTimes(1);
    resolveLoad({ temp: '21°' });
    await expect(first).resolves.toEqual({ temp: '21°' });
  });

  it('P2 drops a rejected in-flight promise so the next render can retry', async () => {
    const mod = await loadSearchMiniModule();
    expect(typeof mod.createSearchMiniPromiseCache).toBe('function');
    if (typeof mod.createSearchMiniPromiseCache !== 'function') return;

    const load = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ temp: '19°' });
    const getOrLoad = mod.createSearchMiniPromiseCache();

    await expect(getOrLoad(-34.1, 18.8, load)).rejects.toThrow('offline');
    await expect(getOrLoad(-34.1, 18.8, load)).resolves.toEqual({ temp: '19°' });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('P2 wires mini chips and fetches only to the first three rendered rows', async () => {
    const source = await readFile(new URL('../assets/app.js', import.meta.url), 'utf8');
    expect(source).toMatch(/index\s*<\s*SEARCH_MINI_VISIBLE_LIMIT/);
    expect(source).toMatch(/Array\.from\(rl\.querySelectorAll\('li\[data-lat\]'\)\)\.slice\(0,\s*SEARCH_MINI_VISIBLE_LIMIT\)/);
  });
});
