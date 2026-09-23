// Calibrate the checkers on Al's Afrikaans (Part 2, step 6 — 2026-09-23).
//
// Al marked 40 blind lines GOOD / DRIFT-BUT-FINE / WRONG (review/af-calibration-ruled.json).
// WRONG is what a checker must stop; GOOD and DRIFT-BUT-FINE are what it must let through.
// For each checker, and each pass rule it could use, this counts:
//   caught        Al's WRONG lines the checker fails            (sensitivity)
//   let through   Al's GOOD / DRIFT-BUT-FINE lines it passes     (specificity)
//   agreement, Cohen's kappa
// and picks the rule with the best balanced accuracy, preferring the stricter rule on a tie
// (a line held back to English costs less than a wrong line shipped). Safety lines get the
// strictest rule that still lets Al's own good lines through.
//
// Checkers: (a) the 2026-09-19 Claude back-translation, its own verdict; (a') the same
// back-translation re-judged by the shared judge (JUDGE.md); (b) Sol's blind back-translation,
// shared judge; (d) the rule checks; and the combination the scan will use.
//
// A second, free test for checker (a): the 77 Afrikaans lines Al wrote or kept that the old check
// flagged anyway — each one a disagreement with Al, since his own lines are his verdict.
//
//   node scripts/translation-skills/calibrate.mjs [--ruling review/af-calibration-ruled.json]
//   -> scripts/translation-skills/THRESHOLDS.json
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const args = process.argv.slice(2);
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const RULING = path.resolve(root, val('--ruling', 'review/af-calibration-ruled.json'));
if (!existsSync(RULING)) { console.error(`[calibrate] no ruling at ${RULING} — waiting for Al's export`); process.exit(2); }
const cal = path.join(root, 'output', 'translation-skills', 'calibration');
const rd = (p) => JSON.parse(readFileSync(p, 'utf8'));
const ruling = rd(RULING).rulings.filter((r) => r.verdict);
const data = new Map(rd(path.join(root, 'review', 'translation-check-data.json')).rows.map((r) => [r.k, r]));
const judgeA = new Map(rd(path.join(cal, 'judge-A.out.json')).map((j) => [j.k, j]));
const judgeB = new Map(rd(path.join(cal, 'judge-B.out.json')).map((j) => [j.k, j]));
const rules = new Map(rd(path.join(cal, 'af-rules.json')).map((r) => [r.k, r]));

const bad = (r) => r.verdict === 'WRONG';
const RULES = {
  'fail MISMATCH only': (v) => v === 'MISMATCH',
  'fail DRIFT or MISMATCH': (v) => v === 'DRIFT' || v === 'MISMATCH',
};
const CHECKERS = {
  '(a) Claude BT, own verdict': (k) => data.get(k)?.verdict,
  "(a') Claude BT, shared judge": (k) => judgeA.get(k)?.verdict,
  '(b) Sol BT, shared judge': (k) => judgeB.get(k)?.verdict,
};
function score(failFn) {
  let tp = 0, fn = 0, tn = 0, fp = 0, n = 0;
  for (const r of ruling) {
    const f = failFn(r.k);
    if (f === null || f === undefined) continue;
    n += 1;
    if (bad(r)) (f ? tp++ : fn++); else (f ? fp++ : tn++);
  }
  const sens = tp + fn ? tp / (tp + fn) : null, spec = tn + fp ? tn / (tn + fp) : null;
  const agree = n ? (tp + tn) / n : null;
  const pe = n ? (((tp + fp) / n) * ((tp + fn) / n) + ((fn + tn) / n) * ((fp + tn) / n)) : 0;
  const kappa = n && pe < 1 ? (agree - pe) / (1 - pe) : null;
  const balanced = sens !== null && spec !== null ? (sens + spec) / 2 : null;
  return { n, caught: `${tp}/${tp + fn}`, letThrough: `${tn}/${tn + fp}`, sensitivity: sens, specificity: spec, agreement: agree, kappa, balanced };
}
const results = {};
for (const [name, get] of Object.entries(CHECKERS)) {
  for (const [ruleName, fails] of Object.entries(RULES)) results[`${name} — ${ruleName}`] = score((k) => (get(k) ? fails(get(k)) : null));
}
results['(d) rule checks'] = score((k) => (rules.has(k) ? !rules.get(k).pass : null));
// the combination: fail when EITHER back-translation fails under its rule, or the rules fail
const best = (prefix) => Object.entries(RULES).map(([rn, fails]) => ({ rn, fails, s: results[`${prefix} — ${rn}`] }))
  .sort((x, y) => (y.s.balanced ?? -1) - (x.s.balanced ?? -1) || (x.rn === 'fail DRIFT or MISMATCH' ? -1 : 1))[0];
