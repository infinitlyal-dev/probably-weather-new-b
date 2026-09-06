// Compiles the downloaded corpora and dictionaries in .lang-check-cache/ into one JSON index
// per language at .lang-check-cache/index/<lang>.json. Run via:
//   node scripts/lang-check.mjs --build-index [zu|xh|st|af|tn|nso|nl|en]
//
// Every entry in the index carries a source bitmask so a verdict can cite where a word was seen.
// Sources and their licences are listed in SOURCES below and echoed into each index file.

import fs from 'node:fs';
import path from 'node:path';
import { normalizeWord, tokenize, sentences } from './text.mjs';

export const ROOT = path.resolve(import.meta.dirname, '../../..');
export const CACHE = path.join(ROOT, '.lang-check-cache');
export const INDEX_DIR = path.join(CACHE, 'index');

export const SRC = {
  kaikki: 1, leipzig: 2, nchlt: 4, morph: 8, wikt: 16, wiki: 32, constitution: 64, inhouse: 128, dictionary: 256, hunspell: 512,
};
export const SRC_NAMES = Object.fromEntries(Object.entries(SRC).map(([k, v]) => [v, k]));

export const SOURCES = {
  kaikki: { name: 'kaikki.org machine-readable English Wiktionary (per-language extract)', licence: 'CC BY-SA 4.0 (Wiktionary)', url: 'https://kaikki.org/dictionary/' },
  leipzig: { name: 'Leipzig Corpora Collection (Wortschatz) sentence corpora + frequency + co-occurrence', licence: 'CC BY-NC (per LCC download page; terms page was bot-walled this session — not re-verified)', url: 'https://wortschatz.uni-leipzig.de/en/download' },
  nchlt: { name: 'NCHLT Annotated Text Corpora (token/lemma/POS, government domain)', licence: 'CC BY 2.5 ZA (DAC + CTexT NWU)', url: 'https://repo.sadilar.org/' },
  morph: { name: 'SADiLaR-II converted NCHLT morphological annotations', licence: 'CC BY 4.0 (CTexT NWU + SADiLaR)', url: 'https://repo.sadilar.org/' },
  wikt: { name: 'zu/st Wiktionary (native-language dictionaries, full page cache)', licence: 'CC BY-SA 4.0', url: 'https://zu.wiktionary.org/ https://st.wiktionary.org/' },
  wiki: { name: 'zu/xh/st Wikipedia article text (pages-articles dump)', licence: 'CC BY-SA 4.0', url: 'https://dumps.wikimedia.org/' },
  constitution: { name: 'Constitution of the Republic of South Africa 1996 (official translations, justice.gov.za PDFs)', licence: 'Government publication', url: 'https://www.justice.gov.za/constitution/' },
  inhouse: { name: 'Probably Weather native-reviewed copy banks (lang-packs/<l>/corpus-confirmed.jsonl)', licence: 'Infinity Films', url: 'lang-packs/' },
  dictionary: { name: 'Autshumato multilingual word/phrase lists; Bukantswe Sesotho-English dictionary; African Wordnet zu/xh', licence: 'CC BY 2.5 ZA / CC BY 3.0 ZA / CC BY 4.0', url: 'https://repo.sadilar.org/' },
  hunspell: { name: 'Hunspell dictionaries af_ZA (LGPL 2.1), nl_NL (BSD/CC BY 3.0 OpenTaal), en_US', licence: 'LGPL / BSD', url: 'https://github.com/LibreOffice/dictionaries' },
};

