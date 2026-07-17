// Apply the approved meme-batch-2 lines for the WIRED-184 concepts (Al's ruling)
// into the witty copy bank + witty-day-tags, with zu/xh/st as provisional "" debt.
//
// Guarantees:
//   - en/af written VERBATIM from review/meme-batch-2-rulings.json (alignment audit proves it).
//   - zu/xh/st = "" (row-aligned placeholder; dayAwarePool filters empties). No fabrication.
//   - Tags mapped ONLY from the batch's own tag strings to real witty-day-tags vocabulary.
//     Unmappable tags are listed, never invented. region:any => no tag.
//   - Row-alignment (all 5 langs equal length per condition) preserved.
//
// Usage: node review/tools/apply-lines.mjs           (plan only -> review/line-apply-audit.json)
//        node review/tools/apply-lines.mjs --apply    (mutate files, then verify)

import fs from 'node:fs';
import { WEATHER_COPY } from '../../assets/weather-copy.js';

const APPLY = process.argv.includes('--apply');
const rulings = JSON.parse(fs.readFileSync('review/meme-batch-2-rulings.json', 'utf8')).rulings;
const wiredIds = new Set(JSON.parse(fs.readFileSync('review/image-picks.json', 'utf8')).picks.map((p) => p.id));

// Layer-1 regional-honesty re-tag (owner ruling). Keyed by EN text.
const retag = JSON.parse(fs.readFileSync('review/inland-retag-audit.json', 'utf8'));
const HELD = new Set(retag.rows.filter((r) => r.decision === 'HELD').map((r) => r.en));
const REGION_OVERRIDE = new Map(retag.rows.filter((r) => r.decision === 'TAG').map((r) => [r.en, r.region]));

// --- tag mapping: batch string -> real witty-day-tags entry (or unmappable) ---
const REGION = { 'western-cape': 'western-cape', gauteng: 'gauteng', karoo: 'karoo' };
const WINTER_MONTHS = [5, 6, 7, 8, 9];
const SUMMER_MONTHS = [10, 11, 12, 1, 2, 3];
const TIME = { dawn: 'morning', day: 'day', dusk: 'evening', evening: 'evening', morning: 'morning', night: 'night' };

const unmappable = new Map(); // tag string -> count

function mapTags(tags) {
  const entry = {};
  for (const raw of tags || []) {
    if (raw === 'region:any') continue; // any = absent
    // inland/kzn/eastern-cape are resolved by the retag audit (region added below or
    // line held), so don't count them as unmappable here.
    if (raw === 'region:inland' || raw === 'region:kzn' || raw === 'region:eastern-cape') continue;
    if (raw === 'weekend') { entry.day = 'weekend'; continue; }
    const [kind, val] = raw.split(':');
    if (kind === 'region') {
      if (REGION[val]) entry.region = REGION[val];
      else unmappable.set(raw, (unmappable.get(raw) || 0) + 1);
    } else if (kind === 'season') {
      if (val === 'winter') entry.months = WINTER_MONTHS;
      else if (val === 'summer') entry.months = SUMMER_MONTHS;
      else unmappable.set(raw, (unmappable.get(raw) || 0) + 1);
    } else if (kind === 'time') {
      if (TIME[val]) entry.time = [...(entry.time || []), TIME[val]];
      else unmappable.set(raw, (unmappable.get(raw) || 0) + 1);
    } else {
      unmappable.set(raw, (unmappable.get(raw) || 0) + 1);
    }
  }
  // de-dupe time slots
  if (entry.time) entry.time = [...new Set(entry.time)];
  return Object.keys(entry).length ? entry : null;
}

// --- collect new lines per condition, in deterministic concept-id order ---
const wired = rulings
  .filter((r) => r.verdict === 'YES' && wiredIds.has(r.id) && (r.lines || []).length)
  .sort((a, b) => a.id.localeCompare(b.id));

