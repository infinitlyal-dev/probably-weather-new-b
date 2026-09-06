// Wire Al's hand-written lines for the bare photographs into the bespoke authoring file.
//
// He rejected all 30 of Astra's candidates for these photographs and wrote his own, supplied
// by description rather than filename. Each photograph was opened and matched before this
// script existed; the mapping lives in review/al-bare-photo-lines-2026-09-06.json under
// `matchedOn`, so the join is auditable rather than implied.
//
// Only ever ADDS, and only to photographs that currently carry nothing.
//
//   node scripts/wire-al-bare-photo-lines.mjs [--dry]
// then: node scripts/build-hero-lines.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DRY = process.argv.includes('--dry');

const src = JSON.parse(fs.readFileSync(path.join(ROOT, 'review/al-bare-photo-lines-2026-09-06.json'), 'utf8'));
const finalPath = path.join(ROOT, 'review/set-001-lines-bespoke-final.json');
const approved = JSON.parse(fs.readFileSync(finalPath, 'utf8'));
const draft = JSON.parse(fs.readFileSync(path.join(ROOT, 'review/set-001-draft.json'), 'utf8'));

const metaByImage = new Map();
for (const a of draft.assignments) {
  if (!metaByImage.has(a.image)) {
    metaByImage.set(a.image, {
      image: a.image, hash: a.hash, condition: a.condition, time: a.time,
      week: a.week, day: a.day, paths: [...new Set([a.image, ...(a.paths || [])])],
    });
  }
}

const bySet = new Map(approved.set.map((e) => [e.hash, e]));
let created = 0;
let lines = 0;
const collisions = [];

for (const entry of src.images) {
  const m = metaByImage.get(entry.image);
  if (!m) throw new Error(`not a set-001 photograph: ${entry.image}`);
  const existing = bySet.get(m.hash);
  if (existing && existing.lines.length) {
    // These were supposed to be bare. If one is not, stop rather than quietly append.
    collisions.push(`${entry.image} already carries ${existing.lines.length} line(s)`);
    continue;
  }
  const row = existing || { ...m, lines: [] };
  if (!existing) { approved.set.push(row); bySet.set(m.hash, row); created += 1; }
  row.lines.push(...entry.lines);
  row.source = 'al-2026-09-06';
  lines += entry.lines.length;
}

if (collisions.length) throw new Error(`expected bare photographs:\n  ${collisions.join('\n  ')}`);

approved.lineCount = approved.set.reduce((n, e) => n + e.lines.length, 0);
approved.note = (approved.note || '')
  + " | 2026-09-06: Al's own lines for 14 photographs that had none, written after he rejected"
  + " all 30 of Astra's candidates for them.";

if (!DRY) fs.writeFileSync(finalPath, JSON.stringify(approved, null, 1));

console.log(`${DRY ? '[dry] ' : ''}${created} photographs added, ${lines} lines written by Al`);
console.log(`  authoring file now ${approved.set.length} photographs / ${approved.lineCount} lines`);
for (const n of src.notCovered || []) console.log(`  STILL BARE: ${n.image} — ${n.why}`);
