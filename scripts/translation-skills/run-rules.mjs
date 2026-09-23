// Checker (d) over a translation run (2026-09-23): each candidate line against its English.
//
// The English of a test run sits in the sealed gold files; this script opens them itself (seal
// checked), joins by id, runs rule-checks.mjs and writes output/translation-skills/<label>/rules.json.
// Prints counts per language only.
//
//   node scripts/translation-skills/run-rules.mjs --label baseline [--split test]
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ruleCheck } from './rule-checks.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const args = process.argv.slice(2);
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const LABEL = val('--label', 'baseline'); const SPLIT = val('--split', 'test');
const gold = path.join(root, 'scripts', 'translation-skills', 'gold');
const lock = JSON.parse(readFileSync(path.join(gold, 'LOCK.json'), 'utf8'));
const en = new Map();
for (const lang of ['af', 'zu', 'xh', 'st']) {
  const body = readFileSync(path.join(gold, `${lang}-${SPLIT}.json`), 'utf8');
  if (SPLIT === 'test' && createHash('sha256').update(body).digest('hex') !== lock.files[`${lang}-test.json`]) { console.error(`[rules] ${lang}-test.json breaks its seal`); process.exit(1); }
  for (const g of JSON.parse(body).items) en.set(g.id, g.en);
}
const dir = path.join(root, 'output', 'translation-skills', LABEL);
const cands = JSON.parse(readFileSync(path.join(dir, 'candidates.json'), 'utf8'));
const out = [];
const tally = {};
for (const c of cands) {
  const r = ruleCheck({ lang: c.lang, en: en.get(c.id), text: c.text });
  out.push({ id: c.id, lang: c.lang, pass: r.pass, findings: r.findings.map((f) => ({ rule: f.rule, severity: f.severity })) });
  const t = (tally[c.lang] ||= { lines: 0, fail: 0, rules: {} });
  t.lines += 1; if (!r.pass) t.fail += 1;
  for (const f of r.findings.filter((x) => x.severity === 'high')) t.rules[f.rule.split(':')[0]] = (t.rules[f.rule.split(':')[0]] || 0) + 1;
}
writeFileSync(path.join(dir, 'rules.json'), JSON.stringify(out, null, 1));
for (const [l, t] of Object.entries(tally)) console.log(`[rules] ${LABEL}/${l}: ${t.lines - t.fail}/${t.lines} pass; high findings ${JSON.stringify(t.rules)}`);
