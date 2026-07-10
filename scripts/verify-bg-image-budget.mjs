import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MAX_BG_IMAGE_BYTES = 300 * 1024;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const imageRoot = path.join(repoRoot, 'assets', 'images', 'bg');

async function collectWebps(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectWebps(absolute);
    return entry.isFile() && entry.name.toLowerCase().endsWith('.webp') ? [absolute] : [];
  }));
  return nested.flat();
}

const files = await collectWebps(imageRoot);
const measured = await Promise.all(files.map(async (file) => ({ file, bytes: (await stat(file)).size })));
const violations = measured
  .filter(({ bytes }) => bytes > MAX_BG_IMAGE_BYTES)
  .sort((a, b) => b.bytes - a.bytes);

if (violations.length > 0) {
  console.error(`[P1 bg-budget] FAIL: ${violations.length} WebP files exceed ${MAX_BG_IMAGE_BYTES} bytes (300 KiB).`);
  for (const { file, bytes } of violations) {
    console.error(`  ${path.relative(repoRoot, file)} — ${bytes} bytes`);
  }
  process.exitCode = 1;
} else {
  console.log(`[P1 bg-budget] PASS: ${measured.length} WebP files are <= ${MAX_BG_IMAGE_BYTES} bytes (300 KiB).`);
}
