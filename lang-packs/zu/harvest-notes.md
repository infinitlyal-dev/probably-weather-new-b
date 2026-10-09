# isiZulu — harvest notes (contemporary register evidence)

First-pass harvest (bootstrap for the monthly Hermes/GPT seat). Patterns paraphrased from public
sources — **no sentences copied into the app**. Dated + sourced per the skill standard.

## 2026-07-17 — register & code-switching

**Urban vs "pure" register (the key calibration).** Isolezwe (Durban daily) deliberately uses an
*urban, modernising* isiZulu — its stated reader "goes home to slaughter a cow for amadlozi but is
equally at home at a mall dinner-and-movie." Its competitor Ilanga markets a "purer form." **The
app wants the Isolezwe register, not Ilanga** — colloquial, code-switched, accessible; never
textbook/liturgical. `Source: en.wikipedia.org/wiki/Isolezwe; isolezwe.co.za (2026-07-17). Quality: high (editorial self-description).`

**Code-switching is native, not sloppy.** Academic corpus work on KZN isiZulu confirms speakers
integrate isiZulu + English within a single utterance as normal practice; contemporary isiZulu
performance/social-media register is explicitly more accommodating of code-mixing than page-Zulu.
Keep braai, brand names, tech words, place names as loans. `Source: literator.org.za code-switching in isiZulu performance poetry; academia.edu socio-cultural code-switching KZN corpus (2026-07-17). Quality: high (peer-reviewed).`

## 2026-07-17 — weather-talk construction (attested patterns)

- **Impersonal weather via class-5 `izulu` (sky/weather) as subject:** rain = `izulu liyana`
  (the -li- concord agrees with izulu). Use this frame for sky-level statements.
- **Impersonal `ku-` for ambient temperature/state:** cold = `kuyabanda`, hot = `kuyashisa`,
  foggy = `kunenkungu`, snowing = `liyakhithika`. These are the natural everyday forms — prefer
  them over noun-heavy constructions. `Source: unisa.ac.za Learn Zulu Theme 4 (weather); omniglot.com/language/phrases/zulu; masteranylanguage Zulu idioms (2026-07-17). Quality: medium (teaching resources, cross-checked).`
- **Humour register:** the app's joke should ride the colloquial spoken frame (kuyabanda +
  a punch), not a proverb. isiZulu proverbs exist but read formal — save them for rare effect,
  don't default to them for a witty one-liner.

## Gaps to fill next harvest
- Confirmed everyday terms for: seagulls, kite, "expectations" (the calque casualties in
  errors-observed.md) — need a native or a strong corpus hit, not a model guess.
- Contemporary weather-humour samples from Isolezwe/Ukhozi social feeds (register calibration).

## 2026-10-09 — counts from current text (Vonk; `node scripts/lang-check/fetch-corpora.mjs ngrams`)
Stored as word / pair / triple counts only (`.lang-check-cache/ngrams/zu.json`); no sentence was kept. What each source gave:
Isolezwe 300 article pages → 75 464 tokens of isiZulu paragraphs; gov.za isiZulu pages 63 pages → 3 070 tokens (most of
the section is English); SABC News unreachable (its site loops redirects for any client without a browser — not worked
around); PanSALB's orthography rules not fetched (robots.txt disallows all). Local corpora counted the same way: 5.5 M tokens.
Paraphrased observations:
- Both "today" forms are current: namuhla (1 428) leads namhlanje (954) — neither is wrong in a line.
- Weather nouns in news and web text: umoya 1 627, ilanga 832, izulu 351, imvula 326; "isimo sezulu" as a phrase 174.
- Cold: amakhaza (54) is the running-text form; makhaza (7) and kuyabanda (5) are rare in prose but are the native
  reviewer's label forms — register, not error.
- Storm plural iziphepho is thin (7) against isiphepho (32): the plural the reviewer asked for is right, just rarely printed.
- licwebile (clear sky, the reviewer's correction) is attested once: a native word the corpus barely holds — protect it.
