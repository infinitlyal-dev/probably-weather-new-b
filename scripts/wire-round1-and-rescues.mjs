// Merge Al's round-1 hand-matched bank lines and his 156 rescued Astra lines into the
// bespoke authoring file (Al's instruction, 2026-09-06).
//
// His trim rule, verbatim: "Where a photo now exceeds 3 lines, keep round-1 lines first,
// then rescues in export order, trim the rest." That governs the set he was describing —
// round-1 plus rescues. It is applied here as: at most 3 lines PER PHOTO from these two
// sources, round-1 first, rescues in export order.
//
// Lines already approved and wired in earlier bespoke rounds are NOT touched, NOT counted
// against that 3, and NOT trimmed. 69 photographs already carry 5 approved lines each and
// 51 of them also take round-1 lines; reading the rule as a hard cap over the whole table
// would delete previously approved work, which is not what was asked. This script only ever
// ADDS, so the whole thing reverts with one `git revert`.
//
//   node scripts/wire-round1-and-rescues.mjs [--dry]
// then: node scripts/build-hero-lines.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DL = 'C:/Users/27741/Downloads';
const DRY = process.argv.includes('--dry');
const CAP = 3;
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().replace(/[\u2018\u2019]/g, "'").toLowerCase();

const finalPath = path.join(ROOT, 'review/set-001-lines-bespoke-final.json');
const approved = JSON.parse(fs.readFileSync(finalPath, 'utf8'));
const r1 = JSON.parse(fs.readFileSync(path.join(ROOT, 'review/set-001-line-matches-ruled.json'), 'utf8'));
const rescues = JSON.parse(fs.readFileSync(path.join(DL, 'astra-kill-rescues.json'), 'utf8')).rescued;
const draft = JSON.parse(fs.readFileSync(path.join(ROOT, 'review/set-001-draft.json'), 'utf8'));

const meta = new Map();
for (const a of draft.assignments) {
  if (!meta.has(a.hash)) {
    meta.set(a.hash, {
      image: a.image, hash: a.hash, condition: a.condition, time: a.time,
      week: a.week, day: a.day, paths: [...new Set([a.image, ...(a.paths || [])])],
    });
  }
}

// round-1 lines, in Al's own placement order
const round1 = new Map();
for (const d of r1.matchDetail) round1.set(d.hash, d.lines.map((l) => l.text));

// rescues, in export order
const rescued = new Map();
for (const r of rescues) {
  if (!rescued.has(r.hash)) rescued.set(r.hash, []);
  rescued.get(r.hash).push(r.text);
}

const bySet = new Map(approved.set.map((e) => [e.hash, e]));
const stats = { photosTouched: 0, created: 0, appended: 0, r1Wired: 0, rescWired: 0, rescTrimmed: 0, dupSkipped: 0, overThree: [] };

for (const hash of new Set([...round1.keys(), ...rescued.keys()])) {
  const m = meta.get(hash);
  if (!m) throw new Error(`hash not in set-001-draft.json: ${hash}`);

  const r1Lines = round1.get(hash) || [];
  const rsLines = rescued.get(hash) || [];
  const take = [...r1Lines];
  for (const line of rsLines) {
    if (take.length >= CAP) { stats.rescTrimmed += 1; continue; }
    take.push(line);
  }
  stats.r1Wired += Math.min(r1Lines.length, take.length);
  stats.rescWired += take.length - Math.min(r1Lines.length, take.length);

  let entry = bySet.get(hash);
  if (!entry) {
    entry = { ...m, lines: [] };
    bySet.set(hash, entry);
    approved.set.push(entry);
    stats.created += 1;
  } else {
    stats.appended += 1;
  }

  const seen = new Set(entry.lines.map(norm));
  for (const line of take) {
    if (seen.has(norm(line))) { stats.dupSkipped += 1; continue; }
    entry.lines.push(line);
    seen.add(norm(line));
  }
  stats.photosTouched += 1;
  if (entry.lines.length > CAP) stats.overThree.push({ image: entry.image, total: entry.lines.length });
}

approved.lineCount = approved.set.reduce((n, e) => n + e.lines.length, 0);
approved.note = (approved.note || '') + ' | 2026-09-06: round-1 hand-matched bank lines and 156 rescued '
  + 'Astra lines merged in, capped at 3 per photograph from those two sources (round-1 first, rescues in '
  + 'export order). Pre-existing approved lines were left untouched and not counted against that cap.';

if (!DRY) fs.writeFileSync(finalPath, JSON.stringify(approved, null, 1));

const dist = {};
for (const e of approved.set) dist[e.lines.length] = (dist[e.lines.length] || 0) + 1;

console.log(`${DRY ? '[dry] ' : ''}photographs touched ${stats.photosTouched} (${stats.created} new entries, ${stats.appended} appended)`);
console.log(`  round-1 lines wired ${stats.r1Wired} · rescues wired ${stats.rescWired} · rescues trimmed by the cap ${stats.rescTrimmed} · duplicates skipped ${stats.dupSkipped}`);
console.log(`  authoring file now ${approved.set.length} photographs / ${approved.lineCount} lines`);
console.log(`  per-photo line counts: ${JSON.stringify(dist)}`);
console.log(`  photographs over ${CAP} lines in total (pre-existing + new): ${stats.overThree.length}`);
