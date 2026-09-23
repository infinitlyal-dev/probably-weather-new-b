// Inputs for the error taxonomy (Part 2, step 2 — 2026-09-23).
//
// Two populations, classified with one rubric (scripts/translation-skills/RUBRIC.md):
//   FLAGS        the 306 pairs the 2026-09-19 back-translation check flagged
//                (review/translation-check-data.json), with their evidence
//   CORRECTIONS  every human correction in output/translation-skills/feedback.json
//
// Evidence computed here so the classifier does not have to guess it:
//   oldEnglish   earlier English lines that sat at the same bank index
//                (output/translation-skills/en-history.json) and read closer to the blind
//                back-translation than the current English does — the signature of a line
//                translated from an out-of-date English list
//   lesotho      Lesotho-orthography forms in a Sesotho line (Al ruled SA orthography, 2026-09-06)
//
//   node scripts/translation-skills/taxonomy-input.mjs  -> output/translation-skills/taxonomy/*.json
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const rd = (p) => JSON.parse(readFileSync(path.join(root, p), 'utf8'));
const out = path.join(root, 'output', 'translation-skills', 'taxonomy');
mkdirSync(out, { recursive: true });

const data = rd('review/translation-check-data.json');
const history = rd('output/translation-skills/en-history.json').history;
const feedback = rd('output/translation-skills/feedback.json').items;

