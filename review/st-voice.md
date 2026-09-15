# Sesotho voice for the witty lines

Extracted on 2026-09-15 from the native-confirmed bank (`lang-packs/st/corpus-confirmed.jsonl`,
511 live strings, incl. the 90 native replacements) and the pack's error record
(`lang-packs/st/errors-observed.md`, `lexicon-protected.md`, `review/NATIVE_REVIEW_ST.md`).
House orthography is South African (Al's ruling 2026-09-06). Used to judge the flagged lines the
picker can serve (item 5). The judge is not a native speaker: a rule below licenses a
correction only where the corpus evidence agrees with it.

## Ten rules (native-bank evidence)
1. South African orthography: wa/ya (not oa/ea), di- (not li-), tjh, kg, tsh/tshw, jwale, mohodi, tjhesa.
   witty_low_confidence.heat[2] "Ho ka tjhesa." · rain[22] "Kae-kae sekhele se sa tswa reteleha ka hare." · rain-possible[16] "Esita le di-app tsa lehodimo"
2. Loans a speaker really uses stay: vibes, perfect, rugby, Weber, braai, jersey, takkies, place names.
   fog[35] "Ho boneha: vibes feela." · cold-clear[11] "a tlo shebahala a le perfect" · weekend[14] "Weber e emeletse beke eohle"
3. The exclamation is Eish.
   storm[0] "Eish, dula ka hare!"
4. "Even" is Esita le.
   wind[9] "Esita le dikoekoe di tsamaya kajeno." · cold-clear[26] "Esita le dikgomo tse pela N1…"
5. Time words: kajeno (today), hoseng (morning), bosiu (night).
   wind[9] "…di tsamaya kajeno." · night[4] "Lehodimo la bosiu: le amohelitsoe."
6. Weather and body parts get agency: they dance, file complaints, show off.
   rain[7] "Matamo a etsa motjeko o thabileng." · cold[34] "Menwana ea hao e tlisitse tletlebo ka molao." · night[19] "Lehodimo le bonahala le iponahatsa."
7. Comparison with jwalo ka.
   cold[4] "Apara diaparo tse ngata jwalo ka ho palama Sani Pass."
8. Negation in the verb: ha le khathalele, ke ke ke.
   uv[14] "Letsatsi ha le khathalele merero ea hao." · fog[20] "Ke ke ke netefatsa."
9. The hedge is Mohlomong; the low-confidence register "Ho ka…".
   heat[11] "Mohlomong sebakeng se seng…" · witty_low_confidence.heat[2] "Ho ka tjhesa."
10. The protected lexicon is fixed: hlompha, modumo wa seaduma, mohodi, setlolo sa letsatsi, hotle, merubisi (owls), meea e fokang ka sefutho (gusts).
   storm[15] "Hlompha modumo…" · lexicon-protected.md.

## Anti-patterns (the pack's record)
1. Calques of English imagery (Tsela ea Lebese for the Milky Way).
2. A real word with the wrong meaning (lifofane = airplanes for gusts; tsie = grasshopper for cricket; 'mala = entrails where colour is mmala).
3. Zulu/Xhosa forms where Sesotho differs (hlonepha → hlompha).
4. Lesotho spellings in SA copy. Only where the SA corpora back the SA form — the checker's corpus did not back 'ngoe→nngwe or tšoarelo→tshwarelo on 2026-09-15, so those stay for a native.
5. An invented word (the imbatata rule).
