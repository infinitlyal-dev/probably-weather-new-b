// The corpus-backed checker. One entry point: check({ lang, en, text, siblings }) → verdict.
//
// Four passes, each emitting findings with evidence that cites the corpus hit:
//   (a) lexical       — every content word looked up in the language index (lemma lists,
//                       dictionaries, corpora); unknown words get a closest-match suggestion;
//                       SA loans (bakkie, braai, hadeda…) are recognised through the Afrikaans
//                       and English indexes; the lang-pack banned-word lists (native rulings)
//                       are applied here too
//   (b) morphological — Nguni/Sotho noun-class ↔ concord agreement (unambiguous concords only),
//                       fused word boundaries, Afrikaans diacritics, double negation,
//                       weekday abbreviations and capitalisation
//   (c) semantic      — glosses of the target words back-translated and compared with the
//                       English source through a weather-domain synonym table; a time-of-day
//                       mismatch rule (today ≠ tonight); dictionary-expected target words
//                       checked for presence; a near-miss rule for a real word a letter or two
//                       from the expected one (imvu/imvula); collocation evidence from the
//                       Leipzig co-occurrence tables
//   (d) contamination — words attested only in a sibling language (zu↔xh, tn/nso/zu/xh→st,
//                       nl→af) or only in English, with cognate awareness: a Nguni word missing
//                       from the thin Xhosa corpus but present in the Zulu one is weak evidence
//
// Attestation that comes only from Probably Weather's own copy banks ('inhouse') is reported but
// does not count as external evidence — the banks are what is being checked.
//
// Confidence is a sum of evidence weights, capped at 1. It is confidence that the line has a
// problem, never confidence in a fix. Nothing here auto-applies anything.

import fs from 'node:fs';
import path from 'node:path';
import { tokenize, normalizeWord, enContentWords, enStem, editDistance, EN_STOP } from './text.mjs';
import { ROOT, INDEX_DIR, CACHE, SRC, SRC_NAMES } from './build-index.mjs';

const indexCache = new Map();
const leipzigSentences = new Map();
const EXTERNAL = ~SRC.inhouse;

export class LangIndex {
  constructor(lang) {
    const file = path.join(INDEX_DIR, `${lang}.json`);
    if (!fs.existsSync(file)) throw new Error(`index for ${lang} not built — run: node scripts/lang-check.mjs --build-index ${lang}`);
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    Object.assign(this, raw);
    this.lang = lang;
    this.buckets = new Map();
    this.suffix = new Map();
    for (const w of Object.keys(this.words)) {
      if ((this.words[w][1] & EXTERNAL) === 0) continue;
      const k = w.slice(0, 2);
      let b = this.buckets.get(k); if (!b) { b = []; this.buckets.set(k, b); }
      b.push(w);
      if (w.length >= 7) { const s = w.slice(-6); let arr = this.suffix.get(s); if (!arr) { arr = []; this.suffix.set(s, arr); } arr.push(w); }
    }
    const bannedFile = path.join(ROOT, 'lang-packs', lang, 'banned-words.json');
    this.banned = fs.existsSync(bannedFile) ? JSON.parse(fs.readFileSync(bannedFile, 'utf8')) : { hard: [], soft: [] };
    // words a native or Al has ruled correct count as attested (with the ruling cited)
    this.allow = new Map((this.banned.allow || []).map((a) => [a.token.toLowerCase(), a.why || 'ruled correct']));
  }
  static load(lang) {
    if (!indexCache.has(lang)) indexCache.set(lang, new LangIndex(lang));
    return indexCache.get(lang);
  }
  has(w) { const e = this.words[w]; return !!e && (e[1] & EXTERNAL) !== 0; }
  inhouseOnly(w) { const e = this.words[w]; return !!e && (e[1] & EXTERNAL) === 0; }
  freq(w) { return this.words[w] ? this.words[w][0] : 0; }
  entry(w) { return this.has(w) ? { freq: this.words[w][0], src: this.words[w][1], sources: srcNames(this.words[w][1] & EXTERNAL) } : null; }
  lemmasOf(w) { return this.form2lemma[w] || (this.lemmas[w] ? [w] : []); }
  glosses(w) {
    const out = [];
    for (const g of this.l2en[w] || []) if (!out.includes(g)) out.push(g);
    for (const l of this.lemmasOf(w)) for (const g of this.l2en[l] || []) if (!out.includes(g)) out.push(g);
    return out;
  }
  closest(w, max = 2) {
    if (w.length < 3) return null;
    const firsts = new Set([w.slice(0, 2)]);
    if (w.length > 2) firsts.add(w[0] + w[2]);
    for (const b of this.buckets.keys()) if (b[0] === w[0]) firsts.add(b);
    let best = null;
    for (const k of firsts) {
      for (const c of this.buckets.get(k) || []) {
        if (Math.abs(c.length - w.length) > max) continue;
        const d = editDistance(w, c, max);
        if (d > max) continue;
        const f = this.words[c][0];
        if (!best || d < best.d || (d === best.d && f > best.freq)) best = { word: c, d, freq: f, sources: srcNames(this.words[c][1] & EXTERNAL) };
      }
    }
    return best;
  }
  stemMatch(rem) {
    if (rem.length < 6) return null;
    for (const w of this.suffix.get(rem.slice(-6)) || []) {
      if (w.endsWith(rem) && w.length - rem.length <= 4 && this.words[w][0] >= 2) return w;
    }
    return null;
  }
  example(w) {
    const refs = this.ex[w] || [];
    for (const [corpus, i] of refs) {
      if (corpus === 'inhouse') continue;
      if (corpus.startsWith('L:')) {
        const name = corpus.slice(2);
        const s = leipzigSentence(name, i);
        if (s) return { source: `Leipzig ${name} #${i}`, text: s };
      } else {
        const s = this.sentences[corpus]?.[i];
        if (s) return { source: `${corpus} #${i}`, text: s };
      }
    }
    return null;
  }
  colloc(a, b) {
    const hit = (this.co[a] || []).find((x) => x[0] === b) || (this.co[b] || []).find((x) => x[0] === a);
    return hit ? hit[1] : null;
  }
}
function leipzigSentence(corpus, id) {
  if (!leipzigSentences.has(corpus)) {
    const file = path.join(CACHE, 'leipzig', corpus, `${corpus}-sentences.txt`);
    const m = new Map();
    if (fs.existsSync(file)) for (const line of fs.readFileSync(file, 'utf8').split('\n')) { const t = line.indexOf('\t'); if (t > 0) m.set(parseInt(line.slice(0, t), 10), line.slice(t + 1)); }
    leipzigSentences.set(corpus, m);
  }
  return leipzigSentences.get(corpus).get(id) || null;
}
function srcNames(mask) { const out = []; for (const [bit, name] of Object.entries(SRC_NAMES)) if (mask & bit) out.push(name); return out; }
const fmtFreq = (e) => e.freq > 0 ? `${e.freq}× ${e.sources.join('/')}` : e.sources.join('/');