const perCondition = new Map(); // cond -> [{ en, af, tagEntry, srcId, srcTags }]
let heldCount = 0;
for (const concept of wired) {
  for (const line of concept.lines) {
    if (HELD.has(line.en)) { heldCount++; continue; } // Layer-1: no honest region box -> hold
    let tagEntry = mapTags(line.tags);
    if (REGION_OVERRIDE.has(line.en)) { tagEntry = tagEntry || {}; tagEntry.region = REGION_OVERRIDE.get(line.en); }
    if (!perCondition.has(concept.condition)) perCondition.set(concept.condition, []);
    perCondition.get(concept.condition).push({
      en: line.en, af: line.af, tagEntry, srcId: concept.id, srcTags: line.tags || [],
    });
  }
}
console.log('held (no-box region, excluded):', heldCount, '| region-overrides applied:', REGION_OVERRIDE.size);

// --- build the audit + the concrete additions (new indices per condition) ---
const audit = { generated_from: 'review/meme-batch-2-rulings.json', scope: 'wired-184', conditions: {}, unmappable_tags: {}, tag_additions: {} };
const additions = new Map(); // cond -> { newEn:[], newAf:[], newZu:[], tags: {idx:entry} }

for (const [cond, lines] of [...perCondition.entries()].sort()) {
  const bank = WEATHER_COPY.witty[cond];
  if (!bank || !Array.isArray(bank.en)) throw new Error(`witty.${cond} missing or not an array bank`);
  const base = bank.en.length;
  const add = { newLines: [], tags: {} };
  lines.forEach((ln, i) => {
    const idx = base + i;
    add.newLines.push(ln);
    if (ln.tagEntry) add.tags[idx] = ln.tagEntry;
  });
  additions.set(cond, add);
  audit.conditions[cond] = { existing: base, added: lines.length, newTotal: base + lines.length,
    lines: lines.map((ln, i) => ({ index: base + i, en: ln.en, af: ln.af, from: ln.srcId, batchTags: ln.srcTags, mappedTag: ln.tagEntry })) };
  if (Object.keys(add.tags).length) audit.tag_additions[cond] = add.tags;
}
audit.unmappable_tags = Object.fromEntries(unmappable);
audit.totals = { concepts: wired.length, lines: [...perCondition.values()].reduce((a, l) => a + l.length, 0),
  conditions: perCondition.size, tagged: Object.values(audit.tag_additions).reduce((a, o) => a + Object.keys(o).length, 0) };

fs.writeFileSync('review/line-apply-audit.json', JSON.stringify(audit, null, 2));
console.log('scope wired-184 |', audit.totals.lines, 'lines across', audit.totals.conditions, 'conditions |', audit.totals.tagged, 'tagged');
console.log('unmappable tags (listed, not invented):', unmappable.size ? Object.fromEntries(unmappable) : 'none');
console.log('wrote review/line-apply-audit.json');

if (!APPLY) { console.log('\nPLAN ONLY — no files mutated. Re-run with --apply.'); process.exit(0); }

// ---------------------------------------------------------------------------
// APPLY: precise textual insertion into weather-copy.js + witty-day-tags.js
// ---------------------------------------------------------------------------
const jstr = (s) => JSON.stringify(s); // safe JS string literal (handles ' " ê etc.)

