---
name: zu-qc
description: isiZulu (zu) translation quality checker for Probably Weather, backed by corpora. Use whenever working on the `zu` column of `T` in `assets/app.js`, `INSTALL_T` in `assets/install.js`, `PTR_COPY`, `WEATHER_COPY`, the provisional fills in `lang-packs/zu/`, or new zu transcreations. Triggers on: Zulu, isiZulu, ZU translation, ZU QC, zu column, iSonto, uMsombuluko, Nguni, SADiLaR, CTexT, Zulu word list, lang-check. Conservative-by-default: shared Nguni vocabulary with isiXhosa is weak evidence and is never flagged above medium on its own; nothing is auto-applied.
---

# zu-qc — isiZulu QC for Probably Weather

> **Status: corpus-backed (2026-09-06).** The check is `node scripts/lang-check.mjs --lang zu`.
> It replaced the heuristic checklist from May 2026 after a validation exam against native rulings
> (`scripts/lang-check/exam-result.md`): wrong-sense recall 0% → 43%, wrong-language (Xhosa forms)
> recall 5% → 84%, untranslated 0% → 71%, fused boundaries 0% → 79%, precision 50% → 56% on 503
> native-good and 94 known-bad isiZulu lines. Every finding cites the corpus hit.

## What backs it

Compiled by `node scripts/lang-check.mjs --build-index zu` from `.lang-check-cache/`
(`node scripts/lang-check/fetch-corpora.mjs`; licences in `scripts/lang-check/lib/build-index.mjs`):

- **Leipzig `zul_community_2017`, `zul_mixed_2014_100K`, `zul-za_web_2018_30K`** — 272 577
  sentences, 688 380 word forms with frequency, neighbour co-occurrence (collocations) and an
  example sentence per word. The largest attestation source; also the noisiest (English and
  Xhosa strays occur, which is why sibling attestation is weighed against own frequency).
- **kaikki.org Zulu** (English Wiktionary extract, CC BY-SA) — 3 330 lemmas with English glosses,
  noun classes, and 502 058 inflected forms (full concord and tense tables per verb and noun).
- **NCHLT isiZulu annotated corpus** (CTexT, CC BY 2.5 ZA) — 46 059 tokens with lemma and POS.
- **SADiLaR-II morphological annotations** (CC BY 4.0) — 45 933 tokens segmented into morphemes:
  the source of the noun-class and subject-concord tables.
- **zu.wiktionary** (full page cache, 1 369 pages) and **African Wordnet isiZulu** (CC BY 4.0,
  6 518 lemmas).
- **Autshumato EN↔ZU word/phrase lists** (CC BY 2.5 ZA) — 6 241 words, 1 029 phrases.
- **zu.wikipedia** article text (12 606 articles) and the **Constitution (isiZulu)**.
- **The app's own native bank** (`lang-packs/zu/corpus-confirmed.jsonl`) and the pack's
  `banned-words.json` — bank attestation is reported but never counts as external evidence.

Not reachable from here: NWU CTexT's ZulMorph (ctext.nwu.ac.za timed out), isiZulu.net (gone, 410),
any Oxford API. No Bible text is on eBible for zul.

## How to run it

```bash
node scripts/lang-check.mjs --lang zu --en "Rain tonight" --text "Imvula namhlanje"
node scripts/lang-check.mjs --file lines.json --verbose        # [{lang,en,text,key}]
node scripts/lang-check/triage.mjs --lang zu                    # provisional fills → review/lang-check-triage-zu.md
node scripts/lang-check/triage.mjs --lang zu --file new-set.json
```

## What it checks (a–d in `scripts/lang-check/lib/checker.mjs`)

1. **Lexical.** Every content word is resolved: exact form; hyphenated loans (`i-Toyota`,
   `ama-hadedas`); a locative or copulative prefix stripped (`emvuleni` → `imvula`, `ngumkhumbi` →
   `umkhumbi`); an inflected stem attested under another concord (`obucwebile` ~ `licwebile`).
   Loans with fused class prefixes (`namabakkie`) are recognised through the Afrikaans and English
   indexes and the source line. What remains unknown gets the closest attested form and a note of
   whether the word appears only in this app's own copy. The pack's `banned-words.json` is applied:
   hard entries are HIGH, soft entries (umkhumbi=ship, iqanda=egg, izinkonjane=swallows, isijele=jail,
   amafindo=knots, hlanzekile=clean) are MEDIUM "verify the sense".
2. **Morphological.** Noun class from the corpora, checked against the subject concord of the next
   word — only for the unambiguous concords `ba- li- si- zi- lu- bu-`, only when the noun carries
   its bare class prefix, and only when the expected form is itself attested (the evidence quoted).
   Fused word boundaries: an unattested word that splits into two attested words. Diacritics in a
   Nguni line are HIGH.
