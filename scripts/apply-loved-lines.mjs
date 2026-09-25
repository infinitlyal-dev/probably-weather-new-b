// Add the new lines Al loved (review/loved-lines.json) to the general line bank, all five languages.
//
// The bank's five language arrays in each bin are row-aligned (assets/witty-day-tags.js), so each
// line is APPENDED to the end of its bin in every language at once: no existing row moves, so no
// existing tag moves. A line's tag (region, time) is written at its new row index.
// Refuses if a line is already in the bank, a bin is missing, or the languages would fall out of
// step. Re-running after a successful apply is a no-op.
//
//   node scripts/apply-loved-lines.mjs [--dry]
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const DRY = process.argv.includes('--dry');
const LANGS = ['en', 'af', 'zu', 'xh', 'st'];
const copyFile = path.join(root, 'assets', 'weather-copy.js');
const tagsFile = path.join(root, 'assets', 'witty-day-tags.js');
const { lines } = JSON.parse(readFileSync(path.join(root, 'review', 'loved-lines.json'), 'utf8'));
const { WEATHER_COPY } = await import(`${pathToFileURL(copyFile).href}?v=${Date.now()}`);

const todo = [];
const problems = [];
for (const l of lines) {
  const bin = WEATHER_COPY.witty[l.bin];
  if (!bin) { problems.push(`${l.key}: no witty bin ${l.bin}`); continue; }
  const n = bin.en.length;
  if (LANGS.some((g) => !Array.isArray(bin[g]) || bin[g].length !== n)) { problems.push(`${l.bin}: language arrays are not the same length`); continue; }
  if (LANGS.some((g) => !l[g])) { problems.push(`${l.key}: missing a language`); continue; }
  if (bin.en.includes(l.en)) { console.log(`[loved] ${l.key}: already in ${l.bin}`); continue; }
  todo.push(l);
}
if (problems.length) { console.error('[loved] refusing:'); for (const p of problems) console.error(`  - ${p}`); process.exit(1); }
if (!todo.length) { console.log('[loved] nothing to do'); process.exit(0); }

// ---- weather-copy.js: append to each language array of the bin inside `witty: {`
let copy = readFileSync(copyFile, 'utf8').split('\n');
const wittyStart = copy.findIndex((s) => /^ {2}witty: \{/.test(s));
const wittyEnd = copy.findIndex((s, i) => i > wittyStart && /^ {2}witty_low_confidence: \{/.test(s));
const added = [];
for (const l of todo) {
  const binRe = new RegExp(`^ {4}(${l.bin}|'${l.bin}'): \\{`);
  const start = copy.findIndex((s, i) => i > wittyStart && i < wittyEnd && binRe.test(s));
  if (start < 0) throw new Error(`${l.bin}: bin header not found inside witty`);
  for (const g of LANGS) {
    const i = copy.findIndex((s, k) => k > start && k < wittyEnd && s.startsWith(`      ${g}: [`));
    const m = /^(.*)\](,?)\s*$/.exec(copy[i]);
    if (i < 0 || !m) throw new Error(`${l.bin}.${g}: array line not found`);
    copy[i] = `${m[1]}, ${JSON.stringify(l[g])}]${m[2]}`;
  }
  added.push({ ...l, index: WEATHER_COPY.witty[l.bin].en.length + added.filter((a) => a.bin === l.bin).length });
}

// ---- witty-day-tags.js: tags at the new indexes, inside WITTY_DAY_TAGS.witty
let tags = readFileSync(tagsFile, 'utf8').split('\n');
const tStart = tags.findIndex((s) => /^export const WITTY_DAY_TAGS = \{/.test(s));
const tWitty = tags.findIndex((s, i) => i > tStart && /^ {2}witty: \{/.test(s));
const tEnd = tags.findIndex((s, i) => i > tWitty && /^ {2}witty_low_confidence: \{/.test(s));
const fmt = (t) => JSON.stringify(t).replace(/"(\w+)":/g, '$1: ').replace(/"/g, "'").replace(/,/g, ', ').replace(/\{/, '{ ').replace(/\}$/, ' }');
for (const a of added.filter((x) => x.tag)) {
  const binRe = new RegExp(`^ {4}(${a.bin}|'${a.bin}'): \\{`);
  const at = tags.findIndex((s, i) => i > tWitty && i < tEnd && binRe.test(s));
  const entry = `      ${a.index}: ${fmt(a.tag)}, // ${a.key}: Al LOVE (taste page 2026-09-25)`;
  if (at >= 0) tags.splice(at + 1, 0, entry);
  else tags.splice(tWitty + 1, 0, `    ${/-/.test(a.bin) ? `'${a.bin}'` : a.bin}: {`, entry, '    },');
}

if (!DRY) {
  writeFileSync(copyFile, copy.join('\n'));
  writeFileSync(tagsFile, tags.join('\n'));
  const check = (await import(`${pathToFileURL(copyFile).href}?v=${Date.now()}`)).WEATHER_COPY;
  const T = (await import(`${pathToFileURL(tagsFile).href}?v=${Date.now()}`)).WITTY_DAY_TAGS;
  for (const a of added) {
    for (const g of LANGS) if (check.witty[a.bin][g][a.index] !== a[g]) throw new Error(`${a.key}.${g} is not at ${a.bin}[${a.index}] after writing`);
    if (a.tag && JSON.stringify(T.witty[a.bin][a.index]) !== JSON.stringify(a.tag)) throw new Error(`${a.key}: tag not at ${a.bin}[${a.index}]`);
  }
}
for (const a of added) console.log(`[loved] ${a.key} -> witty.${a.bin}[${a.index}]${a.tag ? ` tag ${JSON.stringify(a.tag)}` : ''}  ${a.en}`);
console.log(DRY ? '[loved] --dry: nothing written' : `[loved] ${added.length} lines added in five languages`);
