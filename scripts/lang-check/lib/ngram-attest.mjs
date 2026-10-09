// Corpus attestation IN CONTEXT (9 Oct 2026): word pairs and triples from .lang-check-cache/ngrams/<lang>.json
// (scripts/lang-check/fetch-corpora.mjs ngrams — counts only, from Leipzig, NCHLT, Wikipedia, the Constitution and the
// current web sources). The single-word lookup flags a normal word whose dictionary gloss misses the English ("lug" is
// "air" in the glossary, "sky" in "die lug is blou"); the pair it stands in settles it.

import fs from 'node:fs';
import path from 'node:path';
import { NGRAM_DIR } from './web-ngrams.mjs';
import { tokenize } from './text.mjs';

const cache = new Map();
export class Ngrams {
  static load(lang) {
    if (!cache.has(lang)) {
      const f = path.join(NGRAM_DIR, `${lang}.json`);
      cache.set(lang, fs.existsSync(f) ? new Ngrams(JSON.parse(fs.readFileSync(f, 'utf8'))) : null);
    }
    return cache.get(lang);
  }
  constructor(doc) { this.uni = doc.uni; this.bi = doc.bi; this.tri = doc.tri; this.tokens = doc.tokens; this.sources = doc.sources; }
  word(w) { return this.uni[w] || 0; }
  pair(a, b) { return this.bi[`${a} ${b}`] || 0; }
  triple(a, b, c) { return this.tri[`${a} ${b} ${c}`] || 0; }
}

// Afrikaans writes the article 'n with an apostrophe the tokenizer drops: the corpora were counted the same way ("n").
const keysOf = (text, lang) => tokenize(text, lang).map((t) => t.key);

/**
 * How a token stands in its line, by the corpus: the best pair (with the word before or after) and triple around it.
 * @returns {{pairs: Array<[string, number]>, triple: [string, number] | null, best: number, word: number} | null}
 */
export function contextOf(text, lang, surface) {
  const ng = Ngrams.load(lang);
  if (!ng) return null;
  const ks = ['<s>', ...keysOf(text, lang), '</s>'];
  const key = keysOf(surface, lang)[0];
  const i = ks.indexOf(key);
  if (i < 0) return null;
  const pairs = [];
  if (i > 0 && ks[i - 1] !== '<s>') pairs.push([`${ks[i - 1]} ${key}`, ng.pair(ks[i - 1], key)]);
  if (i < ks.length - 1 && ks[i + 1] !== '</s>') pairs.push([`${key} ${ks[i + 1]}`, ng.pair(key, ks[i + 1])]);
  let triple = null;
  if (i > 0 && i < ks.length - 1) { const n = ng.triple(ks[i - 1], key, ks[i + 1]); if (n) triple = [`${ks[i - 1]} ${key} ${ks[i + 1]}`, n]; }
  const best = Math.max(0, ...pairs.map(([, n]) => n), triple ? triple[1] * 3 : 0);
  return { pairs, triple, best, word: ng.word(key) };
}