const bestA = best("(a') Claude BT, shared judge");
const bestB = best('(b) Sol BT, shared judge');
results['combined: (a\') OR (b) OR (d) fails'] = score((k) => {
  const a = judgeA.get(k)?.verdict, b = judgeB.get(k)?.verdict;
  if (!a || !b) return null;
  return bestA.fails(a) || bestB.fails(b) || (rules.has(k) && !rules.get(k).pass);
});
results['combined: (a\') AND (b) both fail'] = score((k) => {
  const a = judgeA.get(k)?.verdict, b = judgeB.get(k)?.verdict;
  if (!a || !b) return null;
  return bestA.fails(a) && bestB.fails(b);
});

// The free test: Al's own lines that the old check flagged.
const alOwnFlagged = [...data.values()].filter((r) => r.lang === 'af' && r.alRuledAf && r.flagged);
const thresholds = {
  generated: new Date().toISOString().slice(0, 10),
  ruling: path.relative(root, RULING).replace(/\\/g, '/'),
  alMarked: ruling.length,
  alVerdicts: ruling.reduce((m, r) => (m[r.verdict] = (m[r.verdict] || 0) + 1, m), {}),
  results,
  chosen: {
    claudeBT: bestA.rn, solBT: bestB.rn,
    passRule: `A line passes when the shared judge's verdict on BOTH blind back-translations is inside its calibrated rule (Claude: ${bestA.rn}; Sol: ${bestB.rn}) and the rule checks raise no high finding.`,
    safetyRule: 'A safety line (advice or a warning) passes only when BOTH back-translations are MATCH, the rule checks are clean, and the automatic scorer (isiZulu SSA-COMET, isiXhosa AfriCOMET) is at or above its threshold where the language is covered; otherwise it shows in English.',
  },
  freeTestOfOldChecker: { note: 'Afrikaans lines Al wrote or kept (his own verdict: acceptable) that the 2026-09-19 check flagged anyway — false flags from his point of view.', count: alOwnFlagged.length, byVerdict: alOwnFlagged.reduce((m, r) => (m[r.verdict] = (m[r.verdict] || 0) + 1, m), {}) },
};
writeFileSync(path.join(root, 'scripts', 'translation-skills', 'THRESHOLDS.json'), JSON.stringify(thresholds, null, 1));
console.log(`[calibrate] ${ruling.length} lines marked by Al: ${JSON.stringify(thresholds.alVerdicts)}`);
for (const [name, s] of Object.entries(results)) console.log(`  ${name.padEnd(60)} n=${String(s.n).padStart(2)} caught ${s.caught.padEnd(6)} let through ${s.letThrough.padEnd(6)} kappa ${s.kappa === null ? '—' : s.kappa.toFixed(2)}`);
console.log(`[calibrate] chosen: Claude BT ${bestA.rn}; Sol BT ${bestB.rn}. Free test: ${alOwnFlagged.length} of Al's own lines flagged by the old check (${JSON.stringify(thresholds.freeTestOfOldChecker.byVerdict)}).`);
