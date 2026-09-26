// A pair Al ruled NEITHER on its photo (review/pairs-ruled.json): not the pair's new photo, and not the
// photo it replaced. Its line stays (loved) and waits for a remade photo; until Al ticks the remake, the
// pair's slots show a photo he graded LOVE on the taste page — a temporary repeat of that photo.
//
// What it changes, keyed by content hash like every other photo:
//   assets/images/bg/<slot>        the pair's slots get the stand-in's bytes (copied from its own slot)
//   review/set-001-draft.json      the pair's slots join the stand-in's assignment; the pair's photo leaves
//   review/set-001-lines-bespoke-final.json   the pair's line entry leaves; the stand-in's paths follow
//   review/set-001-crop-offsets.json, review/set-001-crop-anchors.json   the pair's crop leaves
//   review/af-bespoke-decisions.json   the pair's Afrikaans row leaves (its English is not wired now;
//                                  the OK'd Afrikaans stays in the plan for the remake)
//   review/pilot-pairs.json        the pair goes on hold with the ruling and the stand-in recorded
//   scripts/image-slot-manifest.mjs    CURATED_BODIES, recounted from the tree
// The photo the pair first replaced stays retired (pilotPairs.retired): Al turned it down too.
//
// Refuses if the pair's slots do not hold the pair's photo, or the stand-in is not a live photo of the
// same weather and time of day. Re-running after a successful apply is a no-op.
//
//   node scripts/apply-pair-stand-in.mjs --pair P01 --stand-in 5799efcdfd70 --why "<text>" [--dry]
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const R = (...p) => path.join(root, 'review', ...p);
const BG = (rel) => path.join(root, 'assets', 'images', 'bg', ...rel.split('/'));
const arg = (f) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : null; };
const DRY = process.argv.includes('--dry');
const PAIR = arg('--pair');
const STAND_IN = arg('--stand-in');
const WHY = arg('--why') || '';
if (!PAIR || !STAND_IN) throw new Error('usage: node scripts/apply-pair-stand-in.mjs --pair <id> --stand-in <hash> [--why <text>] [--dry]');
const TODAY = new Date().toISOString().slice(0, 10);
const sha1 = (buf) => createHash('sha1').update(buf).digest('hex').slice(0, 12);
const readJson = (f) => JSON.parse(readFileSync(R(f), 'utf8'));
const writeJson = (f, d) => writeFileSync(R(f), `${JSON.stringify(d, null, 1)}\n`);

const plan = readJson('pilot-pairs.json');
const draftDoc = readJson('set-001-draft.json');
const finalDoc = readJson('set-001-lines-bespoke-final.json');
const offsetsDoc = readJson('set-001-crop-offsets.json');
const anchorsDoc = readJson('set-001-crop-anchors.json');
const afDoc = readJson('af-bespoke-decisions.json');

const p = plan.pairs.find((x) => x.id === PAIR);
if (!p) throw new Error(`${PAIR}: not in review/pilot-pairs.json`);
const pairHash = (plan.applied?.applied || []).concat(...(plan.appliedRuns || []).map((r) => r.applied || [])).find((a) => a.id === PAIR)?.hash;
const stand = draftDoc.assignments.find((a) => a.hash === STAND_IN);
const problems = [];
if (!pairHash) problems.push(`${PAIR}: no applied record, so no photo to take out`);
if (!stand) problems.push(`${STAND_IN}: not a live photo in the slot map`);
else if (stand.condition !== p.condition || stand.time !== p.time) problems.push(`${STAND_IN} is ${stand.condition}/${stand.time}, the pair is ${p.condition}/${p.time}`);
const held = p.slots.map((s) => sha1(readFileSync(BG(s))));
if (held.every((h) => h === STAND_IN)) { console.log(`[stand-in] ${PAIR}: its slots already hold ${STAND_IN}`); process.exit(0); }
const wrong = p.slots.filter((s, i) => held[i] !== pairHash);
if (wrong.length) problems.push(`${PAIR}: ${wrong.join(', ')} do not hold the pair's photo ${pairHash}`);
if (problems.length) { console.error('[stand-in] refusing:'); for (const x of problems) console.error(`  - ${x}`); process.exit(1); }

