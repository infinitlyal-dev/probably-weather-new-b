// Runs the corpus-backed checker over a translation set and writes a triage list — only the
// lines a native reader needs to see, ranked by confidence, each with the specific doubt and
// the corpus evidence behind it.
//
//   node scripts/lang-check/triage.mjs --lang af            # the 883-line bespoke set (533 new + 350 reused)
//   node scripts/lang-check/triage.mjs --lang zu|xh|st      # provisional fills pending native confirm
//   node scripts/lang-check/triage.mjs --lang zu --file lines.json   # any [{en,text,key}] set
//
// Output: review/lang-check-triage-<lang>.md and .json

import fs from 'node:fs';
import path from 'node:path';
import { check } from './lib/checker.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const args = process.argv.slice(2);
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const lang = val('--lang');
if (!/^(af|zu|xh|st)$/.test(lang || '')) { console.error('usage: --lang af|zu|xh|st [--file lines.json]'); process.exit(2); }
const readJsonl = (p) => fs.existsSync(p) ? fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];

let items = [];
let setName = '';
if (val('--file')) {
  const raw = fs.readFileSync(val('--file'), 'utf8');
  items = raw.trim().startsWith('[') ? JSON.parse(raw) : raw.split('\n').filter(Boolean).map((l) => JSON.parse(l));
  setName = path.basename(val('--file'));
} else if (lang === 'af') {
  const work = JSON.parse(fs.readFileSync(path.join(ROOT, 'review/af-worklist.json'), 'utf8'));
  const af = new Map();
  for (const b of [1, 2, 3, 4]) {
    const doc = JSON.parse(fs.readFileSync(path.join(ROOT, `review/af-batch-${b}.json`), 'utf8'));
    for (const [en, v] of doc.pairs) af.set(en, v);
  }
  for (const e of work.fresh) items.push({ lang, en: e.text, text: af.get(e.text) || '', key: `${e.condition}/${e.time}`, source: 'new' });
  for (const e of work.reuse) items.push({ lang, en: e.text, text: e.af, key: `${e.condition}/${e.time} (bank ${e.from})`, source: 'bank' });
  setName = `review/af-batch-1..4.json — ${work.freshCount} newly transcreated + ${work.reuseCount} reused from the native-reviewed bank`;
} else {
  // provisional fills: the drafts that shipped provisionally, pending native confirmation
  const manifest = readJsonl(path.join(ROOT, 'lang-packs', lang, 'provisional-manifest.jsonl'));
  const drafts = new Map(readJsonl(path.join(ROOT, 'lang-packs', lang, 'drafts-batch-1.jsonl')).map((d) => [d.key, d]));
  for (const m of manifest) {
    const d = drafts.get(m.key);
    items.push({ lang, en: d?.en || '', text: m[lang], key: m.key, source: `provisional (${m.confidence || d?.confidence || '?'})` });
  }
  setName = `lang-packs/${lang}/provisional-manifest.jsonl — ${manifest.length} provisional fills pending native confirm`;
}

const t0 = Date.now();
const results = items.map((it) => ({ item: it, verdict: check(it) }));
const ms = Date.now() - t0;
const triage = results.filter((r) => !r.verdict.ok).sort((a, b) => b.verdict.confidence - a.verdict.confidence);
const pass = results.filter((r) => r.verdict.ok);
const byCheck = {};
for (const r of triage) for (const f of r.verdict.findings) if (f.severity !== 'low') byCheck[`${f.check}`] = (byCheck[f.check] || 0) + 1;

const LANG_NAME = { af: 'Afrikaans', zu: 'isiZulu', xh: 'isiXhosa', st: 'Sesotho' };
const md = [];
md.push(`# lang-check triage — ${LANG_NAME[lang]} — ${new Date().toISOString().slice(0, 10)}`);
md.push('');
md.push(`Set: ${setName}.`);
md.push(`Checked ${results.length} lines in ${(ms / 1000).toFixed(1)} s. **${triage.length} need a human** (${triage.filter((r) => r.verdict.action === 'triage-high').length} high, ${triage.filter((r) => r.verdict.action === 'triage').length} lower); ${pass.length} passed every corpus check.`);
md.push('');
md.push(`Doubt types among the triaged lines: ${Object.entries(byCheck).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}.`);
md.push('');
md.push('"Passed" means the corpora found nothing to object to. It does not mean the line lands — a transcreated joke can be attested word for word and still miss. The checker cannot see register, humour, or a real word used in a sense the dictionaries also list.');
md.push('');
md.push('Ranked by confidence that something is wrong. Each entry: the doubt, then the evidence (source counts and an attested sentence). Nothing here has been changed in the banks.');
md.push('');
let n = 0;
for (const r of triage) {
  n++;
  const v = r.verdict;
  md.push(`### ${lang.toUpperCase()}-T${n} · ${v.confidence.toFixed(2)} · ${v.action === 'triage-high' ? 'HIGH' : 'lower'} · ${r.item.key || ''}${r.item.source ? ` · ${r.item.source}` : ''}`);
  md.push(`- **EN:** ${r.item.en}`);
  md.push(`- **${lang.toUpperCase()}:** ${r.item.text || '(empty)'}`);
  for (const f of v.findings) {
    if (f.severity === 'low') continue;
    md.push(`- **${f.severity} / ${f.check}:** ${f.message}`);
    const ex = f.evidence?.cite?.example || f.evidence?.example || f.evidence?.closest?.example;
    if (ex) md.push(`  - evidence: *${ex.source}* — ${ex.text.slice(0, 160)}`);
  }
  const lows = v.findings.filter((f) => f.severity === 'low');
  if (lows.length) md.push(`- notes: ${lows.map((f) => f.message).join(' · ')}`);
  if (v.coverage) md.push(`- coverage: ${v.coverage.attested}/${v.coverage.contentTokens} content words attested; source words matched ${v.coverage.enMatched.length}/${v.coverage.enContent}${v.coverage.enUnmatched.length ? ` (unmatched: ${v.coverage.enUnmatched.join(', ')})` : ''}`);
  md.push('');
}
md.push(`## Passed (${pass.length})`);
md.push('');
md.push('Listed so the reader can see what was not sent to them. Low-severity notes only.');
md.push('');
for (const r of pass) md.push(`- ${r.item.key ? `\`${r.item.key}\` ` : ''}${r.item.text}${r.verdict.findings.length ? ` — ${r.verdict.findings.map((f) => f.message).join(' · ')}` : ''}`);
md.push('');

fs.writeFileSync(path.join(ROOT, 'review', `lang-check-triage-${lang}.md`), md.join('\n'));
fs.writeFileSync(path.join(ROOT, 'review', `lang-check-triage-${lang}.json`), JSON.stringify({ generated: new Date().toISOString(), set: setName, checked: results.length, triage: triage.length, high: triage.filter((r) => r.verdict.action === 'triage-high').length, byCheck, items: triage.map((r) => ({ ...r.item, confidence: r.verdict.confidence, action: r.verdict.action, findings: r.verdict.findings, coverage: r.verdict.coverage, back: r.verdict.back })) }, null, 1));
console.log(`${lang}: ${results.length} lines, ${triage.length} to triage (${triage.filter((r) => r.verdict.action === 'triage-high').length} high), ${pass.length} pass — ${(ms / 1000).toFixed(1)} s`);
console.log(`  doubt types: ${JSON.stringify(byCheck)}`);
console.log(`  → review/lang-check-triage-${lang}.md`);
