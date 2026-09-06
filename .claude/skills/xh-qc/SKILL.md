---
name: xh-qc
description: isiXhosa (xh) translation quality checker for Probably Weather, backed by corpora. Use whenever working on the `xh` column of `T` in `assets/app.js`, `INSTALL_T`, `PTR_COPY`, `WEATHER_COPY`, the provisional fills in `lang-packs/xh/`, or new xh transcreations. Triggers on: Xhosa, isiXhosa, XH translation, XH QC, xh column, Cawe, Mvulo, Nguni, SADiLaR, CTexT, Xhosa word list, lang-check. Conservative-by-default: the isiXhosa corpora are the thinnest of the four, so an unattested word is a question, not a verdict; nothing is auto-applied.
---

# xh-qc — isiXhosa QC for Probably Weather

> **Status: corpus-backed (2026-09-06).** The check is `node scripts/lang-check.mjs --lang xh`.
> It replaced the heuristic checklist from May 2026 after a validation exam against native rulings
> (`scripts/lang-check/exam-result.md`): wrong-sense recall 0% → 62%, wrong-language (Zulu forms)
> recall 0% → 100%, untranslated 0% → 100%, fused boundaries 0% → 84%, precision 0% → 36% on 518
> native-good and 79 known-bad isiXhosa lines. Every finding cites the corpus hit.

## What backs it

Compiled by `node scripts/lang-check.mjs --build-index xh` from `.lang-check-cache/`
(`node scripts/lang-check/fetch-corpora.mjs`; licences in `scripts/lang-check/lib/build-index.mjs`):

- **Leipzig `xho_community_2017`, `xho-za_web_2018_30K`** — 53 993 sentences, 193 266 word forms
  with frequency, co-occurrence and example sentences. About a quarter of the Zulu material.
- **kaikki.org Xhosa** (English Wiktionary extract, CC BY-SA) — 3 462 lemmas with glosses and
  15 539 forms (far fewer inflection tables than Zulu).
- **NCHLT isiXhosa annotated corpus** (CC BY 2.5 ZA) — 46 472 tokens with lemma and POS
  (class-tagged nouns, `N09` etc.).
- **SADiLaR-II morphological annotations** (CC BY 4.0) — 46 465 segmented tokens: noun-class and
  concord tables.
- **African Wordnet isiXhosa** (CC BY 4.0) — 9 515 lemmas (attestation only; no English glosses
  offline). **Autshumato EN↔XH** (CC BY 2.5 ZA) — 6 277 words, 982 phrases.
- **xh.wikipedia** (2 512 articles) and the **Constitution (isiXhosa)**.
- **The app's own native bank** (`lang-packs/xh/corpus-confirmed.jsonl`) and `banned-words.json` —
  bank attestation is reported, never counted as external evidence.

xh.wiktionary has zero articles. No Bible text on eBible for xho. CTexT's spellchecker is not reachable.

## How to run it

```bash
node scripts/lang-check.mjs --lang xh --en "Partly cloudy" --text "Kufukufuku kancinci"
node scripts/lang-check.mjs --file lines.json --verbose
node scripts/lang-check/triage.mjs --lang xh                    # → review/lang-check-triage-xh.md
```

## What it checks

Same four passes as zu-qc (`scripts/lang-check/lib/checker.mjs`), with these isiXhosa specifics:

1. **Lexical.** Because the corpora are thin, an unattested word in a full sentence is MEDIUM, not
   HIGH (HIGH only in a short label). The closest attested form and the stem-under-another-concord
   check reduce the noise (`Ukungabonakali` ~ `anokungabonakali`). Fused-prefix loans
   (`neebakkie`, `kwi-N2`, `iambrela`) are resolved through Afrikaans/English/the source line.
   Pack soft bans: `kufukufuku` (lukewarm, used for partly cloudy), `iimphuphuma` (outbursts, used
   for gusts), `ii-crows` (where `amahlungulu` exists), `lwengqeleolukwenza` (fused boundary).
2. **Morphological.** Unattested words that split into two attested words are flagged as fused
   boundaries — the documented isiXhosa failure (`lwengqeleolukwenza`). Noun-class ↔ concord
   agreement on `ba- li- si- zi- lu- bu-` with the expected form quoted. Diacritics are HIGH.
3. **Semantic.** Gloss back-translation with the weather synonym table, the time-of-day clash
   (`kusasa` = morning/tomorrow against "this morning" is the documented ambiguity), the near-miss
   rule (`imvu` for `imvula`, `inkuku` for `inkungu`), and dictionary-expected words checked for
   presence.
4. **Contamination.** Zulu markers (`ngiya`, `ukuthi`, `manje`, `lapho`, `yebo`, `cha`, `futhi`,
   `izulu`, `kushisa`, `uma`, `ngoba`) are HIGH when unattested in isiXhosa; a word attested only in
   the big Zulu index is LOW–MEDIUM, because the Xhosa corpus simply misses many shared Nguni
   words. English core weather words are MEDIUM.

## What it still cannot see

- **Coverage gaps read as doubt.** `Linamafu` (there are clouds), `Yhuu`, `koyikisa` are native
  isiXhosa the corpora do not hold; they surface as unattested. Treat a lone unattested word in an
  otherwise clean sentence as a question for the reader, not a defect.
- **Spelling variants both attested.** `Kubanda` vs `Kuyabanda`, `isihlalo semoto` rewrites.
- **Sense inside the domain.** `kushushu` (heat) inside a cold line only when the pack marks it.
- **future_review rows.** 67 of the 256 rows the reviewer applied are marked lower-confidence in
  `review/xhosa-apply.csv`; the tool flags 44 of them for unattested tokens — those are the rows
  where the reader's minutes go first.

## Conservative protocol

> **Low confidence = defer to human. Never auto-apply.**

- `triage-high` / `triage` entries go to `TRIAGE_NATIVE_REVIEW.md` under isiXhosa with evidence.
- A xh string equal to the zu string is a cognate until a native rules. HIGH duplicates are only
  with Afrikaans, Sesotho or English.
- The tool never edits `assets/`.

## Examples

- ✅ CAUGHT: `Kufukufuku kancinci` → pack soft ban (lukewarm) + `Kufukufuku` unattested in any
  isiXhosa source.
- ✅ CAUGHT: `Uhlobo lwengqeleolukwenza u-Google underfloor heating Bloenfontein` → HIGH lexical,
  `lwengqeleolukwenza` seen only in this app's own copy; `Bloenfontein` unattested (Bloemfontein).
- ✅ CAUGHT: `Ewe, imvu ina ngecala.` → `imvu` (sheep) is one stem from `imvula`, the usual word for rain.
- ⚠️ MISSED: `Imozulu embikakhulu` when both halves are attested as a solid form elsewhere.
- ✅ CLEAN: `Imvula ikhona.`, `Inja iphantsi kwebhedi. Icebo elihle, inene.`

## Output format

As zu-qc. If `action` is not `pass`, write the entry to `TRIAGE_NATIVE_REVIEW.md`; do not mutate `assets/`.
