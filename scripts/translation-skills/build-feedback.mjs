// Every human verdict and correction on the app's af / zu / xh / st copy, in one shape
// (2026-09-23). The error taxonomy and the gold sets both derive from this file.
//
//   { id, lang, en, before, after, verdict, who, source, note }
//     verdict  corrected  — a human replaced `before` with `after`
//              approved   — a human kept `after` as it is
//              rejected   — a human refused `before` and gave nothing in its place
//              quarantined — a reviewer would not vouch for `before` (doubt, not a ruling)
//
// Sources (only human work; machine drafts and model audits are left out on purpose):
//   af  review/al-line-rulings.json   Al, July 2026 — KEEP as is, or KEEP with his rewording (comment)
//       review/al-pair-rulings.json   Al — YES on an Afrikaans line for a photograph (NO judged the pairing)
//       review/af-al-decisions.json   Al's own Afrikaans for lines the gate held (before = the proposal)
//       commit 2fe4972                Al's Afrikaans gap-fill (partly-cloudy), verbatim
//   zu  commit d51b173                the isiZulu native review (30 corrections)
//       lang-packs/zu/corpus-confirmed.jsonl  the native-reviewed bank (approved)
//   xh  review/xhosa-apply.csv        the isiXhosa native review, shipped -> final (commit 0510415)
//       review/xhosa-quarantine.csv   lines the review would not vouch for
//       lang-packs/xh/corpus-confirmed.jsonl
//   st  review/sesotho-replacements.txt  the Sesotho native review, FROM -> TO (commit ecdfe11)
//       commit a38c32d                the reviewer reverting model edits
//       lang-packs/st/corpus-confirmed.jsonl (SA orthography since 2026-09-06)
// Left out, and why: commit 5efdc0c (1,281 machine drafts that passed a checker), c7715c4
// (a GPT-5.5 audit), 0519c3f / cb0fa87 (fixes by a model session, not a speaker).
//
// Sesotho spelling: the June reviewer wrote the Lesotho orthography (moholi, chesa, li-, ea).
// Al ruled South African orthography on 2026-09-06 and the bank was re-spelled. A reviewer
// `after` keeps its words and meaning here; `afterSA` carries the live SA spelling of the
// same line where the live bank still has it, and gold sets use that.
//
//   node scripts/translation-skills/build-feedback.mjs  -> output/translation-skills/feedback.json
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WEATHER_COPY } from '../../assets/weather-copy.js';

const root = fileURLToPath(new URL('../..', import.meta.url));
const R = (...p) => path.join(root, ...p);
const rd = (p) => JSON.parse(readFileSync(R(p), 'utf8'));
const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
const outDir = R('output', 'translation-skills');
mkdirSync(outDir, { recursive: true });
const items = [];
const seen = new Set();
let n = 0;
const add = (it) => {
  const key = `${it.lang}|${it.verdict}|${it.en}|${it.before}|${it.after}`;
  if (seen.has(key)) return;
  if (!it.en || (!it.after && !it.before)) return;
  seen.add(key);
  items.push({ id: `${it.lang}-fb-${String(++n).padStart(4, '0')}`, ...it });
};

// ---- CSV (quoted fields, commas inside quotes) --------------------------------
function csv(file) {
  const text = readFileSync(R(file), 'utf8').replace(/^﻿/, '');
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some((x) => x !== '')) rows.push(row); row = []; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

// ---- WEATHER_COPY at a commit, for joining an array element to its English ---------
const tmp = path.join(outDir, 'tmp-feedback');
mkdirSync(tmp, { recursive: true });
const copyAt = new Map();
async function weatherCopyAt(ref) {
  if (copyAt.has(ref)) return copyAt.get(ref);
  let W = null;
  try {
    const src = git('show', `${ref}:assets/weather-copy.js`).replace(/^export \{[^}]*\} from '[^']*';\s*$/gm, '');
    const f = path.join(tmp, `${ref.replace(/[^a-z0-9]/gi, '_')}.mjs`);
    writeFileSync(f, src);
    W = (await import(pathToFileURL(f).href)).WEATHER_COPY;
  } catch { W = null; }
  copyAt.set(ref, W);
  return W;
}
// the English keyed to `text` in `lang` in that version of the bank (any namespace, bin, index)
function englishFor(W, lang, text) {
  if (!W || !text) return null;
  for (const group of Object.values(W)) {
    for (const row of Object.values(group || {})) {
      if (!row || typeof row !== 'object') continue;
      if (Array.isArray(row[lang])) { const i = row[lang].indexOf(text); if (i >= 0 && Array.isArray(row.en)) return row.en[i] || null; }
      else if (row[lang] === text && typeof row.en === 'string') return row.en;
    }
  }
  return null;
}
const enFromCtx = (ctx) => (String(ctx || '').match(/en:\s*"((?:[^"\\]|\\.)*)"/) || [])[1] || null;

// ---- native-review commits, through lang-check's extraction of them ------------------
const pairs = rd('scripts/lang-check/data/native-pairs.json');
const COMMITS = { d51b173: 'zu native reviewer', a38c32d: 'st native reviewer', '2fe4972': 'Al' };
for (const p of pairs) {
  if (!COMMITS[p.commit] || p.lang === 'en') continue;
  let en = enFromCtx(p.ctx);
  if (!en && p.file === 'weather-copy.js') en = englishFor(await weatherCopyAt(`${p.commit}^`), p.lang, p.before) || englishFor(await weatherCopyAt(p.commit), p.lang, p.after);
  if (!en) continue;
  add({ lang: p.lang, en, before: p.before || null, after: p.after, verdict: p.before ? 'corrected' : 'approved', who: COMMITS[p.commit], source: `commit ${p.commit}` });
}

