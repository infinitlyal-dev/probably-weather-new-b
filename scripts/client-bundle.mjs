import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import esbuild from 'esbuild';

/** Bundle the app's static graph while retaining its intentional lazy edges. */
export async function bundleClientAssets({ assetsDir, outdir = assetsDir, write = false }) {
  const shared = {
    outdir,
    bundle: true,
    format: 'esm',
    target: ['es2021'],
    minify: true,
    treeShaking: true,
    entryNames: '[name]',
    metafile: true,
    write,
  };
  const main = await esbuild.build({
    ...shared,
    entryPoints: {
      app: path.join(assetsDir, 'app.js'),
      install: path.join(assetsDir, 'install.js'),
    },
    splitting: true,
    chunkNames: 'chunks/[name]-[hash]',
  });
  // Debug is outside the normal graph and deliberately not precached. Bundle
  // it independently so sharing its install helper cannot create a static
  // support-chunk request for app.js or split the lazy install UI in two.
  const debug = await esbuild.build({
    ...shared,
    entryPoints: { 'debug-overlay': path.join(assetsDir, 'debug-overlay.js') },
    splitting: false,
  });
  return {
    outputFiles: [...(main.outputFiles || []), ...(debug.outputFiles || [])],
    metafile: {
      inputs: { ...main.metafile.inputs, ...debug.metafile.inputs },
      outputs: { ...main.metafile.outputs, ...debug.metafile.outputs },
    },
  };
}

function removeJavaScript(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      removeJavaScript(full);
      if (readdirSync(full).length === 0) rmSync(full, { recursive: true });
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      rmSync(full);
    }
  }
}

/** Replace copied source modules with the in-memory bundle output atomically. */
export async function emitClientBundle(assetsDir) {
  const result = await bundleClientAssets({ assetsDir, outdir: assetsDir, write: false });
  removeJavaScript(assetsDir);
  for (const output of result.outputFiles) {
    mkdirSync(path.dirname(output.path), { recursive: true });
    writeFileSync(output.path, output.contents);
  }

  const assetUrls = result.outputFiles
    .filter((output) => output.path.endsWith('.js'))
    .map((output) => `/assets/${path.relative(assetsDir, output.path).replaceAll('\\', '/')}`)
    .sort();
  const coreAssetUrls = assetUrls.filter((url) => url !== '/assets/debug-overlay.js');
  const bytes = result.outputFiles.reduce((total, output) => total + output.contents.length, 0);
  return { ...result, assetUrls, coreAssetUrls, bytes };
}
