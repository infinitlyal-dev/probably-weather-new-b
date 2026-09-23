// Write the "Translating a line" section into each per-language skill (Part 2, step 8 — 2026-09-23).
//
// The four skills (.claude/skills/{af,zu,xh,st}-qc/SKILL.md) were checkers only: nothing in them told
// a translator how to translate. This generator writes one section between markers in each —
//   <!-- translate:start --> … <!-- translate:end -->
// — from material that is allowed to be seen:
//   - the rules below (keyed-English rule, details, advice, joke adaptation, loanwords, labels)
//   - the weather and safety word lists (wordlists/<lang>.json, corpus-verified), with the native
//     reviewers' corrections winning over a corpus term (TRAPS)
//   - for Sesotho, the South African orthography rules (rules/st-orthography.json) and Al's rulings
//   - real reference examples from the DEV gold sets only, chosen by id below; the sealed test sets are
//     never opened here. Sesotho examples are re-spelled to SA orthography (st-respell.mjs) because the
//     native references still carry Lesotho forms.
// The ids used are written to output/translation-skills/skill-examples.json so a dev evaluation can
// leave them out (an example the skill shows is not a test of the skill).
//
//   node scripts/translation-skills/build-skill-guidance.mjs [--round 1]
//   then: node scripts/translation-skills/check-leak.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { respell } from './st-respell.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const here = path.join(root, 'scripts', 'translation-skills');
const args = process.argv.slice(2);
const ROUND = (() => { const i = args.indexOf('--round'); return i >= 0 ? Number(args[i + 1]) : 1; })();
const rd = (p) => JSON.parse(readFileSync(p, 'utf8'));
const NAME = { af: 'Afrikaans', zu: 'isiZulu', xh: 'isiXhosa', st: 'Sesotho' };
const types = new Map(rd(path.join(root, 'output', 'translation-skills', 'taxonomy', 'all.json')).filter((r) => r.population === 'correction').map((r) => [r.id, r]));

// Dev ids, chosen to cover the error types the taxonomy counted (detail dropped, literal/calque, joke
// lost, wrong key, reversed, spelling) with the reviewer's own reason. Nothing from a test set.
const EXAMPLES = {
  af: ['af-dev-0002', 'af-dev-0026', 'af-dev-0096', 'af-dev-0110', 'af-dev-0149', 'af-dev-0162', 'af-dev-0178', 'af-dev-0255', 'af-dev-0275', 'af-dev-0280', 'af-dev-0298', 'af-dev-0306', 'af-dev-0308'],
  zu: ['zu-dev-0008', 'zu-dev-0023', 'zu-dev-0053', 'zu-dev-0059', 'zu-dev-0129', 'zu-dev-0134', 'zu-dev-0140', 'zu-dev-0155', 'zu-dev-0251', 'zu-dev-0274'],
  xh: ['xh-dev-0001', 'xh-dev-0143', 'xh-dev-0025', 'xh-dev-0027', 'xh-dev-0052', 'xh-dev-0069', 'xh-dev-0097', 'xh-dev-0114', 'xh-dev-0160', 'xh-dev-0170', 'xh-dev-0297', 'xh-dev-0332'],
  st: ['st-dev-0003', 'st-dev-0060', 'st-dev-0072', 'st-dev-0082', 'st-dev-0124', 'st-dev-0141', 'st-dev-0147', 'st-dev-0149', 'st-dev-0172', 'st-dev-0175', 'st-dev-0226', 'st-dev-0268'],
};

