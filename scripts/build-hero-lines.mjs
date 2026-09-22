// Expand Al's approved bespoke lines into the runtime lookup table.
//
// AUTHORING key is the image hash — the stable identity of the bytes. One hash
// can occupy several rotation slots and must carry the same lines in all of
// them, because the lines were written about the photograph.
// RUNTIME keys are BOTH shapes the picker can emit, for the same reason
// build-hero-crop-offsets.mjs emits both:
//   source tree / preview  ->  bg/<condition>/week_N/<time>/<n>.webp
//   production             ->  bg-canonical/<sha256 of the bytes>.webp
//
// Reads  review/set-001-lines-bespoke-final.json  (hash -> approved lines)
//        review/set-001-draft.json                (hash -> every slot path)
//        assets/weather-copy.js + witty-day-tags.js (bank tags of lines that came from the bank)
//        review/seasonal-tags-ruled.json          (Al's season rulings, when exported)
// Writes assets/hero-lines.js between its generated markers: HERO_LINES, and
// HERO_LINE_TAGS — English line -> { months?, region? } for app.js's season and
// place gate (2026-09-19). A bank line keeps the months/region tag it has in the
// bank; Al's ruling on a line overrides it (ALWAYS clears it). Day and time tags
// are not carried: the photograph's slot already fixes weekday and time of day.
//
// Deliberately NOT wired into `npm run build`, exactly as the crop table is not:
// lines ship when Al has ruled on them, not when someone runs a build.
//
//   node scripts/build-hero-lines.mjs [--check]
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WEATHER_COPY } from '../assets/weather-copy.js';
import { WITTY_DAY_TAGS } from '../assets/witty-day-tags.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const CHECK = process.argv.includes('--check');

const approved = JSON.parse(readFileSync(path.join(root, 'review', 'set-001-lines-bespoke-final.json'), 'utf8'));
const draft = JSON.parse(readFileSync(path.join(root, 'review', 'set-001-draft.json'), 'utf8'));

const pathsByHash = new Map();
for (const a of draft.assignments) {
  pathsByHash.set(a.hash, [...new Set([a.image, ...(a.paths || [])])]);
}

const rows = [];
const problems = [];
for (const entry of approved.set || []) {
  const { hash, lines } = entry;
  if (!Array.isArray(lines) || !lines.length) { problems.push(`${hash}: no approved lines`); continue; }
  for (const line of lines) {
    if (typeof line !== 'string' || !line.trim()) { problems.push(`${hash}: an empty line`); break; }
  }
  const paths = pathsByHash.get(hash);
  if (!paths) { problems.push(`${hash} (${entry.image}): not present in set-001-draft.json`); continue; }

  for (const p of paths) {
    let bytes;
    try { bytes = readFileSync(path.join(root, 'assets', 'images', 'bg', ...p.split('/'))); }
    catch { problems.push(`${hash}: slot ${p} is not on disk`); continue; }

    // REROLL GUARD, and it matters more here than it does for a crop. A crop
    // ruled about one photograph and applied to another is an ugly frame; a
    // JOKE written about one photograph and applied to another is the exact
    // failure that made Al reject ten lines on 2026-08-18, when two briefs were
    // transposed and bin-day lines landed on a man in a suit. Recomputing the
    // authoring hash from the bytes on disk makes that loud instead of funny.
    const actual = createHash('sha1').update(bytes).digest('hex').slice(0, 12);
    if (actual !== hash) {
      problems.push(`${hash}: slot ${p} now holds different bytes (sha1-12 ${actual}) — these lines were written about another photograph; re-review them`);
      continue;
    }

    rows.push([`bg/${p}`, lines]);
    rows.push([`bg-canonical/${createHash('sha256').update(bytes).digest('hex')}.webp`, lines]);
  }
}

