# isiXhosa — errors observed (negative prompt for the drafter)

Source: `review/xh-st-addendum.md` (future_review rows applied verbatim but flagged),
`review/xhosa-apply.csv`, `review/xhosa-quarantine.csv`, `review/NATIVE_REVIEW_XH.md`.
isiXhosa is Nguni, closely related to isiZulu — it shares the **near-miss content-word** and
**invented-word (imbatata)** failure modes; check zu/errors-observed.md too.

## unattested / typo — the dominant isiXhosa failure mode here
Many drafts came from a "B source" and shipped with tokens no dictionary attests. These landed
live as `future_review` (lower-confidence, applied but explicitly marked for a native pass).
The lesson for the drafter: **a plausible-looking word is not an attested word.** Prefer a plain
attested form over an ornate one you can't confirm. Examples flagged unattested:
`uphezulu`, `isoloko`, `okwakubanda`, `kuphumela`, `yokubilisa`, `lwengqeleolukwenza` (two words
fused), `ngunobangela`, `kuqhutywa`, `sukuwathemba`, `loo-mafu`, `akunethi`, `ulindeleko`.
None are auto-wrong — but each is UNCONFIRMED. Draft toward attested vocabulary; tag the ornate ones LOW.

## over-fused / spacing errors
`lwengqeleolukwenza` (should be spaced: `lwengqele olukwenza`), `Uhlobo lwengqeleolukwenza` —
the model dropped a word boundary. Watch morpheme boundaries; isiXhosa agglutinates but words
still separate.

## code-switch handled inconsistently (register, judge per line)
`ii-crows`, `ii-crispy`, `ye-Lapa`, `i-ketile` — English roots taking isiXhosa class prefixes.
This IS a real register move (urban isiXhosa does it), but the reviewer flagged some as awkward
where an attested isiXhosa word existed (e.g. crows → amahlungulu). Rule: use the isiXhosa word
when it's common and confirmed; keep the code-switched loan only when it's the natural way people
say it (braai, Toyota, sunscreen, place names).

## invented-word — the cardinal error
See zu/lexicon-protected.md row #1 (imbatata). Never coin. Unconfirmed → plain attested word or
descriptive phrase + LOW tag.

## stray-character artifacts (mechanical, flagged for native confirm)
`witty.storm[15]` shipped as `Yihloniphe induduma, iyakufanele"` with a trailing stray `"`
(data-entry artifact). The dangling quote was removed 2026-07-18 (mechanical, no wording change).
**Native to confirm:** is `Yihloniphe induduma, iyakufanele` the natural way to say "Respect the
thunder. It's earned it." — or would a native phrase it differently? Wording untouched pending review.

## known-good anchors (confirmed by reviewer, reuse)
`Inja iphantsi kwebhedi. Icebo elihle, inene.` (dog under bed) · `Nditsho neeNtaka zithe cwaka.`
(even the birds are quiet) · `Igadi ithi enkosi ekugqibeleni.` (garden says thanks at last) —
these read naturally; mirror their rhythm.
