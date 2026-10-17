// Step 1 of the native-ear judge (Al's brief, 11 Oct 2026): every line a native reviewer ruled on, with the native's
// verdict mapped to KEEP / FIX / CUT, then a fixed-seed 50/50 split per language into TRAIN and EXAM.
//
// Where the verdicts come from (the only native ground truth there is):
//   isiZulu  — commit d51b173 (30 May 2026), "apply Zulu native-speaker review": the bank as the reviewer saw it is
//              assets/weather-copy.js at d51b173^, her answer is the same file at d51b173. A line she left as it was is
//              KEEP; a line she changed carries her line as the rewrite. No reasons were written down.
//   Sesotho  — commit ecdfe11 (1 Jun 2026), the 90 replacements of review/sesotho-replacements.txt, read the same way;
//              the reviewer's own notes in that file ("tsie is a grasshopper") are carried as her reason.
//   isiXhosa — review/Xhosa-Review-Merge.xlsx (July 2026, reviewers A and B, 615 strings), exported to
//              data/xh-review-merge.json by xlsx-to-json.py: "Approved unchanged" is KEEP, "Changes to apply" carries the
//              native's line, the scrambled partly-cloudy rows carry the line applied from review/xhosa-quarantine.csv.
//   UI strings changed in the native commits (native-pairs.json, a38c32d) are recorded with scope "ui".
//   The docs/cold-clear-copy-review-* files are NOT native verdicts: their reviewer is Codex (their own header says
//   "NATIVE-SPEAKER REVIEW STILL REQUIRED"), and the *-voice / *-residue / *-addendum files are model notes and open
//   questions, not rulings. They are not used.
//
// KEEP / FIX / CUT. The natives wrote lines, not labels, so the label is read off what they did:
//   KEEP — left the line as it was.
//   FIX  — changed it but kept the draft's line: their line and the draft share at least CUT_BELOW (30%) of their
//          three-letter sequences.
//   CUT  — threw the draft out and wrote a new line (under 30% shared), which includes a line written for an English
//          the draft never translated (the scrambled bins).
// 30% was read off the natives' changes before any judge ran (above it the native's line is the draft reworded; well
// below it, a different line) and is not changed after. It is coarse for isiZulu and isiXhosa, where one changed
// prefix changes a whole word.
//
// Rows left out of the exam, each with its reason in the row (`excluded`):
//   - the two bins the June audit (CHECKPOINT at eec29d85) found misaligned with the English when the natives read them
//     — witty.partly-cloudy and witty_low_confidence.clear — for isiZulu and Sesotho: a "keep" there is not a verdict on
//     the English the judge would see. (isiXhosa's sheet paired each line with its English, so its rows stand.)
//   - a kept line carrying a word the record documents as wrong (umkhumbi "ship" for kite, lifofane "airplanes"...):
//     the native let it stand, the record says it is wrong — contested, so neither side is scored.
//   - Sesotho changes that are spelling only (the reviewer wrote Lesotho orthography; Al ruled 6 Sept 2026 that the
//     house standard is the South African one), and changes of punctuation or capitals only.
//   - the same English and draft twice with different verdicts.
// Scope: "line" = the witty lines (witty, witty_low_confidence, the Cape wind warnings) — the hero lines the judge is
// for; "label" = hero labels and headlines; "ui" = buttons, menus, messages. Only "line" rows are split and examined.
//
//   node scripts/lang-judge/build-verdicts.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { WEATHER_COPY } from '../../assets/weather-copy.js';

const ROOT = path.resolve(import.meta.dirname, '../..');
const DATA = path.join(import.meta.dirname, 'data');
export const SEED = 20261011;
export const CUT_BELOW = 0.3;

