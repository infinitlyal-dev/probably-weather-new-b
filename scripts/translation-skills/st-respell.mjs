// Re-spell a Sesotho line from the Lesotho to the South African orthography (Part 2 — 2026-09-23).
//
// Al ruled SA orthography on 2026-09-06. The rules are exactly the ones the corpora back
// (rules/st-orthography.json — kept only where NCHLT GOV-ZA and the Constitution are unambiguous and
// the .za web agrees) plus the form Al ruled by name (moholi → mohodi). Nothing broader: "-oe- → -we-"
// was dropped by the corpora because "oe" also sits inside SA words (boemo), so it is not applied here.
//
// Guards, because a spelling rule applied blind breaks words that are not Sesotho:
//   - a token that also appears in the line's English source is left alone (loanwords: "lift", "li…")
//   - a capitalised token that is not sentence-initial is left alone (names: Limpopo)
// Every change is returned so the caller can list it; meaning is re-checked by back-translation after.
//
//   import { respell } from './st-respell.mjs'
//   respell("Re u utloela bohloko, uena.", "…")  -> { text: "Re o utloela bohloko, wena.", changes: [...] }
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ST = JSON.parse(readFileSync(path.join(here, 'rules', 'st-orthography.json'), 'utf8'));

// Each rule rewrites a lower-cased token; case is restored afterwards.
const REWRITE = {
  'ea→ya': (t) => (t === 'ea' ? 'ya' : null),
  'oa→wa': (t) => (t === 'oa' ? 'wa' : null),
  'tš→tsh': (t) => (t.includes('tš') ? t.replace(/tš/g, 'tsh') : null),
  'li-→di-': (t) => (/^li[bcdfghjklmnpqrstvwxyz]/.test(t) ? `di${t.slice(2)}` : null),
  "'n→n": (t) => (/^'n/.test(t) ? `n${t.slice(1)}` : null),
  'joale→jwale': (t) => (/^joal[eo]$/.test(t) ? t.replace(/^joal/, 'jwal') : null),
  'moea→moya': (t) => (t === 'moea' ? 'moya' : null),
  'holimo→hodimo': (t) => (t.includes('holimo') ? t.replace(/holimo/g, 'hodimo') : null),
  'tsoa→tswa': (t) => (/^tsoa/.test(t) ? t.replace(/^tsoa/, 'tswa') : null),
  'ngoe→ngwe': (t) => (/^n?ngoe$/.test(t) ? t.replace(/ngoe$/, 'ngwe') : null),
  'chesa→tjhesa': (t) => (/^(chesa|chese|chesang)$/.test(t) ? `tj${t.slice(1)}` : null),
  'uena→wena': (t) => (t === 'uena' ? 'wena' : null),
  'u→o (you)': (t) => (t === 'u' ? 'o' : null),
  'li→di (concord)': (t) => (t === 'li' ? 'di' : null),
  'eona→yona': (t) => (t === 'eona' ? 'yona' : null),
  'eena→yena': (t) => (t === 'eena' ? 'yena' : null),
  'moholi→mohodi (ruled)': (t) => (t === 'moholi' ? 'mohodi' : null),
};
const ORDER = [...ST.rules.map((r) => r.id), 'moholi→mohodi (ruled)'];
for (const id of ORDER) if (!REWRITE[id]) throw new Error(`st-respell: no rewrite for rule ${id} — rules/st-orthography.json changed; add it here`);

const restoreCase = (orig, low) => {
  const letters = orig.replace(/[^\p{L}]/gu, '');
  if (letters.length > 1 && letters === letters.toUpperCase()) return low.toUpperCase();
  const first = letters[0];
  if (first && first !== first.toLowerCase()) { const i = low.search(/\p{L}/u); return low.slice(0, i) + low[i].toUpperCase() + low.slice(i + 1); }
  return low;
};

export function respell(text, en = '') {
  const enWords = new Set(String(en).toLowerCase().replace(/’/g, "'").match(/[\p{L}'-]+/gu) || []);
  const changes = [];
  let sentenceStart = true;
  const out = String(text).replace(/[\p{L}'’-]+|[^\p{L}'’-]+/gu, (tok) => {
    if (!/\p{L}/u.test(tok)) { if (/[.!?:]/.test(tok)) sentenceStart = true; return tok; }
    const wasStart = sentenceStart; sentenceStart = false;
    const norm = tok.replace(/’/g, "'");
    const low = norm.toLowerCase();
    if (enWords.has(low)) return tok;
    if (!wasStart && norm[0] !== norm[0].toLowerCase()) return tok;
    // hyphenated forms: re-spell each part on its own (e.g. "li-cushion" stays, "tšoeu-" parts)
    const parts = low.split('-');
    let changed = false;
    const fixed = parts.map((p) => {
      let cur = p;
      for (const id of ORDER) {
        const r = REWRITE[id](cur);
        if (r !== null && r !== cur) { changes.push({ rule: id, from: cur, to: r }); cur = r; changed = true; }
      }
      return cur;
    }).join('-');
    return changed ? restoreCase(norm, fixed) : tok;
  });
  return { text: out, changes };
}

// The checker's view: does a token still carry a Lesotho form? (same rules as rule-checks.mjs)
// Same guards as respell(): a word the English line also uses, or a capitalised word inside a
// sentence (a name), is not Sesotho spelling and is not flagged.
const ST_RULES = ST.rules.map((r) => new RegExp(r.lesotho));
export function lesothoForms(text, en = '') {
  const enWords = new Set(String(en).toLowerCase().replace(/’/g, "'").match(/[\p{L}'-]+/gu) || []);
  const found = [];
  let sentenceStart = true;
  for (const tok of String(text).replace(/’/g, "'").match(/[\p{L}'-]+|[.!?:]/gu) || []) {
    if (/^[.!?:]$/.test(tok)) { sentenceStart = true; continue; }
    const wasStart = sentenceStart; sentenceStart = false;
    const low = tok.toLowerCase();
    if (enWords.has(low) || (!wasStart && tok.replace(/^'/, '')[0] !== tok.replace(/^'/, '')[0].toLowerCase())) continue;
    for (const part of low.split('-')) if (ST_RULES.some((re) => re.test(part)) || part === 'moholi') { found.push(part); break; }
  }
  return found;
}
