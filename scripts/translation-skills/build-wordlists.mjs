// Per-language weather word lists for the translation skills (Part 2, step 4 — 2026-09-23).
//
// A SEED list per language — the weather and safety vocabulary the app's lines use — is checked
// against real South African text on disk, term by term:
//   attestation   frequency in the corpora lang-check already holds (NCHLT GOV-ZA, Leipzig
//                 SA web/community/news, the Constitution) — .lang-check-cache/index/<lang>.*
//   autshumato    the government EN<->X word list (CC BY 2.5 ZA) gives the same term
//   bank          the app's native-reviewed bank uses it for that English word (in-house; never
//                 counted as external evidence — it is what is being checked)
// A term is VERIFIED when it is attested in external text (or is a loanword the English itself
// uses). Only verified terms drive the hard safety check in rule-checks.mjs; the rest stay in the
// list, marked, for the skills to use with care.
//
// Sesotho terms are in the South African orthography (Al, 2026-09-06); rules/st-orthography.json
// rejects a Lesotho form at build time.
//
//   node scripts/translation-skills/build-wordlists.mjs  -> scripts/translation-skills/wordlists/<lang>.json
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const here = path.join(root, 'scripts', 'translation-skills');
const cache = path.join(root, '.lang-check-cache');
const ST_RULES = JSON.parse(readFileSync(path.join(here, 'rules', 'st-orthography.json'), 'utf8')).rules.map((r) => new RegExp(r.lesotho));

