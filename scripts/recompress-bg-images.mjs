import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const SOURCE_LIMIT_BYTES = 300 * 1024;
const TARGET_BYTES = 290 * 1024;
const MIN_QUALITY = 60;
const MAX_QUALITY = 82;
const PHONE_SAFE_WIDTHS = [null, 1280, 1200, 1080, 960];
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

async function encodeWithinBudget(file) {
  // Decode from an in-memory buffer so libvips does not retain a Windows file
  // handle while the source path is replaced below (OneDrive otherwise locks
  // the open input between toBuffer() and writeFile()).
  const input = await readFile(file);
  async function findBest(resizeWidth = null) {
    let low = MIN_QUALITY;
    let high = MAX_QUALITY;
    let best = null;
    while (low <= high) {
      const quality = Math.floor((low + high) / 2);
      let pipeline = sharp(input).rotate();
      if (resizeWidth) pipeline = pipeline.resize({ width: resizeWidth, withoutEnlargement: true });
      const buffer = await pipeline
        .webp({ quality, effort: 6, smartSubsample: true })
        .toBuffer();
      if (buffer.length <= TARGET_BYTES) {
        best = { buffer, quality, resizeWidth };
        low = quality + 1;
      } else {
        high = quality - 1;
      }
    }
    return best;
  }

  let best = null;
  for (const width of PHONE_SAFE_WIDTHS) {
    best = await findBest(width);
    if (best) break;
  }
  if (!best) throw new Error(`${path.relative(repoRoot, file)} cannot reach ${TARGET_BYTES} bytes at quality ${MIN_QUALITY}`);
  return best;
}

const files = await collectWebps(imageRoot);
const oversized = [];
for (const file of files) {
  const bytes = (await stat(file)).size;
  if (bytes > SOURCE_LIMIT_BYTES) oversized.push({ file, bytes });
}

let beforeBytes = 0;
let afterBytes = 0;
for (const source of oversized) {
  const encoded = await encodeWithinBudget(source.file);
  await writeFile(source.file, encoded.buffer);
  beforeBytes += source.bytes;
  afterBytes += encoded.buffer.length;
  const resizeNote = encoded.resizeWidth ? `, ${encoded.resizeWidth}px wide` : '';
  console.log(`[P1 recompress] ${path.relative(repoRoot, source.file)} ${source.bytes} -> ${encoded.buffer.length} bytes (q${encoded.quality}${resizeNote})`);
}

console.log(`[P1 recompress] DONE: ${oversized.length} images, ${beforeBytes} -> ${afterBytes} bytes.`);
