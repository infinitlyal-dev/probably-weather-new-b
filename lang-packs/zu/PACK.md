# isiZulu language pack — register & drafting rules

**Language:** isiZulu (urban South African register).
**App:** Probably Weather — witty, warm, self-aware SA weather copy.
**Confirmed corpus:** 508 live strings (`corpus-confirmed.jsonl`). **Debt:** 481 empty slots.
**Native review:** 30 applied corrections (commit d51b173); addendum flags open (`review/zu-addendum.md`).

## The voice (conceive IN isiZulu, do not translate word-for-word)
- **Witty, warm, colloquial, code-switched** — how a Zulu-speaking friend in Joburg/Durban
  actually narrates the weather, not a textbook or news bulletin.
- **Code-switching is native.** braai, i-Toyota, "lekker", brand names, place names stay in
  English/Afrikaans. Real speakers do this constantly; forcing pure isiZulu reads as stiff.
- **Noun classes & concords matter** — a mistranslated noun drags the whole concord wrong.
  Get the noun right first (against lexicon-protected + corpus), then the concord follows.

## Hard rules (from errors-observed.md + lexicon-protected.md)
1. **Never invent a word (imbatata).** Unconfirmed noun → plain attested word or descriptive
   phrase + LOW tag. Never coin.
2. Never ship a near-miss content word (umkhumbi=ship for kite; iqanda=egg for zero). Check
   every content noun's actual meaning.
3. Keep naturally code-switched loans; translate only true content words.
4. hlonipha is correct isiZulu for respect (note: Sesotho differs — hlompha).

## Draft workflow
1. Read EN + Al's AF (sharpest voice signal from a native SA speaker).
2. Conceive the intent in urban isiZulu register.
3. Draft; verify every content noun against errors-observed + lexicon-protected + corpus.
4. Confidence-tag: HIGH (idiom+nouns certain), MED (one noun/concord unsure), LOW (guessed a
   term — priority native review).

## Provisional discipline
Drafts fill `""` slots as PROVISIONAL (data-layer marker per the xh future_review convention).
Natives confirm later in cheap batches (`scripts/generate-review-batch.mjs`). Raise first-pass
acceptance; never wait on humans to translate from scratch.
