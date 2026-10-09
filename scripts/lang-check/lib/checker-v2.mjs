// The rebuilt checker (9 Oct 2026): the corpus-backed checker of 6 Sept (checker.mjs, unchanged) plus three passes it lacked.
//
//   (a) concord   — lib/concord.mjs: a clause-initial noun and the first subject/possessive concord after it must share a
//                   class (Nguni and Sesotho). Medium: rule-based, measured at 0–1 false alarms per ~510 native lines.
//   (b) back-translation — a SECOND MODEL (Sonnet 5.5, run as a subagent) translates the line back to English blind, then
//                   compares it with the English source; its record sits in data/bt-cache.jsonl (scripts/lang-check/bt.mjs
//                   merges a run in). drift → medium; wrong-language / untranslated / garbled → high; same / loose → a note.
//                   Only a verdict given with confidence ≥ 0.6 counts. No record → the pass is reported as not run.
//   (c) attestation in context — lib/ngram-attest.mjs: a word flagged as unknown, or as a sense that misses the English, or
//                   as stray English, is cleared to a note when the corpus attests it in this very pairing (a pair or a
//                   triple with its neighbours ≥ 3 times). Near-miss and time-of-day findings, banned words, diacritics and
//                   untranslated core English are never cleared: those are where the real errors live.
//
// The protected lexicon (lang-packs/<l>/lexicon-protected.md) is native ruling: a finding on a protected word becomes a note.
// Confidence is the same sum of weights as checker.mjs (high 0.5, medium 0.25, low 0.05; notes alone cap at 0.2).

import fs from 'node:fs';
import path from 'node:path';
import { check, LangIndex } from './checker.mjs';
import { concordFindings } from './concord.mjs';
import { contextOf } from './ngram-attest.mjs';
import { ROOT } from './build-index.mjs';

export const BT_CACHE = path.join(ROOT, 'scripts', 'lang-check', 'data', 'bt-cache.jsonl');
let btIndex = null;
export function btRecord(lang, text) {
  if (!btIndex) {
    btIndex = new Map();
    if (fs.existsSync(BT_CACHE)) for (const l of fs.readFileSync(BT_CACHE, 'utf8').split('\n')) {
      if (!l.trim()) continue;
      const r = JSON.parse(l); btIndex.set(`${r.lang}\u0000${r.text}`, r);
    }
  }
  return btIndex.get(`${lang}\u0000${text}`) || null;
}
export function resetBtCache() { btIndex = null; }

