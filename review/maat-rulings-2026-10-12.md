# Maat rulings on the judge's October verdicts (isiXhosa + isiZulu)

Reviewed 2026-10-12 against review/lang-judge-verdicts-2026-10.md (branch vonk/oct-12). The judge over-flags on purpose; I read every FIX row. Nothing is CUT.

## The rule

**Apply the judge's proposed rewrite for every FIX row, in both languages, except the rows listed under "My line instead" and "Not applicable" below.** KEEP rows stay as they are.

Gate: every rewrite goes through the deterministic checker and the blind back-translation as usual. Two adjustments for this round only:
- The judge chose English loans deliberately (i-aircon, i-refresh, ama-fairy lights, i-windpump, i-umpire, ii-sundowners, ii-surfer, i-privacy setting, i-trailer, Cheers, zero, i-pier, i-electric blanket, i-Cape Doctor, Friendly City / Windy City). If the checker's only complaint on a rewrite is such a loan, apply it and note "loan accepted (judge)" in the manifest. The natives kept loans of this kind.
- Hold any rewrite whose back-translation drifts from the English, and keep the previous line in its place. List those for me.

## isiXhosa — my line instead (5 rows)

| key | use this line | why not the judge's |
|---|---|---|
| witty.cloudy[67] | Ukutshona kwelanga kuthe cwaka ngokuhlwanje. Ukuhlwa kufikile noko. | "ngokuhlwanje" is ordinary isiXhosa for "this evening" — the judge itself used it in hero:cc8c9847fa04. Only the second sentence needed fixing. |
| witty.cold[99] | Ndisoloko ndilibala ukuvula ingubo yombane kwangethuba. Qho. Ubusuku. Ngabunye. | The judge's version lost the three-beat "Every. Single. Night." |
| witty.fog[95] | Abamelwane abakufutshane bakude ngeekhilomitha ezingama-30, kwaye ngokuhlwanje bakubona kancinci nangakumbi. | Same "ngokuhlwanje" point; the number fix is taken. |
| witty.clear[37] | Akukho mpazamo namhlanje ukuza kuthi ga ngoku. Nditsho nesibhakabhaka. | The judge's first sentence is longer than the joke. Only "Sky included" needed the fix. |
| witty.rain[73] | Imvula isekude nge-50 km, kodwa i-stoep sele igcwele. | The "it" fifty km away is the rain, not a storm. |

## isiXhosa — not applicable (4 rows)
witty.clear[78], witty.clear[67], witty.heat[69], witty.cold-clear[39] — their English was cut from the bank. Leave them.

## isiXhosa — the held line
hero:2071c8a37d11: use the judge's "Isaqhwithi esincinci sothuli sihamba phambi kwakhe. Asinyatheli nokunyathela iipedali." Apply if it passes the gate; otherwise it stays held, same as before.

## isiZulu — my line instead (1 row)

| key | use this line | why not the judge's |
|---|---|---|
| witty.wind[41] | Indwangu yetafula yentaba isilungile, ilindele umsebenzi wakusasa. | The judge named Table Mountain. The English doesn't, and we don't add landmarks a line didn't have. The repetition fix is taken. |

Every other isiZulu FIX row: the judge's rewrite.

## Counts expected
isiXhosa: 75 judge rewrites + 5 of mine + 1 held-line attempt. isiZulu: 54 judge rewrites + 1 of mine. If your count differs, say by how much and which rows.

## After applying
Regenerate the photo tables and manifests, rebuild the back-translation report, full suite and build, commit on vonk/oct-12, push the branch. Then it is ready for main on Al's "push".

## Not now
review/live-bank-errors-from-exam-2026-10.md (48 live lines) waits until after launch. Don't touch the live bank.
