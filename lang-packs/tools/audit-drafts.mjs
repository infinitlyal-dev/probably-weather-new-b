// audit-drafts.mjs — mechanical imbatata pre-screen over the drafts, BEFORE the Codex checker.
// Catches the cheap, certain defects (hard banned tokens = misspellings/wrong-dialect) and warns
// on soft ones (historically misused words). Not a substitute for the cross-family checker — a
// fast first net so obvious defects never reach a human. Also flags drafts that lost their
// code-switched proper nouns and drafts left empty.
//
// Usage: node lang-packs/tools/audit-drafts.mjs [zu|xh|st]

import { readFileSync, existsSync } from 'node:fs';

const only = process.argv[2];
const LANGS = only ? [only] : ['zu', 'xh', 'st'];
let totalHard = 0;

for (const lang of LANGS) {
  const dp = `lang-packs/${lang}/drafts-batch-1.jsonl`;
  const bp = `lang-packs/${lang}/banned-words.json`;
  if (!existsSync(dp)) { console.log(`${lang}: no drafts yet (${dp})`); continue; }
  const drafts = readFileSync(dp, 'utf8').trim().split('\n').filter(Boolean).map((l, i) => {
    try { return JSON.parse(l); } catch { return { __parseError: i + 1, raw: l.slice(0, 80) }; }
  });
  const parseErrors = drafts.filter((d) => d.__parseError);
  const banned = existsSync(bp) ? JSON.parse(readFileSync(bp, 'utf8')) : { hard: [], soft: [] };

  const hardHits = [], softHits = [], empties = [];
  for (const d of drafts) {
    if (d.__parseError) continue;
    const s = (d[lang] || '').toString();
    const low = s.toLowerCase();
    if (s.trim() === '') { empties.push(d.key); continue; }
    for (const b of banned.hard || []) if (low.includes(b.token.toLowerCase())) hardHits.push({ key: d.key, token: b.token, fix: b.fix, text: s });
    for (const b of banned.soft || []) if (new RegExp(`\\b${b.token.toLowerCase()}\\b`).test(low)) softHits.push({ key: d.key, token: b.token, note: b.means || b.issue, text: s });
  }
  totalHard += hardHits.length;
  const conf = drafts.reduce((a, d) => { if (d.confidence) a[d.confidence] = (a[d.confidence] || 0) + 1; return a; }, {});
  console.log(`\n=== ${lang}: ${drafts.length} drafts | confidence ${JSON.stringify(conf)} ===`);
  if (parseErrors.length) console.log(`  JSONL PARSE ERRORS: ${parseErrors.length} (lines ${parseErrors.map((p) => p.__parseError).slice(0, 10).join(',')})`);
  if (empties.length) console.log(`  EMPTY drafts: ${empties.length} (${empties.slice(0, 5).join(', ')})`);
  console.log(`  HARD banned-token hits: ${hardHits.length}`);
  hardHits.slice(0, 20).forEach((h) => console.log(`    ${h.key}: "${h.token}" -> ${h.fix}  |  ${h.text}`));
  console.log(`  SOFT (verify in context): ${softHits.length}`);
  softHits.slice(0, 10).forEach((h) => console.log(`    ${h.key}: "${h.token}" (${h.note})`));
}
if (totalHard > 0) { console.log(`\nHARD hits present (${totalHard}) — fix before the checker pass.`); process.exit(1); }
console.log('\nno hard banned tokens.');
