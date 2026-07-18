// unhold-region-lines.mjs — un-hold the 10 no-box-region lines now that geo-regions.js
// has lowveld / kzn / eastern-cape boxes.
//
// Why a bespoke script and not a re-run of apply-lines.mjs: apply-lines is NOT idempotent
// (it appends to the CURRENT bank length), and the 476 meme-batch-2 lines are already
// applied. So this appends ONLY the 10-line delta, mirroring apply-lines' guarantees:
//   - en/af written VERBATIM from review/meme-batch-2-rulings.json
//   - zu/xh/st = "" (row-aligned provisional debt placeholder)
//   - tags mapped ONLY from each line's own batch tag strings (time/season) + the owner's
//     region resolution (recorded as decision:TAG in inland-retag-audit.json)
//   - row-alignment preserved; review/line-apply-audit.json extended (not rebuilt) so the
//     existing 476-line audit coverage is retained and verify-lines checks all 486.
// Idempotent: any line whose EN is already in the bank is skipped.
//
// Usage: node review/tools/unhold-region-lines.mjs            (dry run)
//        node review/tools/unhold-region-lines.mjs --apply     (mutate + records the ruling)

import fs from 'node:fs';
import { WEATHER_COPY } from '../../assets/weather-copy.js';

const APPLY = process.argv.includes('--apply');

// Owner region resolution for the 10 held lines (by EN, from content). These regions now
// exist as boxes in geo-regions.js.
const RESOLUTION = new Map([
  ["Midlands mist: the countryside's privacy setting.", 'kzn'],
  ["Walk now or don't walk at all. The Lowveld gives you until seven.", 'lowveld'],
  ['Even the impala are standing in the shade rethinking their choices.', 'lowveld'],
  ["Lowveld summer: you don't sweat, you melt with dignity.", 'lowveld'],
  ['The bushveld is on silent mode today. Everyone. Everything.', 'lowveld'],
  ["Sundowners aren't a luxury in the Lowveld. They're medical.", 'lowveld'],
  ['Gqeberha, we know. We know.', 'eastern-cape'],
  ['The Friendly City never asked to be the Windy City, and yet.', 'eastern-cape'],
  ['Jeffreys Bay: where the wind warms up before its Cape Town shift.', 'eastern-cape'],
  ["Gqeberha doesn't sleep, it just holds on.", 'eastern-cape'],
]);

// --- tag mapping: identical to apply-lines.mjs, region set from the owner resolution ---
const WINTER_MONTHS = [5, 6, 7, 8, 9];
const SUMMER_MONTHS = [10, 11, 12, 1, 2, 3];
const TIME = { dawn: 'morning', day: 'day', dusk: 'evening', evening: 'evening', morning: 'morning', night: 'night' };
function mapTags(tags, region) {
  const entry = {};
  for (const raw of tags || []) {
    if (raw === 'region:any') continue;
    if (raw.startsWith('region:')) continue; // region comes from the owner resolution, below
    if (raw === 'weekend') { entry.day = 'weekend'; continue; }
    const [kind, val] = raw.split(':');
    if (kind === 'season') { if (val === 'winter') entry.months = WINTER_MONTHS; else if (val === 'summer') entry.months = SUMMER_MONTHS; }
    else if (kind === 'time') { if (TIME[val]) entry.time = [...(entry.time || []), TIME[val]]; }
  }
  if (entry.time) entry.time = [...new Set(entry.time)];
  entry.region = region;
  return entry;
}

// --- collect the held lines from the rulings, in apply-lines' deterministic order ---
const rulings = JSON.parse(fs.readFileSync('review/meme-batch-2-rulings.json', 'utf8')).rulings;
const wiredIds = new Set(JSON.parse(fs.readFileSync('review/image-picks.json', 'utf8')).picks.map((p) => p.id));
const wired = rulings.filter((r) => r.verdict === 'YES' && wiredIds.has(r.id) && (r.lines || []).length).sort((a, b) => a.id.localeCompare(b.id));

const perCondition = new Map(); // cond -> [{en, af, tagEntry, srcId, srcTags}]
for (const concept of wired) {
  for (const line of concept.lines) {
    if (!RESOLUTION.has(line.en)) continue;
    const tagEntry = mapTags(line.tags, RESOLUTION.get(line.en));
    if (!perCondition.has(concept.condition)) perCondition.set(concept.condition, []);
    perCondition.get(concept.condition).push({ en: line.en, af: line.af, tagEntry, srcId: concept.id, srcTags: line.tags || [] });
  }
}
const collected = [...perCondition.values()].reduce((a, l) => a + l.length, 0);
if (collected !== RESOLUTION.size) { console.error(`expected ${RESOLUTION.size} held lines, collected ${collected} — aborting`); process.exit(1); }

