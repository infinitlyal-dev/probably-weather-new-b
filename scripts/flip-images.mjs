// Horizontally flip the background images Al marked in review/flip-list.json.
//
// flip-list.json records SLOT paths (45), but those resolve to 26 distinct images —
// off-peak images occupy a week pair, so one marked image spans several identical slots.
// We flip per IMAGE and write the result to every slot that image still occupies.
//
// Slot occupancy is re-resolved against the CURRENT tree, not assumed from the list:
// wiring may have reassigned a listed path to a different image (fog demotion does exactly
// this). Flipping such a path would mirror an image Al never marked. Those are skipped.
//
// Flipped bytes are new bytes, so the caller must bump BG_IMAGE_URL_VERSION.
//
// Usage: node scripts/flip-images.mjs [--apply]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const APPLY = process.argv.includes('--apply');
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET_BYTES = 290 * 1024;
const MAX_BYTES = 300 * 1024;
const QUALITY_LADDER = [82, 78, 74, 70, 66, 62, 60];

const flipList = JSON.parse(fs.readFileSync(path.join(repoRoot, 'review/flip-list.json'), 'utf8'));
const inv = JSON.parse(fs.readFileSync(path.join(repoRoot, 'review/tools/inventory.json'), 'utf8'));

// Resolve marked slot paths -> distinct owning images.
const owners = new Map();
const orphans = [];
for (const p of flipList.paths) {
  const owner = inv.find((i) => i.slots.includes(p));
  if (!owner) { orphans.push(p); continue; }
  if (!owners.has(owner.idx)) owners.set(owner.idx, owner);
}

// A slot still belongs to its image only if its bytes still match the image's canonical
// representative. Anything else was reassigned by wiring and must not be flipped.
const sameBytes = (a, b) => {
  const A = path.join(repoRoot, a), B = path.join(repoRoot, b);
  if (!fs.existsSync(A) || !fs.existsSync(B)) return false;
  return fs.readFileSync(A).equals(fs.readFileSync(B));
};

const jobs = [];
let skipped = 0;
for (const img of owners.values()) {
  const live = img.slots.filter((s) => s === img.rep || sameBytes(s, img.rep));
  const dead = img.slots.filter((s) => !live.includes(s));
  skipped += dead.length;
  jobs.push({ rep: img.rep, live, dead });
}

const totalLive = jobs.reduce((t, j) => t + j.live.length, 0);
console.log(`flip-list: ${flipList.paths.length} slot paths -> ${owners.size} distinct images (marked: ${flipList.marked})`);
console.log(`flipping ${jobs.length} images across ${totalLive} live slots; skipping ${skipped} reassigned slots`);
for (const j of jobs.filter((x) => x.dead.length)) {
  console.log(`  skip (reassigned since flip-list was built): ${j.dead.join(', ')}`);
}
if (orphans.length) console.log('  orphan paths (no owning image):', orphans);
if (owners.size !== flipList.marked) console.warn(`  WARN: resolved ${owners.size} images but list claims ${flipList.marked}`);

if (!APPLY) { console.log('\nDRY RUN — no files written. Re-run with --apply.'); process.exit(0); }

async function encodeFlipped(src) {
  // Read to a buffer first: we write the result back over this same path, and a lazy
  // sharp file handle keeps it open on Windows (EUNKNOWN -4094 on the subsequent write).
  const input = fs.readFileSync(path.join(repoRoot, src));
  for (const q of QUALITY_LADDER) {
    const buf = await sharp(input).flop().webp({ quality: q }).toBuffer();  // flop = horizontal mirror
    if (buf.length <= TARGET_BYTES) return { buf, q };
  }
  throw new Error(`cannot fit flipped ${src} under ${TARGET_BYTES}`);
}

let written = 0, maxBytes = 0;
for (const j of jobs) {
  const { buf } = await encodeFlipped(j.rep);
  maxBytes = Math.max(maxBytes, buf.length);
  for (const s of j.live) { fs.writeFileSync(path.join(repoRoot, s), buf); written++; }
}
console.log(`applied: ${jobs.length} images flipped -> ${written} slot files | largest ${maxBytes} bytes (budget ${MAX_BYTES})`);
