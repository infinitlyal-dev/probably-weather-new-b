---
name: st-qc
description: Sesotho (st) translation quality checker for Probably Weather, backed by corpora. Use whenever working on the `st` column of `T` in `assets/app.js`, `INSTALL_T`, `PTR_COPY`, `WEATHER_COPY`, the provisional fills in `lang-packs/st/`, or new st transcreations. Triggers on: Sotho, Sesotho, ST translation, ST QC, st column, Mantaha, Sontaha, Sotho-Tswana, SADiLaR, CTexT, Sesotho word list, Setswana, Sepedi, lang-check. Conservative-by-default: the house orthography follows the native reviewer's rulings token by token; nothing is auto-applied.
---

# st-qc — Sesotho QC for Probably Weather

> **Status: corpus-backed (2026-09-06).** The check is `node scripts/lang-check.mjs --lang st`.
> It replaced the heuristic checklist from May 2026 after a validation exam against native rulings
> (`scripts/lang-check/exam-result.md`): wrong-sense recall 8% → 54%, wrong-language (Setswana /
> Sepedi / Nguni forms) recall 0% → 95%, spelling (the pack's banned forms) 0% → 100%, calques
> 0% → 100%, precision 12% → 38% on 520 native-good and 89 known-bad Sesotho lines.

## What backs it

Compiled by `node scripts/lang-check.mjs --build-index st` from `.lang-check-cache/`
(`node scripts/lang-check/fetch-corpora.mjs`; licences in `scripts/lang-check/lib/build-index.mjs`):

- **Bukantswe Sesotho–English dictionary** (sesotho.org, CC BY 3.0 ZA) — 10 072 entries: the
  main gloss source.
- **st.wiktionary** (full cache, 1 579 pages) — each entry gives the South African and the Lesotho
  orthography, an English gloss, noun class and a usage example.
- **Autshumato EN↔ST** (CC BY 2.5 ZA) — 5 621 words, phrases.
- **NCHLT Sesotho annotated corpus** (CC BY 2.5 ZA) — 69 776 tokens with lemma and class-tagged POS.
- **SADiLaR-II morphological annotations** (CC BY 4.0) — 73 727 segmented tokens: concord tables.
- **Leipzig `sot_community_2017`, `sot-za_web_2018_10K`** — 19 773 sentences, 34 289 forms with
  frequency, co-occurrence and examples. Small.
- **kaikki.org Sotho** — only 669 lemmas. **st.wikipedia** (2 099 articles). **Constitution (Sesotho)**.
- **Contamination references:** NCHLT Setswana and Sepedi corpora, Leipzig `tsn_community_2017`
  and `nso-za_web_2018_10K`, Autshumato Setswana/Sepedi lists; the isiZulu and isiXhosa indexes.
- **The app's own native bank** (`lang-packs/st/corpus-confirmed.jsonl`) and `banned-words.json`.

## How to run it

```bash
node scripts/lang-check.mjs --lang st --en "gusts" --text "lifofane"
node scripts/lang-check.mjs --file lines.json --verbose
node scripts/lang-check/triage.mjs --lang st                    # → review/lang-check-triage-st.md
```

## What it checks

Same four passes as zu-qc (`scripts/lang-check/lib/checker.mjs`), with these Sesotho specifics:

1. **Lexical.** Exact form, then relative `-ng` and concord prefixes stripped, then stem under
   another prefix. The pack's hard bans are HIGH with the house form quoted (`mohodi`→`moholi`,
   `tjhesa`→`chesa`, `hlonepha`→`hlompha`, `jwalo/jwale`→`joalo/joale`, `lifofane`, `setofo`,
   `Tsela ea Lebese`, `Leholimo le lebe`, `Modumo wa leholimo`); soft bans are MEDIUM (`tsie`,
   `dikgogo`, `motle`, `soupa`, `utsoarela`).
2. **Morphological.** Sesotho writes concords as separate words, so the check is NOUN followed by
   a class-specific concord (`le se di li bo ba`) of another class, and only when the pair never
   co-occurs in the corpus — LOW, evidence only.
3. **Semantic.** Gloss back-translation (Bukantswe + Wiktionary + Autshumato), the synonym table,
   the time-of-day clash, the near-miss rule (`mosi` smoke for `moea`, `mohlolo` miracle for
   `moholi`), expected words checked for presence. `lifofane` = airplanes against "gusts" is the
   canonical catch.
4. **Contamination.** Setswana and Sepedi markers (`gore`, `go`, `gape`, `jaanong`, `gompieno`,
   `bosigo`, `fela`, `thata`, `legodimo`, `bjalo`, `lehono`, `šoma`) and Nguni forms (`hlonipha`,
   `ukuthi`, `imvula`) are HIGH when unattested in Sesotho; a word attested in Setswana or Sepedi
   but in no Sesotho source is HIGH (different orthographies, so this is strong evidence).

## The orthography note (read before trusting any spelling flag)

The pack's dialect anchor says "SA-Sesotho spelling — `joalo`/`joale` (not Lesotho `jwalo`/`jwale`)".
The corpora show the opposite naming: `jwale` 907× and `jwalo` 2040× in the SA web and community
corpora, `joale` 85× and `joalo` 249×; likewise `lehodimo` 131× vs `leholimo` 76×, `tjhesa` 37× vs
`chesa` 16×. The forms the native reviewer ruled for (`joale`, `moholi`, `chesa`, `li-`, `ea/oa`)
are the Lesotho orthography, not the South African one. The tool enforces the reviewer's rulings
as the house standard and says so in the finding ("note the corpora attest 'jwale' 907×"). Whether
the house standard should be the SA orthography is Al's call, not the tool's.

## What it still cannot see

- **Wrong sense with no gloss or no expectation.** `Boko bo boholo` (brain for betrayal): Bukantswe
  glosses `boko` = brain, but Autshumato has no Sesotho for "betrayal", so nothing contradicts it.
- **`ho fihla ho` / `moea o otlang ka sefutho`** (the GPT-5.5 gust phrasings the native replaced)
  are attested verbs; the native's own `meea e fokang ka sefutho` passes.
- **`Tlanya` vs `Tobetsa`** (type vs press) — both attested, both glossed as UI verbs.
- **Coverage.** 53 111 attested forms is thin; `seaduma` (the reviewer's thunder word) is unattested
  outside this app while `seadumo` is — that is reported as a question, not a defect.

## Conservative protocol

> **Low confidence = defer to human. Never auto-apply.**

- `triage-high` / `triage` entries go to `TRIAGE_NATIVE_REVIEW.md` under Sesotho with evidence.
- Any st string equal to another language's string is HIGH (no shared genealogy), acronyms excepted.
- The tool never edits `assets/`.

## Examples

- ✅ CAUGHT: `lifofane` for gusts → HIGH (pack) + gloss 'airplanes'.
- ✅ CAUGHT: `Ho bata bosigo bona.` → `bosigo` attested in Setswana 122× (Leipzig tsn_community_2017,
  example quoted) and in no Sesotho source.
- ✅ CAUGHT: `Hlonepha modumo wa seaduma.` → `Hlonepha` banned (Nguni form), closest `hlonipha` 12× wiki.
- ⚠️ MISSED: `Dikausu tse metsi. Boko bo boholo.`
- ✅ CLEAN: `meea e fokang ka sefutho`, `Moea o a foka.`

## Output format

As zu-qc. If `action` is not `pass`, write the entry to `TRIAGE_NATIVE_REVIEW.md`; do not mutate `assets/`.
