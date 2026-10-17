// Maat's rulings on the judge's October verdicts (review/maat-rulings-2026-10-12.md): the judge's rewrite for every FIX
// row in isiXhosa and isiZulu, except the rows Maat replaced with his own line and the rows he marked not applicable;
// the held dust-devil line gets the judge's line if it passes the gate. Every rewrite goes through the gate:
//   - the rebuilt checker (lib/checker-v2.mjs, with the blind back-translation record) must not rate it triage-high —
//     unless every medium/high finding is one of the English loans Maat lists, which the judge chose on purpose: then it
//     is applied and marked "loan accepted (judge)" (Maat's first adjustment, this round only);
//   - its back-translation must not drift from the English or read a word as garbled, at any confidence (Maat's second
//     adjustment; garbled added by his ruling later on 12 Oct), nor be wrong-language or untranslated at the gate's 0.6
//     — a held rewrite leaves the previous line in place.
//
//   node scripts/lang-check/apply-judge-rewrites.mjs plan     → lang-packs/<lang>/judge-rewrites-2026-10-12.jsonl and
//       scripts/lang-check/data/bt/judge-rewrites-2026-10-12-<lang>.json (the lines still needing a back-translation)
//   node scripts/lang-check/apply-judge-rewrites.mjs apply    → gates every rewrite, writes the passing ones into
//       lang-packs/<lang>/drafts-2026-10.jsonl (photo lines) and assets/weather-copy.js + the provisional manifest (bank
//       lines), and records the outcome of each in judge-rewrites-2026-10-12.jsonl. Then run
//       apply-hero-lines-provisional.mjs per language, npm run copy:generate and build-bt-report.mjs.
//   node scripts/lang-check/apply-judge-rewrites.mjs regate   → gates every applied rewrite again under the current rule
//       and puts the previous line back wherever one now fails (draft row, bank slot, manifest row); then the same
//       three regenerating steps.

import fs from 'node:fs';
import path from 'node:path';
import { checkV2 } from './lib/checker-v2.mjs';
import { WEATHER_COPY } from '../../assets/weather-copy.js';

