// Is any photograph Al cut or retired back in rotation? (Al, 8 Oct 2026: "one or two previously cut photos on my phone".)
//
// Rejected = every photograph a ruling took out: the 18 Aug cut list (review/set-001-cut-list.json), the photograph the
// provenance cull left with no lines (review/provenance-cull-ruled.json), the benches and moves of 23 Sept
// (review/benched-photos.json, review/cold-move-ruled.json), and every photograph a replacement retired or displaced
// (review/ingest-2026-08-14-report.json, the pairs / photo-batch / last-fixes plans of 26 Sept – 1 Oct).
// Checked against:
//   1. the SERVED grid — what the build serves in each of the 1,008 slots (scripts/image-slot-manifest.mjs: a benched
//      slot serves its fallback, so the bytes sitting in a benched slot are not "on the phone");
//   2. the 69 new photographs in review/new-sets-2026-10-07/ (the files the ingest would encode).
// Two tests: the exact hash (sha1 of the bytes, first 12 hex — the grid's own identity), and a picture match (a 16x16
// difference hash of the pixels), which catches the same photograph re-encoded, recropped or re-saved. Rejected
// photographs no longer in the tree are read back out of git history by their recorded slot paths.
//
//   node scripts/check-rejected-photos.mjs            -> review/rejected-photo-check-2026-10-08.md
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { scanBackgroundSlots } from './image-slot-manifest.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const BG = path.join(root, 'assets', 'images', 'bg');
const NEW = path.join(root, 'review', 'new-sets-2026-10-07');
const OUT = path.join(root, 'review', 'rejected-photo-check-2026-10-08.md');
const json = (rel) => JSON.parse(readFileSync(path.join(root, rel), 'utf8'));
const sha12 = (b) => createHash('sha1').update(b).digest('hex').slice(0, 12);
const PICTURE_MATCH = 45; // of 256 bits: between the same photograph PNG vs its own WebP (<= 27) and two different photographs (>= 63), measured below

// ---- 1. the rejected photographs, with where each was ruled out ----
const rejected = new Map(); // sha1-12 -> { why: [], paths: Set }
const add = (hash, why, paths = []) => {
  if (!/^[0-9a-f]{12}$/.test(hash || '')) return;
  const r = rejected.get(hash) || { why: [], paths: new Set() };
  if (!r.why.includes(why)) r.why.push(why);
  for (const p of paths || []) r.paths.add(p);
  rejected.set(hash, r);
};
for (const c of json('review/set-001-cut-list.json').cut) add(c.hash, 'cut list 18 Aug (set-001-cut-list.json)', [c.image, ...(c.paths || [])]);
const cull = json('review/provenance-cull-ruled.json');
const linesLeft = new Map();
for (const k of cull.keep) linesLeft.set(k.hash, (linesLeft.get(k.hash) || 0) + 1);
for (const c of cull.cut) if (!linesLeft.get(c.hash)) add(c.hash, 'provenance cull 20 Sept: every line cut (photo kept by design, serves bank lines)', [c.image]);
const bench = json('review/benched-photos.json');
for (const b of bench.benched || []) add(b.sha1, `benched ${b.benchedOn}${b.movedTo?.length ? ` from its old slots, moved to ${b.movedTo.join(', ')}` : ' (taken out, not moved)'}`, b.slots);
for (const b of bench.retired || []) add(b.sha1, `bench entry retired ${b.retiredOn}: ${b.retiredBecause}`, b.slots);
const move = json('review/cold-move-ruled.json');
add(move.photo.sha1, `moved cloudy -> cold ${move.ruledOn.slice(0, 10)} (cold-move-ruled.json, ${move.verdict})`, move.photo.from);
for (const r of json('review/ingest-2026-08-14-report.json')) add(r.oldHash, 'replaced 14 Aug (ingest-2026-08-14-report.json)', r.slots);
const PLANS = ['pairs-batch-1-plan', 'pairs-rolling-1-plan', 'pairs-rolling-2-plan', 'photo-batches-plan', 'photo-batch-3-plan', 'last-fixes-plan'];
for (const name of PLANS) {
  const plan = json(`review/${name}.json`);
  const runs = [...(plan.appliedRuns || []), ...(plan.applied ? [plan.applied] : [])];
  for (const run of runs) {
    for (const r of run.retired || []) add(r.hash, `retired by ${name}.json${run.on ? ` (${String(run.on).slice(0, 10)})` : ''}`, [r.image, ...(r.paths || [])]);
    for (const a of run.applied || []) add(a.replaced, `displaced from ${(a.slots || []).join(', ')} by ${name}.json (${a.id || a.hash})`, a.slots);
  }
}

