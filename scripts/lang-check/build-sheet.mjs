// Builds one accept/reject sheet per language from the lang-check triage: a correction is
// proposed ONLY where the corpus evidence is strong (Al's ruling 2026-09-06). Everything else
// stays in the triage list for a native reader.
//
//   node scripts/lang-check/build-sheet.mjs --lang zu|xh|st
//   → review/lang-check-sheet-<lang>.html   (accept / reject / later per row, export decisions)
//   → review/lang-check-proposals-<lang>.json
//
// Strong evidence, in order of certainty:
//   1. a token the language pack bans outright, with the pack's fix
//   2. a token the pack marks as a known wrong-word AND the protected lexicon names the right one
//   3. an unattested token one edit from an attested one seen ≥ 5 times (a typo), or two edits
//      from one seen ≥ 50 times on a word of 8+ letters
//   4. a diacritic in a Nguni line (stripped)
//   5. an unattested token that is two attested words fused (split)
//   6. a word attested only in Setswana / Sepedi / a Nguni language whose dictionary gloss matches
//      an English source word that has a Sesotho dictionary word attested ≥ 10 times
//   7. Sesotho only: a Lesotho-orthography spelling whose South African form is attested at least
//      three times and at least as often as the Lesotho form (Wiktionary SA/Lesotho pairs + rules)
//
// For st, rule 7 runs over the WHOLE st bank (weather-copy.js + the T object in app.js), not only
// the provisional fills — that is the "re-check the st bank" ruling.

import fs from 'node:fs';
import path from 'node:path';
import { WEATHER_COPY } from '../../assets/weather-copy.js';
import { LangIndex } from './lib/checker.mjs';
import { tokenize, normalizeWord, enContentWords, enStem, stripMarks } from './lib/text.mjs';
import { CACHE } from './lib/build-index.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const args = process.argv.slice(2);
const lang = args[args.indexOf('--lang') + 1];
if (!/^(zu|xh|st)$/.test(lang || '')) { console.error('usage: --lang zu|xh|st'); process.exit(2); }
const LANG_NAME = { zu: 'isiZulu', xh: 'isiXhosa', st: 'Sesotho' };
const idx = LangIndex.load(lang);
const triage = JSON.parse(fs.readFileSync(path.join(ROOT, 'review', `lang-check-triage-${lang}.json`), 'utf8'));

// protected-lexicon fixes for soft-banned words (from lang-packs/<l>/lexicon-protected.md)
const SOFT_FIX = {
  zu: { isijele: 'ijezi' },
  xh: { 'ii-crows': 'amahlungulu' },
  st: { soupa: 'sopho', tsie: 'tswiritswiri', dikgogo: 'merubisi', motle: 'hotle', utsoarela: 'utlwela bohloko' },
}[lang];

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function replaceToken(line, from, to) {
  const re = new RegExp(`(^|[^\\p{L}])(${esc(from)})(?=[^\\p{L}]|$)`, 'iu');
  return line.replace(re, (m, pre, hit) => pre + (hit[0] === hit[0].toUpperCase() && hit[0] !== hit[0].toLowerCase() ? to[0].toUpperCase() + to.slice(1) : to));
}
const cite = (w) => { const e = idx.entry(w); if (!e) return null; const ex = idx.example(w); return `${w}: ${e.freq}× ${e.sources.join('/')}${ex ? ` — “${ex.text.slice(0, 120)}” (${ex.source})` : ''}`; };

