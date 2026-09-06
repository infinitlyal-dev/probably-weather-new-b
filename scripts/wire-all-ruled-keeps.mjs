// Al's rulings of 2026-09-06 (afternoon), applied to the bespoke authoring file:
//
//   1. No 3-line cap. Every approved line stays; the 30 rescued Astra lines that the cap
//      dropped (scripts/wire-round1-and-rescues.mjs) are restored to their photographs.
//   2. Every ruled keep that was sitting unplaced in the round-2 match pool — clear-v3,
//      cloudy-v3, the six Astra buckets and the gated test batch — is wired onto its OWN
//      photograph, by hash, no matching.
//   3. The transposed wind pair: the two photographs swap grid days (tue <-> wed) in
//      set-001-draft.json, so "Wednesday morning, and the walk from the parking…" lands
//      on Wednesday and "Tuesday is bin day…" on Tuesday, with the wording he approved
//      untouched. scripts/layout-set-001-grid.mjs moves the bytes.
//
// Only ever ADDS lines (and relabels two grid days). Reverts with one `git revert`.
//
//   node scripts/wire-all-ruled-keeps.mjs [--dry]
// then: node scripts/layout-set-001-grid.mjs && node scripts/build-hero-lines.mjs
//       && node scripts/build-hero-crop-offsets.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DL = 'C:/Users/27741/Downloads';
const DRY = process.argv.includes('--dry');
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().replace(/[\u2018\u2019]/g, "'").toLowerCase();
const rd = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

const finalPath = path.join(ROOT, 'review/set-001-lines-bespoke-final.json');
const draftPath = path.join(ROOT, 'review/set-001-draft.json');
const approved = rd(finalPath);
const draft = rd(draftPath);

const POOL = [
  'set-001-lines-bespoke-clear-v3-ruled.json',
  'set-001-lines-bespoke-cloudy-v3-ruled.json',
  'set-001-lines-bespoke-cold-clear-v3-astra-ruled.json',
  'set-001-lines-bespoke-cold-v3-astra-ruled.json',
  'set-001-lines-bespoke-fog-v3-astra-ruled.json',
  'set-001-lines-bespoke-heat-v3-astra-ruled.json',
  'set-001-lines-bespoke-rain-v3-astra-ruled.json',
  'set-001-lines-bespoke-storm-v3-astra-ruled.json',
  'set-001-humour-test-batch-ruled.json',
];

const meta = new Map();
for (const a of draft.assignments) if (!meta.has(a.hash)) meta.set(a.hash, a);
const bySet = new Map(approved.set.map((e) => [e.hash, e]));

const stats = { rescuesRestored: 0, poolWired: 0, dupSkipped: 0, created: 0, perFile: {} };
const addLine = (hash, text, label) => {
  const m = meta.get(hash);
  if (!m) throw new Error(`${label}: hash ${hash} is not a set-001 photograph`);
  let entry = bySet.get(hash);
  if (!entry) {
    entry = { image: m.image, hash, condition: m.condition, time: m.time, week: m.week, day: m.day, paths: m.paths, lines: [] };
    approved.set.push(entry); bySet.set(hash, entry); stats.created += 1;
  }
  if (entry.lines.some((l) => norm(l) === norm(text))) { stats.dupSkipped += 1; return false; }
  entry.lines.push(text);
  return true;
};

// 1. Restore every rescue the cap dropped.
for (const r of rd(`${DL}/astra-kill-rescues.json`).rescued) {
  if (addLine(r.hash, r.text, 'rescue')) stats.rescuesRestored += 1;
}

// 2. Wire every ruled keep in the pool onto its own photograph.
for (const f of POOL) {
  const doc = rd(path.join(ROOT, 'review', f));
  let n = 0;
  for (const img of doc.images) for (const k of img.kept || []) if (addLine(img.hash, k.text, f)) n += 1;
  stats.perFile[f] = n;
  stats.poolWired += n;
}

// 3. The transposed wind pair swap grid days.
const A = draft.assignments.find((a) => a.lines === undefined && a.hash === '9bada961b0a7'); // bins: "Tuesday is bin day…" (was wed)
const B = draft.assignments.find((a) => a.hash !== '9bada961b0a7' && a.condition === 'wind' && a.time === 'day'
  && (bySet.get(a.hash)?.lines || []).some((l) => /^Wednesday morning, and the walk from the parking/.test(l)));
if (!A || !B) throw new Error('could not find both photographs of the transposed wind pair');
if (!(A.day === 'wed' && B.day === 'tue' && A.week === B.week)) {
  throw new Error(`unexpected grid days for the wind pair: ${A.image}=${A.week}/${A.day}, ${B.image}=${B.week}/${B.day}`);
}
A.day = 'tue'; B.day = 'wed';
for (const h of [A.hash, B.hash]) { const e = bySet.get(h); if (e) e.day = meta.get(h).day; }

approved.lineCount = approved.set.reduce((n, e) => n + e.lines.length, 0);
approved.note = (approved.note || '') + " | 2026-09-06 (pm): Al's rulings — no 3-line cap: the 30 rescues the cap dropped are restored;"
  + ' every ruled keep from clear-v3, cloudy-v3, the six Astra buckets and the test batch wired onto its own photograph by hash;'
  + ' the transposed wind pair swapped grid days (tue/wed) so each day-named line lands on its day.';
draft.note = `${draft.note} | 2026-09-06 (pm): wind pair ${A.hash} -> tue and ${B.hash} -> wed (Al's swap ruling).`;

if (!DRY) {
  fs.writeFileSync(finalPath, JSON.stringify(approved, null, 1));
  fs.writeFileSync(draftPath, JSON.stringify(draft, null, 1));
}
const dist = {};
for (const e of approved.set) dist[e.lines.length] = (dist[e.lines.length] || 0) + 1;
console.log(`${DRY ? '[dry] ' : ''}rescues restored ${stats.rescuesRestored} · pool keeps wired ${stats.poolWired} · duplicates skipped ${stats.dupSkipped} · new entries ${stats.created}`);
for (const [f, n] of Object.entries(stats.perFile)) console.log(`   ${n.toString().padStart(4)}  ${f}`);
console.log(`  wind pair: ${A.image} (${A.hash}) -> ${A.day}, ${B.image} (${B.hash}) -> ${B.day}`);
console.log(`  authoring file now ${approved.set.length} photographs / ${approved.lineCount} lines; per-photo: ${JSON.stringify(dist)}`);