const ROOT = path.resolve(import.meta.dirname, '../..');
const RULINGS = 'review/maat-rulings-2026-10-12.md';
const LANGS = { xh: 'isiXhosa', zu: 'isiZulu' };
const HELD_LINE = 'hero:2071c8a37d11';
// Maat's list of loans the judge chose on purpose, as whole phrases (Sol, 12 Oct 2026: never a generic part of one)
export const ACCEPTED_LOANS = ['aircon', 'refresh', 'fairy lights', 'windpump', 'umpire', 'sundowners', 'surfer', 'privacy setting', 'trailer', 'cheers', 'zero', 'pier', 'electric blanket', 'cape doctor', 'friendly city', 'windy city'];
const BAD = new Set(['wrong-language', 'untranslated']);
// held at any confidence (Maat, 12 Oct 2026)
const ANY = new Set(['drift', 'garbled']);
const readJsonl = (p) => fs.readFileSync(p, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
const writeJsonl = (p, rows) => fs.writeFileSync(p, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
const rel = (...p) => path.join(ROOT, ...p);
const attemptsFile = (lang) => rel('lang-packs', lang, 'judge-rewrites-2026-10-12.jsonl');

// Maat's file: his own lines (a table per language), the not-applicable keys, the held line's text
export function readRulings(text) {
  const mine = {}, notApplicable = {};
  let lang = null, section = null;
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    const h = /^## (isiXhosa|isiZulu) — (.+)$/.exec(line);
    if (h) { lang = h[1] === 'isiXhosa' ? 'xh' : 'zu'; section = h[2]; continue; }
    if (line.startsWith('## ')) { lang = null; section = null; continue; }
    if (!lang) continue;
    if (/^my line instead/.test(section)) {
      const m = /^\| ([a-z_]+\.[a-z-]+\[\d+\]) \| (.+?) \| .* \|$/.exec(line);
      if (m) (mine[lang] ||= {})[m[1]] = m[2].trim();
    } else if (/^not applicable/.test(section)) {
      for (const k of line.match(/[a-z_]+\.[a-z-]+\[\d+\]/g) || []) (notApplicable[lang] ||= new Set()).add(k);
    } else if (/^the held line/.test(section)) {
      const m = /^(hero:[0-9a-f]+): use the judge's "(.+?)"/.exec(line);
      if (m) (mine[`${lang}:held`] = { key: m[1], text: m[2] });
    }
  }
  return { mine, notApplicable };
}

// the rewrites to try, one per FIX row (matched to its draft by English + line: photo keys like "hero:changed" repeat)
function plan() {
  const R = readRulings(fs.readFileSync(rel(RULINGS), 'utf8'));
  for (const lang of Object.keys(LANGS)) {
    const J = JSON.parse(fs.readFileSync(rel('scripts', 'lang-judge', 'data', 'judgments', `october-opus-${lang}.json`), 'utf8'));
    const drafts = readJsonl(rel('lang-packs', lang, 'drafts-2026-10.jsonl'));
    const out = [], skipped = [];
    const mine = R.mine[lang] || {}, na = R.notApplicable[lang] || new Set(), held = R.mine[`${lang}:held`];
    for (const r of J.rows.filter((x) => x.verdict === 'FIX')) {
      const d = drafts.find((x) => x.en === r.en && x[lang] === r.draft);
      if (!d) throw new Error(`${lang} ${r.ref}: no draft carries "${r.draft}" for "${r.en}"`);
      if (na.has(d.key)) { skipped.push({ key: d.key, why: 'not applicable (English cut from the bank)' }); continue; }
      if (r.held && d.key !== held?.key) throw new Error(`${lang} ${d.key}: a held FIX row Maat did not rule on`);
      if (d.key === held?.key && held.text !== r.rewrite) throw new Error(`${lang} ${d.key}: Maat's quote of the judge's line differs from the judge's line`);
      const by = mine[d.key] ? 'maat' : 'judge';
      out.push({ key: d.key, set: d.set, en: d.en, was: d[lang], rewrite: by === 'maat' ? mine[d.key] : r.rewrite, by, heldLine: !!r.held, judge: { speaker: r.speaker, joke: r.joke, reason: r.reason, rewrite: r.rewrite } });
    }
    const unused = Object.keys(mine).filter((k) => !out.some((o) => o.key === k && o.by === 'maat'));
    if (unused.length) throw new Error(`${lang}: Maat's line for ${unused.join(', ')} matches no FIX row`);
    writeJsonl(attemptsFile(lang), out);
    const need = out.filter((o) => !checkV2({ lang, en: o.en, text: o.rewrite }).back).map((o) => ({ lang, text: o.rewrite, en: o.en, key: o.key }));
    const setFile = rel('scripts', 'lang-check', 'data', 'bt', `judge-rewrites-2026-10-12-${lang}.json`);
    fs.writeFileSync(setFile, JSON.stringify(need, null, 1));
    const n = (b) => out.filter((o) => o.by === b && !o.heldLine).length;
    console.log(`${lang}: ${out.length} rewrites — judge ${n('judge')}, Maat ${n('maat')}, held-line attempt ${out.filter((o) => o.heldLine).length}; skipped ${skipped.length} (${skipped.map((s) => s.key).join(', ')}); ${need.length} need a back-translation → ${path.relative(ROOT, setFile)}`);
  }
}

// a checker hold the loan rule lifts: every medium/high finding is a word-level finding on one of Maat's loans — the
// token is a word of a listed loan, with at most a class prefix and a hyphen before it, and the whole phrase is in the
// line the same way (a prefix may be written onto it, as in "IFriendly City"). Words are split on spaces only and lose
// only the punctuation at their edges, so "i.aircon" or "friendly/city" is not a loan form.
// the class and locative prefixes a loan takes in these lines (i-aircon, ii-surfer, ama-fairy lights, kwi-pier, IFriendly City)
const PREFIX = '(?:ii|ama|aba|izi|kwi|nge|ku|i|e|u|ne|na|ka|se|ye)';
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const words = (s) => String(s || '').toLowerCase().trim().split(/\s+/).map((w) => w.replace(/^\p{P}+|\p{P}+$/gu, ''));
const loanWord = (token, text) => {
  const tok = words(token);
  if (tok.length !== 1 || !tok[0]) return false;
  const line = ` ${words(text).join(' ')} `;
  return ACCEPTED_LOANS.some((l) => l.split(' ').some((x) => new RegExp(`^${PREFIX}?-?${esc(x)}$`).test(tok[0]))
    && new RegExp(` ${PREFIX}?-?${esc(l)} `).test(line));
};
export function onlyAcceptedLoans(v) {
  const serious = v.findings.filter((f) => f.severity === 'medium' || f.severity === 'high');
  if (!serious.length) return false;
  return serious.every((f) => (f.check === 'lexical' || f.check === 'semantic') && loanWord(f.token, v.text));
}
// why a back-translation holds a rewrite, or null
export function backHold(back) {
  if (!back) return 'no back-translation record';
  if (ANY.has(back.verdict)) return `back-translation ${back.verdict === 'drift' ? 'drifts' : 'reads it as garbled'} (${back.confidence}): "${back.bt}"${back.note ? ` — ${back.note}` : ''}`;
  if (BAD.has(back.verdict) && (back.confidence ?? 0) >= 0.6) return `back-translation ${back.verdict}: "${back.bt}"`;
  return null;
}
export function gate(lang, o) {
  const v = checkV2({ lang, en: o.en, text: o.rewrite });
  const why = [];
  let loan = false;
  const held = backHold(v.back);
  if (held) why.push(held);
  if (v.action === 'triage-high') {
    if (onlyAcceptedLoans(v)) loan = true;
    else why.push(`checker triage-high ${v.confidence}: ${v.findings.filter((f) => f.severity !== 'low').map((f) => f.message).join(' | ')}`);
  }
  return { v, why, loan };
}

function rewriteArrayLine(lines, group, bin, lang, arr) {
  const condRe = /^    '?([a-z][a-z-]*)'?: \{$/;
  let inGroup = false, cur = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === `  ${group}: {`) { inGroup = true; continue; }
    if (inGroup && line === '  },') { inGroup = false; cur = null; continue; }
    if (!inGroup) continue;
    const ch = condRe.exec(line);
    if (ch) { cur = ch[1]; continue; }
    if (cur !== bin) continue;
    const m = new RegExp(`^(      ${lang}: )\\[.*\\](,?)$`).exec(line);
    if (m) { lines[i] = `${m[1]}[${arr.map((s) => JSON.stringify(s)).join(', ')}]${m[2]}`; return true; }
  }
  return false;
}