// ---------- Sesotho orthography (rule 7) ----------
let saMap = new Map();
const SA_RULES = [['&scaron;', 'sh'], ['tš', 'tsh'], ['ch', 'tjh'], ['kh', 'kg'], ['oa', 'wa'], ['ea', 'ya'], ['oe', 'we'], ['ua', 'wa'], ['li', 'di'], ['lu', 'du']];
if (lang === 'st') {
  const wk = path.join(CACHE, 'wiktionary', 'st-wiktionary.jsonl');
  if (fs.existsSync(wk)) for (const line of fs.readFileSync(wk, 'utf8').split('\n')) {
    if (!line) continue;
    const p = JSON.parse(line); const t = p.text || '';
    const sa = /South African orthography\):'''\s*([^\n<]+)/.exec(t); const le = /Lesotho orthography\):'''\s*([^\n<]+)/.exec(t);
    if (sa && le) { const a = sa[1].trim().replace(/^-|'/g, '').toLowerCase(); const b = le[1].trim().replace(/^-|'/g, '').toLowerCase(); if (a && b && a !== b && !/\s|\[/.test(a + b)) saMap.set(b, a); }
  }
}
function saForm(w) {
  if (saMap.has(w)) return saMap.get(w);
  let s = w; for (const [a, b] of SA_RULES) s = s.split(a).join(b);
  return s === w ? null : s;
}
function orthographyProposal(text) {
  const changes = [];
  let proposed = text;
  for (const tok of tokenize(text, 'st')) {
    const w = tok.key;
    if (w.length < 3 || /^[A-Z]/.test(tok.surface) && !idx.has(w)) continue;
    const sa = saForm(w);
    if (!sa || sa === w) continue;
    const fSa = idx.freq(sa), fLe = idx.freq(w);
    if (!idx.has(sa) || fSa < 3 || fSa < fLe) continue;
    changes.push({ from: tok.surface, to: sa, rule: 'orthography', evidence: `SA form ${cite(sa)} · Lesotho form ${fLe}×` });
    proposed = replaceToken(proposed, tok.surface, sa);
  }
  return changes.length ? { proposed, changes } : null;
}

// ---------- proposals from triage findings (rules 1–6) ----------
const enGlossMatch = (glosses, en) => {
  const stems = new Set(enContentWords(en).map((w) => w.stem));
  for (const g of glosses) for (const w of g.toLowerCase().replace(/\(.*?\)/g, '').split(/[^a-z]+/)) { const s = enStem(w); if (s.length >= 3 && stems.has(s)) return enContentWords(en).find((x) => x.stem === s)?.word || null; }
  return null;
};
function proposalsFor(item) {
  const changes = [];
  let proposed = item.text;
  const done = new Set();
  for (const f of item.findings) {
    const tok = f.token; if (!tok || done.has(tok)) continue;
    const ev = f.evidence || {};
    let to = null, rule = null, evidence = '';
    if (f.check === 'lexical' && ev.pack === 'hard' && ev.fix) { to = ev.fix; rule = 'pack ban'; evidence = `banned by the ${lang} pack: ${f.message}`; }
    else if (f.check === 'semantic' && ev.pack === 'soft' && SOFT_FIX[tok.toLowerCase()]) { to = SOFT_FIX[tok.toLowerCase()]; rule = 'pack wrong-word'; evidence = `${f.message}; protected lexicon: ${to}`; }
    else if (f.check === 'lexical' && ev.closest && !ev.inhouseOnly) {
      // a typo, not an inflection: the edit is inside the word (Nguni/Sotho verbs change their
      // final vowel for mood and negation), the attested word is common, and it is not English noise
      const c = ev.closest;
      const low = tok.toLowerCase();
      const lastDiffers = low.slice(0, -1) === c.word.slice(0, -1) || low.slice(-1) !== c.word.slice(-1) && low.length === c.word.length && low.slice(0, -1) === c.word.slice(0, -1);
      const enIdx = LangIndex.load('en');
      const strong = !lastDiffers && !enIdx.has(c.word) && low.length >= 7 && ((c.d === 1 && c.freq >= 50) || (c.d === 2 && c.freq >= 200 && low.length >= 9));
      if (strong) { to = c.word; rule = 'typo'; evidence = `'${tok}' unattested; ${cite(c.word)}`; }
    }
    else if (f.check === 'morphology' && /diacritic in a Nguni line/.test(f.message)) { to = stripMarks(tok); rule = 'diacritic'; evidence = 'Nguni orthography carries no diacritics'; }
    // Fused-boundary splits and sibling-language swaps were tried as proposal rules and sampled
    // (2026-09-06): they produced 'lingena drama' for the correct 'lingenadrama' and 'omileng' for
    // the correct 'omile'. Not strong enough — those findings stay in the triage list only.
    if (!to || to.toLowerCase() === tok.toLowerCase()) continue;
    const next = replaceToken(proposed, tok, to);
    if (next === proposed) continue;
    proposed = next; done.add(tok);
    changes.push({ from: tok, to, rule, evidence });
  }
  if (lang === 'st') { const o = orthographyProposal(proposed); if (o) { proposed = o.proposed; changes.push(...o.changes); } }
  return changes.length ? { proposed, changes } : null;
}