// ---- the seed: concept -> terms per language --------------------------------------------------
// en: regex over the English; safety: the English is advice a person may act on.
const SEED = [
  { id: 'rain', en: /\brain/i, af: ['reën', 'reent'], zu: ['imvula', 'liyana', 'iyana'], xh: ['imvula', 'iyana', 'liyana'], st: ['pula', 'ya na', 'e a na'] },
  { id: 'drizzle', en: /drizzl/i, af: ['motreën', 'motreent'], zu: ['umkhizo', 'imvula encane'], xh: ['umkhizo', 'imvula encinci'], st: ['serodi', 'pula e nyenyane'] },
  { id: 'storm', en: /\bstorm/i, af: ['storm', 'donderstorm'], zu: ['isiphepho', 'isivunguvungu'], xh: ['isaqhwithi', 'uqhwithela'], st: ['sefefo', 'sefefo sa pula'] },
  { id: 'thunder', en: /thunder/i, af: ['donder', 'donderweer'], zu: ['ukuduma', 'iyaduma', 'izulu liyaduma'], xh: ['iindudumo', 'ududumo', 'uyaduduma'], st: ['seaduma', 'ho duma', 'le a duma'] },
  { id: 'lightning', en: /lightning/i, af: ['weerlig'], zu: ['umbani'], xh: ['umbane'], st: ['lehadima', 'legadima'], safety: true },
  { id: 'hail', en: /\bhail/i, af: ['hael'], zu: ['isichotho', 'isiqhotho'], xh: ['isichotho'], st: ['sefako'], safety: true },
  { id: 'wind', en: /\bwind(y|s)?\b|\bgusts?\b|\bgusty\b|\bbreez/i, af: ['wind', 'windvlaag', 'rukwind', 'windstoot'], zu: ['umoya'], xh: ['umoya'], st: ['moya', 'sefutho'], safety: true },
  { id: 'fog', en: /\bfog|\bmist/i, af: ['mis', 'newel'], zu: ['inkungu'], xh: ['inkungu'], st: ['mohodi'] },
  { id: 'cloud', en: /cloud|overcast/i, af: ['wolk', 'wolke', 'bewolk'], zu: ['amafu', 'ifu'], xh: ['amafu', 'ilifu'], st: ['maru', 'leru'] },
  { id: 'sun', en: /\bsun|sunny/i, af: ['son', 'sonnig'], zu: ['ilanga'], xh: ['ilanga'], st: ['letsatsi'] },
  { id: 'clear', en: /\bclear/i, af: ['helder'], zu: ['kucwebile', 'kuhlanzekile'], xh: ['kucacile', 'kucwebile'], st: ['hlakile', 'ho hlakile'] },
  { id: 'cold', en: /\bcold|chill|freez/i, af: ['koud', 'koue', 'yskoud'], zu: ['makhaza', 'kuyabanda', 'amakhaza'], xh: ['kuyabanda', 'ingqele', 'kubanda'], st: ['ho a bata', 'bata', 'serame', 'mohatsela'] },
  { id: 'frost', en: /frost/i, af: ['ryp'], zu: ['isithwathwa', 'iqhwa'], xh: ['iqabaka'], st: ['serame', 'sethwathwa'] },
  { id: 'snow', en: /\bsnow/i, af: ['sneeu'], zu: ['iqhwa', 'ungqoqwane'], xh: ['ikhephu'], st: ['lehlwa'] },
  { id: 'heat', en: /\bheat\b|\bheatwave|\bhot\b|scorch|swelter/i, af: ['hitte', 'warm', 'snikheet', 'hittegolf', 'skroei'], zu: ['ukushisa', 'kuyashisa', 'shisa', 'ukufudumala'], xh: ['ubushushu', 'kushushu', 'tshisa'], st: ['mocheso', 'ho a tjhesa', 'tjhesa'] },
  { id: 'temperature', en: /temperature|degree/i, af: ['temperatuur', 'grade'], zu: ['izinga lokushisa', 'amazinga okushisa'], xh: ['iqondo lobushushu', 'amaqondo'], st: ['themperetjha', 'dikgerata'] },
  { id: 'forecast', en: /forecast/i, af: ['voorspelling'], zu: ['isibikezelo'], xh: ['uqikelelo'], st: ['ponelopele', 'ponelo-pele'] },
  { id: 'headlights', en: /headlight/i, af: ['koplamp', 'koplampe', 'ligte'], zu: ['izibani', 'izibani zemoto'], xh: ['izibane', 'izibane zemoto'], st: ['mabone', 'mabone a koloi'], safety: true },
  { id: 'sunscreen', en: /sunscreen|\bspf\b|sunblock/i, af: ['sonbrandroom', 'sonskerm', 'sonroom', 'spf'], zu: ['isivikelo selanga', 'ikhrimu yelanga', 'sunscreen', 'spf'], xh: ['ikhrimu yelanga', 'sunscreen', 'spf'], st: ['setlolo sa letsatsi', 'sethibelo sa letsatsi', 'sunscreen', 'spf'], safety: true },
  { id: 'inside', en: /stay (in|inside|indoors|home)|indoors/i, af: ['binne', 'huis toe', 'tuis'], zu: ['ngaphakathi', 'phakathi', 'endlini', 'ekhaya'], xh: ['ngaphakathi', 'endlwini', 'ekhaya'], st: ['ka hare', 'ka tlung', 'ka ntlong', 'lapeng'], safety: true },
  { id: 'flood', en: /\bflood(s|ed|ing|water)?\b/i, af: ['vloed', 'oorstroming', 'oorstroom'], zu: ['izikhukhula', 'isikhukhula', 'uzamcolo'], xh: ['izikhukula', 'isikhukula'], st: ['dikgohola', 'morwallo', 'metsi a matla'], safety: true },
  { id: 'drive', en: /\bdrive|driving|drivers?\b/i, af: ['ry', 'bestuur', 'bestuurders'], zu: ['shayela', 'abashayeli'], xh: ['qhuba', 'abaqhubi'], st: ['kganna', 'bakganni'] },
  { id: 'water', en: /drink water|hydrat/i, af: ['water', 'gehidreer'], zu: ['amanzi'], xh: ['amanzi'], st: ['metsi'], safety: true },
  { id: 'morning', en: /morning|dawn/i, af: ['oggend', 'môre', 'dagbreek'], zu: ['ekuseni', 'kusasa'], xh: ['kusasa', 'intsasa'], st: ['hoseng', 'mafube'] },
  { id: 'evening', en: /evening|dusk/i, af: ['aand', 'skemer'], zu: ['kusihlwa', 'ntambama'], xh: ['ngokuhlwa', 'ngorhatya'], st: ['mantsiboya', 'phirimana', 'thapama'] },
  { id: 'night', en: /\bnight|tonight/i, af: ['nag', 'vanaand'], zu: ['ebusuku', 'ubusuku'], xh: ['ebusuku', 'ubusuku'], st: ['bosiu'] },
  { id: 'today', en: /\btoday/i, af: ['vandag'], zu: ['namuhla', 'namhlanje'], xh: ['namhlanje'], st: ['kajeno'] },
  { id: 'tomorrow', en: /tomorrow/i, af: ['môre'], zu: ['kusasa'], xh: ['ngomso'], st: ['hosane'] },
];

