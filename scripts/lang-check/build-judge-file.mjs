// Assembles a judge file for the Afrikaans humour review from a compact overrides file:
// every blue row gets the default verdict unless overridden, every proposed line is run through
// lang-check, and counts are computed. Used for judge one (Fable); judge two (Astra) writes its
// own file through the Codex route.
//
//   node scripts/lang-check/build-judge-file.mjs <overrides.json> <out.json>

import fs from 'node:fs';
import path from 'node:path';
import { check } from './lib/checker.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const [ovPath, outPath] = process.argv.slice(2);
const ov = JSON.parse(fs.readFileSync(ovPath, 'utf8'));
const rows = JSON.parse(fs.readFileSync(path.join(ROOT, 'review', 'af-judge-rows.json'), 'utf8')).blue;

const out = { judge: ov.judge, phase1: ov.phase1, rows: [], counts: { KEEP: 0, FIX: 0, KILL: 0 }, worst_recurring_failures: ov.worst_recurring_failures };
for (const r of rows) {
  const o = ov.rows[r.id] || ov.default;
  const row = { id: r.id, english: r.english, drafted: r.drafted, verdict: o.verdict, score: o.score, reason: o.reason, proposed_line: o.proposed_line || null, lang_check_result: null };
  if (row.proposed_line) {
    const v = check({ lang: 'af', en: r.english, text: row.proposed_line });
    row.lang_check_result = { action: v.action, confidence: v.confidence, findings: v.findings.filter((f) => f.severity !== 'low').map((f) => f.message) };
  }
  out.counts[row.verdict]++;
  out.rows.push(row);
}
fs.writeFileSync(outPath, JSON.stringify(out, null, 1));
const tri = out.rows.filter((r) => r.lang_check_result && r.lang_check_result.action !== 'pass');
console.log(`${ov.judge}: ${out.rows.length} rows — ${JSON.stringify(out.counts)}; ${out.rows.filter((r) => r.proposed_line).length} proposals, ${tri.length} not clean on lang-check`);
for (const r of tri) console.log(`  ${r.id} ${r.lang_check_result.action} ${r.lang_check_result.confidence}: ${r.lang_check_result.findings.join(' | ')}`);
