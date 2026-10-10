# lang-check exam — October 2026 (before vs after)

Run 2026-10-10. Gold set: the September exam's set as it stands (2816 scored items; 6 adversarial items excluded by the same rule). Threshold: confidence ≥ 0.25. BEFORE = the 6 Sept checker (`lib/checker.mjs`, its numbers reproduce `exam-result-2026-10-baseline.md`). AFTER = `lib/checker-v2.mjs`: concord + back-translation (Sonnet 5.5) + attestation in context. "after, no BT" = AFTER without the back-translation pass.

| lang | precision before → after (no BT) | recall before → after (no BT) | wrong-sense recall | wrong-language recall | verdict |
|---|---|---|---|---|---|
| zu | 55% → **56%** (55%) | 60% → **67%** (60%) | 37% → 53% | 84% → 89% | **PASS** |
| xh | 36% → **36%** (36%) | 82% → **87%** (82%) | 62% → 81% | 100% → 100% (ceiling) | **PASS** |
| st | 38% → **39%** (39%) | 82% → **89%** (82%) | 54% → 73% | 95% → 95% | **FAIL** — wrong-language not up |
| af | 67% → **69%** (68%) | 77% → **86%** (77%) | 50% → 83% | 100% → 100% (ceiling) | **PASS** |

**Al's accepted Afrikaans lines** (1673: 448 he wrote or carried from his own bank, 1225 he ruled in): flagged before **43** (3%), after **34** (2%), after without BT 32. His own lines: 16 → 15. Back-translation records for 1673 of them.

Verdict: zu PASS · xh PASS · st FAIL · af PASS. Languages that fail are not drafted in.

## How the rules were set (read before trusting the numbers)

