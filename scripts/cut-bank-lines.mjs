// Remove condition-bank lines Al has ruled CUT — all five languages, and the day
// tags that ride on the same index.
//
// THE TRAP THIS EXISTS FOR. assets/weather-copy.js holds each bin as five arrays,
// en/af/zu/xh/st, aligned by index. assets/witty-day-tags.js tags lines BY THAT
// INDEX (`clear: { 41: { region: 'western-cape' } }`). Delete one string from the
// middle of a bin and every later line is now one place off its own translations
// and its own month/region/time tag — a winter line inherits a summer tag, a
// Western Cape line loses its region, and nothing fails loudly. So a cut is never
// a text edit. This script:
//
//   1. finds each line by its EXACT English text (the ruling's key index is only a
//      hint, and is checked against it);
//   2. proves its own formatter reproduces every touched source line byte-for-byte
//      BEFORE changing anything — if a string uses an escape the formatter would
//      write differently, it refuses rather than rewrite Al's copy;
//   3. drops the index from all five language arrays, and re-keys the bin's tags
//      (tag at k -> k - number of cuts below k; a tag ON a cut line goes with it);
//   4. re-imports both modules and checks every surviving line still carries its
//      own translations and its own tag.
//
// Nothing else is touched. Run `node scripts/generate-copy-splits.mjs` afterwards
// (the per-language split the build ships) and `node scripts/build-hero-lines.mjs`
// (HERO_LINE_TAGS is derived from the bank tags).
//
//   node scripts/cut-bank-lines.mjs --ruling review/eskom-ruled.json [--dry]
//   node scripts/cut-bank-lines.mjs --cuts '[{"ns":"witty","bin":"clear","en":"…"}]' [--dry]
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const root = fileURLToPath(new URL('..', import.meta.url));
const COPY = path.join(root, 'assets', 'weather-copy.js');
const TAGS = path.join(root, 'assets', 'witty-day-tags.js');
const LANGS = ['en', 'af', 'zu', 'xh', 'st'];

const args = process.argv.slice(2);
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const DRY = args.includes('--dry');

// Fresh module instances every time: this script imports, rewrites, then re-imports.
let bust = 0;
const load = async (file) => import(`${pathToFileURL(file).href}?v=${Date.now()}-${bust++}`);

