# Sesotho language pack — register & drafting rules

**Language:** Sesotho (South African standard, NOT Lesotho Sesotho).
**App:** Probably Weather — SA weather with personality. Copy is witty, warm, self-aware.
**Confirmed corpus:** 511 live strings (`corpus-confirmed.jsonl`). **Debt:** 44 empty slots (was 478; 434 provisional fills applied 2026-07-18).
**Native review:** 90 strings confirmed & CLOSED (`review/sesotho-replacements.txt`) — immutable.

## The voice (conceive IN Sesotho, do not translate word-for-word)
- **Witty, warm, colloquial** — a friend narrating the weather, never a textbook or a weather
  bureau. The joke should land in Sesotho, not be a literal carry-over of the English pun.
- **Code-switching is native, not lazy.** Real SA-Sesotho speakers drop English/Afrikaans words
  mid-sentence: jersey, takkies, braai, "lekker koud", brand names, place names. KEEP them.
  Forcing every loan into textbook Sesotho reads as stiff and foreign — the opposite of the voice.
- **South African orthography (Al's ruling 2026-09-06):** `jwalo`, `jwale`, `dipula`, `tjhesa`, `mohodi`, `wa`/`ya` — not the Lesotho `joalo`, `joale`, `lipula`, `chesa`, `moholi`, `oa`/`ea`. The 2026-06 native review was written in Lesotho orthography; those rulings stand for wording, not spelling. Run `node scripts/lang-check/build-sheet.mjs --lang st` for the corpus-backed orthography re-check.
- **Second person:** `o`/`u` (SA-Sesotho uses both; the confirmed corpus leans `u` in newer
  reviewer edits — `U e kolota`, `Lula u shebile` — follow the corpus where it exists).

## Hard rules (from errors-observed.md — the negative prompt)
1. Never invent a word. If unsure of the noun, use a short descriptive phrase, tag LOW confidence,
   and let the native batch confirm. An invented word is the cardinal sin (imbatata).
2. Never calque an English image (no "road of milk" for Milky Way — it's Molalatladi).
3. Never use a Zulu/Xhosa form (hlonepha) where Sesotho differs (hlompha).
4. Match the protected lexicon exactly (lexicon-protected.md).
5. A real word with the wrong meaning is as bad as an invented one (lifofane = airplanes, not gusts).

## Draft workflow
1. Read the EN + Al's AF (AF is the sharpest voice signal — it's a native SA speaker's take).
2. Conceive the line's INTENT in Sesotho register (what would a Motho say looking out the window?).
3. Draft; check every content word against errors-observed + lexicon-protected.
4. Keep naturally code-switched loans; translate only true content words.
5. Confidence-tag: HIGH (idiom + vocab certain), MED (structure fine, one word unsure),
   LOW (guessed a term — flag for priority native review).

## Provisional discipline
Drafts ship to `""` slots as PROVISIONAL (data-layer marker consistent with the xh future_review
convention). Native confirmation comes later in cheap batches via `scripts/generate-review-batch.mjs`.
The goal is raising first-pass acceptance — natives confirm, they don't translate from scratch.

## Report card — checker batch 1 (2026-07-18)
Cross-family checker (Codex) screened all 478 provisional drafts:
- **PASS: 434 / 478 = 91%** → folded into the copy banks as provisional (`provisional-manifest.jsonl`), pending native confirm.
- **FLAG: 44** → held in `debt-ledger.jsonl` as `debt-flagged` with Sol's reasons attached, marked priority native review.
- vs the ST native first-pass baseline of **67%**: the drafter + cross-family-checker loop lifts first-pass acceptance ~24 points above the from-scratch native baseline that this pack's own history set. Next: native batches via `generate-review-batch.mjs` at Al's pace.
