// Wire Al's Afrikaans rulings of 2026-09-23 (Part 2, step 10).
//
//   review/translation-check-ruled.json  — the 77-row translation page: 40 KEEP, 26 CUT, 4 FIX, 7 left
//                                           unmarked with the corrected line in the note
//   review/af-calibration-ruled.json     — the calibration page: 35 GOOD, 5 left unmarked with a
//                                           corrected line in the note (the page said his rating there
//                                           is his ruling for those lines)
//
// KEEP / GOOD: nothing changes. CUT: the line leaves the condition bank in all five languages
// (the page's legend: "remove it; the photo keeps its other lines and a bank slot falls back") via
// scripts/cut-bank-lines.mjs. FIX or a note with the line: his Afrikaans is wired where the line
// lives — the bank cell (bank-set.mjs) and/or the photograph table (review/af-al-decisions.json →
// apply-af-accepted.mjs). FIX with no line in the note gets a proposal on the Afrikaans page and is
// NOT wired.
//
// WIRED TEXT = his words. The only changes are spelling his keyboard dropped, each listed in
// `restored` so the Afrikaans page can show it: the article 'n, the diaeresis and circumflex (reën,
// vroeë, spieël), one typo (daadie → daardie), and a sentence end. Where his note corrects only part of
// the line ("You can say Nie Instagram weer nie."), the rest of the line stays as it was.
//
//   node scripts/translation-skills/apply-af-rulings.mjs [--dry]
//   -> output/translation-skills/af-rulings/{cuts.json,bank-edits.json,summary.json}, and
//      review/af-al-decisions.json gains the photograph rows
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const DRY = process.argv.includes('--dry');
const rd = (p) => JSON.parse(readFileSync(path.join(root, p), 'utf8'));
const data = new Map(rd('review/translation-check-data.json').rows.map((r) => [r.k, r]));
const page = rd('review/translation-check-ruled.json').rulings;
const cal = rd('review/af-calibration-ruled.json').rulings;
const { WEATHER_COPY: W } = await import('../../assets/weather-copy.js');
const { HERO_LINES } = await import('../../assets/hero-lines.js');
const { HERO_LINES_AF } = await import('../../assets/hero-lines-af.js');
const onPhoto = new Set(Object.values(HERO_LINES).flat());

// Al's line for each changed row, exactly as he wrote it in the note, then the wired form.
const LINES = {
  'af-1561': { note: 'Niemand het die voorspelling genooi nie. Dit het net opgedaag.', wired: 'Niemand het die voorspelling genooi nie. Dit het net opgedaag.', restored: [] },
  'af-2023': { note: 'Die dag het nog niks verkeerd gedoen nie. En wil ook nie.', wired: 'Die dag het nog niks verkeerd gedoen nie. En wil ook nie.', restored: [] },
  'af-0327': { note: 'Die son en die wolke speel kat en muis vandag.', wired: 'Die son en die wolke speel kat en muis vandag.', restored: [] },
  'af-0013': { note: 'Die son vat sy tyd vanoggend, en dit is 100% dit werd.', wired: 'Die son vat sy tyd vanoggend, en dit is 100% dit werd.', restored: [] },
  'af-0014': { note: 'Geniet dit. Erens daarbuite is n kouefront besig om planne te maak.', wired: "Geniet dit. Erens daarbuite is 'n kouefront besig om planne te maak.", restored: ["n → 'n"] },
  'af-0194': { note: 'Die son het snooze gedruk.', wired: 'Die son het snooze gedruk.', restored: [] },
  'af-0356': { note: 'Die Karoo het die yskas oornag oopgelos.', wired: 'Die Karoo het die yskas oornag oopgelos.', restored: [] },
  'af-1041': { note: 'Die wolke tjank, iemand kry n tissue asb.', wired: "Die wolke tjank, iemand kry 'n tissue asb.", restored: ["n → 'n"] },
  'af-1567': { note: 'Change last line to Dis vroee Kersfees,', wired: 'In die Karoo is dit nie reën nie. Dis vroeë Kersfees.', restored: ['vroee → vroeë', 'closing comma → full stop', 'first sentence kept as it was'] },
  'af-0188': { note: 'You can say Nie Instagram weer nie.', wired: 'Nie Instagram weer nie. Nie die einde van die wêreld nie.', restored: ['second sentence kept as it was'] },
  'af-0032': { note: 'You can say Die strand is soos n spieel.', wired: "Die strand is soos 'n spieël, en dit vat een oggend van absoluut geen wind nie.", restored: ["n → 'n", 'spieel → spieël', 'rest of the line kept as it was'] },
  'af-1119': { note: 'Die verkeer het pas onthou dat reen bestaan, steeds.', wired: 'Die verkeer het pas onthou dat reën bestaan, steeds.', restored: ['reen → reën'] },
  'af-0967': { note: 'Niemand gaan weer in todat die mure die dag laat gaan het nie.', wired: 'Niemand gaan weer in todat die mure die dag laat gaan het nie.', restored: [] },
  'af-0949': { note: 'Dit het sedert Dinsdag nog nie onder vyf-en-twintig in daadie huis gesak nie.', wired: 'Dit het sedert Dinsdag nog nie onder vyf-en-twintig in daardie huis gesak nie.', restored: ['daadie → daardie'] },
};

