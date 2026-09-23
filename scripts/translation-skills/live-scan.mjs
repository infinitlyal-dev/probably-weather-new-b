// Re-scan every live line in all four languages with the calibrated checkers (Part 2, step 10 — 2026-09-23).
//
// Live = what the app can put on screen or a share card today (the same enumeration as
// scripts/translation-check/build-pairs.mjs): the Afrikaans photograph lines (assets/hero-lines-af.js,
// English still wired) and the condition bank — witty, witty_low_confidence, headlines, heroLabels —
// in af, zu, xh and st. A pair is (lang, English, translation).
//
// Per pair:
//   bt        the Claude blind back-translation verdict (checker a), reused from the 2026-09-19 check
//             when the exact pair is unchanged, else "needs" (a fresh back-translation is due)
//   rules     rule-checks.mjs (spelling standard for Sesotho, numbers, lang-check, safety words,
//             reversed light advice)
//   safety    the English gives advice on a safety topic (safetyTopics)
//   lesotho   the Sesotho line still carries a Lesotho spelling
// Status (THRESHOLDS.json — fail on MISMATCH, not DRIFT):
//   fail      bt MISMATCH, or a high rule finding other than Sesotho spelling
//   respell   Sesotho whose only problem is spelling (fixed by st-respell.mjs, then re-checked)
//   safety    a safety line: must pass BOTH back-translations as MATCH, the rules, and SSA-COMET
//             (isiZulu) or it shows in English
//   ok        passes
//
//   node scripts/translation-skills/live-scan.mjs  -> output/translation-skills/live/scan.json
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ruleCheck, safetyTopics } from './rule-checks.mjs';
import { lesothoForms } from './st-respell.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const bust = `?v=${Date.now()}`;
const { HERO_LINES } = await import(`../../assets/hero-lines.js${bust}`);
const { HERO_LINES_AF } = await import(`../../assets/hero-lines-af.js${bust}`);
const { WEATHER_COPY } = await import(`../../assets/weather-copy.js${bust}`);

const EXTRA_SAFETY = new Map(JSON.parse(readFileSync(path.join(root, 'scripts', 'translation-skills', 'rules', 'safety-lines.json'), 'utf8')).lines.map((l) => [l.en, l.topic]));
const old = new Map();
for (const r of JSON.parse(readFileSync(path.join(root, 'review', 'translation-check-data.json'), 'utf8')).rows) {
  old.set(`${r.lang}|${r.en}|${r.text}`, { k: r.k, verdict: r.verdict, back: r.back, wrongSource: r.wrongSource || null });
}

const pairs = new Map();
const add = (lang, en, text, ref) => {
  if (typeof text !== 'string' || !text.trim() || typeof en !== 'string' || !en.trim()) return;
  const key = `${lang}|${en}|${text}`;
  if (!pairs.has(key)) pairs.set(key, { lang, en, text, refs: [] });
  pairs.get(key).refs.push(ref);
};
const wired = new Set(Object.entries(HERO_LINES).filter(([k]) => k.startsWith('bg/')).flatMap(([, v]) => v));
for (const en of wired) if (HERO_LINES_AF[en]) add('af', en, HERO_LINES_AF[en], { kind: 'photo' });
for (const ns of ['witty', 'witty_low_confidence', 'headlines', 'heroLabels']) {
  for (const [bin, v] of Object.entries(WEATHER_COPY[ns])) {
    if (bin === '_meta') continue;
    for (const lang of ['af', 'zu', 'xh', 'st']) {
      if (Array.isArray(v.en)) v.en.forEach((en, i) => add(lang, en, v[lang]?.[i], { kind: 'bank', ns, bin, i }));
      else add(lang, v.en, v[lang], { kind: 'bank', ns, bin });
    }
  }
}

const rows = [];
let n = 0;
for (const p of pairs.values()) {
  n += 1;
  const o = old.get(`${p.lang}|${p.en}|${p.text}`);
  const r = ruleCheck({ lang: p.lang, en: p.en, text: p.text });
  const high = r.findings.filter((f) => f.severity === 'high');
  const spellingOnly = high.length > 0 && high.every((f) => f.rule.startsWith('spelling:'));
  const safety = [...new Set([...safetyTopics(p.en), ...(EXTRA_SAFETY.has(p.en) ? [EXTRA_SAFETY.get(p.en)] : [])])];
  const lesotho = p.lang === 'st' ? lesothoForms(p.text, p.en) : [];
  const english = p.text.trim() === p.en.trim();
  let status = 'ok';
  const why = [];
  if (english) { status = 'english'; why.push('shows the English line (stopgap)'); }
  else {
    if (o?.verdict === 'MISMATCH') { status = 'fail'; why.push('Claude back-translation MISMATCH'); }
    // A word lang-check finds only in this app's own copy, or a diacritic inside a capitalised name
    // (Schrödinger), is a question for a native reader — the skills' own protocol, and the calibration
    // found no signal in these flags — not a reason to replace a reviewed line with an unreviewed one.
    const isQuestion = (f) => f.rule === 'lang-check:lexical' || (f.rule === 'lang-check:morphology' && /diacritic/i.test(f.message) && !/(^|[\s(])[a-zà-ÿ]*[à-ÿ]/u.test(p.text.replace(/\b\p{Lu}\S*/gu, '')));
    const other = high.filter((f) => !f.rule.startsWith('spelling:'));
    if (other.length && other.every(isQuestion) && status !== 'fail') { status = 'question'; why.push(...other.map((f) => `${f.rule}: ${f.message}`)); }
    else if (other.length) { status = 'fail'; why.push(...other.map((f) => `${f.rule}: ${f.message}`)); }
    if (status === 'ok' && lesotho.length) { status = 'respell'; why.push(`Lesotho spelling: ${[...new Set(lesotho)].join(', ')}`); }
    if (safety.length && status !== 'fail') { status = status === 'respell' ? 'safety+respell' : 'safety'; }
  }
  rows.push({ id: `${p.lang}-L${String(n).padStart(4, '0')}`, lang: p.lang, en: p.en, text: p.text, refs: p.refs, oldK: o?.k || null, bt: o ? o.verdict : 'needs', back: o?.back || null, wrongSource: o?.wrongSource || null, rules: { pass: r.pass, high: high.map((f) => f.rule) }, safety, lesotho: [...new Set(lesotho)], status, why });
}
const liveEn = new Set(rows.map((r) => r.en));
for (const en of EXTRA_SAFETY.keys()) if (!liveEn.has(en)) console.warn(`[scan] safety-lines.json names a line that is not live: "${en}"`);
const out = path.join(root, 'output', 'translation-skills', 'live');
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'scan.json'), JSON.stringify(rows, null, 1));
const tally = {};
for (const r of rows) { const t = (tally[r.lang] ||= { lines: 0 }); t.lines += 1; t[r.status] = (t[r.status] || 0) + 1; if (r.bt === 'needs') t.needsBT = (t.needsBT || 0) + 1; if (r.safety.length) t.safetyLines = (t.safetyLines || 0) + 1; }
for (const [l, t] of Object.entries(tally)) console.log(`[scan] ${l}: ${JSON.stringify(t)}`);
