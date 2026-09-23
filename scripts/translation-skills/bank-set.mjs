// Replace single strings in the condition bank, one language at a time (2026-09-23).
//
// assets/weather-copy.js keeps each bin as five index-aligned arrays (en/af/zu/xh/st). A
// translation fix changes ONE cell: the same index, one language. This script:
//   1. finds each line by its EXACT English text in its bin (an index is never trusted);
//   2. refuses unless the cell still holds the `from` text the edit was made against — a stale edit
//      applied to a moved bank is how a line lands on the wrong English;
//   3. proves its formatter reproduces every touched source line byte-for-byte before writing
//      (the same proof scripts/cut-bank-lines.mjs makes);
//   4. re-imports the module and checks that exactly the edited cells changed.
// Run `node scripts/generate-copy-splits.mjs` afterwards (the per-language split the build ships).
//
//   node scripts/translation-skills/bank-set.mjs --edits edits.json [--dry]
//   edits.json: [{ "ns": "witty", "bin": "rain", "en": "…", "lang": "st", "from": "…", "to": "…", "why": "…" }]
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const root = fileURLToPath(new URL('../..', import.meta.url));
const COPY = path.join(root, 'assets', 'weather-copy.js');
const LANGS = ['en', 'af', 'zu', 'xh', 'st'];
const args = process.argv.slice(2);
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const DRY = args.includes('--dry');
if (!val('--edits')) { console.error('usage: --edits edits.json [--dry]'); process.exit(2); }
const edits = JSON.parse(readFileSync(path.resolve(val('--edits')), 'utf8'));

let bust = 0;
const load = async () => (await import(`${pathToFileURL(COPY).href}?v=${Date.now()}-${bust++}`)).WEATHER_COPY;
const W = await load();

const problems = [];
const cells = new Map(); // "ns|bin|lang|i" -> edit
for (const e of edits) {
  const bin = W[e.ns]?.[e.bin];
  if (!bin || !Array.isArray(bin.en)) { problems.push(`${e.ns}.${e.bin}: no such bin`); continue; }
  if (!['af', 'zu', 'xh', 'st'].includes(e.lang)) { problems.push(`${e.ns}.${e.bin}: lang ${e.lang} is not a translation column`); continue; }
  const hits = bin.en.map((t, i) => (t === e.en ? i : -1)).filter((i) => i >= 0);
  if (hits.length !== 1) { problems.push(`${e.ns}.${e.bin}: "${e.en}" found ${hits.length} times`); continue; }
  const i = hits[0];
  if (bin[e.lang][i] !== e.from) { problems.push(`${e.ns}.${e.bin}.${e.lang}[${i}] no longer holds the text this edit was made against`); continue; }
  if (typeof e.to !== 'string' || !e.to.trim()) { problems.push(`${e.ns}.${e.bin}.${e.lang}[${i}]: empty replacement`); continue; }
  const key = `${e.ns}|${e.bin}|${e.lang}|${i}`;
  if (cells.has(key)) { problems.push(`${key}: edited twice`); continue; }
  cells.set(key, { ...e, i });
}
if (problems.length) { console.error('[bank-set] refusing:'); for (const p of problems) console.error(`  - ${p}`); process.exit(1); }

const fmtArray = (arr) => `[${arr.map((s) => JSON.stringify(s)).join(', ')}]`;
const src = readFileSync(COPY, 'utf8');
const EOL = src.includes('\r\n') ? '\r\n' : '\n';
const lines = src.split(/\r?\n/);
const findBlock = (ns, bin) => {
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

const byArray = new Map(); // "ns|bin|lang" -> [edit]
for (const e of cells.values()) { const k = `${e.ns}|${e.bin}|${e.lang}`; if (!byArray.has(k)) byArray.set(k, []); byArray.get(k).push(e); }
for (const [k, list] of byArray) {
  const [ns, bin, lang] = k.split('|');
  const block = findBlock(ns, bin);
  if (!block) { console.error(`[bank-set] ${ns}.${bin}: block not found`); process.exit(1); }
  const at = lines.slice(block[0] + 1, block[1]).findIndex((l) => l.startsWith(`      ${lang}: [`));
  if (at < 0) { console.error(`[bank-set] ${ns}.${bin}.${lang}: line not found`); process.exit(1); }
  const li = block[0] + 1 + at;
  const tail = lines[li].slice(lines[li].lastIndexOf(']') + 1);
  const arr = [...W[ns][bin][lang]];
  if (`      ${lang}: ${fmtArray(arr)}${tail}` !== lines[li]) { console.error(`[bank-set] ${ns}.${bin}.${lang}: the formatter does not reproduce the source line — refusing`); process.exit(1); }
  for (const e of list) arr[e.i] = e.to;
  lines[li] = `      ${lang}: ${fmtArray(arr)}${tail}`;
}
for (const e of cells.values()) console.log(`[bank-set] ${e.ns}.${e.bin}.${e.lang}[${e.i}] "${e.en}"\n    ${e.from}\n  → ${e.to}${e.why ? `   (${e.why})` : ''}`);
if (DRY) { console.log(`[bank-set] --dry: ${cells.size} edits, nothing written`); process.exit(0); }
writeFileSync(COPY, lines.join(EOL));

const after = await load();
const fails = [];
for (const ns of Object.keys(W)) for (const bin of Object.keys(W[ns] || {})) {
  const was = W[ns][bin], now = after[ns][bin];
  if (!was || typeof was !== 'object' || !Array.isArray(was.en)) { if (!isDeepStrictEqual(was, now)) fails.push(`${ns}.${bin} changed`); continue; }
  for (const lang of LANGS) {
    if (!Array.isArray(was[lang])) { if (!isDeepStrictEqual(was[lang], now[lang])) fails.push(`${ns}.${bin}.${lang} changed`); continue; }
    if (now[lang].length !== was[lang].length) fails.push(`${ns}.${bin}.${lang}: length ${was[lang].length} -> ${now[lang].length}`);
    was[lang].forEach((t, i) => {
      const e = cells.get(`${ns}|${bin}|${lang}|${i}`);
      const want = e ? e.to : t;
      if (now[lang][i] !== want) fails.push(`${ns}.${bin}.${lang}[${i}] is not what it should be`);
    });
  }
}
if (fails.length) { console.error('[bank-set] VERIFY FAILED — restore assets/weather-copy.js from git:'); for (const f of fails.slice(0, 20)) console.error(`  - ${f}`); process.exit(1); }
console.log(`[bank-set] ${cells.size} cells written; every other cell of every bin unchanged. Now: node scripts/generate-copy-splits.mjs`);