function apply() {
  const copyPath = rel('assets', 'weather-copy.js');
  const src = fs.readFileSync(copyPath, 'utf8');
  const EOL = src.includes('\r\n') ? '\r\n' : '\n';
  const lines = src.split(EOL);
  const writes = [];
  for (const lang of Object.keys(LANGS)) {
    const attempts = readJsonl(attemptsFile(lang));
    const draftsPath = rel('lang-packs', lang, 'drafts-2026-10.jsonl');
    const drafts = readJsonl(draftsPath);
    const mfPath = rel('lang-packs', lang, 'provisional-manifest.jsonl');
    const manifest = readJsonl(mfPath);
    const counts = { applied: 0, held: 0, loan: 0 };
    for (const o of attempts) {
      const { v, why, loan } = gate(lang, o);
      o.gate = why.length ? 'held' : 'applied';
      o.why = why;
      o.checker = { action: v.action, confidence: v.confidence };
      o.bt = v.back ? { bt: v.back.bt, verdict: v.back.verdict, confidence: v.back.confidence } : null;
      if (loan && !why.length) o.note = 'loan accepted (judge)'; else delete o.note;
      if (why.length) { counts.held++; continue; }
      const d = drafts.find((x) => x.key === o.key && x.en === o.en && x[lang] === o.was);
      if (!d) throw new Error(`${lang} ${o.key}: the draft no longer carries "${o.was}"`);
      if (o.set === 'debt') {
        // the bank slot that holds the line now, found by English + line (ledger keys can be stale indices)
        let hit = null, hits = 0;
        for (const group of ['witty', 'witty_low_confidence']) for (const [bin, bank] of Object.entries(WEATHER_COPY[group] || {})) {
          (bank.en || []).forEach((en, i) => { if (en === o.en && bank[lang]?.[i] === o.was) { hits++; hit = { group, bin, i, arr: bank[lang] }; } });
        }
        if (hits !== 1) throw new Error(`${lang} ${o.key}: ${hits} bank slots hold "${o.was}" for "${o.en}" — need exactly one`);
        hit.arr[hit.i] = o.rewrite;
        if (!rewriteArrayLine(lines, hit.group, hit.bin, lang, hit.arr)) throw new Error(`${lang} ${o.key}: could not rewrite ${hit.group}.${hit.bin}`);
        const slot = `${hit.group}.${hit.bin}[${hit.i}]`;
        const ruling = `maat-2026-10-12 ${o.by === 'maat' ? 'Maat line' : 'judge rewrite'}`;
        const m = manifest.find((x) => x.key === slot && x[lang] === o.was);
        if (!m && manifest.some((x) => x.key === slot)) throw new Error(`${lang} ${slot}: the manifest holds this slot with another line — reconcile it first`);
        // what the row held before is kept beside it, and a row this round creates is marked, so regate can undo either
        if (m) {
          Object.assign(m, { ...('ruling' in m ? { earlierRuling: m.ruling } : {}), ...('note' in m ? { earlierNote: m.note } : {}), [lang]: o.rewrite, ruling, ...(o.note ? { note: o.note } : {}) });
          if (!o.note) delete m.note;
        } else manifest.push({ key: slot, [lang]: o.rewrite, status: 'provisional-pending-native-confirm', confidence: d.confidence ?? null, en: o.en, source: 'drafts-2026-10', ruling, createdBy: RULINGS, ...(o.note ? { note: o.note } : {}) });
      }
      // a release (10 Oct) lifted a checker hold on the line it replaced, not on this one
      if (d.released) { d.earlierRelease = d.released; delete d.released; }
      Object.assign(d, { [lang]: o.rewrite, ...(d.was ? { earlierWas: d.was } : {}), was: o.was, ...(d.ruling ? { earlierRuling: d.ruling } : {}), ruling: RULINGS, rewrite: o.by, ...(o.note ? { loanAccepted: RULINGS } : {}) });
      counts.applied++;
      if (o.note) counts.loan++;
    }
    writes.push([draftsPath, drafts], [mfPath, manifest], [attemptsFile(lang), attempts]);
    console.log(`${lang}: ${counts.applied} applied (${counts.loan} loan accepted), ${counts.held} held by the gate`);
    for (const o of attempts.filter((x) => x.gate === 'held')) console.log(`  HELD ${o.key} (${o.by}${o.heldLine ? ', held line' : ''}) "${o.rewrite}" — ${o.why.join('; ')}`);
  }
  // every check has passed for both languages: only now is anything written
  for (const [p, rows] of writes) writeJsonl(p, rows);
  fs.writeFileSync(copyPath, lines.join(EOL));
}

