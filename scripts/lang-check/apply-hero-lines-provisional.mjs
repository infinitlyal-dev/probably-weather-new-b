// Writes a PROVISIONAL per-photograph line table for isiZulu, isiXhosa or Sesotho (9 Oct 2026, Al's brief step 4).
//
// The bespoke lines are English, keyed to photographs in assets/hero-lines.js; Afrikaans has its own table
// (assets/hero-lines-af.js). Until now zu/xh/st had none and kept the condition bank. This script writes
// assets/hero-lines-<lang>.js — English line → the drafted line — from lang-packs/<lang>/drafts-2026-10.jsonl, for the
// rows whose set is a photograph's line (new-sets, changed-lines). The app serves it exactly as it serves Afrikaans
// (applyBespokeLine, assets/app.js): a photograph's rotation in that language is the subset of its lines that has a row.
//
// Only a language that PASSED the October exam (scripts/lang-check/exam-result-2026-10.json) gets a table.
// A row is written only when all of these hold:
//   - the rebuilt checker (lib/checker-v2.mjs, with its back-translation record) does not rate it triage-high
//   - the back-translation (Sonnet 5.5) did not call it drift, wrong-language, untranslated or garbled with
//     confidence >= 0.6 — Maat reads review/lines-backtranslation-2026-10.md and can strike more before any merge
//   - its English line is still wired in assets/hero-lines.js
// Every row is provisional pending a native reader; lang-packs/<lang>/provisional-manifest.jsonl records it.
//
//   node scripts/lang-check/apply-hero-lines-provisional.mjs --lang xh [--dry-run]

import fs from 'node:fs';
import path from 'node:path';
import { checkV2 } from './lib/checker-v2.mjs';
import { EXAM_INPUTS, EXAM_THRESHOLD, examInputHash } from './lib/exam-inputs.mjs';
import { HERO_LINES } from '../../assets/hero-lines.js';

const ROOT = path.resolve(import.meta.dirname, '../..');
const args = process.argv.slice(2);
const lang = args[args.indexOf('--lang') + 1];
const DRY = args.includes('--dry-run');
if (!/^(zu|xh|st)$/.test(lang || '')) { console.error('usage: --lang zu|xh|st [--dry-run]'); process.exit(2); }
const exam = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'exam-result-2026-10.json'), 'utf8'));
if (exam.pass?.[lang]?.pass !== true) { console.error(`${lang} did not pass the October exam — no table is written (Al's brief: don't draft in a language that fails)`); process.exit(1); }
// The pass counts only for the gold set and checker it was earned on (Sol, 10 Oct 2026): the exam records their
// hashes, and a change to either since the exam was run means the exam has to be run again first.
// Every input must be recorded (an empty list proves nothing), and the pass must be at the brief's threshold.
// The files checked are the current list AND every file the exam recorded, so trimming the list cannot void a check.
const checked = [...new Set([...EXAM_INPUTS, 'scripts/lang-check/lib/exam-inputs.mjs', ...Object.keys(exam.inputs || {})])];
const stale = checked.filter((f) => !exam.inputs?.[f] || examInputHash(f) !== exam.inputs[f]);
if (stale.length) { console.error(`the exam result does not match the current ${stale.join(', ')} — run node scripts/lang-check/exam-2026-10.mjs again first`); process.exit(1); }
if (exam.threshold !== EXAM_THRESHOLD) { console.error(`the exam was run at threshold ${exam.threshold}, not ${EXAM_THRESHOLD} — run it again at the default`); process.exit(1); }

