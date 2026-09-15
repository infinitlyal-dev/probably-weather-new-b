# isiZulu voice for the witty lines

Extracted on 2026-09-15 from the native-confirmed bank (`lang-packs/zu/corpus-confirmed.jsonl`,
508 live strings incl. the 30 native corrections of d51b173) and the pack's own error record
(`lang-packs/zu/errors-observed.md`, `lexicon-protected.md`, `review/NATIVE_REVIEW_ZU.md`).
Used to judge the flagged lines the picker can serve (item 5). The judge is not a native
speaker: a rule below licenses a correction only where the corpus evidence agrees with it.

## Ten rules (native-bank evidence)
1. Code-switch the way urban speakers do: an English or Afrikaans loan takes a Nguni class prefix and carries on.
   storm[14] "Isibhakabhaka sivele saba i-Carte Blanche ngokuphelele." · cold[8] "wenza i-special effects" · weekend[4] "zidinga i-playlist yazo" · cloudy[18] "ku-Instagram" · heat[10] "I-tar ithambile."
2. The SA exclamation is localised, not translated: Jislaaik → Yoh.
   storm[0] "Yoh, hlala ngaphakathi!"
3. Keep the English rhythm of short parallel fragments.
   storm[28] "Amandla amakhulu esibhakabhaka. Impendulo encane yomuntu." · rain-possible[10] "Letha ijazi. Noma isivikelo selanga. Noma kokubili."
4. Time words are exact: namuhla is *today*. Morning is "namuhla ekuseni", tonight "namuhla ebusuku". The native review flagged a bare "namhlanje" standing for *tonight* (NATIVE_REVIEW_ZU A2).
   fog[16] "Izintaba ziseholidini namuhla." (today) · served lines fog[99], wind[38], cold[101] use "namuhla ebusuku" for tonight.
5. Weather and places are people: they have plans, grudges, holidays.
   rain[32] "umfula uneziluleko" · wind[14] "Umoya unenzondo yomuntu siqu ngezambulela." · clear[34] "I-Afrika iyaziqhayisa futhi."
6. Negate with the Zulu negative forms, not with a word: akukho / akekho / a-…-i.
   cloudy[18] "Akekho ozoposta lokhu" · night[10] "Akukho okungalungiswa yinkomishi yerooibos."
7. The brand hedge is Cishe (Probably).
   partly-cloudy[12] "Cishe usuku lwebraai." · witty_low_confidence.wind[0] "Cishe kunomoya."
8. Plain attested words or a descriptive phrase over a coinage.
   rain-possible[10] "isivikelo selanga" (sunscreen) · fog[30] "iswishi yokuncipha ukukhanya" (dimmer switch).
9. Comparisons run on sengathi / njenga-.
   cold-clear[26] "zibuthene sengathi zikhokhele indawo."
10. Place names take locatives and class prefixes like any noun.
   fog[30] "IKapa" · cold-clear[26] "eziku-N1" · cold-clear[12] "I-Pretoria-bare-jacaranda energy."

## Anti-patterns (the pack's record)
1. A real word with the wrong meaning shipped with confidence: umkhumbi (ship) for kite, amapulazi (farms) for pools, izinkonjane (swallows) for seagulls, izindlela (roads) for expectations, isijele (jail) for jersey.
2. An invented word (the imbatata rule): unconfirmed noun → plain attested word or a phrase, never a coinage. And the outsider does not overrule a native's word.
3. "namuhla" alone where the English says tonight or this evening.
4. Textbook-ifying a real loan (braai, i-Toyota, lekker, brand and place names stay).