// ---- RULING DRIFT GUARD ------------------------------------------------------
// The guard above catches a SLOT whose bytes moved under its lines. It cannot
// catch a RULING whose photograph moved under it, and that is the one that cost
// a wrong verdict on 2026-09-20: Al's drag export named
// `rain/week_2/day/5.webp` + `3bd49d0acf2b`, the reroll put a different
// photograph in that slot, and nothing said so — the provenance split read the
// stale pairing as "no record" and three of Al's own lines went onto a cull page
// labelled unruled.
//
// THE TEST IS THE HASH, NOT THE SLOT. `99f7b2a` re-laid the whole grid on
// 2026-09-06, so almost every export names a slot the photograph has since left
// — and that is harmless, because the lines are attached by hash and the hash is
// still a photograph in the set. What is NOT harmless is a ruling whose
// PHOTOGRAPH is gone: a reroll replaced it, the lines were carried onto the
// replacement, and the ruling now describes a picture nobody can see. So:
//
//   fail when a ruling's photograph hash is absent from the live set while lines
//   from that ruling are still live — naming the slot, the ruled hash, and the
//   hash that is in that slot now.
//
// A ruling none of whose lines survive is history, not a defect.
const liveLines = new Set((approved.set || []).flatMap((e) => e.lines));
const livePhotographs = new Set((approved.set || []).map((e) => e.hash));
const hashOfSlot = new Map();
const slotHash = (p) => {
  if (!hashOfSlot.has(p)) {
    try { hashOfSlot.set(p, createHash('sha1').update(readFileSync(path.join(root, 'assets', 'images', 'bg', ...p.split('/')))).digest('hex').slice(0, 12)); }
    catch { hashOfSlot.set(p, null); }
  }
  return hashOfSlot.get(p);
};
// (file, slot, hash, lines) out of every shape a ruled export uses.
function* rulings() {
  const dir = path.join(root, 'review');
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    let j;
    try { j = JSON.parse(readFileSync(path.join(dir, f), 'utf8')); } catch { continue; }
    if (!j || typeof j !== 'object' || Array.isArray(j)) continue;
    // Array.isArray on every one of these: `images` is a COUNT in the authoring
    // file and an array of photographs in a ruled export.
    if (Array.isArray(j.images)) for (const im of j.images) {
      if (im?.image && im?.hash) yield [f, im.image, im.hash, (Array.isArray(im.kept) ? im.kept : []).map((l) => l.text)];
    }
    if (Array.isArray(j.matchDetail)) for (const m of j.matchDetail) {
      if (m?.image && m?.hash) yield [f, m.image, m.hash, (Array.isArray(m.lines) ? m.lines : []).map((l) => l.text)];
    }
    if (Array.isArray(j.rescued)) for (const r of j.rescued) {
      if (r?.image && r?.hash) yield [f, r.image, r.hash, [r.text]];
    }
    // slot-fill rulings (review/slot-fill-<slot>-ruled.json): one photograph, the lines Al chose for it.
    if (j.slot?.hash && j.slot?.image && Array.isArray(j.chosen)) yield [f, j.slot.image, j.slot.hash, j.chosen.map((c) => c.text)];
  }
  for (const d of readdirSync(path.join(dir, 'reroll-candidates'), { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    let j;
    try { j = JSON.parse(readFileSync(path.join(dir, 'reroll-candidates', d.name, 'candidates.json'), 'utf8')); } catch { continue; }
    if (j?.slot && j?.chosen?.hash) yield [`reroll-candidates/${d.name}/candidates.json`, j.slot, j.chosen.hash, j.lines || []];
  }
}
const drifted = new Map();   // ruledHash -> {slot, ruled, actual, files, lines}
for (const [file, slot, hash, lines] of rulings()) {
  if (livePhotographs.has(hash)) continue;
  const live = lines.filter((t) => liveLines.has(t));
  if (!live.length) continue;
  if (!drifted.has(hash)) drifted.set(hash, { slot, ruled: hash, actual: slotHash(slot), files: new Set(), lines: new Set() });
  const d = drifted.get(hash);
  d.files.add(file);
  for (const t of live) d.lines.add(t);
}
for (const d of drifted.values()) {
  problems.push(`RULING DRIFT — ${d.slot} was ruled on photograph ${d.ruled}, which is no longer in the set;`
    + ` that slot now holds ${d.actual || '(nothing on disk)'}.`
    + ` ${d.lines.size} live line(s) still rest on that ruling (${[...d.files].join(', ')}):`
    + ` ${[...d.lines].slice(0, 3).map((t) => JSON.stringify(t)).join(', ')}${d.lines.size > 3 ? ', …' : ''}.`
    + ' Re-rule them against the photograph that replaced it, or cut them.');
}

// The authoring entry's own image/paths are annotation, not the slot map: the
// generated table paths by hash through set-001-draft.json. They must still
// agree, because a downstream tool that trusts them reads the wrong picture —
// which is exactly what happened on 2026-09-20.
for (const entry of approved.set || []) {
  const cur = pathsByHash.get(entry.hash);
  if (!cur) continue;
  const own = [...new Set([entry.image, ...(entry.paths || [])])];
  if (own.length === cur.length && own.every((p) => cur.includes(p))) continue;
  problems.push(`SLOT FIELD DRIFT — ${entry.hash} is annotated ${JSON.stringify(own)} but set-001-draft.json puts it at ${JSON.stringify(cur)}.`
    + ' Run scripts/sync-authoring-slots.mjs; the draft is the slot map.');
}

if (problems.length) {
  console.error('[hero-lines] refusing to generate:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

// One hash occupies several slots that share bytes, so the canonical key is
// emitted once per slot and de-duplicated. Two DIFFERENT line sets on one key
// would be two rulings disagreeing about one photograph — surface it.
const seen = new Map();
const conflicts = [];
for (const [k, lines] of rows) {
  const prev = seen.get(k);
  if (prev && JSON.stringify(prev) !== JSON.stringify(lines)) {
    conflicts.push(`${k}: two different line sets for the same photograph`);
  }
  seen.set(k, lines);
}
if (conflicts.length) {
  console.error('[hero-lines] refusing to generate:');
  for (const c of conflicts) console.error(`  - ${c}`);
  process.exit(1);
}

const keys = [...seen.keys()].sort((a, b) => a.localeCompare(b));
const body = keys.length
  ? keys.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(seen.get(k))},`).join('\n')
  : '  // (none approved yet)';
const generated = `  // __HERO_LINES__  (generated — do not hand-edit)\n${body}`;

// ---- HERO_LINE_TAGS: English line -> { months?, region? } -------------------
// 1. A line that came from the condition bank keeps the months/region tag its
//    bank row carries (the 77 tags the bespoke path used to drop).
// 2. Al's season rulings (review/seasonal-tags-ruled.json) override the months:
//    ALWAYS clears them, a window or a season sets them. A region stays.
const approvedLines = new Set((approved.set || []).flatMap((e) => e.lines));
const seasonTag = (t) => {
  if (!t || typeof t !== 'object') return null;
  const out = {};
  if (Array.isArray(t.months) && t.months.length) out.months = [...t.months].sort((a, b) => a - b);
  if (t.region) out.region = t.region;
  return Object.keys(out).length ? out : null;
};
const lineTags = new Map();
const tagProblems = [];
let fromBank = 0;
for (const ns of ['witty', 'witty_low_confidence']) {
  for (const [bin, langs] of Object.entries(WEATHER_COPY[ns] || {})) {
    (Array.isArray(langs?.en) ? langs.en : []).forEach((text, i) => {
      if (!approvedLines.has(text)) return;
      const tag = seasonTag(WITTY_DAY_TAGS[ns]?.[bin]?.[i]);
      if (lineTags.has(text) && JSON.stringify(lineTags.get(text)) !== JSON.stringify(tag)) {
        tagProblems.push(`"${text}": ${ns}:${bin}#${i} disagrees with another bank row about its months/region`);
      }
      lineTags.set(text, tag);
    });
  }
}
for (const t of lineTags.values()) if (t) fromBank += 1;
const RULED = path.join(root, 'review', 'seasonal-tags-ruled.json');
let fromAl = 0;
if (existsSync(RULED)) {
  for (const r of JSON.parse(readFileSync(RULED, 'utf8')).rulings || []) {
    if (r.kind !== 'bespoke') continue; // bank rows are ruled in witty-day-tags.js and flow in through step 1
    if (!approvedLines.has(r.en)) { tagProblems.push(`ruled line is not an approved bespoke line: "${r.en}"`); continue; }
    const region = lineTags.get(r.en)?.region;
    let months = null;
    if (r.ruling === 'MONTHS' || r.ruling === 'SEASON') {
      months = [...new Set(r.months || [])].filter((m) => Number.isInteger(m) && m >= 1 && m <= 12).sort((a, b) => a - b);
      if (!months.length || months.length === 12) { tagProblems.push(`"${r.en}": ruling ${r.ruling} with no usable month window`); continue; }
    } else if (r.ruling !== 'ALWAYS') { tagProblems.push(`"${r.en}": unknown ruling ${r.ruling}`); continue; }
    lineTags.set(r.en, seasonTag({ months, region }));
    fromAl += 1;
  }
}
if (tagProblems.length) {
  console.error('[hero-lines] refusing to generate tags:');
  for (const p of tagProblems) console.error(`  - ${p}`);
  process.exit(1);
}
const tagRows = [...lineTags].filter(([, t]) => t).sort(([a], [b]) => a.localeCompare(b));
const tagBody = tagRows.map(([l, t]) => `  ${JSON.stringify(l)}: ${JSON.stringify(t)},`).join('\n');

const modulePath = path.join(root, 'assets', 'hero-lines.js');
const src = readFileSync(modulePath, 'utf8');
const BLOCK = /( *\/\/ __HERO_LINES__[^\n]*\n?)(?:[^}]*)/;
const TAG_BLOCK = /( *\/\/ __HERO_LINE_TAGS__ begin[^\n]*\n)[\s\S]*?( *\/\/ __HERO_LINE_TAGS__ end)/;
if (!BLOCK.test(src) || !TAG_BLOCK.test(src)) {
  console.error('[hero-lines] could not find the generated block markers in assets/hero-lines.js');
  process.exit(1);
}
const next = src
  .replace(BLOCK, () => `${generated}\n`)
  .replace(TAG_BLOCK, (_, open, close) => `${open}${tagBody ? `${tagBody}\n` : ''}${close}`);

const nLines = [...seen.values()].reduce((n, l) => n + l.length, 0);
const tagSummary = `${tagRows.length} season/place tags (${fromBank} from the bank, ${fromAl} ruled by Al)`;
if (CHECK) {
  if (next !== src) {
    console.error('[hero-lines] assets/hero-lines.js is out of sync with its sources (final.json, the bank tags, seasonal-tags-ruled.json)');
    process.exit(1);
  }
  console.log(`[hero-lines] in sync — ${keys.length} keys, ${nLines} line slots, from ${(approved.set || []).length} photographs; ${tagSummary}.`);
} else {
  writeFileSync(modulePath, next, 'utf8');
  console.log(`[hero-lines] wrote ${keys.length} keys (${nLines} line slots) from ${(approved.set || []).length} photographs into assets/hero-lines.js; ${tagSummary}`);
}
