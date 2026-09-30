// Put Al's fixed photographs in place of the originals (Al approved the R17, R39 and R51 fixes on
// review/photo-fixes/photo-fixes.html, 30 Sept 2026): the same picture with the one thing taken out
// (a brand logo, a bank's name, a real book cover), so the bytes change and NOTHING ELSE does.
//
// Why not apply-pilot-pairs.mjs: a pair brings a new photograph with a new line, and the photograph it
// replaces retires with its lines. A fix is the reverse: the photograph is the same photograph, so it
// keeps its own lines, its crop anchor and offsets and any bench entry. Only the content hash changes,
// and every table addressed by hash is re-keyed old -> new (the way scripts/ingest-replacements.mjs does).
//
//   review/photo-fixes-plan.json   the plan: per fix, the approved take (`source`), the sha256 of the
//                                  photograph the slots hold now (`oldSha256`) and its slots
//
// What it changes:
//   assets/images/bg/<slot>                   the fixed bytes (1008x1792 webp, <= 300 KiB, the binary search
//                                             of scripts/ingest-replacements.mjs), over EVERY slot holding the
//                                             old bytes
//   review/set-001-draft.json                 the slot map: the photograph's hash
//   review/set-001-lines-bespoke-final.json   every `hash` field naming it (its lines, awaitingLines, ...) and a `photoFixes` record of old -> new,
//                                             which the ruling-drift guard in scripts/build-hero-lines.mjs reads
//   review/set-001-crop-offsets.json, review/set-001-crop-anchors.json   re-keyed, values untouched
//   review/benched-photos.json                a bench entry on the photograph follows it (sha1, sha256)
// assets/hero-lines.js and assets/hero-crop.js are generated: run scripts/build-hero-lines.mjs and
// scripts/build-hero-crop-offsets.mjs afterwards.
//
// Refuses before writing anything if a slot does not hold the photograph the plan expects, if the plan's
// slots are not exactly the slots holding that photograph in the tree, or if a table lacks the old hash.
// Re-running after a successful apply is a no-op (every slot already holds the fixed bytes).
//
//   node scripts/apply-photo-fixes.mjs --dry     (report, write nothing)
//   node scripts/apply-photo-fixes.mjs
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const R = (...p) => path.join(root, 'review', ...p);
const BGROOT = path.join(root, 'assets', 'images', 'bg');
const BG = (rel) => path.join(BGROOT, ...rel.split('/'));
const DRY = process.argv.includes('--dry');
const TODAY = new Date().toISOString().slice(0, 10);
const TARGET_BYTES = 300 * 1024;
const sha1 = (buf) => createHash('sha1').update(buf).digest('hex').slice(0, 12);
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

const plan = JSON.parse(readFileSync(R('photo-fixes-plan.json'), 'utf8'));
const draftDoc = JSON.parse(readFileSync(R('set-001-draft.json'), 'utf8'));
const finalDoc = JSON.parse(readFileSync(R('set-001-lines-bespoke-final.json'), 'utf8'));
const offsetsDoc = JSON.parse(readFileSync(R('set-001-crop-offsets.json'), 'utf8'));
const anchorsDoc = JSON.parse(readFileSync(R('set-001-crop-anchors.json'), 'utf8'));
const benchDoc = JSON.parse(readFileSync(R('benched-photos.json'), 'utf8'));

async function encode(file) {
  let low = 40; let high = 92; let best = null;
  while (low <= high) {
    const quality = Math.floor((low + high) / 2);
    const buffer = await sharp(file).resize(1008, 1792, { fit: 'cover' }).webp({ quality, effort: 6, smartSubsample: true }).toBuffer();
    if (buffer.length <= TARGET_BYTES) { best = { buffer, quality }; low = quality + 1; } else high = quality - 1;
  }
  if (!best) throw new Error(`${file} cannot reach ${TARGET_BYTES} bytes at quality 40`);
  return best;
}

// final.json names a photograph by hash in more than its line entry (awaitingLines, held-back rows, ...): every
// `hash` field follows the photograph, except the photoFixes record itself, which is the old -> new history.
function followHash(node, oldHash, newHash, top = true) {
  let n = 0;
  if (Array.isArray(node)) { for (const x of node) n += followHash(x, oldHash, newHash, false); return n; }
  if (!node || typeof node !== 'object') return 0;
  for (const [k, v] of Object.entries(node)) {
    if (top && k === 'photoFixes') continue;
    if (k === 'hash' && v === oldHash) { node[k] = newHash; n += 1; } else n += followHash(v, oldHash, newHash, false);
  }
  return n;
}

// every slot in the tree, by the sha256 of its bytes
const treeSlots = new Map();
const walk = (d) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) { walk(f); continue; }
    if (!/^[1-7]\.webp$/.test(e.name)) continue;
    const h = sha256(readFileSync(f));
    if (!treeSlots.has(h)) treeSlots.set(h, []);
    treeSlots.get(h).push(path.relative(BGROOT, f).split(path.sep).join('/'));
  }
};
walk(BGROOT);

