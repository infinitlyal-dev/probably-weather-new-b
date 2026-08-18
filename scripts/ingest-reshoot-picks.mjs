// INGEST THE 2026-08-18 REPLACEMENTS (Al's picks from the meme-hero curation).
//
// Al cut 15 photographs in the curation pass, two candidates were generated per
// slot on GPT Image 2, and he picked one of each in review/reshoot-pick.html.
// This converts the winners to the library's spec, writes them over EVERY
// rotation slot the cut photograph occupied, and re-keys everything addressed by
// content hash.
//
// Separate from ingest-replacements.mjs on purpose. That script infers its
// mapping from filenames and FAILS verdicts, and carries a hand-written override
// for one slot in the 08-14 batch. Here the mapping is explicit data — the pick
// tool wrote slot -> file — so inferring it again would be re-deriving something
// Al already decided. The encoder and the write-to-every-path rule are the same,
// because those are the library's rules, not that batch's.
//
// TWO SLOTS PER PICTURE. 13 of these 15 occupy two rotation paths each (week 1 +
// week 3, or week 2 + week 4): the library ships 1,008 slots from 644 unique
// files by deduplicating identical bytes. A picture cut in week 1 is cut in week
// 3, so the new bytes go to both. Writing one path would leave the rejected
// photograph live a fortnight later.
//
// RESIZE IS NOT OPTIONAL HERE, and it is the one real difference from the 08-14
// ingest. Those winners arrived at the library's 1008x1792. GPT Image 2 returns
// 1520x2688 at 0.5655, against the library's 0.5625 — close, but `cover` into
// 1008x1792 crops a ~5px sliver off the sides rather than squashing the frame.
//
//   node scripts/ingest-reshoot-picks.mjs --check   (report the plan, write nothing)
//   node scripts/ingest-reshoot-picks.mjs           (do it)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
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
const LIB_W = 1008;
const LIB_H = 1792;

// The anchor these ship on. NOT a per-image ruling — the prompts asked for a
// quiet lower third and a centred subject, and the meme hero now shows 89% of a
// frame on a normal phone, so the anchor has far less to do than it did in M7.
// 50 centres what the window cannot show. Al re-anchors any that need it in the
// curation tool, which is where anchors are actually ruled.
const NEW_ANCHOR = 50;

// Read from the ONE place it is declared, the same way the offset builder does.
const CSS_DEFAULT = (() => {
  const css = readFileSync(p('assets/app.css'), 'utf8');
  const m = /--hero-crop,\s*(\d+)%/.exec(css);
  if (!m) throw new Error('cannot find the --hero-crop default in app.css');
  return Number(m[1]);
})();

const picksDoc = JSON.parse(readFileSync(p('review/reshoot-picks-2026-08-18.json'), 'utf8'));
const draftDoc = JSON.parse(readFileSync(p('review/set-001-draft.json'), 'utf8'));
const draft = draftDoc.assignments;
const offsetsFile = p('review/set-001-crop-offsets.json');
const offsetsDoc = JSON.parse(readFileSync(offsetsFile, 'utf8'));
// Al's curation export: 279 keep verdicts, each carrying the anchor he ruled.
const curated = JSON.parse(readFileSync(p('review/set-001-crop-anchors-2026-08-18.json'), 'utf8')).anchors;

const bySlot = new Map(draft.map((d) => [d.image, d]));

// THE GUARD THIS SCRIPT EXISTS TO HAVE. Every pick must land on a slot Al
// actually cut. Without it, one wrong path in the candidate map writes a
// replacement over a photograph he KEPT and leaves the cut one live — which is
// exactly what happened on the first run of this ingest (wind/week_2/day/6 was
// written where wind/week_4/day/7 was meant, destroying a kept frame). The
// mapping is data, data can be wrong, and the cut list is the authority on what
// may be overwritten.
const cutSlots = new Set(JSON.parse(readFileSync(p('review/set-001-cut-list.json'), 'utf8')).cut.map((c) => c.image));
{
  const stray = picksDoc.picks
    .map((x) => (x.slot.endsWith('.webp') ? x.slot : `${x.slot}.webp`))
    .filter((slot) => !cutSlots.has(slot));
  if (stray.length) {
    throw new Error(`refusing to write: ${stray.length} pick(s) target a slot that was never cut — ${stray.join(', ')}`);
  }
  const missed = [...cutSlots].filter((slot) => !picksDoc.picks
    .some((x) => (x.slot.endsWith('.webp') ? x.slot : `${x.slot}.webp`) === slot));
  if (missed.length) console.log(`[ingest] NOTE: ${missed.length} cut slot(s) still have no replacement — ${missed.join(', ')}`);
}