// ---- evidence ------------------------------------------------------------------------------------
const LANG_FILE = { af: 'afrikaans', zu: 'isizulu', xh: 'isixhosa', st: 'sesotho' };
const autsh = {};
for (const [l, name] of Object.entries(LANG_FILE)) {
  const f = path.join(cache, 'sadilar', 'autshumato-wordphrase', 'Autshumato-Multilingual Word & Phrase Translations', `english_${name}.txt`);
  autsh[l] = existsSync(f) ? readFileSync(f, 'utf8').toLowerCase() : '';
}
// Word frequencies from the corpora lang-check compiled (Leipzig *-words.txt: id \t word \t freq).
const freq = {};
const LEIPZIG = { af: ['afr'], zu: ['zul'], xh: ['xho'], st: ['sot'] };
for (const [l, prefixes] of Object.entries(LEIPZIG)) {
  const m = (freq[l] = new Map());
  const dir = path.join(cache, 'leipzig');
  for (const d of existsSync(dir) ? readdirSync(dir, { withFileTypes: true }) : []) {
    if (!d.isDirectory() || !prefixes.some((p) => d.name.startsWith(p))) continue;
    const f = path.join(dir, d.name, `${d.name}-words.txt`);
    if (!existsSync(f)) continue;
    // id \t word \t freq (2018 web corpora) or id \t word \t word \t freq (2017 community): the count is the LAST column.
    for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
      const parts = line.split('\t');
      const w = parts[1]; const n = Number(parts[parts.length - 1]);
      if (w && Number.isFinite(n)) m.set(w.toLowerCase(), (m.get(w.toLowerCase()) || 0) + n);
    }
  }
}
const nchltText = {};
for (const l of Object.keys(LANG_FILE)) {
  const f = path.join(cache, 'text', `constitution-${{ af: 'afr', zu: 'zul', xh: 'xho', st: 'sot' }[l]}.txt`);
  nchltText[l] = existsSync(f) ? readFileSync(f, 'utf8').toLowerCase() : '';
}
// The native-reviewed bank (in-house): not external evidence, but a term a native reviewer let
// stand may carry the safety gate — failing a correct line for its correct word helps nobody.
const reviewedBank = {};
for (const l of Object.keys(LANG_FILE)) {
  const f = path.join(root, 'lang-packs', l, 'corpus-confirmed.jsonl');
  reviewedBank[l] = existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map((x) => String(JSON.parse(x)[l] || '').toLowerCase()).join('\n') : '';
}
const attest = (l, term) => {
  const words = term.toLowerCase().split(/\s+/);
  const counts = words.map((w) => freq[l].get(w) || 0);
  return { leipzig: Math.min(...counts), constitution: words.every((w) => nchltText[l].includes(w)) };
};

const out = path.join(here, 'wordlists');
mkdirSync(out, { recursive: true });
for (const lang of Object.keys(LANG_FILE)) {
  const entries = [];
  const problems = [];
  for (const c of SEED) {
    const terms = (c[lang] || []).map((t) => {
      const a = attest(lang, t);
      const inAutsh = autsh[lang].includes(`\t${t.toLowerCase()}`) || autsh[lang].includes(` ${t.toLowerCase()};`) || autsh[lang].includes(`\t${t.toLowerCase()};`);
      const loan = /^(spf|sunscreen|uv)$/i.test(t);
      if (lang === 'st' && t.split(/\s+/).some((w) => ST_RULES.some((re) => re.test(w)))) problems.push(`st "${t}" breaks the SA orthography rules`);
      const verified = loan || a.leipzig >= 3 || a.constitution || inAutsh;
      const inReviewedBank = reviewedBank[lang].includes(t.toLowerCase());
      return { term: t, leipzigFreq: a.leipzig, inConstitution: a.constitution, inAutshumato: inAutsh, inReviewedBank, verified, safetyEligible: verified || inReviewedBank };
    });
    entries.push({ id: c.id, en: c.en.source, safety: !!c.safety, terms });
  }
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  const safety = entries.filter((e) => e.safety).map((e) => ({ id: e.id, en: e.en, terms: e.terms.filter((t) => t.safetyEligible).map((t) => t.term) })).filter((e) => e.terms.length);
  writeFileSync(path.join(out, `${lang}.json`), JSON.stringify({
    lang, generated: new Date().toISOString().slice(0, 10),
    sources: {
      leipzig: 'Leipzig Corpora Collection word frequencies (CC BY-NC) — South African web, community and news corpora',
      constitution: 'Constitution of the Republic of South Africa, official translation (government publication)',
      autshumato: 'Autshumato multilingual word and phrase lists, CTexT NWU / DAC (CC BY 2.5 ZA)',
    },
    note: 'verified = attested in external South African text (Leipzig frequency >= 3, or the Constitution, or Autshumato) or a loanword the English itself uses. safetyEligible = verified, or used in the native-reviewed bank (in-house, not external evidence): only these drive the hard safety check. Other terms are kept for the skills to use with care.',
    weather: entries, safety,
  }, null, 1));
  const v = entries.flatMap((e) => e.terms).filter((t) => t.verified).length;
  const all = entries.flatMap((e) => e.terms).length;
  console.log(`[wordlists] ${lang}: ${v}/${all} terms verified; safety concepts with a verified term: ${safety.length}/${entries.filter((e) => e.safety).length}; unverified: ${entries.flatMap((e) => e.terms).filter((t) => !t.verified).map((t) => t.term).join(', ') || '-'}`);
}
