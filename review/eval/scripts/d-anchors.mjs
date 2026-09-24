// Home option D (2026-09-24): where each served photograph's subject sits, from Al's crop anchors.
// Joins every slot of the library to its canonical hash (sha256 of the bytes, as the build does),
// drops benched slots, and reads the anchor Al dragged onto the subject (assets/hero-crop.js).
//   node review/eval/scripts/d-anchors.mjs > review/eval/data/d-anchors.json
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { HERO_CROP_OFFSETS } from '../../../assets/hero-crop.js';
import { BG_IMAGE_SLOT_FOLDERS, BG_IMAGE_SLOT_TIMES } from '../../../assets/image-picker.js';
import { loadBench } from '../../../scripts/image-slot-manifest.mjs';

const bench = loadBench();
const photos = new Map();   // hash -> { hash, anchor, slots: [] }
for (const folder of BG_IMAGE_SLOT_FOLDERS) for (let w = 1; w <= 4; w++) for (const time of BG_IMAGE_SLOT_TIMES) for (let d = 1; d <= 7; d++) {
  const rel = `${folder}/week_${w}/${time}/${d}.webp`;
  const file = `assets/images/bg/${rel}`;
  if (!existsSync(file)) continue;
  const hash = createHash('sha256').update(readFileSync(file)).digest('hex');
  if (bench.everywhere?.has?.(hash) || bench.bySlot?.has?.(rel)) continue;
  if (!photos.has(hash)) {
    const key = `bg-canonical/${hash}.webp`;
    photos.set(hash, { hash, anchor: key in HERO_CROP_OFFSETS ? HERO_CROP_OFFSETS[key] : null, slots: [] });
  }
  photos.get(hash).slots.push(rel);
}
const list = [...photos.values()];
const withAnchor = list.filter((p) => p.anchor != null);
const bands = { '<40': 0, '40-49': 0, '50-59': 0, '60-69': 0, '70-79': 0, '80+': 0, 'none (78 default)': list.length - withAnchor.length };
for (const p of withAnchor) {
  const a = p.anchor;
  bands[a < 40 ? '<40' : a < 50 ? '40-49' : a < 60 ? '50-59' : a < 70 ? '60-69' : a < 80 ? '70-79' : '80+']++;
}
process.stderr.write(`${list.length} photographs served, ${withAnchor.length} with an anchor\n${JSON.stringify(bands)}\n`);
console.log(JSON.stringify(list, null, 1));
