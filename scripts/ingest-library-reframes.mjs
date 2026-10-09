// Put the reframed library photographs in place (Al's ruling, 8 Oct 2026; review/library-reframe-2026-10-08.md).
//
//   node scripts/ingest-library-reframes.mjs --keep <hash,hash,…> [--anchors review/library-reframe-2026-10-08/anchors.json] [--dry-run]
//   node scripts/ingest-library-reframes.mjs --dir landmark-creep-2026-10-08 --keep <hash,…> [--dry-run]
//
// --dir <folder under review/>: a RETAKE of photographs already reframed (Al, 8-9 Oct 2026: 16 reframes had gained Table
// Mountain or Lion's Head). Its takes are named by the hash the reframe replaced; the photograph now in those slots (the
// reframe) is replaced by the take everywhere it sits. Lines and anchors stay (Al's ruling): the lines entry and the phone
// crop entry move to the new hash, `replacedHash` keeps the original frame the rulings were made on, `retakeOf` the reframe.
//
// Each kept take, review/library-reframe-2026-10-08/<old hash>.png, is encoded to a 1008x1792 WebP under the recompress
// budget (scripts/lib/encode-bg.mjs) and written into EVERY slot the old photograph holds (review/set-001-draft.json).
// The photograph keeps its lines: its entry in review/set-001-lines-bespoke-final.json takes the new hash, with
// `replacedHash` (the old one) and `reframed: true`, so the line builder's drift guard knows the rulings travelled with
// it. Its old crop entries are dropped (phone: review/set-001-crop-offsets.json, desktop: review/set-001-crop-anchors.json
// — they were ruled on a frame that no longer exists); a face anchor from --anchors (hash -> anchorY, from
// `node scripts/anchor-faces.mjs --reframes`) is written in their place. Then: build-hero-lines, build-hero-crop-offsets,
// build-hero-crop-desktop, the suite, the build.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeBg, sha12 } from './lib/encode-bg.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const R = (...p) => path.join(root, ...p);
const args = process.argv.slice(2);
const arg = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const DRY = args.includes('--dry-run');
const SUB = arg('--dir');
const DIR = R('review', SUB || 'library-reframe-2026-10-08');
const keep = (arg('--keep') || '').split(',').map((s) => s.trim()).filter(Boolean);
if (!keep.length) throw new Error('say which takes to keep: --keep <hash,hash,…>');
const faceAnchors = arg('--anchors') ? JSON.parse(readFileSync(R(arg('--anchors')), 'utf8')) : {};

const json = (...p) => JSON.parse(readFileSync(R(...p), 'utf8'));
const draft = json('review', 'set-001-draft.json');
const final = json('review', 'set-001-lines-bespoke-final.json');
const offsets = json('review', 'set-001-crop-offsets.json');
const anchorsDoc = json('review', 'set-001-crop-anchors.json');

const rows = [];
for (const old of keep) {
  const take = path.join(DIR, `${old}.png`);
  if (!existsSync(take)) throw new Error(`${old}: no take at ${take}`);
  const cur = SUB ? draft.assignments.find((a) => a.replacedHash === old)?.hash : old;
  const as = draft.assignments.filter((a) => a.hash === cur);
  if (!as.length) throw new Error(`${old}: not in review/set-001-draft.json`);
  const slots = [...new Set(as.flatMap((a) => a.paths || [a.image]))];
  for (const s of slots) if (sha12(readFileSync(R('assets', 'images', 'bg', ...s.split('/')))) !== cur) throw new Error(`${s} no longer holds ${cur}`);
  const enc = await encodeBg(take);
  rows.push({ old, cur, hash: sha12(enc.buf), enc, slots, as });
}

