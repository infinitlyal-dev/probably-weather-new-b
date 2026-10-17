// Evidence for the Sesotho LOPSIDED SOTHO-TSWANA ATTESTATION rule (lib/checker-v2.mjs (d), 14 Oct 2026), written to
// review/sesotho-exam-fix-2026-10-14.json so it can be re-checked rather than taken on trust (Sol's review, 14 Oct).
//
//   node scripts/lang-check/st-lopsided-evidence.mjs [--independent <st-independent.json>]
//
// Runs the PRODUCTION checker (checkV2, no back-translation, so only the checker's own judgement counts) over:
//   1. every live Sesotho bank string (assets/weather-copy.js) and every good Sesotho gold item — false alarms: lines
//      whose verdict changes because of the rule, and every lopsided finding;
//   2. the Sesotho wrong-language gold items;
//   3. an independent set written by another model that was not told the rule (contaminated + clean lines), when given.
// "before" here is checker-v2 WITHOUT rule (d) (its findings removed, confidence recomputed the way checkV2 does) —
// not the 6 Sept checker the exam calls BEFORE.
import fs from 'node:fs';
import path from 'node:path';
import { checkV2 } from './lib/checker-v2.mjs';
import { WEATHER_COPY } from '../../assets/weather-copy.js';

const ROOT = path.resolve(import.meta.dirname, '../..');
const args = process.argv.slice(2);
const indFile = args.includes('--independent') ? args[args.indexOf('--independent') + 1] : null;
const WEIGHT = { high: 0.5, medium: 0.25, low: 0.05 };
const THRESH = 0.25;

// checkV2's confidence, recomputed without the rule's findings (a finding the rule only RAISED goes back to low)
function without(v) {
  const fs2 = v.findings.map((f) => (!f.evidence?.lopsided ? f : f.evidence.raisedFrom ? { ...f, severity: 'low' } : null)).filter(Boolean);
  let conf = fs2.reduce((s, f) => s + (WEIGHT[f.severity] || 0), 0);
  if (v.coverage && v.coverage.contentTokens >= 3 && v.coverage.unknown / v.coverage.contentTokens >= 0.5 && !fs2.some((f) => f.cleared)) conf += 0.15;
  conf = Math.min(1, Math.round(conf * 100) / 100);
  if (!fs2.some((f) => f.severity === 'high' || f.severity === 'medium')) conf = Math.min(conf, 0.2);
  return conf;
}
function score(items) {
  return items.map((it) => {
    const v = checkV2({ lang: 'st', text: it.text, en: it.en || '' }, { bt: false });
    const lop = v.findings.filter((f) => f.evidence?.lopsided).map((f) => f.token);
    return { ...it, after: v.confidence >= THRESH, before: without(v) >= THRESH, confAfter: v.confidence, lopsided: lop };
  });
}
const tally = (rows) => ({ n: rows.length, before: rows.filter((r) => r.before).length, after: rows.filter((r) => r.after).length, ruleFired: rows.filter((r) => r.lopsided.length).length });

const bank = new Set();
const walk = (o) => { if (!o || typeof o !== 'object') return; if (typeof o.st === 'string') bank.add(o.st); if (Array.isArray(o.st)) o.st.forEach((s) => typeof s === 'string' && bank.add(s)); for (const v of Object.values(o)) if (v && typeof v === 'object') walk(v); };
walk(WEATHER_COPY);
const gold = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'gold-set.json'), 'utf8')).items.filter((x) => x.lang === 'st' && !x.weak);
const out = { generated: new Date().toISOString(), before: "checker-v2 without rule (d), not the 6 Sept checker", rule: 'lib/checker-v2.mjs (d): Sesotho freq <= 3, Setswana/Sepedi freq >= 100 and >= 50x', threshold: THRESH };
const bankRows = score([...bank].map((text) => ({ text })));
out.liveBank = { ...tally(bankRows), fired: bankRows.filter((r) => r.lopsided.length).map((r) => ({ text: r.text, words: r.lopsided })) };
const good = score(gold.filter((x) => x.label === 'good').map((x) => ({ id: x.id, text: x.text, en: x.en })));
out.goldGood = { ...tally(good), fired: good.filter((r) => r.lopsided.length).map((r) => ({ id: r.id, text: r.text, words: r.lopsided })) };
const wl = score(gold.filter((x) => x.label === 'bad' && x.cls === 'wrong-language').map((x) => ({ id: x.id, text: x.text, en: x.en })));
out.goldWrongLanguage = { ...tally(wl), rows: wl.map((r) => ({ id: r.id, text: r.text, before: r.before, after: r.after, words: r.lopsided })) };
if (indFile) {
  const ind = JSON.parse(fs.readFileSync(indFile, 'utf8'));
  const goldText = new Set(gold.map((x) => x.text.trim().toLowerCase()));
  const c = score(ind.contaminated.filter((x) => !goldText.has(x.text.trim().toLowerCase())));
  const k = score(ind.clean.filter((x) => !goldText.has(x.text.trim().toLowerCase())));
  out.independent = {
    source: path.basename(indFile), note: 'written by a Sonnet 5.5 subagent told only to write Sesotho lines with one Setswana/Sepedi slip each (and clean lines), and which words the OLD checker already lists; it was not told the rule',
    contaminated: { ...tally(c), intruders: [...new Set(c.map((r) => r.intruder))].length, rows: c.map((r) => ({ text: r.text, intruder: r.intruder, from: r.from, before: r.before, after: r.after, words: r.lopsided })) },
    clean: { ...tally(k), fired: k.filter((r) => r.lopsided.length || r.after).map((r) => ({ text: r.text, after: r.after, words: r.lopsided })) },
  };
}
fs.writeFileSync(path.join(ROOT, 'review', 'sesotho-exam-fix-2026-10-14.json'), JSON.stringify(out, null, 1));
const s = (t) => `${t.before}/${t.n} without (d) → ${t.after}/${t.n} with (d) (rule fired on ${t.ruleFired})`;
console.log(`live bank: ${s(out.liveBank)}\ngold good: ${s(out.goldGood)}\ngold wrong-language: ${s(out.goldWrongLanguage)}`);
if (out.independent) console.log(`independent contaminated: ${s(out.independent.contaminated)} (${out.independent.contaminated.intruders} intruders)\nindependent clean: ${s(out.independent.clean)}`);
