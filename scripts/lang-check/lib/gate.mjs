// The wiring gate (Al's ruling 2026-09-06): every isiZulu / isiXhosa / Sesotho line goes through
// the corpus-backed checker before it is wired. A line rated triage-high is HELD for a native;
// a line rated triage is passed through but listed so the native batch sees the doubt.
//
// 9 Oct 2026: a language that PASSED the October exam (scripts/lang-check/exam-result-2026-10.json) is gated by the
// rebuilt checker (checker-v2.mjs: concord, attestation in context, the back-translation record); the others keep the
// 6 Sept checker, unchanged.
//
// Used by scripts/apply-provisional-drafts.mjs; any other wiring path should call gateLines().

import fs from 'node:fs';
import path from 'node:path';
import { check } from './checker.mjs';
import { checkV2 } from './checker-v2.mjs';

let passedExam = null;
export function rebuiltPassed(lang) {
  if (!passedExam) {
    const f = path.join(import.meta.dirname, '..', 'exam-result-2026-10.json');
    passedExam = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).pass || {} : {};
  }
  return !!passedExam[lang]?.pass;
}

// lines: [{ key, en, text }] → { held: [...], noted: [...], passed: [...] } each with { confidence, doubts }
export function gateLines(lang, lines) {
  const held = [], noted = [], passed = [];
  const v2 = rebuiltPassed(lang);
  for (const line of lines) {
    const v = (v2 ? checkV2 : check)({ lang, en: line.en || '', text: line.text, key: line.key });
    const doubts = v.findings.filter((f) => f.severity !== 'low').map((f) => `${f.severity} ${f.check}: ${f.message}`);
    const out = { ...line, confidence: v.confidence, action: v.action, doubts, checker: v2 ? 'v2' : 'v1' };
    if (v.action === 'triage-high') held.push(out);
    else if (v.action === 'triage') noted.push(out);
    else passed.push(out);
  }
  return { held, noted, passed };
}

export function writeGateReport(lang, result, file) {
  const md = [`# lang-check gate — ${lang} — ${new Date().toISOString().slice(0, 10)}`, '', `${result.held.length + result.noted.length + result.passed.length} lines checked (${rebuiltPassed(lang) ? 'the rebuilt checker of October 2026' : 'the corpus checker of 6 Sept'}): ${result.held.length} HELD (triage-high, not wired), ${result.noted.length} wired with a doubt for the native batch, ${result.passed.length} clean.`, ''];
  for (const [title, list] of [['Held', result.held], ['Wired with a doubt', result.noted]]) {
    md.push(`## ${title} (${list.length})`, '');
    for (const p of list) md.push(`- \`${p.key || ''}\` (${p.confidence.toFixed(2)}) EN: ${p.en || ''}`, `  - ${lang}: ${p.text}`, ...p.doubts.map((d) => `  - ${d}`));
    md.push('');
  }
  fs.writeFileSync(file, md.join('\n'));
}
