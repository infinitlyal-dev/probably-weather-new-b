// Write the hero-pair table into assets/image-picker.js from review/hero-pairs.json (Al + Maat, 14 Oct 2026).
//
// A hero pair is a photograph and its line made as one idea, served outside the slot grid by its own rules: a
// condition folder, the times of day and the SAST weekdays it fits (image-picker.js pickHeroPair). The picker needs
// only those rules and the id; the lines go into hero-lines.js (scripts/build-hero-lines.mjs) and the crop anchors
// into hero-crop.js (scripts/build-hero-crop-offsets.mjs), both from the same file.
//
// REROLL GUARD, as in the grid's generators: each pair records the sha1-12 of its WebP, and a pair whose file now
// holds other bytes is refused — its line was written about that photograph.
//
// Like the other generators this is NOT wired into `npm run build`: pairs ship when Al has seen them on the phone.
//
//   node scripts/build-hero-pairs.mjs [--check]
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BG_IMAGE_SLOT_FOLDERS, BG_IMAGE_SLOT_TIMES } from '../assets/image-picker.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const CHECK = process.argv.includes('--check');

/** The pairs in review/hero-pairs.json, validated against the files on disk; throws on any problem. */
export function loadHeroPairs(file = path.join(root, 'review', 'hero-pairs.json')) {
  const doc = JSON.parse(readFileSync(file, 'utf8'));
  const problems = [];
  const ids = new Set();
  for (const p of doc.pairs || []) {
    const where = p.id || '(no id)';
    if (!/^[a-z0-9][a-z0-9-]*$/.test(p.id || '')) problems.push(`${where}: id must be lower-case letters, digits and dashes`);
    if (ids.has(p.id)) problems.push(`${where}: duplicate id`);
    ids.add(p.id);
    if (!BG_IMAGE_SLOT_FOLDERS.includes(p.folder)) problems.push(`${where}: folder ${p.folder} is not a condition folder`);
    if (!Array.isArray(p.times) || !p.times.length || p.times.some((t) => !BG_IMAGE_SLOT_TIMES.includes(t))) problems.push(`${where}: times must be a non-empty list of ${BG_IMAGE_SLOT_TIMES.join('/')}`);
    if (!Array.isArray(p.days) || !p.days.length || p.days.some((d) => !Number.isInteger(d) || d < 1 || d > 7) || new Set(p.days).size !== p.days.length) problems.push(`${where}: days must be distinct weekdays 1-7`);
    if (!Array.isArray(p.lines) || !p.lines.length || p.lines.some((l) => typeof l !== 'string' || !l.trim())) problems.push(`${where}: no English line`);
    if (p.crop !== null && (typeof p.crop !== 'number' || p.crop < 0 || p.crop > 100)) problems.push(`${where}: crop must be null or a percentage`);
    if (!p.stranger) problems.push(`${where}: no stranger-read sentence (a pair is approved with one)`);
    if (p.image !== `assets/images/bg-pairs/${p.id}.webp`) problems.push(`${where}: image must be assets/images/bg-pairs/${p.id}.webp`);
    let bytes = null;
    try { bytes = readFileSync(path.join(root, ...String(p.image).split('/'))); } catch { problems.push(`${where}: ${p.image} is not on disk`); }
    if (bytes) {
      const actual = createHash('sha1').update(bytes).digest('hex').slice(0, 12);
      if (actual !== p.sha1) problems.push(`${where}: ${p.image} now holds different bytes (sha1-12 ${actual}, recorded ${p.sha1}) — its line was written about another photograph`);
    }
  }
  if (problems.length) throw new Error(`review/hero-pairs.json:\n  - ${problems.join('\n  - ')}`);
  return doc.pairs || [];
}

/** The generated block for image-picker.js. */
export function heroPairsBlock(pairs) {
  const rows = pairs.map((p) => `  { id: ${JSON.stringify(p.id)}, folder: ${JSON.stringify(p.folder)}, times: ${JSON.stringify(p.times)}, days: ${JSON.stringify(p.days)} },`);
  return `  // __HERO_PAIRS__  (generated — do not hand-edit)\n${rows.join('\n')}${rows.length ? '\n' : ''}`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let pairs;
  try { pairs = loadHeroPairs(); } catch (e) { console.error(`[hero-pairs] refusing to generate: ${e.message}`); process.exit(1); }
  const modulePath = path.join(root, 'assets', 'image-picker.js');
  const src = readFileSync(modulePath, 'utf8');
  const BLOCK = / *\/\/ __HERO_PAIRS__[^\n]*\n[\s\S]*?(?=\]\);)/;
  if (!BLOCK.test(src)) { console.error('[hero-pairs] could not find the __HERO_PAIRS__ block in assets/image-picker.js'); process.exit(1); }
  const next = src.replace(BLOCK, () => heroPairsBlock(pairs));
  if (CHECK) {
    if (next !== src) { console.error('[hero-pairs] assets/image-picker.js is out of sync with review/hero-pairs.json'); process.exit(1); }
    console.log(`[hero-pairs] in sync — ${pairs.length} pairs.`);
  } else {
    writeFileSync(modulePath, next, 'utf8');
    console.log(`[hero-pairs] wrote ${pairs.length} pairs into assets/image-picker.js`);
  }
}
