# Sesotho language pack — register & drafting rules

**Language:** Sesotho (South African standard, NOT Lesotho Sesotho).
**App:** Probably Weather — SA weather with personality. Copy is witty, warm, self-aware.
**Confirmed corpus:** 511 live strings (`corpus-confirmed.jsonl`). **Debt:** 478 empty slots.
**Native review:** 90 strings confirmed & CLOSED (`review/sesotho-replacements.txt`) — immutable.

## The voice (conceive IN Sesotho, do not translate word-for-word)
- **Witty, warm, colloquial** — a friend narrating the weather, never a textbook or a weather
  bureau. The joke should land in Sesotho, not be a literal carry-over of the English pun.
- **Code-switching is native, not lazy.** Real SA-Sesotho speakers drop English/Afrikaans words
  mid-sentence: jersey, takkies, braai, "lekker koud", brand names, place names. KEEP them.
  Forcing every loan into textbook Sesotho reads as stiff and foreign — the opposite of the voice.
- **SA-Sesotho conventions:** `joalo`, `joale` (not Lesotho `jwalo`, `jwale`).
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
