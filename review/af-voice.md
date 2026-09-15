# Afrikaans voice for the bespoke lines

Extracted on 2026-09-15 from the 350 canon rows (grey, native-reviewed) in
review/af-side-by-side.html, and nothing else. Every rule cites canon lines by their
sheet id. The gate that applies it is scripts/lang-check/apply-af-accepted.mjs; the
judged rows are in review/af-bespoke-decisions.json; rows that did not clear the gate
are on review/af-al.html.

## Ten rules (canon evidence)
1. Rebuild the joke, don't translate the words. The Afrikaans lands its own punchline when the English one is idiom-bound.
   C002 "Weer só mooi is nie gratis nie. Iewers wag 'n suidooster." (EN: on loan / keeps receipts) · C010 "Die koue front het klaar sy tasse gepak." · C039 "Als dié blou, dié vroeg? Iets broei." · C053 "Die son gaan af soos hy weet ons kyk."
2. Shorter than the English, fragments welcome; cut the clause that doesn't carry.
   C040 "Kanselleer alles. Dis DIÉ dag." · C223 "Nul wind, nul wolke, nul genade." · C060 "Stil daarbuite. Byna verdag." · C293 drops "Hazards on, dignity off".
3. Things get "hy": the sun, the car, the front, the thunder, the Vrystaat are characters.
   C211 "Die son is op, maar hy werk nog nie." · C217 "Jy skuld hom 'n was." · C188 "…en hy het maats gebring." · C329 "Hy het dit verdien." · C224 "Die Vrystaat het pas onthou hy het 'n winter-setting."
4. SA code-switching the way people talk — loanwords where a speaker would really use them, never as decoration.
   C013 "attitude" · C075 "out-of-office" · C086 "airplane mode" · C217 "met die eerste try gevat" · C245 "Golden hour" · C271 "Jou brights" · C195 "duvet" · C057 "playlist".
5. Spoken register markers, sparingly: ne, boet, Jinne, tjommies, boytjie, Presies, Plesier, Min of meer.
   C093 "…net vir ingeval, ne." · C071 "Braaiweer, boet!" · C171 "Jinne, dis ordentlik warm!" · C051 "Bel die tjommies." · C020 "Plesier." · C031 "Min of meer."
6. Afrikaans idiom over calque — reach for the phrase an Afrikaans speaker already owns.
   C275 "tou opgegooi" · C111 "kat en muis" · C107 "wegkruipertjie" · C337 "vloermoer" · C091 "speel siek" (bunking) · C108 "tjailatyd" (smoke break) · C190 "karaktertoets. Jy druip."
7. Diacritics carry meaning and emphasis; use them.
   só, dié, môre, reën, wêreld, meeuë, opgeëet, Hoëveld · emphasis: C040 "DIÉ dag" · C104 "Dit is én is nie." · C207 "óók aan".
8. The double negative closes every negated clause.
   C033 "Geen verskonings nie." · C005 "Sê dit net vir niemand nie." · C073 "Niemand kla nie." · C185 "…en hulle kom nie uit nie."
9. Keep the SA anchors and localise them: places, brands of daily life, food.
   C132 "Die Kaapse Dokter maak huisbesoeke." · C133 "Tafelberg se tafeldoek" · C166 "bakkie" · C173 "biltong" · C325 "Beskuit eerste." · C181 "Sani Pass" · C099 "by Spur".
10. SA Afrikaans conventions for time and numbers; "Waarskynlik" is the brand's hedge.
   C151 "06:00" · C172 "19:00" · C155 "9vm" · C221 "Sewe-uur se son" · C087 "Ons sê waarskynlik." · C276 "Iewers. Waarskynlik."

## Five anti-patterns
1. Literal English idiom carried over word for word ("giving … energy", "having a moment", "main character"): C089 "…'ek probeer weer môre' energie" and C294 "Die wolke het 'n oomblik." are the canon's weakest lines — do not extend the pattern.
2. "n" without the apostrophe for the article: C093, C098, C100, C109, C116, C125, C280, C315, C337 carry it — typos, not voice. Always 'n.
3. A negated clause without its closing nie, or a Dutch form (niet, zijn, regen, vandaag, lucht) — the checker's HIGH class.
4. Adding content the English didn't have: a braai PLAN on a weekday photograph (braai plans are weekend-only; braai imagery any day), a day name that differs from the English, a new person or object.
5. Longer and heavier than the English — the line is a caption on a photograph; if the Afrikaans needs an extra sentence to land, the transcreation is wrong.
