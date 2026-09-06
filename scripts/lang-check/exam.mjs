// Validation exam: runs the baseline (old skills as code) and the corpus-backed checker over
// gold-set.json and reports precision / recall side by side, per language and per failure class.
//
//   node scripts/lang-check/exam.mjs [--threshold 0.25] [--verbose]
//
// Pass rule (from the brief): the rebuilt checker earns use only if it beats the baseline on
// recall for the wrong-sense and wrong-language classes without dropping precision.
// Adversarial wrong-sense items whose substitute word is NOT attested in the corpus index are
// excluded from scoring (they would be caught as unknown words, which is not the class under test).

import fs from 'node:fs';
import path from 'node:path';
import { baselineCheck } from './baseline.mjs';
import { check, LangIndex } from './lib/checker.mjs';
import { normalizeWord } from './lib/text.mjs';

const args = process.argv.slice(2);
const THRESH = parseFloat(args[args.indexOf('--threshold') + 1]) || 0.25;
const verbose = args.includes('--verbose');
const gold = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'gold-set.json'), 'utf8'));
const LANGS = ['zu', 'xh', 'st', 'af'];
const SCORED_CLASSES = ['wrong-sense', 'wrong-language', 'untranslated', 'diacritic', 'spelling', 'boundary', 'calque', 'morphology', 'unattested', 'register', 'capitalisation', 'wrong-dialect'];
// 'orthography-sa' (a South African spelling the Lesotho-orthography reviewer changed) is neither bad nor scored since Al's ruling of 2026-09-06
const HEADLINE = ['wrong-sense', 'wrong-language'];

// filter adversarial substitutes that the corpus does not attest
const excluded = [];
const items = gold.items.filter((it) => {
  if (it.adversarial && it.cls === 'wrong-sense') {
    const idx = LangIndex.load(it.lang);
    const to = normalizeWord(it.adversarial.to, it.lang);
    if (!idx.has(to)) { excluded.push(it); return false; }
  }
  return true;
});

const rows = [];
const t0 = Date.now();
for (const it of items) {
  const b = baselineCheck(it);
  const v = check(it);
  rows.push({ it, baseFlag: b.flagged, baseFlags: b.flags.map((f) => f.flag), newFlag: v.confidence >= THRESH, newConf: v.confidence, newFindings: v.findings.filter((f) => f.severity !== 'low').map((f) => `${f.severity}:${f.check}:${f.token}`), verdict: v });
}
const elapsed = Date.now() - t0;

