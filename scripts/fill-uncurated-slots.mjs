// Make the app serve ONLY set-001 (Al's ruling, 2026-09-06).
//
// The shipped library is 1008 slot paths holding 644 unique photographs. set-001 curated 294
// of them. The other 350 occupy 532 slots, and every one of those slots falls back to a
// condition-bank line because no line was ever written about an uncurated photograph.
//
// Al's ruling: rather than write for photographs he never picked, those slots take a COPY of
// a curated photograph from the same condition and time-of-day. A good photograph repeating
// beats an uncurated one appearing. set-002 will later drop new curated photographs into
// these repeated slots.
//
// NOTE ON THE COUNT: Al said 210, which is the unfilled positions in set-001-draft.json's
// own curation grid (9 conditions x 4 times x 2 weeks x 7 days = 504, of which 294 are
// filled). The app does not serve that grid — it serves week_1..week_4 folders, 1008 paths.
// 210 empty curation positions plus the 112 mirror slots of photographs that only ever
// occupied one of their two positions come to the 532 real slots fixed here. His acceptance
// test — zero bank fallbacks — needs all 532.
//
// Assignment spreads each photograph across the four week folders before repeating inside
// one, so a single week's seven-image rotation stays as varied as the pool allows.
//
//   node scripts/fill-uncurated-slots.mjs [--dry]
// Undo: git checkout -- assets/images/bg review/set-001-draft.json
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const BG = path.join(ROOT, 'assets/images/bg');
const DRY = process.argv.includes('--dry');
const CONDITIONS = ['clear', 'cloudy', 'cold', 'cold-clear', 'fog', 'heat', 'rain', 'storm', 'wind'];
const TIMES = ['dawn', 'day', 'dusk', 'night'];
const WEEKS = [1, 2, 3, 4];
const INDICES = [1, 2, 3, 4, 5, 6, 7];
const sha1 = (b) => createHash('sha1').update(b).digest('hex').slice(0, 12);

const draftPath = path.join(ROOT, 'review/set-001-draft.json');
const draft = JSON.parse(fs.readFileSync(draftPath, 'utf8'));
const curated = new Map();          // hash -> assignment
for (const a of draft.assignments) if (!curated.has(a.hash)) curated.set(a.hash, a);

// Every slot on disk, with the photograph it currently holds.
const slots = [];
for (const condition of CONDITIONS) {
  for (const week of WEEKS) {
    for (const time of TIMES) {
      for (const i of INDICES) {
        const rel = `${condition}/week_${week}/${time}/${i}.webp`;
        const file = path.join(BG, rel);
        if (!fs.existsSync(file)) continue;
        slots.push({ rel, condition, week, time, index: i, hash: sha1(fs.readFileSync(file)) });
      }
    }
  }
}

const bucketOf = (s) => `${s.condition}|${s.time}`;
const pools = new Map();            // bucket -> [hash]
for (const a of curated.values()) {
  const k = `${a.condition}|${a.time}`;
  if (!pools.has(k)) pools.set(k, []);
  if (!pools.get(k).includes(a.hash)) pools.get(k).push(a.hash);
}
for (const list of pools.values()) list.sort();

// Where each curated photograph already sits, per week, so the fill can avoid doubling up
// inside one week folder before it has used every photograph in that week.
const usage = new Map();            // hash -> count of slots it occupies
const inWeek = new Map();           // "bucket|week" -> Set(hash)
for (const s of slots) {
  if (!curated.has(s.hash)) continue;
  usage.set(s.hash, (usage.get(s.hash) || 0) + 1);
  const k = `${bucketOf(s)}|${s.week}`;
  if (!inWeek.has(k)) inWeek.set(k, new Set());
  inWeek.get(k).add(s.hash);
}

const canonicalFile = (hash) => {
  const a = curated.get(hash);
  return path.join(BG, ...a.image.split('/'));
};

const plan = [];
const noPool = [];
for (const s of slots.filter((x) => !curated.has(x.hash))) {
  const bucket = bucketOf(s);
  const pool = pools.get(bucket) || [];
  if (!pool.length) { noPool.push(s.rel); continue; }
  const weekKey = `${bucket}|${s.week}`;
  if (!inWeek.has(weekKey)) inWeek.set(weekKey, new Set());
  const here = inWeek.get(weekKey);

  const fresh = pool.filter((h) => !here.has(h));
  const choices = fresh.length ? fresh : pool;
  choices.sort((a, b) => (usage.get(a) || 0) - (usage.get(b) || 0) || a.localeCompare(b));
  const pick = choices[0];

  usage.set(pick, (usage.get(pick) || 0) + 1);
  here.add(pick);
  plan.push({ rel: s.rel, from: curated.get(pick).image, hash: pick, replaced: s.hash });
}

if (noPool.length) throw new Error(`no curated photograph to copy for:\n  ${noPool.join('\n  ')}`);

if (!DRY) {
  const pathsByHash = new Map();
  for (const a of draft.assignments) {
    if (!pathsByHash.has(a.hash)) pathsByHash.set(a.hash, a);
  }
  for (const step of plan) {
    fs.copyFileSync(canonicalFile(step.hash), path.join(BG, ...step.rel.split('/')));
    // The draft's `paths` is "every duplicate file with those bytes" — it is what
    // build-hero-lines and build-hero-crop-offsets expand a photograph's lines and anchors
    // across. A copied slot that is not listed here would ship without its own line.
    for (const a of draft.assignments) {
      if (a.hash !== step.hash) continue;
      if (!a.paths) a.paths = [a.image];
      if (!a.paths.includes(step.rel)) a.paths.push(step.rel);
    }
  }
  for (const a of draft.assignments) if (a.paths) a.paths.sort();
  draft.note = (draft.note || '')
    + ' | 2026-09-06: 532 uncurated slots overwritten with copies of curated photographs from the'
    + ' same condition and time-of-day, so the app serves set-001 only. `paths` now includes those'
    + ' copies. set-002 replaces them with new curated photographs.';
  fs.writeFileSync(draftPath, JSON.stringify(draft, null, 1));
}

const perBucket = {};
for (const step of plan) {
  const b = step.rel.split('/')[0];
  perBucket[b] = (perBucket[b] || 0) + 1;
}
const repeats = {};
for (const [, n] of usage) repeats[n] = (repeats[n] || 0) + 1;

console.log(`${DRY ? '[dry] ' : ''}${plan.length} slots filled from ${curated.size} curated photographs`);
console.log(`  per condition: ${JSON.stringify(perBucket)}`);
console.log(`  slots per photograph after the fill: ${JSON.stringify(repeats)}`);
console.log(`  undo: git checkout -- assets/images/bg review/set-001-draft.json`);
