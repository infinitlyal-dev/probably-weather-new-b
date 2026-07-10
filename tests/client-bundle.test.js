import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import { bundleClientAssets } from '../scripts/client-bundle.mjs';

const assetsDir = fileURLToPath(new URL('../assets/', import.meta.url));
const tempDirs = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('P6 production client bundle', () => {
  it('P6 emits one initial app request with no static module fan-out', async () => {
    const outdir = await mkdtemp(path.join(tmpdir(), 'pw-p6-'));
    tempDirs.push(outdir);
    const result = await bundleClientAssets({ assetsDir, outdir, write: false });
    const appOutput = Object.entries(result.metafile.outputs)
      .find(([, output]) => output.entryPoint?.replaceAll('\\', '/').endsWith('/app.js'));

    expect(appOutput).toBeTruthy();
    expect(appOutput[1].imports.filter((entry) => entry.kind === 'import-statement')).toEqual([]);
  });

  it('P6 keeps install UI and all five language banks in separate lazy chunks', async () => {
    const outdir = await mkdtemp(path.join(tmpdir(), 'pw-p6-'));
    tempDirs.push(outdir);
    const result = await bundleClientAssets({ assetsDir, outdir, write: false });
    const lazyEntryPoints = Object.values(result.metafile.outputs)
      .map((output) => output.entryPoint?.replaceAll('\\', '/'))
      .filter(Boolean);

    expect(lazyEntryPoints.some((entry) => entry.endsWith('/install.js'))).toBe(true);
    for (const lang of ['en', 'af', 'zu', 'xh', 'st']) {
      expect(lazyEntryPoints.some((entry) => entry.endsWith(`/copy/${lang}.js`))).toBe(true);
    }
  });
});