async function encode(pngPath) {
  const meta = await sharp(pngPath).metadata();
  let low = MIN_QUALITY; let high = MAX_QUALITY; let best = null;
  while (low <= high) {
    const quality = Math.floor((low + high) / 2);
    const buffer = await sharp(pngPath)
      .resize(LIB_W, LIB_H, { fit: 'cover', position: 'centre' })
      .webp({ quality, effort: 6, smartSubsample: true })
      .toBuffer();
    if (buffer.length <= TARGET_BYTES) { best = { buffer, quality }; low = quality + 1; } else high = quality - 1;
  }
  if (!best) throw new Error(`${pngPath} cannot reach ${TARGET_BYTES} bytes at quality ${MIN_QUALITY}`);
  return { ...best, srcDims: `${meta.width}x${meta.height}` };
}

const report = [];
for (const pick of picksDoc.picks) {
  const slot = pick.slot.endsWith('.webp') ? pick.slot : `${pick.slot}.webp`;
  const d = bySlot.get(slot);
  if (!d) throw new Error(`no draft entry for slot ${slot}`);
  // The winner file is repo-relative with a leading slash, as the tool served it.
  const png = p(pick.file.replace(/^\//, ''));
  if (!existsSync(png)) throw new Error(`winner not on disk: ${png}`);

  const paths = [...new Set([d.image, ...(d.paths || [])])];
  const enc = await encode(png);
  const newHash = createHash('sha1').update(enc.buffer).digest('hex').slice(0, 12);
  const oldHash = d.hash;

  if (!CHECK) {
    for (const rel of paths) writeFileSync(p(path.join('assets/images/bg', rel)), enc.buffer);
    d.hash = newHash;
    delete offsetsDoc.offsets[oldHash];
    offsetsDoc.offsets[newHash] = {
      verdict: 'REPLACED',
      bucket: pick.bucket,
      slot: `${d.week}/${d.day}`,
      image: slot,
      anchorY: NEW_ANCHOR,
      replacedHash: oldHash,
      place: pick.place,
      source: pick.file,
      note: 'GPT Image 2, 2026-08-18; anchor is the replacement default, not a per-image ruling',
    };
  }
  report.push({ bucket: pick.bucket, place: pick.place, slots: paths.length, oldHash, newHash,
    bytes: enc.buffer.length, quality: enc.quality, srcDims: enc.srcDims });
}

// Al's 279 re-ruled anchors from the curation pass. Without this the ingest
// ships new pictures on old crops and the whole curation session is cosmetic.
let carried = 0;
let changed = 0;
for (const [hash, e] of Object.entries(curated)) {
  if (typeof e.anchorY !== 'number') continue;
  carried += 1;
  const before = offsetsDoc.offsets[hash]?.anchorY;
  if (before === e.anchorY) continue;
  changed += 1;
  if (CHECK) continue;
  // An anchor that equals the CSS default is the ABSENCE of a ruling, not a
  // ruling of 78. build-hero-crop-offsets.mjs rejects those outright, and it is
  // right to: an entry that restates the default is a second home for a number
  // that already lives in app.css.
  if (e.anchorY === CSS_DEFAULT) { delete offsetsDoc.offsets[hash]; continue; }
  offsetsDoc.offsets[hash] = {
    ...(offsetsDoc.offsets[hash] || {}),
    verdict: 'FIXABLE', bucket: e.bucket, image: e.image, anchorY: e.anchorY, ink: e.ink || 'white',
  };
}

if (!CHECK) {
  offsetsDoc.generated = '2026-08-18';
  offsetsDoc.ruledBy = 'Al, curation tool (meme hero) + 2026-08-18 reshoot';
  const wired = Object.values(offsetsDoc.offsets).filter((o) => typeof o.anchorY === 'number').length;
  offsetsDoc.counts = { offsets: Object.keys(offsetsDoc.offsets).length, wired, replaced: report.length, reAnchored: changed };
  writeFileSync(offsetsFile, `${JSON.stringify(offsetsDoc, null, 1)}\n`);
  writeFileSync(p('review/set-001-draft.json'), `${JSON.stringify(draftDoc, null, 1)}\n`);
}

console.log(`[ingest] ${report.length} replacements -> ${report.reduce((n, r) => n + r.slots, 0)} rotation slots${CHECK ? '  (CHECK — nothing written)' : ''}`);
console.log(`[ingest] ${carried} curated anchors read, ${changed} differ from what is on disk`);
console.log('\nbucket        place                      slots  old hash      ->  new hash       q   KB  source');
for (const r of report) {
  console.log(`${r.bucket.padEnd(13)} ${r.place.padEnd(26)} ${String(r.slots).padStart(5)}  ${r.oldHash}  ->  ${r.newHash}  ${String(r.quality).padStart(2)}  ${(r.bytes / 1024).toFixed(0).padStart(3)}  ${r.srcDims}`);
}