// ---- apply ---------------------------------------------------------------------------------
const bytes = readFileSync(BG(stand.image));
if (sha1(bytes) !== STAND_IN) throw new Error(`${stand.image} does not hold ${STAND_IN}`);
if (!DRY) for (const s of p.slots) writeFileSync(BG(s), bytes);
stand.paths = [...new Set([stand.image, ...(stand.paths || []), ...p.slots])];
draftDoc.assignments = draftDoc.assignments.filter((a) => a.hash !== pairHash);
draftDoc.filled = draftDoc.assignments.length;
const pairLine = finalDoc.set.find((x) => x.hash === pairHash);
finalDoc.set = finalDoc.set.filter((x) => x.hash !== pairHash);
const standLine = finalDoc.set.find((x) => x.hash === STAND_IN);
if (standLine) standLine.paths = [...stand.paths];
finalDoc.images = finalDoc.set.length;
finalDoc.lineCount = finalDoc.set.reduce((n, x) => n + x.lines.length, 0);
delete offsetsDoc.offsets[pairHash];
delete anchorsDoc.anchors[pairHash];
if (offsetsDoc.counts) {
  const n = Object.keys(offsetsDoc.offsets).length;
  offsetsDoc.counts = { ...offsetsDoc.counts, offsets: n, wired: n, pilotPairs: Object.values(offsetsDoc.offsets).filter((o) => o.verdict === 'PAIR').length };
}
const afRow = afDoc.rows.find((r) => r.english === p.line);
afDoc.rows = afDoc.rows.filter((r) => r.english !== p.line);
for (const r of finalDoc.pilotPairs?.retired || []) {
  if (r.byPair === PAIR && !r.ruling) r.ruling = `Al, ${TODAY}: NEITHER — not ${PAIR}'s new photo and not this one (review/pairs-ruled.json); stays retired`;
}
p.hold = `Al ruled the photo NEITHER on ${TODAY} (review/pairs-ruled.json); the line waits for a remade photo`;
p.standIn = { hash: STAND_IN, image: stand.image, slots: [...p.slots], on: TODAY, why: WHY, pairPhotoOut: pairHash, pairLineOut: pairLine?.lines || [], afRowOut: afRow?.id || null };

const bodies = new Set();
const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (/^[1-7]\.webp$/.test(e.name)) bodies.add(sha1(readFileSync(f))); } };
if (!DRY) {
  writeJson('set-001-draft.json', draftDoc);
  writeJson('set-001-lines-bespoke-final.json', finalDoc);
  writeJson('set-001-crop-offsets.json', offsetsDoc);
  writeJson('set-001-crop-anchors.json', anchorsDoc);
  writeJson('af-bespoke-decisions.json', afDoc);
  writeJson('pilot-pairs.json', plan);
  walk(path.join(root, 'assets', 'images', 'bg'));
  const manifest = path.join(root, 'scripts', 'image-slot-manifest.mjs');
  const src = readFileSync(manifest, 'utf8');
  writeFileSync(manifest, src.replace(/export const CURATED_BODIES = \d+;/, `export const CURATED_BODIES = ${bodies.size};`)
    .replace(/\/\*\* \d+ curated photographs since [^*]*\*\//, `/** ${bodies.size} curated photographs since ${TODAY} (the pairs; ${PAIR} on hold with a stand-in; see verifyBackgroundImageArtifact). */`));
}
console.log(`[stand-in] ${PAIR}: ${p.slots.join(', ')} now hold ${STAND_IN} (${stand.image}); ${pairHash} out`);
console.log(DRY ? '[stand-in] --dry: nothing written' : `[stand-in] written; curated bodies now ${bodies.size}`);
