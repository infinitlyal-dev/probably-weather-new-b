// Gather a translation run's output into one candidates file (2026-09-23).
//
// Reads %TEMP%/pw-translate/<label>/<lang>/{input,output}.json (make-translation-task.mjs),
// checks every input id came back with a non-empty line, and writes
// output/translation-skills/<label>/candidates.json: [{ id, lang, text }] — no English, so the
// same file feeds the blind back-translators. Prints counts only.
//
//   node scripts/translation-skills/collect-candidates.mjs --label baseline
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const args = process.argv.slice(2);
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const LABEL = val('--label', 'baseline');
const base = path.join(os.tmpdir(), 'pw-translate', LABEL);
const all = [];
let problems = 0;
for (const lang of ['af', 'zu', 'xh', 'st']) {
  const inF = path.join(base, lang, 'input.json'), outF = path.join(base, lang, 'output.json');
  if (!existsSync(outF)) { console.error(`[collect] ${lang}: no output.json yet`); problems += 1; continue; }
  const want = JSON.parse(readFileSync(inF, 'utf8')).map((x) => x.id);
  const got = new Map(JSON.parse(readFileSync(outF, 'utf8')).map((x) => [x.id, x.text]));
  const missing = want.filter((id) => !String(got.get(id) || '').trim());
  if (missing.length) { console.error(`[collect] ${lang}: ${missing.length} line(s) missing or empty`); problems += 1; }
  for (const id of want) if (String(got.get(id) || '').trim()) all.push({ id, lang, text: String(got.get(id)).trim() });
  console.log(`[collect] ${LABEL}/${lang}: ${want.length - missing.length}/${want.length}`);
}
const out = path.join(root, 'output', 'translation-skills', LABEL);
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'candidates.json'), JSON.stringify(all, null, 1));
console.log(`[collect] ${all.length} candidate lines → output/translation-skills/${LABEL}/candidates.json`);
process.exit(problems ? 1 : 0);
