// Builds scripts/lang-check/gold-set.json — the ground truth the checker is examined against.
//
// GOOD  = strings a native reviewer has ruled on and that are live: the native-reviewed condition
//         bank (lang-packs/<l>/corpus-confirmed.jsonl, which predates the provisional fills), the
//         "after" side of every native correction, and Al's own Afrikaans.
// BAD   = every documented correction with its class: TRIAGE_NATIVE_REVIEW.md,
//         LANGUAGE_AUDIT_PHASE3_REPORT.md, I18N_CROSS_LANGUAGE_AUDIT.md, the addenda in review/,
//         lang-packs/<l>/errors-observed.md, and the "before" side of the native-review commits
//         (d51b173 zu, ecdfe11 + a38c32d st, 0510415 xh, 2fe4972/0519c3f/cb0fa87 af).
// ADVERSARIAL = good lines mutated with a real word of the wrong sense, a sibling-language form
//         (zu↔xh, tn/nso→st, nl→af), a stripped diacritic, an English word left in, or a fused
//         word boundary. Every substitution is listed in the tables below so it can be audited.
//
//   node scripts/lang-check/build-gold.mjs

import fs from 'node:fs';
import path from 'node:path';
import { WEATHER_COPY } from '../../assets/weather-copy.js';
import { editDistance } from './lib/text.mjs';

const ROOT = path.resolve(import.meta.dirname, '../..');
const DATA = path.join(import.meta.dirname, 'data');
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const readJsonl = (p) => fs.existsSync(p) ? fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
const LANGS = ['zu', 'xh', 'st', 'af'];

const items = [];
let seq = 0;
const seen = new Set();
function add(item) {
  const key = `${item.lang}|${item.label}|${item.text}`;
  if (seen.has(key) || !item.text || !item.text.trim()) return;
  seen.add(key);
  items.push({ id: `${item.lang}-${item.label}-${++seq}`, ...item });
}

