---
name: af-qc
description: Afrikaans (af) translation quality checker for Probably Weather, backed by corpora. Use whenever working on the `af` column of the `T` object in `assets/app.js`, `INSTALL_T` in `assets/install.js`, `PTR_COPY`, `WEATHER_COPY` (`heroLabels`, `headlines`, `witty`), or the bespoke af transcreations in `review/af-batch-*.json`. Triggers on: Afrikaans, AF translation, Afrikaanse, AF QC, af column, Maandag, Sondag, braai, donder, Suidooster, AWS spelling, Pharos, lang-check. Conservative-by-default: the tool ranks doubts for a native reader and never applies a fix.
---

# af-qc — Afrikaans QC for Probably Weather

> **Status: corpus-backed (2026-09-06).** The check is `node scripts/lang-check.mjs --lang af`.
> It replaced the heuristic checklist that shipped in May 2026 after a validation exam against a
> gold set of native rulings (`scripts/lang-check/exam-result.md`): wrong-sense recall 6% → 50%,
> wrong-language (Dutch) recall 11% → 100%, precision 37% → 64% on 990 native-good and 75 known-bad
> Afrikaans lines. Confidence is evidence-backed — every finding cites the corpus hit.

## What backs it

Compiled by `node scripts/lang-check.mjs --build-index af` from `.lang-check-cache/` (fetched by
`node scripts/lang-check/fetch-corpora.mjs`; licences listed in `scripts/lang-check/lib/build-index.mjs`):

- **Hunspell af_ZA** (LibreOffice, LGPL) — 148 819 expanded forms, 3 351 with a diacritic. The
  authority for `wêreld`, `reën`, `môre`, `sê`, `lê`, `hê`, `oë`.
- **Leipzig `afr_mixed_2019_300K`** — 300 000 sentences, 263 698 word forms with frequency, plus
  neighbour co-occurrence (collocation evidence) and an example sentence per word.
- **kaikki.org Afrikaans** (English Wiktionary extract) — 9 909 lemmas with English glosses, the
  source of the back-translation.
- **Autshumato EN↔AF word/phrase lists** (CTexT, CC BY 2.5 ZA) — 6 238 words, 1 059 phrases: the
  "expected translation" side of the semantic check.
- **NCHLT Afrikaans annotated corpus** (CC BY 2.5 ZA) — 61 319 tokens with lemma and POS.
- **Constitution (Afrikaans text)** — attested formal register and an EN-aligned parallel text.
- **Hunspell nl_NL** — Dutch forms, used only to catch Dutch contamination (`niet`, `zijn`, `regen`).
- **The app's own native bank** (`lang-packs/af/corpus-confirmed.jsonl`) — listed in evidence but
  never counted as external attestation, because the bank is what is being checked.

Pharos Aanlyn, the WAT (woordeboek.co.za) and VivA's Woordeboekportaal are reachable but behind
logins with no API; they are not used. Nothing here is an AWS 2017 lookup; the diacritic authority
is Hunspell af_ZA plus corpus frequency.

## How to run it

```bash
# one line
node scripts/lang-check.mjs --lang af --en "Rain tonight" --text "Reen vanaand"

# a set (JSON array of {lang, en, text, key}); --verbose shows low notes and the back-translation
node scripts/lang-check.mjs --file lines.json --verbose

# the bespoke set awaiting Al's review → review/lang-check-triage-af.md
node scripts/lang-check/triage.mjs --lang af
```

Verdict per line: `{ confidence, action: pass | triage | triage-high, findings[], coverage, back }`.
`findings[].evidence` carries the source, the frequency and an attested sentence.

## What it checks (a–d in `scripts/lang-check/lib/checker.mjs`)

1. **Lexical.** Every content word is looked up (exact form, then as a solid compound of two
   attested words — Afrikaans writes `wintersdrafweer` solid). Unknown words get the closest
   attested form. A word whose diacritic variant is far more frequent (`wereld` 249× vs `wêreld`
   3182×) is a HIGH finding; the af-qc diacritic traps from the May checklist (`more`→`môre`,
   `se`→`sê` at clause end, `reen`→`reën`) survive as MEDIUM findings.
2. **Morphological.** The double negative: a clause with `nie/geen/nooit/niemand/niks/moenie` must
   close with `nie` (or end on the negator itself). Weekday abbreviations must be the AWS forms
   (`Ma Di Wo Do Vr Sa So`, or `Dins/Don/Vry/Sat/Son`). Mid-sentence capitals on common nouns are
   noted at LOW. Word order beyond this is not checked.
