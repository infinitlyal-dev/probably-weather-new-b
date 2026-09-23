// Calibrate the checkers on Al's Afrikaans (Part 2, step 6 — 2026-09-23).
//
// Al marked 40 blind lines GOOD / DRIFT-BUT-FINE / WRONG (review/af-calibration-ruled.json).
// WRONG is what a checker must stop; GOOD and DRIFT-BUT-FINE are what it must let through.
// A line he left unmarked but wrote a replacement for in its note counts as CORRECTED: he would
// change it, so it sits with WRONG as the "needs change" class. (His export of 2026-09-23: 35 GOOD,
// 0 DRIFT-BUT-FINE, 0 WRONG, 5 unmarked with a corrected line in the note.)
// For each checker, and each pass rule it could use, this counts:
//   caught        the needs-change lines the checker fails       (sensitivity)
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
// Two free tests for checker (a): the 77 Afrikaans lines Al wrote or kept that the old check
// flagged anyway, and — once he has ruled it — his KEEP / FIX / CUT on those same flagged lines
// (review/translation-check-ruled.json): how often the old check's MISMATCH and DRIFT were lines
// he then changed.
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
const classOf = (r) => r.verdict || (String(r.note || '').trim() ? 'CORRECTED' : null);
const ruling = rd(RULING).rulings.map((r) => ({ ...r, cls: classOf(r) })).filter((r) => r.cls);
const data = new Map(rd(path.join(root, 'review', 'translation-check-data.json')).rows.map((r) => [r.k, r]));
const judgeA = new Map(rd(path.join(cal, 'judge-A.out.json')).map((j) => [j.k, j]));
const judgeB = new Map(rd(path.join(cal, 'judge-B.out.json')).map((j) => [j.k, j]));
const rules = new Map(rd(path.join(cal, 'af-rules.json')).map((r) => [r.k, r]));

const bad = (r) => r.cls === 'WRONG' || r.cls === 'CORRECTED';
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
// Pick by balanced accuracy; with no needs-change line to catch it is undefined, and then the rule
// that lets more of Al's good lines through wins (specificity) — never the stricter rule by default,
// which would fail lines he passed. The stricter rule wins only a true tie.
const rank = (s) => (s.balanced ?? (s.specificity ?? -1) / 2);
const best = (prefix) => Object.entries(RULES).map(([rn, fails]) => ({ rn, fails, s: results[`${prefix} — ${rn}`] }))
  .sort((x, y) => rank(y.s) - rank(x.s) || (x.rn === 'fail DRIFT or MISMATCH' ? -1 : 1))[0];
const bestA = best("(a') Claude BT, shared judge");
const bestB = best('(b) Sol BT, shared judge');
results['combined: (a\') OR (b) OR (d) fails'] = score((k) => {
  const a = judgeA.get(k)?.verdict, b = judgeB.get(k)?.verdict;
  if (!a || !b) return null;
  return bestA.fails(a) || bestB.fails(b) || (rules.has(k) && !rules.get(k).pass);
});
results['combined: (a\') AND (b) both DRIFT-or-worse'] = score((k) => {
  const a = judgeA.get(k)?.verdict, b = judgeB.get(k)?.verdict;
  if (!a || !b) return null;
  return a !== 'MATCH' && b !== 'MATCH';
});

// Free test 1: Al's own lines that the old check flagged.
const alOwnFlagged = [...data.values()].filter((r) => r.lang === 'af' && r.alRuledAf && r.flagged);
// Free test 2: his KEEP / FIX / CUT on the flagged lines of the translation page.
const PAGE = path.join(root, 'review', 'translation-check-ruled.json');
let pageTest = null;
if (existsSync(PAGE)) {
  const t = {};
  for (const r of rd(PAGE).rulings) {
    const cls = classOf(r);
    if (!cls) continue;
    const old = data.get(r.k)?.verdict || '?';
    const row = (t[old] ||= { lines: 0, kept: 0, changed: 0 });
    row.lines += 1;
    if (cls === 'KEEP') row.kept += 1; else row.changed += 1;
  }
  pageTest = { note: 'Old check (a) verdict on the flagged Afrikaans lines vs Al\'s ruling: KEEP = the flag was wrong; FIX / CUT / a correction in the note = he changed the line.', byOldVerdict: t };
}

const polish = ruling.filter((r) => r.cls === 'CORRECTED' && ['MATCH'].includes(judgeA.get(r.k)?.verdict) && judgeB.get(r.k)?.verdict === 'MATCH').length;
const thresholds = {
  generated: new Date().toISOString().slice(0, 10),
  ruling: path.relative(root, RULING).replace(/\\/g, '/'),
  alMarked: ruling.length,
  alVerdicts: ruling.reduce((m, r) => (m[r.cls] = (m[r.cls] || 0) + 1, m), {}),
  results,
  chosen: {
    claudeBT: bestA.rn, solBT: bestB.rn,
    passRule: `A line passes when the shared judge's verdict on BOTH blind back-translations is inside its calibrated rule (Claude: ${bestA.rn}; Sol: ${bestB.rn}) and the rule checks raise no high finding.`,
    safetyRule: 'A safety line (advice or a warning) passes only when BOTH back-translations are MATCH, the rule checks are clean, and the automatic scorer (isiZulu SSA-COMET, isiXhosa AfriCOMET) is at or above its threshold where the language is covered; otherwise it shows in English.',
    why: `Al passed every one of his ${ruling.filter((r) => !bad(r)).length} GOOD lines; failing on DRIFT would have failed ${results["(a') Claude BT, shared judge — fail DRIFT or MISMATCH"].letThrough.split('/').map(Number).reduce((a, b) => b - a)} of them on Claude's back-translation and ${results['(b) Sol BT, shared judge — fail DRIFT or MISMATCH'].letThrough.split('/').map(Number).reduce((a, b) => b - a)} on Sol's. ${polish} of his ${ruling.filter(bad).length} corrections are wording or spelling a back-translation cannot see (both back-translations MATCH): that is the language agent's and the rule checks' job, not the back-translator's.`,
  },
  freeTestOfOldChecker: { note: 'Afrikaans lines Al wrote or kept (his own verdict: acceptable) that the 2026-09-19 check flagged anyway — false flags from his point of view.', count: alOwnFlagged.length, byVerdict: alOwnFlagged.reduce((m, r) => (m[r.verdict] = (m[r.verdict] || 0) + 1, m), {}) },
  pageTestOfOldChecker: pageTest,
};
writeFileSync(path.join(root, 'scripts', 'translation-skills', 'THRESHOLDS.json'), JSON.stringify(thresholds, null, 1));
console.log(`[calibrate] ${ruling.length} lines marked by Al: ${JSON.stringify(thresholds.alVerdicts)}`);
for (const [name, s] of Object.entries(results)) console.log(`  ${name.padEnd(60)} n=${String(s.n).padStart(2)} caught ${s.caught.padEnd(6)} let through ${s.letThrough.padEnd(6)} kappa ${s.kappa === null ? '—' : s.kappa.toFixed(2)}`);
console.log(`[calibrate] chosen: Claude BT ${bestA.rn}; Sol BT ${bestB.rn}. ${thresholds.chosen.why}`);
console.log(`[calibrate] free test: ${alOwnFlagged.length} of Al's own lines flagged by the old check (${JSON.stringify(thresholds.freeTestOfOldChecker.byVerdict)}).`);
if (pageTest) console.log(`[calibrate] page test: ${JSON.stringify(pageTest.byOldVerdict)}`);