// ---- what to cut ------------------------------------------------------------
let wanted;
if (val('--ruling')) {
  const ruling = JSON.parse(readFileSync(path.resolve(root, val('--ruling')), 'utf8'));
  wanted = (ruling.rulings || []).filter((r) => r.verdict === 'CUT').map((r) => {
    const m = String(r.key).match(/^([a-z_]+):([a-z'-]+)#(\d+)$/i);
    if (!m) throw new Error(`cannot read key ${r.key}`);
    return { ns: m[1], bin: m[2], hint: Number(m[3]), en: r.en, key: r.key };
  });
} else if (val('--cuts')) {
  wanted = JSON.parse(val('--cuts'));
} else {
  console.error('usage: --ruling <file> | --cuts <json>');
  process.exit(2);
}
if (!wanted.length) { console.log('[bank cut] nothing ruled CUT — no change'); process.exit(0); }

const before = await load(COPY);
const beforeTags = await load(TAGS);
const W = before.WEATHER_COPY;
const T = beforeTags.WITTY_DAY_TAGS;

// ---- resolve each cut to an index, by text ---------------------------------
const problems = [];
const cutsByBin = new Map();   // "ns|bin" -> sorted indices
for (const c of wanted) {
  const bin = W[c.ns]?.[c.bin];
  if (!bin || !Array.isArray(bin.en)) { problems.push(`${c.ns}.${c.bin}: no such bin`); continue; }
  const hits = bin.en.map((t, i) => (t === c.en ? i : -1)).filter((i) => i >= 0);
  if (hits.length !== 1) { problems.push(`${c.ns}.${c.bin}: "${c.en}" found ${hits.length} times`); continue; }
  const i = hits[0];
  if (c.hint !== undefined && c.hint !== i) problems.push(`${c.key}: the ruling's index says ${c.hint}, the text is at ${i} — the bank moved since the ruling; refusing`);
  for (const lang of LANGS) {
    if (!Array.isArray(bin[lang]) || bin[lang].length !== bin.en.length) problems.push(`${c.ns}.${c.bin}.${lang}: not aligned with en (${bin[lang]?.length} vs ${bin.en.length})`);
  }
  const k = `${c.ns}|${c.bin}`;
  if (!cutsByBin.has(k)) cutsByBin.set(k, []);
  cutsByBin.get(k).push(i);
}
if (problems.length) {
  console.error('[bank cut] refusing:');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
for (const v of cutsByBin.values()) v.sort((a, b) => a - b);

// ---- the formatter, and its proof -------------------------------------------
// One line per language: `      en: ["…", "…"],`. JSON string quoting is exactly
// what the source uses; the round-trip check below is what makes that a fact.
const fmtArray = (arr) => `[${arr.map((s) => JSON.stringify(s)).join(', ')}]`;

// Line endings are per file and must survive: witty-day-tags.js is CRLF in the
// working tree while weather-copy.js is LF. Splitting on '\n' alone left a '\r'
// on every tags line, the block search matched nothing, and the first draft of
// this script reported "0 re-keyed" and would have shifted 59 tags silently.
const copySrc = readFileSync(COPY, 'utf8');
const tagSrc = readFileSync(TAGS, 'utf8');
const eolOf = (s) => (s.includes('\r\n') ? '\r\n' : '\n');
const COPY_EOL = eolOf(copySrc);
const TAG_EOL = eolOf(tagSrc);
const copyLines = copySrc.split(/\r?\n/);
const tagLines = tagSrc.split(/\r?\n/);

const findBlock = (lines, ns, bin, nsNext) => {
  const quoted = /^[a-z_]+$/i.test(bin) ? bin : `'${bin}'`;
  let inNs = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === `  ${ns}: {`) { inNs = true; continue; }
    if (inNs && /^  [A-Za-z_]+: \{/.test(lines[i])) inNs = false;
    if (inNs && lines[i] === `    ${quoted}: {`) {
      let end = i + 1;
      while (end < lines.length && !/^    \},?\s*$/.test(lines[end])) end++;
      return [i, end];
    }
  }
  return null;
};

const report = [];
for (const [k, cuts] of cutsByBin) {
  const [ns, bin] = k.split('|');
  const binData = W[ns][bin];

  // weather-copy.js: prove, then rewrite, each language line of this bin.
  const block = findBlock(copyLines, ns, bin);
  if (!block) { console.error(`[bank cut] ${ns}.${bin}: block not found in weather-copy.js`); process.exit(1); }
  for (const lang of LANGS) {
    const at = copyLines.slice(block[0] + 1, block[1]).findIndex((l) => l.startsWith(`      ${lang}: [`));
    if (at < 0) { console.error(`[bank cut] ${ns}.${bin}.${lang}: line not found`); process.exit(1); }
    const li = block[0] + 1 + at;
    const line = copyLines[li];
    const tail = line.slice(line.lastIndexOf(']') + 1);   // "," or ""
    const rebuilt = `      ${lang}: ${fmtArray(binData[lang])}${tail}`;
    if (rebuilt !== line) {
      console.error(`[bank cut] ${ns}.${bin}.${lang}: the formatter does not reproduce the source line — refusing to rewrite it`);
      process.exit(1);
    }
    copyLines[li] = `      ${lang}: ${fmtArray(binData[lang].filter((_, i) => !cuts.includes(i)))}${tail}`;
  }

  // witty-day-tags.js: re-key this bin's tags, drop tags on cut lines. A bin the
  // module says HAS tags but whose block cannot be found is a hard stop — skipping
  // it is exactly the silent shift this script exists to prevent.
  const tagBlock = findBlock(tagLines, ns, bin);
  const hasTags = Object.keys(T[ns]?.[bin] || {}).length > 0;
  if (hasTags && !tagBlock) { console.error(`[bank cut] ${ns}.${bin}: has ${Object.keys(T[ns][bin]).length} tags but the block was not found in witty-day-tags.js — refusing`); process.exit(1); }
  let movedTags = 0, droppedTags = 0;
  if (tagBlock) {
    const kept = [];
    for (let li = tagBlock[0] + 1; li < tagBlock[1]; li++) {
      const m = tagLines[li].match(/^(\s+)(\d+)(: .*)$/);
      if (!m) { console.error(`[bank cut] ${ns}.${bin} tags: cannot read "${tagLines[li]}"`); process.exit(1); }
      const old = Number(m[2]);
      if (cuts.includes(old)) { droppedTags++; continue; }
      const nu = old - cuts.filter((c) => c < old).length;
      if (nu !== old) movedTags++;
      kept.push(`${m[1]}${nu}${m[3]}`);
    }
    tagLines.splice(tagBlock[0] + 1, tagBlock[1] - tagBlock[0] - 1, ...kept);
  }
  report.push({ ns, bin, cuts, lines: cuts.map((i) => binData.en[i]), movedTags, droppedTags, before: binData.en.length });
}

for (const r of report) {
  console.log(`[bank cut] ${r.ns}.${r.bin}: removing index ${r.cuts.join(', ')} from all five languages (${r.before} -> ${r.before - r.cuts.length} lines)`);
  for (const t of r.lines) console.log(`    - "${t}"`);
  console.log(`    tags: ${r.movedTags} re-keyed, ${r.droppedTags} dropped with their line`);
}
if (DRY) { console.log('[bank cut] --dry: nothing written'); process.exit(0); }

writeFileSync(COPY, copyLines.join(COPY_EOL));
writeFileSync(TAGS, tagLines.join(TAG_EOL));

// ---- verify: every survivor keeps its translations and its tag --------------
const after = (await load(COPY)).WEATHER_COPY;
const afterTags = (await load(TAGS)).WITTY_DAY_TAGS;
const fails = [];
for (const [k, cuts] of cutsByBin) {
  const [ns, bin] = k.split('|');
  const was = W[ns][bin], now = after[ns][bin];
  let j = 0;
  for (let i = 0; i < was.en.length; i++) {
    if (cuts.includes(i)) continue;
    for (const lang of LANGS) if (now[lang][j] !== was[lang][i]) fails.push(`${ns}.${bin}.${lang}[${j}] is not the old [${i}]`);
    const tWas = T[ns]?.[bin]?.[i], tNow = afterTags[ns]?.[bin]?.[j];
    if (!isDeepStrictEqual(tWas, tNow)) fails.push(`${ns}.${bin} tag for "${was.en[i]}" moved: ${JSON.stringify(tWas)} -> ${JSON.stringify(tNow)}`);
    j++;
  }
  for (const lang of LANGS) if (now[lang].length !== was.en.length - cuts.length) fails.push(`${ns}.${bin}.${lang}: length ${now[lang].length}`);
}
// every OTHER bin must be untouched
for (const ns of Object.keys(W)) for (const bin of Object.keys(W[ns] || {})) {
  if (cutsByBin.has(`${ns}|${bin}`)) continue;
  if (!isDeepStrictEqual(W[ns][bin], after[ns][bin])) fails.push(`${ns}.${bin} changed and should not have`);
}
for (const ns of Object.keys(T)) for (const bin of Object.keys(T[ns] || {})) {
  if (cutsByBin.has(`${ns}|${bin}`)) continue;
  if (!isDeepStrictEqual(T[ns][bin], afterTags[ns][bin])) fails.push(`tags ${ns}.${bin} changed and should not have`);
}
if (fails.length) {
  console.error('[bank cut] VERIFY FAILED — the files are written; restore them with git before anything else:');
  for (const f of fails.slice(0, 20)) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('[bank cut] verified: every surviving line keeps its five translations and its own tag; no other bin moved');
console.log('[bank cut] next: node scripts/generate-copy-splits.mjs && node scripts/build-hero-lines.mjs');
