// Concord / agreement check for the Nguni noun classes (isiZulu, isiXhosa) and Sesotho (9 Oct 2026).
//
// Rule-based and deliberately narrow: it speaks only where the grammar leaves no room. A noun's class comes from its
// prefix (and, when given, a lexicon of known classes — the union is taken, so either source can only make the check
// MORE permissive); a following concord is read only when its form belongs to a small set of classes. A finding is
// raised when the concord's classes and the noun's classes have nothing in common.
//
//   Nguni (conjunctive): the subject concord is fused to the next word — "Imvula iyana" (9: i-), "Izulu liyaduma"
//     (5: li-), "Amafu ayahamba" (6: a-). Read only for the unambiguous concords ba- li- zi- lu- bu-; the vowel
//     concords (u- i- a-), ku- and si- stand for too many classes (si- is also "we"), or for a locative, to be evidence.
//     Possessives in -ase / -aka (wase, yasekhaya, lasebusuku, zakwa …): w(1,3) y(4,9) l(5) s(7) z(8,10) b(2,14)
//     kw(15,17) lw(11) a(6).
//   Sesotho (disjunctive): the subject concord is its own word, so "pula e a na", "letsatsi le a chesa". It is read
//     only when a tense/aspect marker follows it (a, tla, tlo, ne, ntse, sa, ka, se) — 'le' is also "and", 'e' also
//     "it is", 'a' also a question particle, so without that marker the word is not taken as a concord.
//     Sesotho possessives (wa/oa ya/ea la sa tsa ha …) are NOT judged: they only end the look-ahead, because the head
//     of a possessive is too often not the clause's first word ("Dibomo tse nyenyane tsa leqhwa"). Measured, not assumed.
//
// A clause boundary (any punctuation) ends the look-ahead. Proper names (capitalised mid-sentence), loans with a
// hyphen (i-Toyota) and the words the pack's lexicon protects are never judged.
//
//   import { concordFindings } from './concord.mjs';
//   concordFindings('Imvula liyana.', 'zu')  → [{ noun: 'imvula', classes: ['9'], concord: 'li', concordClasses: ['5'], … }]

const NGUNI_PREFIX = [
  // longest first; each → the classes that prefix can mark
  [/^izin|^izim/, ['10']], [/^iin|^iim/, ['10']], [/^imi/, ['4']], [/^ama/, ['6']], [/^ame/, ['6']], [/^aba|^abe/, ['2']],
  [/^ubu/, ['14']], [/^uku/, ['15']], [/^ulu/, ['11']], [/^isi|^is(?=[aeiou])/, ['7']], [/^izi|^iz(?=[aeiou])/, ['8', '10']],
  [/^ili/, ['5']], [/^umu|^um/, ['1', '3']], [/^in|^im/, ['9']], [/^oo/, ['2']], [/^o/, ['2']], [/^ii/, ['10']],
  [/^i/, ['5', '9']], [/^u/, ['1', '3', '11', '14']], [/^a/, ['6']],
];
// si- is left out: it is also 'we' (Abafundi sisheshe … — a topic, then 'we hurried'), as often as class 7
const NGUNI_PREFIX_FIRM = [[/^izin|^izim|^iin|^iim/, ['10']], [/^imi/, ['4']], [/^ama/, ['6']], [/^aba|^abe/, ['2']], [/^ubu/, ['14']], [/^uku/, ['15']], [/^ulu/, ['11']], [/^isi/, ['7']], [/^ili/, ['5']]];
const NGUNI_SC = { ba: ['2', '14'], li: ['5'], zi: ['8', '10'], lu: ['11'], bu: ['14'] };
const NGUNI_POSS = [[/^kwa(se|ka)/, ['15', '17']], [/^lwa(se|ka)/, ['11']], [/^wa(se|ka)/, ['1', '3']], [/^ya(se|ka)/, ['4', '9']], [/^la(se|ka)/, ['5']],
  [/^sa(se|ka)/, ['7']], [/^za(se|ka)/, ['8', '10']], [/^ba(se|ka)/, ['2', '14']]];
// words that open like a concord but are not one
const NGUNI_NOT_VERB = /^(bani|bantu|bafana|baba|bese|basi|lapho|lapha|lokhu|lezi|lesi|leli|lolu|lobu|lowo|lawo|lena|leyo|sikhathi|sizwe|siyabonga|zonke|zinto|lutho|buhle|bukhulu|bona|bonke|sonke|lonke|lwakho|bakho|lakho|sakho|zakho|kakhulu)$/;
// conjunctions and negative copulas that look like class 15 / 6 nouns
const NGUNI_NOT_NOUN = new Set('ukuba ukuthi ukuze ukuthi ukuthi akukho akukhona akuyona akuzange angazi andazi akusiyo akunjalo akuphelanga ukuba uma ukuqala ukugcina okanye ukuthi'.split(' '));
// Nguni nouns open with a vowel; a word opening with a consonant is not a noun subject here
const nguniNoun = (w) => /^[aiu][a-z]{3,}$/.test(w);

