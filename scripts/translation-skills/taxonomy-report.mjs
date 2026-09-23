// Count the error taxonomy per language (Part 2, step 2 — 2026-09-23).
//
// Reads the classified batches (output/translation-skills/taxonomy/*.out.json) against their inputs
// and writes scripts/translation-skills/TAXONOMY.md: primary type × language, separately for the
// 306 flags of the 2026-09-19 check and for the human corrections, plus safety lines and the
// cases the classifiers called out.
//
//   node scripts/translation-skills/taxonomy-report.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const dir = path.join(root, 'output', 'translation-skills', 'taxonomy');
const batches = JSON.parse(readFileSync(path.join(dir, 'batches.json'), 'utf8'));
const TYPES = ['REVERSED', 'DETAIL', 'WRONG_KEY', 'OUTDATED_LIST', 'SPELLING_STANDARD', 'LITERAL', 'JOKE_LOST', 'OTHER'];
const LABEL = { REVERSED: 'meaning reversed', DETAIL: 'detail dropped or changed', WRONG_KEY: 'keyed to the wrong English line', OUTDATED_LIST: 'translated from an out-of-date list', SPELLING_STANDARD: 'wrong spelling standard', LITERAL: 'too literal / stiff', JOKE_LOST: 'joke lost', OTHER: 'other' };
const LANGS = ['af', 'zu', 'xh', 'st'];
const rows = [];
const missing = [];
for (const b of batches) {
  const inF = path.join(dir, `${b.name}.in.json`), outF = path.join(dir, `${b.name}.out.json`);
  if (!existsSync(outF)) { missing.push(b.name); continue; }
  const ins = JSON.parse(readFileSync(inF, 'utf8'));
  const outs = new Map(JSON.parse(readFileSync(outF, 'utf8')).map((o) => [o.id, o]));
  for (const it of ins) {
    const o = outs.get(it.id);
    if (!o) { missing.push(`${b.name}:${it.id}`); continue; }
    const primary = TYPES.includes(o.primary) ? o.primary : 'OTHER';
    rows.push({ id: it.id, lang: it.lang, population: it.population, primary, secondary: (o.secondary || []).filter((t) => TYPES.includes(t)), safety: !!o.safety, note: o.note || '', en: it.en });
  }
}
const table = (pop) => {
  const head = `| Type | ${LANGS.join(' | ')} | all |\n|---|${LANGS.map(() => '---:').join('|')}|---:|`;
  const body = TYPES.map((t) => {
    const per = LANGS.map((l) => rows.filter((r) => r.population === pop && r.lang === l && r.primary === t).length);
    return `| ${LABEL[t]} | ${per.join(' | ')} | ${per.reduce((a, b) => a + b, 0)} |`;
  });
  const totals = LANGS.map((l) => rows.filter((r) => r.population === pop && r.lang === l).length);
  return [head, ...body, `| **total** | ${totals.join(' | ')} | ${totals.reduce((a, b) => a + b, 0)} |`].join('\n');
};
const safety = rows.filter((r) => r.safety);
const md = [
  '# Error taxonomy — 2026-09-23',
  '',
  `Classified against \`RUBRIC.md\` by fresh agents (one per batch), evidence computed by \`taxonomy-input.mjs\`. Primary type only; secondary types are in the batch outputs.${missing.length ? ` **Missing: ${missing.join(', ')}.**` : ''}`,
  '',
  '## The 306 flags of the 2026-09-19 back-translation check',
  '',
  table('flag'),
  '',
  '## Human corrections (what the native reviewer, or Al for Afrikaans, fixed)',
  '',
  table('correction'),
  '',
  `## Safety lines among them: ${safety.length}`,
  '',
  ...safety.map((r) => `- \`${r.id}\` (${r.lang}, ${r.population}) ${LABEL[r.primary]} — "${r.en}" — ${r.note}`),
  '',
].join('\n');
writeFileSync(path.join(root, 'scripts', 'translation-skills', 'TAXONOMY.md'), md);
writeFileSync(path.join(root, 'output', 'translation-skills', 'taxonomy', 'all.json'), JSON.stringify(rows, null, 1));
console.log(`[taxonomy] ${rows.length} classified${missing.length ? `, missing ${missing.length}: ${missing.slice(0, 5).join(', ')}` : ''}`);
for (const pop of ['flag', 'correction']) {
  console.log(`  ${pop}:`);
  for (const l of LANGS) console.log(`    ${l}: ${TYPES.map((t) => `${t} ${rows.filter((r) => r.population === pop && r.lang === l && r.primary === t).length}`).join(' · ')}`);
}
