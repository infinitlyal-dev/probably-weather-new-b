// Contact sheets for the 7 Oct 2026 photo sets (review/image-brief-2026-10-07.md), one JPG per set, for Al's
// keep/cut ruling. Columns are the weekday slot (1 = Monday … 7 = Sunday), rows the time of day; the filename sits
// under every tile. Cloudy has only its 13 replacement slots, laid in the same grid with the empty cells left dark.
//
//   node scripts/new-sets-contact-sheet.mjs
//
// Output: review/contact-sheets-2026-10-07/<set>.jpg
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = path.join(root, 'review', 'new-sets-2026-10-07');
const out = path.join(root, 'review', 'contact-sheets-2026-10-07');
mkdirSync(out, { recursive: true });

const TIMES = ['dawn', 'day', 'dusk', 'night'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TW = 300, TH = 533, GAP = 14, LABEL = 30, HEAD = 96, SIDE = 70;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

for (const set of ['partly-cloudy', 'breezy', 'cloudy']) {
  const W = SIDE + 7 * TW + 8 * GAP, H = HEAD + 4 * (TH + LABEL + GAP) + GAP;
  const layers = [];
  const texts = [`<text x="${GAP}" y="40" font-size="30" font-weight="700" fill="#fffaf3">${esc(set)} — Anon, 7 Oct 2026</text>`];
  DAYS.forEach((d, c) => texts.push(`<text x="${SIDE + GAP + c * (TW + GAP) + TW / 2}" y="${HEAD - 8}" font-size="18" fill="#b5ab9d" text-anchor="middle">${c + 1} · ${d}</text>`));
  let n = 0;
  for (const [r, t] of TIMES.entries()) {
    const y = HEAD + GAP + r * (TH + LABEL + GAP);
    texts.push(`<text x="${SIDE / 2}" y="${y + TH / 2}" font-size="18" fill="#b5ab9d" text-anchor="middle" transform="rotate(-90 ${SIDE / 2} ${y + TH / 2})">${t}</text>`);
    for (let c = 0; c < 7; c++) {
      const x = SIDE + GAP + c * (TW + GAP);
      const names = [`${t}-${c + 1}.png`, `${t}-${c + 1}-weekB.png`];
      const name = names.find((f) => existsSync(path.join(src, set, f)));
      if (!name) { layers.push({ input: { create: { width: TW, height: TH, channels: 3, background: '#221d17' } }, left: x, top: y }); continue; }
      layers.push({ input: await sharp(path.join(src, set, name)).resize(TW, TH, { fit: 'cover' }).toBuffer(), left: x, top: y });
      texts.push(`<text x="${x + TW / 2}" y="${y + TH + 21}" font-size="17" fill="#fffaf3" text-anchor="middle" font-family="Consolas, monospace">${esc(`${set}/${name}`)}</text>`);
      n++;
    }
  }
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Segoe UI, Arial, sans-serif">${texts.join('')}</svg>`);
  const file = path.join(out, `${set}.jpg`);
  await sharp({ create: { width: W, height: H, channels: 3, background: '#14110d' } })
    .composite([...layers, { input: svg, left: 0, top: 0 }]).jpeg({ quality: 82, mozjpeg: true }).toFile(file);
  console.log(`[contact] ${set}: ${n} photos → ${path.relative(root, file)}`);
}