function pr(subset, flagKey) {
  const tp = subset.filter((r) => r.it.label === 'bad' && r[flagKey]).length;
  const fp = subset.filter((r) => r.it.label === 'good' && r[flagKey]).length;
  const fn = subset.filter((r) => r.it.label === 'bad' && !r[flagKey]).length;
  const tn = subset.filter((r) => r.it.label === 'good' && !r[flagKey]).length;
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  return { tp, fp, fn, tn, precision, recall };
}
const pct = (x) => `${(x * 100).toFixed(0)}%`;
const result = { threshold: THRESH, generated: new Date().toISOString(), elapsedMs: elapsed, excludedAdversarial: excluded.length, perLanguage: {}, passRule: {} };
const md = [];
md.push(`# lang-check validation exam — ${new Date().toISOString().slice(0, 10)}`);
md.push('');
md.push(`Gold set: ${items.length} scored items (${excluded.length} adversarial wrong-sense items excluded because the substitute is not corpus-attested). Threshold for the new checker: confidence ≥ ${THRESH}. Baseline = the four SKILL.md check() procedures as code (scripts/lang-check/baseline.mjs).`);
md.push('');
for (const lang of LANGS) {
  const L = rows.filter((r) => r.it.lang === lang);
  const scored = L.filter((r) => r.it.label === 'good' ? !r.it.weak : SCORED_CLASSES.includes(r.it.cls) && !r.it.weak);
  const base = pr(scored, 'baseFlag'); const neu = pr(scored, 'newFlag');
  const strictGood = L.filter((r) => r.it.label === 'good' && !r.it.weak);
  const classes = {};
  for (const cls of [...SCORED_CLASSES, 'rewritten']) {
    const sub = L.filter((r) => r.it.label === 'bad' && r.it.cls === cls && !r.it.weak);
    if (!sub.length) continue;
    classes[cls] = { n: sub.length, baseRecall: sub.filter((r) => r.baseFlag).length / sub.length, newRecall: sub.filter((r) => r.newFlag).length / sub.length, newHigh: sub.filter((r) => r.newConf >= 0.5).length / sub.length };
  }
  const weakGood = L.filter((r) => r.it.label === 'good' && r.it.weak);
  result.perLanguage[lang] = { scoredItems: scored.length, good: strictGood.length, bad: scored.length - strictGood.length, baseline: base, rebuilt: neu, classes, weakGoodFlagged: { baseline: weakGood.filter((r) => r.baseFlag).length, rebuilt: weakGood.filter((r) => r.newFlag).length, n: weakGood.length } };
  md.push(`## ${lang} — ${strictGood.length} good, ${scored.length - strictGood.length} bad (scored classes)`);
  md.push('');
  md.push('| | precision | recall | TP | FP | FN | TN |');
  md.push('|---|---|---|---|---|---|---|');
  md.push(`| baseline (old skill) | ${pct(base.precision)} | ${pct(base.recall)} | ${base.tp} | ${base.fp} | ${base.fn} | ${base.tn} |`);
  md.push(`| rebuilt (corpus-backed) | ${pct(neu.precision)} | ${pct(neu.recall)} | ${neu.tp} | ${neu.fp} | ${neu.fn} | ${neu.tn} |`);
  md.push('');
  md.push('| class | n | baseline recall | rebuilt recall | rebuilt ≥0.5 |');
  md.push('|---|---|---|---|---|');
  for (const [cls, c] of Object.entries(classes)) md.push(`| ${cls} | ${c.n} | ${pct(c.baseRecall)} | ${pct(c.newRecall)} | ${pct(c.newHigh)} |`);
  md.push('');
  const cannotSee = Object.entries(classes).filter(([cls, c]) => c.baseRecall === 0 && cls !== 'rewritten').map(([cls]) => cls);
  md.push(`Baseline cannot see: ${cannotSee.length ? cannotSee.join(', ') : '(nothing at zero)'}. Weak-good rows (future_review / UI labels) flagged: baseline ${result.perLanguage[lang].weakGoodFlagged.baseline}/${weakGood.length}, rebuilt ${result.perLanguage[lang].weakGoodFlagged.rebuilt}/${weakGood.length}.`);
  md.push('');
  const headlineBase = HEADLINE.map((c) => classes[c]?.baseRecall ?? 0);
  const headlineNew = HEADLINE.map((c) => classes[c]?.newRecall ?? 0);
  const recallUp = headlineNew.every((r, i) => r > headlineBase[i]);
  const precisionHeld = neu.precision >= base.precision - 0.005;
  result.passRule[lang] = { recallUp, precisionHeld, pass: recallUp && precisionHeld, headline: { baseline: Object.fromEntries(HEADLINE.map((c, i) => [c, headlineBase[i]])), rebuilt: Object.fromEntries(HEADLINE.map((c, i) => [c, headlineNew[i]])) } };
  md.push(`Pass rule for ${lang}: wrong-sense recall ${pct(headlineBase[0])} → ${pct(headlineNew[0])}, wrong-language recall ${pct(headlineBase[1])} → ${pct(headlineNew[1])}, precision ${pct(base.precision)} → ${pct(neu.precision)} ⇒ **${recallUp && precisionHeld ? 'PASS' : 'FAIL'}**`);
  md.push('');
  if (verbose) {
    md.push('<details><summary>misses and false positives</summary>');
    md.push('');
    for (const r of scored) {
      if (r.it.label === 'bad' && !r.newFlag) md.push(`- MISS [${r.it.cls}] ${JSON.stringify(r.it.text)} (${r.it.source}) conf=${r.newConf}`);
      if (r.it.label === 'good' && r.newFlag) md.push(`- FP ${JSON.stringify(r.it.text)} conf=${r.newConf}: ${r.newFindings.join(' | ')}`);
    }
    md.push('');
    md.push('</details>');
    md.push('');
  }
}
result.overallPass = LANGS.every((l) => result.passRule[l].pass);
md.push(`## Verdict: ${result.overallPass ? 'PASS' : 'FAIL'} — ${LANGS.map((l) => `${l}:${result.passRule[l].pass ? 'pass' : 'FAIL'}`).join(' ')} (${(elapsed / 1000).toFixed(1)} s for ${items.length} items)`);
if (excluded.length) {
  md.push('');
  md.push(`Excluded adversarial wrong-sense substitutes (not attested, so they would be caught as unknown words rather than wrong sense): ${[...new Set(excluded.map((e) => `${e.lang}:${e.adversarial.to}`))].join(', ')}`);
}
fs.writeFileSync(path.join(import.meta.dirname, 'exam-result.json'), JSON.stringify({ ...result, rows: rows.map((r) => ({ id: r.it.id, lang: r.it.lang, label: r.it.label, cls: r.it.cls, weak: !!r.it.weak, text: r.it.text, baseFlag: r.baseFlag, newFlag: r.newFlag, newConf: r.newConf, newFindings: r.newFindings })) }, null, 1));
fs.writeFileSync(path.join(import.meta.dirname, 'exam-result.md'), md.join('\n'));
console.log(md.join('\n'));
