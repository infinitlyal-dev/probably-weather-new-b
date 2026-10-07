// Ingest the 7 Oct 2026 photo sets (review/image-brief-2026-10-07.md) — only the photographs Al keeps.
//
//   node scripts/ingest-new-sets.mjs --keep review/new-sets-lines-2026-10-07-ruled.json --dry-run
//   node scripts/ingest-new-sets.mjs --files partly-cloudy/dawn-1.png,breezy/day-3.png --dry-run
//   (drop --dry-run to write)
//
// Input: review/new-sets-2026-10-07/<set>/<time>-<day>.png (cloudy also day-3-weekB.png).
// Each kept photograph is encoded to a 1008x1792 WebP under the recompress budget (scripts/recompress-bg-images.mjs:
// at most 290 KB, quality searched between 60 and 82, the same phone-safe width steps), hashed the way the grid hashes
// (sha1, first 12 hex), and recorded in review/set-001-draft.json at its grid position:
//   partly-cloudy / breezy  — a new week-A assignment at <set>/week_1/<time>/<day>.webp. Week B is empty, so
//                             scripts/layout-set-001-grid.mjs serves the same photograph in all four week folders
//                             (week_1 = week_3, week_2 = week_4), its day-named lines true on its own day.
//   cloudy                  — replaces BY HASH: the assignment at that grid position (cloudy/week_1/<time>/<day> is
//                             week A; day-3-weekB is week B, Wednesday) takes the new hash, so every slot the retired
//                             photograph occupied — its week-3 or week-4 twin, and any position that borrowed it —
//                             is relaid with the new one.
// The dry run prints the table of what moves where and writes nothing. A real run writes the WebPs and the draft;
// then: register the folders (BG_IMAGE_SLOT_FOLDERS, layout CONDITIONS), node scripts/layout-set-001-grid.mjs,
// node scripts/build-hero-lines.mjs, node scripts/build-hero-crop-offsets.mjs, npx vitest run, npm run build.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const SRC = path.join(root, 'review', 'new-sets-2026-10-07');
const BG = path.join(root, 'assets', 'images', 'bg');
const DRAFT = path.join(root, 'review', 'set-001-draft.json');
const BENCH = path.join(root, 'review', 'benched-photos.json');
const args = process.argv.slice(2);
const arg = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const DRY = args.includes('--dry-run');

// The recompress rules (scripts/recompress-bg-images.mjs).
const TARGET_BYTES = 290 * 1024, MIN_Q = 60, MAX_Q = 82, WIDTHS = [null, 1280, 1200, 1080, 960];
const W = 1008, H = 1792;
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const SETS = ['partly-cloudy', 'breezy', 'cloudy'];
const sha12 = (b) => createHash('sha1').update(b).digest('hex').slice(0, 12);

function keptFiles() {
  if (arg('--files')) return arg('--files').split(',').map((s) => s.trim()).filter(Boolean);
  if (arg('--keep')) {
    const ruled = JSON.parse(readFileSync(path.resolve(root, arg('--keep')), 'utf8'));
    return ruled.photos.filter((p) => p.keep === true).map((p) => p.file);
  }
  throw new Error('say which photographs Al kept: --keep <ruled export> or --files a,b,c');
}

function position(file) {
  const m = /^(partly-cloudy|breezy|cloudy)\/(dawn|day|dusk|night)-([1-7])(-weekB)?\.png$/.exec(file);
  if (!m) throw new Error(`${file}: not a brief filename (<set>/<time>-<1..7>[-weekB].png)`);
  return { set: m[1], time: m[2], index: Number(m[3]), day: DAYS[Number(m[3]) - 1], week: m[4] ? 'B' : 'A' };
}

async function encode(file) {
  const input = await sharp(path.join(SRC, file)).resize(W, H, { fit: 'cover' }).png().toBuffer();
  for (const width of WIDTHS) {
    let lo = MIN_Q, hi = MAX_Q, best = null;
    while (lo <= hi) {
      const q = Math.floor((lo + hi) / 2);
      let p = sharp(input);
      if (width) p = p.resize({ width, withoutEnlargement: true });
      const buf = await p.webp({ quality: q, effort: 6, smartSubsample: true }).toBuffer();
      if (buf.length <= TARGET_BYTES) { best = { buf, q, width }; lo = q + 1; } else hi = q - 1;
    }
    if (best) return best;
  }
  throw new Error(`${file}: cannot reach ${TARGET_BYTES} bytes at quality ${MIN_Q}`);
}

