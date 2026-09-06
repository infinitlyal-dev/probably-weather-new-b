// The wiring gate (Al's ruling 2026-09-06): every isiZulu / isiXhosa / Sesotho line goes through
// the corpus-backed checker before it is wired. A line rated triage-high is HELD for a native;
// a line rated triage is passed through but listed so the native batch sees the doubt.
//
// Used by scripts/apply-provisional-drafts.mjs; any other wiring path should call gateLines().

import fs from 'node:fs';
import { check } from './checker.mjs';

// lines: [{ key, en, text }] → { held: [...], noted: [...], passed: [...] } each with { confidence, doubts }
export function gateLines(lang, lines) {
  const held = [], noted = [], passed = [];
  for (const line of lines) {
    const v = check({ lang, en: line.en || '', text: line.text, key: line.key });
    const doubts = v.findings.filter((f) => f.severity !== 'low').map((f) => `${f.severity} ${f.check}: ${f.message}`);
    const out = { ...line, confidence: v.confidence, action: v.action, doubts };
    if (v.action === 'triage-high') held.push(out);
    else if (v.action === 'triage') noted.push(out);
    else passed.push(out);
  }
  return { held, noted, passed };
}

export function writeGateReport(lang, result, file) {
  const md = [`# lang-check gate — ${lang} — ${new Date().toISOString().slice(0, 10)}`, '', `${result.held.length + result.noted.length + result.passed.length} lines checked: ${result.held.length} HELD (triage-high, not wired), ${result.noted.length} wired with a doubt for the native batch, ${result.passed.length} clean.`, ''];
  for (const [title, list] of [['Held', result.held], ['Wired with a doubt', result.noted]]) {
    md.push(`## ${title} (${list.length})`, '');
    for (const p of list) md.push(`- \`${p.key || ''}\` (${p.confidence.toFixed(2)}) EN: ${p.en || ''}`, `  - ${lang}: ${p.text}`, ...p.doubts.map((d) => `  - ${d}`));
    md.push('');
  }
  fs.writeFileSync(file, md.join('\n'));
}
