// Checker (a): a BLIND back-translation task for a fresh Claude agent (2026-09-23).
//
// The same protocol as the 2026-09-19 check: the agent sees only the translated lines, never the
// English, and writes what they say in English. The English is compared afterwards, by the judge
// (JUDGE.md), exactly as Sol's back-translations are — so the two checkers differ only in who
// back-translated.
//
//   node scripts/translation-skills/make-bt-task.mjs --in candidates.json --label <name>
//   candidates.json: [{ "id", "lang", "text" }]   (an "en" field is refused)
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const IN = val('--in'); const LABEL = val('--label', 'bt');
const lines = JSON.parse(readFileSync(path.resolve(IN), 'utf8'));
if (lines.some((l) => 'en' in l)) { console.error('[bt-task] input carries English — the back-translator must never see it. Refusing.'); process.exit(1); }
const NAME = { af: 'Afrikaans', zu: 'isiZulu', xh: 'isiXhosa', st: 'Sesotho' };
const base = path.join(os.tmpdir(), 'pw-bt', LABEL);
rmSync(base, { recursive: true, force: true });
for (const lang of Object.keys(NAME)) {
  const mine = lines.filter((l) => l.lang === lang);
  if (!mine.length) continue;
  const dir = path.join(base, lang);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'input.json'), JSON.stringify(mine.map(({ id, text }) => ({ id, text })), null, 1));
  writeFileSync(path.join(dir, 'TASK.md'), [
    `# Back-translate ${mine.length} ${NAME[lang]} lines into English`,
    '',
    `input.json holds short lines from a South African weather app, all in ${NAME[lang]}: \`[{ "id", "text" }]\`.`,
    'Translate each into plain English, as literally as a careful translator would, keeping every detail — who and what, time, place, numbers, and whether something is or is not happening.',
    'You are deliberately not shown the original English. Translate what is written; do not guess what an app would say.',
    'If a word is misspelt, unclear, not in the language, or could mean two things, give your best reading and say so in "note".',
    '',
    'Write output.json in this folder: `[{ "id", "back", "note" }]`, one per input line, same order, valid UTF-8 JSON.',
    'Use only the files in this folder: do not open or search any other folder on this computer, and do not use the internet.',
    '',
  ].join('\n'));
  console.log(`[bt-task] ${LABEL}/${lang}: ${mine.length} lines → ${dir}`);
}