// ---------- language knowledge (small, hand-written; the corpora carry the rest) ----------
const STOP = {
  zu: 'na no ne ku ka la le lo lokhu lokho leyo lezi lezo uma ukuthi futhi kodwa noma nje kakhulu kancane lapho lapha khona phela impela cishe yebo cha ngoba ngenxa kanye nakuba kuze ukuze ngaphandle ngaphakathi kuphela wonke bonke zonke yonke lonke konke nawe mina wena thina nina bona yena ngi u si ni ba i li a kwa ke nga kuwe kuye kubo kuzo kuyo kulo ngalo ngayo ngazo ngabo kunye nokuthi nokho kanti mhlawumbe akukho kukhona kwakukhona njalo leli lesi lesiya lena leso lokhuya lolu lolo lobu ngu yi ngo nge ngezi ngaba ngama ngisho',
  xh: 'na no ne ku ka la le lo oku oko ezi ezo xa ukuba kwakhona kodwa okanye qha kakhulu kancinci apho apha khona ewe hayi kuba ngenxa kunye nangona kude ukuze ngaphandle ngaphakathi kuphela onke bonke zonke yonke lonke konke nawe mna wena thina nina bona yena ndi u si ni ba i li a kwa ke nga kuwe kuye kubo kuzo kuyo kulo ngalo ngayo ngazo ngabo loo lowo esi eso into ngoko noko mhlawumbi akukho kukho kukhona njalo eli olu obu eziya ngu yi ngo nge ngezi ngaba ngama nditsho',
  st: 'le la ya ea wa oa ba sa tsa a e o ho ha ka ke hore empa kapa feela haholo hanyane joale jwale joalo jwalo mona moo teng ee che hobane ntle kahare fela kaofela bohle tsohle ohle wena nna rona lona bona yena ena re u di li se eo ona tse tsena tseo sena seo mang eng neng kae jwang joang eno tsee tseno hape hle ntse ile tla tlo ne hase eseng eona ona',
  af: "die 'n n en van is in op nie dit jy jou ek my ons hulle hy sy dat wat wie waar hoe as maar of want om te na met vir by tot oor uit aan af so ook nog al net dan nou hier daar wel was het sal kan moet mag wil gaan kom word wees baie meer min elke alle geen iets niks iemand niemand ja nee se haar hom hul julle u dis daai hierdie daardie een twee drie wanneer terwyl omdat sodat dus toe reeds weer nooit altyd tog sommer eintlik amper heeltemal regtig darem mos glo seker self selfs",
};
const STOPSETS = Object.fromEntries(Object.entries(STOP).map(([k, v]) => [k, new Set(v.split(/\s+/))]));
const GLOSS_STOP = new Set([...EN_STOP, 'under', 'over', 'above', 'below', 'behind', 'between', 'through', 'against', 'toward', 'towards', 'inside', 'outside', 'near', 'along', 'across', 'within', 'without', 'until', 'while', 'during', 'among', 'per', 'via', 'onto', 'upon', 'off', 'up', 'down', 'out', 'in', 'on', 'at', 'to', 'of', 'by', 'for', 'with', 'from', 'about', 'infinitive', 'plural', 'singular', 'form', 'class', 'noun', 'verb', 'adjective', 'prefix', 'suffix', 'concord', 'person', 'thing', 'things', 'something', 'someone', 'used', 'use', 'very', 'really', 'quite', 'only', 'also', 'again', 'still', 'even', 'well', 'big', 'small', 'many', 'much', 'more', 'most', 'other', 'another', 'same', 'such', 'so', 'as', 'then', 'than', 'now', 'here', 'there', 'where', 'when', 'what', 'which', 'who', 'that', 'this', 'these', 'those', 'not', 'no', 'yes', 'be', 'is', 'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'done', 'go', 'come', 'make', 'get', 'take', 'give', 'put', 'let', 'say', 'said', 'see', 'seen', 'look', 'one', 'it', 'particle', 'interrogative', 'indicates', 'placed', 'end', 'sentence', 'question']);
// SA interjections and register words that are not in any dictionary but are the voice
const INTERJECTIONS = new Set('eish yhuu yho yhoo haibo hayibo hawu jislaaik jinne jirre sjoe ag yoh eina aikona awe shame lekker boet bru sharp kwaai ja nee yebo yassis yoh hhayi hawu ncooo mzansi braai braaivleis bakkie stoep koue tjommie tjom jol lus voetsek lapa lekkerder'.split(' '));

// Weather-domain English synonym clusters: a gloss on one side and a source word on the other
// count as the same sense when they fall in the same cluster.
const SYN_CLUSTERS = [
  'cold chilly chill cool cooler freezing icy frost frosty frozen brr', 'hot warm heat heatwave boiling scorching sweltering burning', 'rain rainy raining wet damp shower showers drizzle drizzly pour pouring soaked soak', 'wind windy gusty gust gusts breeze breezy blow blowing blustery gale', 'cloud clouds cloudy overcast grey gray cover', 'sun sunny sunshine clear bright shine shining pleasant fine nice lovely', 'storm stormy thunder thunderstorm lightning severe rough', 'fog foggy mist misty haze hazy visibility', 'night evening tonight dark late', 'morning dawn early sunrise', 'day today daytime afternoon noon', 'snow ice hail sleet', 'sky heaven heavens weather conditions condition climate', 'strong powerful heavy hard mighty', 'nice pleasant lovely good great fine beautiful pretty stunning', 'bad severe terrible awful nasty ugly evil', 'possible maybe might probably likely perhaps chance possibly', 'high up above top higher', 'low down below lower', 'coming arriving arrive here incoming rolling approaching', 'stay remain inside indoors home', 'braai barbecue grill grilling', 'car bakkie vehicle', 'washing laundry clothes', 'blanket duvet bed', 'coffee tea kettle', 'dog hound', 'tomorrow next later', 'partly slightly somewhat bit little partial',
].map((s) => s.split(' '));
const SYN = new Map();
SYN_CLUSTERS.forEach((c, i) => c.forEach((w) => SYN.set(enStem(w), i)));
// time-of-day words: a gloss in one cluster against a source word in another is the documented
// badge bug (today for tonight, morning for tomorrow)
const TIME = new Map();
[['night evening tonight'], ['morning dawn sunrise'], ['day today daytime afternoon noon'], ['tomorrow'], ['yesterday'], ['week weekend']].forEach((c, i) => c[0].split(' ').forEach((w) => TIME.set(enStem(w), i)));

const MARKERS = {
  zu: { xh: ['ukuba', 'ngoku', 'apho', 'ewe', 'hayi', 'njani', 'kwakhona', 'ndiya', 'ndi', 'imozulu', 'qha', 'ingaba', 'ukutya', 'kushushu', 'loo', 'mhlawumbi', 'kancinci', 'phantsi', 'xa', 'ndiyazi', 'andazi', 'ndifuna', 'ngoko', 'ngomso', 'ilizwe', 'ixesha', 'okanye', 'nangona', 'emva', 'phambi'] },
  xh: { zu: ['ukuthi', 'manje', 'lapho', 'yebo', 'cha', 'kanjani', 'futhi', 'ngiya', 'ngi', 'izulu', 'kanti', 'phela', 'impela', 'nokho', 'ukudla', 'kushisa', 'namuhla', 'mhlawumbe', 'kancane', 'phansi', 'uma', 'ngoba', 'ngiyazi', 'angazi', 'ngifuna', 'izwe', 'umuzi', 'isikhathi', 'noma', 'ngemuva', 'ngaphambi'] },
  st: { tn: ['gore', 'go', 'gape', 'jaanong', 'gompieno', 'bosigo', 'fela', 'thata', 'gona', 'sentle', 'mme', 'legodimo', 'ga', 'mosong', 'phefo', 'dilo', 'jaaka', 'fa', 'tlhe', 'bua', 'tsamaya', 'tsididi', 'mogote', 'gotlhe', 'letšatši', 'jalo', 'bone', 'gongwe'], nso: ['gore', 'ga', 'bjalo', 'lehono', 'gomme', 'šoma', 'mošomo', 'tšea', 'tšhelete', 'bjale', 'gape', 'go', 'fela', 'mmele', 'letšatši', 'bošego', 'fase', 'godimo', 'yeo', 'tše'], zu: ['hlonipha', 'ukuthi', 'manje', 'futhi', 'kakhulu', 'imvula', 'ilanga', 'umoya', 'namuhla', 'namhlanje', 'ngoba', 'kodwa'], xh: ['hlonipha', 'ukuba', 'ngoku', 'kakhulu', 'imvula', 'ilanga', 'umoya', 'namhlanje', 'kodwa'] },
  af: { nl: ['niet', 'ik', 'wij', 'vandaag', 'morgen', 'regen', 'wolken', 'lucht', 'avond', 'nacht', 'zon', 'zij', 'zijn', 'tijd', 'mijn', 'jouw', 'nu', 'veel', 'beetje', 'altijd', 'nooit', 'zeker', 'natuurlijk', 'eigenlijk', 'misschien', 'heel', 'erg', 'straks', 'buiten', 'binnen', 'het'] },
};
const NL_SHAPES = [/ij/, /^z(?!ebra|oeloe|ulu|ambia|oem|one|ink|ero)/, /ch(?!e|ina|oc|ips)/, /lijk$/, /sch(?!e)/];
const CORE_EN = { default: new Set('rain sun wind cloud clouds cold hot night morning day sky fog weather today tonight tomorrow storm snow thunder lightning warm cool wet dry hail mist frost sunny cloudy rainy windy'.split(' ')), af: new Set('rain sun cloud clouds cold hot night morning sky fog weather today tonight tomorrow snow thunder lightning wet dry hail mist frost sunny cloudy rainy windy'.split(' ')) };

const NGUNI_SC = { '1': ['u'], '1a': ['u'], '2': ['ba'], '2a': ['ba'], '3': ['u'], '4': ['i'], '5': ['li'], '6': ['a'], '7': ['si'], '8': ['zi'], '9': ['i'], '10': ['zi'], '11': ['lu'], '14': ['bu'], '15': ['ku'] };
const NGUNI_SC_UNAMBIGUOUS = new Set(['ba', 'li', 'si', 'zi', 'lu', 'bu']);
const NGUNI_CLASS_PREFIX = { '1': /^umu?/, '1a': /^u/, '2': /^ab[ae]/, '2a': /^o/, '3': /^umu?/, '4': /^imi/, '5': /^i(li)?/, '6': /^ama/, '7': /^isi?/, '8': /^izi?/, '9': /^i[nm]?/, '10': /^izi[nm]?|^iz/, '11': /^u(lu)?/, '14': /^ubu/, '15': /^uku/ };
const SOTHO_SC = { '1': ['o'], '1a': ['o'], '2': ['ba'], '2a': ['ba'], '3': ['o'], '4': ['e'], '5': ['le'], '6': ['a'], '7': ['se'], '8': ['di', 'li'], '9': ['e'], '10': ['di', 'li'], '14': ['bo'], '15': ['ho'], '17': ['ho'] };
const SOTHO_CLASS_SC = new Set(['le', 'se', 'di', 'li', 'bo', 'ba']);
const NGUNI_PL2SG = [['izin', ['in', 'i', 'u']], ['izim', ['im', 'i']], ['izi', ['isi', 'i']], ['ama', ['i', 'ili', 'ubu']], ['aba', ['um', 'umu', 'u']], ['abe', ['um']], ['imi', ['um', 'umu']], ['oo', ['u']], ['iin', ['in', 'i']], ['iim', ['im']], ['ii', ['i']]];
const COPULA_PREFIXES = ['ng', 'ngu', 'ngo', 'nga', 'nge', 'ngi', 'y', 's', 'kwa', 'kwe', 'kwi', 'ku', 'no', 'ne', 'na', 'wa', 'we', 'wo', 'ya', 'ye', 'yo', 'la', 'le', 'lo', 'za', 'ze', 'zo', 'sa', 'se', 'so', 'ba', 'be', 'bo', 'lwa', 'lwe', 'lu', 'e', 'o', 'a'];
const NGUNI_SC_PREFIXES = ['ngiya', 'uya', 'siya', 'niya', 'baya', 'iya', 'liya', 'ziya', 'kuya', 'aya', 'luya', 'buya', 'ndiya', 'ngi', 'ndi', 'si', 'ni', 'ba', 'li', 'zi', 'ku', 'lu', 'bu', 'u', 'i', 'a', 'o', 'e', 'aba', 'abe', 'ama', 'izi', 'isi', 'oba', 'obu', 'olu', 'eli', 'esi', 'ezi', 'ola', 'ela', 'eza', 'aya', 'ena', 'eno', 'ono', 'una', 'ina', 'ana'];
// class prefixes (with a possible preceding na/nga/ku/e) that can sit on a loan: nama-bakkie
const LOAN_PREFIX = /^(na|nga|nge|ngo|ku|e|se|so|na|ne|no|ya|ye|yo|wa|we|wo|la|le|lo|za|ze|zo|sa|ba|be|bo)?(i|u|um|umu|ama|ame|izi|isi|aba|imi|in|im|ii|oo|ii|ili)(-)?/;

const AF_DIACRITIC_MAP = { e: ['ê', 'ë', 'é'], o: ['ô', 'ö'], u: ['û', 'ü'], i: ['î', 'ï'], a: ['â', 'á'] };
function afDiacriticVariants(w) {
  const out = new Set();
  for (let i = 0; i < w.length; i++) {
    const alts = AF_DIACRITIC_MAP[w[i]]; if (!alts) continue;
    for (const a of alts) out.add(w.slice(0, i) + a + w.slice(i + 1));
  }
  return [...out];
}
const AF_DIACRITIC_TRAPS = [[/\bwereld\b/i, 'wêreld'], [/\bmore\b(?!\s*(as|of)\b)/i, 'môre'], [/\bse\b(?=\s*[:.!?,]|\s*$)/i, 'sê'], [/\breen\b/i, 'reën'], [/\bhe\b/i, 'hê'], [/\boe\b/i, 'oë'], [/\bgeeet\b/i, 'geëet'], [/\bseels\b/i, 'seëls']];
const AF_NEGATORS = /\b(nie|geen|g'n|nooit|niemand|niks|nêrens|moenie)\b/i;
const AF_DAY_ABBR = { mon: ['ma', 'maan'], tue: ['di', 'dins'], wed: ['wo', 'woens'], thu: ['do', 'don'], fri: ['vr', 'vry'], sat: ['sa', 'sat'], sun: ['so', 'son'] };
const AF_PROPER = /^(Kaapse|Kaapstad|Kaap|Kapenaars|Tafelberg|Leeukop|Seinheuwel|Suiderkruis|Melkweg|Noord|Suid|Afrika|Afrikaans|Afrikaanse|Hoëveld|Hoëveldse|Vrystaat|Vrystaatse|Karoo|Joburg|Joburgse|Upington|Sani|Pass|Hill|Silent|Eskom|Instagram|Lotto|Spur|Toyota|Tupperware|Weber|Noag|Rugby|WB|NZ|Gqeberha|Helderberg|Dokter|Maandag|Dinsdag|Woensdag|Donderdag|Vrydag|Saterdag|Sondag|Maandae|Dinsdae|Woensdae|Donderdae|Vrydae|Saterdae|Sondae|Januarie|Februarie|Maart|April|Mei|Junie|Julie|Augustus|September|Oktober|November|Desember|Sondagklere|Bloemfontein|Welkom|Kroonstad|Sasolburg|Durban|Pretoria|Stellenbosch|Paarl|Strand|Boland|Overberg|Namakwaland|Kalahari|Drakensberg|Natal|Zoeloeland|Limpopo|Mpumalanga|Gauteng|Woolies|Checkers|Bokke|Springbokke|Kersfees|Paasfees|Nuwejaar|Suidooster|Suidoos|Highveld|Wes-Kaap|Oos-Kaap|Noord-Kaap|Bo-Kaap|Groot-Karoo|Klein-Karoo|Kaapenaars)$/;

function srcCite(idx, w) {
  const e = idx.entry(w);
  if (!e) return null;
  return { word: w, freq: e.freq, sources: e.sources, example: idx.example(w) };
}

function resolve(idx, tok, lang) {
  const key = tok.key;
  if (idx.has(key)) return { form: key, how: 'exact' };
  if (tok.parts.length > 1) {
    const last = tok.parts[tok.parts.length - 1];
    if (idx.has(last)) return { form: last, how: 'hyphen-part' };
    const joined = tok.parts.join('');
    if (idx.has(joined)) return { form: joined, how: 'joined' };
  }
  if (lang === 'af') {
    const stripped = key.replace(/^'|'$/g, '');
    if (idx.has(stripped)) return { form: stripped, how: 'exact' };
    for (let i = 3; i <= key.length - 3; i++) {
      const a = key.slice(0, i), b = key.slice(i);
      if (idx.has(a) && idx.has(b) && idx.freq(a) + idx.freq(b) > 0) return { form: `${a}+${b}`, how: 'compound', parts: [a, b] };
      if (a.endsWith('s') && a.length > 4 && idx.has(a.slice(0, -1)) && idx.has(b)) return { form: `${a.slice(0, -1)}+s+${b}`, how: 'compound', parts: [a.slice(0, -1), b] };
    }
    for (let i = 3; i <= key.length - 3; i++) {
      const a = key.slice(0, i), b = key.slice(i);
      if (idx.has(a) && idx.has(b)) return { form: `${a}+${b}`, how: 'compound', parts: [a, b] };
    }
    return null;
  }
  if (lang === 'zu' || lang === 'xh') {
    const tries = [];
    if (/^[aeo]/.test(key)) tries.push(key.slice(1), 'i' + key.slice(1), 'u' + key.slice(1));
    for (const p of COPULA_PREFIXES) if (key.startsWith(p) && key.length - p.length >= 3) { const r = key.slice(p.length); tries.push(r, 'i' + r, 'u' + r, 'a' + r); }
    if (/(ini|eni)$/.test(key)) for (const v of ['i', 'a', 'o', 'e', 'u']) tries.push(key.replace(/(ini|eni)$/, v));
    for (const t of tries) if (t.length >= 3 && idx.has(t)) return { form: t, how: 'derived' };
    if (key.length >= 7) for (let cut = 1; cut <= 4; cut++) { const rem = key.slice(cut); const w = idx.stemMatch(rem); if (w) return { form: w, how: 'stem', stem: rem }; }
    return null;
  }
  if (lang === 'st') {
    const tries = [];
    if (/eng$/.test(key)) tries.push(key.replace(/eng$/, 'a'), key.replace(/eng$/, 'e'), key.replace(/eng$/, 'o'), key.replace(/ng$/, ''));
    for (const p of ['ha', 'ho', 'ka', 'le', 'sa', 'ba', 'wa', 'ya', 'ea', 'oa', 'tsa', 'di', 'li']) if (key.startsWith(p) && key.length - p.length >= 3) tries.push(key.slice(p.length));
    for (const t of tries) if (t.length >= 3 && idx.has(t)) return { form: t, how: 'derived' };
    if (key.length >= 7) for (let cut = 1; cut <= 3; cut++) { const rem = key.slice(cut); const w = idx.stemMatch(rem); if (w) return { form: w, how: 'stem', stem: rem }; }
  }
  return null;
}

// Is this unresolved Nguni/Sotho token a loan carrying a class prefix (nama-bakkie, neebakkie,
// i-Carte)? Only reached for tokens no source attests, so attested words never get here.
function loanRemainder(tok, lang, enIdx, afIdx, enLower) {
  const cands = [];
  if (tok.parts.length > 1) cands.push(tok.parts[tok.parts.length - 1]);
  const m = LOAN_PREFIX.exec(tok.key);
  if (m && m[0].length && tok.key.length - m[0].length >= 3) cands.push(tok.key.slice(m[0].length));
  const joined = tok.parts.join('');
  for (let cut = 1; cut <= 5 && joined.length - cut >= 4; cut++) cands.push(joined.slice(cut));
  for (const c of cands) {
    if (c.length < 3) continue;
    if (enLower.has(c) || enLower.has(c + 's') || (c.endsWith('s') && enLower.has(c.slice(0, -1)))) return { word: c, via: 'source' };
    if (INTERJECTIONS.has(c)) return { word: c, via: 'sa-register' };
    if (lang !== 'af' && afIdx.has(c) && afIdx.freq(c) >= 5 && c.length >= 4) return { word: c, via: 'afrikaans' };
    if (enIdx.has(c) && c.length >= 5) return { word: c, via: 'english' };
  }
  return null;
}

function glossesDeep(idx, form, lang) {
  let g = idx.glosses(form);
  if (g.length) return { glosses: g, via: form };
  const tries = [];
  if (lang === 'zu' || lang === 'xh') {
    for (const [pl, sgs] of NGUNI_PL2SG) if (form.startsWith(pl)) for (const sg of sgs) tries.push(sg + form.slice(pl.length));
    for (const p of COPULA_PREFIXES) if (form.startsWith(p) && form.length - p.length >= 3) { const r = form.slice(p.length); tries.push(r, 'i' + r, 'u' + r, 'a' + r); }
    if (/(ini|eni)$/.test(form)) for (const v of ['i', 'a', 'o', 'e', 'u']) tries.push(form.replace(/(ini|eni)$/, v));
    for (const sc of NGUNI_SC_PREFIXES) if (form.startsWith(sc) && form.length - sc.length >= 3) tries.push(form.slice(sc.length));
  } else if (lang === 'st') {
    for (const [pl, sg] of [['di', 'se'], ['li', 'se'], ['ma', 'le'], ['ba', 'mo'], ['me', 'mo'], ['di', 'n'], ['li', 'n']]) if (form.startsWith(pl)) tries.push(sg + form.slice(pl.length));
    if (/eng$/.test(form)) tries.push(form.replace(/eng$/, 'a'));
    if (/ile$/.test(form)) tries.push(form.replace(/ile$/, 'a'));
  } else if (lang === 'af') {
    if (/e$/.test(form)) tries.push(form.slice(0, -1));
    if (/s$/.test(form)) tries.push(form.slice(0, -1));
    if (/tjie$/.test(form)) tries.push(form.replace(/tjie$/, ''));
    for (const p of ['ge', 'be', 'ver', 'ont']) if (form.startsWith(p) && form.length - p.length >= 3) tries.push(form.slice(p.length));
    if (/ig$/.test(form)) tries.push(form.slice(0, -2));
    if (/te$/.test(form)) tries.push(form.slice(0, -2));
  }
  for (const t of tries) { if (t.length < 3) continue; g = idx.glosses(t); if (g.length) return { glosses: g, via: t }; }
  return { glosses: [], via: null };
}

function glossStems(glosses) {
  const stems = new Set();
  for (const g of glosses) for (const w of g.toLowerCase().replace(/\(.*?\)/g, '').split(/[^a-z']+/)) { const s = enStem(w); if (s.length >= 3 && !GLOSS_STOP.has(s) && !GLOSS_STOP.has(w)) stems.add(s); }
  return stems;
}
function stemsOverlap(a, b) {
  if (a === b) return true;
  if (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a))) return true;
  if (a.length >= 3 && b.length >= 3 && (a.startsWith(b) || b.startsWith(a))) return true; // sun/sunset
  const ca = SYN.get(a), cb = SYN.get(b);
  return ca !== undefined && ca === cb;
}
function longestCommonAffix(a, b) {
  let p = 0; while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let s = 0; while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  return Math.max(p, s);
}
// iimeko vs imeko, izinja vs inja: same stem, different number — not a near miss
function sameStemNumber(a, b) {
  for (const [pl, sgs] of NGUNI_PL2SG) {
    if (a.startsWith(pl)) for (const sg of sgs) if (b === sg + a.slice(pl.length)) return true;
    if (b.startsWith(pl)) for (const sg of sgs) if (a === sg + b.slice(pl.length)) return true;
  }
  for (const [pl, sg] of [['di', 'se'], ['li', 'se'], ['ma', 'le'], ['ba', 'mo'], ['me', 'mo']]) {
    if (a.startsWith(pl) && b === sg + a.slice(pl.length)) return true;
    if (b.startsWith(pl) && a === sg + b.slice(pl.length)) return true;
  }
  return a + 'e' === b || b + 'e' === a || a + 's' === b || b + 's' === a;
}

export function check({ lang, en = '', text = '', siblings = null, key = null }) {
  const idx = LangIndex.load(lang);
  const enIdx = LangIndex.load('en');
  const afIdx = lang === 'af' ? idx : LangIndex.load('af');
  const findings = [];
  const add = (f) => findings.push(f);
  const raw = text || '';
  if (!raw.trim()) return finish({ lang, en, text, key, findings: [{ check: 'lexical', severity: 'high', token: '', message: 'empty translation', evidence: {} }], coverage: null, back: [] });

  const tokens = tokenize(raw, lang);
  const stop = STOPSETS[lang] || new Set();
  const enWords = enContentWords(en);
  const enLower = new Set();
  for (const w of en.toLowerCase().replace(/’/g, "'").match(/[a-z][a-z'-]*/g) || []) { enLower.add(w); enLower.add(w.replace(/'s$/, '')); enLower.add(w.replace(/-/g, '')); }
  const sentenceStarts = new Set();
  { const re = /(^|[.!?:…]\s*["'“‘]?\s*|["'“‘]\s*|\s['’]n\s+)([\p{L}])/gu; let m; while ((m = re.exec(raw)) !== null) sentenceStarts.add(m.index + m[1].length); }
  // a label is a short string that is not a sentence (headline, badge, hero label)
  const isLabel = tokens.length <= 3 || (tokens.length <= 4 && !/[.!?,]/.test(raw));
  const core = CORE_EN[lang] || CORE_EN.default;

  // ---------- lang-pack banned tokens (native rulings) ----------
  const low = raw.toLowerCase();
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const b of idx.banned.hard || []) {
    const t = b.token.toLowerCase();
    if (new RegExp(`(^|[^\\p{L}])${esc(t)}([^\\p{L}]|$)`, 'u').test(low)) add({ check: 'lexical', severity: 'high', token: b.token, message: `'${b.token}' is banned by the ${lang} language pack (${b.why || 'native ruling'})${b.fix ? ` — house form '${b.fix}'` : ''}${idx.has(t) ? `; note the corpora attest '${b.token}' ${idx.freq(t)}×` : ''}`, evidence: { pack: 'hard', fix: b.fix || null, corpusFreq: idx.freq(t), cite: srcCite(idx, (b.fix || '').toLowerCase().split(' ')[0]) } });
  }
  for (const b of idx.banned.soft || []) {
    const t = b.token.toLowerCase();
    if (new RegExp(`(^|[^\\p{L}])${esc(t)}([^\\p{L}]|$)`, 'u').test(low)) add({ check: 'semantic', severity: 'medium', token: b.token, message: `'${b.token}' was misused before in this app (${b.means ? `means '${b.means}'` : ''}${b.misused_for ? `, misused for '${b.misused_for}'` : ''}${b.issue ? b.issue : ''}) — verify it is the intended sense here`, evidence: { pack: 'soft', means: b.means || null, misusedFor: b.misused_for || null, cite: srcCite(idx, t) } });
  }

  // ---------- (a) lexical + (d) contamination ----------
  const content = [];
  const unknown = [];
  const siblingLangs = lang === 'zu' ? ['xh'] : lang === 'xh' ? ['zu'] : lang === 'st' ? ['tn', 'nso', 'zu', 'xh'] : lang === 'af' ? ['nl'] : [];
  const sibIdx = Object.fromEntries(siblingLangs.map((l) => [l, LangIndex.load(l)]));
  const markerHits = [];
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const key = tok.key;
    if (key.length < 2 || /^\d/.test(key)) continue;
    const isStop = stop.has(key) || stop.has(key.replace(/^'/, ''));
    const properCandidate = tok.capital && !sentenceStarts.has(tok.index);
    for (const [sl, list] of Object.entries(MARKERS[lang] || {})) {
      for (const mk of list) {
        const hit = key === mk || (mk.length <= 3 && tok.parts.length > 1 && tok.parts[0] === mk);
        if (!hit) continue;
        const ownF = idx.freq(key); const theirF = sibIdx[sl]?.freq(key) || 0;
        if (sl === 'nl') { if (idx.has(key) && ownF >= 100) continue; }
        else if (idx.has(key) && ownF >= 20 && ownF * 2 >= theirF) continue;
        markerHits.push({ token: tok.surface, sibling: sl, ownFreq: ownF, siblingFreq: theirF, ownExternal: idx.has(key) });
      }
    }
    const enPart0 = tok.parts.length > 1 ? tok.parts[tok.parts.length - 1] : key;
    if (core.has(enPart0) && !(lang === 'af' && ['wind', 'storm', 'warm', 'cool', 'dry', 'day', 'frost'].includes(enPart0))) {
      add({ check: 'contamination', severity: 'medium', token: tok.surface, message: `'${tok.surface}' is core English weather vocabulary left untranslated`, evidence: { english: true, core: true } });
      content.push({ surface: tok.surface, key, index: tok.index, resolved: null, loan: true, core: true });
      continue;
    }
    if (isStop) continue;
    if (idx.allow.has(key)) {
      content.push({ surface: tok.surface, key, index: tok.index, resolved: { form: key, how: 'ruled' }, loan: true });
      add({ check: 'lexical', severity: 'low', token: tok.surface, message: `'${tok.surface}' is ruled correct in the ${lang} pack (${idx.allow.get(key)})`, evidence: { ruled: true } });
      continue;
    }
    const resolved = resolve(idx, tok, lang);
    const record = { surface: tok.surface, key, index: tok.index, resolved, proper: properCandidate, loan: false };
    content.push(record);
    if (resolved) {
      const citeForm = resolved.parts ? resolved.parts[0] : resolved.form;
      record.cite = srcCite(idx, citeForm);
      if (resolved.how === 'hyphen-part' && (enIdx.has(resolved.form) || enLower.has(resolved.form))) record.loan = true;
      if (resolved.how === 'stem') add({ check: 'lexical', severity: 'low', token: tok.surface, message: `'${tok.surface}' not attested as written; its stem '${resolved.stem}' is attested in '${resolved.form}' (${idx.freq(resolved.form)}×)`, evidence: { cite: record.cite } });
      if (lang === 'af' && resolved.how === 'exact') {
        const vars = afDiacriticVariants(key).filter((v) => idx.has(v) && idx.freq(v) >= 50 && idx.freq(v) >= 8 * Math.max(1, idx.freq(key)));
        if (vars.length) {
          const best = vars.sort((a, b) => idx.freq(b) - idx.freq(a))[0];
          add({ check: 'morphology', severity: 'high', token: tok.surface, message: `'${tok.surface}' is attested ${idx.freq(key)}× but '${best}' ${idx.freq(best)}× — missing diacritic`, evidence: { suggestion: best, cite: srcCite(idx, best) } });
        }
      }
      continue;
    }
    const inhouse = idx.inhouseOnly(key);
    const inEn = enIdx.has(key) || (tok.parts.length > 1 && enIdx.has(tok.parts[tok.parts.length - 1]));
    const enPart = enPart0;
    const inSource = enLower.has(enPart) || enLower.has(key);
    if (lang === 'af') {
      const vars = afDiacriticVariants(key).filter((v) => idx.has(v));
      if (vars.length) {
        const best = vars.sort((a, b) => idx.freq(b) - idx.freq(a))[0];
        add({ check: 'morphology', severity: 'high', token: tok.surface, message: `'${tok.surface}' is not attested but '${best}' is (${fmtFreq(idx.entry(best))}) — missing diacritic`, evidence: { suggestion: best, cite: srcCite(idx, best) } });
        unknown.push(record);
        continue;
      }
    }
    if (INTERJECTIONS.has(key)) { record.loan = true; add({ check: 'lexical', severity: 'low', token: tok.surface, message: `'${tok.surface}' is SA register vocabulary (not in the dictionaries, expected in this voice)`, evidence: { register: true } }); continue; }
    const loan = lang !== 'af' ? loanRemainder(tok, lang, enIdx, afIdx, enLower) : null;
    if (loan) {
      record.loan = true;
      add({ check: 'lexical', severity: 'low', token: tok.surface, message: `'${tok.surface}' carries a class prefix on a loan '${loan.word}' (${loan.via === 'source' ? 'present in the English line' : loan.via === 'afrikaans' ? `attested in Afrikaans ${afIdx.freq(loan.word)}×` : loan.via})`, evidence: { loan } });
      continue;
    }
    if (inSource) {
      record.loan = true;
      add({ check: 'lexical', severity: 'low', token: tok.surface, message: `'${tok.surface}' is carried over from the source line (${inEn ? 'English word, code-switch or brand' : 'place or brand name'})`, evidence: { english: inEn, inSource: true } });
      continue;
    }
    const sib = siblingLangs.map((l) => [l, sibIdx[l].entry(key)]).filter(([, e]) => e);
    if (properCandidate && (inSource || (!sib.length && !inEn))) {
      record.proper = true;
      add({ check: 'lexical', severity: 'low', token: tok.surface, message: `capitalised word not in any ${lang} source; treated as a proper noun${inSource ? ' (present in the English line)' : ''}${inhouse ? ' (seen only in this app\'s own copy)' : ''}`, evidence: { inSource, inhouseOnly: inhouse } });
      continue;
    }
    const nlHit = sib.find(([sl]) => sl === 'nl');
    if (inEn && !inSource && !nlHit && (!sib.length || enIdx.freq(key) > 0 || key.length <= 4)) {
      const common = /^(the|and|with|that|this|there|which|because|about|from|they|their|would|could|should|been|were|what|when|where|still|just|only|every|nobody|somebody|anything|something)$/.test(enPart);
      add({ check: 'contamination', severity: common ? 'high' : 'medium', token: tok.surface, message: `'${tok.surface}' is an English word with no ${lang} attestation and is not in the English source line`, evidence: { english: true, inhouseOnly: inhouse } });
      record.loan = true; unknown.push(record);
      continue;
    }
    if (sib.length) {
      const [sl, e] = sib.sort((a, b) => b[1].freq - a[1].freq)[0];
      const nguniPair = (lang === 'zu' && sl === 'xh') || (lang === 'xh' && sl === 'zu');
      const bantuAcross = lang === 'st' && (sl === 'zu' || sl === 'xh'); // shared Bantu roots (omile, thaba) happen across families too
      const near = nguniPair ? idx.closest(key, 1) : null;
      const sev = nguniPair ? (e.freq >= 50 && !near ? 'medium' : 'low') : bantuAcross ? 'medium' : e.freq >= 5 || sl === 'nl' ? 'high' : 'medium';
      add({ check: 'contamination', severity: sev, token: tok.surface, message: `'${tok.surface}' is attested in ${sl} (${fmtFreq(e)}) but in no external ${lang} source${inhouse ? ' (only in this app\'s own copy)' : ''}${nguniPair ? ' — shared Nguni vocabulary is common, so this is weak evidence on its own' : ''}`, evidence: { sibling: sl, freq: e.freq, sources: e.sources, example: sibIdx[sl].example(key), inhouseOnly: inhouse, closestOwn: near } });
      unknown.push(record);
      continue;
    }
    const near = idx.closest(key, key.length >= 8 ? 2 : 1);
    unknown.push(record);
    let split = null;
    if ((lang === 'zu' || lang === 'xh' || lang === 'st') && key.length >= 9) {
      for (let k = 4; k <= key.length - 4; k++) { const a = key.slice(0, k), b = key.slice(k); if (idx.has(a) && idx.has(b) && idx.freq(a) >= 5 && idx.freq(b) >= 5) { split = [a, b]; break; } }
    }
    const where = inhouse ? ' — seen only in this app\'s own copy, in no external source' : ' — not found in any external source';
    if (split) add({ check: 'morphology', severity: 'medium', token: tok.surface, message: `'${tok.surface}' is unattested but splits into attested '${split[0]}' + '${split[1]}' — fused word boundary?${inhouse ? ' (seen only in this app\'s own copy)' : ''}`, evidence: { split, cite: srcCite(idx, split[0]), inhouseOnly: inhouse } });
    else add({ check: 'lexical', severity: isLabel ? 'high' : 'medium', token: tok.surface, message: `'${tok.surface}'${where}${near ? `; closest attested: '${near.word}' (${near.freq}× ${near.sources.join('/')}, distance ${near.d})` : ''}`, evidence: { closest: near, inhouseOnly: inhouse } });
  }
  for (const m of markerHits) {
    const sev = !m.ownExternal ? 'high' : m.siblingFreq >= 10 * Math.max(1, m.ownFreq) || m.sibling === 'nl' ? 'medium' : 'low';
    add({ check: 'contamination', severity: sev, token: m.token, message: `'${m.token}' is a ${m.sibling} function-word marker (${m.sibling} ${m.siblingFreq}× vs ${lang} ${m.ownFreq}×)`, evidence: m });
  }
  if (lang === 'af') {
    for (const t of tokens) {
      if (STOPSETS.af.has(t.key) || idx.has(t.key)) continue;
      if (NL_SHAPES.some((re) => re.test(t.key)) && sibIdx.nl?.has(t.key) && !findings.some((f) => f.token === t.surface)) add({ check: 'contamination', severity: 'high', token: t.surface, message: `'${t.surface}' has Dutch spelling and is attested in Dutch, not Afrikaans`, evidence: { sibling: 'nl' } });
    }
  }

  // ---------- (b) morphology ----------
  if (lang === 'zu' || lang === 'xh') {
    if (/[éëïêôûáàäöü]/i.test(raw)) add({ check: 'morphology', severity: 'high', token: (raw.match(/\S*[éëïêôûáàäöü]\S*/i) || [''])[0], message: 'diacritic in a Nguni line', evidence: {} });
    for (let i = 0; i < tokens.length - 1; i++) {
      const n = tokens[i].key; const v = tokens[i + 1].key;
      if (n.length < 5 || stop.has(n) || stop.has(v)) continue;
      const cls = idx.nounClass[n]; if (!cls) continue;
      const lem = idx.lemmas[n];
      const isNoun = (lem && /^noun/.test(lem.pos)) || (idx.pos[n] || []).some((p) => /^N/.test(p));
      if (!isNoun) continue;
      const pre = NGUNI_CLASS_PREFIX[cls]; if (!pre || !pre.test(n)) continue; // a relative or copulative form, not a bare noun
      const expect = NGUNI_SC[cls]; if (!expect) continue;
      for (const [c, scs] of Object.entries(NGUNI_SC)) {
        if (c === cls) continue;
        for (const sc of scs) {
          if (!NGUNI_SC_UNAMBIGUOUS.has(sc) || !v.startsWith(sc) || expect.includes(sc)) continue;
          const stem = v.slice(sc.length).replace(/^ya/, '');
          if (stem.length < 3 || !idx.has(v) || idx.freq(v) < 3) continue;
          const alt = expect.map((e) => e + v.slice(sc.length)).find((a) => idx.has(a) && idx.freq(a) >= 5);
          if (!alt) continue;
          add({ check: 'morphology', severity: 'medium', token: `${tokens[i].surface} ${tokens[i + 1].surface}`, message: `'${n}' is class ${cls} but '${v}' opens with class-${c} concord '${sc}-'; '${alt}' is attested ${idx.freq(alt)}×`, evidence: { noun: n, cls, verb: v, expected: alt, cite: srcCite(idx, alt) } });
          break;
        }
      }
    }
  }
  if (lang === 'st') {
    for (let i = 0; i < tokens.length - 1; i++) {
      const n = tokens[i].key; const sc = tokens[i + 1].key;
      if (n.length < 4 || stop.has(n) || !SOTHO_CLASS_SC.has(sc)) continue;
      const cls = idx.nounClass[n]; if (!cls) continue;
      const expect = SOTHO_SC[cls]; if (!expect || expect.includes(sc)) continue;
      if (idx.colloc(n, sc)) continue;
      add({ check: 'morphology', severity: 'low', token: `${tokens[i].surface} ${tokens[i + 1].surface}`, message: `'${n}' is class ${cls} (expects ${expect.join('/')}) but is followed by concord '${sc}'`, evidence: { noun: n, cls, concord: sc } });
    }
  }
  if (lang === 'af') {
    for (const [trap, fix] of AF_DIACRITIC_TRAPS) {
      const m = trap.exec(raw);
      if (m) add({ check: 'morphology', severity: 'medium', token: m[0], message: `'${m[0]}' is usually '${fix}' in this register (af-qc diacritic trap; '${fix}' attested ${idx.freq(fix)}×)`, evidence: { suggestion: fix, cite: srcCite(idx, fix) } });
    }
    const enDay = en.trim().toLowerCase();
    if (AF_DAY_ABBR[enDay] && !AF_DAY_ABBR[enDay].includes(raw.trim().toLowerCase())) add({ check: 'morphology', severity: 'high', token: raw.trim(), message: `'${raw.trim()}' is not an AWS weekday abbreviation for ${en} (expected ${AF_DAY_ABBR[enDay].join(' or ')})`, evidence: { expected: AF_DAY_ABBR[enDay] } });
    for (const s of raw.split(/(?<=[.!?…])\s+|\s*[,;:—–()"“”‘’]\s*/)) {
      const words = s.trim().replace(/[.!?…"'”’]+$/, '').split(/\s+/).filter(Boolean);
      if (words.length < 3) continue;
      const neg = AF_NEGATORS.exec(s);
      if (!neg) continue;
      const last = words[words.length - 1].toLowerCase().replace(/[^\p{L}']/gu, '');
      const negCount = (s.match(/\bnie\b/gi) || []).length;
      if (/^(niks|niemand|nooit|nêrens|geen|g'n|nie)$/.test(last)) continue;
      if (neg[1].toLowerCase() === 'nie' && negCount >= 2) continue;
      add({ check: 'morphology', severity: 'medium', token: neg[1], message: `negation '${neg[1]}' without the closing 'nie' at the end of the clause`, evidence: { sentence: s.trim() } });
    }
    const re = /\b[A-Z][a-zêôîûë]{2,}/g; let m;
    while ((m = re.exec(raw)) !== null) {
      const w = m[0];
      if (sentenceStarts.has(m.index) || AF_PROPER.test(w) || enLower.has(w.toLowerCase())) continue;
      const lower = w.toLowerCase();
      const attestedLower = idx.has(lower) && idx.freq(lower) >= 5;
      const compound = !idx.has(lower) && resolve(idx, { key: lower, parts: [lower] }, 'af')?.how === 'compound';
      if ((attestedLower || compound) && !idx.has(w)) add({ check: 'morphology', severity: 'low', token: w, message: `mid-sentence capital on common noun '${w}'${attestedLower ? ` (attested lowercase ${idx.freq(lower)}×)` : ' (a compound of attested words)'}`, evidence: { cite: attestedLower ? srcCite(idx, lower) : null } });
    }
    if (/\s{2,}/.test(raw)) add({ check: 'morphology', severity: 'low', token: '', message: 'double space', evidence: {} });
  }

  // ---------- (c) semantic ----------
  const back = [];
  const enStemList = enWords.map((w) => w.stem);
  const targetGlossStems = new Set();
  for (const r of content) {
    if (!r.resolved || r.loan) continue;
    const forms = r.resolved.parts || [r.resolved.form];
    const gl = [];
    let via = null;
    for (const f of forms) { const g = glossesDeep(idx, f, lang); for (const x of g.glosses) if (!gl.includes(x)) gl.push(x); if (g.via && !via) via = g.via; }
    const stems = glossStems(gl);
    const overlap = [...stems].filter((s) => enStemList.some((e) => stemsOverlap(s, e)));
    for (const s of stems) targetGlossStems.add(s);
    r.glosses = gl; r.overlap = overlap; r.glossStems = stems; r.via = via;
    const f0 = r.resolved.form;
    r.isNoun = !!(idx.nounClass[f0] || (idx.pos[f0] || []).some((p) => /^N/.test(p)) || /^noun/.test(idx.lemmas[f0]?.pos || '') || (via && (idx.nounClass[via] || /^noun/.test(idx.lemmas[via]?.pos || ''))));
    back.push({ token: r.surface, form: f0, via, glosses: gl.slice(0, 6), matchesSource: overlap });
  }
  const matchedEn = enWords.filter((w) => [...targetGlossStems].some((s) => stemsOverlap(s, w.stem)));
  const unmatchedEn = enWords.filter((w) => !matchedEn.includes(w));
  const expectations = [];
  const textKeys = new Set(tokens.map((t) => t.key));
  const textResolved = new Set(content.filter((r) => r.resolved).flatMap((r) => [...(r.resolved.parts || [r.resolved.form]), r.via].filter(Boolean)));
  const presentWord = (c) => textKeys.has(c) || textResolved.has(c) || [...textKeys, ...textResolved].some((k) => k.length >= 5 && c.length >= 5 && longestCommonAffix(k, c) >= 5);
  for (const w of unmatchedEn) {
    const cands = [...new Set([...(idx.en2l[w.word] || []), ...(idx.en2l[w.stem] || []), ...(idx.en2l[w.word + 's'] || []), ...(idx.en2l[w.word.replace(/s$/, '')] || [])])];
    if (!cands.length) continue;
    const present = cands.filter((c) => c.split(/\s+/).some((part) => part.length >= 3 && presentWord(normalizeWord(part, lang))));
    expectations.push({ en: w.word, candidates: cands.slice(0, 8), present });
  }
  const missingExpectations = expectations.filter((e) => !e.present.length);
  const nothingMatched = matchedEn.length === 0 && enWords.length > 0;
  const enTime = enWords.map((w) => TIME.get(w.stem)).filter((x) => x !== undefined);
  for (const r of content) {
    if (!r.glosses || !r.glosses.length || r.overlap.length || !r.glossStems.size) continue;
    const collocs = content.filter((o) => o !== r && o.resolved && !o.loan).map((o) => [o.resolved.form, idx.colloc(r.resolved.form, o.resolved.form)]).filter(([, s]) => s);
    // time-of-day mismatch: gloss is a time word, the source has a time word from another cluster
    const gTime = [...r.glossStems].map((s) => TIME.get(s)).filter((x) => x !== undefined);
    const timeClash = gTime.length && enTime.length && !gTime.some((g) => enTime.includes(g));
    // near-miss: a real word one to three letters from the word the source's vocabulary expects
    const probe = [r.key, r.resolved.form, r.via].filter(Boolean);
    const minLen = lang === 'af' ? 3 : 4;
    let nearMiss = null;
    for (const e of missingExpectations) for (const c of e.candidates) for (const p of probe) {
      const cw = normalizeWord(c.split(/\s+/)[0], lang);
      if (cw.length < minLen || p.length < minLen || cw === p || sameStemNumber(cw, p)) continue;
      // the same lemma under another concord/copula or suffix (yenza ~ enza, lindela ~ linda)
      if ((p.endsWith(cw) && p.length - cw.length <= 3) || (cw.endsWith(p) && cw.length - p.length <= 3)) continue;
      if ((p.startsWith(cw) && p.length - cw.length <= 3) || (cw.startsWith(p) && cw.length - p.length <= 3)) continue;
      const cwStems = glossStems(idx.glosses(cw));
      if ([...cwStems].some((s) => [...r.glossStems].some((t) => stemsOverlap(s, t)))) continue;
      if (!idx.has(cw) || idx.freq(cw) < 3) continue; // the expected word must itself be a common attested word
      const d = editDistance(cw, p, 3);
      if (d > 3 || d > Math.ceil(Math.min(cw.length, p.length) / 2)) continue;
      if (d > 1 && cw[0] !== p[0]) continue; // a slip keeps the first letter; a different word does not
      // Afrikaans has a rich dictionary with many candidates per English word: only a one-letter
      // slip, or a two-letter slip on a noun, is evidence there
      if (lang === 'af' && d > 1 && !(d === 2 && r.isNoun && Math.min(cw.length, p.length) >= 5)) continue;
      if (!nearMiss || d < nearMiss.d) nearMiss = { en: e.en, expected: cw, d };
    }
    let sev;
    if (timeClash) sev = 'medium';
    else if (nearMiss) sev = 'medium';
    else if (isLabel && r.isNoun && missingExpectations.length && nothingMatched && content.filter((o) => o.resolved && !o.loan).length === 1) sev = 'medium';
    else if (isLabel || missingExpectations.length) sev = 'low';
    else continue;
    if (collocs.length && sev === 'medium' && !timeClash) sev = 'low';
    const exp = missingExpectations[0];
    add({ check: 'semantic', severity: sev, token: r.surface, message: `'${r.surface}' means '${r.glosses.slice(0, 3).join('; ')}' — nothing in the English source${timeClash ? ` (time-of-day clash with '${enWords.filter((w) => TIME.has(w.stem)).map((w) => w.word).join('/')}')` : ''}${nearMiss ? `; it is ${nearMiss.d} letter${nearMiss.d > 1 ? 's' : ''} from '${nearMiss.expected}', the usual word for '${nearMiss.en}'` : exp ? `; the source's '${exp.en}' would normally be ${exp.candidates.slice(0, 4).map((c) => `'${c}'`).join(' / ')}, none present` : ` (source: ${unmatchedEn.map((w) => w.word).join(', ')})`}${collocs.length ? ` — but it does co-occur in corpus with ${collocs.map(([w]) => `'${w}'`).join(', ')}` : ''}`, evidence: { glosses: r.glosses.slice(0, 6), via: r.via, expected: missingExpectations.slice(0, 3), nearMiss, timeClash: !!timeClash, collocations: collocs, cite: r.cite } });
  }
  if (isLabel && nothingMatched && missingExpectations.length) {
    const unglossed = content.filter((r) => r.resolved && !r.loan && !(r.glosses && r.glosses.length));
    if (unglossed.length) {
      const exp = missingExpectations[0];
      add({ check: 'semantic', severity: 'low', token: unglossed.map((r) => r.surface).join(' '), message: `no dictionary gloss for ${unglossed.map((r) => `'${r.surface}'`).join(', ')}; the source's '${exp.en}' would normally be ${exp.candidates.slice(0, 4).map((c) => `'${c}'`).join(' / ')}, none present — sense unverified`, evidence: { expected: missingExpectations.slice(0, 3) } });
    }
  }
  const coverage = { contentTokens: content.length, attested: content.filter((r) => r.resolved).length, unknown: unknown.length, enContent: enWords.length, enMatched: matchedEn.map((w) => w.word), enUnmatched: unmatchedEn.map((w) => w.word), expectations };
  return finish({ lang, en, text, key, findings, coverage, back, siblings });
}

const WEIGHT = { high: 0.5, medium: 0.25, low: 0.05 };
function finish(v) {
  let conf = 0;
  for (const f of v.findings) conf += WEIGHT[f.severity] || 0;
  if (v.coverage && v.coverage.contentTokens >= 3 && v.coverage.unknown / v.coverage.contentTokens >= 0.5) conf += 0.15;
  conf = Math.min(1, Math.round(conf * 100) / 100);
  // notes alone (low findings, coverage) never send a line to a human
  if (!v.findings.some((f) => f.severity === 'high' || f.severity === 'medium')) conf = Math.min(conf, 0.2);
  const action = conf >= 0.5 ? 'triage-high' : conf >= 0.25 ? 'triage' : 'pass';
  const order = { high: 0, medium: 1, low: 2 };
  v.findings.sort((a, b) => order[a.severity] - order[b.severity]);
  return { ...v, confidence: conf, action, ok: action === 'pass' };
}

export function formatVerdict(v, { verbose = false } = {}) {
  const lines = [];
  lines.push(`[${v.lang}] ${v.action.toUpperCase()} (${v.confidence.toFixed(2)}) ${JSON.stringify(v.text)}`);
  if (v.en) lines.push(`   EN: ${JSON.stringify(v.en)}`);
  for (const f of v.findings) {
    if (!verbose && f.severity === 'low') continue;
    lines.push(`   - ${f.severity.toUpperCase()} ${f.check}: ${f.message}`);
    const c = f.evidence?.cite || f.evidence?.closest;
    if (c?.example) lines.push(`       ↳ ${c.example.source}: ${c.example.text.slice(0, 140)}`);
    if (f.evidence?.example) lines.push(`       ↳ ${f.evidence.example.source}: ${f.evidence.example.text.slice(0, 140)}`);
  }
  if (v.coverage) {
    lines.push(`   coverage: ${v.coverage.attested}/${v.coverage.contentTokens} content words attested; EN matched ${v.coverage.enMatched.length}/${v.coverage.enContent}${v.coverage.enUnmatched.length ? ` (unmatched: ${v.coverage.enUnmatched.join(', ')})` : ''}`);
    if (verbose && v.back.length) lines.push(`   back-translation: ${v.back.map((b) => `${b.token}=${b.glosses.slice(0, 2).join('/') || '?'}`).join(' · ')}`);
  }
  return lines.join('\n');
}