const proposals = [];
let noProposal = 0;
for (const item of triage.items) {
  const p = proposalsFor(item);
  if (!p) { noProposal++; continue; }
  proposals.push({ id: `${lang.toUpperCase()}-P${proposals.length + 1}`, key: item.key, en: item.en, current: item.text, proposed: p.proposed, changes: p.changes, confidence: item.confidence, source: 'triage' });
}
// st: orthography over the whole bank, beyond the triaged lines
let bankScanned = 0;
if (lang === 'st') {
  const seen = new Set(proposals.map((p) => p.current));
  const rows = [];
  for (const group of ['heroLabels', 'headlines']) for (const [k, row] of Object.entries(WEATHER_COPY[group])) rows.push({ key: `${group}.${k}`, en: row.en, text: row.st });
  for (const group of ['witty', 'witty_low_confidence']) for (const [cond, bank] of Object.entries(WEATHER_COPY[group] || {})) for (let i = 0; i < (bank.st || []).length; i++) rows.push({ key: `${group}.${cond}[${i}]`, en: bank.en[i], text: bank.st[i] });
  const appJs = fs.readFileSync(path.join(ROOT, 'assets', 'app.js'), 'utf8');
  for (const m of appJs.matchAll(/^\s*([A-Za-z0-9_'-]+):\s*\{\s*en:\s*"((?:[^"\\]|\\.)*)"\s*,\s*af:\s*"(?:[^"\\]|\\.)*"\s*,\s*zu:\s*"(?:[^"\\]|\\.)*"\s*,\s*xh:\s*"(?:[^"\\]|\\.)*"\s*,\s*st:\s*"((?:[^"\\]|\\.)*)"\s*\}/gm)) rows.push({ key: `T.${m[1]}`, en: m[2], text: m[3] });
  for (const r of rows) {
    if (!r.text || seen.has(r.text)) continue;
    bankScanned++;
    const o = orthographyProposal(r.text);
    if (!o) continue;
    seen.add(r.text);
    proposals.push({ id: `${lang.toUpperCase()}-P${proposals.length + 1}`, key: r.key, en: r.en, current: r.text, proposed: o.proposed, changes: o.changes, confidence: null, source: 'bank orthography re-check' });
  }
}

const byRule = {};
for (const p of proposals) for (const c of p.changes) byRule[c.rule] = (byRule[c.rule] || 0) + 1;
fs.writeFileSync(path.join(ROOT, 'review', `lang-check-proposals-${lang}.json`), JSON.stringify({ generated: new Date().toISOString(), lang, triaged: triage.items.length, proposals: proposals.length, noProposal, bankScanned, byRule, items: proposals }, null, 1));

// ---------- the sheet ----------
const h = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mark = (text, changes, side) => { let out = h(text); for (const c of changes) { const w = side === 'from' ? c.from : c.to; out = out.replace(new RegExp(`(^|[^\\p{L}])(${esc(h(w))})(?=[^\\p{L}]|$)`, 'iu'), `$1<mark class="${side}">$2</mark>`); } return out; };
const rowsHtml = proposals.map((p) => `
<div class="row" data-id="${p.id}">
  <div class="head"><b>${p.id}</b> · <code>${h(p.key)}</code> · ${p.source}${p.confidence != null ? ` · conf ${p.confidence.toFixed(2)}` : ''}</div>
  <div class="en">EN: ${h(p.en)}</div>
  <div class="cur">now: ${mark(p.current, p.changes, 'from')}</div>
  <div class="prop">proposed: ${mark(p.proposed, p.changes, 'to')}</div>
  <ul class="why">${p.changes.map((c) => `<li><b>${h(c.from)} → ${h(c.to)}</b> <i>(${h(c.rule)})</i> — ${h(c.evidence)}</li>`).join('')}</ul>
  <div class="dec">
    <label><input type="radio" name="d-${p.id}" value="accept"> Accept</label>
    <label><input type="radio" name="d-${p.id}" value="reject"> Reject</label>
    <label><input type="radio" name="d-${p.id}" value="later"> Later</label>
    <input class="note" placeholder="note / your wording" data-id="${p.id}">
  </div>
</div>`).join('\n');

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>PW lang-check sheet — ${LANG_NAME[lang]} — ${proposals.length} proposals</title><style>
body{background:#14161a;color:#eee;font-family:Segoe UI,sans-serif;margin:0;padding:16px;line-height:1.4}
h1{font-size:18px;margin:0}.bar{position:sticky;top:0;background:#14161a;padding:10px 0;z-index:5;display:flex;gap:16px;align-items:center;border-bottom:1px solid #333;flex-wrap:wrap}
#count{font-weight:800;color:#ffd700}button{background:#ffd700;color:#111;border:none;border-radius:999px;padding:10px 22px;font-weight:800;font-size:14px;cursor:pointer}
.intro{color:#bbb;font-size:13px;max-width:900px;margin:10px 0}
.row{background:#1e2126;border-radius:10px;padding:12px 14px;margin:12px 0;border:2px solid transparent}.row.accept{border-color:#3cb371}.row.reject{border-color:#d9534f}.row.later{border-color:#888}
.head{font-size:12px;color:#aaa}code{color:#9cf}.en{color:#bbb;margin-top:4px}.cur,.prop{margin-top:4px;font-size:15px}.prop{color:#fff}
mark{padding:0 3px;border-radius:3px}mark.from{background:#6b2b2b;color:#fff}mark.to{background:#2b6b3a;color:#fff}
.why{font-size:12px;color:#ccc;margin:6px 0 0 18px;padding:0}.why li{margin:2px 0}
.dec{margin-top:8px;display:flex;gap:14px;align-items:center;flex-wrap:wrap}label{cursor:pointer;user-select:none;font-weight:700}input[type=radio]{transform:scale(1.3);margin-right:4px}
.note{flex:1;min-width:220px;background:#111;color:#eee;border:1px solid #444;border-radius:6px;padding:6px 8px}
</style></head><body>
<div class="bar"><h1>lang-check corrections — ${LANG_NAME[lang]}</h1><span id="count">0 decided</span><button onclick="exportDecisions()">Export lang-check-decisions-${lang}.json</button></div>
<div class="intro">${proposals.length} proposed corrections${lang === 'st' ? ` (${byRule.orthography || 0} of them South African orthography, from a re-check of all ${bankScanned + triage.items.length} st bank lines)` : ''}. Only lines with strong corpus evidence are here; the other ${noProposal} triaged lines stay in <code>review/lang-check-triage-${lang}.md</code> for a native reader. Red = current token, green = proposed. Nothing changes in the banks until the export is applied. Decisions persist in this browser.</div>
${rowsHtml}
<script>
const KEY='lang-check-sheet-${lang}';
const state=JSON.parse(localStorage.getItem(KEY)||'{}');
const rows=[...document.querySelectorAll('.row')];
function paint(){let n=0;for(const r of rows){const s=state[r.dataset.id]||{};r.classList.remove('accept','reject','later');if(s.decision){r.classList.add(s.decision);n++;const rb=r.querySelector('input[value="'+s.decision+'"]');if(rb)rb.checked=true;}const note=r.querySelector('.note');if(note&&s.note!=null)note.value=s.note;}document.getElementById('count').textContent=n+' / '+rows.length+' decided';}
document.addEventListener('change',e=>{if(e.target.type==='radio'){const id=e.target.name.slice(2);state[id]={...(state[id]||{}),decision:e.target.value};localStorage.setItem(KEY,JSON.stringify(state));paint();}});
document.addEventListener('input',e=>{if(e.target.classList.contains('note')){const id=e.target.dataset.id;state[id]={...(state[id]||{}),note:e.target.value};localStorage.setItem(KEY,JSON.stringify(state));}});
const proposals=${JSON.stringify(proposals.map((p) => ({ id: p.id, key: p.key, current: p.current, proposed: p.proposed })))};
function exportDecisions(){const out={generated:new Date().toISOString(),lang:'${lang}',decisions:proposals.map(p=>({...p,...(state[p.id]||{})}))};const blob=new Blob([JSON.stringify(out,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='lang-check-decisions-${lang}.json';a.click();}
paint();
</script></body></html>`;
fs.writeFileSync(path.join(ROOT, 'review', `lang-check-sheet-${lang}.html`), html);
console.log(`${lang}: ${proposals.length} proposals from ${triage.items.length} triaged lines${lang === 'st' ? ` + ${bankScanned} bank lines re-checked for orthography` : ''}; ${noProposal} triaged lines without a strong-evidence proposal — by rule ${JSON.stringify(byRule)}`);
console.log(`  → review/lang-check-sheet-${lang}.html · review/lang-check-proposals-${lang}.json`);
