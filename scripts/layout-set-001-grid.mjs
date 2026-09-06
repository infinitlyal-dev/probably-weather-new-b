// Lay the set-001 curation grid out on disk — the photograph at its curated weekday and week.
//
// Al curated set-001 in review/curation-tool.html onto a 14-position grid per bucket:
// Week A Mon–Sun and Week B Mon–Sun. The export (review/set-001-draft.json) records that
// position as `week: A|B` and `day: mon..sun` against each photograph's HASH. The bytes,
// however, stayed wherever the pre-curation pool had them: only 40 of 294 photographs sat
// at the slot index matching their curated day, which is chance (1 in 7). The humour was
// then written to the grid — "Monday, and…" on the mon photograph, braai on sat/sun —
// so with the picker now serving index = SAST weekday (assets/image-picker.js), the grid
// has to be true on disk or the Monday photograph fires on Friday every week.
//
// Layout rule (Al's design):
//   week A -> week_1 and week_3 folders      week B -> week_2 and week_4 folders
//   day    -> slot index, Monday = 1 … Sunday = 7
//
// The grid is 294 of 504 positions filled. Every empty position has its SAME DAY filled in
// the other week letter (measured: 210 empty, 0 with both weeks empty), so an empty position
// takes that same-day photograph — its day-named and weekend lines stay true. That replaces
// the 2026-09-06 fill (scripts/fill-uncurated-slots.mjs), which copied by condition and time
// only, because it was written for a picker that chose the index at random.
//
// Bytes are read for every photograph BEFORE anything is written, and every write is
// verified back by hash, so a half-finished run cannot leave a slot holding the wrong
// photograph silently. set-001-draft.json is rewritten so `image` and `paths` again name
// the slots that hold each photograph's bytes; the old canonical path is kept as
// `previousImage` so joins keyed on the old path stay auditable.
//
//   node scripts/layout-set-001-grid.mjs [--dry]
// then: node scripts/build-hero-lines.mjs && node scripts/build-hero-crop-offsets.mjs
// Undo: git checkout -- assets/images/bg review/set-001-draft.json
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const BG = path.join(ROOT, 'assets/images/bg');
const DRY = process.argv.includes('--dry');
const CONDITIONS = ['clear', 'cloudy', 'cold', 'cold-clear', 'fog', 'heat', 'rain', 'storm', 'wind'];
const TIMES = ['dawn', 'day', 'dusk', 'night'];
const DAY_INDEX = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7 };
const WEEK_FOLDERS = { A: [1, 3], B: [2, 4] };
const sha1 = (b) => createHash('sha1').update(b).digest('hex').slice(0, 12);

const draftPath = path.join(ROOT, 'review/set-001-draft.json');
const draft = JSON.parse(fs.readFileSync(draftPath, 'utf8'));

// 1. Read every photograph's bytes from its current canonical path and prove the hash.
const bytesByHash = new Map();
const grid = new Map(); // condition|time|letter|day -> assignment
for (const a of draft.assignments) {
  if (!DAY_INDEX[a.day] || !WEEK_FOLDERS[a.week]) throw new Error(`${a.hash}: unusable grid position ${a.week}/${a.day}`);
  const key = `${a.condition}|${a.time}|${a.week}|${a.day}`;
  if (grid.has(key)) throw new Error(`grid position ${key} is claimed twice`);
  grid.set(key, a);
  if (bytesByHash.has(a.hash)) throw new Error(`${a.hash} appears in two grid positions`);
  const bytes = fs.readFileSync(path.join(BG, a.image));
  if (sha1(bytes) !== a.hash) throw new Error(`${a.image} no longer holds ${a.hash} (found ${sha1(bytes)})`);
  bytesByHash.set(a.hash, bytes);
}