const files = keptFiles();
for (const f of files) if (!existsSync(path.join(SRC, f))) throw new Error(`${f}: not in review/new-sets-2026-10-07/`);
const draft = JSON.parse(readFileSync(DRAFT, 'utf8'));
const bench = JSON.parse(readFileSync(BENCH, 'utf8'));
const rows = [];
for (const file of files) {
  const pos = position(file);
  const enc = await encode(file);
  const hash = sha12(enc.buf);
  if (pos.set === 'cloudy') {
    // The slot the brief names (week_1, or week_2 for -weekB); whichever photograph holds it — its own position or one
    // borrowed from the other week — is the one retired, everywhere it sits.
    const slot = `cloudy/week_${pos.week === 'B' ? 2 : 1}/${pos.time}/${pos.index}.webp`;
    const a = draft.assignments.find((x) => x.condition === 'cloudy' && (x.paths || []).includes(slot));
    if (a) {
      const slots = draft.assignments.filter((x) => x.hash === a.hash).flatMap((x) => x.paths);
      rows.push({ file, hash, kb: Math.round(enc.buf.length / 1024), q: enc.q, width: enc.width, action: 'replace', retired: a.hash, image: a.image, slots, enc, a });
    } else {
      // A position emptied by a photo move (the bytes still sit there, benched; review/benched-photos.json): the new
      // photograph fills it, and the bench entry for those cloudy slots is retired — not emptied, because an entry with
      // no slots benches its photograph everywhere, including the bucket it moved to.
      const b = (bench.benched || []).find((x) => (x.slots || []).includes(slot));
      if (!b) throw new Error(`${file}: no photograph recorded at ${slot}, and no bench entry covers it`);
      const image = slot;
      const slots = [1, 2, 3, 4].map((w) => `cloudy/week_${w}/${pos.time}/${pos.index}.webp`);
      rows.push({ file, hash, kb: Math.round(enc.buf.length / 1024), q: enc.q, width: enc.width, action: 'fill', retired: `${b.sha1} (benched, moved to ${(b.movedTo || []).join(', ')})`, image, slots, enc, pos, b });
    }
  } else {
    if (draft.assignments.some((x) => x.condition === pos.set && x.time === pos.time && x.week === 'A' && x.day === pos.day)) {
      throw new Error(`${file}: ${pos.set} ${pos.time} ${pos.day} already has a photograph`);
    }
    const image = `${pos.set}/week_1/${pos.time}/${pos.index}.webp`;
    const slots = [1, 2, 3, 4].map((w) => `${pos.set}/week_${w}/${pos.time}/${pos.index}.webp`);
    rows.push({ file, hash, kb: Math.round(enc.buf.length / 1024), q: enc.q, width: enc.width, action: 'new', image, slots, enc, pos });
  }
}

console.log(`${DRY ? '[dry run] ' : ''}${rows.length} photographs (${SETS.map((s) => `${s} ${rows.filter((r) => r.file.startsWith(s + '/')).length}`).join(', ')})`);
console.log('| photograph | new hash | WebP | action | slots |');
console.log('|---|---|---|---|---|');
for (const r of rows) {
  const act = r.action === 'replace' ? `replaces ${r.retired}` : r.action === 'fill' ? `fills the slot of ${r.retired}` : 'new';
  console.log(`| ${r.file} | ${r.hash} | ${r.kb} KB q${r.q}${r.width ? ` ${r.width}w` : ''} | ${act} | ${r.slots.join(', ')} |`);
}
const missing = SETS.filter((s) => s !== 'cloudy').flatMap((s) => ['dawn', 'day', 'dusk', 'night'].flatMap((t) => [1, 2, 3, 4, 5, 6, 7]
  .map((i) => `${s}/${t}-${i}.png`))).filter((f) => !files.includes(f));
if (missing.length) console.log(`\nNot kept — these new-set slots would have no photograph, and the layout refuses an empty grid position:\n  ${missing.join(', ')}`);

if (DRY) process.exit(0);
if (missing.length) throw new Error(`${missing.length} new-set positions have no kept photograph; rule a replacement for each before writing`);
for (const r of rows) {
  const dest = path.join(BG, r.image);
  mkdirSync(path.dirname(dest), { recursive: true });
  writeFileSync(dest, r.enc.buf);
  if (sha12(readFileSync(dest)) !== r.hash) throw new Error(`${r.image}: write verification failed`);
  if (r.action === 'replace') {
    r.a.replacedHash = r.a.hash; r.a.hash = r.hash; r.a.source = `review/new-sets-2026-10-07/${r.file}`;
  } else if (r.action === 'fill') {
    draft.assignments.push({ condition: 'cloudy', time: r.pos.time, week: r.pos.week, day: r.pos.day, hash: r.hash, image: r.image, paths: [r.image],
      source: `review/new-sets-2026-10-07/${r.file}` });
    bench.benched = bench.benched.filter((x) => x !== r.b);
    (bench.retired ||= []).push({ ...r.b, retiredOn: '2026-10-07', retiredBecause: `its cloudy slots hold ${r.hash} from ${r.file} (Al's new sets)` });
  } else {
    draft.assignments.push({ condition: r.pos.set, time: r.pos.time, week: 'A', day: r.pos.day, hash: r.hash, image: r.image, paths: [r.image],
      source: `review/new-sets-2026-10-07/${r.file}` });
  }
}
draft.note = `${draft.note} | 2026-10-07: new sets ingested by scripts/ingest-new-sets.mjs (review/image-brief-2026-10-07.md) — `
  + `${rows.filter((r) => r.action === 'new').length} new partly-cloudy/breezy photographs at week A, `
  + `${rows.filter((r) => r.action === 'replace').length} cloudy photographs replaced by hash (replacedHash keeps the retired one).`;
writeFileSync(DRAFT, JSON.stringify(draft, null, 1));
if (rows.some((r) => r.action === 'fill')) writeFileSync(BENCH, JSON.stringify(bench, null, 1) + String.fromCharCode(10));
writeFileSync(path.join(root, 'review', 'ingest-2026-10-07-report.json'), JSON.stringify(rows.map(({ enc, a, pos, b, ...r }) => r), null, 1));
console.log(`\nwrote ${rows.length} WebPs and review/set-001-draft.json; report review/ingest-2026-10-07-report.json`);
