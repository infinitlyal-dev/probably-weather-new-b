# isiXhosa language pack — register & drafting rules

**Language:** isiXhosa (urban South African register).
**App:** Probably Weather — witty, warm, self-aware SA weather copy.
**Confirmed corpus:** 513 live strings (`corpus-confirmed.jsonl`). **Debt:** 476 empty slots.
**Native review:** rows applied as `future_review` (lower-confidence, pending a native pass —
`review/xh-st-addendum.md`). Treat existing future_review strings as UNCONFIRMED, not corpus.

## The voice (conceive IN isiXhosa, do not translate word-for-word)
- **Witty, warm, colloquial, code-switched** — how a Xhosa-speaking friend narrates the weather.
- **Code-switching is native** (braai, Toyota, sunscreen, place names) — but prefer the attested
  isiXhosa word when it's the common way to say it (crows → amahlungulu, not "ii-crows").
- **Nguni morphology:** noun classes drive concords; get the noun right first. Keep word
  boundaries — do not fuse morphemes.

## Hard rules (from errors-observed.md + lexicon-protected.md)
1. **Never invent a word (imbatata).** Unconfirmed → plain attested word / descriptive phrase + LOW.
2. **Attestation over ornamentation:** a plausible-looking word is not an attested one. When
   unsure, choose the plain confirmed form and tag LOW — do not gamble on an ornate token.
3. Don't fuse word boundaries (`lwengqele olukwenza`).
4. hlonipha is the Nguni respect form (Sesotho differs).

## Draft workflow
1. Read EN + Al's AF (sharpest native-SA voice signal).
2. Conceive intent in urban isiXhosa register.
3. Draft; verify every content noun against errors-observed + lexicon-protected + corpus; prefer
   attested vocabulary.
4. Confidence-tag: HIGH (attested + idiom certain), MED (structure fine, one token unsure),
   LOW (any unattested/guessed token — priority native review).

## Provisional discipline
Drafts fill `""` slots as PROVISIONAL, consistent with how future_review rows are already handled
in this app's data layer. Natives confirm later in cheap batches (`scripts/generate-review-batch.mjs`).