const protectedCache = new Map();
export function protectedWords(lang) {
  if (protectedCache.has(lang)) return protectedCache.get(lang);
  const f = path.join(ROOT, 'lang-packs', lang, 'lexicon-protected.md');
  const out = new Set();
  if (fs.existsSync(f)) {
    const md = fs.readFileSync(f, 'utf8');
    for (const row of md.split('\n').filter((l) => /^\|/.test(l) && !/^\|\s*-/.test(l))) {
      const cells = row.split('|').map((c) => c.trim());
      // | concept | protected word(s) | do-not-use | — the second cell, minus notes in brackets
      for (const w of (cells[2] || '').replace(/\(.*?\)/g, ' ').split(/[\/,;]| or /)) {
        const t = w.trim().toLowerCase();
        if (t && /^[\p{L}'’ -]+$/u.test(t) && !/needs native/.test(t)) t.split(/\s+/).forEach((x) => x.length >= 3 && out.add(x));
      }
    }
    for (const m of md.matchAll(/\*\*([\p{L}'-]{3,})\*\*/gu)) if (/keep|protected|confirmed|ruled/i.test(md.slice(m.index, m.index + 400))) out.add(m[1].toLowerCase());
  }
  protectedCache.set(lang, out);
  return out;
}

const WEIGHT = { high: 0.5, medium: 0.25, low: 0.05 };
const CONTEXT_MIN = 3;

export function checkV2(item, { bt = 'cache' } = {}) {
  const v = check(item);
  const { lang, text = '' } = item;
  const findings = v.findings.map((f) => ({ ...f }));
  const notes = [];
  const prot = protectedWords(lang);

  // Afrikaans double negation closes per CLAUSE: "Niemand het daaraan geraak nie en elkeen weet hoekom" is two clauses,
  // the first closed. The 6 Sept check split only at punctuation.
  if (lang === 'af') {
    for (const f of findings) {
      if (f.check !== 'morphology' || !/without the closing 'nie'/.test(f.message) || f.severity === 'low') continue;
      const clauses = text.split(/(?<=[.!?…])\s+|\s*[,;:—–()"“”‘’']\s*|\s+(?:en|maar|want|of|terwyl|toe)\s+/i);
      const open = clauses.filter((c) => /\b(nie|geen|g'n|nooit|niemand|niks|nêrens|moenie)\b/i.test(c)).filter((c) => {
        const w = c.trim().replace(/[.!?…"'”’]+$/, '').split(/\s+/).filter(Boolean);
        if (w.length < 3) return false;
        return !/^(nie|niks|niemand|nooit|nêrens|geen|g'n)$/i.test(w[w.length - 1]);
      });
      if (!open.length) { f.severity = 'low'; f.cleared = 'every clause with a negator closes it'; }
    }
  }

  // (c) attestation in context, and the protected lexicon
  for (const f of findings) {
    if (f.severity === 'low' || !f.token) continue;
    const tokLow = String(f.token).toLowerCase();
    if (prot.has(tokLow)) { f.severity = 'low'; f.cleared = 'protected lexicon'; continue; }
    if (lang === 'af' && f.check === 'lexical' && !f.evidence?.pack) {
      // a separable verb's participle (by-ge-vul, op-ge-hang, aan-ge-skakel) is its particle + the stem
      const m = /^(aan|af|by|in|op|oor|om|toe|uit|weg|terug|vas|los|saam|deur|mee|na|neer|rond|teë|voor)ge(.{3,})$/.exec(tokLow);
      const idxAf = LangIndex.load('af');
      if (m && (idxAf.has(m[1] + m[2]) || idxAf.has(m[2]) || idxAf.has(m[2].replace(/d$/, '')))) { f.severity = 'low'; f.cleared = `separable verb: ${m[1]} + ge + ${m[2]}`; continue; }
      // a place adjective (Joburgse, Kaapse) or a name the app's Afrikaans list carries
      if (/^(joburg|kaap|durban|pretoria|bloem|karoo|hoëveld|vrystaat|boland|natal)(se|ers?)?$/i.test(tokLow)) { f.severity = 'low'; f.cleared = 'place name or its adjective'; continue; }
    }
    const ev = f.evidence || {};
    const clearable = (f.check === 'lexical' && !ev.pack)
      || (f.check === 'semantic' && !ev.pack && !ev.nearMiss && !ev.timeClash)
      || (f.check === 'contamination' && ev.english && !ev.core);
    if (!clearable || /\s/.test(f.token)) continue;
    const c = contextOf(text, lang, f.token);
    if (!c) continue;
    if (f.check === 'lexical' && c.word >= 5) { f.severity = 'low'; f.cleared = `attested ${c.word}× in the n-gram corpora (incl. current web text)`; continue; }
    if (c.best >= CONTEXT_MIN) {
      const where = c.triple && c.triple[1] * 3 >= c.best ? `'${c.triple[0]}' ${c.triple[1]}×` : c.pairs.filter(([, n]) => n).map(([p, n]) => `'${p}' ${n}×`).join(', ');
      f.severity = 'low'; f.cleared = `attested in context: ${where}`;
    }
  }

  // (a) concord
  if (['zu', 'xh', 'st'].includes(lang)) {
    const idx = LangIndex.load(lang);
    for (const c of concordFindings(text, lang, { lexicon: idx.nounClass, protect: prot })) {
      findings.push({ check: 'concord', severity: 'medium', token: c.at, message: c.message, evidence: { concord: c } });
    }
  }

  // (b) back-translation through a second model
  let back = null;
  if (bt) {
    const r = bt === 'cache' ? btRecord(lang, text) : bt;
    if (r) {
      back = { bt: r.bt, verdict: r.verdict, confidence: r.confidence, note: r.note, langSeen: r.langSeen, model: r.model || 'claude-sonnet-5-5' };
      const strong = (r.confidence ?? 0) >= 0.6;
      if (strong && r.verdict === 'drift') findings.push({ check: 'back-translation', severity: 'medium', token: '', message: `back-translation drifts from the English: "${r.bt}"${r.note ? ` — ${r.note}` : ''}`, evidence: back });
      else if (strong && ['wrong-language', 'untranslated', 'garbled'].includes(r.verdict)) findings.push({ check: 'back-translation', severity: 'high', token: '', message: `back-translation says ${r.verdict}${r.langSeen && r.langSeen !== lang ? ` (reads as ${r.langSeen})` : ''}: "${r.bt}"${r.note ? ` — ${r.note}` : ''}`, evidence: back });
      else notes.push(`back-translation ${r.verdict}: "${r.bt}"`);
    } else notes.push('back-translation not run for this line');
  }

  let conf = 0;
  for (const f of findings) conf += WEIGHT[f.severity] || 0;
  if (v.coverage && v.coverage.contentTokens >= 3 && v.coverage.unknown / v.coverage.contentTokens >= 0.5 && !findings.some((f) => f.cleared)) conf += 0.15;
  conf = Math.min(1, Math.round(conf * 100) / 100);
  if (!findings.some((f) => f.severity === 'high' || f.severity === 'medium')) conf = Math.min(conf, 0.2);
  const action = conf >= 0.5 ? 'triage-high' : conf >= 0.25 ? 'triage' : 'pass';
  const order = { high: 0, medium: 1, low: 2 };
  findings.sort((a, b) => order[a.severity] - order[b.severity]);
  return { ...v, findings, confidence: conf, action, ok: action === 'pass', back, notes, checker: 'v2-2026-10-09' };
}