const problems = [];
const cuts = [], bankEdits = [], photoRows = [], proposals = [];
const rows = [
  ...page.map((r) => ({ ...r, from: 'translation page', cls: r.verdict || (String(r.note || '').trim() ? 'CORRECTED' : null) })),
  ...cal.map((r) => ({ ...r, text: r.af, from: 'calibration page', cls: r.verdict || (String(r.note || '').trim() ? 'CORRECTED' : null) })),
];
for (const r of rows) {
  if (!r.cls || r.cls === 'KEEP' || r.cls === 'GOOD') continue;
  const d = data.get(r.k);
  if (!d) { problems.push(`${r.k}: not in translation-check-data.json`); continue; }
  const bankIds = (d.where.bank || []).map((id) => { const m = id.match(/^(\w+):([\w-]+)#\d+$/); return { ns: m[1], bin: m[2] }; });
  if (r.cls === 'CUT') {
    if (d.where.kind !== 'bank' || onPhoto.has(d.en)) problems.push(`${r.k}: CUT of a line that is on a photograph — not handled here`);
    for (const b of bankIds) cuts.push({ ns: b.ns, bin: b.bin, en: d.en, k: r.k });
    continue;
  }
  const line = LINES[r.k];
  if (!line) { proposals.push({ k: r.k, en: d.en, af: d.text, note: r.note || '', where: d.where }); continue; }
  if (!String(r.note || '').includes(line.note.replace(/^Change last line to |^You can say /, '').split(' ').slice(0, 3).join(' '))) problems.push(`${r.k}: the recorded note does not match his export`);
  for (const b of bankIds) {
    const bin = W[b.ns][b.bin];
    const i = bin.en.indexOf(d.en);
    if (i < 0 || bin.af[i] !== d.text) { problems.push(`${r.k}: bank ${b.ns}.${b.bin} no longer holds this line`); continue; }
    bankEdits.push({ ns: b.ns, bin: b.bin, en: d.en, lang: 'af', from: d.text, to: line.wired, why: `Al, ${r.from}, ${r.k}` });
  }
  if (onPhoto.has(d.en)) {
    if (HERO_LINES_AF[d.en] !== d.text) problems.push(`${r.k}: the photograph table no longer holds this line`);
    photoRows.push({ id: `AL-0923-${r.k}`, english: d.en, afrikaans: line.wired });
  }
}
if (problems.length) { console.error('[af-rulings] refusing:'); for (const p of problems) console.error(`  - ${p}`); process.exit(1); }

const out = path.join(root, 'output', 'translation-skills', 'af-rulings');
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'cuts.json'), JSON.stringify(cuts.map(({ ns, bin, en }) => ({ ns, bin, en })), null, 1));
writeFileSync(path.join(out, 'bank-edits.json'), JSON.stringify(bankEdits, null, 1));
writeFileSync(path.join(out, 'summary.json'), JSON.stringify({ cuts, bankEdits, photoRows, proposals, lines: LINES }, null, 1));
console.log(`[af-rulings] ${cuts.length} bank cuts, ${bankEdits.length} bank cells, ${photoRows.length} photograph rows, ${proposals.length} FIX without a line (→ Afrikaans page)`);
if (DRY) process.exit(0);
const decFile = path.join(root, 'review', 'af-al-decisions.json');
const dec = existsSync(decFile) ? JSON.parse(readFileSync(decFile, 'utf8')) : { decisions: [] };
const byEn = new Map(dec.decisions.map((d, i) => [d.english, i]));
for (const p of photoRows) {
  if (byEn.has(p.english)) dec.decisions[byEn.get(p.english)] = p; else dec.decisions.push(p);
}
writeFileSync(decFile, JSON.stringify(dec, null, 1));
console.log(`[af-rulings] review/af-al-decisions.json: ${dec.decisions.length} decisions. Next: cut-bank-lines --cuts, bank-set --edits, apply-af-accepted --decisions, generate-copy-splits, build-hero-lines`);