// ---------- small tools ----------
export function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function shuffle(arr, rand) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
// letters and digits only, lower case, single spaces — punctuation and capitals do not count as a change
export const norm = (s) => String(s ?? '').normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
// character-trigram Dice similarity of two lines (1 = same letters, 0 = nothing shared)
export function similarity(a, b) {
  const grams = (s) => { const t = ` ${norm(s)} `; const m = new Map(); for (let i = 0; i + 3 <= t.length; i++) { const g = t.slice(i, i + 3); m.set(g, (m.get(g) || 0) + 1); } return m; };
  const A = grams(a), B = grams(b);
  let inter = 0, na = 0, nb = 0;
  for (const v of A.values()) na += v;
  for (const v of B.values()) nb += v;
  for (const [g, v] of A) inter += Math.min(v, B.get(g) || 0);
  return na + nb ? (2 * inter) / (na + nb) : 1;
}
export const verdictOf = (draft, final) => (final === draft ? 'KEEP' : similarity(draft, final) >= CUT_BELOW ? 'FIX' : 'CUT');

// Lesotho → South African Sesotho spelling, word by word (tš→tsh, ch→tjh, kh→kg, l→d before i/u, o→w and e→y before
// a vowel), so a change that is only the reviewer's orthography can be told from a change of wording.
export function stToSa(s) {
  return norm(s).split(' ').map((w) => w
    .replace(/tš/g, 'tsh').replace(/š/g, 'sh')
    .replace(/(?<!t)(?<!tj)ch/g, 'tjh')
    .replace(/kh/g, 'kg')
    .replace(/l(?=[iu])/g, 'd')
    .replace(/o(?=[aei])/g, 'w')
    .replace(/e(?=[aou])/g, 'y')).join(' ');
}

function* bankRows(node, p) {
  if (!node || typeof node !== 'object') return;
  if ('en' in node && Array.isArray(node.en)) {
    for (let i = 0; i < node.en.length; i++) yield { key: `${p}[${i}]`, en: node.en[i], zu: node.zu?.[i], xh: node.xh?.[i], st: node.st?.[i] };
    return;
  }
  if ('en' in node && typeof node.en === 'string') { yield { key: p, en: node.en, zu: node.zu, xh: node.xh, st: node.st }; return; }
  for (const [k, v] of Object.entries(node)) yield* bankRows(v, p ? `${p}.${k}` : k);
}
const groupOf = (key) => key.split('.')[0];
const condOf = (key) => (key.split('.')[1] || '').replace(/\[\d+\]$/, '');
const scopeOfGroup = (g) => (g === 'witty' || g === 'witty_low_confidence' ? 'line' : g === 'heroLabels' || g === 'headlines' ? 'label' : 'other');