// ---- 2. what is served now, and the 69 new ----
const scan = scanBackgroundSlots(BG);
const served = new Map(); // sha1-12 -> slots it is served in
const servedFile = new Map();
for (const e of scan.entries) {
  const file = e.servedPath;
  const h = sha12(readFileSync(file));
  if (!served.has(h)) { served.set(h, []); servedFile.set(h, file); }
  served.get(h).push(e.relativePath + (e.servedPath !== e.sourcePath ? ` (benched slot, serves ${path.relative(BG, e.servedPath).split(path.sep).join('/')})` : ''));
}
const newFiles = [];
for (const set of ['partly-cloudy', 'breezy', 'cloudy']) {
  for (const f of readdirSync(path.join(NEW, set))) if (/^(dawn|day|dusk|night)-[1-7](-weekB)?\.png$/.test(f)) newFiles.push(`${set}/${f}`);
}

// ---- 3. the rejected bytes: on disk, else from git history by their slot paths ----
const git = (...a) => execFileSync('git', a, { cwd: root, maxBuffer: 64 * 1024 * 1024 });
const rejectedBytes = new Map();
const onDisk = new Map();
for (const e of scan.entries) onDisk.set(sha12(readFileSync(e.sourcePath)), e.sourcePath);
for (const [hash, r] of rejected) {
  if (onDisk.has(hash)) { rejectedBytes.set(hash, readFileSync(onDisk.get(hash))); continue; }
  for (const p of r.paths) {
    if (rejectedBytes.has(hash)) break;
    const rel = `assets/images/bg/${p}`;
    const commits = git('log', '--all', '--format=%H', '--', rel).toString().trim().split('\n').filter(Boolean);
    for (const c of commits) {
      // the commit that changed the file holds the new bytes; its parent holds the old ones — try both
      for (const ref of [`${c}:${rel}`, `${c}^:${rel}`]) {
        let b; try { b = git('show', ref); } catch { continue; }
        if (sha12(b) === hash) { rejectedBytes.set(hash, b); break; }
      }
      if (rejectedBytes.has(hash)) break;
    }
  }
}

// ---- 4. picture match ----
async function dhash(input) {
  const { data } = await sharp(input).greyscale().resize(17, 16, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const bits = [];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) bits.push(data[y * 17 + x] < data[y * 17 + x + 1] ? 1 : 0);
  return bits;
}
const dist = (a, b) => a.reduce((n, v, i) => n + (v !== b[i]), 0);
const servedHashes = new Map();
for (const [h, f] of servedFile) servedHashes.set(h, await dhash(f));
const newHashes = new Map();
for (const f of newFiles) newHashes.set(f, await dhash(path.join(NEW, f)));
const rejHashes = new Map();
for (const [h, b] of rejectedBytes) rejHashes.set(h, await dhash(b));

// Calibration: the same photograph twice (a new PNG against its own WebP encode at the ingest's quality) and the
// closest two DIFFERENT served photographs.
const calSame = [];
for (const f of newFiles.slice(0, 12)) {
  const webp = await sharp(path.join(NEW, f)).resize(1008, 1792, { fit: 'cover' }).webp({ quality: 70 }).toBuffer();
  calSame.push(dist(newHashes.get(f), await dhash(webp)));
}
const servedList = [...servedHashes];
let closestDifferent = 256;
for (let i = 0; i < servedList.length; i++) for (let j = i + 1; j < servedList.length; j++) closestDifferent = Math.min(closestDifferent, dist(servedList[i][1], servedList[j][1]));

