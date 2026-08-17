// INGEST THE REPLACEMENT PHOTOGRAPHS (Al's ruling 2026-08-14).
//
// 30 images were marked FAILS in the crop tool. Al generated replacements and
// kept one winner per slot in review/replacements/. This converts each winner to
// the library's webp spec, writes it over EVERY slot path the failed photograph
// occupied, and re-keys everything that is addressed by content hash.
//
// THE THING THAT MAKES THIS NOT A FILE COPY: 23 of the 30 failed photographs
// occupy TWO slots each (week 1 + week 3, or week 2 + week 4) — the library
// ships 1,008 slots from 644 unique files by deduplicating identical bytes. Al's
// ruling (a): a picture that fails in week 1 fails in week 3, so the new bytes
// go to BOTH paths. Writing one path only would leave the rejected photograph
// live a fortnight later AND split one manifest entry into two.
//
// Mapping: winners are named <bucket>-<n>-<A|B>.png. Within a bucket, winner n
// maps to the nth FAILS entry in export order. ONE override, from Al directly:
// the single clear-dawn winner goes to the VINEYARD slot (week_2/dawn/2), not
// the surfer (week_2/dawn/7), which stays FAILS with no replacement yet.
//
//   node scripts/ingest-replacements.mjs --check   (report the plan, write nothing)
//   node scripts/ingest-replacements.mjs           (do it)
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const p = (f) => path.join(root, f);
const CHECK = process.argv.includes('--check');

// The library's budget and encoder, matching scripts/recompress-bg-images.mjs.
const TARGET_BYTES = 300 * 1024;
const MIN_QUALITY = 40;
const MAX_QUALITY = 92;

// Al, 2026-08-14: the replacements were composed for a 55%-centred square.
const REPLACEMENT_ANCHOR = 55;

// Al's direct answer when shown the two broken sunrise photographs: "vineyard".
const CLEAR_DAWN_WINNER_SLOT = 'clear/week_2/dawn/2.webp';

const anchorsFile = p('review/set-001-crop-anchors.json');
const anchorsDoc = JSON.parse(readFileSync(anchorsFile, 'utf8'));
const draftDoc = JSON.parse(readFileSync(p('review/set-001-draft.json'), 'utf8'));
const draft = draftDoc.assignments;
const byHash = new Map(draft.map((d) => [d.hash, d]));

const fails = Object.entries(anchorsDoc.anchors).filter(([, e]) => e.verdict === 'FAILS');
const winners = readdirSync(p('review/replacements')).filter((f) => f.toLowerCase().endsWith('.png'));

// A winner already recorded against a REPLACED entry has been consumed. Without
// this, a second run pairs the leftover winners against whatever FAILS remain —
// for this batch that means writing the clear-dawn winner into the SURFER slot,
// a photograph Al never chose to replace. It happens to throw first today
// (the override below cannot find its slot), but "safe because an unrelated
// guard fires" is not safe; this makes the re-run a deliberate no-op.
const consumed = new Set(
  Object.values(anchorsDoc.anchors)
    .map((e) => e.source)
    .filter(Boolean)
    .map((s) => s.split('/').pop()),
);

// bucket -> [{ file, n }] sorted by n
const winnersByBucket = new Map();
for (const file of winners.filter((f) => !consumed.has(f))) {
  const m = /^(.+)-(\d+)-[AB]\.png$/i.exec(file);
  if (!m) throw new Error(`winner filename does not parse: ${file}`);
  const [, bucket, n] = m;
  if (!winnersByBucket.has(bucket)) winnersByBucket.set(bucket, []);
  winnersByBucket.get(bucket).push({ file, n: Number(n) });
}
for (const list of winnersByBucket.values()) list.sort((a, b) => a.n - b.n);

// bucket -> [[hash, entry]] in export order
const failsByBucket = new Map();
for (const [hash, e] of fails) {
  if (!failsByBucket.has(e.bucket)) failsByBucket.set(e.bucket, []);
  failsByBucket.get(e.bucket).push([hash, e]);
}

const plan = [];
const unmapped = [];
for (const [bucket, list] of failsByBucket) {
  const w = (winnersByBucket.get(bucket) || []).slice();
  let slots = list.slice();
  // …and only when there is still a winner to place. After the ingest the
  // override's slot is no longer FAILS, so an unguarded lookup throws on every
  // re-run — which is a crash pretending to be a safety net.
  if (bucket === 'clear-dawn' && w.length) {
    // The override: pin the winner to the slot Al named, whatever the order.
    const idx = slots.findIndex(([, e]) => e.image === CLEAR_DAWN_WINNER_SLOT);
    if (idx < 0) throw new Error(`clear-dawn override slot ${CLEAR_DAWN_WINNER_SLOT} is not in the FAILS list`);
    slots = [slots[idx], ...slots.filter((_, i) => i !== idx)];
  }
  slots.forEach(([hash, e], i) => {
    if (w[i]) plan.push({ bucket, hash, entry: e, winner: w[i].file });
    else unmapped.push({ bucket, hash, image: e.image });
  });
  if (w.length > slots.length) throw new Error(`${bucket}: ${w.length} winners for ${slots.length} fails`);
}

