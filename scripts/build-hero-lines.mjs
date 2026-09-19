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
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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
