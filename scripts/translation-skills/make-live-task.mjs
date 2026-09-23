// A translation task for live lines that failed the calibrated checkers (Part 2, step 10 — 2026-09-23).
//
// Same protocol as make-translation-task.mjs — one clean folder per language outside the repo, the
// sharpened skills copied in as GUIDANCE-*.md, the English only — but the input is live lines, each
// keyed to the CURRENT English it shows beside (the scan's own pairing), not a gold set. The
// translator never sees the failing line, so it cannot copy its mistake.
//
//   node scripts/translation-skills/make-live-task.mjs --in items.json --label live-redo-1
//   items.json: [{ "id", "lang", "en" }]
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const args = process.argv.slice(2);
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const LABEL = val('--label', 'live-redo');
const SKILLS = val('--skills', path.join(root, '.claude', 'skills'));
const items = JSON.parse(readFileSync(path.resolve(val('--in')), 'utf8'));
if (items.some((x) => 'text' in x)) { console.error('[live-task] the input carries the old translation — the translator must not see it. Refusing.'); process.exit(1); }
const NAME = { af: 'Afrikaans', zu: 'isiZulu', xh: 'isiXhosa', st: 'Sesotho' };
const base = path.join(os.tmpdir(), 'pw-translate', LABEL);
rmSync(base, { recursive: true, force: true });
for (const lang of Object.keys(NAME)) {
  const mine = items.filter((x) => x.lang === lang).map(({ id, en }) => ({ id, en }));
  if (!mine.length) continue;
  const dir = path.join(base, lang);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'input.json'), JSON.stringify(mine, null, 1));
  for (const s of [`${lang}-qc`, 'pw-ui-copy']) {
    const f = path.join(SKILLS, s, 'SKILL.md');
    if (!existsSync(f)) { console.error(`[live-task] missing skill ${f}`); process.exit(1); }
    copyFileSync(f, path.join(dir, `GUIDANCE-${s}.md`));
  }
  writeFileSync(path.join(dir, 'TASK.md'), [
    `# Translate ${mine.length} lines into ${NAME[lang]}`,
    '',
    `You are translating the witty weather lines of Probably Weather, a South African weather app, from English into ${NAME[lang]}. These lines are live in the app; the current translations failed a meaning check, so each needs a fresh translation of the English it is keyed to.`,
    'Your guidance is the GUIDANCE-*.md files in this folder: read them first and follow them — above all "Translating a line". They are the only guidance you may use.',
    '',
    '- `input.json` holds `[{ "id", "en" }]`. Translate every `en`.',
    '- Write `output.json` in this folder: `[{ "id", "text" }]`, one per input line, same order, valid UTF-8 JSON.',
    '- Use only the files in this folder. Do NOT open, search or list any other folder on this computer (in particular not the Probably Weather repository, its lang-packs or its copy banks), and do not use the internet.',
    '- Work line by line; each line stands alone. Do not leave a line in English. When the English gives advice (headlights, sunscreen, stay inside, hold on, drink water), the translation must give exactly that advice.',
    '',
  ].join('\n'));
  console.log(`[live-task] ${LABEL}/${lang}: ${mine.length} lines → ${dir}`);
}