function mk(lang) {
  return {
    lang, builtAt: new Date().toISOString(), sources: {},
    words: new Map(), lemmas: new Map(), form2lemma: new Map(), en2l: new Map(), l2en: new Map(),
    pos: new Map(), nounClass: new Map(), verbRoots: new Set(), concords: {}, ex: new Map(), co: new Map(),
    sentences: {}, leipzigCorpora: [],
  };
}
function bump(idx, srcKey, n = 1) { idx.sources[srcKey] = (idx.sources[srcKey] || 0) + n; }
function isWordish(w) { return /^[\p{L}\p{M}][\p{L}\p{M}'-]*$/u.test(w) && w.length <= 40; }
function addWord(idx, form, src, freq = 0) {
  const key = normalizeWord(form, idx.lang);
  if (!isWordish(key)) return null;
  const cur = idx.words.get(key);
  if (cur) { cur[0] += freq; cur[1] |= src; } else idx.words.set(key, [freq, src]);
  return key;
}
function pushUnique(map, key, val, cap = 12) {
  if (!key) return;
  let arr = map.get(key);
  if (!arr) { arr = []; map.set(key, arr); }
  if (!arr.includes(val) && arr.length < cap) arr.push(val);
}
function addGloss(idx, word, gloss) {
  const g = gloss.replace(/\s+/g, ' ').trim();
  if (!g) return;
  pushUnique(idx.l2en, word, g, 10);
}
function addSentences(idx, corpusId, texts, src) {
  const store = (idx.sentences[corpusId] ||= []);
  for (const s of texts) {
    if (s.length < 8 || s.length > 240) continue;
    const i = store.length;
    store.push(s);
    for (const t of tokenize(s, idx.lang)) {
      const key = addWord(idx, t.key, src, 1);
      if (!key) continue;
      let ex = idx.ex.get(key);
      if (!ex) { ex = []; idx.ex.set(key, ex); }
      if (ex.length < 3) ex.push([corpusId, i]);
    }
  }
}
const read = (p) => fs.readFileSync(p, 'utf8');
const exists = (p) => fs.existsSync(p);

// ---------- kaikki ----------
function loadKaikki(idx, file) {
  if (!exists(file)) return;
  const lang = idx.lang;
  let n = 0;
  for (const line of read(file).split('\n')) {
    if (!line) continue;
    let e; try { e = JSON.parse(line); } catch { continue; }
    if (!e.word) continue;
    const word = normalizeWord(e.word.replace(/^-+/, ''), lang);
    if (!isWordish(word)) continue;
    n++;
    addWord(idx, word, SRC.kaikki, 0);
    const lem = idx.lemmas.get(word) || { pos: e.pos || '', cls: null, src: 0 };
    lem.src |= SRC.kaikki;
    for (const s of e.senses || []) {
      for (const g of s.glosses || []) addGloss(idx, word, g);
      for (const t of s.tags || []) { const m = /^class-(\d+a?)$/.exec(t); if (m && !lem.cls) lem.cls = m[1]; }
      for (const x of s.examples || []) if (x.text) addSentences(idx, 'kaikki', [x.text], SRC.kaikki);
    }
    for (const h of e.head_templates || []) {
      const a = h.args || {};
      if (!lem.cls && /^(zu|xh)-noun$/.test(h.name) && a['2']) lem.cls = String(a['2']);
    }
    idx.lemmas.set(word, lem);
    if (lem.cls && /^noun/.test(lem.pos)) idx.nounClass.set(word, lem.cls);
    for (const f of e.forms || []) {
      const form = f.form || '';
      const tags = f.tags || [];
      if (!form || form === '-' || tags.includes('table-tags') || tags.includes('inflection-template')) continue;
      if (/\s/.test(form)) continue;
      const key = addWord(idx, form.replace(/^-+/, ''), SRC.kaikki, 0);
      if (key && key !== word) pushUnique(idx.form2lemma, key, word, 4);
      if (key && lem.cls && tags.includes('plural') && /^noun/.test(lem.pos)) {
        // plural class is class+1 for even classes
        const c = parseInt(lem.cls, 10); if (!Number.isNaN(c) && c % 2 === 1) idx.nounClass.set(key, String(c + 1));
      }
    }
    if (e.pos === 'verb') idx.verbRoots.add(word);
    // reverse gloss → en2l
    for (const s of e.senses || []) for (const g of s.glosses || []) {
      const head = g.replace(/\(.*?\)/g, '').split(/[;,]/)[0].trim().toLowerCase();
      if (head && head.split(' ').length <= 3) pushUnique(idx.en2l, head.replace(/^to /, ''), word, 12);
    }
  }
  bump(idx, 'kaikki', n);
}

// ---------- Leipzig ----------
function loadLeipzig(idx, corpus) {
  const dir = path.join(CACHE, 'leipzig', corpus);
  if (!exists(dir)) return;
  const wordsFile = path.join(dir, `${corpus}-words.txt`);
  const id2word = new Map();
  const id2freq = new Map();
  let n = 0;
  for (const line of read(wordsFile).split('\n')) {
    if (!line) continue;
    const cols = line.split('\t');
    if (cols.length < 3) continue;
    const id = cols[0]; const word = cols[1]; const freq = parseInt(cols[cols.length - 1], 10) || 0;
    const key = addWord(idx, word, SRC.leipzig, freq);
    if (key) { id2word.set(id, key); id2freq.set(id, freq); n++; }
  }
  bump(idx, 'leipzig', n);
  idx.leipzigCorpora.push(corpus);
  const inv = path.join(dir, `${corpus}-inv_w.txt`);
  if (exists(inv)) {
    const seen = new Map();
    for (const line of read(inv).split('\n')) {
      const t = line.indexOf('\t'); if (t < 0) continue;
      const wid = line.slice(0, t);
      const key = id2word.get(wid); if (!key) continue;
      let ex = idx.ex.get(key);
      if (!ex) { ex = []; idx.ex.set(key, ex); }
      const c = seen.get(wid) || 0;
      if (c >= 2 || ex.length >= 3) continue;
      const t2 = line.indexOf('\t', t + 1);
      const sid = line.slice(t + 1, t2 < 0 ? undefined : t2);
      ex.push([`L:${corpus}`, parseInt(sid, 10)]);
      seen.set(wid, c + 1);
    }
  }
  const con = path.join(dir, `${corpus}-co_n.txt`);
  if (exists(con)) {
    const tmp = new Map();
    for (const line of read(con).split('\n')) {
      const cols = line.split('\t'); if (cols.length < 4) continue;
      const a = id2word.get(cols[0]); const b = id2word.get(cols[1]); if (!a || !b) continue;
      if ((id2freq.get(cols[0]) || 0) < 3) continue;
      if (!/^[\p{L}]/u.test(b)) continue;
      const sig = parseFloat(cols[3]) || 0;
      let arr = tmp.get(a); if (!arr) { arr = []; tmp.set(a, arr); }
      arr.push([b, sig]);
    }
    for (const [a, arr] of tmp) {
      arr.sort((x, y) => y[1] - x[1]);
      const cur = idx.co.get(a) || [];
      for (const [b, sig] of arr.slice(0, 10)) if (!cur.some((c) => c[0] === b)) cur.push([b, Math.round(sig * 10) / 10]);
      idx.co.set(a, cur.slice(0, 12));
    }
  }
}

// ---------- NCHLT ----------
function loadNchlt(idx, code) {
  const lemmaTsv = path.join(CACHE, 'nchlt', `${code}.lemma.tsv`);
  const posTsv = path.join(CACHE, 'nchlt', `${code}.pos.tsv`);
  let n = 0;
  if (exists(lemmaTsv)) {
    for (const line of read(lemmaTsv).split('\n')) {
      const [tok, lemma] = line.split('\t');
      if (!tok || tok === 'Token') continue;
      const key = addWord(idx, tok, SRC.nchlt, 1); n++;
      if (key && lemma) {
        const lk = normalizeWord(lemma, idx.lang);
        if (isWordish(lk)) {
          if (lk !== key) pushUnique(idx.form2lemma, key, lk, 4);
          const lem = idx.lemmas.get(lk) || { pos: '', cls: null, src: 0 }; lem.src |= SRC.nchlt; idx.lemmas.set(lk, lem);
          addWord(idx, lk, SRC.nchlt, 0);
        }
      }
    }
  }
  if (exists(posTsv)) {
    for (const line of read(posTsv).split('\n')) {
      const [tok, pos] = line.split('\t');
      if (!tok || tok === 'Token' || !pos) continue;
      const key = normalizeWord(tok, idx.lang);
      if (!isWordish(key)) continue;
      pushUnique(idx.pos, key, pos, 4);
      const m = /^N(\d\d)/.exec(pos); if (m && !idx.nounClass.has(key)) idx.nounClass.set(key, String(parseInt(m[1], 10)));
    }
  }
  // raw running text → sentences/examples
  const dir = path.join(CACHE, 'nchlt');
  if (exists(dir)) for (const f of fs.readdirSync(dir)) {
    if (!f.startsWith(`${code}.lemma.`) || !f.endsWith('.data')) continue;
    const txt = read(path.join(dir, f)).replace(/<[^>]+>/g, ' ').replace(/^pst0.*$/m, '');
    addSentences(idx, 'nchlt', sentences(txt), SRC.nchlt);
  }
  bump(idx, 'nchlt', n);
}

// ---------- SADiLaR morph ----------
function loadMorph(idx, code) {
  const file = path.join(CACHE, 'sadilar', `morph-${code}.txt`);
  if (!exists(file)) return;
  let n = 0;
  const conc = idx.concords;
  for (const line of read(file).split('\n')) {
    const [tok, seg] = line.split('\t');
    if (!tok || !seg || tok.startsWith('<')) continue;
    const key = addWord(idx, tok, SRC.morph, 1); n++;
    if (!key) continue;
    const pieces = [...seg.matchAll(/([^\[\]\-]*)\[([A-Za-z0-9]+)\]/g)].map((m) => [m[1], m[2]]);
    for (const [surf, tag] of pieces) {
      let m;
      if ((m = /^(?:NPre|BPre|NPrePre)(\d+a?)$/.exec(tag)) && !idx.nounClass.has(key)) idx.nounClass.set(key, m[1]);
      if (tag === 'VRoot' && surf) idx.verbRoots.add(normalizeWord(surf, idx.lang));
      if ((m = /^(SC|OC|PossConc|RelConc|AdjPre|EnumConc|QuantConc)(\d+a?)$/.exec(tag)) && surf) {
        const kind = m[1]; const cls = m[2];
        const s = normalizeWord(surf, idx.lang);
        const tbl = (conc[kind] ||= {});
        const c = (tbl[s] ||= {});
        c[cls] = (c[cls] || 0) + 1;
      }
    }
  }
  bump(idx, 'morph', n);
}

// ---------- Wiktionary (zu / st native) ----------
function loadWiktionary(idx, code) {
  const file = path.join(CACHE, 'wiktionary', `${code}-wiktionary.jsonl`);
  if (!exists(file)) return;
  let n = 0;
  for (const line of read(file).split('\n')) {
    if (!line) continue;
    let p; try { p = JSON.parse(line); } catch { continue; }
    const title = normalizeWord(p.title.replace(/^-+/, ''), idx.lang);
    const text = p.text || '';
    if (!isWordish(title)) continue;
    n++;
    addWord(idx, title, SRC.wikt, 0);
    const lem = idx.lemmas.get(title) || { pos: '', cls: null, src: 0 }; lem.src |= SRC.wikt; idx.lemmas.set(title, lem);
    for (const m of text.matchAll(/\{\{t\|en\|([^}|]+)/g)) addGloss(idx, title, m[1]);
    const et = /'''English translation:'''\s*''([^']+)''/.exec(text);
    if (et) for (const g of et[1].split(/;/)) addGloss(idx, title, g.trim());
    for (const m of text.matchAll(/'''Sesotho word \((South African|Lesotho) orthography\):'''\s*([^\n<]+)/g)) {
      const w = normalizeWord(m[2].trim().replace(/^-+/, ''), idx.lang);
      if (isWordish(w)) { addWord(idx, w, SRC.wikt, 0); if (w !== title) pushUnique(idx.form2lemma, w, title, 4); }
    }
    for (const m of text.matchAll(/\[\[([^\]|]+)\]\]\s*\(class ([^)]+)\)/g)) {
      const w = normalizeWord(m[1], idx.lang);
      if (isWordish(w)) { addWord(idx, w, SRC.wikt, 0); pushUnique(idx.form2lemma, w, title, 4); if (!idx.nounClass.has(w)) idx.nounClass.set(w, m[2].split(/[ ,]/)[0]); }
    }
    for (const m of text.matchAll(/\[\[([^\]|:]+)\]\]/g)) { const w = normalizeWord(m[1], idx.lang); if (isWordish(w) && !/^(category|kategori)/i.test(m[1])) addWord(idx, w, SRC.wikt, 0); }
    const ex = /'''Example of usage:'''\s*([^\n<]+?)\s*''\(/.exec(text);
    if (ex) addSentences(idx, 'wiktionary', [ex[1].trim()], SRC.wikt);
    for (const g of idx.l2en.get(title) || []) {
      const head = g.replace(/\(.*?\)/g, '').split(/[;,]/)[0].trim().toLowerCase();
      if (head && head.split(' ').length <= 3) pushUnique(idx.en2l, head.replace(/^to /, ''), title, 12);
    }
  }
  bump(idx, 'wikt', n);
}

// ---------- dictionaries ----------
function loadAutshumato(idx, name) {
  const dir = path.join(CACHE, 'sadilar', 'autshumato-wordphrase', 'Autshumato-Multilingual Word & Phrase Translations');
  let n = 0;
  for (const suffix of ['', '_phrases']) {
    const file = path.join(dir, `english_${name}${suffix}.txt`);
    if (!exists(file)) continue;
    for (const line of read(file).split('\n')) {
      const t = line.indexOf('\t'); if (t < 0) continue;
      const en = line.slice(0, t).trim().toLowerCase();
      const targets = line.slice(t + 1).split(';').map((s) => s.trim()).filter(Boolean);
      for (const tgt of targets) {
        const norm = normalizeWord(tgt.replace(/^-+/, ''), idx.lang);
        for (const w of norm.split(/\s+/)) addWord(idx, w, SRC.dictionary, 0);
        if (!/\s/.test(norm)) { pushUnique(idx.en2l, en, norm, 12); addGloss(idx, norm, en); n++; }
        else pushUnique(idx.en2l, en, norm, 12);
      }
    }
  }
  bump(idx, 'autshumato', n);
}
function loadBukantswe(idx) {
  const file = path.join(CACHE, 'sadilar', 'bukantswe', 'Bukantswe Sesotho-English Bilingual Dictionary', 'Data.RMA.Bukantswe-Sesotho-English-Bilingual.txt');
  if (!exists(file)) return;
  let n = 0;
  for (const line of read(file).split('\n')) {
    const [st, en] = line.split('\t'); if (!st || !en || st === 'Sesotho') continue;
    const norm = normalizeWord(st.replace(/^-+/, ''), idx.lang);
    for (const w of norm.split(/\s+/)) addWord(idx, w, SRC.dictionary, 0);
    const enHead = en.replace(/\(.*?\)/g, '').trim().toLowerCase();
    if (!/\s/.test(norm)) { addGloss(idx, norm, en.trim()); const lem = idx.lemmas.get(norm) || { pos: '', cls: null, src: 0 }; lem.src |= SRC.dictionary; idx.lemmas.set(norm, lem); }
    if (enHead && enHead.split(' ').length <= 3) pushUnique(idx.en2l, enHead.replace(/^to /, ''), norm, 12);
    n++;
  }
  bump(idx, 'bukantswe', n);
}
function loadWordnet(idx, code) {
  const dir = path.join(CACHE, 'sadilar', `wordnet-${code}`);
  if (!exists(dir)) return;
  let n = 0;
  for (const sub of fs.readdirSync(dir)) {
    const d = path.join(dir, sub); if (!fs.statSync(d).isDirectory()) continue;
    for (const f of fs.readdirSync(d)) {
      if (!f.endsWith('.xml')) continue;
      const xml = read(path.join(d, f));
      for (const m of xml.matchAll(/<Lemma writtenForm="([^"]+)" partOfSpeech="([^"]+)"/g)) {
        const norm = normalizeWord(m[1], idx.lang);
        for (const w of norm.split(/\s+/)) addWord(idx, w, SRC.dictionary, 0);
        if (!/\s/.test(norm)) { const lem = idx.lemmas.get(norm) || { pos: m[2], cls: null, src: 0 }; lem.src |= SRC.dictionary; idx.lemmas.set(norm, lem); }
        n++;
      }
    }
  }
  bump(idx, 'wordnet', n);
}

// ---------- Hunspell ----------
function parseAff(text) {
  const rules = {};
  const lines = text.split('\n').map((l) => l.replace(/\r/g, ''));
  for (let i = 0; i < lines.length; i++) {
    const m = /^(SFX|PFX)\s+(\S+)\s+([YN])\s+(\d+)\s*$/.exec(lines[i]);
    if (!m) continue;
    const [, kind, flag, cross, count] = m;
    const r = { kind, cross: cross === 'Y', entries: [] };
    for (let k = 1; k <= parseInt(count, 10); k++) {
      const e = /^(SFX|PFX)\s+\S+\s+(\S+)\s+(\S+)\s*(\S*)/.exec(lines[i + k] || '');
      if (!e) continue;
      const strip = e[2] === '0' ? '' : e[2];
      const add = (e[3] === '0' ? '' : e[3]).split('/')[0];
      const cond = e[4] && e[4] !== '.' ? e[4] : '';
      r.entries.push({ strip, add, cond: cond ? new RegExp(kind === 'SFX' ? cond + '$' : '^' + cond) : null });
    }
    rules[flag] = r;
  }
  return rules;
}
function expandHunspell(dicText, affText, lang) {
  const rules = parseAff(affText);
  const out = new Map();
  const add = (w) => { const k = normalizeWord(w, lang); if (isWordish(k)) out.set(k, (out.get(k) || 0)); };
  const lines = dicText.split('\n');
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].replace(/\r/g, '').trim();
    if (!line || line.startsWith('#')) continue;
    const slash = line.indexOf('/');
    const word = slash < 0 ? line : line.slice(0, slash);
    const flags = slash < 0 ? '' : line.slice(slash + 1).replace(/\s.*$/, '');
    add(word);
    if (!flags) continue;
    const flagList = flags.split('');
    const sfxForms = [];
    for (const f of flagList) {
      const r = rules[f]; if (!r) continue;
      for (const e of r.entries) {
        if (e.cond && !e.cond.test(word)) continue;
        if (r.kind === 'SFX') {
          if (e.strip && !word.endsWith(e.strip)) continue;
          const nw = word.slice(0, word.length - e.strip.length) + e.add; add(nw); if (r.cross) sfxForms.push(nw);
        } else {
          if (e.strip && !word.startsWith(e.strip)) continue;
          add(e.add + word.slice(e.strip.length));
        }
      }
    }
    for (const f of flagList) {
      const r = rules[f]; if (!r || r.kind !== 'PFX' || !r.cross) continue;
      for (const e of r.entries) for (const sf of sfxForms) {
        if (e.cond && !e.cond.test(sf)) continue;
        if (e.strip && !sf.startsWith(e.strip)) continue;
        add(e.add + sf.slice(e.strip.length));
      }
    }
  }
  return out;
}
function loadHunspell(idx, code, expand = true) {
  const dic = path.join(CACHE, 'hunspell', `${code}.dic`);
  const aff = path.join(CACHE, 'hunspell', `${code}.aff`);
  if (!exists(dic)) return;
  const words = expand && exists(aff) ? expandHunspell(read(dic), read(aff), idx.lang) : (() => {
    const m = new Map();
    for (const l of read(dic).split('\n').slice(1)) { const w = l.split('/')[0].trim(); if (w) m.set(normalizeWord(w, idx.lang), 0); }
    return m;
  })();
  let n = 0;
  for (const [w] of words) { if (addWord(idx, w, SRC.hunspell, 0)) n++; }
  bump(idx, 'hunspell', n);
}

// ---------- plain text corpora ----------
function loadText(idx, corpusId, file, src) {
  if (!exists(file)) return;
  const txt = read(file);
  const sents = sentences(txt).filter((s) => /\p{L}{3,}/u.test(s));
  addSentences(idx, corpusId, sents, src);
  bump(idx, corpusId, sents.length);
}
function loadInhouse(idx, code) {
  const file = path.join(ROOT, 'lang-packs', code, 'corpus-confirmed.jsonl');
  if (!exists(file)) return;
  const sents = [];
  for (const line of read(file).split('\n')) {
    if (!line) continue;
    let r; try { r = JSON.parse(line); } catch { continue; }
    const v = r[code]; if (v && v.trim()) sents.push(v.trim());
  }
  addSentences(idx, 'inhouse', sents, SRC.inhouse);
  bump(idx, 'inhouse', sents.length);
}

// ---------- per-language recipes ----------
const RECIPES = {
  zu: (idx) => {
    loadKaikki(idx, path.join(CACHE, 'kaikki', 'Zulu.jsonl'));
    for (const c of ['zul_community_2017', 'zul_mixed_2014_100K', 'zul-za_web_2018_30K']) loadLeipzig(idx, c);
    loadNchlt(idx, 'zu'); loadMorph(idx, 'zu'); loadWiktionary(idx, 'zu'); loadAutshumato(idx, 'isizulu'); loadWordnet(idx, 'zu');
    loadText(idx, 'wiki', path.join(CACHE, 'text', 'wiki-zu.txt'), SRC.wiki);
    loadText(idx, 'constitution', path.join(CACHE, 'text', 'constitution-zul.txt'), SRC.constitution);
    loadInhouse(idx, 'zu');
  },
  xh: (idx) => {
    loadKaikki(idx, path.join(CACHE, 'kaikki', 'Xhosa.jsonl'));
    for (const c of ['xho_community_2017', 'xho-za_web_2018_30K']) loadLeipzig(idx, c);
    loadNchlt(idx, 'xh'); loadMorph(idx, 'xh'); loadAutshumato(idx, 'isixhosa'); loadWordnet(idx, 'xh');
    loadText(idx, 'wiki', path.join(CACHE, 'text', 'wiki-xh.txt'), SRC.wiki);
    loadText(idx, 'constitution', path.join(CACHE, 'text', 'constitution-xho.txt'), SRC.constitution);
    loadInhouse(idx, 'xh');
  },
  st: (idx) => {
    loadKaikki(idx, path.join(CACHE, 'kaikki', 'Sotho.jsonl'));
    for (const c of ['sot_community_2017', 'sot-za_web_2018_10K']) loadLeipzig(idx, c);
    loadNchlt(idx, 'st'); loadMorph(idx, 'st'); loadWiktionary(idx, 'st'); loadAutshumato(idx, 'sesotho'); loadBukantswe(idx);
    loadText(idx, 'wiki', path.join(CACHE, 'text', 'wiki-st.txt'), SRC.wiki);
    loadText(idx, 'constitution', path.join(CACHE, 'text', 'constitution-sot.txt'), SRC.constitution);
    loadInhouse(idx, 'st');
  },
  af: (idx) => {
    loadKaikki(idx, path.join(CACHE, 'kaikki', 'Afrikaans.jsonl'));
    loadHunspell(idx, 'af_ZA', true);
    for (const c of ['afr_mixed_2019_300K']) loadLeipzig(idx, c);
    loadNchlt(idx, 'af'); loadAutshumato(idx, 'afrikaans');
    loadText(idx, 'constitution', path.join(CACHE, 'text', 'constitution-afr.txt'), SRC.constitution);
    loadInhouse(idx, 'af');
  },
  // contamination references (words only, lighter)
  tn: (idx) => { loadLeipzig(idx, 'tsn_community_2017'); loadNchlt(idx, 'tn'); loadAutshumato(idx, 'setswana'); },
  nso: (idx) => { loadLeipzig(idx, 'nso-za_web_2018_10K'); loadNchlt(idx, 'nso'); loadAutshumato(idx, 'sepedi'); },
  nl: (idx) => { loadHunspell(idx, 'nl_NL', false); },
  en: (idx) => {
    loadHunspell(idx, 'en_US', true);
    loadText(idx, 'constitution', path.join(CACHE, 'text', 'constitution-eng.txt'), SRC.constitution);
    // English side of Autshumato lists
    const dir = path.join(CACHE, 'sadilar', 'autshumato-wordphrase', 'Autshumato-Multilingual Word & Phrase Translations');
    if (exists(dir)) for (const f of ['english_isizulu.txt', 'english_afrikaans.txt']) {
      const p = path.join(dir, f); if (!exists(p)) continue;
      for (const line of read(p).split('\n')) { const en = line.split('\t')[0]; if (en) for (const w of en.toLowerCase().split(/\s+/)) addWord(idx, w, SRC.dictionary, 0); }
    }
  },
};

export function buildIndex(lang) {
  if (!RECIPES[lang]) throw new Error(`no recipe for ${lang}`);
  const idx = mk(lang);
  const t0 = Date.now();
  RECIPES[lang](idx);
  const out = {
    lang: idx.lang, builtAt: idx.builtAt, buildMs: Date.now() - t0, sources: idx.sources, sourceMeta: SOURCES,
    leipzigCorpora: idx.leipzigCorpora,
    words: Object.fromEntries(idx.words),
    lemmas: Object.fromEntries(idx.lemmas),
    form2lemma: Object.fromEntries(idx.form2lemma),
    en2l: Object.fromEntries(idx.en2l),
    l2en: Object.fromEntries(idx.l2en),
    pos: Object.fromEntries(idx.pos),
    nounClass: Object.fromEntries(idx.nounClass),
    verbRoots: [...idx.verbRoots],
    concords: idx.concords,
    ex: Object.fromEntries(idx.ex),
    co: Object.fromEntries(idx.co),
    sentences: idx.sentences,
  };
  fs.mkdirSync(INDEX_DIR, { recursive: true });
  const file = path.join(INDEX_DIR, `${lang}.json`);
  fs.writeFileSync(file, JSON.stringify(out));
  const stat = fs.statSync(file);
  return { file, bytes: stat.size, words: idx.words.size, lemmas: idx.lemmas.size, glossed: idx.l2en.size, en2l: idx.en2l.size, examples: idx.ex.size, co: idx.co.size, sources: idx.sources, ms: out.buildMs };
}
