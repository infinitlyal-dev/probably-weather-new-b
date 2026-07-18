// Post-apply verifier / alignment audit for the meme-batch-2 line application,
// evolved 2026-07-18 for the provisional language-pack apply.
// Proves: (1) row-alignment holds, (2) every planned new en/af is byte-identical to
// the ruling source at its index, (3) each zu/xh/st slot at those indices is EITHER
// still an empty debt placeholder OR a PROVISIONAL fill recorded in
// lang-packs/<lang>/provisional-manifest.jsonl with a byte-identical value — so no
// slot can be silently filled (not in manifest), silently blanked (manifest says
// filled but bank is empty), or drift from its manifest value,
// (4) every planned tag is present at its index in witty-day-tags.

import fs from 'node:fs';
import { WEATHER_COPY } from '../../assets/weather-copy.js';
import { WITTY_DAY_TAGS } from '../../assets/witty-day-tags.js';

const audit = JSON.parse(fs.readFileSync('review/line-apply-audit.json', 'utf8'));
const LANGS = ['en', 'af', 'zu', 'xh', 'st'];
const readJsonl = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : []);
// provisional-manifest per lang: key -> sanctioned provisional value
const manifest = {};
for (const l of ['zu', 'xh', 'st']) {
  manifest[l] = new Map(readJsonl(`lang-packs/${l}/provisional-manifest.jsonl`).map((r) => [r.key, r[l]]));
}
let problems = 0;
let provisionalFills = 0;
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
    for (const l of ['zu', 'xh', 'st']) {
      const key = `witty.${cond}[${ln.index}]`;
      const slot = bank[l][ln.index];
      const prov = manifest[l].get(key);
      if (slot === '') {
        // still debt — must NOT be recorded as a provisional fill
        if (prov !== undefined && prov !== '') fail(`${cond}[${ln.index}].${l} is empty but manifest records a provisional fill ${JSON.stringify(prov)}`);
      } else {
        // filled — must be a sanctioned provisional fill, byte-identical to the manifest
        if (prov === undefined) fail(`${cond}[${ln.index}].${l} filled ${JSON.stringify(slot)} but NOT in provisional-manifest (silent fill / misalignment)`);
        else if (prov !== slot) fail(`${cond}[${ln.index}].${l} bank/manifest drift\n    manifest: ${JSON.stringify(prov)}\n    bank:     ${JSON.stringify(slot)}`);
        else provisionalFills++;
      }
    }
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

// Comprehensive provisional-fill reconciliation — covers EVERY manifested fill in
// ANY bin (incl. partly-cloudy / witty_low_confidence, which are outside the
// meme-batch-2 audit above). Each manifested fill must (1) sit byte-identical in the
// live bank at its exact key, (2) derive from a real source draft with the same
// value, and (3) be backed by a checker PASS verdict. The manifest, drafts, and
// verdicts are written by three different processes/times, so this is not a
// same-value tautology: a forged, mis-placed, or non-PASS fill cannot rubber-stamp
// the bank.
const parseKey = (k) => { const m = /^([a-z_]+)\.([a-z-]+)\[(\d+)\]$/.exec(k); return m ? { group: m[1], bin: m[2], idx: Number(m[3]) } : null; };
let manifestFills = 0;
for (const l of ['zu', 'xh', 'st']) {
  const draftBy = new Map(readJsonl(`lang-packs/${l}/drafts-batch-1.jsonl`).map((d) => [d.key, d]));
  const verdictBy = new Map(readJsonl(`lang-packs/${l}/checker-verdicts.jsonl`).map((v) => [v.key, v]));
  for (const row of readJsonl(`lang-packs/${l}/provisional-manifest.jsonl`)) {
    const pk = parseKey(row.key);
    if (!pk) { fail(`${l} manifest key unparseable: ${row.key}`); continue; }
    const bank = WEATHER_COPY?.[pk.group]?.[pk.bin]?.[l];
    const slot = Array.isArray(bank) ? bank[pk.idx] : undefined;
    if (slot !== row[l]) fail(`${l} ${row.key}: bank ${JSON.stringify(slot)} != manifest ${JSON.stringify(row[l])}`);
    const d = draftBy.get(row.key);
    if (!d) fail(`${l} ${row.key}: manifested fill has no source draft`);
    else if (d[l] !== row[l]) fail(`${l} ${row.key}: manifest value ${JSON.stringify(row[l])} != source draft ${JSON.stringify(d[l])}`);
    const v = verdictBy.get(row.key);
    if (!v || v.verdict !== 'PASS') fail(`${l} ${row.key}: manifested fill not backed by a PASS verdict (${v ? v.verdict : 'none'})`);
    manifestFills++;
  }
}

const totalNew = Object.values(audit.conditions).reduce((a, d) => a + d.added, 0);
if (problems === 0) console.log(`PASS: ${totalNew} lines verified byte-identical to ruling source; row-alignment intact; ${provisionalFills} audit-bin + ${manifestFills} total provisional fills reconciled bank↔manifest↔draft↔PASS-verdict; ${audit.totals.tagged} tags present.`);
else { console.error(`\n${problems} problems.`); process.exit(1); }
