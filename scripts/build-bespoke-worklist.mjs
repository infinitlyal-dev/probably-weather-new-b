// Build the remaining-photographs worklist for the bespoke line pass.
//
// Round 1 covered the 42 photographs from the 2026-08-18 reshoot (which includes
// the 15 replacements for Al's cuts). Everything else in set-001 still serves a
// condition-bank line. This lists what is left, per condition, with the context a
// line needs: the slot's time, week and day, and the pass-1 lines Al already
// approved on THAT slot, which are the only legitimate rescue candidates.
//
// REROLL GUARD, same as build-hero-lines.mjs. The authoring identity is the image
// bytes, not the slot path. If a slot's bytes have moved since the draft was
// exported, writing a joke about "the photograph at wind/week_1/day/3" would put
// the joke on a different picture — the exact defect Al caught on 2026-08-18. So
// every entry is hashed from disk and a mismatch is fatal, not a warning.
//
//   node scripts/build-bespoke-worklist.mjs
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const p = (f) => path.join(root, f);
const read = (f) => JSON.parse(readFileSync(p(f), 'utf8'));

const draft = read('review/set-001-draft.json');
const final = read('review/set-001-lines-bespoke-final.json');
const approvals = read('review/set-001-humour-approved.json');
const bank = read('review/tools/witty-lines.json');

// Approvals name lines as `witty:<bucket>#<index>`; the bank keys them
// `witty:<bucket>:<index>`. One map, both shapes.
const bankByRef = new Map();
for (const row of bank) bankByRef.set(`${row.tier}:${row.bucket}#${row.index}`, row);

const done = new Set((final.set || []).map((e) => e.hash));

const problems = [];
const byHash = new Map();
for (const a of draft.assignments) {
  if (done.has(a.hash)) continue;
  const file = path.join(root, 'assets', 'images', 'bg', ...a.image.split('/'));
  let actual;
  try {
    actual = createHash('sha1').update(readFileSync(file)).digest('hex').slice(0, 12);
  } catch {
    problems.push(`${a.image}: not on disk`);
    continue;
  }
  if (actual !== a.hash) {
    problems.push(`${a.image}: draft says ${a.hash}, disk holds ${actual} — re-export the draft before writing lines about it`);
    continue;
  }
  const slot = `${a.condition}|${a.time}|${a.week}|${a.day}`;
  const pass1 = (approvals.approved[slot] || []).map((ref) => {
    const row = bankByRef.get(ref);
    return row ? { ref, en: row.en, bin: row.bucket } : { ref, en: null, bin: null };
  }).filter((r) => r.en);

  if (byHash.has(a.hash)) {
    // One photograph in two slots: keep both slots' context, both sets of rescues.
    const e = byHash.get(a.hash);
    e.slots.push({ condition: a.condition, time: a.time, week: a.week, day: a.day });
    for (const r of pass1) if (!e.pass1.some((x) => x.ref === r.ref)) e.pass1.push(r);
    continue;
  }
  byHash.set(a.hash, {
    image: a.image,
    hash: a.hash,
    condition: a.condition,
    time: a.time,
    week: a.week,
    day: a.day,
    paths: [...new Set([a.image, ...(a.paths || [])])],
    slots: [{ condition: a.condition, time: a.time, week: a.week, day: a.day }],
    pass1,
  });
}

if (problems.length) {
  console.error('[worklist] refusing to generate:');
  for (const x of problems) console.error(`  - ${x}`);
  process.exit(1);
}

const all = [...byHash.values()];
const buckets = new Map();
for (const e of all) {
  if (!buckets.has(e.condition)) buckets.set(e.condition, []);
  buckets.get(e.condition).push(e);
}
// Al's order: wind first — it has been the weakest bucket in every pass — then
// the rest largest-first, so the biggest risk is written while the taste doc is
// freshest rather than last when it is being remembered rather than read.
const order = [...buckets.entries()].sort((a, b) => {
  if (a[0] === 'wind') return -1;
  if (b[0] === 'wind') return 1;
  return b[1].length - a[1].length || a[0].localeCompare(b[0]);
});

const out = {
  generated: '2026-08-19',
  note: 'Remaining set-001 photographs with no Al-approved bespoke line. Written from set-001-draft.json with every hash re-verified against the bytes on disk.',
  total: all.length,
  buckets: order.map(([condition, images]) => ({ condition, count: images.length })),
  images: order.flatMap(([, images]) => images.sort((a, b) => a.image.localeCompare(b.image))),
};
writeFileSync(p('review/bespoke-worklist-remaining.json'), JSON.stringify(out, null, 1));
console.log(`[worklist] ${all.length} photographs remaining`);
for (const [condition, images] of order) console.log(`  ${condition.padEnd(11)} ${images.length}`);
