// Score a translation run on the SEALED test sets (Part 2, steps 7 and 9 — 2026-09-23).
//
// For every test item: did the run's translation pass the calibrated checkers?
//   pass = the shared judge's verdict on the Claude blind back-translation is inside its rule, and
//          the same for Sol's, and the rule checks raise no high finding        (THRESHOLDS.json)
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
  const body = readFileSync(path.join(here, 'gold', `${lang}-test.json`), 'utf8');
  if (createHash('sha256').update(body).digest('hex') !== lock.files[`${lang}-test.json`]) { console.error(`[score] ${lang}-test.json breaks its seal`); process.exit(1); }
  for (const g of JSON.parse(body).items) if (!excluded.has(g.feedbackId)) items.push(g);
}
const judgeC = new Map(rd(path.join(dir, 'judge-claude.json')).map((j) => [j.k, j.verdict]));
const judgeS = new Map(rd(path.join(dir, 'judge-sol.json')).map((j) => [j.k, j.verdict]));
const rules = new Map(rd(path.join(dir, 'rules.json')).map((r) => [r.id, r.pass]));
const table = {};
let missing = 0;
for (const g of items) {
  const c = judgeC.get(g.id), s = judgeS.get(g.id), r = rules.get(g.id);
  if (!c || !s || r === undefined) { missing += 1; continue; }
  const pass = !failClaude(c) && !failSol(s) && r;
  const type = g.verdict === 'approved' ? 'approved (no error)' : (types.get(g.feedbackId) || 'unclassified');
  for (const key of [`${g.lang}|${type}`, `${g.lang}|ALL`]) {
    const t = (table[key] ||= { n: 0, pass: 0 });
    t.n += 1; if (pass) t.pass += 1;
  }
}
writeFileSync(path.join(dir, 'score.json'), JSON.stringify({ label: LABEL, thresholds: th, missing, table }, null, 1));
console.log(`[score] ${LABEL}: pass = both blind back-translations inside their calibrated rule (Claude: ${th.claudeBT}; Sol: ${th.solBT}) and no high rule finding${missing ? `; ${missing} items missing a checker` : ''}`);
for (const lang of ['af', 'zu', 'xh', 'st']) {
  const rows = Object.entries(table).filter(([k]) => k.startsWith(`${lang}|`)).sort(([a], [b]) => (a.endsWith('ALL') ? -1 : b.endsWith('ALL') ? 1 : a.localeCompare(b)));
  console.log(`  ${lang}: ${rows.map(([k, t]) => `${k.split('|')[1]} ${t.pass}/${t.n}`).join(' · ')}`);
}
