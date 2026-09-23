// Checker (d): rule checks on one translated line (Part 2, step 5 — 2026-09-23).
//
//   ruleCheck({ lang, en, text }) -> { pass, findings: [{ rule, severity, message }] }
//
// 1. SPELLING STANDARD (Sesotho, HARD): the South African orthography rules the corpora back
//    (rules/st-orthography.json, from NCHLT GOV-ZA + the Constitution + .za web) plus the forms
//    Al ruled by name on 2026-09-06 (jwale, dipula, tjhesa, mohodi). A Lesotho form fails.
// 2. NUMBERS AND UNITS (all languages): a figure in the English (7, 30, 4, 50, 24) must survive —
//    as the same digits, the same figure on a 24-hour clock, or the number written out in the
//    target language; a unit (°, %, km/h, mm, SPF, UV) must survive with it.
// 3. LANG-CHECK (all languages): the corpus checker's own verdict — a triage-high finding fails.
// 4. SAFETY WORDS (all languages): when the English gives advice (headlights, sunscreen, stay
//    inside, flooding, gusts, lightning), the line must carry a word for that thing from the
//    word list (wordlists/<lang>.json) — a safety line that loses its object cannot pass.
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { check as langCheck } from '../lang-check/lib/checker.mjs';
import { reversedLightAdvice } from './safety-reversal.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const ST = JSON.parse(readFileSync(path.join(here, 'rules', 'st-orthography.json'), 'utf8'));
const ST_RULES = ST.rules.map((r) => ({ id: r.id, re: new RegExp(r.lesotho), what: r.what }));
// Named by Al (CLAUDE.md, 2026-09-06): SA jwale, dipula, tjhesa, mohodi — not joale, lipula, chesa, moholi.
const ST_RULED = [{ id: 'moholi→mohodi (ruled)', re: /^moholi$/, what: '"moholi" (mist) is written "mohodi" — Al\'s ruling, and the l→d pattern of lehodimo' }];
const wordlist = (lang) => {
  const f = path.join(here, 'wordlists', `${lang}.json`);
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
};
const tokens = (s) => String(s).toLowerCase().replace(/’/g, "'").match(/[\p{L}'-]+/gu) || [];

// Numbers written out, 1–60, per language (the ones the app's lines use).
const NUMBER_WORDS = {
  af: { 1: ['een'], 2: ['twee'], 3: ['drie'], 4: ['vier'], 5: ['vyf'], 6: ['ses'], 7: ['sewe'], 8: ['agt'], 9: ['nege'], 10: ['tien'], 12: ['twaalf'], 15: ['vyftien'], 20: ['twintig'], 24: ['vier-en-twintig', 'vierentwintig'], 30: ['dertig'], 50: ['vyftig'], 100: ['honderd'], 300: ['driehonderd'] },
  zu: {}, xh: {}, st: {},
};
function numbersOf(s) { return (String(s).match(/\d+(?:[.,:]\d+)?/g) || []).map((n) => n.replace(',', '.')); }
function figureSurvives(lang, n, text, en) {
  const t = String(text);
  if (numbersOf(t).includes(n)) return true;
  // 7pm -> 19:00 / 19h00
  const pm = new RegExp(`\\b${n}\\s*pm\\b`, 'i');
  if (pm.test(en) && Number(n) < 12 && new RegExp(`\\b${Number(n) + 12}[:h]?`).test(t)) return true;
  const words = NUMBER_WORDS[lang]?.[Number(n)];
  if (words && words.some((w) => t.toLowerCase().includes(w))) return true;
  return false;
}
const ADVICE = /\b(turn|switch|use|wear|put on|apply|slap on|stay|don'?t|do not|avoid|keep|bring|cover|hold on|tie|secure|drink|slow|watch out|careful|wouldn'?t hurt|take|unplug|go inside|get inside|get indoors|pack|grab|reapply|protect|not optional|non-negotiable|must|need to|you'?ll want)\b/i;
const UNITS = [[/°c?|\bdegrees?\b/i, /°|grade|degrees?|degree|amadigri|iidigri|di-degree|digri|dikgerata|ama-degree/i, 'degrees'], [/%|\bper ?cent\b/i, /%|persent|iphesenti|ipesenti|phesente/i, 'percent'], [/km\/h/i, /km\/h|km\/u/i, 'km/h'], [/\bmm\b/i, /\bmm\b|millimeter|amamilimitha|iimilimitha|dimilimitara/i, 'mm'], [/\bspf\b/i, /\bspf\b/i, 'SPF'], [/\buv\b/i, /\buv\b/i, 'UV']];

export function ruleCheck({ lang, en, text }) {
  const findings = [];
  // 1. Sesotho orthography
  if (lang === 'st') {
    for (const tok of tokens(text)) {
      for (const r of [...ST_RULES, ...ST_RULED]) if (r.re.test(tok)) findings.push({ rule: `spelling:${r.id}`, severity: 'high', message: `"${tok}" is the Lesotho orthography — ${r.what}` });
    }
  }
  // 2. numbers and units
  for (const n of numbersOf(en)) {
    if (!figureSurvives(lang, n, text, en)) findings.push({ rule: 'number', severity: 'high', message: `the English figure ${n} is not in the translation` });
  }
  for (const [enRe, tRe, name] of UNITS) {
    if (enRe.test(en) && !tRe.test(text) && numbersOf(en).length) findings.push({ rule: 'unit', severity: 'medium', message: `the English unit (${name}) is not in the translation` });
  }
  // 3. lang-check
  let lc = null;
  try { lc = langCheck({ lang, en, text }); } catch (e) { lc = { action: 'error', findings: [{ severity: 'low', message: e.message }] }; }
  if (lc?.action === 'triage-high') for (const f of lc.findings.filter((x) => x.severity === 'high')) findings.push({ rule: `lang-check:${f.check}`, severity: 'high', message: f.message });
  else if (lc?.action === 'triage') for (const f of lc.findings.filter((x) => x.severity === 'medium')) findings.push({ rule: `lang-check:${f.check}`, severity: 'medium', message: f.message });
  // 4a. reversed light advice (safety-reversal.mjs)
  const off = reversedLightAdvice(lang, en, text);
  if (off) findings.push({ rule: 'safety:reversal', severity: 'high', message: `the English tells drivers to use their lights; "${off}" switches them off or removes them` });
  // 4b. safety words — only when the English actually gives advice (an instruction or a
  // recommendation), not whenever it mentions the wind.
  const wl = wordlist(lang);
  if (wl?.safety && ADVICE.test(en)) {
    for (const s of wl.safety) {
      if (!new RegExp(s.en, 'i').test(en)) continue;
      const ok = s.terms.some((t) => String(text).toLowerCase().includes(t.toLowerCase()));
      if (!ok) findings.push({ rule: `safety:${s.id}`, severity: 'high', message: `the English is advice about ${s.id}; none of ${s.terms.slice(0, 4).join(' / ')} is in the translation` });
    }
  }
  return { pass: !findings.some((f) => f.severity === 'high'), findings, langCheck: lc ? { action: lc.action, confidence: lc.confidence } : null };
}

// CLI: node rule-checks.mjs --lang st --en "..." --text "..."
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const a = process.argv.slice(2); const v = (f) => { const i = a.indexOf(f); return i >= 0 ? a[i + 1] : undefined; };
  console.log(JSON.stringify(ruleCheck({ lang: v('--lang'), en: v('--en'), text: v('--text') }), null, 1));
}
