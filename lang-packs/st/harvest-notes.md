# Sesotho — harvest notes (contemporary register evidence)

First-pass harvest (bootstrap for the monthly Hermes/GPT seat). Patterns paraphrased — **no
sentences copied into the app**. Dated + sourced.

## 2026-07-17 — register & dialect

**SA-Sesotho, urban colloquial.** The app uses South African orthography (`jwalo`, `jwale`, `di-`,
`wa/ya`, `tjh`) — Al's ruling 2026-09-06; the closed native review was written in Lesotho spelling. Lesedi FM (SABC
Sesotho radio) register is the target: contemporary, warm, code-switched with English/Afrikaans,
not textbook. `Source: Lesedi FM (SABC) station profile; review/sesotho-replacements.txt native ruling (2026-07-17). Quality: high for dialect anchor (native-confirmed); medium for radio register (station description).`

**Code-switching is heavy and native in SA-Sesotho** — the confirmed corpus keeps jersey, gown,
takkies, braai, Southeaster, "lekker koud", brand + place names in English/Afrikaans. This is the
voice, not an error (see errors-observed.md).

## 2026-07-17 — weather-talk construction (attested patterns)

- **`leholimo`** = sky/heaven; **`boemo ba leholimo`** = the weather/conditions.
- **`pula`** = rain; **`ho na`** = to rain (pula e a na / pula e fihlile "the rain has arrived").
- **`serame`** = frost / bitter cold (NOT "dry season"); **`ho bata` / `ho phodile`** = it's cold;
  **`ho tjhesa`** = it's hot (SA orthography; the reviewer's `chesa` is the Lesotho spelling).
- **`mohodi`** = fog/mist (SA orthography; the reviewer's `moholi` is the Lesotho spelling). `Source: sesotho.web.za phrases + proverbs; omniglot.com/language/phrases/sesotho; translate.com boemo-ba-leholimo; native ruling review/sesotho-replacements.txt (2026-07-17). Quality: high (native-confirmed terms) + medium (phrase resources).`
- **Native idiom over calque:** Milky Way = `Molalatladi` (not "Tsela ea Lebese"). Astronomical /
  nature terms have native names — use them, never a literal EN translation.
- **Humour register:** warm colloquial spoken frame; proverbs (maele) exist but read formal —
  use sparingly.

## Gaps to fill next harvest
- Contemporary Lesedi FM / SA-Sesotho social weather-humour samples for register calibration.
- Confirm any remaining nature/animal terms before drafting relies on them (cf. tsie/tswiritswiri,
  dikgogo/merubisi corrections — the model's animal vocabulary was unreliable).

## 2026-10-09 — counts from current text (Vonk; `node scripts/lang-check/fetch-corpora.mjs ngrams`)
Stored as word / pair / triple counts only (`.lang-check-cache/ngrams/st.json`); no sentence was kept. What each source gave:
gov.za Sesotho pages 115 pages → 8 544 tokens. No current Sesotho news source answered: SABC News loops its redirects
for any client without a browser (not worked around); PanSALB's orthography rules are behind a robots.txt that disallows
all (not fetched). Local corpora counted the same way: 1.25 M tokens.
Paraphrased observations:
- The SA orthography holds in print: jwale 869 against joale 85; lehodimo 119 against leholimo 39; kajeno 326, the
  Setswana gompieno 0, bosiu 155 and bosigo 0.
- But "thata" (Setswana "very") is attested 250 times in the Sesotho corpora against haholo 1 657: the corpora carry
  Setswana strays, which is why the checker misses "Ho tjhesa thata" — a native rule (haholo, not thata) beats the count.
- ho a bata 2, ho a chesa 0 as triples: the corpora hold little conversational weather Sesotho.