// ---------- bank rows by English text (for siblings) ----------
const rowsByEn = new Map();
const rowsByText = {};
for (const group of ['heroLabels', 'headlines']) for (const [k, row] of Object.entries(WEATHER_COPY[group])) rowsByEn.set(row.en, { key: `${group}.${k}`, ...row });
for (const group of ['witty', 'witty_low_confidence']) for (const [cond, bank] of Object.entries(WEATHER_COPY[group] || {})) {
  const n = (bank.en || []).length;
  for (let i = 0; i < n; i++) {
    const row = { key: `${group}.${cond}[${i}]`, en: bank.en[i], af: bank.af?.[i], zu: bank.zu?.[i], xh: bank.xh?.[i], st: bank.st?.[i] };
    if (row.en && !rowsByEn.has(row.en)) rowsByEn.set(row.en, row);
    for (const l of LANGS) if (row[l]) (rowsByText[l] ||= new Map()).set(row[l], row);
  }
}
// T object rows from app.js (one-line five-language leaves)
const appJs = fs.readFileSync(path.join(ROOT, 'assets', 'app.js'), 'utf8');
const tRows = [];
for (const m of appJs.matchAll(/^\s*([A-Za-z0-9_'-]+):\s*\{\s*en:\s*"((?:[^"\\]|\\.)*)"\s*,\s*af:\s*"((?:[^"\\]|\\.)*)"\s*,\s*zu:\s*"((?:[^"\\]|\\.)*)"\s*,\s*xh:\s*"((?:[^"\\]|\\.)*)"\s*,\s*st:\s*"((?:[^"\\]|\\.)*)"\s*\}/gm)) {
  const row = { key: `T.${m[1]}`, en: m[2], af: m[3], zu: m[4], xh: m[5], st: m[6] };
  tRows.push(row);
  if (!rowsByEn.has(row.en)) rowsByEn.set(row.en, row);
}
const sib = (row) => row ? { en: row.en, af: row.af, zu: row.zu, xh: row.xh, st: row.st } : undefined;

// ---------- known-bad token tables (documented) ----------
const BAD_TOKENS = {
  zu: [
    ['umkhumbi', 'wrong-sense', 'ship, used for kite', 'review/zu-addendum.md storm[10]'],
    ['amapulazi', 'wrong-sense', 'farms, used for pools', 'review/zu-addendum.md rain[3]'],
    ['izinkonjane', 'wrong-sense', 'swallows, used for seagulls', 'review/zu-addendum.md wind[9]'],
    ['izindlela', 'wrong-sense', 'roads, used for expectations', 'review/zu-addendum.md cloudy[36]'],
    ['isijele', 'wrong-sense', 'jail, used for jersey (ijezi)', 'review/zu-addendum.md partly-cloudy[7]'],
  ],
  xh: [
    ['lwengqeleolukwenza', 'boundary', 'fused word boundary (lwengqele olukwenza)', 'lang-packs/xh/banned-words.json'],
    ['kushushu', 'wrong-sense', 'heat inside a cold line', 'review/xh-st-addendum.md cold[24]'],
  ],
  st: [
    ['Boko', 'wrong-sense', 'brain, used for betrayal', 'review/xh-st-addendum.md rain[16]'],
    ['tlosa mabone', 'wrong-sense', 'remove lights, used for switch on', 'review/xh-st-addendum.md lc-fog[2]'],
    // (mohodi / tjhesa are not bad: they are the South African orthography, the house standard since Al's ruling of 2026-09-06)
    ['hlonepha', 'wrong-language', 'Nguni form; Sesotho hlompha', 'lang-packs/st/banned-words.json'],
    ['lifofane', 'wrong-sense', 'airplanes, used for gusts', 'LANGUAGE_AUDIT_PHASE3_REPORT.md HIGH-ST-1'],
    ['setofo', 'wrong-sense', 'stove, used for sunscreen', 'lang-packs/st/banned-words.json'],
    ['tsie', 'wrong-sense', 'grasshopper, used for cricket', 'lang-packs/st/errors-observed.md'],
    ['dikgogo', 'wrong-sense', 'chickens, used for owls', 'lang-packs/st/errors-observed.md'],
    ['utsoarela', 'wrong-sense', 'forgive, used for feel sorry', 'lang-packs/st/errors-observed.md'],
  ],
};

// ---------- GOOD: native-reviewed banks ----------
const badTokenRe = (lang) => new RegExp(`(^|[^\\p{L}])(${(BAD_TOKENS[lang] || []).map(([t]) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})([^\\p{L}]|$)`, 'iu');
for (const lang of LANGS) {
  const re = badTokenRe(lang);
  const rows = readJsonl(path.join(ROOT, 'lang-packs', lang, 'corpus-confirmed.jsonl'));
  for (const r of rows) {
    const text = (r[lang] || '').trim();
    if (!text) continue;
    if (BAD_TOKENS[lang]?.length && re.test(text) && !(lang === 'xh' && /kushushu/i.test(text) && !/\b(cold|chilly|freezing|frost|cool)\b/i.test(r.en))) continue; // handled as BAD below
    // (imbatata: Al ruled 2026-09-06 that the native reviewer's line stays — it is good)
    const row = rowsByEn.get(r.en);
    add({ lang, en: r.en, text, label: 'good', cls: 'native-bank', source: `lang-packs/${lang}/corpus-confirmed.jsonl ${r.key}`, siblings: sib(row) });
  }
}
// T-object strings for zu/xh/st (reviewed in NATIVE_REVIEW_* and the native commits), minus provisionals
const PROVISIONAL_T = new Set(['viewingShared', 'dataFrom']);
for (const row of tRows) {
  if (PROVISIONAL_T.has(row.key.slice(2))) continue;
  for (const lang of ['zu', 'xh', 'st', 'af']) {
    const text = row[lang];
    if (!text || text.length < 2) continue;
    add({ lang, en: row.en, text, label: 'good', cls: 'ui-label', weak: true, source: `assets/app.js ${row.key}`, siblings: sib(row) });
  }
}
// Al's Afrikaans for the bespoke set (350 reused bank lines already covered; 533 new are under review, not gold)

// ---------- BAD: documented items ----------
const doc = (lang, en, text, cls, fix, source, extra = {}) => add({ lang, en, text, label: 'bad', cls, fix, source, siblings: sib(rowsByEn.get(en)), ...extra });
doc('zu', 'gusts', 'amafindo', 'wrong-sense', 'izivunguvungu / kufika ku (unresolved)', 'LANGUAGE_AUDIT_PHASE3_REPORT.md HIGH-ZU-2');
doc('zu', 'Rain tonight', 'Imvula namhlanje', 'wrong-sense', 'Imvula ebusuku', 'LANGUAGE_AUDIT_PHASE3_REPORT.md HIGH-ZU-1');
doc('zu', 'Sun', 'Son', 'wrong-language', 'Snt / Sont (native to confirm)', 'I18N_CROSS_LANGUAGE_AUDIT.md canonical', { siblings: { en: 'Sun', af: 'Son', zu: 'Son', xh: 'Caw', st: 'Sont' } });
doc('xh', 'gusts', 'iimphuphuma', 'wrong-sense', 'ukuqhwithela komoya', 'LANGUAGE_AUDIT_PHASE3_REPORT.md MED-XH-M2');
doc('xh', 'Partly cloudy', 'Kufukufuku kancinci', 'wrong-sense', 'Linamafu kancinci', 'LANGUAGE_AUDIT_PHASE3_REPORT.md MED-XH-M3');
doc('xh', 'Partly cloudy.', 'Kufukufuku kancinci.', 'wrong-sense', 'Kunamafu kancinci.', 'LANGUAGE_AUDIT_PHASE3_REPORT.md MED-XH-M3');
doc('xh', 'Rain AM', 'Imvula kusasa', 'wrong-sense', 'Imvula ngentsasa', 'LANGUAGE_AUDIT_PHASE3_REPORT.md MED-XH-M4', { weak: true });
doc('st', 'gusts', 'lifofane', 'wrong-sense', 'meea e fokang ka sefutho', 'LANGUAGE_AUDIT_PHASE3_REPORT.md HIGH-ST-1');
doc('st', 'Severe weather', 'Leholimo le lebe', 'calque', 'Boemo ba leholimo bo matla', 'lang-packs/st/errors-observed.md');
doc('st', 'Thunder', 'Modumo wa leholimo', 'calque', 'Modumo wa seaduma', 'lang-packs/st/errors-observed.md');
doc('st', 'Milky Way', 'Tsela ea Lebese', 'calque', 'Molalatladi', 'lang-packs/st/errors-observed.md');
doc('st', 'sunscreen', 'setofo', 'wrong-sense', 'setlolo sa letsatsi', 'lang-packs/st/errors-observed.md');
doc('st', 'soup', 'soupa', 'untranslated', 'sopho', 'lang-packs/st/errors-observed.md');
doc('st', 'respect', 'Hlonepha', 'wrong-language', 'Hlompha', 'lang-packs/st/errors-observed.md');
doc('st', 'Sunrise', 'Mafube', 'register', 'Ho chaba ha letsatsi', 'lang-packs/st/errors-observed.md', { weak: true });
doc('st', 'Sunset', 'Letsatsi le likela', 'register', 'Ho likela ha letsatsi', 'lang-packs/st/errors-observed.md', { weak: true });
doc('st', 'beautiful (weather)', 'motle', 'wrong-sense', 'hotle', 'lang-packs/st/errors-observed.md');
doc('af', 'Clear recents', 'Verwyder onlangs', 'calque', 'Verwyder onlangse soektogte', 'LANGUAGE_AUDIT_PHASE3_REPORT.md HIGH-AF-1');
doc('af', 'Not Instagram weather. Not the end of the world.', 'Nie Troufoto weer nie. Nie die einde van die wereld nie.', 'diacritic', 'Nie troufoto-weer nie. Nie die einde van die wêreld nie.', 'TRIAGE_NATIVE_REVIEW.md AF-1');
doc('af', 'Mon', 'Maa', 'spelling', 'Ma', 'docs/notes/AF_DAYS_FIX_NOTES.md');
doc('af', 'Tue', 'Din', 'spelling', 'Dins', 'docs/notes/AF_DAYS_FIX_NOTES.md');
doc('af', 'Wed', 'Woe', 'spelling', 'Wo', 'docs/notes/AF_DAYS_FIX_NOTES.md');
doc('af', 'Very High', 'Baie Hoog', 'capitalisation', 'Baie hoog', 'LANGUAGE_AUDIT_PHASE3_REPORT.md L2', { weak: true });
doc('af', 'Rain AM', 'Reën oggend', 'register', 'Oggendreën', 'LANGUAGE_AUDIT_PHASE3_REPORT.md L3', { weak: true });
doc('af', "Sky's playing cat and mouse.", "Sky's playing kat-en-muis.", 'untranslated', 'Die lug speel kat en muis.', 'lang-packs/af/errors-observed.md');

// bank lines that still carry a documented wrong word
for (const lang of LANGS) {
  for (const [tok, cls, why, source] of BAD_TOKENS[lang] || []) {
    const re = new RegExp(`(^|[^\\p{L}])${tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}]|$)`, 'iu');
    // 'kushushu' (heat) is only wrong inside a cold line (review/xh-st-addendum.md cold[24])
    const contextOk = (en) => tok !== 'kushushu' || /\b(cold|chilly|freezing|frost|cool)\b/i.test(en || '');
    for (const [text, row] of rowsByText[lang] || []) if (re.test(text) && contextOk(row.en)) doc(lang, row.en, text, cls, why, source, { token: tok });
    for (const r of readJsonl(path.join(ROOT, 'lang-packs', lang, 'corpus-confirmed.jsonl'))) if (r[lang] && re.test(r[lang]) && contextOk(r.en)) doc(lang, r.en, r[lang], cls, why, source, { token: tok });
  }
}

// ---------- BAD: native-review "before" values ----------
const pairs = readJson(path.join(DATA, 'native-pairs.json')).filter((p) => p.before && p.commit !== '5efdc0c');
const ZU_CLASSES = [
  [/hlanzekile/, 'wrong-sense', 'clean/hygienic used for clear'],
  [/^Kunamafu$/, 'wrong-sense', 'partly cloudy used for overcast'],
  [/^Isiphepho siyeza/, 'morphology', 'singular concord for plural'],
  [/^Kunenkungu\./, 'boundary', 'Kune inkungu'],
  [/i-jersey|i-gown|i-scarf|ama-takkies|winter setting|i-koue|Highveld classic|bird feeder|i-milk bottle|Lekker koud|rugby fields|-ish\b/, 'untranslated', 'English/Afrikaans left in'],
  [/zokushibilika/, 'wrong-sense', 'sliding shoes used for flip-flops'],
  [/^Isithwathwa otshanini/, 'morphology', 'missing existential Kune-'],
  [/^Kupholile$|^Kubanda$/, 'register', 'label register'],
];
const ST_CLASSES = [
  [/lifofane|\bho fihla ho\b|moea o otlang/, 'wrong-sense', 'gusts'],
  [/^Tlanya|Tlanya\b/, 'wrong-sense', 'tlanya (click) reverted to tobetsa (press) by native'],
  [/di-app|diponelopele/, 'wrong-dialect', 'orthography reverted by native'],
  [/leholimo le lebe|wa leholimo|Tsela ea Lebese/i, 'calque', ''],
  [/hlonepha/i, 'spelling', ''],
  [/mohodi|tjhesa|jwale|jwalo|\bdi-|lehodimo/i, 'orthography-sa', 'South African spelling the Lesotho-orthography reviewer changed — not bad since Al\'s ruling of 2026-09-06; excluded from scoring'],
  [/\bmotle\b|Mafube|le likela/, 'register', ''],
];
function classify(lang, before, after, en) {
  const table = lang === 'zu' ? ZU_CLASSES : lang === 'st' ? ST_CLASSES : [];
  for (const [re, cls, why] of table) if (re.test(before)) return [cls, why];
  const bt = before.split(/\s+/), at = after.split(/\s+/);
  if (bt.length === at.length) {
    const diffs = bt.map((w, i) => [w, at[i]]).filter(([a, b]) => a !== b);
    if (diffs.length === 1 && editDistance(diffs[0][0].toLowerCase(), diffs[0][1].toLowerCase(), 3) <= 2) return ['spelling', `${diffs[0][0]} → ${diffs[0][1]}`];
  }
  if (/\b(the|and|with|weather|rain|sun|wind|cloud|clouds|cold|hot|day|night|sky)\b/i.test(before) && !/\b(the|and|with|weather|rain|sun|wind|cloud|clouds|cold|hot|day|night|sky)\b/i.test(after)) return ['untranslated', 'English content word removed by native'];
  return ['rewritten', 'native rewrote (wording/voice) — not a scored class'];
}
const NATIVE = { d51b173: 'zu', ecdfe11: 'st', a38c32d: 'st', '0510415': 'xh', '2fe4972': 'af', '0519c3f': 'af', cb0fa87: 'af' };
for (const p of pairs) {
  const lang = p.lang; if (!lang || lang === 'en') continue;
  if (NATIVE[p.commit] !== lang && p.commit !== 'c7715c4') continue;
  if (p.commit === 'c7715c4') continue; // GPT-5.5 audit, not native — several later reverted; not gold
  const en = rowsByEn.get(p.after)?.en || rowsByText[lang]?.get(p.after)?.en || rowsByText[lang]?.get(p.before)?.en || p.en || '';
  const [cls, why] = classify(lang, p.before, p.after, en);
  add({ lang, en, text: p.before, label: 'bad', cls, fix: p.after, source: `git ${p.commit} (native review) ${why}`, siblings: sib(rowsByEn.get(en)) });
  add({ lang, en, text: p.after, label: 'good', cls: 'native-after', source: `git ${p.commit} (native review)`, siblings: sib(rowsByEn.get(en)) });
}
// Sesotho replacements file (90, with EN)
for (const r of readJson(path.join(DATA, 'st-replacements.json'))) {
  const [cls, why] = classify('st', r.before, r.after, r.en);
  add({ lang: 'st', en: r.en, text: r.before, label: 'bad', cls, fix: r.after, source: `review/sesotho-replacements.txt ${r.id} ${why}`, siblings: sib(rowsByEn.get(r.en)) });
  add({ lang: 'st', en: r.en, text: r.after, label: 'good', cls: 'native-after', source: `review/sesotho-replacements.txt ${r.id}`, siblings: sib(rowsByEn.get(r.en)) });
}
// Xhosa apply CSV (shipped → final), future_review rows are weak goods
for (const r of readJson(path.join(DATA, 'xh-apply.json'))) {
  const before = r.shipped.trim(), after = r.final.trim();
  if (after) add({ lang: 'xh', en: r.english, text: after, label: 'good', cls: 'native-after', weak: r.future_review === 'True', source: `review/xhosa-apply.csv ${r.section}${r.future_review === 'True' ? ' future_review' : ''}`, siblings: sib(rowsByEn.get(r.english)) });
  if (before && before !== after) {
    let [cls, why] = classify('xh', before, after, r.english);
    if (/umntla omtsha/.test(before)) [cls, why] = ['wrong-sense', 'north used for kite'];
    if (/ucango/.test(before) && /buckle/i.test(r.english)) [cls, why] = ['wrong-sense', 'door used for buckle'];
    add({ lang: 'xh', en: r.english, text: before, label: 'bad', cls, fix: after, source: `review/xhosa-apply.csv ${r.section} ${why}`, siblings: sib(rowsByEn.get(r.english)) });
  }
}
for (const r of readJson(path.join(DATA, 'xh-quarantine.json'))) {
  add({ lang: 'xh', en: r.english, text: r.fill_final, label: 'bad', cls: 'unattested', weak: true, fix: '', source: `review/xhosa-quarantine.csv ${r.rationale}` });
}

// ---------- ADVERSARIAL ----------
// Every table: [from, to, note]. `to` must be a real word of the language (checked by exam.mjs
// against the corpus index and reported).
const ADV = {
  zu: {
    'wrong-sense': [['imvula', 'imvu', 'sheep'], ['ilanga', 'inyanga', 'moon/month'], ['amafu', 'amafutha', 'fat/oil'], ['izulu', 'izwe', 'country'], ['umoya', 'umuzi', 'homestead'], ['ubusuku', 'ubusika', 'winter'], ['inkungu', 'inkuku', 'chicken'], ['kuyabanda', 'kuyabanga', 'it causes'], ['umlilo', 'umlomo', 'mouth'], ['isikhathi', 'isikhali', 'weapon'], ['amanzi', 'amazwi', 'words'], ['ekuseni', 'ekhaya', 'at home'], ['kushisa', 'kusasa', 'tomorrow'], ['ilanga', 'ihlanga', 'reed'], ['izinyoni', 'izinyo', 'tooth'], ['amakhaza', 'amakhasi', 'pages'], ['isibhakabhaka', 'isibhamu', 'gun']],
    // (ukuthi→ukuba and namuhla→namhlanje are deliberately absent: ukuba and namhlanje are also Zulu)
    'wrong-language': [['manje', 'ngoku'], ['lapho', 'apho'], ['yebo', 'ewe'], ['cha', 'hayi'], ['kanjani', 'njani'], ['futhi', 'kwakhona'], ['izulu', 'imozulu'], ['uma', 'xa'], ['ngoba', 'kuba'], ['ngiya', 'ndiya'], ['isimo sezulu', 'imozulu'], ['ukudla', 'ukutya'], ['kushisa', 'kushushu'], ['nje', 'qha'], ['ingabe', 'ingaba'], ['kodwa', 'kodwa']],
    untranslated: [['imvula', 'rain'], ['ilanga', 'sun'], ['umoya', 'wind'], ['amafu', 'clouds'], ['izulu', 'weather'], ['ubusuku', 'night'], ['ekuseni', 'morning'], ['inkungu', 'fog']],
  },
  xh: {
    'wrong-sense': [['imvula', 'imvu', 'sheep'], ['ilanga', 'inyanga', 'moon'], ['amafu', 'amafutha', 'fat'], ['inkungu', 'inkuku', 'chicken'], ['umoya', 'umzi', 'homestead'], ['ubusuku', 'ubusika', 'winter'], ['ingqele', 'ingqondo', 'mind'], ['amanzi', 'amazwi', 'words'], ['isibhakabhaka', 'isibane', 'lamp'], ['kusasa', 'kudala', 'long ago'], ['ilanga', 'ihlanga', 'reed'], ['ixesha', 'ihashe', 'horse'], ['umhla', 'umlambo', 'river'], ['imozulu', 'imoto', 'car'], ['ubushushu', 'ubusuku', 'night'], ['iintaka', 'iintaba', 'mountains'], ['ilizwe', 'ilizwi', 'voice']],
    // (ukuba→ukuthi is deliberately absent: ukuthi is also Xhosa)
    'wrong-language': [['ngoku', 'manje'], ['apho', 'lapho'], ['ewe', 'yebo'], ['hayi', 'cha'], ['njani', 'kanjani'], ['kwakhona', 'futhi'], ['imozulu', 'izulu'], ['xa', 'uma'], ['kuba', 'ngoba'], ['ndiya', 'ngiya'], ['ukutya', 'ukudla'], ['kushushu', 'kushisa'], ['qha', 'nje'], ['ingaba', 'ingabe'], ['namhlanje', 'namuhla'], ['isibhakabhaka', 'isibhakabhaka']],
    untranslated: [['imvula', 'rain'], ['ilanga', 'sun'], ['umoya', 'wind'], ['amafu', 'clouds'], ['imozulu', 'weather'], ['ubusuku', 'night'], ['inkungu', 'fog'], ['kusasa', 'morning']],
  },
  st: {
    'wrong-sense': [['pula', 'pudi', 'goat'], ['letsatsi', 'lesedi', 'light'], ['maru', 'mabu', 'soil'], ['moea', 'mosi', 'smoke'], ['serame', 'sefako', 'hail'], ['bosiu', 'bohobe', 'bread'], ['moholi', 'mohlolo', 'miracle'], ['leholimo', 'lefatshe', 'earth'], ['hoseng', 'hosane', 'tomorrow'], ['metsi', 'mesi', 'smokes'], ['mocheso', 'mokete', 'feast'], ['ntlo', 'ntja', 'dog'], ['lehodimo', 'lefatshe', 'earth'], ['mantsiboea', 'mantsoe', 'words'], ['dinonyana', 'dinoka', 'rivers'], ['letsatsi', 'letsoho', 'hand'], ['lapeng', 'lapileng', 'hungry']],
    'wrong-language': [['hore', 'gore'], ['ho ', 'go '], ['hape', 'gape'], ['joale', 'jaanong'], ['jwale', 'jaanong'], ['kajeno', 'gompieno'], ['bosiu', 'bosigo'], ['feela', 'fela'], ['haholo', 'thata'], ['hona', 'gona'], ['hantle', 'sentle'], ['empa', 'mme'], ['leholimo', 'legodimo'], ['lehodimo', 'legodimo'], ['ha ', 'ga '], ['hoseng', 'mosong'], ['letsatsi', 'letšatši'], ['ho fihla', 'go fihla'], ['moea', 'phefo'], ['dintho', 'dilo']],
    untranslated: [['pula', 'rain'], ['letsatsi', 'sun'], ['moea', 'wind'], ['maru', 'clouds'], ['leholimo', 'weather'], ['bosiu', 'night'], ['moholi', 'fog'], ['serame', 'cold']],
  },
  af: {
    'wrong-sense': [['wolke', 'wolwe', 'wolves'], ['wind', 'wond', 'wound'], ['koud', 'goud', 'gold'], ['son', 'seun', 'boy/son'], ['lug', 'lig', 'light'], ['mis', 'mes', 'knife'], ['reën', 'rein', 'pure'], ['nag', 'nek', 'neck'], ['warm', 'wurm', 'worm'], ['weer', 'weier', 'refuse'], ['water', 'wafer', 'wafer'], ['aand', 'hand', 'hand'], ['sonnig', 'sondig', 'sinful'], ['storm', 'stoom', 'steam'], ['hael', 'haal', 'fetch'], ['bewolk', 'bevolk', 'populated'], ['oggend', 'oggende', 'mornings'], ['winter', 'wenner', 'winner'], ['ryp', 'rys', 'rice'], ['donder', 'dokter', 'doctor']],
    'wrong-language': [['nie', 'niet'], ['ek', 'ik'], ['ons', 'wij'], ['vandag', 'vandaag'], ['môre', 'morgen'], ['reën', 'regen'], ['wolke', 'wolken'], ['lug', 'lucht'], ['aand', 'avond'], ['nag', 'nacht'], ['son', 'zon'], ['sy', 'zij'], ['hulle', 'zij'], ['is', 'zijn'], ['tyd', 'tijd'], ['my', 'mijn'], ['jou', 'jouw'], ['dit', 'het'], ['nou', 'nu'], ['baie', 'veel'], ['lekker', 'lekker'], ['bietjie', 'beetje']],
    diacritic: [['wêreld', 'wereld'], ['môre', 'more'], ['sê', 'se'], ['reën', 'reen'], ['lê', 'le'], ['hê', 'he'], ['oë', 'oe'], ['seë', 'see'], ['Hoëveld', 'Hoeveld'], ['weë', 'wee'], ['sonneblomme', 'sonneblomme'], ['geëet', 'geeet'], ['ná', 'na'], ['drieë', 'driee'], ['Suidooster', 'Suidooster']],
    untranslated: [['wolke', 'clouds'], ['reën', 'rain'], ['son', 'sun'], ['lug', 'sky'], ['weer', 'weather'], ['nag', 'night'], ['oggend', 'morning'], ['mis', 'fog']],
  },
};
const goodByLang = {};
for (const it of items) if (it.label === 'good' && !it.weak && it.cls === 'native-bank' && it.text.split(/\s+/).length >= 3) (goodByLang[it.lang] ||= []).push(it);
const PER_CLASS = 18;
for (const lang of LANGS) {
  const pool = goodByLang[lang] || [];
  for (const [cls, table] of Object.entries(ADV[lang])) {
    let made = 0;
    const usedLines = new Set();
    for (const [from, to, note] of table) {
      if (from === to) continue;
      const re = new RegExp(`(^|[^\\p{L}])(${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})([^\\p{L}]|$)`, 'iu');
      let n = 0;
      for (const g of pool) {
        if (made >= PER_CLASS) break;
        if (usedLines.has(g.text) || !re.test(g.text)) continue;
        const mutated = g.text.replace(re, (m, a, b, c) => a + (b[0] === b[0].toUpperCase() && b[0] !== b[0].toLowerCase() ? to[0].toUpperCase() + to.slice(1) : to) + c);
        if (mutated === g.text) continue;
        usedLines.add(g.text);
        add({ lang, en: g.en, text: mutated, label: 'bad', cls, fix: g.text, source: `adversarial ${cls}: ${from} → ${to}${note ? ` (${note})` : ''}`, siblings: g.siblings, token: to, adversarial: { from, to, note: note || '' } });
        made++; n++;
        if (n >= 2) break;
      }
    }
  }
  // fused boundary (Nguni)
  if (lang === 'zu' || lang === 'xh') {
    let made = 0;
    for (const g of pool) {
      if (made >= PER_CLASS) break;
      const words = g.text.split(' ');
      const i = words.findIndex((w, k) => k > 0 && k < words.length - 1 && /^\p{Ll}{3,}$/u.test(w) && /^\p{Ll}{3,}$/u.test(words[k + 1]));
      if (i < 0) continue;
      const fused = [...words.slice(0, i), words[i] + words[i + 1], ...words.slice(i + 2)].join(' ');
      add({ lang, en: g.en, text: fused, label: 'bad', cls: 'boundary', fix: g.text, source: `adversarial boundary: ${words[i]} ${words[i + 1]} fused`, siblings: g.siblings, token: words[i] + words[i + 1] });
      made++;
    }
  }
}

// Sesotho lines written in Lesotho orthography (the reviewer's) are neither good nor bad since
// Al's ruling of 2026-09-06 that the house standard is the South African orthography: weak.
const LESOTHO = /\b(joale|joalo|moholi|chesa|chaba|lipula|lintho|litaba|likhoho|lifofane|li-\p{L}|tšepahalang|tšoanetse)\b/iu;
for (const it of items) if (it.lang === 'st' && it.label === 'good' && LESOTHO.test(it.text)) { it.weak = true; it.note = 'Lesotho orthography — not scored after the 2026-09-06 ruling'; }

// ---------- write ----------
const out = { builtAt: new Date().toISOString(), counts: {}, items };
for (const it of items) {
  const c = (out.counts[it.lang] ||= { good: 0, bad: 0, byClass: {} });
  c[it.label]++;
  if (it.label === 'bad') c.byClass[it.cls] = (c.byClass[it.cls] || 0) + 1;
}
fs.writeFileSync(path.join(import.meta.dirname, 'gold-set.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out.counts, null, 1));
console.log('items', items.length);
