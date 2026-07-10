import { readFile } from 'node:fs/promises';

import { describe, expect, it, vi } from 'vitest';

async function loadDeferredModule() {
  try {
    return await import('../assets/install-loader.js');
  } catch {
    return {};
  }
}

function fakeWindow() {
  const listeners = new Map();
  const idle = [];
  return {
    listeners,
    idle,
    addEventListener(type, handler) { listeners.set(type, handler); },
    requestIdleCallback(callback, options) { idle.push({ callback, options }); },
  };
}

describe('P8 deferred install chunk loader', () => {
  it('P8 waits for idle instead of loading the full install chunk at boot', async () => {
    const mod = await loadDeferredModule();
    expect(typeof mod.setupDeferredInstallLoad).toBe('function');
    if (typeof mod.setupDeferredInstallLoad !== 'function') return;

    const windowRef = fakeWindow();
    const load = vi.fn(async () => 'loaded');
    mod.setupDeferredInstallLoad({ windowRef, load });

    expect(load).not.toHaveBeenCalled();
    expect(windowRef.idle).toHaveLength(1);
    windowRef.idle[0].callback();
    await Promise.resolve();
    expect(load).toHaveBeenCalledWith(null);
  });

  it('P8 captures beforeinstallprompt and loads immediately with that exact event', async () => {
    const mod = await loadDeferredModule();
    expect(typeof mod.setupDeferredInstallLoad).toBe('function');
    if (typeof mod.setupDeferredInstallLoad !== 'function') return;

    const windowRef = fakeWindow();
    const load = vi.fn(async () => 'loaded');
    mod.setupDeferredInstallLoad({ windowRef, load });
    const promptEvent = { preventDefault: vi.fn() };

    windowRef.listeners.get('beforeinstallprompt')(promptEvent);
    await Promise.resolve();

    expect(promptEvent.preventDefault).toHaveBeenCalledOnce();
    expect(load).toHaveBeenCalledWith(promptEvent);
    windowRef.idle[0].callback();
    await Promise.resolve();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('P8 app wiring passes the boot-captured prompt into install.js initialization', async () => {
    const appSource = await readFile(new URL('../assets/app.js', import.meta.url), 'utf8');
    const installSource = await readFile(new URL('../assets/install.js', import.meta.url), 'utf8');

    expect(appSource).toMatch(/setupDeferredInstallLoad\(\{[\s\S]*?load:\s*async\s*\(capturedPrompt\)/);
    expect(appSource).toMatch(/initInstallExperience\(\{[\s\S]*?capturedPrompt/);
    expect(installSource).toMatch(/initInstallExperience\(\{[\s\S]*?capturedPrompt\s*=\s*null/);
    expect(installSource).toMatch(/let\s+deferredPrompt\s*=\s*capturedPrompt/);
  });
});
