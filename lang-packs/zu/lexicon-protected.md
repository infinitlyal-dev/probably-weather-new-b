# isiZulu — protected lexicon (confirmed-correct words; never "improve" these)

## Row #1 — THE IMBATATA RULE (cross-pack anchor for zu/xh/st/af)
**imbatata** — the word this rule is named after, and the story was wrong. The pack said an AI
invented it and a native caught it before it shipped. The repo says otherwise: `Imbatata emgwaqeni
beyiwumqondo omubi.` ("Flip-flops on tar was a mistake.") entered the live bank through the
**native reviewer's own corrections** (commit d51b173, 2026-05-30). No external corpus attests
`imbatata`; `imbadada` (sandals) is attested once. **Al ruled 2026-09-06: keep imbatata.** The
rule survives its example, sharper: **the outsider is wrong until a native says otherwise — and
that includes the outsider who calls a native's word invented.** A model's confidence in a
low-resource language is not evidence, in either direction. When you cannot confirm a word from the
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
| zero / nothing | iqanda / unothi (Autshumato lists both for *zero*; the 'egg for zero' flag was dropped, Al 2026-09-06) | — |
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