// ---- 1. check everything before writing anything -----------------------------------------------
const problems = [];
const work = [];
let tidied = 0;   // stale old-hash references found in final.json on fixes already in place
for (const f of plan.fixes) {
  if (!existsSync(f.source)) { problems.push(`${f.id}: no source ${f.source}`); continue; }
  const enc = await encode(f.source);
  const newSha = sha256(enc.buffer);
  const holdingNew = f.slots.filter((s) => sha256(readFileSync(BG(s))) === newSha);
  if (holdingNew.length === f.slots.length) {
    console.log(`[fixes] ${f.id}: already in place (${sha1(enc.buffer)})`);
    const done = finalDoc.photoFixes?.fixes?.find((x) => x.id === f.id);
    if (done) tidied += followHash(finalDoc, done.oldHash, done.newHash);
    continue;
  }
  const wrong = f.slots.filter((s) => sha256(readFileSync(BG(s))) !== f.oldSha256);
  if (wrong.length) { problems.push(`${f.id}: ${wrong.join(', ')} do not hold the expected photograph ${f.oldSha256.slice(0, 12)} — re-plan`); continue; }
  const inTree = [...(treeSlots.get(f.oldSha256) || [])].sort();
  if (JSON.stringify(inTree) !== JSON.stringify([...f.slots].sort())) {
    problems.push(`${f.id}: the tree holds that photograph in ${JSON.stringify(inTree)}, the plan lists ${JSON.stringify(f.slots)} — the new bytes go everywhere the old appear`);
    continue;
  }
  const oldBytes = readFileSync(BG(f.slots[0]));
  const oldHash = sha1(oldBytes);
  const draft = draftDoc.assignments.filter((a) => a.hash === oldHash);
  const line = finalDoc.set.filter((s) => s.hash === oldHash);
  if (draft.length !== 1) problems.push(`${f.id}: ${draft.length} slot-map entries under ${oldHash} (expected 1)`);
  // a bare photograph (no lines yet, like R51) has no line entry; more than one would be a corrupt table
  if (line.length > 1) problems.push(`${f.id}: ${line.length} line entries under ${oldHash} (expected 0 or 1)`);
  if (!offsetsDoc.offsets[oldHash]) problems.push(`${f.id}: no crop offset under ${oldHash}`);
  if (!anchorsDoc.anchors[oldHash]) problems.push(`${f.id}: no crop anchor under ${oldHash}`);
  work.push({ f, enc, oldHash, oldSha: f.oldSha256, newHash: sha1(enc.buffer), newSha });
}
if (problems.length) { console.error('[fixes] refusing:'); for (const x of problems) console.error(`  - ${x}`); process.exit(1); }
if (!work.length) {
  if (tidied && !DRY) writeFileSync(R('set-001-lines-bespoke-final.json'), `${JSON.stringify(finalDoc, null, 1)}
`);
  console.log(tidied ? `[fixes] ${tidied} stale old-hash reference(s) in final.json ${DRY ? 'found' : 'followed the photograph'}` : '[fixes] nothing to do');
  process.exit(0);
}

// ---- 2. apply ---------------------------------------------------------------------------------
const rekey = (obj, oldKey, newKey) => {
  // keep the key's position so the file's diff is only the key
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[k === oldKey ? newKey : k] = v;
  return out;
};
const fixes = [];
for (const w of work) {
  const { f, enc, oldHash, newHash, oldSha, newSha } = w;
  if (oldHash === newHash) { console.error(`[fixes] ${f.id}: the fixed bytes hash the same as the original`); process.exit(1); }
  if (!DRY) for (const s of f.slots) writeFileSync(BG(s), enc.buffer);
  draftDoc.assignments.find((a) => a.hash === oldHash).hash = newHash;
  const lineEntry = finalDoc.set.find((s) => s.hash === oldHash);
  followHash(finalDoc, oldHash, newHash);
  offsetsDoc.offsets = rekey(offsetsDoc.offsets, oldHash, newHash);
  anchorsDoc.anchors = rekey(anchorsDoc.anchors, oldHash, newHash);
  for (const e of benchDoc.benched) if (e.sha1 === oldHash) { e.sha1 = newHash; e.sha256 = newSha; }
  fixes.push({ id: f.id, what: f.what, hadLines: Boolean(lineEntry), oldHash, newHash, oldSha256: oldSha, newSha256: newSha, slots: f.slots, bytes: enc.buffer.length, quality: enc.quality });
}
const earlier = finalDoc.photoFixes?.fixes || [];
finalDoc.photoFixes = { on: TODAY, record: 'review/photo-fixes-plan.json', ruledBy: plan.ruledBy, fixes: [...earlier, ...fixes] };

// ---- 3. write ---------------------------------------------------------------------------------
if (!DRY) {
  writeFileSync(R('set-001-draft.json'), `${JSON.stringify(draftDoc, null, 1)}\n`);
  writeFileSync(R('set-001-lines-bespoke-final.json'), `${JSON.stringify(finalDoc, null, 1)}\n`);
  writeFileSync(R('set-001-crop-offsets.json'), `${JSON.stringify(offsetsDoc, null, 1)}\n`);
  writeFileSync(R('set-001-crop-anchors.json'), `${JSON.stringify(anchorsDoc, null, 1)}\n`);
  writeFileSync(R('benched-photos.json'), `${JSON.stringify(benchDoc, null, 1)}\n`);
}
for (const x of fixes) console.log(`[fixes] ${x.id}: ${x.oldHash} -> ${x.newHash}  q${x.quality} ${(x.bytes / 1024).toFixed(0)} KB  ${x.slots.length} slots  (${x.what})`);
console.log(DRY ? '[fixes] --dry: nothing written' : '[fixes] written; now run scripts/build-hero-lines.mjs and scripts/build-hero-crop-offsets.mjs');