// A later ruling can tighten the gate after a round was applied (Maat, 12 Oct 2026: garbled at any confidence). Every
// applied rewrite is gated again; one that now fails gets its previous line back everywhere it was written.
function regate() {
  const copyPath = rel('assets', 'weather-copy.js');
  const src = fs.readFileSync(copyPath, 'utf8');
  const EOL = src.includes('\r\n') ? '\r\n' : '\n';
  const lines = src.split(EOL);
  const writes = [];
  for (const lang of Object.keys(LANGS)) {
    const attempts = readJsonl(attemptsFile(lang));
    const draftsPath = rel('lang-packs', lang, 'drafts-2026-10.jsonl');
    const drafts = readJsonl(draftsPath);
    const mfPath = rel('lang-packs', lang, 'provisional-manifest.jsonl');
    const manifest = readJsonl(mfPath);
    const undone = [];
    for (const o of attempts.filter((x) => x.gate === 'applied')) {
      const { why } = gate(lang, o);
      if (!why.length) continue;
      const d = drafts.find((x) => x.key === o.key && x.en === o.en && x[lang] === o.rewrite);
      if (!d) throw new Error(`${lang} ${o.key}: the draft no longer carries the applied rewrite "${o.rewrite}"`);
      if (o.set === 'debt') {
        const hits = [];
        for (const group of ['witty', 'witty_low_confidence']) for (const [bin, bank] of Object.entries(WEATHER_COPY[group] || {})) {
          (bank.en || []).forEach((en, i) => { if (en === o.en && bank[lang]?.[i] === o.rewrite) hits.push({ group, bin, i, arr: bank[lang] }); });
        }
        if (hits.length !== 1) throw new Error(`${lang} ${o.key}: ${hits.length} bank slots hold "${o.rewrite}" — need exactly one`);
        const [hit] = hits;
        hit.arr[hit.i] = o.was;
        if (!rewriteArrayLine(lines, hit.group, hit.bin, lang, hit.arr)) throw new Error(`${lang} ${o.key}: could not rewrite ${hit.group}.${hit.bin}`);
        const slot = `${hit.group}.${hit.bin}[${hit.i}]`;
        const m = manifest.filter((x) => x.key === slot && x[lang] === o.rewrite);
        if (m.length !== 1) throw new Error(`${lang} ${slot}: ${m.length} manifest rows carry the rewrite — need exactly one`);
        if (m[0].createdBy === RULINGS) manifest.splice(manifest.indexOf(m[0]), 1);
        else {
          m[0][lang] = o.was;
          delete m[0].ruling; delete m[0].note;
          if ('earlierRuling' in m[0]) { m[0].ruling = m[0].earlierRuling; delete m[0].earlierRuling; }
          if ('earlierNote' in m[0]) { m[0].note = m[0].earlierNote; delete m[0].earlierNote; }
        }
      }
      d[lang] = o.was;
      for (const k of ['was', 'ruling', 'rewrite', 'loanAccepted']) delete d[k];
      if (d.earlierWas) { d.was = d.earlierWas; delete d.earlierWas; }
      if (d.earlierRuling) { d.ruling = d.earlierRuling; delete d.earlierRuling; }
      if (d.earlierRelease) { d.released = d.earlierRelease; delete d.earlierRelease; }
      Object.assign(o, { gate: 'held', why, regated: '2026-10-12 (garbled at any confidence)' });
      delete o.note;
      undone.push(o);
    }
    writes.push([draftsPath, drafts], [mfPath, manifest], [attemptsFile(lang), attempts]);
    console.log(`${lang}: ${undone.length} applied rewrite(s) now held — previous line back`);
    for (const o of undone) console.log(`  HELD ${o.key} "${o.rewrite}" → back to "${o.was}" — ${o.why.join('; ')}`);
  }
  // every check has passed for both languages: only now is anything written
  for (const [p, rows] of writes) writeJsonl(p, rows);
  fs.writeFileSync(copyPath, lines.join(EOL));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const cmd = process.argv[2];
  if (cmd === 'plan') plan();
  else if (cmd === 'apply') apply();
  else if (cmd === 'regate') regate();
  else console.log('usage: apply-judge-rewrites.mjs plan | apply (see the header)');
}
