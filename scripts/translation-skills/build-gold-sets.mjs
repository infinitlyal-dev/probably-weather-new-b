// Gold sets for the translation skills (Part 2, step 3 — 2026-09-23).
//
// One gold item per (language, English line) that a HUMAN ruled on: a native reviewer for
// isiZulu, isiXhosa and Sesotho, Al for Afrikaans (output/translation-skills/feedback.json):
//   { id, lang, en, reference, rejected?, verdict, referenceOrthography?, who, source }
//     reference  the human's own words (an approval, or the corrected `after`)
//     rejected   what the human replaced (corrections only) — the failure the skills must not repeat
// Quarantined lines are left out: the reviewer gave doubt, not a translation.
//
// THE SPLIT. dev (the skills may learn from it) or test (locked, scored once at the end).
// Decided by a hash of the ENGLISH line, the same for all four languages, so no English line in
// any test set appears in any dev set in any language, and the choice cannot be steered by what
// an item contains. About 30% goes to test.
//
// THE LOCK. gold/LOCK.json records the SHA-256 of every test file. Only score-test.mjs reads the
// test files, and it prints aggregates only. Nothing that writes the skills may open them:
// check-leak.mjs fails if a skill file contains any test English line or test reference.
//
//   node scripts/translation-skills/build-gold-sets.mjs      (prints counts only)
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const dir = path.join(root, 'scripts', 'translation-skills', 'gold');
mkdirSync(dir, { recursive: true });
const LOCK = path.join(dir, 'LOCK.json');
if (existsSync(LOCK) && !process.argv.includes('--rebuild-before-baseline')) {
  console.error('[gold] the test sets are locked (gold/LOCK.json). Rebuilding would change them after they were sealed. Refusing.');
  process.exit(1);
}
const { items } = JSON.parse(readFileSync(path.join(root, 'output', 'translation-skills', 'feedback.json'), 'utf8'));
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const TEST_SHARE = 30;   // percent
const bucketOf = (en) => parseInt(createHash('sha256').update(`pw-gold-v1|${norm(en).toLowerCase()}`).digest('hex').slice(0, 8), 16) % 100;

// An isiZulu/isiXhosa/Sesotho APPROVAL of a line the 2026-09-19 back-translation check flagged
// is not a reference: the reviewed bank still carries known slips (umkhumbi = ship for a kite),
// so the human's approval and the checker disagree and neither is taken as truth. Afrikaans is
// different: Al is the native author and his approval outranks the checker, so his flagged
// lines stay — they are exactly the cases the calibration needs.
const flaggedText = new Set(JSON.parse(readFileSync(path.join(root, 'review', 'translation-check-data.json'), 'utf8'))
  .rows.filter((r) => r.flagged && r.lang !== 'af').map((r) => `${r.lang}|${norm(r.text)}`));
let droppedConflicts = 0;

// One item per (lang, English): a correction carries more than an approval; the first source wins ties.
const pick = new Map();
for (const it of items) {
  if (it.verdict !== 'corrected' && it.verdict !== 'approved') continue;
  const reference = it.lang === 'st' && it.afterSA ? it.afterSA : it.after;
  if (!reference || !it.en) continue;
  if (it.verdict === 'approved' && flaggedText.has(`${it.lang}|${norm(reference)}`)) { droppedConflicts += 1; continue; }
  const key = `${it.lang}|${norm(it.en)}`;
  const cand = {
    lang: it.lang, en: norm(it.en), reference: norm(reference), rejected: it.verdict === 'corrected' ? norm(it.before) : undefined,
    verdict: it.verdict, referenceOrthography: it.lang === 'st' ? (it.afterSA ? 'SA (live bank)' : (it.source.includes('corpus-confirmed') ? 'SA (live bank)' : 'Lesotho (reviewer, June 2026)')) : undefined,
    who: it.who, source: it.source, feedbackId: it.id,
  };
  const prev = pick.get(key);
  if (!prev || (prev.verdict === 'approved' && cand.verdict === 'corrected')) pick.set(key, cand);
}

const sets = {};
for (const g of pick.values()) {
  const part = bucketOf(g.en) < TEST_SHARE ? 'test' : 'dev';
  ((sets[g.lang] ||= { dev: [], test: [] })[part]).push(g);
}
const lock = { sealed: new Date().toISOString(), rule: 'Test files are read only by scripts/translation-skills/score-test.mjs, which prints aggregates. Skills are built from dev files and external reference text only; check-leak.mjs enforces it.', split: `sha256("pw-gold-v1|" + English) % 100 < ${TEST_SHARE} -> test`, files: {} };
for (const [lang, s] of Object.entries(sets)) {
  for (const part of ['dev', 'test']) {
    s[part].sort((a, b) => a.en.localeCompare(b.en));
    s[part].forEach((g, i) => { g.id = `${lang}-${part}-${String(i + 1).padStart(4, '0')}`; });
    const file = path.join(dir, `${lang}-${part}.json`);
    const body = JSON.stringify({ lang, part, count: s[part].length, items: s[part] }, null, 1);
    writeFileSync(file, body);
    if (part === 'test') lock.files[`${lang}-test.json`] = createHash('sha256').update(body).digest('hex');
  }
  const c = (arr) => ({ items: arr.length, corrected: arr.filter((g) => g.verdict === 'corrected').length, approved: arr.filter((g) => g.verdict === 'approved').length });
  console.log(`[gold] ${lang}: dev ${JSON.stringify(c(s.dev))} · test ${JSON.stringify(c(s.test))}`);
}
writeFileSync(LOCK, JSON.stringify(lock, null, 1));
console.log(`[gold] ${droppedConflicts} zu/xh/st approvals left out because the back-translation check flagged the same line`);
console.log('[gold] test sets sealed in gold/LOCK.json');
