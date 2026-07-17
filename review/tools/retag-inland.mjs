// Re-tag the region:inland / kzn / eastern-cape lines by CONTENT (owner ruling,
// Layer-1 regional honesty). Test: would the line ring FALSE in coastal Western Cape?
//   - names/evokes a box region (highveld/gauteng/free-state/karoo) -> that box
//   - names/evokes a region with NO box (Lowveld/bushveld/KZN/E.Cape) -> HELD (cannot serve honestly)
//   - genuinely place-free & true in coastal WC -> national (no region tag)
//
// Emits review/inland-retag-audit.json (id -> old tag -> new tag -> justifying phrase).
// Keyed by (condition, en) so it survives the re-index when HELD lines are dropped.

import fs from 'node:fs';

const flagged = JSON.parse(fs.readFileSync('.scratch/flagged-lines.json', 'utf8'));

// Ordered rules — first match wins. `phrase` is the substring that justified it.
// Content-judged overrides the keyword rules can't catch (reviewed line-by-line).
const OVERRIDES = {
  // Watching a storm approach from 50km = inland big-sky; false on the mountainous
  // WC coast. Its concept sibling ("In the Karoo you watch rain like rugby") is Karoo.
  'still fifty kilometres away and the stoep is already sold out': { decision: 'TAG', region: 'karoo', why: 'watching rain approach 50km off — inland big-sky, false in coastal WC', phrase: 'fifty kilometres away' },
};

function classify(en) {
  const t = en.toLowerCase();
  for (const [needle, verdict] of Object.entries(OVERRIDES)) if (t.includes(needle)) return verdict;
  const has = (re) => { const m = t.match(re); return m ? m[0] : null; };
  let p;
  // --- HELD: content names a region with NO gating box ---
  if ((p = has(/lowveld|bushveld|impala/))) return { decision: 'HELD', region: null, why: `no box for '${p}' (Lowveld/bushveld)`, phrase: p };
  if ((p = has(/midlands/))) return { decision: 'HELD', region: null, why: `no box for '${p}' (KZN Midlands)`, phrase: p };
  if ((p = has(/gqeberha|friendly city|windy city|jeffreys/))) return { decision: 'HELD', region: null, why: `no box for '${p}' (Eastern Cape)`, phrase: p };
  // --- explicit box-region names ---
  if ((p = has(/highveld/))) return { decision: 'TAG', region: 'highveld', why: 'names the Highveld', phrase: p };
  if ((p = has(/joburg|johannesburg|pretoria|jozi/))) return { decision: 'TAG', region: 'gauteng', why: `names a Gauteng city ('${p}')`, phrase: p };
  if ((p = has(/free state/))) return { decision: 'TAG', region: 'free-state', why: 'names the Free State', phrase: p };
  if ((p = has(/\bkaroo\b/))) return { decision: 'TAG', region: 'karoo', why: 'names the Karoo', phrase: p };
  if ((p = has(/\bthe berg\b|drakensberg/))) return { decision: 'TAG', region: 'free-state', why: "the Berg — E. Free State highlands", phrase: p };
  if ((p = has(/blesbok/))) return { decision: 'TAG', region: 'free-state', why: 'blesbok — Free State/Highveld grassland', phrase: p };
  // --- climate/culture that rings FALSE in coastal Western Cape ---
  if ((p = has(/frost|windscreen scrap|under ice|dry and freeze|cardboard form|lawn will be glass/))) return { decision: 'TAG', region: 'highveld', why: `frost/ice ('${p}') rings false in coastal WC`, phrase: p };
  if ((p = has(/padstal|windpomp|\bveld\b|aloe/))) return { decision: 'TAG', region: 'karoo', why: `Karoo/inland ('${p}') rings false in coastal WC`, phrase: p };
  // --- place-free & true in coastal WC ---
  return { decision: 'NAT', region: null, why: 'place-free / true in coastal WC', phrase: null };
}

const rows = flagged.map((f) => {
  const c = classify(f.en);
  return { cond: f.cond, index_at_apply: f.index, id: f.id, en: f.en, af: f.af,
    oldTag: f.oldRegionTag, otherTags: f.otherTags, ...c };
});

const tally = {};
rows.forEach((r) => { const k = r.decision === 'TAG' ? r.region : r.decision; tally[k] = (tally[k] || 0) + 1; });

fs.writeFileSync('review/inland-retag-audit.json', JSON.stringify({
  note: 'Layer-1 regional honesty re-tag of region:inland/kzn/eastern-cape lines. Judged by content.',
  test: 'Would the line ring false in coastal Western Cape? If yes and a box fits -> tag it; if yes and no box -> HELD; else national.',
  tally, count: rows.length, rows,
}, null, 2));

console.log('re-tag tally:', tally);
console.log('total:', rows.length);
console.log('wrote review/inland-retag-audit.json');