// 2. Resolve all 504 grid positions; an empty one borrows the same day from the other week.
const plan = []; // { rel, hash, borrowed }
const slotsByHash = new Map();
let borrowed = 0;
for (const condition of CONDITIONS) {
  for (const time of TIMES) {
    for (const letter of ['A', 'B']) {
      for (const [day, index] of Object.entries(DAY_INDEX)) {
        const own = grid.get(`${condition}|${time}|${letter}|${day}`);
        const other = grid.get(`${condition}|${time}|${letter === 'A' ? 'B' : 'A'}|${day}`);
        const a = own || other;
        if (!a) throw new Error(`${condition}/${time} ${day}: neither week has a photograph for this day`);
        if (!own) borrowed += 1;
        for (const week of WEEK_FOLDERS[letter]) {
          const rel = `${condition}/week_${week}/${time}/${index}.webp`;
          plan.push({ rel, hash: a.hash, borrowed: !own });
          if (!slotsByHash.has(a.hash)) slotsByHash.set(a.hash, []);
          slotsByHash.get(a.hash).push(rel);
        }
      }
    }
  }
}
if (plan.length !== 1008) throw new Error(`planned ${plan.length} slots, expected 1008`);

// 3. Write only the slots whose bytes differ, and verify each write back.
let moved = 0;
let unchanged = 0;
for (const { rel, hash } of plan) {
  const file = path.join(BG, rel);
  let current = null;
  try { current = sha1(fs.readFileSync(file)); } catch { /* slot missing — will be written */ }
  if (current === hash) { unchanged += 1; continue; }
  moved += 1;
  if (DRY) continue;
  fs.writeFileSync(file, bytesByHash.get(hash));
  if (sha1(fs.readFileSync(file)) !== hash) throw new Error(`${rel}: write verification failed`);
}

// 4. Rewrite the draft so image/paths name the slots that now hold each photograph.
const weekOrder = (rel) => Number(rel.match(/week_(\d)/)[1]);
for (const a of draft.assignments) {
  const paths = [...new Set(slotsByHash.get(a.hash))].sort((x, y) => weekOrder(x) - weekOrder(y) || x.localeCompare(y));
  if (a.image !== paths[0]) a.previousImage = a.previousImage || a.image;
  a.image = paths[0];
  a.paths = paths;
}
draft.note = `${draft.note} | ${new Date().toISOString().slice(0, 10)}: grid laid out on disk by scripts/layout-set-001-grid.mjs — `
  + 'week A = week_1+week_3, week B = week_2+week_4, day = slot index (Mon=1..Sun=7); an empty grid position takes the '
  + 'same-day photograph from the other week. `image` and `paths` name the slots holding each photograph; `previousImage` '
  + 'is the pre-layout canonical path.';
if (!DRY) fs.writeFileSync(draftPath, JSON.stringify(draft, null, 1));

// 5. Prove the result: 1008 slots on disk, 294 unique photographs, every one at its curated day.
if (!DRY) {
  const seen = new Set();
  let wrongDay = 0;
  for (const { rel, hash } of plan) {
    const actual = sha1(fs.readFileSync(path.join(BG, rel)));
    if (actual !== hash) throw new Error(`${rel}: holds ${actual}, planned ${hash}`);
    seen.add(actual);
  }
  for (const a of draft.assignments) {
    for (const p of a.paths) {
      const m = p.match(/week_(\d)\/\w+\/(\d)\.webp$/);
      if (Number(m[2]) !== DAY_INDEX[a.day] || !WEEK_FOLDERS[a.week].includes(Number(m[1]))) {
        // Borrowed positions legitimately sit in the other week's folders, but always on their own day.
        if (Number(m[2]) !== DAY_INDEX[a.day]) wrongDay += 1;
      }
    }
  }
  if (seen.size !== 294) throw new Error(`${seen.size} unique photographs on disk after layout, expected 294`);
  if (wrongDay) throw new Error(`${wrongDay} slot paths sit on a different weekday from their photograph's curated day`);
}

console.log(`${DRY ? '[dry] ' : ''}${plan.length} slots planned: ${moved} rewritten, ${unchanged} already held the right photograph`);
console.log(`  ${borrowed} empty grid positions took the same-day photograph from the other week (x2 folders each)`);
console.log(`  ${draft.assignments.length} photographs now occupy ${[...slotsByHash.values()].reduce((n, s) => n + s.length, 0)} slots; per-photograph: ${JSON.stringify([...slotsByHash.values()].reduce((d, s) => ((d[s.length] = (d[s.length] || 0) + 1), d), {}))}`);
