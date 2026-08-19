// Expand Al's approved bespoke lines into the runtime lookup table.
//
// AUTHORING key is the image hash — the stable identity of the bytes. One hash
// can occupy several rotation slots and must carry the same lines in all of
// them, because the lines were written about the photograph.
// RUNTIME keys are BOTH shapes the picker can emit, for the same reason
// build-hero-crop-offsets.mjs emits both:
//   source tree / preview  ->  bg/<condition>/week_N/<time>/<n>.webp
//   production             ->  bg-canonical/<sha256 of the bytes>.webp
//
// Reads  review/set-001-lines-bespoke-final.json  (hash -> approved lines)
//        review/set-001-draft.json                (hash -> every slot path)
// Writes assets/hero-lines.js between its generated markers.
//
// Deliberately NOT wired into `npm run build`, exactly as the crop table is not:
// lines ship when Al has ruled on them, not when someone runs a build.
//
//   node scripts/build-hero-lines.mjs [--check]
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const CHECK = process.argv.includes('--check');

const approved = JSON.parse(readFileSync(path.join(root, 'review', 'set-001-lines-bespoke-final.json'), 'utf8'));
const draft = JSON.parse(readFileSync(path.join(root, 'review', 'set-001-draft.json'), 'utf8'));

const pathsByHash = new Map();
for (const a of draft.assignments) {
  pathsByHash.set(a.hash, [...new Set([a.image, ...(a.paths || [])])]);
}

const rows = [];
const problems = [];
for (const entry of approved.set || []) {
  const { hash, lines } = entry;
  if (!Array.isArray(lines) || !lines.length) { problems.push(`${hash}: no approved lines`); continue; }
  for (const line of lines) {
    if (typeof line !== 'string' || !line.trim()) { problems.push(`${hash}: an empty line`); break; }
  }
  const paths = pathsByHash.get(hash);
  if (!paths) { problems.push(`${hash} (${entry.image}): not present in set-001-draft.json`); continue; }

  for (const p of paths) {
    let bytes;
    try { bytes = readFileSync(path.join(root, 'assets', 'images', 'bg', ...p.split('/'))); }
    catch { problems.push(`${hash}: slot ${p} is not on disk`); continue; }

    // REROLL GUARD, and it matters more here than it does for a crop. A crop
    // ruled about one photograph and applied to another is an ugly frame; a
    // JOKE written about one photograph and applied to another is the exact
    // failure that made Al reject ten lines on 2026-08-18, when two briefs were
    // transposed and bin-day lines landed on a man in a suit. Recomputing the
    // authoring hash from the bytes on disk makes that loud instead of funny.
    const actual = createHash('sha1').update(bytes).digest('hex').slice(0, 12);
    if (actual !== hash) {
      problems.push(`${hash}: slot ${p} now holds different bytes (sha1-12 ${actual}) — these lines were written about another photograph; re-review them`);
      continue;
    }

    rows.push([`bg/${p}`, lines]);
    rows.push([`bg-canonical/${createHash('sha256').update(bytes).digest('hex')}.webp`, lines]);
  }
}

if (problems.length) {
  console.error('[hero-lines] refusing to generate:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

// One hash occupies several slots that share bytes, so the canonical key is
// emitted once per slot and de-duplicated. Two DIFFERENT line sets on one key
// would be two rulings disagreeing about one photograph — surface it.
const seen = new Map();
const conflicts = [];
for (const [k, lines] of rows) {
  const prev = seen.get(k);
  if (prev && JSON.stringify(prev) !== JSON.stringify(lines)) {
    conflicts.push(`${k}: two different line sets for the same photograph`);
  }
  seen.set(k, lines);
}
if (conflicts.length) {
  console.error('[hero-lines] refusing to generate:');
  for (const c of conflicts) console.error(`  - ${c}`);
  process.exit(1);
}

const keys = [...seen.keys()].sort((a, b) => a.localeCompare(b));
const body = keys.length
  ? keys.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(seen.get(k))},`).join('\n')
  : '  // (none approved yet)';
const generated = `  // __HERO_LINES__  (generated — do not hand-edit)\n${body}`;

const modulePath = path.join(root, 'assets', 'hero-lines.js');
const src = readFileSync(modulePath, 'utf8');
const BLOCK = /( *\/\/ __HERO_LINES__[^\n]*\n?)(?:[^}]*)/;
if (!BLOCK.test(src)) {
  console.error('[hero-lines] could not find the generated block marker in assets/hero-lines.js');
  process.exit(1);
}
const next = src.replace(BLOCK, `${generated}\n`);

const nLines = [...seen.values()].reduce((n, l) => n + l.length, 0);
if (CHECK) {
  if (next !== src) {
    console.error('[hero-lines] assets/hero-lines.js is out of sync with review/set-001-lines-bespoke-final.json');
    process.exit(1);
  }
  console.log(`[hero-lines] in sync — ${keys.length} keys, ${nLines} line slots, from ${(approved.set || []).length} photographs.`);
} else {
  writeFileSync(modulePath, next, 'utf8');
  console.log(`[hero-lines] wrote ${keys.length} keys (${nLines} line slots) from ${(approved.set || []).length} photographs into assets/hero-lines.js`);
}
