// The mechanical half of the af-qc skill, run over the whole bespoke AF set.
//
// af-qc is explicit that it is a HEURISTIC checklist, not dictionary-backed: it does not
// call Pharos or the AWS, and it says outright that semantic mismatches — a real Afrikaans
// word in the wrong sense — are not catchable by it and need native review. So this script
// runs only the checks that are genuinely mechanical, and everything it cannot decide goes
// to TRIAGE_NATIVE_REVIEW.md rather than being marked passed.
//
// Checks, from the skill's `check(string, key, context)` procedure:
//   1. identical-to-English (its flag 3 / english-loanword), minus the known shared forms
//   2. length sanity — a suspiciously short AF for a long EN, or a wild expansion
//   3. capitalisation — AF capitalises sentence start and proper nouns only
//   4. untranslated English content words left inside an otherwise AF line
//   5. structural integrity — empty, unbalanced quotes, doubled spaces, missing terminator
//
//   node scripts/af-qc-check.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const work = JSON.parse(fs.readFileSync(path.join(ROOT, 'review/af-worklist.json'), 'utf8'));

const af = new Map();
for (const b of [1, 2, 3, 4]) {
  const doc = JSON.parse(fs.readFileSync(path.join(ROOT, `review/af-batch-${b}.json`), 'utf8'));
  for (const [en, val] of doc.pairs) af.set(en, val);
}
for (const r of work.reuse) af.set(r.text, r.af);

// Proper nouns and forms that are legitimately identical or near-identical in AF.
const SHARED = new Set(['Weber', 'Karoo', 'Bo-Kaap', 'Gqeberha', 'Helderberg', 'NZ', 'Joburg']);
// English function words that should not survive into an AF line.
//
// The skill's rule 5 governs what is NOT in this list: "known legitimate duplicates ...
// shared with English are expected in AF — suppress flag". The first run of this script
// included `wind`, `storm`, `rain`, `sun`, `cloud`, `weather` and flagged 40 lines; every
// one was a false positive, because `wind` and `storm` are ordinary Afrikaans words. Only
// words with no Afrikaans reading belong here.
const ENGLISH_TELLS = /\b(the|and|with|that|this|there|which|because|about|from|they|their|would|could|should|been|were|what|when|where|still|just|only|every|nobody|somebody|anything|something)\b/i;
// Proper nouns, brands and place names that carry a capital mid-sentence in AF.
const PROPER = /^(Kaapse|Kaapstad|Kaap|Kapenaars|Tafelberg|Leeukop|Seinheuwel|Suiderkruis|Melkweg|Noord|Suid|Afrika|Afrikaans|Afrikaanse|Hoëveld|Hoëveldse|Vrystaat|Vrystaatse|Karoo|Joburg|Joburgse|Upington|Sani|Pass|Hill|Silent|Eskom|Instagram|Lotto|Spur|Toyota|Tupperware|Weber|Noag|Rugby|WB|NZ|Gqeberha|Helderberg|Dokter)$/;
// Day and month names take a capital in Afrikaans, singular and plural.
const CALENDAR = /^(Maandag|Dinsdag|Woensdag|Donderdag|Vrydag|Saterdag|Sondag)(e|s)?$|^(Maan|Dins|Woens|Donder|Vry|Sater|Son)dae$|^(Januarie|Februarie|Maart|April|Mei|Junie|Julie|Augustus|September|Oktober|November|Desember)$|^Sondagklere$/;
// Words whose circumflex/diaeresis is load-bearing and is commonly dropped.
const DIACRITIC_TRAPS = [
  [/\bwereld\b/i, 'wêreld'], [/\bmore\b(?!\s*(as|of))/i, 'môre'], [/\bse\b(?=\s*:)/i, 'sê'],
  [/\bhe\b/i, 'hê'], [/\boe\b/i, 'oë'], [/\bsafari\b/i, null],
];

const rows = [];
for (const entry of [...work.fresh, ...work.reuse]) {
  const en = entry.text;
  const value = af.get(en);
  const flags = [];
  if (!value || !value.trim()) {
    flags.push('empty');
  } else {
    if (value.trim() === en.trim()) flags.push('identical-to-english');
    const ratio = value.length / Math.max(1, en.length);
    if (ratio < 0.5) flags.push('suspiciously-short');
    if (ratio > 2.0) flags.push('suspiciously-long');
    // Strip proper nouns before sniffing for English.
    let probe = value;
    for (const s of SHARED) probe = probe.split(s).join(' ');
    if (ENGLISH_TELLS.test(probe)) flags.push('english-word-left-in');
    // Mid-sentence capitals that are not proper nouns or sentence starts. A sentence can
    // start after . ! ? : — or an opening quote, and after the article 'n, which is why the
    // first version of this check flagged "'n Gedokumenteerde een." and every quoted opener.
    const unexplained = [];
    const re = /\b[A-Z][a-zêôîûë]{2,}/g;
    let m;
    while ((m = re.exec(value)) !== null) {
      const word = m[0];
      const before = value.slice(0, m.index);
      const atStart = m.index === 0
        || /[.!?:—-]\s*["'‘“]?\s*$/.test(before)
        || /["'‘“]\s*$/.test(before)
        || /(^|\s)['’]n\s+$/.test(before);
      if (atStart || SHARED.has(word) || PROPER.test(word) || CALENDAR.test(word)) continue;
      unexplained.push(word);
    }
    if (unexplained.length) flags.push(`unexplained-capital:${unexplained.join(',')}`);
    for (const [trap, fix] of DIACRITIC_TRAPS) {
      if (fix && trap.test(value)) flags.push(`missing-diacritic:${fix}`);
    }
    if (/\s{2,}/.test(value)) flags.push('double-space');
    if (!/[.!?]$/.test(value.trim())) flags.push('no-terminator');
    const dq = (value.match(/"/g) || []).length;
    if (dq % 2) flags.push('unbalanced-quote');
  }
  rows.push({ en, af: value || '', condition: entry.condition, time: entry.time, source: entry.af ? 'bank' : 'new', flags });
}

const flagged = rows.filter((r) => r.flags.length);
const byFlag = {};
for (const r of flagged) for (const f of r.flags) {
  const k = f.split(':')[0];
  byFlag[k] = (byFlag[k] || 0) + 1;
}

fs.writeFileSync(path.join(ROOT, 'review/af-qc-report.json'), JSON.stringify({
  generated: '2026-09-06',
  checkedBy: 'af-qc heuristics (NOT dictionary-backed — see the skill header)',
  total: rows.length,
  flaggedCount: flagged.length,
  byFlag,
  flagged,
}, null, 1));

console.log(`af-qc heuristics over ${rows.length} lines (${work.freshCount} new, ${work.reuseCount} reused from the bank)`);
console.log(`  flagged: ${flagged.length}`);
for (const [k, v] of Object.entries(byFlag).sort((a, b) => b[1] - a[1])) console.log(`    ${k}: ${v}`);
for (const r of flagged.slice(0, 15)) console.log(`  · [${r.flags.join(' ')}] ${JSON.stringify(r.af)}`);
console.log('  full report: review/af-qc-report.json');