const exactServed = [...rejected].filter(([h]) => served.has(h));
const exactNew = [];
for (const f of newFiles) { const h = sha12(readFileSync(path.join(NEW, f))); if (rejected.has(h)) exactNew.push([f, h]); }
const near = [];
for (const [rh, rb] of rejHashes) {
  for (const [sh, sb] of servedHashes) if (sh !== rh) { const d = dist(rb, sb); if (d <= PICTURE_MATCH) near.push({ rejected: rh, against: `served ${sh} (${served.get(sh)[0]})`, d }); }
  for (const [f, nb] of newHashes) { const d = dist(rb, nb); if (d <= PICTURE_MATCH) near.push({ rejected: rh, against: `new ${f}`, d }); }
}
let minAny = 256;
for (const [, rb] of rejHashes) { for (const [, sb] of servedHashes) minAny = Math.min(minAny, dist(rb, sb) || 256); for (const [, nb] of newHashes) minAny = Math.min(minAny, dist(rb, nb)); }

const L = [];
L.push('# Rejected photographs back on the phone? — 8 Oct 2026', '');
L.push(`Generated by \`node scripts/check-rejected-photos.mjs\`. **${rejected.size} rejected photographs** (every cut, bench, move and retirement on record) against **${served.size} photographs served** in the 1,008 slots today and **${newFiles.length} new** ones.`, '');
L.push('## Answer', '');
const servedMoves = exactServed.filter(([, r]) => r.why.every((w) => /moved|provenance cull|displaced/.test(w)));
const realHits = exactServed.filter((x) => !servedMoves.includes(x));
L.push(`- Exact bytes, cut/retired photo served today: **${realHits.length ? realHits.length : 'none'}**.`);
L.push(`- Exact bytes, among the 69 new: **${exactNew.length ? exactNew.length : 'none'}**.`);
L.push(`- Same picture re-encoded (difference hash ≤ ${PICTURE_MATCH}/256): **${near.length ? near.length : 'none'}**.`);
L.push(`- Served by design (moved to another bucket, displaced from some weeks but kept in others, or kept with bank lines): ${servedMoves.length}, listed below so a sighting can be placed.`, '');
if (realHits.length) {
  L.push('### Hits', '', '| photo | why it was out | served in |', '|---|---|---|');
  for (const [h, r] of realHits) L.push(`| \`${h}\` | ${r.why.join('; ')} | ${served.get(h).join(', ')} |`);
  L.push('');
}
if (near.length) {
  L.push('### Picture matches', '', '| rejected | matches | distance |', '|---|---|---|');
  for (const n of near) L.push(`| \`${n.rejected}\` (${rejected.get(n.rejected).why[0]}) | ${n.against} | ${n.d} |`);
  L.push('');
}
L.push('### Served by design', '', '| photo | record | served in |', '|---|---|---|');
for (const [h, r] of servedMoves) L.push(`| \`${h}\` | ${r.why.join('; ')} | ${served.get(h).join(', ')} |`);
L.push('', '## How sure', '');
L.push(`- Rejected photographs whose bytes were found (tree or git history) and picture-checked: ${rejectedBytes.size} of ${rejected.size}.${rejected.size - rejectedBytes.size ? ` Not found: ${[...rejected.keys()].filter((h) => !rejectedBytes.has(h)).map((h) => `\`${h}\``).join(', ')} — exact-hash check only.` : ''}`);
L.push(`- Calibration: the same photograph PNG vs its own WebP scores ${Math.min(...calSame)}–${Math.max(...calSame)}; the two closest *different* served photographs score ${closestDifferent}. Threshold ${PICTURE_MATCH}. Closest rejected-vs-anything pair: ${minAny}.`);
L.push('- What this cannot see: a phone holding an old copy in its own cache (the service worker caches photographs by URL; a slot URL whose photo changed is re-fetched when `BG_IMAGE_URL_VERSION` changes), or a sighting of a *line* that was cut rather than a photograph.');
L.push('', '## Every rejected photograph checked', '', '| photo | record |', '|---|---|');
for (const [h, r] of rejected) L.push(`| \`${h}\` | ${r.why.join('; ')} |`);
writeFileSync(OUT, L.join('\n') + '\n');
console.log(`rejected ${rejected.size} (bytes ${rejectedBytes.size}) · served ${served.size} · new ${newFiles.length} · exact served ${exactServed.length} (by design ${servedMoves.length}) · exact new ${exactNew.length} · picture ${near.length} · cal same ${Math.min(...calSame)}-${Math.max(...calSame)} closest different ${closestDifferent} min rejected ${minAny}`);
