// M7 — expand the hash-keyed crop-offset ruling into the runtime lookup table.
//
// AUTHORING key is the image hash (stable identity of the bytes; one hash can
// occupy several rotation slots and must crop the same way in all of them).
// RUNTIME keys are BOTH shapes the picker can emit, because they differ by
// environment and getting this wrong ships a mechanism that does nothing:
//   source tree / preview  ->  bg/<condition>/week_N/<time>/<n>.webp
//   production             ->  bg-canonical/<sha256 of the bytes>.webp
//
// Reads  review/set-001-crop-offsets.json  { hash: { cropY, verdict, reason } }
//        review/set-001-draft.json         (hash -> every slot path)
// Writes assets/hero-crop.js between its generated markers.
//
// Nothing runs this automatically. It is deliberately NOT wired into
// `npm run build`: the offsets ship when Al rules on them, not when someone
// happens to run a build.
//
//   node scripts/build-hero-crop-offsets.mjs [--check]
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const CHECK = process.argv.includes('--check');

// The live default, read from the ONE place it is declared. Hard-coding 78 here
// would be a second home for it, and moving the CSS would silently leave this
// rejecting the wrong value.
const css = readFileSync(path.join(root, 'assets', 'app.css'), 'utf8');
const defaultMatch = /var\(--hero-crop,\s*([\d.]+)%\)/.exec(css);
if (!defaultMatch) {
  console.error('[hero-crop] could not read the --hero-crop default out of assets/app.css');
  process.exit(1);
}
const CSS_DEFAULT = Number(defaultMatch[1]);

const offsets = JSON.parse(readFileSync(path.join(root, 'review', 'set-001-crop-offsets.json'), 'utf8'));
const draft = JSON.parse(readFileSync(path.join(root, 'review', 'set-001-draft.json'), 'utf8'));

const pathsByHash = new Map();
for (const a of draft.assignments) {
  pathsByHash.set(a.hash, [...new Set([a.image, ...(a.paths || [])])]);
}

const rows = [];
const problems = [];
for (const [hash, entry] of Object.entries(offsets.offsets || {})) {
  const paths = pathsByHash.get(hash);
  if (!paths) { problems.push(`${hash}: not present in set-001-draft.json`); continue; }
  const y = entry.cropY;
  if (y === null || y === undefined) continue; // authored but not yet ruled
  if (typeof y !== 'number' || !Number.isFinite(y) || y < 0 || y > 100) {
    problems.push(`${hash}: cropY ${JSON.stringify(y)} is not a percentage`);
    continue;
  }
  // The CSS default written explicitly would be a no-op entry pinning the
  // default in a second place — if it ever moves, these would keep the old one.
  if (y === CSS_DEFAULT) { problems.push(`${hash}: cropY ${y} is the CSS default — drop the entry instead`); continue; }

  for (const p of paths) {
    let bytes;
    try { bytes = readFileSync(path.join(root, 'assets', 'images', 'bg', ...p.split('/'))); }
    catch { problems.push(`${hash}: slot ${p} is not on disk`); continue; }

    // REROLL GUARD. The ruling was made about a photograph, and the draft
    // records that photograph's hash. Slots get rerolled in this repo, so a
    // ruling flattened onto a slot path can end up cropping a DIFFERENT image.
    // Recomputing the authoring hash from current bytes turns that into a loud
    // failure instead of a silent mis-crop.
    const actual = createHash('sha1').update(bytes).digest('hex').slice(0, 12);
    if (actual !== hash) {
      problems.push(`${hash}: slot ${p} now holds different bytes (sha1-12 ${actual}) — the ruling was made about another image; re-review it`);
      continue;
    }

    // BOTH key shapes, because the picker emits different ones per environment:
    // the slot path in the previewable source tree, and the content-addressed
    // canonical name in production (scripts/image-slot-manifest.mjs).
    rows.push([`bg/${p}`, y]);
    rows.push([`bg-canonical/${createHash('sha256').update(bytes).digest('hex')}.webp`, y]);
  }
}

if (problems.length) {
  console.error('[hero-crop] refusing to generate:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

// One hash can occupy several slots that share the same bytes, so the canonical
// key is emitted once per slot and must be de-duplicated. Two DIFFERENT offsets
// landing on one key would mean two rulings disagreeing about one photograph —
// that is a contradiction to surface, not to silently resolve by last-write.
const seen = new Map();
const conflicts = [];
for (const [k, y] of rows) {
  if (seen.has(k) && seen.get(k) !== y) {
    conflicts.push(`${k}: two different offsets (${seen.get(k)} and ${y}) for the same image`);
  }
  seen.set(k, y);
}
if (conflicts.length) {
  console.error('[hero-crop] refusing to generate:');
  for (const c of conflicts) console.error(`  - ${c}`);
  process.exit(1);
}
rows.length = 0;
for (const [k, y] of seen) rows.push([k, y]);
rows.sort((a, b) => a[0].localeCompare(b[0]));
const body = rows.length
  ? rows.map(([p, y]) => `  ${JSON.stringify(p)}: ${y},`).join('\n')
  : '  // (none ruled yet)';
const generated = `  // __HERO_CROP_OFFSETS__  (generated — do not hand-edit)\n${body}`;

const modulePath = path.join(root, 'assets', 'hero-crop.js');
const src = readFileSync(modulePath, 'utf8');
const BLOCK = /( *\/\/ __HERO_CROP_OFFSETS__[^\n]*\n?)(?:[^}]*)/;
if (!BLOCK.test(src)) {
  console.error('[hero-crop] could not find the generated block marker in assets/hero-crop.js');
  process.exit(1);
}
const next = src.replace(BLOCK, `${generated}\n`);

if (CHECK) {
  if (next !== src) {
    console.error('[hero-crop] assets/hero-crop.js is out of sync with review/set-001-crop-offsets.json');
    process.exit(1);
  }
  console.log(`[hero-crop] in sync — ${rows.length} slot paths from ${Object.keys(offsets.offsets || {}).length} ruled hashes.`);
} else {
  writeFileSync(modulePath, next, 'utf8');
  console.log(`[hero-crop] wrote ${rows.length} slot paths from ${rows.length ? new Set(rows.map((r) => r[1])).size : 0} distinct offsets into assets/hero-crop.js`);
}