const wired = new Set(Object.values(HERO_LINES).flat());
const drafts = fs.readFileSync(path.join(ROOT, 'lang-packs', lang, 'drafts-2026-10.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
  .filter((d) => d.set === 'new-sets' || d.set === 'changed-lines');
const BAD = new Set(['drift', 'wrong-language', 'untranslated', 'garbled']);
const rows = [], held = [];
// One English line, one row (Sol, 10 Oct 2026): two drafts that disagree on the same English are both held for a
// reader to choose; an exact repeat is written once.
const byEn = new Map();
for (const d of drafts) byEn.set(d.en, [...(byEn.get(d.en) || []), d]);
const seenEn = new Set();
for (const d of drafts) {
  if (seenEn.has(d.en)) continue;
  seenEn.add(d.en);
  const v = checkV2({ lang, en: d.en, text: d[lang] });
  const why = [];
  const variants = [...new Set(byEn.get(d.en).map((x) => x[lang]))];
  if (variants.length > 1) {
    // every variant is listed as held, so the reader sees all of them
    for (const t of variants) held.push({ ...byEn.get(d.en).find((x) => x[lang] === t), why: [`conflicting drafts for the same English (${variants.length})`] });
    continue;
  }
  if (!wired.has(d.en)) why.push('English line no longer wired');
  if (v.action === 'triage-high') why.push(`checker triage-high ${v.confidence}`);
  if (v.back && BAD.has(v.back.verdict) && (v.back.confidence ?? 0) >= 0.6) why.push(`back-translation ${v.back.verdict}: "${v.back.bt}"`);
  if (!v.back) why.push('no back-translation record');
  (why.length ? held : rows).push({ ...d, verdict: v.action, confidence: v.confidence, why });
}
rows.sort((a, b) => a.en.localeCompare(b.en));
const NAME = { zu: 'isiZulu', xh: 'isiXhosa', st: 'Sesotho' }[lang];
const CONST = `HERO_LINES_${lang.toUpperCase()}`;
const today = new Date().toISOString().slice(0, 10);
const js = `// Probably Weather — ${NAME} for the bespoke (per-photograph) lines. PROVISIONAL. GENERATED by
// scripts/lang-check/apply-hero-lines-provisional.mjs on ${today} from lang-packs/${lang}/drafts-2026-10.jsonl — do not
// edit by hand.
//
// English line → ${NAME}. ${rows.length} rows, drafted by a model (not a native speaker), each through the rebuilt
// lang-check (concord, attestation in context, a blind back-translation by a second model) and none rated triage-high
// or drifting. Provisional pending a native reader: lang-packs/${lang}/provisional-manifest.jsonl. The back-translation
// of every row: review/lines-backtranslation-2026-10.md. Served for ${NAME} by applyBespokeLine in assets/app.js,
// loaded only then.
export const ${CONST} = {
${rows.map((r) => ` ${JSON.stringify(r.en)}: ${JSON.stringify(r[lang])},`).join('\n')}
};

/** The ${NAME} for an English bespoke line, or null where it has none yet. */
export function heroLine(english) {
  return Object.prototype.hasOwnProperty.call(${CONST}, english) ? ${CONST}[english] : null;
}
`;
console.log(`${lang}: ${rows.length} rows written, ${held.length} held`);
for (const h of held) console.log(`  HELD ${JSON.stringify(h.en)} → ${JSON.stringify(h[lang])} — ${h.why.join('; ')}`);
if (DRY) process.exit(0);
// read the manifest before writing anything, so a broken manifest leaves the table untouched too
const mf = path.join(ROOT, 'lang-packs', lang, 'provisional-manifest.jsonl');
const prior = fs.existsSync(mf) ? fs.readFileSync(mf, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
fs.writeFileSync(path.join(ROOT, 'assets', `hero-lines-${lang}.js`), js);
const keep = prior.filter((m) => !String(m.key).startsWith('hero:'));
const added = rows.map((r) => ({ key: `hero:${r.en}`, [lang]: r[lang], status: 'provisional-pending-native-confirm', confidence: r.tag, checker: r.confidence, mode: r.mode, source: 'drafts-2026-10' }));
fs.writeFileSync(mf, [...keep, ...added].map((r) => JSON.stringify(r)).join('\n') + '\n');
console.log(`wrote assets/hero-lines-${lang}.js and ${added.length} manifest rows`);