3. **Semantic.** Back-translation through the glosses (walking plural→singular and concord
   prefixes), compared with the English source through a weather synonym table. A time-of-day
   clash (`namhlanje` = today against "tonight") is the documented badge bug and is MEDIUM. A real
   word one to three letters from the expected word with a different meaning (`inkuku` for
   `inkungu`, `isijele` for `ijezi`) is a near-miss finding. Single-word labels whose gloss matches
   nothing in the source, while the source word has a known translation that is absent, are MEDIUM.
4. **Contamination.** Xhosa function-word markers (`ndiya`, `ngoku`, `apho`, `ewe`, `hayi`, `xa`,
   `kuba`, `imozulu`, `kushushu`) are HIGH when the form is unattested in isiZulu, MEDIUM when the
   Xhosa frequency dwarfs the Zulu one. A word attested only in the Xhosa index is LOW–MEDIUM
   because shared Nguni vocabulary is common. English words not present in the source line are
   MEDIUM; core weather words left in English (`rain`, `night`) are MEDIUM even when the source
   has them.

## What it still cannot see

- **Wrong sense where the dictionary has no gloss for the word.** `amafindo` (knots) for gusts is
  only caught because it is now in `banned-words.json`; the corpora attest it but do not gloss it.
- **Sense shifts inside one domain.** `Kunamafu` (partly cloudy) for "Overcast" passes: the gloss
  is "cloud".
- **Register.** `Kubanda` vs `Makhaza`, `Kupholile` vs `Kuyabanda kancane` are the native reviewer's
  calls; the tool sees two attested words.
- **Number and agreement that is attested either way.** `Isiphepho siyeza` (singular) where the
  native wanted `Iziphepho ziyeza`.
- **Attested-but-wrong.** `Kunenkungu.` (fused) is attested in the corpora, so it passes.
- **The imbatata question.** `Imbatata emgwaqeni…` is in the live bank (native review commit
  d51b173) while `lang-packs/zu/lexicon-protected.md` calls `imbatata` an invented word; the
  corpora attest `imbadada` (sandals) once and `imbatata` only in this app. The tool reports it
  as "seen only in this app's own copy" — a native has to rule.

## Conservative protocol

> **Low confidence = defer to human. Never auto-apply.**

- `triage-high` / `triage` entries go to `TRIAGE_NATIVE_REVIEW.md` under isiZulu with the evidence.
  `pass` means the corpora found nothing to object to.
- A zu string that equals the xh string is a cognate until a native says otherwise. The only
  cross-language duplicates flagged HIGH are with Afrikaans, Sesotho or English.
- The tool never edits `assets/`. Fixes land through the native batch (`scripts/generate-review-batch.mjs`).

## Examples

- ✅ CAUGHT: `Imvula namhlanje` for "Rain tonight" → MEDIUM semantic, `namhlanje` = today,
  time-of-day clash; expected `ebusuku namuhla`. Evidence: Leipzig zul_community_2017.
- ✅ CAUGHT: `Ho bata bosigo bona` style contamination in reverse: `Isibhakabhaka sinenkani ngoku.`
  → `ngoku` is a Xhosa marker (xh 1711× vs zu 48×).
- ✅ CAUGHT: `Kwenye indawo uphahla lungumkhumbi omusha womuntu.` → `umkhumbi` = ship (pack soft
  ban + gloss 'ship; vessel' against "kite").
- ⚠️ MISSED: `Ubusuku obuhlanzekile` (clean for clear) unless `hlanzekile` is read from the pack.
- ✅ CLEAN: `Imvula isifikile.` passes; `Umoya onamandla` passes.

## Output format

```json
{ "lang": "zu", "en": "Rain tonight", "text": "Imvula namhlanje", "confidence": 0.25, "action": "triage",
  "findings": [{ "check": "semantic", "severity": "medium", "token": "namhlanje",
    "message": "'namhlanje' means 'today' — nothing in the English source (time-of-day clash with 'tonight'); the source's 'tonight' would normally be 'namuhla kusihlwa' / 'ebusuku namuhla', none present",
    "evidence": { "glosses": ["today"], "timeClash": true, "cite": { "freq": 947, "sources": ["kaikki","leipzig","nchlt","morph","wikt","wiki"], "example": { "source": "Leipzig zul_community_2017 #…", "text": "…" } } } }],
  "coverage": { "contentTokens": 2, "attested": 2, "unknown": 0, "enMatched": ["rain"], "enUnmatched": ["tonight"] } }
```

If `action` is not `pass`, write the entry to `TRIAGE_NATIVE_REVIEW.md`; do not mutate `assets/`.
