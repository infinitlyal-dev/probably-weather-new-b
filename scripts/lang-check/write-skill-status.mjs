// Rewrites the status block and the October section of the four translation skills (.claude/skills/<l>-qc/SKILL.md) from
// scripts/lang-check/exam-result-2026-10.json, so a future session drafting a line gets the discipline the checker now
// enforces, with the numbers that earned it. The generated translate block (scripts/translation-skills/build-skill-
// guidance.mjs) is left exactly as it is.
//
//   node scripts/lang-check/write-skill-status.mjs

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const exam = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'exam-result-2026-10.json'), 'utf8'));
const pct = (x) => `${Math.round(x * 100)}%`;
const NAME = { af: 'Afrikaans', zu: 'isiZulu', xh: 'isiXhosa', st: 'Sesotho' };
const WL = { af: 'Dutch', zu: 'isiXhosa / Afrikaans forms', xh: 'isiZulu forms', st: 'Setswana / Sepedi / Nguni forms' };

function status(lang) {
  const p = exam.perLanguage[lang], ok = exam.pass[lang];
  const ws = p.classes['wrong-sense'], wl = p.classes['wrong-language'];
  const verdict = ok.pass ? 'PASSED' : 'FAILED';
  const why = ok.pass ? '' : !ok.precisionHeld ? ' (precision went down)' : !ok.recallUp[0] ? ' (wrong-sense recall did not rise)' : ' (wrong-language recall did not rise)';
  const drafting = lang === 'af'
    ? 'Afrikaans is not a drafting target: Al is the native author. The checker screens his lines and the bespoke transcreations.'
    : ok.pass
      ? `**${NAME[lang]} may be drafted** (provisional, pending a native reader), through the full pipeline below.`
      : `**Do not draft new ${NAME[lang]} lines.** The rebuilt checker did not earn trust in ${NAME[lang]}${why}, and Al's brief (9 Oct 2026) says a language that fails is not drafted in. Existing provisional lines stay as they are; the checker of 6 Sept remains this language's gate.`;
  return `> **Status: rebuilt and examined (2026-10-09).** Exam: \`scripts/lang-check/exam-result-2026-10.md\` (the 6 Sept checker
> BEFORE against the rebuilt one AFTER, same gold set). ${NAME[lang]}: precision ${pct(p.before.precision)} → ${pct(p.after.precision)},
> recall ${pct(p.before.recall)} → ${pct(p.after.recall)}; wrong-sense ${pct(ws.before)} → ${pct(ws.after)}; wrong-language (${WL[lang]})
> ${pct(wl.before)} → ${pct(wl.after)}${wl.before >= 1 ? ' (at ceiling)' : ''}. **${verdict}** the brief's bar (recall up on wrong-sense and
> wrong-language, precision not down)${why}.${lang === 'af' ? ` Al's accepted Afrikaans lines flagged: ${exam.alAccepted.before} → ${exam.alAccepted.after} of ${exam.alAccepted.n}.` : ''}
> ${drafting}
`;
}

function section(lang) {
  const ok = exam.pass[lang]?.pass;
  return `## Drafting and checking a line (October 2026)

What the checker does now, in order (\`scripts/lang-check/lib/checker-v2.mjs\`, run with \`--v2\`):

1. **The corpus checker of 6 Sept, unchanged** (lexical, morphology, semantic glosses, contamination — below).
2. **Concord** (\`lib/concord.mjs\`, zu/xh/st): a clause-initial noun and the first subject concord after it (and, in isiZulu and isiXhosa, a possessive in -ase/-aka)
   must share a noun class. Rule-based, measured on native text before any gold item was scored: 0–1 false alarms per
   ~510 confirmed lines, 0.1–0.5 % of Leipzig sentences. A finding is MEDIUM: check the noun's class, then the concord.
3. **Attestation in context** (\`lib/ngram-attest.mjs\`): a word flagged as unknown, as a sense that misses the English, or as
   stray English is cleared when the corpus attests it in this very pairing (pair or triple ≥ 3) or the word itself ≥ 5
   times in the n-gram corpora (Leipzig, NCHLT, Wikipedia, the Constitution, and current web text — Isolezwe,
   I'solezwe lesiXhosa, gov.za, Maroela Media, Netwerk24's open pages; counts only, never text:
   \`node scripts/lang-check/fetch-corpora.mjs ngrams\`). Near-misses, time-of-day clashes, banned words, diacritics and
   untranslated core English are never cleared.
4. **Back-translation through a second model** (Sonnet 5.5 as a subagent): blind first, then compared with the English.
   \`drift\` → MEDIUM, \`wrong-language\` / \`untranslated\` / \`garbled\` → HIGH, only at confidence ≥ 0.6. This is the pass that
   catches a real word in the wrong sense (wolke → wolwe, imvula → imvu, ilanga → inyanga) — the corpora cannot.
5. **The protected lexicon is native ruling**: a finding on a word in \`lang-packs/${lang}/lexicon-protected.md\` becomes a note.

${lang === 'af' ? '' : ok ? `### Drafting ${NAME[lang]} (allowed — passed the October exam)

1. Read \`lang-packs/${lang}/PACK.md\`, \`errors-observed.md\`, \`lexicon-protected.md\`, \`banned-words.json\`, and the native notes
   (\`review/NATIVE_REVIEW_${lang.toUpperCase()}.md\`, \`review/${lang}-voice.md\`, \`review/${lang}-residue.md\`${lang === 'xh' ? ', `review/xh-st-addendum.md`' : lang === 'zu' ? ', `review/zu-addendum.md`' : ', `review/xh-st-addendum.md`'}). Those notes are real native speech
   and outrank any source you fetch.
2. Source = the current English line + Al's Afrikaans. **If the joke travels, translate the joke. If it rests on English
   wordplay or an SA-English idiom, write a plain warm observation about the same weather instead (the night-line rule)
   and mark it \`mode: "plain"\`.** Keep every detail a reader would notice (time, place, number, advice).
3. **Never coin a word.** If you cannot confirm one, use a plain attested word or a descriptive phrase and tag the line LOW.
4. Tag every draft HIGH / MED / LOW (HIGH = attested words, idiom certain; MED = structure sound, one word unsure;
   LOW = any word or construction you could not confirm). Write them to \`lang-packs/${lang}/drafts-<date>.jsonl\`
   (\`key, set, en, af, ${lang}, tag, mode\`).
5. Back-translate: \`node scripts/lang-check/bt.mjs export <set.json>\` → one Sonnet 5.5 subagent per batch with \`BT_BRIEF\`
   (in \`bt.mjs\`) → \`node scripts/lang-check/bt.mjs merge scripts/lang-check/data/bt\`. Fix what drifts and back-translate
   the fixed line again; a draft with no back-translation record is held.
6. Apply as provisional: bank slots through \`node scripts/apply-provisional-drafts.mjs --langs ${lang} --drafts
   lang-packs/{lang}/drafts-<date>.jsonl --verdicts lang-packs/{lang}/checker-verdicts-<date>.jsonl --apply\` (the gate holds
   triage-high), photo lines through \`node scripts/lang-check/apply-hero-lines-provisional.mjs --lang ${lang}\`.
7. \`node scripts/lang-check/build-bt-report.mjs --langs ${lang}\` → \`review/lines-backtranslation-<date>.md\` for Maat, who
   strikes drift before anything merges. Nothing reaches main without Al's go.
` : `### Drafting ${NAME[lang]}: not allowed

${NAME[lang]} failed the October exam (see the status above). Do not draft new lines in it; keep the debt in
\`lang-packs/${lang}/debt-ledger.jsonl\` for a native. The checker still runs (\`--v2\` shows what the rebuilt passes see), but
its verdicts are not trusted enough to wire a model's line on them.
`}`;
}

for (const lang of ['af', 'zu', 'xh', 'st']) {
  const f = path.join(ROOT, '.claude', 'skills', `${lang}-qc`, 'SKILL.md');
  let s = fs.readFileSync(f, 'utf8');
  // the status block: from the "> **Status:" line to the last ">" line after it
  s = s.replace(/> \*\*Status:[\s\S]*?\n(?!>)/, status(lang) + '\n');
  // the October section sits just before the generated translate block; replace it if present
  s = s.replace(/## Drafting and checking a line \(October 2026\)[\s\S]*?(?=<!-- translate:start)/, '');
  s = s.replace('<!-- translate:start', `${section(lang)}\n<!-- translate:start`);
  fs.writeFileSync(f, s);
  console.log(`${lang}: ${exam.pass[lang].pass ? 'PASS' : 'FAIL'} → ${path.relative(ROOT, f)}`);
}
