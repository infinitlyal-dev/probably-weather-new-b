// Assemble a v3 bespoke-lines source file from a worklist + authored batch files.
//
//   node review/tools/assemble-v3-bucket.mjs <bucket>
//
// Reads  review/tools/<bucket>-v3-worklist.json   (meta + alreadyKept + need)
//        review/tools/<bucket>-v3-batch*.json     (Valk's lines, per image)
// Writes review/set-001-lines-bespoke-<bucket>-v3.json
//
// Refuses to write when any worklist image is missing lines, has the wrong
// count (need), or a batch names an image not on the worklist — a line written
// for a photograph that is not in the set is the transposition defect again.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const bucket = process.argv[2];
if (!bucket) { console.error('usage: node review/tools/assemble-v3-bucket.mjs <bucket>'); process.exit(1); }

const toolsDir = path.join(root, 'review', 'tools');
const worklist = JSON.parse(readFileSync(path.join(toolsDir, `${bucket}-v3-worklist.json`), 'utf8'));
const batchFiles = readdirSync(toolsDir).filter((f) => f.startsWith(`${bucket}-v3-batch`) && f.endsWith('.json')).sort();

const authored = new Map();
for (const f of batchFiles) {
  const b = JSON.parse(readFileSync(path.join(toolsDir, f), 'utf8'));
  for (const im of b.images) {
    if (authored.has(im.image)) { console.error(`DUPLICATE authored image ${im.image} (${f})`); process.exit(1); }
    authored.set(im.image, im);
  }
}

const problems = [];
const images = [];
let idx = 0;
for (const w of worklist) {
  const a = authored.get(w.image);
  if (!a) { problems.push(`${w.image}: no authored lines in any batch`); continue; }
  if (a.lines.length !== w.need) problems.push(`${w.image}: ${a.lines.length} lines authored, worklist needs ${w.need}`);
  if (!a.rescue || a.rescue.length !== a.lines.length) problems.push(`${w.image}: rescue[] length mismatch`);
  idx += 1;
  images.push({
    index: idx,
    image: w.image, hash: w.hash, condition: w.condition, time: w.time,
    week: w.week, day: w.day, paths: w.paths,
    why: w.note || 'doctrine redo — weather-first rewrite',
    place: w.place || null, pass1: null,
    seen: a.seen || w.seen, note: w.alreadyKept.length ? `${w.alreadyKept.length} line(s) already kept by Al, locked below` : null,
    lines: a.lines, rescue: a.rescue,
    alreadyKept: w.alreadyKept,
  });
}
for (const img of authored.keys()) {
  if (!worklist.find((w) => w.image === img)) problems.push(`${img}: authored but not on the worklist`);
}
if (problems.length) { console.error('refusing to assemble:'); for (const p of problems) console.error('  - ' + p); process.exit(1); }

const out = {
  generated: '2026-08-21',
  writtenBy: 'Fable 5 (Valk), viewing each photograph',
  brief: 'Doctrine rewrite of 2026-08-21: every line is about the weather; the picture is the evidence. Three lines per photograph (Al’s ruled keeps locked and counted). Bank rescues marked. PAIRING-TASTE + the swap test still bind.',
  bucket, linesLabel: 'three per image incl. locked keeps',
  count: images.length,
  images,
};
const outPath = path.join(root, 'review', `set-001-lines-bespoke-${bucket}-v3.json`);
writeFileSync(outPath, JSON.stringify(out, null, 1));
const n = images.reduce((s, i) => s + i.lines.length, 0);
const k = images.reduce((s, i) => s + i.alreadyKept.length, 0);
console.log(`[assemble] ${outPath} — ${images.length} photographs, ${n} new lines, ${k} locked keeps`);
