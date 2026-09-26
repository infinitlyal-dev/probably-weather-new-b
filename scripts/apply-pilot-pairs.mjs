// Put the ten pilot pairs into the app (Al's brief, 25 Sept 2026): each pair's photo into its slots,
// its line as that photo's own English line, its Afrikaans proposal through the lang-check gate.
//
//   review/pilot-pairs.json   the plan (or another with --plan): slots per pair, the photo each slot must
//                             hold now (`expect`), line, Afrikaans, region, crop anchor, why, and optionally
//                             `source` (the made photo; default <--from>/<id>.jpg) and `hold` (skip the pair:
//                             Al ruled it out for now, e.g. P01 NEITHER on 26 Sept 2026)
//
// What it changes, all keyed by the photo's content hash like every other photo:
//   assets/images/bg/<slot>        the pair's bytes, encoded to the library spec (1008x1792 webp,
//                                  <= 300 KiB, the binary search of scripts/ingest-replacements.mjs)
//   review/set-001-draft.json      the slot map: the pair's slots leave the photo that held them; a
//                                  photo left with no slot retires (its lines and crop go with it)
//   review/set-001-lines-bespoke-final.json   the pair's line on its photo; retired photos' lines
//                                  recorded under `pilotPairs.retired`
//   review/set-001-crop-offsets.json, review/set-001-crop-anchors.json   the pair's anchor
//   review/benched-photos.json     a slot-scoped bench entry loses the slots the pair now fills;
//                                  an entry left with none is removed (its photo is served in the
//                                  bucket it moved to, unchanged)
//   review/af-bespoke-decisions.json   the Afrikaans proposal, as a NEW row for apply-af-accepted.mjs
//   scripts/image-slot-manifest.mjs    CURATED_BODIES, recounted from the tree
//
// Refuses before writing anything if a slot does not hold the photo the plan expects, or a pair's
// source is missing. Re-running after a successful apply is a no-op (every slot already holds the
// pair's bytes).
//
//   node scripts/apply-pilot-pairs.mjs --from <folder with P01.jpg..P10.jpg> [--dry]
//   node scripts/apply-pilot-pairs.mjs --plan pairs-batch-1-plan.json [--dry]     (every pair has a `source`)
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const R = (...p) => path.join(root, 'review', ...p);
const BG = (rel) => path.join(root, 'assets', 'images', 'bg', ...rel.split('/'));
const arg = (f) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : null; };
const DRY = process.argv.includes('--dry');
const FROM = arg('--from');
const PLAN = arg('--plan') || 'pilot-pairs.json';
const TODAY = new Date().toISOString().slice(0, 10);
const sha1 = (buf) => createHash('sha1').update(buf).digest('hex').slice(0, 12);
const DAYS = [null, 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const slotOf = (rel) => { const [folder, week, time, file] = rel.split('/'); return { folder, week: Number(week.slice(5)), time, n: Number(file.replace('.webp', '')) }; };
const TARGET_BYTES = 300 * 1024;

const plan = JSON.parse(readFileSync(R(PLAN), 'utf8'));
if (!FROM && plan.pairs.some((p) => !p.source && !p.hold)) throw new Error('usage: node scripts/apply-pilot-pairs.mjs --from <folder> | --plan <file in review/ whose pairs carry a source> [--dry]');
const draftDoc = JSON.parse(readFileSync(R('set-001-draft.json'), 'utf8'));
const finalDoc = JSON.parse(readFileSync(R('set-001-lines-bespoke-final.json'), 'utf8'));
const offsetsDoc = JSON.parse(readFileSync(R('set-001-crop-offsets.json'), 'utf8'));
const anchorsDoc = JSON.parse(readFileSync(R('set-001-crop-anchors.json'), 'utf8'));
const benchDoc = JSON.parse(readFileSync(R('benched-photos.json'), 'utf8'));
const afDoc = JSON.parse(readFileSync(R('af-bespoke-decisions.json'), 'utf8'));

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

// ---- 1. check everything before writing anything -----------------------------------------------
const problems = [];
const work = [];
for (const p of plan.pairs) {
  if (p.hold) { console.log(`[pairs] ${p.id}: on hold (${p.hold})`); continue; }
  const src = p.source || path.join(FROM, `${p.id}.jpg`);
  if (!existsSync(src)) { problems.push(`${p.id}: no source ${src}`); continue; }
  const enc = await encode(src);
  const hash = sha1(enc.buffer);
  const held = p.slots.map((s) => sha1(readFileSync(BG(s))));
  if (held.every((h) => h === hash)) { console.log(`[pairs] ${p.id}: already in place (${hash})`); continue; }
  const wrong = p.slots.filter((s, i) => held[i] !== p.expect);
  if (wrong.length) problems.push(`${p.id}: ${wrong.join(', ')} hold ${[...new Set(held)].join('/')}, the plan expects ${p.expect} — re-plan`);
  for (const s of p.slots) {
    const { folder, time } = slotOf(s);
    if (folder !== p.condition || time !== p.time) problems.push(`${p.id}: slot ${s} is not ${p.condition}/${p.time}`);
  }
  work.push({ p, enc, hash, canonical: createHash('sha256').update(enc.buffer).digest('hex') });
}
const used = work.flatMap((w) => w.p.slots);
if (new Set(used).size !== used.length) problems.push('two pairs share a slot');
if (problems.length) { console.error('[pairs] refusing:'); for (const x of problems) console.error(`  - ${x}`); process.exit(1); }
if (!work.length) { console.log('[pairs] nothing to do'); process.exit(0); }

// ---- 2. apply ---------------------------------------------------------------------------------
const assignments = draftDoc.assignments;
const retired = [];
const benchChanges = [];
const record = { on: TODAY, applied: [], retired, benchChanges };
for (const { p, enc, hash, canonical } of work) {
  if (!DRY) for (const s of p.slots) writeFileSync(BG(s), enc.buffer);
  // the slots leave whichever photo held them
  for (const a of assignments) {
    const before = [...new Set([a.image, ...(a.paths || [])])];
    const left = before.filter((x) => !p.slots.includes(x));
    if (left.length === before.length) continue;
    if (!left.length) { a.__retire = p.id; continue; }
    a.paths = left;
    if (!left.includes(a.image)) {
      a.image = left[0];
      const s = slotOf(a.image);
      a.week = s.week % 2 ? 'A' : 'B';
      a.day = DAYS[s.n];
    }
  }
  const first = slotOf(p.slots[0]);
  assignments.push({ condition: p.condition, time: p.time, week: first.week % 2 ? 'A' : 'B', day: DAYS[first.n], hash, image: p.slots[0], paths: [...p.slots], pair: p.id });
  // its line
  finalDoc.set.push({
    image: p.slots[0], hash, condition: p.condition, time: p.time, week: first.week % 2 ? 'A' : 'B', day: DAYS[first.n],
    paths: [...p.slots], lines: [p.line], pair: p.id,
    ruledBy: plan.ruledBy || 'Al: LOVE on the taste page (all ten pilot pairs), 25 Sept 2026; line placed on its photo pending review/pairs-ruled.json',
  });
  // its crop
  const bucket = `${p.condition}-${p.time}`;
  offsetsDoc.offsets[hash] = { verdict: 'PAIR', bucket, slot: `${first.week % 2 ? 'A' : 'B'}/${DAYS[first.n]}`, image: p.slots[0], anchorY: p.anchorY, pair: p.id };
  anchorsDoc.anchors[hash] = { verdict: 'PAIR', anchorY: p.anchorY, bucket, image: p.slots[0], pair: p.id, note: 'composed for Home with the subject in the upper part; anchor set by eye on the made photo' };
  // benches that named these slots
  for (const e of benchDoc.benched) {
    if (!e.slots) continue;
    const keep = e.slots.filter((s) => !p.slots.includes(s));
    if (keep.length === e.slots.length) continue;
    benchChanges.push({ sha1: e.sha1, pair: p.id, slotsFilled: e.slots.filter((s) => p.slots.includes(s)), slotsLeft: keep });
    e.slots = keep;
  }
  // its Afrikaans, as a proposal through the gate
  if (!afDoc.rows.some((r) => r.english === p.line)) {
    afDoc.rows.push({
      id: `P${p.id}`, group: 'new', verdict: 'NEW', slot: `${p.condition}/${p.time}`, english: p.line, afrikaans: p.af, score: 5,
      reason: plan.afReason || "Vonk's proposal for Al (his pairs page, review/pairs-for-al.html in the OneDrive working copy, pre-marked USE); applied only once review/pairs-ruled.json is in; the pair's line is Al's LOVE",
    });
  }
  record.applied.push({ id: p.id, hash, canonical: `${canonical.slice(0, 12)}…`, bytes: enc.buffer.length, quality: enc.quality, slots: p.slots, replaced: p.expect });
}
for (let i = assignments.length - 1; i >= 0; i--) {
  const a = assignments[i];
  if (!a.__retire) continue;
  const lines = (finalDoc.set.find((s) => s.hash === a.hash) || {}).lines || [];
  retired.push({ hash: a.hash, image: a.image, paths: a.paths, byPair: a.__retire, lines, anchorY: anchorsDoc.anchors[a.hash]?.anchorY ?? null });
  finalDoc.set = finalDoc.set.filter((s) => s.hash !== a.hash);
  delete offsetsDoc.offsets[a.hash];
  delete anchorsDoc.anchors[a.hash];
  assignments.splice(i, 1);
}
// photos that kept some slots: their line entries follow the slot map
for (const s of finalDoc.set) {
  const a = assignments.find((x) => x.hash === s.hash);
  if (a) { s.paths = [...new Set([a.image, ...(a.paths || [])])]; s.image = a.image; s.week = a.week; s.day = a.day; }
}
benchDoc.benched = benchDoc.benched.filter((e) => {
  // An entry with no slots left must go: loadBench reads a slot-less entry as benched EVERYWHERE, which
  // would bench the photo out of the bucket it moved to. The whole entry (movedTo included) is kept here.
  if (e.slots && !e.slots.length) { benchChanges.push({ sha1: e.sha1, removed: true, reason: 'every slot it benched now holds a pilot pair; the photo stays where it moved', entry: { ...e, slots: benchChanges.filter((c) => c.sha1 === e.sha1).flatMap((c) => c.slotsFilled || []) } }); return false; }
  return true;
});
finalDoc.images = finalDoc.set.length;
if (offsetsDoc.counts) {
  const n = Object.keys(offsetsDoc.offsets).length;
  offsetsDoc.counts = { ...offsetsDoc.counts, offsets: n, wired: n, pilotPairs: Object.values(offsetsDoc.offsets).filter((o) => o.verdict === 'PAIR').length };
}
finalDoc.lineCount = finalDoc.set.reduce((n, s) => n + s.lines.length, 0);
// Merge, never replace: the guard in build-hero-lines.mjs and two tests read every retirement ever recorded.
const earlier = finalDoc.pilotPairs?.retired || [];
const added = retired.map((r) => ({ hash: r.hash, image: r.image, byPair: r.byPair, lines: r.lines })).filter((r) => !earlier.some((e) => e.hash === r.hash));
const records = [...new Set([...(finalDoc.pilotPairs?.records || [finalDoc.pilotPairs?.record || 'review/pilot-pairs.json']), `review/${PLAN}`])];
finalDoc.pilotPairs = { ...(finalDoc.pilotPairs || {}), on: TODAY, record: records[0], records, retired: [...earlier, ...added] };
draftDoc.filled = assignments.length;

// ---- 3. write ---------------------------------------------------------------------------------
const bodies = new Set();
const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (/^[1-7]\.webp$/.test(e.name)) bodies.add(sha1(readFileSync(f))); } };
if (!DRY) {
  writeFileSync(R('set-001-draft.json'), `${JSON.stringify(draftDoc, null, 1)}\n`);
  writeFileSync(R('set-001-lines-bespoke-final.json'), `${JSON.stringify(finalDoc, null, 1)}\n`);
  writeFileSync(R('set-001-crop-offsets.json'), `${JSON.stringify(offsetsDoc, null, 1)}\n`);
  writeFileSync(R('set-001-crop-anchors.json'), `${JSON.stringify(anchorsDoc, null, 1)}\n`);
  writeFileSync(R('benched-photos.json'), `${JSON.stringify(benchDoc, null, 1)}\n`);
  writeFileSync(R('af-bespoke-decisions.json'), `${JSON.stringify(afDoc, null, 1)}\n`);
  walk(path.join(root, 'assets', 'images', 'bg'));
  const manifest = path.join(root, 'scripts', 'image-slot-manifest.mjs');
  const src = readFileSync(manifest, 'utf8');
  const next = src.replace(/export const CURATED_BODIES = \d+;/, `export const CURATED_BODIES = ${bodies.size};`)
    .replace(/\/\*\* \d+ curated photographs since [^*]*\*\//, `/** ${bodies.size} curated photographs since ${TODAY} (the pairs, review/${PLAN}; see verifyBackgroundImageArtifact). */`);
  writeFileSync(manifest, next);
  // Keep earlier runs' records: a later batch appends to the list instead of replacing it.
  plan.appliedRuns = [...(plan.appliedRuns || []), ...(plan.applied ? [plan.applied] : [])];
  plan.applied = { ...record, curatedBodies: bodies.size };
  writeFileSync(R(PLAN), `${JSON.stringify(plan, null, 1)}\n`);
}
for (const a of record.applied) console.log(`[pairs] ${a.id} -> ${a.hash}  q${a.quality} ${(a.bytes / 1024).toFixed(0)} KB  ${a.slots.length} slots (was ${a.replaced})`);
for (const r of retired) console.log(`[pairs] retired ${r.hash} ${r.image} (by ${r.byPair}); ${r.lines.length} lines left with it`);
for (const b of benchChanges) console.log(`[pairs] bench ${b.sha1}: ${b.removed ? 'entry removed' : `${b.slotsFilled.length} slots filled, ${b.slotsLeft.length} left`}`);
console.log(DRY ? '[pairs] --dry: nothing written' : `[pairs] written; curated bodies now ${bodies.size}`);
