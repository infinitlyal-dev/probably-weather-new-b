// review/lines-backtranslation-2026-10.md (Al's brief, 9 Oct 2026, step 4): every drafted line — English | the draft |
// its blind back-translation (Sonnet 5.5) | confidence | verdict — so Maat can reject drift before anything is merged.
//
//   node scripts/lang-check/build-bt-report.mjs [--langs xh]
//
// Verdict column: the rebuilt checker's action (pass / triage / triage-high) and the back-translation's own call
// (same / loose / drift / …, with its confidence). "applied" says whether the line went into the branch as provisional
// (a bank slot filled, or a row in assets/hero-lines-<lang>.js) or was held, and why.

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { checkV2 } from './lib/checker-v2.mjs';
import { WEATHER_COPY } from '../../assets/weather-copy.js';

const ROOT = path.resolve(import.meta.dirname, '../..');
const opt = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const LANGS = opt('--langs', 'xh').split(',');
const NAME = { zu: 'isiZulu', xh: 'isiXhosa', st: 'Sesotho' };
const BAD = new Set(['drift', 'wrong-language', 'untranslated', 'garbled']);
const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const md = ['# Back-translations of the October drafts', '',
  `Built ${new Date().toISOString().slice(0, 10)} by \`scripts/lang-check/build-bt-report.mjs\`. Each draft was written by Claude Opus 5.5 (Vonk) — not a native speaker — then translated back to English blind by a second model (Claude Sonnet 5.5, run as a subagent: it saw only the draft, wrote its English, and only then read the source line and judged). **Maat: strike any line whose back-translation drifts from the English; nothing reaches main without Al's go.**`, '',
  'Confidence is the drafter\'s tag: HIGH = attested words and an idiom I am sure of; MED = structure sound, one word unsure; LOW = a word or construction I could not confirm, or a descriptive phrase standing in for a word I would not coin. Mode "plain" = the joke rests on English wordplay or an SA-English idiom, so the line is a plain warm observation about the same weather instead (the night-line rule).', ''];
for (const lang of LANGS) {
  const drafts = fs.readFileSync(path.join(ROOT, 'lang-packs', lang, 'drafts-2026-10.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  // The photo table as data, so a row counts as applied only under its own English (Sol, 10 Oct 2026: a text search
  // reported a held row as applied when another row had the same translation)
  const tableFile = path.join(ROOT, 'assets', `hero-lines-${lang}.js`);
  const table = fs.existsSync(tableFile) ? (await import(pathToFileURL(tableFile).href))[`HERO_LINES_${lang.toUpperCase()}`] || {} : {};
  const slotHolds = (key, text) => { const m = /^([a-z_]+)\.([a-z-]+)\[(\d+)\]$/.exec(key || ''); return !!m && WEATHER_COPY[m[1]]?.[m[2]]?.[lang]?.[+m[3]] === text; };
  const ledger = fs.readFileSync(path.join(ROOT, 'lang-packs', lang, 'debt-ledger.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const ledgerStatus = (key) => ledger.filter((e) => e.key === key).map((e) => e.status).join(' ');
  const tags = { HIGH: 0, MED: 0, LOW: 0 }; let applied = 0, plain = 0;
  const rows = [];
  for (const d of drafts) {
    const v = checkV2({ lang, en: d.en, text: d[lang] });
    const b = v.back;
    const inTable = Object.prototype.hasOwnProperty.call(table, d.en) && table[d.en] === d[lang];
    const inBank = d.set === 'debt' && slotHolds(d.key, d[lang]);
    const isApplied = d.set === 'debt' ? inBank : inTable;
    if (isApplied) applied++;
    tags[d.tag] = (tags[d.tag] || 0) + 1; if (d.mode === 'plain') plain++;
    const why = !isApplied ? (/held-safety-rule/.test(ledgerStatus(d.key)) ? 'held: a safety line — needs the safety rule record (Claude + Sol) first' : d.slot === 'english-gone' ? 'not applied: the English line was cut from the bank' : d.slot === 'slot-filled' ? 'not applied: the slot already holds a line' : v.action === 'triage-high' ? 'held: checker triage-high' : b && BAD.has(b.verdict) && b.confidence >= 0.6 ? `held: back-translation ${b.verdict}` : !b ? 'held: no back-translation' : 'held') : 'applied';
    rows.push(`| ${cell(d.key)} | ${cell(d.en)} | ${cell(d[lang])} | ${cell(b ? b.bt : '—')} | ${d.tag}${d.mode === 'plain' ? ' · plain' : ''} | ${v.action} · BT ${b ? `${b.verdict} ${b.confidence}` : 'none'} | ${why} |`);
  }
  md.push(`## ${NAME[lang]} — ${drafts.length} drafts`, '', `HIGH ${tags.HIGH} · MED ${tags.MED} · LOW ${tags.LOW} · plain observations ${plain} · applied as provisional ${applied}, held ${drafts.length - applied}.`, '');
  md.push('| key | English | draft | back-translation (blind) | confidence | verdict | applied |', '|---|---|---|---|---|---|---|', ...rows, '');
}
fs.writeFileSync(path.join(ROOT, 'review', 'lines-backtranslation-2026-10.md'), md.join('\n'));
console.log('wrote review/lines-backtranslation-2026-10.md');