// --- idempotency: drop lines already present in the bank ---
const additions = new Map(); // cond -> { base, newLines:[], tags:{idx:entry} }
let toApply = 0, alreadyThere = 0;
for (const [cond, lines] of [...perCondition.entries()].sort()) {
  const bank = WEATHER_COPY.witty[cond];
  if (!bank || !Array.isArray(bank.en)) throw new Error(`witty.${cond} missing bank`);
  const fresh = lines.filter((ln) => !bank.en.includes(ln.en));
  alreadyThere += lines.length - fresh.length;
  if (!fresh.length) continue;
  const base = bank.en.length;
  const tags = {};
  fresh.forEach((ln, i) => { tags[base + i] = ln.tagEntry; });
  additions.set(cond, { base, newLines: fresh, tags });
  toApply += fresh.length;
}
console.log(`held lines: ${RESOLUTION.size} | already in bank: ${alreadyThere} | to apply: ${toApply}`);
for (const [cond, add] of additions) console.log(`  ${cond}: +${add.newLines.length} at indices ${add.base}..${add.base + add.newLines.length - 1}`);
if (!toApply) { console.log('nothing to apply (idempotent no-op).'); process.exit(0); }
if (!APPLY) { console.log('\nDRY RUN — no files mutated. Re-run with --apply.'); process.exit(0); }

// --- 1) record the owner ruling: flip HELD -> TAG in inland-retag-audit.json ---
const retagPath = 'review/inland-retag-audit.json';
const retag = JSON.parse(fs.readFileSync(retagPath, 'utf8'));
let flipped = 0;
for (const row of retag.rows) {
  if (row.decision === 'HELD' && RESOLUTION.has(row.en)) {
    row.decision = 'TAG';
    row.region = RESOLUTION.get(row.en);
    row.why = `now has a box (${row.region})`;
    flipped++;
  }
}
if (retag.tally && typeof retag.tally.HELD === 'number') {
  retag.tally.HELD -= flipped;
  for (const r of ['lowveld', 'kzn', 'eastern-cape']) retag.tally[r] = (retag.tally[r] || 0) + [...RESOLUTION.values()].filter((v) => v === r).length;
}
fs.writeFileSync(retagPath, JSON.stringify(retag, null, 2) + '\n');
console.log(`flipped ${flipped} HELD -> TAG in ${retagPath}`);

// --- 2) weather-copy.js: append to each target condition's 5 language arrays ---
const jstr = (s) => JSON.stringify(s);
let copySrc = fs.readFileSync('assets/weather-copy.js', 'utf8');
const EOL = copySrc.includes('\r\n') ? '\r\n' : '\n';
const copyLines = copySrc.split(EOL);
const condHeader = /^    '?([a-z][a-z-]*)'?: \{$/;
const langArray = /^(      (en|af|zu|xh|st): )\[(.*)\](,?)$/;
let insideWitty = false, curCond = null;
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
  copyLines[i] = `${m[1]}[${m[3]}, ${items.join(', ')}]${m[4]}`;
}
fs.writeFileSync('assets/weather-copy.js', copyLines.join(EOL));
console.log('mutated assets/weather-copy.js');

// --- 3) witty-day-tags.js: add `<idx>: {entry},` after each condition header ---
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
const wittyStart = tagLines.findIndex((l) => l === '  witty: {');
if (wittyStart === -1) throw new Error('witty-day-tags: no "  witty: {"');
let wittyEnd = -1;
for (let i = wittyStart + 1; i < tagLines.length; i++) { if (tagLines[i] === '  },') { wittyEnd = i; break; } }
const condLineOf = {};
for (let i = wittyStart + 1; i < wittyEnd; i++) { const ch = /^    '?([a-z][a-z-]*)'?: \{$/.exec(tagLines[i]); if (ch) condLineOf[ch[1]] = i; }
const insertions = [];
for (const [cond, add] of additions) {
  if (!(cond in condLineOf)) throw new Error(`witty-day-tags: condition ${cond} block not found — all 3 target conds should already exist`);
  const text = Object.entries(add.tags).map(([idx, e]) => `      ${idx}: ${entryLiteral(e)},`);
  insertions.push({ at: condLineOf[cond] + 1, textLines: text });
}
insertions.sort((a, b) => b.at - a.at);
for (const ins of insertions) tagLines.splice(ins.at, 0, ...ins.textLines);
fs.writeFileSync('assets/witty-day-tags.js', tagLines.join(TEOL));
console.log('mutated assets/witty-day-tags.js');

// --- 4) extend review/line-apply-audit.json (do NOT rebuild) ---
const auditPath = 'review/line-apply-audit.json';
const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
let addedLines = 0, addedTagged = 0;
for (const [cond, add] of additions) {
  const c = audit.conditions[cond];
  if (!c) throw new Error(`audit has no condition ${cond}`);
  add.newLines.forEach((ln, i) => {
    c.lines.push({ index: add.base + i, en: ln.en, af: ln.af, from: ln.srcId, batchTags: ln.srcTags, mappedTag: ln.tagEntry });
  });
  c.added += add.newLines.length;
  c.newTotal = add.base + add.newLines.length;
  audit.tag_additions[cond] = { ...(audit.tag_additions[cond] || {}), ...add.tags };
  addedLines += add.newLines.length;
  addedTagged += Object.keys(add.tags).length;
}
audit.totals.lines += addedLines;
audit.totals.tagged += addedTagged;
audit.unhold_note = `+${addedLines} previously-HELD no-box-region lines applied after lowveld/kzn/eastern-cape boxes landed (2026-07-18)`;
fs.writeFileSync(auditPath, JSON.stringify(audit, null, 2) + '\n');
console.log(`extended ${auditPath}: +${addedLines} lines, +${addedTagged} tagged`);
console.log('\nAPPLIED. Next: npm run copy:generate && node review/tools/verify-lines.mjs && npx vitest run');