const STOP = new Set('a an the and or but of to in on at for with by from is are was were be been it its it\'s this that these those there here you your you\'re we our they their he his she her i me my just so very not no too all any some one two up out off over into than then as if about only still even more most what when who which how why do does did have has had will would can could should may might get got go going gone like'.split(' '));
const words = (s) => new Set(String(s).toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).map((w) => w.replace(/'s$/, '').replace(/(ing|ed|es|s)$/, '')).filter((w) => w.length > 2 && !STOP.has(w)));
const overlap = (a, b) => { const A = words(a), B = words(b); if (!A.size || !B.size) return 0; let n = 0; for (const w of A) if (B.has(w)) n += 1; return +(n / Math.min(A.size, B.size)).toFixed(2); };

// Lesotho orthography where South African orthography is the house standard.
const LESOTHO = [
  [/\b(ea|oa|eo|oo)\b/gi, 'ea/oa/eo/oo (SA: ya/wa/yo/wo)'],
  [/tš/gi, 'tš (SA: tsh)'],
  [/\bli(?=[a-zš])/gi, 'li- prefix (SA: di-)'],
  [/'ng/gi, "'ng (SA: ng / nng)"],
  [/\bjoal[eo]\b/gi, 'joale/joalo (SA: jwale/jwalo)'],
  [/\bleholimo\b/gi, 'leholimo (SA: lehodimo)'],
  [/\bmoholi\b/gi, 'moholi (SA: mohodi)'],
  [/\bchesa\b|\bchese\b/gi, 'chesa (SA: tjhesa)'],
  [/\bmoea\b/gi, 'moea (SA: moya)'],
  [/\bhoa\b/gi, 'hoa (SA: hwa)'],
];
const lesothoIn = (text) => {
  const hits = [];
  for (const [re, label] of LESOTHO) { const m = String(text).match(re); if (m) hits.push(`${label} ×${m.length}`); }
  return hits;
};

// THE PARTLY-CLOUDY BIRTH (a3cbfd3, 2026-04-28). The witty banks were first written in
// assets/app.js as parallel arrays, and for partly-cloudy the af/zu/xh/st arrays were never
// translations of the English at their index: zu "Amafu enza i-statement encane" is the
// Afrikaans "Wolke wat 'n statement maak", a line the English list never had. bcf25ca
// (2026-07-02) re-ordered them; a line with no English counterpart could not be fixed by
// re-ordering. So for a bank line the evidence is: where its exact text sat in the arrays it
// was born in, and whether its back-translation matches ANY current English line of its bin.
const birthApp = execFileSync('git', ['show', 'a3cbfd3:assets/app.js'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const born = {};   // bin -> lang -> [lines]
{
  let bin = null;
  for (const line of birthApp.split('\n')) {
    const h = line.match(/^\s+'?([a-z][a-z-]*)'?: \{\s*$/);
    if (h) { bin = h[1]; continue; }
    const a = line.match(/^\s+(en|af|zu|xh|st): (\[.*\]),?\s*$/);
    if (a && bin) { try { (born[bin] ||= {})[a[1]] = JSON.parse(a[2]); } catch { /* not a plain string array */ } }
  }
}
const { WEATHER_COPY } = await import('../../assets/weather-copy.js');

const flags = [];
for (const r of data.rows.filter((x) => x.flagged)) {
  const own = overlap(r.back, r.en);
  const bankId = (r.where?.bank || [])[0];
  let birth;
  if (bankId) {
    const [ns, rest] = bankId.split(':');
    const [bin, idx] = rest.split('#');
    const bornLang = born[bin]?.[r.lang];
    const j = Array.isArray(bornLang) ? bornLang.indexOf(r.text) : -1;
    const enField = WEATHER_COPY[ns]?.[bin]?.en;
    const binEnglish = Array.isArray(enField) ? enField : enField ? [enField] : [];
    const best = binEnglish.map((en) => ({ en, sc: overlap(r.back, en) })).sort((a, b) => b.sc - a.sc)[0];
    birth = {
      bornInApril: j >= 0 ? { index: j, currentIndex: Number(idx), englishThen: born[bin]?.en?.[j], afrikaansThen: born[bin]?.af?.[j] } : undefined,
      bestCurrentEnglishInBin: best && best.sc > own ? best : undefined,
      matchesNoCurrentEnglish: !best || best.sc < 0.34,
    };
  }
  const oldEnglish = [];
  for (const id of r.where?.bank || []) {
    for (const h of history[id] || []) {
      if (h.en === r.en) continue;
      const sc = overlap(r.back, h.en);
      if (sc >= 0.34 && sc > own) oldEnglish.push({ id, en: h.en, heldFrom: h.from, heldTo: h.to, overlap: sc });
    }
  }
  flags.push({
    id: r.k, population: 'flag', lang: r.lang, en: r.en, text: r.text, back: r.back, backNote: r.note || undefined,
    checker: r.verdict, checkerReason: r.reason, ownOverlap: own,
    wrongSource: r.wrongSource || undefined,
    oldEnglish: oldEnglish.length ? oldEnglish.sort((a, b) => b.overlap - a.overlap).slice(0, 3) : undefined,
    birth,
    lesotho: r.lang === 'st' && lesothoIn(r.text).length ? lesothoIn(r.text) : undefined,
    langCheck: r.lc?.findings?.length ? r.lc.findings : undefined,
    where: r.where?.kind === 'photo' ? `photo line (${r.where.slots} slots)` : `bank ${(r.where?.bank || []).join(', ')}`,
  });
}
const corrections = feedback.filter((f) => f.verdict === 'corrected').map((f) => ({
  id: f.id, population: 'correction', lang: f.lang, en: f.en, before: f.before, after: f.after,
  afterSA: f.afterSA, who: f.who, source: f.source,
  lesothoBefore: f.lang === 'st' && lesothoIn(f.before).length ? lesothoIn(f.before) : undefined,
}));

// Batches of at most ~110 items, one language per batch.
const batches = [];
for (const lang of ['af', 'zu', 'xh', 'st']) {
  const all = [...flags.filter((x) => x.lang === lang), ...corrections.filter((x) => x.lang === lang)];
  const size = Math.ceil(all.length / Math.ceil(all.length / 110));
  for (let i = 0, b = 1; i < all.length; i += size, b++) {
    const name = `${lang}-${b}`;
    writeFileSync(path.join(out, `${name}.in.json`), JSON.stringify(all.slice(i, i + size), null, 1));
    batches.push({ name, lang, items: all.slice(i, i + size).length });
  }
}
writeFileSync(path.join(out, 'batches.json'), JSON.stringify(batches, null, 1));
console.log(`[taxonomy] ${flags.length} flags + ${corrections.length} corrections in ${batches.length} batches: ${batches.map((b) => `${b.name} ${b.items}`).join(', ')}`);
console.log(`  flags with an older English line closer than the current: ${flags.filter((f) => f.oldEnglish).length}; Sesotho flags carrying Lesotho forms: ${flags.filter((f) => f.lesotho).length}`);
console.log(`  bank flags whose back-translation matches no current English line of the bin: ${flags.filter((f) => f.birth?.matchesNoCurrentEnglish).length}; of those born in the April arrays (a3cbfd3): ${flags.filter((f) => f.birth?.matchesNoCurrentEnglish && f.birth?.bornInApril).length}`);