- **Back-translation rule, fixed before any result was seen:** a second model (Sonnet 5.5, 16 subagents, 260 lines each, ids opaque and shuffled so no batch could tell gold from Al's lines or good from bad) translated each line blind, then compared it with the English. `drift` → medium, `wrong-language` / `untranslated` / `garbled` → high, only at its own confidence ≥ 0.6. That rule was not changed after the results came in.
- **Batches 09 and 14 re-run blind (10 Oct):** on 9 Oct batch 09's subagent had the English in context before writing, and batch 14's first write failed and was redone after it had opened the English. On 10 Oct each was re-run by a fresh Sonnet 5.5 agent given only its blind file in an empty folder; the English went to it only after its back-translation was written and locked (byte-compared). The re-runs replace the old records (`batch-09-rerun`, `batch-14-rerun` in the cache).
- **Concord rules** were tuned on native text only — the confirmed bank lines and 10,000 Leipzig sentences per language — before the gold set was scored with them.
- **Rules added after looking at Al's accepted Afrikaans lines** (the precision measure for Afrikaans): double negation closed per clause, a separable verb's participle (by-ge-vul), place adjectives (Joburgse), and a word attested ≥ 5 times in the n-gram corpora. They are general Afrikaans grammar, not item fixes, but they were written with those 43 lines in view; their effect on the gold set is in the "after, no BT" column.
- **No threshold or rule was changed to pass.** The 10 Oct re-run changed only test defects, listed below with their reasons; each check is the 9 Oct code.

## Gold-set fixes (test defects, not tuning)

A label changed only where the English and the translation demonstrably do not correspond, on written evidence that predates the exam. Every isiZulu false alarm of the rebuilt checker was read; those not listed were left as labelled.

- zu-good-163 relabelled good / native-bank → bad / wrong-sense: "Cloud cover, low effort." / "Amafu nelanga - bobabili lapha.". Keyed to the wrong English line: the partly-cloudy isiZulu array of a3cbfd3 was never a translation of the English at its index (scripts/translation-skills/README.md; review/zu-addendum.md, 2 Jul 2026: bin authored misordered). The 23 Sept taxonomy typed it WRONG_KEY (zu-0255): "Clouds and sun, both here" renders the sibling "Some clouds. Some sun.", not "Cloud cover, low effort."
- zu-good-165 relabelled good / native-bank → bad / wrong-sense: "Halfway to a Highveld thunderstorm. Or not." / "Amafu amancane, ilanga elikhulu.". The English is a storm threat ("Halfway to a Highveld thunderstorm. Or not."); the isiZulu says "few clouds, big sun". Opposite weather. It sits in the partly-cloudy bank the isiZulu addendum (2 Jul 2026) records as authored misordered; the 2 Oct translation check (review/translation-check-data.json zu-0259) marked it MISMATCH, keyed to another line. The 23 Sept taxonomy typed it WRONG_KEY (zu-0259): it renders the sibling "Some clouds. Some sun."
- zu-good-170 relabelled good / native-bank → bad / wrong-sense: "Sunscreen, but keep a hoodie close." / "Phatha ihembe nesijele - kokubili.". isijele is jail, not jersey (ijezi): native ruling in lang-packs/zu/errors-observed.md, lexicon-protected.md, banned-words.json and review/zu-addendum.md (2 Jul 2026). The line says "carry a shirt and a jail".
- zu-good-175 relabelled good / native-bank → bad / wrong-sense: "Cloudy enough to comment, sunny enough to ignore." / "Amafu axubene nelanga - kuhle kakhulu.". Keyed to the wrong English line: the partly-cloudy isiZulu array of a3cbfd3 was never a translation of the English at its index (scripts/translation-skills/README.md; review/zu-addendum.md, 2 Jul 2026: bin authored misordered). The 23 Sept taxonomy typed it WRONG_KEY (zu-0269): "Clouds mixed with sun, very nice" renders the sibling "Some clouds. Some sun.", not "Cloudy enough to comment, sunny enough to ignore." Not flagged by either checker; relabelled for the same reason as zu-good-163.
- Read and left as labelled (doubt, not proof): zu-good-301 "amangisi" for underwear, zu-good-354 "esikhongelweni" for the bin, zu-good-191 "ubuntu" for personality, zu-good-130 "siyabafura" for buffering, zu-good-469 "okosa", zu-good-182 (sunscreen implied, not named). A native should rule them before the next exam.
- st-bad-3541 wrong-language plant thata → tota: "Ho tjhesa tota". thata is ordinary Sesotho too (ho thata = it is hard): Sesotho index 215, Sesotho n-gram corpus 250 of 1,253,894 tokens, so no checker can call it Setswana. tota (Setswana: really, truly) — Sesotho index 1, Sesotho n-gram corpus 1; Setswana index 637; Sepedi 0.
- st-bad-3542 wrong-language plant thata → tota: "uv. e hodimu  tota". thata is ordinary Sesotho too (ho thata = it is hard): Sesotho index 215, Sesotho n-gram corpus 250 of 1,253,894 tokens, so no checker can call it Setswana. tota (Setswana: really, truly) — Sesotho index 1, Sesotho n-gram corpus 1; Setswana index 637; Sepedi 0.

## zu

Back-translation records for 597 of 597 scored items.

| | precision | recall | TP | FP | FN | TN |
|---|---|---|---|---|---|---|
| before (6 Sept) | 55% | 60% | 58 | 47 | 38 | 454 |
| after | 56% | 67% | 64 | 50 | 32 | 451 |
| after, no BT | 55% | 60% | 58 | 47 | 38 | 454 |

| class | n | before | after | after, no BT |
|---|---|---|---|---|
| wrong-sense | 30 | 37% | 53% | 37% |
| wrong-language | 19 | 84% | 89% | 84% |
| untranslated | 24 | 67% | 67% | 67% |
| boundary | 19 | 79% | 79% | 79% |
| morphology | 2 | 0% | 0% | 0% |
| register | 2 | 0% | 0% | 0% |

<details><summary>new false alarms and new catches</summary>

- NEW CATCH [wrong-sense] "Amafu nelanga - bobabili lapha." — medium:back-translation:
- NEW CATCH [wrong-sense] "Amafu amancane, ilanga elikhulu." — medium:back-translation:
- NEW FP "Sebenzisa futhi noma uhlupheke." — medium:back-translation:
- NEW FP "Imigqa yokushisa ayisiyona ubuntu." — medium:back-translation:
- NEW FP "Isimo sezulu samabhulukwe amafushane? Lesi isimo sezulu samangisi." — medium:back-translation:
- NEW CATCH [wrong-language] "Son" — high:back-translation:
- NEW CATCH [wrong-sense] "Imvu enzima kakhulu kufanele ikhokhe irenti." — medium:back-translation:
- NEW CATCH [wrong-sense] "Amafutha anesikhathi sawo." — medium:back-translation:
- NEW CATCH [wrong-sense] "Amafutha abukeka esolisa ngempela." — medium:back-translation:

</details>

## xh

Back-translation records for 597 of 597 scored items.

| | precision | recall | TP | FP | FN | TN |
|---|---|---|---|---|---|---|
| before (6 Sept) | 36% | 82% | 65 | 116 | 14 | 402 |
| after | 36% | 87% | 69 | 121 | 10 | 397 |
| after, no BT | 36% | 82% | 65 | 116 | 14 | 402 |

| class | n | before | after | after, no BT |
|---|---|---|---|---|
| wrong-sense | 21 | 62% | 81% | 62% |
| wrong-language | 18 | 100% | 100% | 100% |
| untranslated | 17 | 100% | 100% | 100% |
| spelling | 4 | 25% | 25% | 25% |
| boundary | 19 | 84% | 84% | 84% |

<details><summary>new false alarms and new catches</summary>

- NEW FP "Yiza nesilamba. Okanye iSunscreen. Okanye zombini." — medium:back-translation:
- NEW FP "Ilanga lidlala imidlalo namhlanje." — medium:back-translation:
- NEW FP "Ngo - 6" — medium:back-translation:
- NEW FP "Uhlobo lwesibhakabhaka olwenza ubulele izinto zasimahla." — medium:back-translation:
- NEW FP "Kubonakala kubanda. I-thermometer isenza siqikelele." — medium:back-translation:
- NEW CATCH [wrong-sense] "Amafutha ayazibonakalisa namhlanje." — medium:back-translation:
- NEW CATCH [wrong-sense] "Amafutha akhangeleka erhaneleka nyhani." — medium:back-translation:
- NEW CATCH [wrong-sense] "Ingqondo ifikile yaye ize nabahlobo bayo." — medium:back-translation:
- NEW CATCH [wrong-sense] "50/50 ukufumana amazwi. Njengomdlalo." — medium:back-translation:

</details>

## st

Back-translation records for 558 of 558 scored items.

| | precision | recall | TP | FP | FN | TN |
|---|---|---|---|---|---|---|
| before (6 Sept) | 38% | 82% | 59 | 98 | 13 | 388 |
| after | 39% | 89% | 64 | 101 | 8 | 385 |
| after, no BT | 39% | 82% | 59 | 91 | 13 | 395 |

| class | n | before | after | after, no BT |
|---|---|---|---|---|
| wrong-sense | 26 | 54% | 73% | 54% |
| wrong-language | 19 | 95% | 95% | 95% |
| untranslated | 18 | 100% | 100% | 100% |
| spelling | 3 | 100% | 100% | 100% |
| calque | 4 | 100% | 100% | 100% |
| register | 1 | 100% | 100% | 100% |
| wrong-dialect | 1 | 100% | 100% | 100% |

<details><summary>new false alarms and new catches</summary>

- FP GONE "Modumo wa seaduma"
- FP GONE "Modumo wa seaduma o a tla"
- NEW FP "Kae-kae sekhele se sa tsoa reteleha ka hare. Motsotso oa kgutso." — high:back-translation:
- NEW FP "Sephethephethe se na le maikutlo." — medium:back-translation:
- NEW FP "Sephethephethe se sa tsoa hopola hore pula e teng. Hape." — medium:back-translation:
- NEW FP "Letsatsi le tla le tsamaee." — medium:back-translation:
- NEW FP "Mela ea ho tjhesa ha se botho." — medium:back-translation:
- NEW FP "Moea o na le vendetta ea motho ka bo eena khahlanong le disekhele." — medium:back-translation:
- NEW FP "Layers off ka 11. Layers on ka 4. Highveld classic." — high:back-translation:
- FP GONE "Dula o na le metsi kapa o   fetohe sehwapa"
- NEW FP "Pool ea baahisane ha e e-s'o shebahale e khahlisang hakana." — medium:back-translation:
- FP GONE "Kae-kae tswiritswiri e binela ka matla."
- FP GONE "Merubisi e ahlola nako ea hao ea skrini."
- FP GONE "Haeba u sebetsa kajeno, re u utloela bohloko."
- NEW CATCH [wrong-sense] "ho fihla ho" — high:back-translation:
- NEW FP "rather use Boemo ba UV bo phahameng" — high:back-translation:
- NEW FP "setlolo sa letsatsi" — medium:back-translation:
- FP GONE "Haeba u sebetsa kajeno, re u utloela bohloko.”"
- NEW CATCH [wrong-sense] "Sekhele se robehile ka mosi oa pele. Setso." — medium:back-translation:
- NEW CATCH [wrong-sense] "Bohobe bo hlakileng" — medium:back-translation:
- NEW CATCH [wrong-sense] "Bohobe bo hlakileng." — medium:back-translation:
- NEW CATCH [wrong-sense] "Ho na le mohlolo." — medium:back-translation:

</details>

## af

Back-translation records for 1064 of 1064 scored items.

| | precision | recall | TP | FP | FN | TN |
|---|---|---|---|---|---|---|
| before (6 Sept) | 67% | 77% | 57 | 28 | 17 | 962 |
| after | 69% | 86% | 64 | 29 | 10 | 961 |
| after, no BT | 68% | 77% | 57 | 27 | 17 | 963 |

| class | n | before | after | after, no BT |
|---|---|---|---|---|
| wrong-sense | 18 | 50% | 83% | 50% |
| wrong-language | 18 | 100% | 100% | 100% |
| untranslated | 17 | 94% | 100% | 94% |
| diacritic | 17 | 65% | 65% | 65% |
| spelling | 3 | 100% | 100% | 100% |
| calque | 1 | 0% | 0% | 0% |

<details><summary>new false alarms and new catches</summary>

- NEW FP "Iemand het reggewens by die verjaarsdagkoek." — high:back-translation:
- FP GONE "Die maan het 'n 'moenie steur nie'-bordjie opgehang."
- NEW FP "Geniet dit. Die koue front het klaar sy tasse gepak." — medium:back-translation:
- NEW CATCH [untranslated] "Sky's playing kat-en-muis." — high:back-translation:
- NEW CATCH [wrong-sense] "Dis nie wolwe nie, dis 'n lokprent." — medium:back-translation:
- NEW CATCH [wrong-sense] "Die wolwe het 'n oomblik." — medium:back-translation:
- NEW CATCH [wrong-sense] "Twintig minute se opera, dan maak die seun of niks gebeur het nie." — medium:back-translation:
- NEW CATCH [wrong-sense] "Die seun speel siek vandag." — medium:back-translation:
- NEW CATCH [wrong-sense] "Die lig het n volle vloermoer." — high:back-translation:
- NEW CATCH [wrong-sense] "Die nek het 'n weighted blanket oor alles kom gooi." — medium:back-translation:

</details>

## Al's accepted Afrikaans lines the rebuilt checker still flags

- "Geniet dit. Die koue front het klaar sy tasse gepak." — medium:back-translation:
- "Steek die Weber aan. Dit is die wet." — medium:contamination:wet
- "Hierdie weer het n 'meh' houding." — medium:contamination:meh
- "Schrödinger se reën. Dit is én is nie." — medium:lexical:Schrödinger
- "Selfs die meeuë loop vandag." — medium:lexical:meeuë
- "Die roomyswa speel almal se volkslied." — medium:lexical:roomyswa
- "Twee druppels op die voorruit en die hele N1 se geheue is skoon gewas." — medium:semantic:geheue
- "Die lug het voluit bedonerd gegaan." — medium:lexical:bedonerd
- "Daardie lakens gaan droog wees voor sy die laaste een opgehang het." — medium:semantic:voor
- "Sy lê op teël eerder as op iets sags, en dit was 'n besluit." — medium:contamination:sags
- "Niemand in daardie gebou kan 'n venster oopmaak nie en elkeen van hulle het probeer." — medium:morphology:Niemand
- "Ryp op die gras, stoom van die veld af: wintersdrafweer op sy eerlikste." — medium:lexical:wintersdrafweer
- "Nagreënwiskunde: helfte die sig, dubbel die konsentrasie, drie keer die respek." — medium:lexical:Nagreënwiskunde
- "Jou huisherstellys het 'n dringende opdatering aangevra." — medium:lexical:huisherstellys
- "Plat see, moeë son, en die lug nog warm genoeg om in 'n nat wetsuit rond te sit." — medium:semantic:wetsuit
- "Vinnige hardloop. Jy het nog nooit een reg getyd nie." — medium:lexical:getyd
- "Die houtskool is uit, die lug is onbeslis, en nie een gee kop nie." — medium:semantic:lug
- "Die horison het een strokie oranje gehou as bewys dat die son hier was." — medium:semantic:gehou
- "Die voorruit het gisteraand se rekord gehou, en sy vee dit met die hand uit." — medium:semantic:gehou
- "Die blou helfte van die lug leef op geleende tyd, en die grasperke weet dit." — medium:semantic:leef
- "Die son het vir die hele wedstryd uitgebly en draai nog rond vir die tjips." — medium:back-translation:
- "Hoeveel opwarmings was jy van plan om te doen?" — medium:lexical:opwarmings
- "Joburgse winterdagbreek: die uitsig is verniet; die lug vra toegangsgeld." — medium:semantic:vra
- "Jou dakherstelspaargeld is raakgesien." — medium:lexical:dakherstelspaargeld
- "Die laatnag-melkrit het 'n groter versoek geword." — medium:lexical:laatnag-melkrit
- "Die son probeer sy geluk op die horison, en die wolke is onbeïndruk." — medium:lexical:onbeïndruk
- "Die eerste tien minute van hierdie Sondag behoort aan 'n kredietkaart en die ontwaser." — medium:lexical:ontwaser
- "Die blare laat die sekuriteitslig aanhoudend aanskakel. Die hond staan nie meer op daarvoor nie." — medium:semantic:staan
- "Die lug het van liggrys na donkergrys gegaan. Dit was die hele vertoning." — medium:semantic:lug
- "See en lug in bypassende grys. Net die pier se liggies het moeite gedoen." — medium:semantic:lug
- "Joburg winterdagbreek: die uitsig is verniet; die lug vra toegangsgeld." — medium:semantic:vra
- "Die swembad word vanaand gratis vol gemaak. Iewers ontspan 'n waterrekening." — medium:semantic:vol
- "Die swembad word vanaand deur hoofkantoor vol gemaak, gratis." — medium:semantic:vol
- "Hierdie weer het 'n 'meh' houding." — medium:contamination:meh

(38.2 s)
