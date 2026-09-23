// Decide what every checked live isiZulu, isiXhosa and Sesotho line becomes (Part 2, step 10 — 2026-09-23).
//
// Inputs (all under output/translation-skills/live/ unless noted):
//   scan.json                  every live pair, its status (live-scan.mjs)
//   respell.json               the Sesotho re-spellings (st-respell.mjs)
//   redo-<n>.json              fresh translations by the sharpened skills: [{ id, lang, text }]
//   bt-claude.json             blind Claude back-translations: [{ k, back }]      (k = id, id-rs, id-r1 …)
//   bt-sol.json                blind Sol back-translations:    [{ k, back }]
//   judge-claude.json, judge-sol.json   the shared judge (JUDGE.md) on each: [{ k, verdict, reason }]
//   comet-zu.json              SSA-COMET, reference-free, isiZulu: [{ id: k, score }]
// Keys: "<id>" is the line as it is live, "<id>-rs" its re-spelling, "<id>-r1", "<id>-r2" redos.
//
// The rules (scripts/translation-skills/THRESHOLDS.json, comet/PROOF.json):
//   pass (ordinary line)  neither back-translation is MISMATCH, and the rule checks raise no high finding
//   pass (safety line)    BOTH back-translations MATCH, rule checks clean, and for isiZulu SSA-COMET ≥ 0.33
//                         (AfriCOMET needs a human reference, so it cannot gate a live isiXhosa line;
//                         neither model is ruled for Sesotho)
// Per line:
//   fail            first redo that passes is wired; none passes → safety: English; ordinary: stays as is (listed)
//   respell         the re-spelling is wired when it passes; else the first passing redo; else it stays (listed)
//   safety          stays when it passes the safety rule; else the first passing redo; else English
//   safety+respell  the re-spelling when it passes the safety rule; else a passing redo; else English
//   english         (st-0870, the stopgap) a passing redo replaces it; else it stays English
//
//   node scripts/translation-skills/live-decide.mjs  -> live/decisions.json (+ a summary on stdout)
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ruleCheck } from './rule-checks.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const dir = path.join(root, 'output', 'translation-skills', 'live');
const rd = (f) => JSON.parse(readFileSync(path.join(dir, f), 'utf8'));
const opt = (f) => (existsSync(path.join(dir, f)) ? rd(f) : []);
const COMET_MIN = JSON.parse(readFileSync(path.join(root, 'scripts', 'translation-skills', 'comet', 'PROOF.json'), 'utf8')).threshold['zu-qe'];

const scan = rd('scan.json').filter((r) => ['zu', 'xh', 'st'].includes(r.lang));
const respell = new Map(opt('respell.json').map((r) => [r.id, r.to]));
const text = new Map();                       // key -> candidate text
for (const r of scan) text.set(r.id, r.text);
for (const [id, to] of respell) text.set(`${id}-rs`, to);
for (const f of readdirSync(dir).filter((x) => /^redo-\d+\.json$/.test(x)).sort()) {
  const n = f.match(/\d+/)[0];
  for (const x of rd(f)) text.set(`${x.id}-r${n}`, x.text);
}
const verdicts = (f) => new Map(opt(f).map((j) => [j.k, j.verdict]));
const jc = verdicts('judge-claude.json'), js = verdicts('judge-sol.json');
const comet = new Map(opt('comet-zu.json').map((c) => [c.id, c.score]));

function check(row, key) {
  const t = text.get(key);
  if (!t) return null;
  // the live text's Claude verdict is the shared judge re-reading its 2026-09-19 back-translation
  const c = jc.get(key), s = js.get(key);
  const r = ruleCheck({ lang: row.lang, en: row.en, text: t });
  const cm = row.lang === 'zu' ? comet.get(key) : undefined;
  const safety = row.safety.length > 0;
  const missing = !c || !s || (safety && row.lang === 'zu' && cm === undefined);
  // a word lang-check finds only in this app's own copy is a question for a native, not a failure —
  // the same rule live-scan.mjs applies to the live lines (the calibration found no signal in it)
  const high = r.findings.filter((f) => f.severity === 'high' && f.rule !== 'lang-check:lexical');
  const rulesPass = high.length === 0;
  const ordinary = !missing && c !== 'MISMATCH' && s !== 'MISMATCH' && rulesPass;
  const safe = !missing && c === 'MATCH' && s === 'MATCH' && rulesPass && (row.lang !== 'zu' || cm >= COMET_MIN);
  return { key, text: t, claude: c || null, sol: s || null, rulesPass, ruleHigh: high.map((f) => f.rule), comet: cm ?? null, missing, pass: safety ? safe : ordinary };
}

const decisions = [];
for (const row of scan) {
  if (!['fail', 'respell', 'safety', 'safety+respell', 'english'].includes(row.status)) continue;
  const tried = [];
  const order = [];
  if (row.status === 'safety') order.push(row.id);
  if (row.status.includes('respell')) order.push(`${row.id}-rs`);
  for (let n = 1; n <= 3; n++) if (text.has(`${row.id}-r${n}`)) order.push(`${row.id}-r${n}`);
  let chosen = null;
  for (const k of order) { const c = check(row, k); if (!c) continue; tried.push(c); if (c.pass) { chosen = c; break; } }
  const pending = !chosen && tried.length > 0 && tried[tried.length - 1].missing;
  let outcome, to;
  if (chosen) { outcome = chosen.key === row.id ? 'keep' : chosen.key.endsWith('-rs') ? 'respell' : 'redo'; to = chosen.text; }
  else if (pending) { outcome = 'pending'; to = row.text; }
  else if (row.safety.length || row.status === 'english') { outcome = 'english'; to = row.en; }
  else { outcome = 'stays'; to = row.text; }
  decisions.push({ id: row.id, lang: row.lang, en: row.en, refs: row.refs, status: row.status, safety: row.safety, from: row.text, to, outcome, tried });
}
writeFileSync(path.join(dir, 'decisions.json'), JSON.stringify(decisions, null, 1));
const tally = {};
for (const d of decisions) { const t = (tally[d.lang] ||= {}); const k = `${d.status}→${d.outcome}`; t[k] = (t[k] || 0) + 1; }
for (const [l, t] of Object.entries(tally)) console.log(`[decide] ${l}: ${Object.entries(t).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
