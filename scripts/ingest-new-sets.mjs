// Ingest the 7 Oct 2026 photo sets (review/image-brief-2026-10-07.md) — only the photographs Al keeps.
//
//   node scripts/ingest-new-sets.mjs --keep review/new-sets-lines-2026-10-07-ruled.json --dry-run
//   node scripts/ingest-new-sets.mjs --files partly-cloudy/dawn-1.png,breezy/day-3.png --dry-run
//   node scripts/ingest-new-sets.mjs --files <all kept> --cut breezy/dusk-5.png --fill breezy/dusk-5.png=breezy/dusk-2.png
//   (drop --dry-run to write)
//
// 8 Oct 2026 (Al's ruling: ingest the 68 that passed the quality loop, cut breezy/dusk-5): a real run now does the whole
// wiring itself, because scripts/layout-set-001-grid.mjs still asserts the 294-photograph grid of 6 Sept:
//   - writes the WebP into EVERY slot of its position (all four weeks for the new sets and for most cloudy positions);
//   - --cut <file> leaves a new-set position without its photograph, and --fill <cut>=<kept> serves another photograph
//     of the same set and time there (breezy has no week B to repeat; the fill is a dusk photograph whose line names no
//     weekday, so it stays true on the cut position's day);
//   - wires the line by the new hash: review/new-sets-lines-maat-2026-10-07.json (Maat's, Al's rulings) into
//     review/set-001-lines-bespoke-final.json (a retired cloudy photograph's lines leave with it), the Afrikaans into
//     assets/hero-lines-af.js and a row in review/af-bespoke-decisions.json;
//   - the face anchor scripts/anchor-faces.mjs chose for the file (review/new-sets-crop-2026-10-08.json) into
//     review/set-001-crop-offsets.json; a retired photograph's anchor entry is removed.
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
const all = (k) => args.flatMap((a, i) => (a === k ? [args[i + 1]] : []));
const CUT = new Set(all('--cut'));
const FILL = new Map(all('--fill').map((f) => f.split('=')));

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
  .map((i) => `${s}/${t}-${i}.png`))).filter((f) => !files.includes(f) && !(CUT.has(f) && files.includes(FILL.get(f))));
for (const [cut, by] of FILL) console.log(`\nCut: ${cut} — its slots serve ${by}`);
if (missing.length) console.log(`\nNot kept — these new-set slots would have no photograph, and the layout refuses an empty grid position:\n  ${missing.join(', ')}`);

if (DRY) process.exit(0);
if (missing.length) throw new Error(`${missing.length} new-set positions have no kept photograph; rule a replacement for each before writing`);
const maat = JSON.parse(readFileSync(path.join(root, 'review', 'new-sets-lines-maat-2026-10-07.json'), 'utf8')).lines;
const faceCrops = JSON.parse(readFileSync(path.join(root, 'review', 'new-sets-crop-2026-10-08.json'), 'utf8')).anchors;
const finalPath = path.join(root, 'review', 'set-001-lines-bespoke-final.json');
const offsetsPath = path.join(root, 'review', 'set-001-crop-offsets.json');
const decisionsPath = path.join(root, 'review', 'af-bespoke-decisions.json');
const afPath = path.join(root, 'assets', 'hero-lines-af.js');
const final = JSON.parse(readFileSync(finalPath, 'utf8'));
const offsets = JSON.parse(readFileSync(offsetsPath, 'utf8'));
const decisions = JSON.parse(readFileSync(decisionsPath, 'utf8'));
const afRows = new Map();
// A fill: the cut position's slots take the kept photograph's bytes.
for (const [cut, by] of FILL) {
  const host = rows.find((r) => r.file === by);
  const c = position(cut);
  if (!host || host.pos?.set !== c.set || host.pos?.time !== c.time) throw new Error(`--fill ${cut}=${by}: not a kept photograph of the same set and time`);
  host.slots.push(...[1, 2, 3, 4].map((w) => `${c.set}/week_${w}/${c.time}/${c.index}.webp`));
}
for (const r of rows) {
  for (const rel of r.slots) {
    const dest = path.join(BG, ...rel.split('/'));
    mkdirSync(path.dirname(dest), { recursive: true });
    writeFileSync(dest, r.enc.buf);
    if (sha12(readFileSync(dest)) !== r.hash) throw new Error(`${rel}: write verification failed`);
  }
  const line = maat[r.file];
  if (!line?.en || !line?.af) throw new Error(`${r.file}: no line in review/new-sets-lines-maat-2026-10-07.json`);
  afRows.set(line.en, line.af);
  decisions.rows.push({ id: `NS-${r.file.replace(/\.png$/, '').replace('/', '-')}`, group: 'new-sets-2026-10-07', verdict: 'AL',
    slot: `${r.file.split('/')[0]}/${r.file.split('/')[1].split('-')[0]}`, english: line.en, afrikaans: line.af, score: null,
    reason: "Maat's line for the new photograph, ruled by Al (8 Oct 2026); written straight to assets/hero-lines-af.js by scripts/ingest-new-sets.mjs" });
  const face = faceCrops[r.file];
  if (face && typeof face.anchorY === 'number') {
    offsets.offsets[r.hash] = { verdict: 'FACE', bucket: `${r.file.split('/')[0]}-${r.file.split('/')[1].split('-')[0]}`, image: r.slots[0], anchorY: face.anchorY,
      faceAnchor: { on: '2026-10-08', by: 'scripts/anchor-faces.mjs', reason: 'a face under the number or the joke at the default on 414x715' } };
  }
  if (r.action === 'replace') {
    for (const x of draft.assignments.filter((x) => x.hash === r.retired)) {
      x.replacedHash = x.hash; x.hash = r.hash; x.source = `review/new-sets-2026-10-07/${r.file}`;
    }
    const fe = final.set.find((e) => e.hash === r.retired);
    if (fe) { fe.retiredLines = fe.lines; fe.replacedHash = fe.hash; fe.hash = r.hash; fe.lines = [line.en]; fe.source = `review/new-sets-2026-10-07/${r.file}`; }
    else final.set.push({ image: r.image, hash: r.hash, condition: 'cloudy', time: r.a.time, week: r.a.week, day: r.a.day, paths: r.slots, lines: [line.en] });
    delete offsets.offsets[r.retired];
  } else if (r.action === 'fill') {
    draft.assignments.push({ condition: 'cloudy', time: r.pos.time, week: r.pos.week, day: r.pos.day, hash: r.hash, image: r.image, paths: r.slots,
      source: `review/new-sets-2026-10-07/${r.file}` });
    final.set.push({ image: r.image, hash: r.hash, condition: 'cloudy', time: r.pos.time, week: r.pos.week, day: r.pos.day, paths: r.slots, lines: [line.en] });
    bench.benched = bench.benched.filter((x) => x !== r.b);
    (bench.retired ||= []).push({ ...r.b, retiredOn: '2026-10-07', retiredBecause: `its cloudy slots hold ${r.hash} from ${r.file} (Al's new sets)` });
  } else {
    draft.assignments.push({ condition: r.pos.set, time: r.pos.time, week: 'A', day: r.pos.day, hash: r.hash, image: r.image, paths: r.slots,
      source: `review/new-sets-2026-10-07/${r.file}` });
    final.set.push({ image: r.image, hash: r.hash, condition: r.pos.set, time: r.pos.time, week: 'A', day: r.pos.day, paths: r.slots, lines: [line.en] });
  }
}
draft.note = `${draft.note} | 2026-10-07: new sets ingested by scripts/ingest-new-sets.mjs (review/image-brief-2026-10-07.md) — `
  + `${rows.filter((r) => r.action === 'new').length} new partly-cloudy/breezy photographs at week A, `
  + `${rows.filter((r) => r.action === 'replace').length} cloudy photographs replaced by hash (replacedHash keeps the retired one).`;