const SOTHO_PREFIX = [
  [/^di/, ['8', '10']], [/^li/, ['8', '10']], [/^ma/, ['6']], [/^me/, ['4']], [/^mo/, ['1', '3']], [/^ba/, ['2']], [/^bo/, ['14', '2']],
  [/^le/, ['5']], [/^se/, ['7']], [/^ho/, ['15']],
];
const SOTHO_SC = { le: ['5'], se: ['7'], di: ['8', '10'], li: ['8', '10'], bo: ['14'], ba: ['2'], o: ['1', '3'], e: ['4', '9'], a: ['6'] };
// concords that mark one class only; the others need present-tense 'a' after them to count
const SOTHO_SC_FIRM = new Set(['le', 'se', 'di', 'li', 'bo', 'ba']);
const SOTHO_TAM = new Set(['a', 'tla', 'tlo', 'ne', 'ntse', 'sa', 'ka', 'se', 'ile', 'tlile']);
const SOTHO_POSS = { wa: ['1', '3'], oa: ['1', '3'], ba: ['2', '14'], ya: ['4', '9'], ea: ['4', '9'], la: ['5'], sa: ['7'], tsa: ['8', '10'], ha: ['15', '17'] };
const SOTHO_FUNCTION = new Set('lena leha bana bakeng lesotho basotho maseru mme mang eng neng kae jwang joang le la ya ea wa oa ba sa tsa a e o ho ha ka ke hore empa kapa feela haholo hanyane jwale joale jwalo joalo mona moo teng ee che hobane ntle fela kaofela bohle tsohle wena nna rona lona bona yena ena re u di li se eo ona tse tsena tseo sena seo hape hle ntse ile tla tlo ne hase eseng eona'.split(' '));
// Sesotho nouns with no class prefix (class 9 singulars and 1a kin terms) — the prefix rules cannot see them
const SOTHO_BARE = { pula: ['9'], ntate: ['1'], mme: ['1'], nko: ['9'], kgomo: ['9'], ntja: ['9'], katse: ['9'], tsela: ['9'], nako: ['9'], hlabula: ['9'], mariha: ['6'], serame: ['7'], phefo: ['9'], komello: ['9'], tsatsi: ['5'] };

function classesOf(word, lang, lexicon) {
  const out = new Set();
  const lex = lexicon?.[word];
  if (lex) {
    // a Sesotho bare noun tagged 10 (the pair 9/10 shares one lemma in the dictionaries) is a class 9 singular
    if (lang === 'st' && lex === '10' && !/^(di|li)/.test(word)) out.add('9'); else out.add(String(lex));
  }
  if (lang === 'st') {
    if (SOTHO_BARE[word]) SOTHO_BARE[word].forEach((c) => out.add(c));
    const p = SOTHO_PREFIX.find(([re]) => re.test(word));
    if (p && word.length >= 4) p[1].forEach((c) => out.add(c));
  } else if (!lex) {
    // a known class wins over the ambiguous prefixes (izulu is i-zulu, class 5, not iz-)
    const p = NGUNI_PREFIX.find(([re]) => re.test(word));
    if (p) p[1].forEach((c) => out.add(c));
  } else {
    // the unambiguous prefixes still count beside it (the dictionaries tag some nouns wrongly: abamhlophe as 3)
    const p = NGUNI_PREFIX_FIRM.find(([re]) => re.test(word));
    if (p) p[1].forEach((c) => out.add(c));
  }
  // 1a and 2a take the concords of 1 and 2 (udokotela waseKapa)
  if (out.has('1a')) out.add('1');
  if (out.has('2a')) out.add('2');
  return [...out];
}