// 1) weather-copy.js — append to each target condition's 5 language arrays.
let copySrc = fs.readFileSync('assets/weather-copy.js', 'utf8');
const EOL = copySrc.includes('\r\n') ? '\r\n' : '\n';
const copyLines = copySrc.split(EOL);
let curCond = null;
const condHeader = /^    '?([a-z][a-z-]*)'?: \{$/;  // 4-space condition key (quoted or bare) inside witty
const langArray = /^(      (en|af|zu|xh|st): )\[(.*)\](,?)$/;
let insideWitty = false;
for (let i = 0; i < copyLines.length; i++) {
  const line = copyLines[i];
  if (line === '  witty: {') { insideWitty = true; continue; }
  if (insideWitty && line === '  },') { insideWitty = false; curCond = null; continue; }
  if (!insideWitty) continue;
  const ch = condHeader.exec(line);
  if (ch) { curCond = ch[1]; continue; }
  if (!curCond || !additions.has(curCond)) continue;
  const m = langArray.exec(line);
  if (!m) continue;
  const lang = m[2];
  const add = additions.get(curCond);
  const items = add.newLines.map((ln) => (lang === 'en' ? jstr(ln.en) : lang === 'af' ? jstr(ln.af) : '""'));
  const inner = m[3];
  copyLines[i] = `${m[1]}[${inner}, ${items.join(', ')}]${m[4]}`;
}
fs.writeFileSync('assets/weather-copy.js', copyLines.join(EOL));
console.log('mutated assets/weather-copy.js');

// 2) witty-day-tags.js — add `<idx>: {entry},` lines into each condition block under `  witty: {`.
//    Add a new condition block for any tagged condition not already present.
let tagSrc = fs.readFileSync('assets/witty-day-tags.js', 'utf8');
const TEOL = tagSrc.includes('\r\n') ? '\r\n' : '\n';
const tagLines = tagSrc.split(TEOL);
const entryLiteral = (e) => {
  const parts = [];
  if (e.day) parts.push(`day: '${e.day}'`);
  if (e.time) parts.push(`time: [${e.time.map((t) => `'${t}'`).join(', ')}]`);
  if (e.region) parts.push(`region: '${e.region}'`);
  if (e.months) parts.push(`months: [${e.months.join(', ')}]`);
  return `{ ${parts.join(', ')} }`;
};
// find the `  witty: {` ... matching `  },` block (the first top-level group)
let wittyStart = tagLines.findIndex((l) => l === '  witty: {');
if (wittyStart === -1) throw new Error('witty-day-tags: could not find "  witty: {"');
let wittyEnd = -1;
for (let i = wittyStart + 1; i < tagLines.length; i++) { if (tagLines[i] === '  },') { wittyEnd = i; break; } }
if (wittyEnd === -1) throw new Error('witty-day-tags: could not find witty block end');

// map existing condition header -> its line index within the witty block
const condLineOf = {};
for (let i = wittyStart + 1; i < wittyEnd; i++) {
  const ch = /^    '?([a-z][a-z-]*)'?: \{$/.exec(tagLines[i]);
  if (ch) condLineOf[ch[1]] = i;
}
// Insert entries. Process from bottom to top so indices stay valid.
const tagConds = Object.keys(audit.tag_additions);
// Build blocks for missing conditions, appended just before wittyEnd.
const missing = tagConds.filter((c) => !(c in condLineOf));
// Existing conditions: insert entry lines right after their header line.
const insertions = []; // { at, textLines }
for (const cond of tagConds) {
  if (!(cond in condLineOf)) continue;
  const entries = audit.tag_additions[cond];
  const text = Object.entries(entries).map(([idx, e]) => `      ${idx}: ${entryLiteral(e)},`);
  insertions.push({ at: condLineOf[cond] + 1, textLines: text });
}
insertions.sort((a, b) => b.at - a.at);
for (const ins of insertions) tagLines.splice(ins.at, 0, ...ins.textLines);
// Recompute wittyEnd after inserts for appending missing-condition blocks.
wittyEnd = tagLines.findIndex((l, i) => i > wittyStart && l === '  },');
for (const cond of missing) {
  const key = /^[a-z][\w]*$/.test(cond) ? cond : `'${cond}'`;
  const entries = audit.tag_additions[cond];
  const block = [`    ${key}: {`, ...Object.entries(entries).map(([idx, e]) => `      ${idx}: ${entryLiteral(e)},`), '    },'];
  tagLines.splice(wittyEnd, 0, ...block);
  wittyEnd += block.length;
}
fs.writeFileSync('assets/witty-day-tags.js', tagLines.join(TEOL));
console.log('mutated assets/witty-day-tags.js', missing.length ? `(added blocks: ${missing.join(', ')})` : '');
console.log('\nAPPLIED. Run the verifier next: node review/tools/verify-lines.mjs');
