// Join a bucket's written lines to its worklist metadata and emit the review
// tool's source file.
//
// The line fragments carry only what was written while looking at the picture —
// the image path, what is in the frame, and the five lines. Everything else
// (hash, slot, day, week, every duplicate path) comes from the worklist, so a
// typo in a path is a hard failure here rather than a joke on the wrong
// photograph later. Same reason build-hero-lines.mjs re-hashes the bytes.
//
//   node scripts/assemble-bespoke-bucket.mjs <condition> <fragment.json...>
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const p = (f) => path.join(root, f);

const [condition, ...fragments] = process.argv.slice(2);
if (!condition || !fragments.length) {
  console.error('usage: node scripts/assemble-bespoke-bucket.mjs <condition> <fragment.json...>');
  process.exit(2);
}

const worklist = JSON.parse(readFileSync(p('review/bespoke-worklist-remaining.json'), 'utf8'));
const wanted = new Map(worklist.images.filter((i) => i.condition === condition).map((i) => [i.image, i]));

const written = [];
for (const f of fragments) for (const e of JSON.parse(readFileSync(f, 'utf8'))) written.push(e);

const problems = [];
const seenImages = new Set();
const images = [];
for (const e of written) {
  const meta = wanted.get(e.image);
  if (!meta) { problems.push(`${e.image}: not in the ${condition} worklist`); continue; }
  if (seenImages.has(e.image)) { problems.push(`${e.image}: written twice`); continue; }
  seenImages.add(e.image);
  if (!Array.isArray(e.lines) || e.lines.length !== 5) {
    problems.push(`${e.image}: ${e.lines ? e.lines.length : 0} lines, expected 5`);
    continue;
  }
  images.push({
    index: images.length + 1,
    image: meta.image,
    hash: meta.hash,
    condition: meta.condition,
    time: meta.time,
    week: meta.week,
    day: meta.day,
    paths: meta.paths,
    why: 'no bespoke line yet — served the condition bank',
    place: null,
    pass1: meta.pass1.length ? `${meta.pass1.length} bank lines approved on this slot` : null,
    seen: e.seen,
    note: e.note || null,
    lines: e.lines.map((l) => l.text),
    // Parallel to `lines`: the bank reference for a rescued line, null for an
    // original. The review page badges these so a tick on a rescue is a knowing
    // one — Al has already approved most of them somewhere else.
    rescue: e.lines.map((l) => l.rescue || null),
  });
}
for (const img of wanted.keys()) if (!seenImages.has(img)) problems.push(`${img}: no lines written`);

if (problems.length) {
  console.error(`[assemble ${condition}] refusing to write:`);
  for (const x of problems) console.error(`  - ${x}`);
  process.exit(1);
}

const out = {
  generated: '2026-08-19',
  writtenBy: 'Opus 5 (Baken), viewing each photograph',
  brief: 'review/PAIRING-TASTE.md as instruction; five EN lines per image written for that picture. A line marked RESCUE is from the existing bank rather than newly written.',
  bucket: condition,
  count: images.length,
  images,
};
const file = `review/set-001-lines-bespoke-${condition}.json`;
writeFileSync(p(file), JSON.stringify(out, null, 1));
const rescues = images.reduce((n, i) => n + i.rescue.filter(Boolean).length, 0);
console.log(`[assemble ${condition}] ${file} — ${images.length} photographs, ${images.length * 5} lines, ${rescues} rescued from the bank`);
