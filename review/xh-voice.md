# isiXhosa voice for the witty lines

Extracted on 2026-09-15 from the native-confirmed bank (`lang-packs/xh/corpus-confirmed.jsonl`,
513 live strings, incl. the 256-row native review of 0510415) and the pack's error record
(`lang-packs/xh/errors-observed.md`, `lexicon-protected.md`, `review/NATIVE_REVIEW_XH.md`).
Used to judge the flagged lines the picker can serve (item 5). The judge is not a native
speaker: a rule below licenses a correction only where the corpus evidence agrees with it.

## Ten rules (native-bank evidence)
1. Loans take isiXhosa prefixes and stay loans: iTar, ne-GPS, nge-4K, siku-ultra mode, iShower.
   heat[10] "iTar ithambile." · fog[4] "Ne-GPS yakho iyadideka." · clear[26] "Yonke into ibonakala nge-4K namhlanje. Isibhakabhaka siku-ultra mode."
2. …but the common isiXhosa word wins where it exists (amahlungulu, not ii-crows).
   night[3] "Iintaka zilele. Ekugqibeleni." (hadedas → the birds) · lexicon-protected: amahlungulu.
3. Time words are exact: namhlanje is *today*; tonight is ngokuhlwanje.
   heat[25] "luya gyma namhlanje" (today) · served lines wind[43], cold-clear[93], heat[77], fog[74] use "ngokuhlwanje".
4. Exclamation and intensifier in the spoken register: Yhuu, nyhani.
   storm[0] "Yhuu, hlala ngaphakathi!" · rain-possible[1] "Amafu akhangeleka erhaneleka nyhani."
5. Short and idiomatic beats literal.
   cloudy[11] "Kunjalo nje." · cold[3] "Itshokolethi eshushu ayikokufuna. Yimfuno."
6. Weather is a person with friends, dances and moods.
   rain[7] "Amadama enza umdaniso wolonwabo." · cold[18] "Ingqele ifikile yaye ize nabahlobo bayo."
7. "Even" is Nditsho / Nokuba ne-.
   anchor "Nditsho neeNtaka zithe cwaka." · rain-possible[16] "Nokuba nee-app zemozulu ziyaphikisana"
8. Copulatives agree with the noun's class: yi-/li-/si-/lu-… and every concord in the clause follows the subject.
   cold-clear[10] "Yimini iJoburg ezenza ngathi ayinayo" · fog[34] "…ngoku luhambo." (ukuhamba → lu-)
9. The brand hedge is Mhlawumbi.
   witty_low_confidence.heat[0] "Mhlawumbi kushushu." · witty_low_confidence.night[3]
10. Attestation over ornament: the plain confirmed form, word boundaries kept (lwengqele olukwenza, never fused).
   errors-observed: uphezulu, isoloko, lwengqeleolukwenza flagged as unattested/fused.

## Anti-patterns (the pack's record)
1. Plausible-looking tokens no dictionary attests (the dominant isiXhosa failure here).
2. Fused morpheme boundaries.
3. "namhlanje" where the English says tonight.
4. A concord that belongs to a different class from the noun it agrees with.
5. Stray data-entry characters (storm[15]'s trailing quote).