console.log(`[ingest] ${fails.length} FAILS · ${winners.length} winners · ${plan.length} mapped · ${unmapped.length} left unreplaced`);
for (const u of unmapped) console.log(`[ingest] NO REPLACEMENT YET: ${u.bucket} ${u.image} (${u.hash}) — stays FAILS`);

async function encode(pngPath) {
  const src = sharp(pngPath);
  const meta = await src.metadata();
  let low = MIN_QUALITY; let high = MAX_QUALITY; let best = null;
  while (low <= high) {
    const quality = Math.floor((low + high) / 2);
    // No resize: the winners already arrive at the library's 1008x1792.
    const buffer = await sharp(pngPath).webp({ quality, effort: 6, smartSubsample: true }).toBuffer();
    if (buffer.length <= TARGET_BYTES) { best = { buffer, quality }; low = quality + 1; } else high = quality - 1;
  }
  if (!best) throw new Error(`${pngPath} cannot reach ${TARGET_BYTES} bytes at quality ${MIN_QUALITY}`);
  return { ...best, width: meta.width, height: meta.height };
}

const report = [];
for (const item of plan) {
  const d = byHash.get(item.hash);
  if (!d) throw new Error(`no draft entry for ${item.hash} (${item.entry.image})`);
  const paths = [...new Set([d.image, ...(d.paths || [])])];
  const pngPath = p(path.join('review/replacements', item.winner));
  const enc = await encode(pngPath);
  const newHash = createHash('sha1').update(enc.buffer).digest('hex').slice(0, 12);
  const canonical = createHash('sha256').update(enc.buffer).digest('hex');

  if (!CHECK) {
    for (const rel of paths) writeFileSync(p(path.join('assets/images/bg', rel)), enc.buffer);
    d.hash = newHash;
    delete anchorsDoc.anchors[item.hash];
    anchorsDoc.anchors[newHash] = {
      verdict: 'REPLACED',
      anchorY: REPLACEMENT_ANCHOR,
      bucket: item.bucket,
      image: item.entry.image,
      replacedHash: item.hash,
      source: `review/replacements/${item.winner}`,
      note: 'composed for a 55%-centred square; anchor is the default for replacements, not a per-image ruling',
    };
  }
  report.push({
    bucket: item.bucket, winner: item.winner, slots: paths, oldHash: item.hash, newHash,
    canonical: `${canonical.slice(0, 12)}…`, bytes: enc.buffer.length, quality: enc.quality,
    dims: `${enc.width}x${enc.height}`,
  });
}

for (const u of unmapped) {
  if (CHECK) continue;
  anchorsDoc.anchors[u.hash] = { ...anchorsDoc.anchors[u.hash], note: 'no replacement yet — Al to re-pick from the pool or generate one' };
}

console.log('\nbucket            winner                     slots  old hash      ->  new hash      q   KB');
for (const r of report) {
  console.log(`${r.bucket.padEnd(17)} ${r.winner.padEnd(26)} ${String(r.slots.length).padStart(5)}  ${r.oldHash}  ->  ${r.newHash}  ${String(r.quality).padStart(2)}  ${(r.bytes / 1024).toFixed(0).padStart(3)}`);
}
const slotCount = report.reduce((n, r) => n + r.slots.length, 0);
console.log(`\n[ingest] ${report.length} photographs written across ${slotCount} slot paths (${slotCount - report.length} of them shared twins).`);

if (!CHECK) {
  writeFileSync(p('review/set-001-draft.json'), `${JSON.stringify(draftDoc, null, 1)}\n`);
  anchorsDoc.ingested = {
    date: '2026-08-14',
    replaced: report.length,
    slotPaths: slotCount,
    unreplaced: unmapped.map((u) => u.image),
    rule: "Al's ruling (a): new bytes written to every slot path the failed photograph occupied",
  };
  writeFileSync(anchorsFile, `${JSON.stringify(anchorsDoc, null, 1)}\n`);
  writeFileSync(p('review/ingest-2026-08-14-report.json'), `${JSON.stringify(report, null, 1)}\n`);
  console.log('[ingest] updated review/set-001-draft.json, review/set-001-crop-anchors.json, wrote review/ingest-2026-08-14-report.json');
} else {
  console.log('[ingest] --check: nothing written.');
}
