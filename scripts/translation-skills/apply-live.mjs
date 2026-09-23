// Turn live-decide.mjs decisions into bank edits (Part 2, step 10 — 2026-09-23).
//
// isiZulu, isiXhosa and Sesotho live only in the condition bank, so every decision that changes a
// line — a re-spelling, a redo that passed, or a safety line going to English — becomes one
// bank-set.mjs edit per bank cell the pair sits in (same English, same language). Afrikaans is never
// written here (Al's page decides it). "stays", "keep" and "pending" change nothing.
//
//   node scripts/translation-skills/apply-live.mjs [--dry]
//   -> output/translation-skills/live/edits.json, then bank-set.mjs --edits it
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const live = path.join(root, 'output', 'translation-skills', 'live');
const decisions = JSON.parse(readFileSync(path.join(live, 'decisions.json'), 'utf8'));
const edits = [];
const skipped = [];
for (const d of decisions) {
  if (d.lang === 'af' || !['respell', 'redo', 'english'].includes(d.outcome) || d.to === d.from) continue;
  for (const r of d.refs) {
    if (r.kind !== 'bank' || typeof r.i !== 'number') { skipped.push(`${d.id} ${r.ns}:${r.bin} (not an array cell)`); continue; }
    edits.push({ ns: r.ns, bin: r.bin, en: d.en, lang: d.lang, from: d.from, to: d.to, why: `${d.outcome} (${d.id}, ${d.status})` });
  }
}
// the same cell reached twice (a pair listed under two refs of one bin) is written once
const seen = new Set();
const unique = edits.filter((e) => { const k = `${e.ns}|${e.bin}|${e.lang}|${e.en}`; if (seen.has(k)) return false; seen.add(k); return true; });
writeFileSync(path.join(live, 'edits.json'), JSON.stringify(unique, null, 1));

// The record tests/translation-live-record.test.js holds the bank to: every isiZulu, isiXhosa and
// Sesotho safety line shows either the text that passed the safety rule or the English; the lines
// that failed and stay are listed with why; Sesotho lines left in a Lesotho spelling are named.
const pick = (d) => { const c = d.tried.find((t) => t.text === d.to) || null; return c ? { claude: c.claude, sol: c.sol, comet: c.comet, rules: c.rulesPass } : null; };
const record = {
  generated: new Date().toISOString().slice(0, 10),
  rule: 'Safety line: BOTH blind back-translations (Claude, Sol) MATCH, rule checks clean (a word lang-check finds only in this app is a question, not a failure), and for isiZulu SSA-COMET >= 0.33 — else it shows in English. Ordinary line: neither back-translation MISMATCH and the rule checks clean.',
  safety: decisions.filter((d) => d.safety.length).map((d) => ({ lang: d.lang, en: d.en, text: d.to, outcome: d.outcome === 'english' ? 'english' : 'checked', checks: d.outcome === 'english' ? null : pick(d) })),
  stays: decisions.filter((d) => d.outcome === 'stays').map((d) => ({ lang: d.lang, en: d.en, text: d.to, why: d.tried.map((t) => `${t.key.replace(/^[a-z]{2}-L\d+/, 'live')}: Claude ${t.claude}, Sol ${t.sol}${t.rulesPass ? '' : `, rules ${t.ruleHigh.join(', ')}`}`).join('; ') })),
};
writeFileSync(path.join(root, 'scripts', 'translation-skills', 'LIVE-RECORD.json'), JSON.stringify(record, null, 1));
console.log(`[apply-live] LIVE-RECORD.json: ${record.safety.length} safety lines (${record.safety.filter((s) => s.outcome === 'english').length} English), ${record.stays.length} failing lines that stay`);
const tally = {};
for (const e of unique) { const k = `${e.lang} ${e.why.split(' ')[0]}`; tally[k] = (tally[k] || 0) + 1; }
console.log(`[apply-live] ${unique.length} bank cells: ${JSON.stringify(tally)}${skipped.length ? `; not array cells (handled by hand): ${skipped.join('; ')}` : ''}`);
if (process.argv.includes('--dry')) process.exit(0);
const r = spawnSync(process.execPath, [path.join(root, 'scripts', 'translation-skills', 'bank-set.mjs'), '--edits', path.join(live, 'edits.json')], { encoding: 'utf8' });
console.log((r.stdout || '').split('\n').filter((l) => l.startsWith('[bank-set] ') && !l.includes('"')).join('\n'));
if (r.status !== 0) { console.error(r.stderr); process.exit(1); }