const TOKEN = /[\p{L}][\p{L}'’-]*|[.,;:!?…—–()"“”]/gu;

/**
 * @param {string} text   one line
 * @param {'zu'|'xh'|'st'} lang
 * @param {{lexicon?: Record<string,string>, protect?: Set<string>}} [opts]
 *   lexicon: word → class (e.g. the lang-check index's nounClass); protect: words never judged
 * @returns {Array<{kind:'subject'|'possessive', noun:string, classes:string[], concord:string, concordClasses:string[], at:string, message:string}>}
 *
 * The subject is the clause's FIRST word, when that word is a noun (the head of "Modumo wa seaduma o a tla" is modumo,
 * not seaduma); its concord is the first concord in the next four words. Measured on native text (corpus-confirmed
 * lines and 10,000 Leipzig sentences per language) before any gold item was scored.
 */
export function concordFindings(text, lang, opts = {}) {
  if (!['zu', 'xh', 'st'].includes(lang)) return [];
  const toks = [];
  for (const m of String(text || '').normalize('NFC').matchAll(TOKEN)) toks.push({ raw: m[0], i: m.index, punct: !/\p{L}/u.test(m[0]) });
  const out = [];
  const protect = opts.protect || new Set();
  const lex = opts.lexicon || {};
  for (let k = 0; k < toks.length - 1; k++) {
    const a = toks[k];
    if (a.punct || (k > 0 && !toks[k - 1].punct)) continue; // clause-initial only
    if (/[-'’]/.test(a.raw)) continue;
    const n = a.raw.toLowerCase();
    if (protect.has(n)) continue;
    // the clause's next words, up to the next punctuation
    const rest = [];
    for (let j = k + 1; j < toks.length && !toks[j].punct && rest.length < 5; j++) rest.push(toks[j]);
    if (!rest.length) continue;
    if (lang === 'st') {
      if (SOTHO_FUNCTION.has(n) || n.length < 4 || /^\p{Lu}{2,}/u.test(a.raw) || /ng$/.test(n)) continue; // -ng: a locative, not a subject
      const cls = classesOf(n, lang, lex);
      if (!cls.length || (!lex[n] && !SOTHO_BARE[n])) continue; // a noun the dictionaries know (Barbera, Lesotho … are not judged)
      // the FIRST concord-like word of the clause decides: past it lies a relative or a second clause
      const j = rest.findIndex((t) => SOTHO_SC[t.raw.toLowerCase()] || SOTHO_POSS[t.raw.toLowerCase()]);
      if (j >= 0 && j < 4 && j + 1 < rest.length) {
        const v = rest[j].raw.toLowerCase(), next = rest[j + 1].raw.toLowerCase();
        // 'e' and 'o' also mark "it" and "you", 'a' a participial or "he/she": read them only before present-tense 'a';
        // 'e ne e le' is the impersonal past copula
        const ok = SOTHO_SC[v] && (SOTHO_SC_FIRM.has(v) ? SOTHO_TAM.has(next) : next === 'a' && v !== 'a');
        if (!ok) continue;
        const cc = SOTHO_SC[v];
        if (!cc.some((c) => cls.includes(c))) out.push({ kind: 'subject', noun: n, classes: cls, concord: v, concordClasses: cc, at: [a, ...rest.slice(0, j + 2)].map((t) => t.raw).join(' '),
          message: `'${n}' is class ${cls.join('/')} but '${v}' is the subject concord of class ${cc.join('/')} (expected ${expectSotho(cls)})` });
      }
      continue;
    }
    // Nguni: the subject must be a noun the lexicon knows (an unknown vowel-initial word is as often a verb or a conjunction)
    if (!nguniNoun(n) || NGUNI_NOT_NOUN.has(n) || !lex[n]) continue;
    const cls = classesOf(n, lang, lex);
    const v0 = rest[0].raw.toLowerCase();
    const poss = NGUNI_POSS.find(([re]) => re.test(v0));
    if (poss && !poss[1].some((c) => cls.includes(c))) {
      out.push({ kind: 'possessive', noun: n, classes: cls, concord: v0.replace(/(se|ka).*$/, ''), concordClasses: poss[1], at: `${a.raw} ${rest[0].raw}`,
        message: `'${n}' is class ${cls.join('/')} but '${rest[0].raw}' carries the possessive of class ${poss[1].join('/')}` });
      continue;
    }
    for (const t of rest.slice(0, 3)) {
      const v = t.raw.toLowerCase();
      if (/^[aeiou]/.test(v)) continue; // an adjective, relative or possessive of the noun: keep looking
      if (NGUNI_NOT_VERB.test(v) || v.length < 5 || /[-'’]/.test(v)) break;
      // a possessive in ka- (sikaphethiloli, likaNkulunkulu) or a noun that lost its vowel after a demonstrative
      // (ezi zifundo): not a verb
      if (/^(s|l|z|b|w|y|kw|lw)i?ka/.test(v) || lex['i' + v] || lex['u' + v] || lex['a' + v]) break;
      const sc = Object.keys(NGUNI_SC).find((x) => v.startsWith(x) && /^[a-z]/.test(v.slice(x.length)));
      if (!sc) break;
      // a copulative or agentive of a noun (lilanga "by/it is the sun" = li + ilanga): a noun, not a verb
      const stem = v.slice(sc.length);
      if (['i', 'u', 'a'].some((p) => lex[p + stem]) || lex[stem]) break;
      const cc = NGUNI_SC[sc];
      if (!cc.some((c) => cls.includes(c))) out.push({ kind: 'subject', noun: n, classes: cls, concord: sc, concordClasses: cc, at: `${a.raw} … ${t.raw}`,
        message: `'${n}' is class ${cls.join('/')} but '${t.raw}' opens with the class ${cc.join('/')} subject concord '${sc}-'` });
      break;
    }
  }
  return out;
}

const ST_SC_OF = { 1: 'o', 3: 'o', 2: 'ba', 4: 'e', 9: 'e', 5: 'le', 6: 'a', 7: 'se', 8: 'di', 10: 'di', 14: 'bo', 15: 'ho' };
const expectSotho = (cls) => [...new Set(cls.map((c) => ST_SC_OF[c]).filter(Boolean))].map((s) => `'${s}'`).join(' or ');