// Word-level lessons from the native reviews (dev corrections and the pack's bans). A native ruling
// beats a corpus attestation: the corpus list offers isiZulu "kuhlanzekile" for clear, which the
// reviewer struck as "clean".
const TRAPS = {
  af: [
    ['devastating (slang: stunning)', 'not "verwoestend" (destructive)'],
    ['around (present)', '"hier", not "rond" (round)'],
    ['strength (of wind)', '"hoe sterk" / "hoeveel", not "sterkte" (reads as "good luck")'],
    ['wipers', '"wipers" / "ruitveërs", never "veërs" (feathers)'],
    ['give or take', '"plus minus", not "gee of vat"'],
    ['stay alert', '"bly paraat", not "bly los op wag"'],
    ['invented for', '"geskep vir", not "uitgevind vir"'],
    ['having a moment / doing the most', 'no calque ("het \'n oomblik" does not exist); rebuild the idea'],
  ],
  zu: [
    ['clear (sky, night)', '"licwebile" / "obucacile" — never "hlanzekile" (that is clean)'],
    ['here (rain\'s here)', '"isifikile" (has arrived), not "ikhona" (is present)'],
    ['severe', 'add "kakhulu": "Isimo sezulu esibi kakhulu"'],
    ['storms (plural)', '"Iziphepho ziyeza" — keep the English number'],
    ['thunder', '"ukuduma kwezulu" — "ukuduma" alone is any roar'],
    ['High UV', '"Izinga le-UV liphezulu" (the level)'],
    ['chilly / cold (labels)', '"Kuyabanda kancane" / "Makhaza" — label forms, not "Kupholile"'],
    ['clothes and household words', 'nativise: ijezi, igawuni, isikhafu, amateki, isitsha sesilwane'],
    ['Xhosa forms', 'never ngoku, kuba, imozulu, kushushu, ndiya in an isiZulu line'],
  ],
  xh: [
    ['clear (sky, night)', '"sicacile" / "obucacileyo" — never "hlanzekile" (clean) or "obuhle" (beautiful)'],
    ['attitude', '"isimo sengqondo", not "isimilo" (moral character)'],
    ['zero', '"kungabikho" / "akukho nto", never "iqanda" (egg)'],
    ['seagulls', '"iingabangaba" — "iinkonjane" are swallows'],
    ['world', '"umhlaba" / "ihlabathi" as the reviewer has it; check the sense'],
    ['braai', 'keep "ibraai" / "ukosa inyama", not "ukugrila"'],
    ['cold front', '"ingqele", not the generic "amakhaza"'],
    ['cold (car seats etc.)', '"ziyabanda", not "ziyaqanda" (freeze solid)'],
    ['Zulu forms', 'never ngiya, manje, lapho, futhi, izulu, kushisa, uma, ngoba in an isiXhosa line'],
  ],
  st: [
    ['sunscreen', '"setlolo sa letsatsi" — never "setofo"'],
    ['storm', '"sefefo"; thunder "seaduma" ("modumo wa seaduma") — not "modumo wa lehodimo"'],
    ['mist / fog', '"mohodi" (Al\'s ruling), not "moholi"'],
    ['owls', '"merubisi" — "dikgogo" are chickens'],
    ['Milky Way', '"Molalatladi", not the calque "Tsela ya Lebese"'],
    ['feel sorry for', '"utlwela bohloko" — "tshwarela" is forgive'],
    ['braai (a steak)', '"besa", not the generic "tjhesa" (burn/hot)'],
    ['biltong', '"sehwapa"'],
    ['sunrise / sunset (labels)', '"Ho chaba ha letsatsi" / "Ho likela ha letsatsi" — "mafube" is dawn'],
    ['Setswana / Sepedi forms', 'never gore, go, gape, jaanong, gompieno, bosigo, fela, thata, legodimo, bjalo, lehono'],
  ],
};
const DROP_TERMS = { zu: ['kuhlanzekile'], xh: ['hlanzekile'] };

