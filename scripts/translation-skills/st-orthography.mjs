// Sesotho: South African orthography as a HARD spelling check, built from evidence
// (Part 2, step 4 — 2026-09-23). Al ruled SA orthography on 2026-09-06.
//
// Each candidate rule pairs a Lesotho spelling with its South African one. It is counted
// (per million words) in text that is South African by provenance —
//   NCHLT Sesotho, GOV-ZA (government websites; CC BY 2.5 ZA, CTexT/DAC)
//   Constitution of the Republic of South Africa, official Sesotho text (government publication)
//   Leipzig sot-za_web_2018_10K (sites under .za; CC BY-NC)
// — and in st.wikipedia (CC BY-SA 4.0), which is written largely in the Lesotho orthography.
// A rule is KEPT (and becomes a hard check) only when government text is unambiguous — the
// Lesotho form is rare in NCHLT and the Constitution, the SA form attested there — and the .za
// web corpus agrees: the corpora decide, not a list someone typed.
//
//   node scripts/translation-skills/st-orthography.mjs  -> scripts/translation-skills/rules/st-orthography.json
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const C = (...p) => path.join(root, '.lang-check-cache', ...p);
const read = (p) => readFileSync(p, 'utf8');
const tokens = (text) => text.toLowerCase().replace(/’/g, "'").match(/[a-zšê'-]+/g) || [];

const nchlt = read(C('nchlt', 'st.lemma.GOV-ZA.50000ParallelleEnWoorde.st.lemma.full.data'))
  + read(C('nchlt', 'st.lemma.GOV-ZA.Toetsteks.5000ParallelleEnWoorde.st.lemma.full.data'));
const sources = {
  'NCHLT GOV-ZA': tokens(nchlt.replace(/<[^>]+>/g, ' ')),
  'Constitution (SA)': tokens(read(C('text', 'constitution-sot.txt'))),
  'Leipzig sot-za web': tokens(read(C('leipzig', 'sot-za_web_2018_10K', 'sot-za_web_2018_10K-sentences.txt')).replace(/^\d+\t/gm, '')),
  'st.wikipedia': tokens(read(C('text', 'wiki-st.txt'))),
};
const SA = ['NCHLT GOV-ZA', 'Constitution (SA)', 'Leipzig sot-za web'];

// Candidates: [id, Lesotho matcher, SA matcher, description, example]
const CANDIDATES = [
  ['ea→ya', /^ea$/, /^ya$/, 'possessive/relative "ea" is written "ya"', 'lehodimo ya → not "ea"'],
  ['oa→wa', /^oa$/, /^wa$/, 'possessive/relative "oa" is written "wa"', 'moya wa → not "oa"'],
  ['eo→yo', /^eo$/, /^yo$/, 'demonstrative/relative "eo" is written "yo"', ''],
  ['tš→tsh', /tš/, /tsh/, '"tš" is written "tsh"', 'tshepa, not tšepa'],
  ['li-→di-', /^li[bcdfghjklmnpqrstvwxyz]/, /^di[bcdfghjklmnpqrstvwxyz]/, 'class 8/10 prefix "li-" is written "di-"', 'dipula, not lipula'],
  ["'n→n", /^'n/, /^nn/, "the apostrophe forms ('nete, 'ngoe) are written without it (nnete, nngwe)", "nnete, not 'nete"],
  ['joale→jwale', /^joal[eo]$/, /^jwal[eo]$/, '"joale/joalo" are written "jwale/jwalo"', 'jwale, jwalo'],
  ['-oe-→-we-', /oe/, /we/, '"oe" (ngoe, hoeng) is written "we" (ngwe, hweng)', "nngwe, not 'ngoe"],
  ['moea→moya', /^moea$/, /^moya$/, '"moea" (wind, spirit) is written "moya"', 'moya'],
  ['ch-→tjh-', /^ch/, /^tjh/, '"ch" is written "tjh"', 'tjhesa, not chesa'],
  ['holimo→hodimo', /holimo/, /hodimo/, 'l before i/u is written d (lehodimo, not leholimo)', 'lehodimo'],
  ['moholi→mohodi', /^moholi$/, /^mohodi$/, '"moholi" (mist) is written "mohodi"', 'mohodi'],
  ['lu→du', /^lu[a-z]/, /^du[a-z]/, 'word-initial "lu" is written "du" (dumela, not lumela)', 'dumela'],
  // Narrower forms of the broad candidates the corpora reject ("oe" also sits inside SA words such as boemo; "ch" in loans).
  ['tsoa→tswa', /^tsoa/, /^tswa/, '"tsoa/tsoang" is written "tswa/tswang"', 'ho tswa'],
  ['ngoe→ngwe', /^n?ngoe$/, /^n?ngwe$/, '"ngoe/nngoe" is written "ngwe/nngwe"', 'nngwe'],
  ['chesa→tjhesa', /^(chesa|chese|chesang)$/, /^(tjhesa|tjhese|tjhesang)$/, '"chesa" (hot) is written "tjhesa"', 'ho a tjhesa'],
  ['uena→wena', /^uena$/, /^wena$/, '"uena" (you) is written "wena"', 'wena'],
  ['u→o (you)', /^u$/, /^o$/, 'the 2nd-person concord "u" is written "o"', 'o a tseba'],
  // Added 2026-09-23: the re-spelling of the live bank left hybrids like "Difensetere li kwetswe"
  // (the class 8/10 prefix re-spelled, its concord not). The corpora decide these the same way.
  ['li→di (concord)', /^li$/, /^di$/, 'the class 8/10 concord "li" is written "di"', 'di a tla'],
  ['eona→yona', /^eona$/, /^yona$/, '"eona" (it, class 9) is written "yona"', 'ka yona'],
  ['eena→yena', /^eena$/, /^yena$/, '"eena" (he, she) is written "yena"', 'yena'],
  ['oona→wona', /^oona$/, /^wona$/, '"oona" (it, class 3/6) is written "wona"', 'wona'],
  ['-ile→-ile (no change)', /^$/, /^$/, 'control: must be dropped', ''],
];
const perMillion = (arr, re) => { let n = 0; for (const t of arr) if (re.test(t)) n += 1; return +(n * 1e6 / arr.length).toFixed(1); };
const rules = [];
const table = [];
for (const [id, les, sa, what, example] of CANDIDATES) {
  const row = { id, what };
  for (const [name, toks] of Object.entries(sources)) row[name] = { lesotho: perMillion(toks, les), sa: perMillion(toks, sa) };
  // KEEP when government text is unambiguous — in NCHLT GOV-ZA and the Constitution the Lesotho
  // form is at most 5% of the SA form, and the SA form is attested in at least one of them — and
  // the .za web corpus agrees that the SA form dominates (Lesotho under half of it). The web
  // corpus is supporting evidence only: some .za pages are written in the Lesotho orthography.
  const GOV = ['NCHLT GOV-ZA', 'Constitution (SA)'];
  const govAttested = GOV.some((s) => row[s].sa > 0);
  const govClean = GOV.every((s) => row[s].lesotho <= 0.05 * Math.max(row[s].sa, 1));
  const webAgrees = row['Leipzig sot-za web'].lesotho < 0.5 * Math.max(row['Leipzig sot-za web'].sa, 1);
  const keep = govAttested && govClean && webAgrees;
  row.verdict = keep ? 'KEEP' : 'DROP';
  table.push(row);
  if (keep) rules.push({ id, lesotho: les.source, sa: sa.source, what, example, evidence: Object.fromEntries(Object.entries(sources).map(([n]) => [n, row[n]])) });
}
const outDir = path.join(root, 'scripts', 'translation-skills', 'rules');
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'st-orthography.json'), JSON.stringify({
  generated: new Date().toISOString().slice(0, 10),
  ruling: 'Al, 2026-09-06: Sesotho in the South African orthography',
  corpusSizes: Object.fromEntries(Object.entries(sources).map(([n, t]) => [n, t.length])),
  licences: { 'NCHLT GOV-ZA': 'CC BY 2.5 ZA (CTexT NWU / DAC)', 'Constitution (SA)': 'Government publication (justice.gov.za)', 'Leipzig sot-za web': 'CC BY-NC (Leipzig Corpora Collection)', 'st.wikipedia': 'CC BY-SA 4.0' },
  rules,
  dropped: table.filter((r) => r.verdict === 'DROP').map((r) => r.id),
}, null, 1));
console.log(`corpus words: ${Object.entries(sources).map(([n, t]) => `${n} ${t.length}`).join(' · ')}`);
console.log('per million words: Lesotho form / SA form');
for (const r of table) console.log(`${r.verdict.padEnd(4)} ${r.id.padEnd(22)} ${Object.keys(sources).map((n) => `${n.split(' ')[0]} ${r[n].lesotho}/${r[n].sa}`).join(' | ')}`);
