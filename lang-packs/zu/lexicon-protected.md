# isiZulu — protected lexicon (confirmed-correct words; never "improve" these)

## Row #1 — THE IMBATATA RULE (cross-pack anchor for zu/xh/st/af)
**imbatata** — an isiZulu word an AI *invented* for this app. It is not a real word. A native
speaker caught it before it shipped; it never reached production. It is the origin of this whole
architecture's prime rule: **the outsider is wrong until a native says otherwise.** A model's
confidence in a low-resource language is not evidence. When you cannot confirm a word from the
corpus, you do not coin one — you use a plain attested word or a descriptive phrase and tag it
LOW for native review. A fabricated word is worse than a clumsy-but-real one, and far worse than
a `""` slot honestly marked as debt. (Referenced in `CHECKPOINT.md` as "the imbatata rule".)
**Never invent a word. This is non-negotiable and it applies to every language in this repo.**

## Confirmed / protected vocabulary
Words a native reviewer confirmed or corrected (30 applied corrections, commit d51b173;
`review/zu-addendum.md`, `review/NATIVE_REVIEW_ZU.md`). Reuse exactly; do not swap for synonyms.

| Concept | Protected isiZulu | Do NOT use |
|---|---|---|
| kite | (needs native — see errors) | umkhumbi (=ship) |
| zero / nothing | (plain: okungelutho / cha) | iqanda (=egg) |
| pools (of water) | amaxhaphozi / izidiba | amapulazi (=farms) |
| seagulls | (needs native term) | izinkonjane (=swallows) |
| expectations | okulindelekile | izindlela (=roads) |
| jersey | ijezi | isijele (=jail) |
| respect (verb) | hlonipha | — (correct in Zulu; NB Sesotho differs → hlompha) |
| severe weather | Isimo sezulu esibi kakhulu | — |
| thunder | Ukuduma kwezulu | — |

Rows marked "needs native" are known-unknowns: the wrong word is banned, the right word is not
yet confirmed — draft a plain descriptive form and tag LOW, do NOT coin.

**Register anchor:** naturally code-switched loans (braai, i-Toyota, place names, "lekker") are
protected — keep them. The error is a mistranslated CONTENT word, never a real loan left alone.
