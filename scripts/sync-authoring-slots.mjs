// Point the authoring file's slot annotations at the slots the photographs are
// actually in. Lines are never touched.
//
// review/set-001-lines-bespoke-final.json carries `image` and `paths` on each
// entry. They are annotation: assets/hero-lines.js paths by HASH through
// review/set-001-draft.json, which is the slot map. `99f7b2a` (2026-09-06) re-laid
// the whole grid and `69d6c54` (2026-09-16) rerolled one photograph, and neither
// updated those fields — so all 294 entries name a slot the photograph left.
//
// That is not cosmetic. On 2026-09-20 the provenance split read `image` as the
// slot, resolved `rain/week_2/day/5.webp` to a photograph that lives at
// `rain/week_2/day/3.webp`, and put three of Al's own lines in front of him
// labelled "no record". build-hero-lines.mjs now refuses to generate while the
// two disagree; this is what it tells you to run.
//
// PROVABLY INERT: the generated table is byte-identical afterwards, because it
// never read these fields. Verify with `node scripts/build-hero-lines.mjs --check`.
//
//   node scripts/sync-authoring-slots.mjs [--dry]
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const R = (...p) => path.join(root, 'review', ...p);
const DRY = process.argv.includes('--dry');

const authoring = JSON.parse(readFileSync(R('set-001-lines-bespoke-final.json'), 'utf8'));
const draft = JSON.parse(readFileSync(R('set-001-draft.json'), 'utf8'));
const slotsByHash = new Map(draft.assignments.map((a) => [a.hash, [...new Set([a.image, ...(a.paths || [])])]]));

let moved = 0;
const missing = [];
const sync = (entry) => {
  const cur = slotsByHash.get(entry.hash);
  if (!cur) { missing.push(entry.hash); return entry; }
  const own = [...new Set([entry.image, ...(entry.paths || [])])];
  if (own.length === cur.length && own.every((p) => cur.includes(p))) return entry;
  moved += 1;
  // `authoredFor` keeps the slot the lines were written against, so the record of
  // what Al was looking at survives the move.
  return { ...entry, image: cur[0], paths: cur, authoredFor: entry.authoredFor || own };
};

const out = {
  ...authoring,
  set: (authoring.set || []).map(sync),
  ...(authoring.awaitingLines ? { awaitingLines: authoring.awaitingLines.map(sync) } : {}),
};

const total = (authoring.set || []).length + (authoring.awaitingLines || []).length;
console.log(`[slots] ${moved} of ${total} entr${total === 1 ? 'y' : 'ies'} re-pointed at their current slot; ${total - moved} already agreed`);
if (missing.length) console.log(`[slots] ${missing.length} hash(es) absent from set-001-draft.json, left alone: ${missing.join(', ')}`);
if (DRY) { console.log('[slots] --dry: nothing written'); process.exit(0); }
writeFileSync(R('set-001-lines-bespoke-final.json'), JSON.stringify(out, null, 1));
console.log('[slots] wrote review/set-001-lines-bespoke-final.json — run build-hero-lines.mjs --check to confirm the table is unchanged');