writeFileSync(DRAFT, JSON.stringify(draft, null, 1));
final.note = `${final.note} | 2026-10-08: the 7 Oct sets ingested (scripts/ingest-new-sets.mjs) — one line each, Maat's, ruled by Al; a replaced cloudy photograph keeps its old lines under retiredLines.`;
writeFileSync(finalPath, JSON.stringify(final, null, 1) + '\n');
offsets.counts.wired = Object.values(offsets.offsets).filter((o) => typeof o.anchorY === 'number').length;
offsets.counts.offsets = Object.keys(offsets.offsets).length;
offsets.newSets = { on: '2026-10-08', anchored: rows.filter((r) => typeof faceCrops[r.file]?.anchorY === 'number').length, from: 'review/new-sets-crop-2026-10-08.json' };
writeFileSync(offsetsPath, JSON.stringify(offsets, null, 1) + '\n');
writeFileSync(decisionsPath, JSON.stringify(decisions, null, 1) + '\n');
// assets/hero-lines-af.js: its generator (scripts/lang-check/apply-af-accepted.mjs) is stale since 30 Sept and would drop
// later rulings, so the new rows are added to the table in place, keeping its sorted order.
const afSrc = readFileSync(afPath, 'utf8');
const open = afSrc.indexOf('export const HERO_LINES_AF = {'), close = afSrc.indexOf('\n};', open);
const table = JSON.parse(afSrc.slice(open + 'export const HERO_LINES_AF = '.length, close + 2));
for (const [en, af] of afRows) table[en] = af;
// A line that left with a replaced cloudy photograph and is wired nowhere else leaves the table (the gate's rule:
// keyed only by wired English lines).
const liveEn = new Set(final.set.flatMap((e) => e.lines));
for (const en of Object.keys(table)) if (!liveEn.has(en)) delete table[en];
const body = Object.keys(table).sort().map((k) => ` ${JSON.stringify(k)}: ${JSON.stringify(table[k])}`).join(',\n');
writeFileSync(afPath, `${afSrc.slice(0, open)}export const HERO_LINES_AF = {\n${body}\n};${afSrc.slice(close + 3)}`);
if (rows.some((r) => r.action === 'fill')) writeFileSync(BENCH, JSON.stringify(bench, null, 1) + String.fromCharCode(10));
writeFileSync(path.join(root, 'review', 'ingest-2026-10-07-report.json'), JSON.stringify(rows.map(({ enc, a, pos, b, ...r }) => r), null, 1));
console.log(`\nwrote ${rows.length} WebPs and review/set-001-draft.json; report review/ingest-2026-10-07-report.json`);