// ---- isiXhosa review -------------------------------------------------------------------
for (const r of csv('review/xhosa-apply.csv')) {
  if (!r.english || !r.final) continue;
  add({ lang: 'xh', en: r.english, before: r.shipped && r.shipped !== r.final ? r.shipped : null, after: r.final, verdict: r.shipped && r.shipped !== r.final ? 'corrected' : 'approved', who: `xh native reviewer ${r.source || ''}`.trim(), source: 'review/xhosa-apply.csv (commit 0510415)', note: [r.confidence && `confidence ${r.confidence}`, r.flags].filter(Boolean).join('; ') });
}
for (const r of csv('review/xhosa-quarantine.csv')) {
  if (!r.english || !r.fill_final) continue;
  add({ lang: 'xh', en: r.english, before: r.fill_final, after: null, verdict: 'quarantined', who: 'xh native review', source: 'review/xhosa-quarantine.csv', note: [r.confidence, r.rationale].filter(Boolean).join('; ') });
}

// ---- Sesotho review ----------------------------------------------------------------------
{
  const text = readFileSync(R('review/sesotho-replacements.txt'), 'utf8');
  for (const m of text.matchAll(/\[(T\d+R\d+|[A-Z0-9-]+)\]\s*EN:\s*(.+)\r?\n\s*FROM:\s*(.*)\r?\n\s*TO:\s*(.+)/g)) {
    add({ lang: 'st', en: m[2].trim(), before: m[3].trim() || null, after: m[4].trim(), verdict: m[3].trim() ? 'corrected' : 'approved', who: 'st native reviewer', source: `review/sesotho-replacements.txt ${m[1]} (commit ecdfe11)` });
  }
}

// ---- native-reviewed banks (approved) ------------------------------------------------------
for (const lang of ['zu', 'xh', 'st']) {
  const f = R('lang-packs', lang, 'corpus-confirmed.jsonl');
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split('\n').filter(Boolean)) {
    const r = JSON.parse(line);
    if (r.en && r[lang]) add({ lang, en: r.en, before: null, after: r[lang], verdict: 'approved', who: `${lang} native-reviewed bank`, source: `lang-packs/${lang}/corpus-confirmed.jsonl ${r.key || ''}`.trim(), note: r.status || '' });
  }
}

// ---- Al's Afrikaans ---------------------------------------------------------------------------
for (const r of rd('review/al-line-rulings.json').rulings) {
  if (!r.en || !r.af) continue;
  const reworded = r.comment && r.comment.trim() && r.comment.trim() !== r.af.trim();
  add({ lang: 'af', en: r.en, before: reworded ? r.af : null, after: reworded ? r.comment.trim() : r.af, verdict: reworded ? 'corrected' : 'approved', who: 'Al', source: `review/al-line-rulings.json ${r.key}` });
}
// YES is Al keeping a line, Afrikaans shown, for a photograph: an approval of the Afrikaans.
// NO is a verdict on the PAIRING (the line against the photograph), not on the translation
// ("Selfs die hadedas klink gelukkig." is a faithful line he said NO to), so it is left out.
for (const r of rd('review/al-pair-rulings.json').rulings) {
  if (!r.en || !r.af || r.verdict !== 'YES') continue;
  add({ lang: 'af', en: r.en, before: null, after: r.af, verdict: 'approved', who: 'Al', source: `review/al-pair-rulings.json ${r.key || r.id || ''}`.trim() });
}
{
  const proposals = new Map(rd('review/af-bespoke-decisions.json').rows.map((r) => [r.english, r]));
  for (const d of rd('review/af-al-decisions.json').decisions) {
    if (!d.english || !d.afrikaans) continue;
    const p = proposals.get(d.english);
    const before = p?.afrikaans && p.afrikaans !== d.afrikaans ? p.afrikaans : null;
    add({ lang: 'af', en: d.english, before, after: d.afrikaans, verdict: before ? 'corrected' : 'approved', who: 'Al', source: `review/af-al-decisions.json ${d.id}` });
  }
}

// ---- SA spelling for Sesotho reviewer lines: the live bank's version of the same English ----
const liveSt = new Map();
for (const group of Object.values(WEATHER_COPY)) for (const row of Object.values(group || {})) {
  if (!row || typeof row !== 'object') continue;
  if (Array.isArray(row.st) && Array.isArray(row.en)) row.en.forEach((en, i) => { if (row.st[i]) liveSt.set(en, row.st[i]); });
  else if (typeof row.st === 'string' && typeof row.en === 'string') liveSt.set(row.en, row.st);
}
for (const it of items) if (it.lang === 'st' && it.after && liveSt.has(it.en)) it.afterSA = liveSt.get(it.en);

rmSync(tmp, { recursive: true, force: true });
const count = {};
for (const it of items) { const c = (count[it.lang] ||= {}); c[it.verdict] = (c[it.verdict] || 0) + 1; }
writeFileSync(path.join(outDir, 'feedback.json'), JSON.stringify({ generated: new Date().toISOString().slice(0, 10), counts: count, items }, null, 1));
console.log(`[feedback] ${items.length} human verdicts/corrections`);
for (const [l, c] of Object.entries(count)) console.log(`  ${l}: ${JSON.stringify(c)}`);