async function bankAt(commit) {
  const src = execFileSync('git', ['show', `${commit}:assets/weather-copy.js`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-bank-'));
  const f = path.join(dir, 'weather-copy.mjs');
  fs.writeFileSync(f, src);
  try { return (await import(pathToFileURL(f).href)).WEATHER_COPY; } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// words the record documents as wrong in a line a native kept (scripts/lang-check/build-gold.mjs BAD_TOKENS)
const DOCUMENTED_WRONG = {
  zu: ['umkhumbi', 'amapulazi', 'izinkonjane', 'izindlela', 'isijele'],
  xh: ['lwengqeleolukwenza'],
  st: ['boko', 'tlosa mabone', 'hlonepha', 'lifofane', 'setofo', 'tsie', 'tšie', 'dikgogo', 'utsoarela'],
};
const carriesWrong = (lang, text) => (DOCUMENTED_WRONG[lang] || []).find((w) => new RegExp(`(^| )${norm(w)}( |$)`, 'u').test(norm(text)));
const MISALIGNED_BINS = new Set(['witty.partly-cloudy', 'witty_low_confidence.clear']);

const rows = [];
function add(r) {
  const out = { id: '', lang: r.lang, scope: r.scope, group: r.group ?? null, cond: r.cond ?? null, key: r.key ?? null, en: r.en, draft: r.draft,
    verdict: r.verdict, rewrite: r.verdict === 'KEEP' ? null : r.final, reason: r.reason ?? null, record: r.record ?? null, natives: r.natives ?? null,
    sim: r.verdict === 'KEEP' ? 1 : Number(similarity(r.draft, r.final).toFixed(3)), source: r.source, excluded: r.excluded ?? null, split: null };
  rows.push(out);
  return out;
}

// ---------- isiZulu and Sesotho: the bank before and after the native's commit ----------
async function fromCommit(lang, commit, source, notes = new Map()) {
  const before = new Map([...bankRows(await bankAt(`${commit}^`), '')].map((r) => [r.key, r]));
  const after = new Map([...bankRows(await bankAt(commit), '')].map((r) => [r.key, r]));
  for (const [key, b] of before) {
    const a = after.get(key);
    const draft = (b[lang] || '').trim();
    if (!draft || !a) continue;
    const final = (a[lang] || '').trim();
    const group = groupOf(key), cond = condOf(key);
    let verdict = verdictOf(draft, final);
    let excluded = null;
    if (verdict !== 'KEEP' && norm(draft) === norm(final)) excluded = 'punctuation or capitals only — not a ruling on the line';
    else if (lang === 'st' && verdict !== 'KEEP' && stToSa(draft) === stToSa(final)) excluded = 'spelling only: the reviewer wrote Lesotho orthography, and Al ruled on 6 Sept 2026 that the house standard is the South African one';
    if (MISALIGNED_BINS.has(`${group}.${cond}`)) excluded = `bin misaligned with the English when the native read it (CHECKPOINT at eec29d85: ${cond === 'clear' ? 'Defect B' : 'Defect A'})`;
    const wrong = verdict === 'KEEP' && carriesWrong(lang, draft);
    if (wrong) excluded = `kept by the native, but "${wrong}" is documented as the wrong word (scripts/lang-check/build-gold.mjs) — contested`;
    const note = notes.get(norm(draft)) || notes.get(norm(b.en));
    add({ lang, scope: scopeOfGroup(group), group, cond, key, en: b.en, draft, final, verdict, reason: note || null, record: `git ${commit}`, source, excluded });
  }
}

// the Sesotho reviewer's own notes, keyed by the line she corrected (and by its English)
function stNotes() {
  const txt = fs.readFileSync(path.join(ROOT, 'review', 'sesotho-replacements.txt'), 'utf8').replace(/\r\n/g, '\n');
  const notes = new Map();
  for (const block of txt.split(/\n(?=\[T\d+R\d+\])/)) {
    const en = block.match(/EN:\s*(.*)/)?.[1]?.trim();
    const from = block.match(/FROM:\s*(.*)/)?.[1]?.trim();
    const lines = block.split('\n').slice(1).filter((l) => !/^\s*(EN|FROM|TO):/.test(l) && l.trim() && !l.startsWith('#'));
    const said = lines.map((l) => l.trim().replace(/^\(raw note was:\s*/, '').replace(/\)\s*$/, '')).join(' ').trim();
    if (!said) continue;
    if (from) notes.set(norm(from), said);
    if (en) notes.set(norm(en), said);
  }
  return notes;
}

// ---------- isiXhosa: the merge sheet ----------
const XH_SECTION_COND = {
  'Storms / severe weather': 'storm', Hail: 'hail', Thunder: 'thunder', Rain: 'rain', 'Possible rain (showers)': 'rain-possible',
  'Overcast / cloudy': 'cloudy', 'Strong sun (high UV)': 'uv', Wind: 'wind', Cold: 'cold', 'Very hot': 'heat', 'Fog / low visibility': 'fog',
  'Clear&pleasant': 'clear', 'Clear night': 'night', Weekend: 'weekend', 'Partly cloudy': 'partly-cloudy', 'Cape Town wind warning': 'wind',
};
const keyByEn = new Map();
for (const r of bankRows(WEATHER_COPY, '')) if (!keyByEn.has(r.en)) keyByEn.set(r.en, r.key);
function xhPlace(section, en) {
  const base = section.replace(/\s+[—–-]\s+uncertain version$/, '');
  const uncertain = base !== section;
  if (section === 'Main weather labels') return { scope: 'label', group: 'heroLabels', cond: condOf(keyByEn.get(en) || '') || null };
  if (section === 'Headlines') return { scope: 'label', group: 'headlines', cond: condOf(keyByEn.get(en) || '') || null };
  // the warnings are lines; their title ("WIND WARNING") is a label
  if (section === 'Cape Town wind warning') return { scope: /\p{Ll}/u.test(en) ? 'line' : 'label', group: 'capeWind', cond: 'wind' };
  if (XH_SECTION_COND[base] || /^Part 2/.test(section)) {
    const key = keyByEn.get(en);
    const group = uncertain ? 'witty_low_confidence' : 'witty';
    // "Part 2" is the Highveld cold-clear set (rewritten 24 May 2026); a few of its English lines were reworded since
    return { scope: 'line', group: key ? groupOf(key) : group, cond: (key && condOf(key)) || XH_SECTION_COND[base] || (/^Part 2/.test(section) ? 'cold-clear' : null), key: key || null };
  }
  return { scope: 'ui', group: 'ui', cond: null };
}
// a CSV with a header row, quoted fields allowed (no newlines inside a field in these files)
function readCsv(file) {
  const parse = (line) => { const out = []; let cur = '', q = false; for (let i = 0; i < line.length; i++) { const c = line[i]; if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; } else if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c; } out.push(cur); return out; };
  const [head, ...body] = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').trim().split('\n').map(parse);
  return body.map((cells) => Object.fromEntries(head.map((h, i) => [h, cells[i] ?? ''])));
}
const quoteOfNative = (rationale) => (/^[AB]:\s*'/.test(rationale || '') || /^B wrote /.test(rationale || '') ? rationale : null);
function fromXhSheet() {
  const sheet = JSON.parse(fs.readFileSync(path.join(DATA, 'xh-review-merge.json'), 'utf8'));
  const src = 'review/Xhosa-Review-Merge.xlsx (isiXhosa native review, reviewers A and B, July 2026)';
  for (const r of sheet.approved) {
    if (!r.shipped) continue;
    add({ lang: 'xh', ...xhPlace(r.section, r.english), en: r.english, draft: r.shipped, final: r.shipped, verdict: 'KEEP', record: r.basis,
      natives: /both/.test(r.basis) ? { A: 'KEEP', B: 'KEEP' } : { A: 'KEEP', B: null }, source: src });
  }
  // The sheet's FINAL cell sometimes still carries the reviewer's comment after the line ("… ekugrileni sounds stiff …");
  // review/xhosa-apply.csv holds the line as applied, so the line comes from there and the rest of the cell is the
  // reviewer's reason, in her words.
  const applied = new Map(readCsv(path.join(ROOT, 'review', 'xhosa-apply.csv')).map((c) => [`${c.english}|${c.shipped.trim()}`, c.final.trim()]));
  for (const r of sheet.apply) {
    if (!r.shipped || !r.final) continue;
    const cell = r.final.trim();
    const final = applied.get(`${r.english}|${r.shipped.trim()}`) || cell;
    const comment = final !== cell && cell.startsWith(final) ? cell.slice(final.length).replace(/^[\s.\-–—]+/, '').trim() : '';
    const verdict = verdictOf(r.shipped.trim(), final);
    const split = /^Only B corrected/.test(r.rationale || '');
    add({ lang: 'xh', ...xhPlace(r.section, r.english), en: r.english, draft: r.shipped.trim(), final, verdict,
      reason: [quoteOfNative(r.rationale), comment].filter(Boolean).join(' · ') || null, record: `${r.rationale}${r.flags ? ` [${r.flags}]` : ''}`,
      natives: split ? { A: 'KEEP', B: verdict } : r.source === 'A' ? { A: verdict, B: null } : { A: verdict, B: verdict },
      source: src, excluded: verdict !== 'KEEP' && norm(r.shipped) === norm(final) ? 'punctuation or capitals only — not a ruling on the line' : null });
  }
  // the scrambled partly-cloudy bin: the line the natives' notes produced, as applied (review/xhosa-quarantine.csv)
  const fill = new Map(readCsv(path.join(ROOT, 'review', 'xhosa-quarantine.csv')).map((c) => [c.english, c.fill_final]));
  for (const r of sheet.quarantine) {
    if (!r.shipped) continue;
    const said = [r.noteA, r.noteB].filter(Boolean);
    const place = { ...xhPlace(r.section, r.english) };
    if (!said.length) {
      add({ lang: 'xh', ...place, en: r.english, draft: r.shipped, final: r.shipped, verdict: 'KEEP', record: r.use, source: src, excluded: 'no native line written for it (marked for re-review after realignment)' });
      continue;
    }
    const final = said.includes(fill.get(r.english)) ? fill.get(r.english) : said[0];
    add({ lang: 'xh', ...place, en: r.english, draft: r.shipped, final, verdict: verdictOf(r.shipped, final),
      record: `scrambled bin; A: ${r.noteA ?? '—'} | B: ${r.noteB ?? '—'}`, natives: { A: r.noteA ? 'rewrote' : null, B: r.noteB ? 'rewrote' : null }, source: src });
  }
}

// ---------- UI strings from the native commits ----------
function uiPairs() {
  const pairs = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'lang-check', 'data', 'native-pairs.json'), 'utf8'));
  const NATIVE = { d51b173: 'zu', ecdfe11: 'st', a38c32d: 'st' };
  for (const p of pairs) {
    if (NATIVE[p.commit] !== p.lang || p.file === 'weather-copy.js' || !p.before || !p.after) continue;
    const verdict = verdictOf(p.before.trim(), p.after.trim());
    add({ lang: p.lang, scope: 'ui', group: 'ui', en: (p.ctx.match(/en:\s*"([^"]*)"/) || [])[1] || '', draft: p.before.trim(), final: p.after.trim(), verdict,
      record: `git ${p.commit} ${p.file}:${p.line}`, source: `git ${p.commit} (native review)` });
  }
}

