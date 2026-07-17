# isiZulu — errors observed (negative prompt for the drafter)

Real corrections to AI-drafted isiZulu in this app. Source: `review/zu-addendum.md`
(same-index quality flags), the 30 applied native corrections (commit d51b173),
`review/NATIVE_REVIEW_ZU.md`. **Never reproduce a "wrong" value.**

## wrong-word — real isiZulu word, wrong meaning (the dominant failure mode)
| Wrong | Actually means | Intended | Where |
|---|---|---|---|
| umkhumbi | ship | kite | storm[10] |
| iqanda | egg | zero | fog[3] |
| amapulazi | farms | pools (of water) | rain[3] |
| izinkonjane | swallows (bird) | seagulls | wind[9] |
| izindlela | roads | expectations | cloudy[36] |
| isijele | jail | jersey (ijezi) | partly-cloudy[7] |

Pattern: the model reached for a phonetically/semantically *near* word and shipped it with
false confidence. This is exactly the imbatata failure mode one step short of full invention.
Every content noun must be checked, not trusted.

## invented-word — the cardinal error
See lexicon-protected.md row #1 (imbatata). If a noun cannot be confirmed from the corpus,
DO NOT COIN. Use a plain attested word or a short descriptive phrase and tag LOW.

## structure / provisional gaps (not wrong, just unconfirmed)
- Several UI strings were AI-drafted and marked PROVISIONAL (viewingShared, dataFrom) —
  treat existing provisionals as unconfirmed, not as corpus.
- The partly-cloudy bin was authored mis-ordered (predates the native review); do not treat a
  displaced line as a confirmed translation of the EN now at that index.

NOTE ON CODE-SWITCHING (register, not error): braai, i-Toyota, place names, "lekker", brand
names are kept — that is the natural urban isiZulu voice. Do not textbook-ify a real loan.
The error is always a mistranslated content word, never a naturally code-switched one.