const esc = (s) => String(s).replace(/\|/g, '\\|');
const restoreAf = (s) => s.replace(/(^|[\s(])n(?=\s)/g, "$1'n").replace(/\breen\b/g, 'reën').replace(/\bReen\b/g, 'Reën').replace(/kalM/g, 'kalm').replace(/peraat/g, 'paraat');

function wordTable(lang) {
  const w = rd(path.join(here, 'wordlists', `${lang}.json`));
  const drop = new Set(DROP_TERMS[lang] || []);
  const rows = w.weather.map((e) => {
    const terms = e.terms.filter((t) => (t.verified || t.inReviewedBank) && !drop.has(t.term)).map((t) => t.term);
    return terms.length ? `| ${e.id} | ${esc(terms.slice(0, 4).join(', '))} |` : null;
  }).filter(Boolean);
  const safety = w.safety.map((s) => `| **${s.id}** (advice) | ${esc(s.terms.filter((t) => !drop.has(t)).join(', '))} |`);
  return ['| English | ' + NAME[lang] + ' (corpus-verified or native-reviewed) |', '|---|---|', ...safety, ...rows].join('\n');
}

function examples(lang) {
  const dev = new Map(rd(path.join(here, 'gold', `${lang}-dev.json`)).items.map((g) => [g.id, g]));
  const out = [];
  for (const id of EXAMPLES[lang]) {
    const g = dev.get(id);
    if (!g) throw new Error(`${id} is not in the ${lang} dev set`);
    const t = types.get(g.feedbackId);
    let now = g.reference, was = g.rejected || '';
    let respelled = false;
    if (lang === 'st') { const a = respell(now, g.en), b = respell(was, g.en); respelled = a.changes.length > 0; now = a.text; was = b.text; }
    if (lang === 'af') { now = restoreAf(now); was = restoreAf(was); }
    out.push({ id, type: t?.primary || 'OTHER', en: g.en, was, now, why: t?.note || '', respelled });
  }
  return out;
}

const COMMON = (lang) => [
  `## Translating a line into ${NAME[lang]} (round ${ROUND}, 2026-09-23)`,
  '',
  `These are the rules a translator follows. They come from 306 flagged live lines (the taxonomy in \`scripts/translation-skills/TAXONOMY.md\`: 131 details dropped or changed, 106 jokes lost, 21 too literal, 11 meanings reversed, 9 keyed to the wrong English) and from every native correction on record. The checks further down this file stay as they were.`,
  '',
  '1. **Translate the English line you were given — the current English it is keyed to.** Not the Afrikaans, not another language\'s line, not an older wording, not a neighbouring line on the same photograph. Nine live lines were translations of a sibling line; the isiZulu, isiXhosa and Sesotho partly-cloudy lines of April followed the Afrikaans list instead of the English.',
  '2. **Keep every detail a reader would notice:** who and what (a seagull stays a seagull, Instagram stays Instagram), the place (Karoo, N1, Table Mountain, Joburg), the time (tonight, 6am, Tuesday, "yet", "again"), numbers and units (keep the digits; 7pm → 19:00 is fine), degree words ("-ish", "very", "more than", "the worst"), and whether something is or is not happening. Do not make a named thing generic, and do not swap it for another thing.',
  '3. **Advice is exact.** When the English tells someone to do something — headlights on, sunscreen, stay inside, drink water, unplug, stay off flooded roads, hold on to the braai cover — the line says the same thing to do, with the same object, and never the opposite. Keep the English\'s strength too: "wouldn\'t hurt" is a suggestion, "non-negotiable" is an order. Use the safety words in the table.',
  '4. **Jokes: carry the point, not the words.**',
  '   - If the joke works word for word, keep it.',
  `   - If the pun or idiom does not exist in ${NAME[lang]}, rebuild it with a ${NAME[lang]} turn of phrase that makes the **same point about the same thing** (the sun playing peek-a-boo stays a sun hiding and showing).`,
  '   - Never swap in a different joke about a different subject, and never add a place, a day, a braai, a person or a brand the English does not have.',
  '   - If nothing carries, a plain warm line that keeps every detail beats a clever line that says something else.',
  '5. **No calques.** "Having a moment", "doing the most", "brave face", "on the cards", "it is what it is", "models permitting" do not exist word for word — say what they mean.',
  `6. **Translate what has a ${NAME[lang]} word.** Keep proper nouns, brands and the loanwords South Africans actually use (braai, bakkie, Instagram, sunscreen where the reviewers kept it). Do not leave "pet bowl", "bird feeder", "winter", "school" or "lekker koud" untranslated.`,
  '7. **South African words and quotes stay South African.** Braai (the noun), bakkie, lapa, stoep, koppie, boet keep their word, with the prefix the language gives a loan. A phrase the English puts in quotation marks stays exactly as quoted — it is what people say. Where a native reviewer chose a word of the language (Sesotho *besa* for braaiing a steak, *sehwapa* for biltong), use theirs.',
  '8. **Keep the image in modern metaphors.** When the English makes the weather a phone, a computer, an office, television or social media (loading, on airplane mode, out of office, trending, a notification, a subscription), the joke is that image. Carry it — with the language\'s own word if one carries it, otherwise the loanword the way people say it (with the prefix) — and do not replace it with a plain description of the weather.',
  '9. **Labels stay labels.** A short label (Chilly, Clear night, High UV, Sunset) gets the natural label form, not a sentence.',
  '10. **Output only the translation** — no notes inside the line, no quotation marks the English does not have.',
  '',
];

const SPECIFIC = {
  af: [
    '### Afrikaans: Al is the native author',
    '',
    '- Al rules Afrikaans himself. His own lines are adaptations on purpose ("It is purposefully different because the humor reads differently in Afrikaans" — his note, 2026-09-23): an Afrikaans joke that makes the same point in its own way is right, and a word-for-word line that goes flat is wrong.',
    '- He keeps English words Afrikaans speakers use: freestyle, horror movie, scorcher, tan lines, mute, wipers, snooze, sundowner, Instagram. Do not replace a named thing with another one ("Instagram" stays — he struck "troufoto").',
    "- Spelling: 'n with the apostrophe; reën, môre, wêreld, sê, lê, vroeë, spieël with their marks; the double negative closes with nie; verb second (\"Ten minste reën dit nie\").",
    '- Tags: "ne" where the English has "hey" is his preference.',
    '',
  ],
  zu: ['### isiZulu specifics', '', '- Subject concords agree with the noun class and the English number (plural storms → iziphepho ziyeza).', '- Loanwords take the class prefix and are nativised where a word exists (ijezi, igawuni); SA loans without a Zulu word keep the hyphen (i-bakkie, ama-hadedas).', ''],
  xh: ['### isiXhosa specifics', '', '- The reviewers prefer natural colloquial isiXhosa over formal: "noko" not "ubuncinane", "qha" not "kuphela", loanwords people use (iHat, sunscreen, ibraai) over coined formal words.', '- A bare fragment ("Nto.") or a verbless calque ("Mhlawumbi imvula") is not natural — give it a verb.', '- Commands stay commands when the English commands ("Cima ii-high beam"), and a hedge stays a hedge.', ''],
  st: [],
};

function stOrthography() {
  const st = rd(path.join(here, 'rules', 'st-orthography.json'));
  return [
    '### Sesotho is written in the South African orthography (Al, 2026-09-06)',
    '',
    'Every rule below is backed by South African government text (NCHLT GOV-ZA, the Constitution) and the .za web; the rule checks fail a line that breaks one. The June native reviewer wrote in the Lesotho orthography: that is spelling, not a ruling on meaning, and it is not the house standard.',
    '',
    '| Lesotho → South Africa | Rule |',
    '|---|---|',
    ...st.rules.map((r) => `| ${esc(r.id)} | ${esc(r.what)} |`),
    '| moholi→mohodi | mist — Al\'s ruling by name |',
    '',
    'So: "ya", "wa", "tsh", "di-", "nn", "jwale", "moya", "lehodimo", "tswa", "nngwe", "tjhesa", "wena", "o" (you). Keep Sesotho, not Setswana or Sepedi (see the traps).',
    '',
  ];
}

const used = {};
for (const lang of ['af', 'zu', 'xh', 'st']) {
  const ex = examples(lang);
  used[lang] = ex.map((e) => e.id);
  const section = [
    '<!-- translate:start — generated by scripts/translation-skills/build-skill-guidance.mjs; edit the generator, not this block -->',
    ...COMMON(lang),
    ...(lang === 'st' ? stOrthography() : SPECIFIC[lang]),
    `### Words (weather and safety)`,
    '',
    wordTable(lang),
    '',
    `### Traps the native reviewers corrected`,
    '',
    ...TRAPS[lang].map(([a, b]) => `- **${a}** — ${b}`),
    '',
    `### Real corrections (dev set — what was live, what the reviewer made it, and why)`,
    '',
    ...ex.flatMap((e) => [
      `- **${e.type}** — "${e.en}"`,
      `  - was: ${e.was || '—'}`,
      `  - now: ${e.now}${e.respelled ? ' *(re-spelled to SA orthography)*' : ''}`,
      ...(e.why ? [`  - why: ${e.why}`] : []),
    ]),
    '',
    '<!-- translate:end -->',
  ].join('\n');
  const f = path.join(root, '.claude', 'skills', `${lang}-qc`, 'SKILL.md');
  const src = readFileSync(f, 'utf8');
  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  const body = src.replace(/\r\n/g, '\n');
  const start = body.indexOf('<!-- translate:start'), end = body.indexOf('<!-- translate:end -->');
  let next;
  if (start >= 0 && end > start) next = body.slice(0, start) + section + body.slice(end + '<!-- translate:end -->'.length);
  else {
    // first write: the section goes right after the title block, before "## What backs it"
    const at = body.indexOf('\n## What backs it');
    if (at < 0) throw new Error(`${f}: no "## What backs it" heading to insert before`);
    next = `${body.slice(0, at)}\n\n${section}\n${body.slice(at)}`;
  }
  writeFileSync(f, next.replace(/\n/g, eol));
  console.log(`[guidance] ${lang}-qc: round ${ROUND}, ${ex.length} dev examples, ${TRAPS[lang].length} traps`);
}
mkdirSync(path.join(root, 'output', 'translation-skills'), { recursive: true });
writeFileSync(path.join(root, 'output', 'translation-skills', 'skill-examples.json'), JSON.stringify(used, null, 1));
