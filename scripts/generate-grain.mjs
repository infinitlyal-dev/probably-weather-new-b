// The film grain tile — generated ONCE, committed, and never generated again.
//
// Why a committed PNG and not a CSS/SVG filter: an feTurbulence layer is
// rasterised by the browser on every resize at the size of the viewport, on the
// main thread, during the exact window the LCP is being measured. A 64px tile is
// decoded once, costs one cached request and repeats for free on the compositor.
//
// Deterministic: same seed, same bytes. Re-running this must produce a
// byte-identical file, so the committed asset can be verified rather than
// trusted.
//
//   node scripts/generate-grain.mjs         -> assets/images/grain.png
//   node scripts/generate-grain.mjs --check -> verify the committed file matches
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const target = path.join(root, 'assets', 'images', 'grain.png');
const CHECK = process.argv.includes('--check');

const SIZE = 64;
// Peak alpha out of 255. At 14 the brightest speck lifts a #15120f surface by
// ~5% and the tile is invisible as a pattern — which is the brief: "barely
// there". Raising this is the one knob; everything else about the file is shape.
const PEAK = 14;
const SEED = 20260810;

// mulberry32 — small, deterministic, and good enough for grain.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = rng(SEED);
const px = Buffer.alloc(SIZE * SIZE * 4);
for (let i = 0; i < SIZE * SIZE; i += 1) {
  // Bates(3) → a rough bell around 0, so most pixels are nearly transparent and
  // only a few specks carry the grain. Uniform noise reads as a flat dither.
  const v = ((rand() + rand() + rand()) / 3 - 0.5) * 2;
  const alpha = Math.round(Math.abs(v) ** 1.6 * PEAK);
  // Light specks and dark specks, like real film — a white-only tile just fogs
  // the surface and reads as haze rather than grain.
  const tone = v > 0 ? 255 : 0;
  px[i * 4] = tone; px[i * 4 + 1] = tone; px[i * 4 + 2] = tone; px[i * 4 + 3] = alpha;
}

const png = await sharp(px, { raw: { width: SIZE, height: SIZE, channels: 4 } })
  .png({ compressionLevel: 9, effort: 10, palette: false })
  .toBuffer();

const sha = createHash('sha256').update(png).digest('hex').slice(0, 16);

if (CHECK) {
  let onDisk = null;
  try { onDisk = readFileSync(target); } catch { /* missing */ }
  if (!onDisk || !onDisk.equals(png)) {
    console.error(`[grain] FATAL: assets/images/grain.png does not match a fresh generation (expect sha ${sha}).`);
    process.exit(1);
  }
  console.log(`[grain] committed tile matches: ${SIZE}x${SIZE}, ${png.length} bytes, sha ${sha}.`);
} else {
  writeFileSync(target, png);
  console.log(`[grain] wrote assets/images/grain.png — ${SIZE}x${SIZE}, peak alpha ${PEAK}, ${png.length} bytes, sha ${sha}.`);
}
