// Shared text helpers for lang-check: normalisation and tokenisation.
//
// Nguni (zu/xh) and Sotho (st) orthographies carry no diacritics in everyday text, so tone
// marks that Wiktionary adds (ímvúla) are stripped for those languages. Afrikaans keeps its
// circumflex/diaeresis (wêreld, reën) because they are load-bearing.

export const NGUNI = new Set(['zu', 'xh']);
export const SOTHO = new Set(['st', 'tn', 'nso']);

export function stripMarks(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC');
}

export function normalizeWord(word, lang) {
  let w = word.normalize('NFC').toLowerCase().replace(/[’‘`´]/g, "'");
  if (lang !== 'af' && lang !== 'nl') w = stripMarks(w);
  return w;
}

// Returns tokens with their original surface and a normalised key.
// Keeps internal hyphens/apostrophes (i-Toyota, 'n, don't) and splits them out as parts.
export function tokenize(text, lang) {
  const out = [];
  const re = /[\p{L}\p{M}][\p{L}\p{M}'’\-]*[\p{L}\p{M}]|[\p{L}\p{M}]/gu;
  let m;
  const src = text.normalize('NFC');
  while ((m = re.exec(src)) !== null) {
    const surface = m[0];
    const key = normalizeWord(surface, lang);
    const parts = key.split(/[-']/).filter(Boolean);
    out.push({ surface, key, index: m.index, parts, capital: /^\p{Lu}/u.test(surface) });
  }
  return out;
}

export function sentences(text) {
  return text
    .replace(/\r/g, '')
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// Cheap English content-word stemmer for gloss/source comparison.
export const EN_STOP = new Set(('a an the and or but of to in on at for with from by as is are was were be been being it its this that these those there here not no yes you your yours we our us they them their he she his her him i me my mine do does did done have has had having will would can could should shall may might must just only also very so too than then now still even ever never always again some any all each every much many more most less least few little lot lots out up down over under into onto off about around through after before while when where what which who whom whose why how if because although though unless until since get gets got getting go goes went going come comes came coming make makes made making take takes took taken taking let lets say says said one two three first last same other another such own like').split(' '));

export function enStem(w) {
  w = w.toLowerCase().replace(/[^a-z']/g, '');
  if (w.length <= 3) return w;
  if (w.endsWith("'s")) w = w.slice(0, -2);
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('sses')) return w.slice(0, -2);
  if (w.endsWith('es') && w.length > 4 && /[sxz]|ch|sh/.test(w.slice(-4, -2))) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us')) w = w.slice(0, -1);
  if (w.endsWith('ing') && w.length > 5) { w = w.slice(0, -3); if (/([b-df-hj-np-tv-z])\1$/.test(w)) w = w.slice(0, -1); return w; }
  if (w.endsWith('ed') && w.length > 4) { w = w.slice(0, -2); if (/([b-df-hj-np-tv-z])\1$/.test(w)) w = w.slice(0, -1); return w; }
  if (w.endsWith('ly') && w.length > 5) return w.slice(0, -2);
  return w;
}

export function enContentWords(text) {
  const toks = (text.toLowerCase().match(/[a-z][a-z'’-]*[a-z]|[a-z]/g) || []).map((t) => t.replace(/’/g, "'"));
  const seen = new Set();
  const out = [];
  for (const t of toks) {
    const base = t.replace(/^'|'$/g, '');
    if (!base || EN_STOP.has(base)) continue;
    const stem = enStem(base);
    if (stem.length < 2 || EN_STOP.has(stem)) continue;
    if (!seen.has(stem)) { seen.add(stem); out.push({ word: base, stem }); }
  }
  return out;
}

export function editDistance(a, b, max = 3) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = new Array(b.length + 1);
  const cur = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], prev[j - 1]);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}
