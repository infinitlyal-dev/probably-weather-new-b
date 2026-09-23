// A translation task for a fresh translator agent (Part 2, steps 7 and 9 — 2026-09-23).
//
// Writes one self-contained folder outside the repo per language:
//   GUIDANCE-*.md   the skills being evaluated, copied verbatim (current or sharpened)
//   input.json      [{ id, en }] — the English only: no reference, no rejected line, no hint
//   TASK.md         what to do, and what not to touch
// The translator reads only that folder. It never sees a human reference, so it cannot copy one;
// the gold file is opened here, by this script, and nothing of it but the English leaves.
//
// Prints counts only: the test sets are sealed (gold/LOCK.json) and are not for reading.
//
//   node scripts/translation-skills/make-translation-task.mjs --split test --label baseline
//   node scripts/translation-skills/make-translation-task.mjs --split test --label final --skills <dir of sharpened SKILL.md>
//   node scripts/translation-skills/make-translation-task.mjs --split dev --label dev-r1 --ids output/translation-skills/dev-eval-ids.json
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const args = process.argv.slice(2);
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const SPLIT = val('--split', 'test');
const LABEL = val('--label', 'baseline');
const SKILLS = val('--skills', path.join(root, '.claude', 'skills'));
// --ids file.json: { lang: [id, ...] } — translate only these (a dev subset that leaves out the ids the skill shows as examples)
const IDS = val('--ids') ? JSON.parse(readFileSync(path.resolve(val('--ids')), 'utf8')) : null;
const gold = path.join(root, 'scripts', 'translation-skills', 'gold');
const lock = JSON.parse(readFileSync(path.join(gold, 'LOCK.json'), 'utf8'));
const exclusions = new Set(JSON.parse(readFileSync(path.join(gold, 'EXCLUSIONS.json'), 'utf8')).items.map((x) => x.feedbackId));
const NAME = { af: 'Afrikaans', zu: 'isiZulu', xh: 'isiXhosa', st: 'Sesotho' };

const base = path.join(os.tmpdir(), 'pw-translate', LABEL);
rmSync(base, { recursive: true, force: true });
for (const lang of Object.keys(NAME)) {
  const file = path.join(gold, `${lang}-${SPLIT}.json`);
  const body = readFileSync(file, 'utf8');
  if (SPLIT === 'test' && createHash('sha256').update(body).digest('hex') !== lock.files[`${lang}-test.json`]) {
    console.error(`[task] ${lang}-test.json does not match its seal in LOCK.json — refusing`); process.exit(1);
  }
  const items = JSON.parse(body).items.filter((g) => !exclusions.has(g.feedbackId) && (!IDS || (IDS[lang] || []).includes(g.id))).map((g) => ({ id: g.id, en: g.en }));
  const dir = path.join(base, lang);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'input.json'), JSON.stringify(items, null, 1));
  for (const s of [`${lang}-qc`, 'pw-ui-copy']) {
    const f = path.join(SKILLS, s, 'SKILL.md');
    if (!existsSync(f)) { console.error(`[task] missing skill ${f}`); process.exit(1); }
    copyFileSync(f, path.join(dir, `GUIDANCE-${s}.md`));
  }
  writeFileSync(path.join(dir, 'TASK.md'), [
    `# Translate ${items.length} lines into ${NAME[lang]}`,
    '',
    `You are translating the witty weather lines of Probably Weather, a South African weather app, from English into ${NAME[lang]}.`,
    'Your guidance is the GUIDANCE-*.md files in this folder: read them first and follow them. They are the only guidance you may use.',
    '',
    '- `input.json` holds `[{ "id", "en" }]`. Translate every `en`.',
    '- Write `output.json` in this folder: `[{ "id", "text" }]`, one per input line, same order, valid UTF-8 JSON.',
    '- Use only the files in this folder. Do NOT open, search or list any other folder on this computer (in particular not the Probably Weather repository, its lang-packs or its copy banks), and do not use the internet: the point is to measure what the guidance alone produces.',
    '- Work line by line; each line stands alone. Do not leave a line in English.',
    '',
  ].join('\n'));
  console.log(`[task] ${LABEL}/${lang}: ${items.length} lines, guidance ${lang}-qc + pw-ui-copy → ${dir}`);
}