3. **Semantic.** The Afrikaans words are back-translated through their glosses and compared with
   the English source through a weather-domain synonym table (koud/cold counts for chilly). The
   source's own content words are checked for a dictionary-expected Afrikaans counterpart. A real
   word one letter from the expected word (`wond` for `wind`, `rein` for `reën`, `mes` for `mis`)
   is a near-miss finding. Collocation evidence from Leipzig is quoted when the doubtful word does
   co-occur with the line's other words.
4. **Contamination.** Dutch forms attested in nl_NL but not in Afrikaans (`niet`, `ik`, `wij`,
   `vandaag`, `regen`, `lucht`) are HIGH. English core weather words left untranslated (`rain`,
   `cloud`, `tonight`) are MEDIUM; `wind`, `storm`, `warm` are Afrikaans too and are exempt.
   Brand names and Al's deliberate code-switches (`braai`, `Weber`, `boet`) are recognised from the
   English line and the SA register list and are never flagged above LOW.

## What it still cannot see

- **Whether the joke lands.** A transcreation can be attested word for word and still miss. The
  side-by-side sheet (`review/af-side-by-side.html`) is the instrument for that; the tool is not.
- **A real word in a sense the dictionary also lists.** `Verwyder onlangs` (adverb for noun) is a
  calque the tool does not catch: both words are correct Afrikaans and the glosses overlap the source.
- **Diacritic homographs in ambiguous positions.** `se` (possessive) vs `sê` (says) mid-sentence,
  `le`/`lê`, `he`/`hê` are only caught at clause end or when the bare form is otherwise unattested.
- **Register and stiffness.** `Reën oggend` vs `Oggendreën` is invisible to it.
- **Al's own voice.** Al is the native author; a line he wrote is final even when the corpus
  prefers another spelling. The tool did flag four of his bank lines for `reen`/`wereld`
  (`review/lang-check-triage-af.md` AF-T1–T4) — those go to him as questions, not edits.

## Conservative protocol

> **Low confidence = defer to human. Never auto-apply.**

- `triage-high` (≥ 0.5) and `triage` (≥ 0.25) go to `TRIAGE_NATIVE_REVIEW.md` under the Afrikaans
  section with the tool's evidence quoted. `pass` means the corpora found nothing to object to.
- The tool never edits `assets/`. A fix reaches the bank only through Al's ruling on the sheet.
- Known legitimate duplicates with English (`Wind`, `Week`, `Sat`, `Son`, `Temp`, `UV`, `Later`,
  `in`) are not flagged.

## Examples (from the exam and the triage run)

- ✅ CAUGHT: `Nie die einde van die wereld nie` → HIGH morphology, `wêreld` 3182× vs `wereld` 249×,
  example from kaikki: "Van die wêreld se beste wyne kom van hierdie streek af."
- ✅ CAUGHT: `Dit regen niet vandaag.` → HIGH contamination (`regen`, `vandaag` Dutch markers; `niet`).
- ✅ CAUGHT: `Maa` for Mon → HIGH morphology, not an AWS abbreviation (expected `Ma`).
- ⚠️ MISSED: `Verwyder onlangs` (calque) and `Die tuin se uiteindelik dankie` (`sê` mid-sentence).
- ✅ CLEAN: `Die hond is onder die bed. Slim skuif, eerlikwaar.` passes with every word attested.

## Output format

```json
{
  "lang": "af", "en": "Not the end of the world.", "text": "Nie die einde van die wereld nie.",
  "confidence": 0.8, "action": "triage-high",
  "findings": [{ "check": "morphology", "severity": "high", "token": "wereld",
    "message": "'wereld' is attested 249× but 'wêreld' 3182× — missing diacritic",
    "evidence": { "suggestion": "wêreld", "cite": { "freq": 3182, "sources": ["kaikki","leipzig","hunspell"], "example": { "source": "kaikki #8", "text": "Van die wêreld se beste wyne kom van hierdie streek af." } } } }],
  "coverage": { "contentTokens": 3, "attested": 3, "unknown": 0, "enMatched": ["end"], "enUnmatched": ["world"] }
}
```

If `action` is not `pass`, write the entry to `TRIAGE_NATIVE_REVIEW.md`; do not mutate `assets/`.