console.log(`${DRY ? '[dry run] ' : ''}${rows.length} ${SUB ? `retaken photographs (${SUB})` : 'reframed photographs'}`);
console.log('| old | new | WebP | slots | face anchor |\n|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.old} | ${r.hash} | ${Math.round(r.enc.buf.length / 1024)} KB q${r.enc.q} | ${r.slots.join(', ')} | ${faceAnchors[r.old] ?? '—'} |`);
if (DRY) process.exit(0);

if (SUB) {
  for (const r of rows) {
    for (const s of r.slots) {
      const dest = R('assets', 'images', 'bg', ...s.split('/'));
      writeFileSync(dest, r.enc.buf);
      if (sha12(readFileSync(dest)) !== r.hash) throw new Error(`${s}: write verification failed`);
    }
    for (const a of r.as) { a.retakeOf = r.cur; a.hash = r.hash; a.source = `review/${SUB}/${r.old}.png`; }
    const fe = final.set.find((e) => e.hash === r.cur);
    if (fe) { fe.retakeOf = r.cur; fe.hash = r.hash; }
    if (offsets.offsets[r.cur]) { offsets.offsets[r.hash] = offsets.offsets[r.cur]; delete offsets.offsets[r.cur]; }
    delete anchorsDoc.anchors[r.cur];
  }
  draft.note = `${draft.note} | 2026-10-09: ${rows.length} reframes retaken without a landmark (${SUB}); retakeOf keeps the reframe's hash.`;
  writeFileSync(R('review', 'set-001-draft.json'), JSON.stringify(draft, null, 1));
  writeFileSync(R('review', 'set-001-lines-bespoke-final.json'), JSON.stringify(final, null, 1) + '\n');
  writeFileSync(R('review', 'set-001-crop-offsets.json'), JSON.stringify(offsets, null, 1) + '\n');
  writeFileSync(R('review', 'set-001-crop-anchors.json'), JSON.stringify(anchorsDoc, null, 1) + '\n');
  writeFileSync(path.join(DIR, 'ingest-report.json'), JSON.stringify(rows.map(({ enc, as, ...r }) => ({ ...r, kb: Math.round(enc.buf.length / 1024), q: enc.q })), null, 1));
  console.log(`wrote ${rows.length} photographs into ${rows.reduce((n, r) => n + r.slots.length, 0)} slots`);
  process.exit(0);
}

for (const r of rows) {
  for (const s of r.slots) {
    const dest = R('assets', 'images', 'bg', ...s.split('/'));
    writeFileSync(dest, r.enc.buf);
    if (sha12(readFileSync(dest)) !== r.hash) throw new Error(`${s}: write verification failed`);
  }
  for (const a of r.as) { a.replacedHash = a.hash; a.hash = r.hash; a.source = `review/library-reframe-2026-10-08/${r.old}.png`; }
  const fe = final.set.find((e) => e.hash === r.old);
  if (fe) { fe.replacedHash = r.old; fe.hash = r.hash; fe.reframed = true; }
  const prev = offsets.offsets[r.old];
  delete offsets.offsets[r.old];
  if (typeof faceAnchors[r.old] === 'number') {
    offsets.offsets[r.hash] = { verdict: 'FACE', bucket: prev?.bucket, image: r.slots[0], anchorY: faceAnchors[r.old],
      faceAnchor: { on: '2026-10-08', by: 'scripts/anchor-faces.mjs --reframes', reason: 'reframed photograph (Al, 8 Oct 2026)' } };
  }
  delete anchorsDoc.anchors[r.old];
}
offsets.counts.wired = Object.values(offsets.offsets).filter((o) => typeof o.anchorY === 'number').length;
offsets.counts.offsets = Object.keys(offsets.offsets).length;
offsets.reframes = { on: '2026-10-08', photographs: rows.length, from: 'review/library-reframe-2026-10-08.md' };
draft.note = `${draft.note} | 2026-10-08: ${rows.length} library photographs reframed in place (scripts/ingest-library-reframes.mjs); replacedHash keeps the old one.`;
writeFileSync(R('review', 'set-001-draft.json'), JSON.stringify(draft, null, 1));
writeFileSync(R('review', 'set-001-lines-bespoke-final.json'), JSON.stringify(final, null, 1) + '\n');
writeFileSync(R('review', 'set-001-crop-offsets.json'), JSON.stringify(offsets, null, 1) + '\n');
writeFileSync(R('review', 'set-001-crop-anchors.json'), JSON.stringify(anchorsDoc, null, 1) + '\n');
writeFileSync(path.join(DIR, 'ingest-report.json'), JSON.stringify(rows.map(({ enc, as, ...r }) => ({ ...r, kb: Math.round(enc.buf.length / 1024), q: enc.q })), null, 1));
console.log(`wrote ${rows.length} photographs into ${rows.reduce((n, r) => n + r.slots.length, 0)} slots`);
