// Post-apply verifier / alignment audit for the meme-batch-2 line application.
// Proves: (1) row-alignment holds, (2) every planned new en/af is byte-identical to
// the ruling source at its index, (3) zu/xh/st placeholders are "" at those indices,
// (4) every planned tag is present at its index in witty-day-tags.

import fs from 'node:fs';
import { WEATHER_COPY } from '../../assets/weather-copy.js';
import { WITTY_DAY_TAGS } from '../../assets/witty-day-tags.js';

const audit = JSON.parse(fs.readFileSync('review/line-apply-audit.json', 'utf8'));
const LANGS = ['en', 'af', 'zu', 'xh', 'st'];
let problems = 0;
const fail = (m) => { console.error('  FAIL:', m); problems++; };

for (const [cond, data] of Object.entries(audit.conditions)) {
  const bank = WEATHER_COPY.witty[cond];
  // row alignment
  const lens = LANGS.map((l) => bank[l].length);
  if (new Set(lens).size !== 1) fail(`${cond} misaligned: ${lens.join('/')}`);
  if (bank.en.length !== data.newTotal) fail(`${cond} length ${bank.en.length} != expected ${data.newTotal}`);
  // each new line byte-identical to ruling source
  for (const ln of data.lines) {
    if (bank.en[ln.index] !== ln.en) fail(`${cond}[${ln.index}].en mismatch\n    want: ${JSON.stringify(ln.en)}\n    got:  ${JSON.stringify(bank.en[ln.index])}`);
    if (bank.af[ln.index] !== ln.af) fail(`${cond}[${ln.index}].af mismatch\n    want: ${JSON.stringify(ln.af)}\n    got:  ${JSON.stringify(bank.af[ln.index])}`);
    for (const l of ['zu', 'xh', 'st']) if (bank[l][ln.index] !== '') fail(`${cond}[${ln.index}].${l} not empty debt placeholder: ${JSON.stringify(bank[l][ln.index])}`);
  }
}
// tags present
for (const [cond, tags] of Object.entries(audit.tag_additions)) {
  const live = WITTY_DAY_TAGS.witty[cond] || {};
  for (const [idx, entry] of Object.entries(tags)) {
    const got = live[idx];
    if (!got) { fail(`tag ${cond}[${idx}] missing`); continue; }
    // canonicalize key order — object key order is semantically irrelevant at runtime
    const canon = (o) => JSON.stringify(Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b))));
    if (canon(got) !== canon(entry)) fail(`tag ${cond}[${idx}] mismatch: want ${JSON.stringify(entry)} got ${JSON.stringify(got)}`);
  }
}

const totalNew = Object.values(audit.conditions).reduce((a, d) => a + d.added, 0);
if (problems === 0) console.log(`PASS: ${totalNew} lines verified byte-identical to ruling source; row-alignment intact; ${audit.totals.tagged} tags present.`);
else { console.error(`\n${problems} problems.`); process.exit(1); }