// ---------- build ----------
export async function build() {
  rows.length = 0;
  await fromCommit('zu', 'd51b173', 'git d51b173 (isiZulu native review, 30 May 2026)');
  await fromCommit('st', 'ecdfe11', 'git ecdfe11 (Sesotho native review, review/sesotho-replacements.txt, 1 Jun 2026)', stNotes());
  fromXhSheet();
  uiPairs();

  // a one-word "line" is a label, not a joke; and a native line that cannot teach or test anything — a fragment in the
  // record, or one carrying a documented wrong word — is not scored
  const words = (s) => s.split(/\s+/).filter(Boolean).length;
  for (const r of rows) {
    if (r.scope === 'line' && words(r.draft) < 2) r.scope = 'label';
    if (r.verdict === 'KEEP' || r.excluded) continue;
    const wrong = carriesWrong(r.lang, r.rewrite);
    if (wrong) r.excluded = `the native's line carries "${wrong}", documented as the wrong word (scripts/lang-check/build-gold.mjs) — contested`;
    else if (words(r.rewrite) <= 2 && words(r.draft) >= 4) r.excluded = `the native's line in the record is a fragment ("${r.rewrite}") — not a usable verdict`;
  }

  // one row per (language, English, draft); two different verdicts on the same pair are not scored
  const seen = new Map();
  for (const r of rows) {
    const k = `${r.lang}|${norm(r.en)}|${norm(r.draft)}`;
    const first = seen.get(k);
    if (!first) { seen.set(k, r); continue; }
    if (first.verdict === r.verdict) r.excluded ||= `duplicate of the same English and draft (${first.key || first.record})`;
    else for (const x of [first, r]) x.excluded = `the same English and draft got different verdicts (${first.verdict} / ${r.verdict})`;
  }

  // ids, then the split. Per language, the "line" rows not excluded are grouped so that rows sharing an English, a draft
  // or a native line always sit on the same side (an identical draft under two Englishes would otherwise show an EXAM
  // answer as a TRAIN compare line). Groups are stratified by their strongest verdict (CUT over FIX over KEEP),
  // shuffled with SEED, and each goes to the side with fewer rows of that verdict so far — 50/50 by rows.
  const LANG_ORDER = ['zu', 'xh', 'st'];
  rows.sort((a, b) => LANG_ORDER.indexOf(a.lang) - LANG_ORDER.indexOf(b.lang) || (a.scope > b.scope ? 1 : a.scope < b.scope ? -1 : 0) || (a.key || a.en).localeCompare(b.key || b.en) || a.draft.localeCompare(b.draft));
  const n = {};
  for (const r of rows) r.id = `${r.lang}-${String((n[r.lang] = (n[r.lang] || 0) + 1)).padStart(4, '0')}`;
  const RANK = { KEEP: 0, FIX: 1, CUT: 2 };
  for (const lang of LANG_ORDER) {
    const scored = rows.filter((r) => r.lang === lang && r.scope === 'line' && !r.excluded);
    const parent = new Map(scored.map((r) => [r.id, r.id]));
    const find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
    const owner = new Map();
    for (const r of scored) for (const t of [`en:${norm(r.en)}`, `text:${norm(r.draft)}`, r.rewrite ? `text:${norm(r.rewrite)}` : null].filter(Boolean)) {
      if (owner.has(t)) parent.set(find(r.id), find(owner.get(t))); else owner.set(t, r.id);
    }
    // and a line of two words or more inside another line ("Isibhakabhaka asikwazi ukwenza isigqibo." is the first
    // half of a longer line) ties the two rows together too
    const texts = [...owner].filter(([t]) => t.startsWith('text:')).map(([t, id]) => [` ${t.slice(5)} `, id]);
    for (const [a, ida] of texts) if (a.trim().split(' ').length >= 2) for (const [b, idb] of texts) if (ida !== idb && b.length > a.length && b.includes(a)) parent.set(find(ida), find(idb));
    const groups = new Map();
    for (const r of scored) groups.set(find(r.id), [...(groups.get(find(r.id)) || []), r]);
    const strata = { KEEP: [], FIX: [], CUT: [] };
    for (const g of [...groups.values()].sort((a, b) => a[0].id.localeCompare(b[0].id))) strata[g.reduce((w, r) => (RANK[r.verdict] > RANK[w] ? r.verdict : w), 'KEEP')].push(g);
    const rand = mulberry32(SEED + LANG_ORDER.indexOf(lang));
    for (const v of ['KEEP', 'FIX', 'CUT']) {
      const size = { train: 0, exam: 0 };
      shuffle(strata[v], rand).forEach((g, i) => {
        const side = size.train < size.exam ? 'train' : size.exam < size.train ? 'exam' : i % 2 === 0 ? 'train' : 'exam';
        for (const r of g) r.split = side;
        size[side] += g.length;
      });
    }
  }

  const counts = {};
  for (const r of rows) {
    const c = (counts[r.lang] ||= { all: 0, byScope: {}, line: { KEEP: 0, FIX: 0, CUT: 0 }, excluded: 0, train: { KEEP: 0, FIX: 0, CUT: 0 }, exam: { KEEP: 0, FIX: 0, CUT: 0 } });
    c.all++;
    c.byScope[r.scope] = (c.byScope[r.scope] || 0) + 1;
    if (r.scope !== 'line') continue;
    if (r.excluded) { c.excluded++; continue; }
    c.line[r.verdict]++;
    c[r.split][r.verdict]++;
  }
  return { built: new Date().toISOString().slice(0, 10), seed: SEED, cutBelow: CUT_BELOW, counts, rows };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const out = await build();
  fs.writeFileSync(path.join(DATA, 'native-verdicts.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify(out.counts, null, 1));
  if (process.argv.includes('--dist')) {
    for (const lang of ['zu', 'xh', 'st']) {
      const ch = out.rows.filter((r) => r.lang === lang && r.scope === 'line' && !r.excluded && r.verdict !== 'KEEP').sort((a, b) => a.sim - b.sim);
      console.log(`\n${lang}: ${ch.length} changed`);
      for (const r of ch) console.log(`  ${r.sim.toFixed(2)} ${r.verdict} | ${r.draft} → ${r.rewrite}`);
    }
  }
}
