// A photograph encoded for the background grid: 1008x1792 WebP under the recompress budget
// (scripts/recompress-bg-images.mjs: at most 290 KB, quality searched between 60 and 82, the same phone-safe width steps),
// hashed the way the grid hashes it (sha1 of the bytes, first 12 hex).
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const TARGET_BYTES = 290 * 1024, MIN_Q = 60, MAX_Q = 82, WIDTHS = [null, 1280, 1200, 1080, 960];
const W = 1008, H = 1792;

export const sha12 = (b) => createHash('sha1').update(b).digest('hex').slice(0, 12);

/** @returns {Promise<{buf: Buffer, q: number, width: number|null}>} */
export async function encodeBg(file) {
  const input = await sharp(file).resize(W, H, { fit: 'cover' }).png().toBuffer();
  for (const width of WIDTHS) {
    let lo = MIN_Q, hi = MAX_Q, best = null;
    while (lo <= hi) {
      const q = Math.floor((lo + hi) / 2);
      let p = sharp(input);
      if (width) p = p.resize({ width, withoutEnlargement: true });
      const buf = await p.webp({ quality: q, effort: 6, smartSubsample: true }).toBuffer();
      if (buf.length <= TARGET_BYTES) { best = { buf, q, width }; lo = q + 1; } else hi = q - 1;
    }
    if (best) return best;
  }
  throw new Error(`${file}: cannot reach ${TARGET_BYTES} bytes at quality ${MIN_Q}`);
}
