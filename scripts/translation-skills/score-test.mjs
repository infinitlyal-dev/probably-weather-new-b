// Score a translation run on the SEALED test sets (Part 2, steps 7 and 9 — 2026-09-23).
//
// For every test item: did the run's translation pass the calibrated checkers?
//   pass   = the shared judge's verdict on the Claude blind back-translation is inside its rule, and
//            the same for Sol's, and the rule checks raise no high finding        (THRESHOLDS.json)
//   clean  = both back-translations MATCH and no high rule finding — the stricter measure; the
//            calibrated rule (MISMATCH only) is a gate for Al's taste, too coarse to show a change
//   comet  = the automatic scorer's mean where the language is covered (isiZulu SSA-COMET with and
//            without the reference, isiXhosa AfriCOMET with it), from comet.json when present
// Reported per language and per error type — the type is what the HUMAN fixed in that item's
// original (the taxonomy of the correction, joined by feedbackId); items a human approved as
// they were count under "approved (no error)". Exclusions (gold/EXCLUSIONS.json) are skipped.
//
// Aggregates only: the test sets are sealed (gold/LOCK.json) and no item is printed or written
// outside output/translation-skills/<label>/score.json (git-ignored).
//
//   node scripts/translation-skills/score-test.mjs --label baseline
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const args = process.argv.slice(2);
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const LABEL = val('--label', 'baseline');
const SPLIT = val('--split', 'test');   // dev: a sharpening round (no seal; dev ids only)
const here = path.join(root, 'scripts', 'translation-skills');
const dir = path.join(root, 'output', 'translation-skills', LABEL);
const rd = (p) => JSON.parse(readFileSync(p, 'utf8'));
const TH = path.join(here, 'THRESHOLDS.json');
if (!existsSync(TH)) { console.error('[score] no THRESHOLDS.json yet — calibrate first (waits for Al\'s export)'); process.exit(2); }
const th = rd(TH).chosen;
const failBy = (rule) => (v) => (rule === 'fail MISMATCH only' ? v === 'MISMATCH' : v === 'DRIFT' || v === 'MISMATCH');
const failClaude = failBy(th.claudeBT), failSol = failBy(th.solBT);

const lock = rd(path.join(here, 'gold', 'LOCK.json'));
const excluded = new Set(rd(path.join(here, 'gold', 'EXCLUSIONS.json')).items.map((x) => x.feedbackId));
const types = new Map(existsSync(path.join(root, 'output', 'translation-skills', 'taxonomy', 'all.json'))
  ? rd(path.join(root, 'output', 'translation-skills', 'taxonomy', 'all.json')).filter((r) => r.population === 'correction').map((r) => [r.id, r.primary]) : []);
const items = [];
for (const lang of ['af', 'zu', 'xh', 'st']) {
  const body = readFileSync(path.join(here, 'gold', `${lang}-${SPLIT}.json`), 'utf8');
  if (SPLIT === 'test' && createHash('sha256').update(body).digest('hex') !== lock.files[`${lang}-test.json`]) { console.error(`[score] ${lang}-test.json breaks its seal`); process.exit(1); }
  for (const g of JSON.parse(body).items) if (!excluded.has(g.feedbackId)) items.push(g);
}
const judgeC = new Map(rd(path.join(dir, 'judge-claude.json')).map((j) => [j.k, j.verdict]));
// Dev rounds run without Sol (its budget is kept for the final test score and the live lines): the
// Sol side then counts as MATCH and the report says so.
const SOL = existsSync(path.join(dir, 'judge-sol.json'));
const judgeS = new Map(SOL ? rd(path.join(dir, 'judge-sol.json')).map((j) => [j.k, j.verdict]) : []);
const rules = new Map(rd(path.join(dir, 'rules.json')).map((r) => [r.id, r.pass]));
const comet = new Map();
if (existsSync(path.join(dir, 'comet.json'))) for (const c of rd(path.join(dir, 'comet.json'))) comet.set(`${c.id}|${c.mode}`, c.score);
const table = {};
let missing = 0;
for (const g of items) {
  const c = judgeC.get(g.id), s = SOL ? judgeS.get(g.id) : 'MATCH', r = rules.get(g.id);
  if (!rules.has(g.id) && SPLIT === 'dev') continue;   // a dev round scores its own subset
  if (!c || !s || r === undefined) { missing += 1; continue; }
  const pass = !failClaude(c) && !failSol(s) && r;
  const clean = c === 'MATCH' && s === 'MATCH' && r;
  const type = g.verdict === 'approved' ? 'approved (no error)' : (types.get(g.feedbackId) || 'unclassified');
  for (const key of [`${g.lang}|${type}`, `${g.lang}|ALL`]) {
    const t = (table[key] ||= { n: 0, pass: 0, clean: 0, claudeMatch: 0, solMatch: 0, mismatch: 0, ruleFail: 0, comet: {} });
    t.n += 1; if (pass) t.pass += 1; if (clean) t.clean += 1;
    if (c === 'MATCH') t.claudeMatch += 1; if (s === 'MATCH') t.solMatch += 1;
    if (c === 'MISMATCH' || s === 'MISMATCH') t.mismatch += 1; if (!r) t.ruleFail += 1;
    for (const mode of ['zu-ref', 'zu-qe', 'xh-ref']) {
      const v = comet.get(`${g.id}|${mode}`);
      if (v !== undefined) { const m = (t.comet[mode] ||= { n: 0, sum: 0 }); m.n += 1; m.sum += v; }
    }
  }
}
for (const t of Object.values(table)) for (const m of Object.values(t.comet)) m.mean = Number((m.sum / m.n).toFixed(4));
writeFileSync(path.join(dir, 'score.json'), JSON.stringify({ label: LABEL, thresholds: th, missing, table }, null, 1));
console.log(`[score] ${LABEL} (${SPLIT}${SOL ? '' : ', Claude back-translation only'}): pass = no MISMATCH on either blind back-translation (calibrated: Claude ${th.claudeBT}; Sol ${th.solBT}) and no high rule finding; clean = both MATCH and no high rule finding${missing ? `; ${missing} items missing a checker` : ''}`);
const pct = (a, n) => `${a}/${n} (${Math.round((100 * a) / n)}%)`;
for (const lang of ['af', 'zu', 'xh', 'st']) {
  const rows = Object.entries(table).filter(([k]) => k.startsWith(`${lang}|`)).sort(([a], [b]) => (a.endsWith('ALL') ? -1 : b.endsWith('ALL') ? 1 : a.localeCompare(b)));
  for (const [k, t] of rows) {
    const cm = Object.entries(t.comet).map(([m, v]) => `${m} ${v.mean.toFixed(3)}`).join(' ');
    console.log(`  ${lang} ${k.split('|')[1].padEnd(20)} n=${String(t.n).padStart(3)}  pass ${pct(t.pass, t.n).padEnd(14)} clean ${pct(t.clean, t.n).padEnd(14)} mismatch ${String(t.mismatch).padStart(2)}  rule-fail ${String(t.ruleFail).padStart(2)}  ${cm}`);
  }
}
