# Sesotho residue — served lines lang-check flagged and this pass could not settle

2026-09-15, item 5. Scope: the 915 Sesotho bank lines the picker can serve, intersected with
the 85 lang-check triage items (the brief counted 91; the triage file on disk, regenerated
2026-09-08 after 9 applies, holds 85). 42 corrected (review/lang-check-apply-st.md; 9 of them are also below, where a spelling was
fixed but a doubt remains), 31 cleared as checker false positives (see review/st-voice.md), these
21 left for a native reader.
One line of doubt each; the line itself is live as shown (after this pass's spelling fixes).

- `witty.cloudy[43]` "o a aneka, kapa wa mena?" — "aneka" (hang washing) is attested only in isiXhosa; Sesotho "aneha"?
- `witty.wind[47]` "Moya o feetse maru … Boitšoarelo" — "feetse" for "swept" (fiela → "fietse"?); SA spelling of "Boitšoarelo" not backed by the corpus.
- `witty.heat[48]` "Bamathi ba 5:30 ha ba fite ho rona" — "fite" unattested; "ha ba re fete"?
- `witty.cloudy[70]` "Letsatsi le loga off" — "loga" is attested in Setswana, not Sesotho.
- `witty.cold[59]` "Re di anega" — "anega" is Sepedi; Sesotho "fanyeha" / "aneha"?
- `witty.cold[69]` "Mollo o tukile" — "tukile" unattested; "o tukile"/"o besitswe"?
- `witty.cold[72]` "Bo monate ho tlhapi" — concord "bo" with class-9/10 "tlhapi".
- `witty.cold-clear[102]` "tong e a arolelanwa" — "tong" for braai tongs: a loan people use?
- `witty.heat[66]` "Lunch e fallile kantle" — "fallile" unattested for "moved outside".
- `witty.heat[83]` "moo sprinkler e fafazang teng" — "fafazang" unattested.
- `witty.heat[63]` "ka nako e le 'ngoe" — Lesotho spelling of "e le nngwe", left because the checker's corpus rated the SA form worse; "ka chang" likewise.
- `witty.clear[54]` "Hwa tshosa." — "Hwa" for "Terrifying": "Ho a tshosa"?
- `witty.clear[63]` "diaparo di omile" — "omile" is attested in isiZulu; Sesotho "di omme"?
- `witty.cloudy[75]` "Maru a timile lebone" — "timile" attested only in Setswana; "a timme"?
- `witty.cold-clear[99]` "o sala o timile" — same "timile".
- `witty.wind[21]` "Lesela le aliloe" — "aliloe" for "was laid" unattested.
- `witty.fog[79]` "Toropo e hulile duvet ya eona" — "hulile" unattested; "ya eona" vs SA "ya yona" not backed.
- `witty.heat[81]` "Re noela hoo jwale" — "noela" (drink to) unattested.
- `witty.cold[83]` "Kobo mahetleng stoep-ong" — locative on the loan "stoep".
- `witty.cold-clear[100]` "jwalo ka drakone" — "drakone" (dragon) unattested.
- `witty.cloudy[54]` "Lichopo ha di tsebe" — Lesotho "li-" plural; "Ditjhopo" is unattested, the dictionary form is "ditjhopose".

## 2026-09-16 — from the headline table, not the witty bank

The pass above scoped the 915 served witty lines. These two came out of `headlines` while fixing
punctuation and capitals on 2026-09-16, so they were never in that scope.

- `headlines.thunder` "Modumo wa seaduma o a tla." — **left live, for a native to rule.** The
  checker rates it TRIAGE (0.30) on two counts. "seaduma" is attested only in this app's own copy
  and in no external source; the nearest form it can find is "seadumo", which has 0 dictionary
  hits itself, so there is no strong evidence for a replacement — which is exactly why this is a
  question and not a fix. It also reads "Modumo" as "noise / note" rather than thunder, and finds
  none of the words it would expect for "rolling" ("sebetsang" / "thetehang" / "tswelang pele").
  The question for a reader: is "seaduma" a Sesotho word for thunder, and is "Modumo wa seaduma o
  a tla." how you would say "Thunder rolling in."? The punctuation fix did not change the score —
  it was 0.30 before and after.

Settled the same day, recorded here so the pair is not read as still open: `headlines.uv` had
"hodimu", attested nowhere outside this app against "hodimo" at 612× across kaikki, leipzig,
nchlt, morph, wiktionary, wiki, the constitution and the dictionary, one character apart — and
"lehodimo" was already spelled that way elsewhere in the same Sesotho bank. Corrected to
"UV e hodimo haholo." on that evidence (Al's ruling 2026-09-16); the checker goes TRIAGE 0.25 →
PASS 0.00 and now back-translates hodimo as "above, at the top".
