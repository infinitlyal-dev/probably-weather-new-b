# lang-check validation exam — 2026-09-06

Gold set: 3625 scored items (6 adversarial wrong-sense items excluded because the substitute is not corpus-attested). Threshold for the new checker: confidence ≥ 0.25. Baseline = the four SKILL.md check() procedures as code (scripts/lang-check/baseline.mjs).

## zu — 503 good, 94 bad (scored classes)

| | precision | recall | TP | FP | FN | TN |
|---|---|---|---|---|---|---|
| baseline (old skill) | 50% | 1% | 1 | 1 | 93 | 502 |
| rebuilt (corpus-backed) | 55% | 63% | 59 | 48 | 35 | 455 |

| class | n | baseline recall | rebuilt recall | rebuilt ≥0.5 |
|---|---|---|---|---|
| wrong-sense | 28 | 0% | 43% | 0% |
| wrong-language | 19 | 5% | 84% | 42% |
| untranslated | 24 | 0% | 67% | 0% |
| boundary | 19 | 0% | 79% | 11% |
| morphology | 2 | 0% | 0% | 0% |
| register | 2 | 0% | 0% | 0% |
| rewritten | 11 | 0% | 9% | 0% |

Baseline cannot see: wrong-sense, untranslated, boundary, morphology, register. Weak-good rows (future_review / UI labels) flagged: baseline 30/90, rebuilt 11/90.

Pass rule for zu: wrong-sense recall 0% → 43%, wrong-language recall 5% → 84%, precision 50% → 55% ⇒ **PASS**

<details><summary>misses and false positives</summary>

- FP "Ukosa kukhanselelwe. Yebo, ngempela." conf=0.3: medium:lexical:kukhanselelwe
- FP "Imvelo isanda kusikhumbuza ukuthi ubani ophambili." conf=0.3: medium:semantic:isanda
- FP "Imvelo ifuna ukukhuluma. Kungcono ulalele." conf=0.35: medium:semantic:ifuna
- FP "Lindela phakathi. Izintaba aziyi ndawo." conf=0.35: medium:semantic:Lindela
- FP "Izinhlelo zezinwele: zikhanselelwe." conf=0.5: high:lexical:zikhanselelwe
- FP "Imvula ka-Schrödinger. Iyakhona futhi ayikho." conf=0.6: high:morphology:ka-Schrödinger.
- FP "Akubi kubi, akubi kuhle. Njengedethi ye-6/10." conf=0.4: medium:lexical:Njengedethi
- FP "Isibhakabhaka siyabafura." conf=0.5: high:lexical:siyabafura
- FP "Isimo sezulu esinele. Asikuhle, asikubi." conf=0.5: medium:lexical:Asikuhle | medium:lexical:asikubi
- FP "Akekho ozoposta lokhu ku-Instagram." conf=0.25: medium:lexical:ozoposta
- FP "Lesi simo sezulu sinokuthi 'meh' kuyo yonke indawo." conf=0.35: medium:contamination:meh
- FP "Amafu aphendule athi 'mhlawumbi' avele eza nje." conf=0.4: medium:contamination:mhlawumbi
- FP "Phatha ihembe nesijele - kokubili." conf=0.4: medium:lexical:nesijele
- FP "Ikhrimu yelanga ayikhona ukukhetha, boet." conf=0.3: medium:lexical:Ikhrimu
- FP "Uzobukeka njengelobster. Uxwayisiwe." conf=0.4: medium:morphology:njengelobster
- FP "Ungabhaka isteki epavimentini manje." conf=0.75: medium:lexical:isteki | medium:lexical:epavimentini
- FP "Isabiwezimali sesivikelo selanga: siphezulu kunebhili yakho yedatha." conf=0.55: medium:lexical:Isabiwezimali | medium:morphology:kunebhili
- FP "Gqoka izingubo eziningi njengokukhwela uSani Pass." conf=0.45: medium:morphology:njengokukhwela
- FP "Imodhi ye-blanket burrito: ivuliwe." conf=0.4: medium:lexical:Imodhi
- FP "Amapheya amathathu amakawusi kodwa akwanele." conf=0.25: medium:lexical:amakawusi
- FP "Awubandi, u-'lekker koud'. Umehluko omkhulu." conf=0.3: medium:lexical:koud
- FP "Ukubalwa kwekhofi: kuyenyuka. Ukubalwa kogqozi: kusewuziro." conf=0.3: medium:lexical:kusewuziro
- FP "Ifriji ibonakala ifudumele kunelawunji namuhla." conf=0.25: medium:lexical:kunelawunji
- FP "Imoto ikhwehlele kabili ngaphambi kokuvuma uku-starta." conf=0.25: medium:lexical:uku-starta
- FP "I-geyser i-tripile ebusuku. Yebo, vele." conf=0.3: medium:lexical:i-tripile
- FP "Uhlobo losuku iJoburg ezenza sengathi alukho, kuze kube usume phakathi kwalo." conf=0.5: medium:lexical:usume
- FP "Ama-tile floors yi-villain yanamuhla kusihlwa. Gqoka okuthile ezinyaweni." conf=0.45: medium:semantic:yanamuhla
- FP "I-weather yokubilisa i-kettle kabili: kanye nge-coffee, kanye ukufudumeza izandla." conf=0.3: medium:contamination:I-weather
- FP "I-Toyota i-startile nge-first try. Uyikweleta i-wash." conf=0.3: medium:lexical:i-startile
- FP "I-Maluti-frost morning. I-Lesotho iyayi-exporta mahhala." conf=0.75: medium:contamination:I-Maluti-frost | medium:contamination:morning | medium:lexical:iyayi-exporta
- FP "Bonke abanepuli basanda kuba nesithunzi kakhulu." conf=0.4: medium:lexical:abanepuli
- FP "Iphayi lasegalaji ngoba ikhishi yi-lava." conf=0.25: medium:lexical:Iphayi
- FP "Bonke bangabangane bakho uma unepuli." conf=0.3: medium:lexical:unepuli
- FP "Imoto ye-ice cream idlala iculo lawo wonke umuntu." conf=0.4: medium:semantic:Imoto
- FP "Noma ngubani onepuli namuhla ngumngane wakho omusha omkhulu." conf=0.35: medium:lexical:onepuli
- FP "Ungalithinti ibhakili lebhande lokuvikela. Sithembe." conf=0.35: medium:lexical:ibhakili
- FP "Ukuhamba uye esikhongelweni manje kuwuhambo." conf=0.35: medium:lexical:esikhongelweni
- FP "Ekuseni kukhohliwe ukurenda." conf=0.55: high:lexical:ukurenda
- FP "Isizathu sakho sokuhlala ngaphakathi sisanda kuphelelwa." conf=0.35: medium:semantic:sisanda
- FP "Izinsuku ezinje yizona ezenza sikhuthazelele i-load shedding." conf=0.55: medium:lexical:sikhuthazelele | medium:semantic:ezenza
- FP "Olungcono ngempela. Ungalumoshi." conf=0.6: high:lexical:Ungalumoshi
- FP "Inyanga yenza konke namhlanje ebusuku." conf=0.3: medium:semantic:namhlanje
- FP "Amalahle awazozikhanyisela." conf=0.5: high:lexical:awazozikhanyisela
- FP "Kunamafu cishe. Ungabhejeli ukosa kukho." conf=0.3: medium:lexical:Ungabhejeli
- FP "Izimo ezimanzi, cishe. Ungasicaphuni okosa." conf=0.25: medium:lexical:Ungasicaphuni
- FP "Kungana. Kungasongela nje." conf=0.5: high:lexical:Kungasongela
- FP "Kungakhihliza kancane. Kungase kungahluphi." conf=0.25: medium:lexical:Kungakhihliza
- FP "Ukubanda yikho esikubhejayo. Ungathembi iwindi elinelanga ebusika." conf=0.35: medium:lexical:esikubhejayo
- MISS [wrong-language] "Son" (I18N_CROSS_LANGUAGE_AUDIT.md canonical) conf=0.05
- MISS [register] "Kubanda" (git d51b173 (native review) label register) conf=0.05
- MISS [register] "Kupholile" (git d51b173 (native review) label register) conf=0.05
- MISS [wrong-sense] "Kunamafu" (git d51b173 (native review) partly cloudy used for overcast) conf=0.05
- MISS [wrong-sense] "Ubusuku obuhlanzekile" (git d51b173 (native review) clean/hygienic used for clear) conf=0.05
- MISS [morphology] "Isiphepho siyeza." (git d51b173 (native review) singular concord for plural) conf=0.05
- MISS [boundary] "Kunenkungu." (git d51b173 (native review) Kune inkungu) conf=0.05
- MISS [wrong-sense] "Izulu lihlanzekile." (git d51b173 (native review) clean/hygienic used for clear) conf=0.05
- MISS [wrong-sense] "Ubusuku obuhlanzekile." (git d51b173 (native review) clean/hygienic used for clear) conf=0.05
- MISS [untranslated] "EBloemfontein ngo-6 ekuseni: i-jersey, i-gown, i-scarf, ama-takkies, nobuso obunesibindi." (git d51b173 (native review) English/Afrikaans left in) conf=0.2
- MISS [untranslated] "I-Free State isanda kukhumbula ukuthi ine-winter setting." (git d51b173 (native review) English/Afrikaans left in) conf=0.05
- MISS [morphology] "Isithwathwa otshanini. Isithwathwa ku-bakkie. Isithwathwa ku-pet bowl." (git d51b173 (native review) missing existential Kune-) conf=0
- MISS [untranslated] "Lekker koud, kodwa ama-rugby fields azobukeka e-perfect manje." (git d51b173 (native review) English/Afrikaans left in) conf=0.2
- MISS [untranslated] "EWelkom, eSasolburg, eKroonstad: i-koue belt yenza i-koue thing yayo." (git d51b173 (native review) English/Afrikaans left in) conf=0.2
- MISS [untranslated] "Ama-layers ayaphuma ngo-11. Ama-layers ayabuya ngo-4. I-Highveld classic." (git d51b173 (native review) English/Afrikaans left in) conf=0.2
- MISS [untranslated] "Ama-hadedas amathathu, amagwababa amabili, nomuntu oyedwa oqhaqhazelayo ku-bird feeder." (git d51b173 (native review) English/Afrikaans left in) conf=0.05
- MISS [untranslated] "Kubanda kangangokuthi i-milk bottle ese-stoep manje isiyi-cooler box." (git d51b173 (native review) English/Afrikaans left in) conf=0.15
- MISS [wrong-sense] "Izicathulo zokushibilika ku-tar bekuyiphutha." (git d51b173 (native review) sliding shoes used for flip-flops) conf=0
- MISS [untranslated] "Ubusuku obuhle-ish. Ungasibambi ezinkanyezini." (git d51b173 (native review) English/Afrikaans left in) conf=0.05
- MISS [wrong-sense] "Imvu engase ine" (adversarial wrong-sense: imvula → imvu (sheep)) conf=0.05
- MISS [wrong-sense] "Imvu enzima kakhulu kufanele ikhokhe irenti." (adversarial wrong-sense: imvula → imvu (sheep)) conf=0.1
- MISS [wrong-sense] "Amafutha anesikhathi sawo." (adversarial wrong-sense: amafu → amafutha (fat/oil)) conf=0.15
- MISS [wrong-sense] "Amafutha abukeka esolisa ngempela." (adversarial wrong-sense: amafu → amafutha (fat/oil)) conf=0.15
- MISS [wrong-sense] "Kubanda, izwe licwebile" (adversarial wrong-sense: izulu → izwe (country)) conf=0.05
- MISS [wrong-sense] "Kuyabanda, kodwa izwe licwebile." (adversarial wrong-sense: izulu → izwe (country)) conf=0
- MISS [wrong-sense] "Umuzi waseningizimu ufikile. Ungamenyiwe, njengenjwayelo." (adversarial wrong-sense: umoya → umuzi (homestead)) conf=0
- MISS [wrong-sense] "Cishe kuyabanga. Thatha ijezi, uzosibonga." (adversarial wrong-sense: kuyabanda → kuyabanga (it causes)) conf=0.05
- MISS [wrong-sense] "Kuyabanga, cishe. Gqoka izingubo eziningi." (adversarial wrong-sense: kuyabanda → kuyabanga (it causes)) conf=0.2
- MISS [wrong-sense] "Akusona isikhali sokuqhawe, hey." (adversarial wrong-sense: isikhathi → isikhali (weapon)) conf=0.1
- MISS [wrong-sense] "Isikhali sokumba i-beanie embi." (adversarial wrong-sense: isikhathi → isikhali (weapon)) conf=0.05
- MISS [wrong-language] "Mhlawumbe imvula, mhlawumbe hayi. Okujwayelekile." (adversarial wrong-language: cha → hayi) conf=0.1
- MISS [wrong-language] "Mhlawumbe imvula, mhlawumbe hayi. Okuvamile." (adversarial wrong-language: cha → hayi) conf=0.05
- MISS [boundary] "Imvula engaseine" (adversarial boundary: engase ine fused) conf=0.05
- MISS [boundary] "U-Eskom ufisaukuba namandla anje." (adversarial boundary: ufisa ukuba fused) conf=0.1
- MISS [boundary] "Isibhakabhaka sivelesaba i-Carte Blanche ngokuphelele." (adversarial boundary: sivele saba fused) conf=0.1

</details>

## xh — 518 good, 79 bad (scored classes)

| | precision | recall | TP | FP | FN | TN |
|---|---|---|---|---|---|---|
| baseline (old skill) | 0% | 0% | 0 | 3 | 79 | 515 |
| rebuilt (corpus-backed) | 36% | 82% | 65 | 116 | 14 | 402 |

| class | n | baseline recall | rebuilt recall | rebuilt ≥0.5 |
|---|---|---|---|---|
| wrong-sense | 21 | 0% | 62% | 14% |
| wrong-language | 18 | 0% | 100% | 39% |
| untranslated | 17 | 0% | 100% | 24% |
| spelling | 4 | 0% | 25% | 25% |
| boundary | 19 | 0% | 84% | 21% |
| rewritten | 270 | 1% | 27% | 7% |

Baseline cannot see: wrong-sense, wrong-language, untranslated, spelling, boundary. Weak-good rows (future_review / UI labels) flagged: baseline 30/91, rebuilt 12/91.

Pass rule for xh: wrong-sense recall 0% → 62%, wrong-language recall 0% → 100%, precision 0% → 36% ⇒ **PASS**

<details><summary>misses and false positives</summary>

- FP "Linamafu ngokupheleleyo" conf=0.55: high:lexical:Linamafu
- FP "Linamafu kancinci" conf=0.5: high:lexical:Linamafu
- FP "Ndaweni ithile umxeli wemozulu uphila ubomi obuhle." conf=0.35: medium:lexical:umxeli
- FP "Iindudumo ezikufutshane iindonga zachachamba. Intlonipho." conf=0.3: medium:lexical:zachachamba
- FP "Kuhle kwaye koyikisa ngokulinganayo." conf=0.25: medium:lexical:koyikisa
- FP "Thatha iambrela yakho, bhuti." conf=0.25: medium:lexical:iambrela
- FP "Amadama enza umdaniso wolonwabo." conf=0.25: medium:semantic:wolonwabo
- FP "Imozulu elungele isuphu, andizuxoka." conf=0.3: medium:lexical:andizuxoka
- FP "Iambrela yophuke nje kwakuvuthuza umoya wokuqala. Okwesiqhelo." conf=0.4: medium:lexical:Iambrela
- FP "Umgca kwisikhululo sepethroli usanda kuphindeka kathathu." conf=0.5: medium:lexical:sepethroli | medium:lexical:kuphindeka
- FP "Kwenye indawo iambrela isand’ ukujikwa ngumoya ngaphakathi ngaphandle. Umzuzu wokuthi cwaka." conf=0.45: medium:lexical:iambrela
- FP "Ithrafiki inomvakalelo." conf=0.55: high:lexical:Ithrafiki
- FP "Ijinsi emanzi yonke imini. Isohlwayo esiqhelekileyo." conf=0.3: medium:lexical:Ijinsi
- FP "Ipavimente ngumlambo kwaye umlambo unezicwangciso." conf=0.3: medium:lexical:Ipavimente
- FP "Uyilibele ibhatyi yakho? Indalo iphela ikuqaphele oko." conf=0.4: medium:semantic:Indalo
- FP "Itrafikhi isanda kukhumbula ukuba imvula ikhona. Kwakhona." conf=0.25: medium:lexical:Itrafikhi
- FP "Phakisha isambreli. Okanye ungaphakishi. Asazi nathi." conf=0.35: medium:lexical:ungaphakishi
- FP "Amafu ayoyikisa kodwa mhlawumbi ayakhohlisa." conf=0.3: medium:lexical:ayoyikisa
- FP "Imvula kaSchrödinger — ikhona kodwa kwangaxeshanye ayikho" conf=0.6: high:morphology:kaSchrödinger
- FP "Impahla yonekwe ecingweni yaye uziva unesbindi." conf=0.35: medium:lexical:yonekwe
- FP "Phakathi kobamhle nokuba manzi. Unqweno omhle." conf=0.45: medium:lexical:kobamhle
- FP "Namhlanje isibhakabhaka asinakuthembeka." conf=0.5: high:lexical:asinakuthembeka
- FP "Isibhakabhaka siyabafura." conf=0.5: high:lexical:siyabafura
- FP "Imozulu ayonqena namhlanje." conf=0.5: high:lexical:ayonqena
- FP "Ayidakumbisi. Kodwa... ayinamdla tu." conf=0.3: medium:lexical:Ayidakumbisi
- FP "Isibhakabhaka sinika loo vibe ka “ndiza kuphinda ndizame ngomso.”" conf=0.35: medium:contamination:vibe
- FP "Imozulu ilungile ngokwaneleyo. Ayintle kakhulu, ayimbi kakhulu." conf=0.3: medium:lexical:Ayintle
- FP "Akukho mntu uza kuposta le sunset kwi-Instagram." conf=0.25: medium:lexical:kuposta
- FP "Ayiyomozulu ye-Instagram. Ayisosiphelo sehlabathi." conf=0.25: medium:morphology:Ayiyomozulu
- FP "Le mozulu ibhalwe 'meh' kuyo yonke indawo." conf=0.3: medium:contamination:meh
- FP "Amafu aphendule athi “mhlawumbi,” kodwa avele afika kunjalo." conf=0.35: medium:semantic:avele
- FP "Uqikelelo: ii-vibes eziphakathi, ulindeleko lusezantsi." conf=0.3: medium:lexical:ulindeleko
- FP "Ilanga lidlala umcacamezelo." conf=0.5: high:lexical:umcacamezelo
- FP "Isibhakabhaka siyayila, asizibopheleli." conf=1: high:lexical:siyayila | high:lexical:asizibopheleli
- FP "Ilanga lisayotshaya" conf=0.5: high:lexical:lisayotshaya
- FP "Kuthe gqabagqaba ngamafu." conf=0.5: high:lexical:gqabagqaba
- FP "Ikhrimu yelanga ayisosikhetho, boet." conf=0.7: medium:lexical:Ikhrimu | medium:lexical:ayisosikhetho
- FP "Uza kubomvu njenge-lobster. Ulumkisiwe." conf=0.3: medium:lexical:Ulumkisiwe
- FP "I-ozone layer ifownile — ithathe ileave." conf=0.3: medium:lexical:ifownile
- FP "iHat, izipeksi, sunscreen. Ayixoxisi." conf=0.35: medium:lexical:izipeksi
- FP "Nokuhamba uye emotweni namhlanje kubeka emngciphekweni welanga." conf=0.5: medium:semantic:Nokuhamba | medium:semantic:kubeka
- FP "Ilanga alikhathalelanga izicwangciso zakho." conf=0.3: medium:lexical:alikhathalelanga
- FP "Ibhajethi yekrimu yelanga: ingaphezulu kwebhili yakho yedatha." conf=0.3: medium:lexical:yekrimu
- FP "Umoya wemzantsi mpuma ufikile. Ungamenywanga njengesiqhelo." conf=0.25: medium:lexical:Ungamenywanga
- FP "Neengabangaba zihamba ngeenyawo namhlanje." conf=0.25: medium:lexical:Neengabangaba
- FP "Impahla yakho iphaphathekele kwamelwane." conf=0.35: medium:lexical:iphaphathekele
- FP "Isanti ikwindawo ebekungafanelakanga ikuzo." conf=0.65: medium:lexical:ebekungafanelakanga | medium:lexical:ikuzo
- FP "Itshokolethi eshushu ayikokufuna. Yimfuno." conf=0.3: medium:lexical:Itshokolethi
- FP "Fumbelo okungathi uzakunyuka intaba ye Sani Pass" conf=0.3: medium:lexical:Fumbelo
- FP "Imowudi ye-blanket burrito: ivuliwe." conf=0.4: medium:lexical:Imowudi
- FP "Ukuselwa kwerooibos kuphindaphindeke kabini ngoku." conf=0.3: medium:lexical:kuphindaphindeke
- FP "Awugodoli, u “lekker koud”. Mkhulu umahluko." conf=0.35: medium:lexical:koud
- FP "Akhomtu ubhalisele le mozulu." conf=0.25: medium:lexical:Akhomtu
- FP "Isofa yenze icala elinamandla lokuhlala." conf=0.45: medium:semantic:icala
- FP "Umphandle ukuphoxe wahamba." conf=0.6: high:lexical:ukuphoxe
- FP "Ifriji iziva ifudumele kunelawunji namhlanje." conf=0.35: medium:lexical:kunelawunji
- FP "IFree State isand’ ukukhumbula ukuba nayo inemowudi yasebusika" conf=0.3: medium:lexical:inemowudi
- FP "Imoto ikhohlele kabini phambi kokuba ivume uku-starta." conf=0.5: medium:lexical:ikhohlele | medium:lexical:uku-starta
- FP "Kubanda kamnandi, kodwa amabala ombhoxo sele ezakubamahle." conf=0.45: medium:morphology:ezakubamahle
- FP "Imigangatho ye-tile yi-villain yanamhlanje. Nxiba into ezinyaweni." conf=0.4: medium:semantic:yanamhlanje
- FP "Abantwana basaya esikolweni benxibe ii-shorts. Bazi izinto thina esingazaziyo." conf=0.3: medium:semantic:izinto
- FP "Yimozulu yokubilisa i-ketile kabini. Kube kanye eye-kofu, kubekanye eye-zandla" conf=0.25: medium:lexical:eye-kofu
- FP "Kusasa kwaseKaroo. Uhlobo olwenza uhlonele wonke umlimi okhethe oku." conf=0.3: medium:lexical:uhlonele
- FP "Ii-koppies zijongeka njengeposikhadi. Iinyawo zakho zivakala njengeebhloko zomkhenkce" conf=0.8: medium:lexical:njengeposikhadi | medium:lexical:njengeebhloko
- FP "ii-Hadedas ezintathu, ii-crows ezimbini, nomntu omnye ongcangcazelayo e-bird feeder." conf=0.65: medium:semantic:ii-crows | medium:lexical:ongcangcazelayo
- FP "Nkqu neenkomo ezikwi-N1 ziqokelelene ngathi zibhatele." conf=0.3: medium:lexical:ziqokelelene
- FP "Yi-Maluti-frost morning. ILesotho iyayithumela mahala." conf=0.55: medium:contamination:Yi-Maluti-frost | medium:contamination:morning
- FP "Ungabhaqa inqa kuN1" conf=0.8: high:lexical:inqa
- FP "Ipuli ayisosigqibo — iyafuneka" conf=0.6: high:lexical:ayisosigqibo
- FP "Itshokolethi isandokufa kwenye indawo." conf=0.7: medium:lexical:Itshokolethi | medium:lexical:isandokufa
- FP "Awubilanga uya glowa qha." conf=0.3: medium:lexical:glowa
- FP "Ayomozulu yo shorty lena. Yimozulu yempahla yangapohantsi." conf=0.65: medium:contamination:shorty | medium:lexical:yangapohantsi
- FP "Iphayi yasegaraji ngenxa yokuba ikhitshi yi-lava." conf=0.35: medium:lexical:Iphayi
- FP "Wonke umntu uba ngumhlobho wakho xa une pool." conf=0.35: medium:lexical:ngumhlobho
- FP "Istiyeringi yemoto yakho ishushu okwepani." conf=0.6: medium:lexical:Istiyeringi | medium:lexical:okwepani
- FP "Ucango lwe fridge yakho luya gyma namhlanje." conf=0.3: medium:lexical:gyma
- FP "Nabani onepuli namhlanje ngumhlobo wakho omtsha omkhulu." conf=0.35: medium:lexical:onepuli
- FP "Ikhofi yakho elineqhwa incibilikile ngaphambi kokuba ufike emotweni" conf=0.6: medium:morphology:elineqhwa | medium:contamination:ngaphambi
- FP "Ipuli yommelwane ayikaze ibonakale iheha kangaka" conf=0.3: medium:contamination:ayikaze
- FP "Ungaluchukumisi iqhosha lebhande lokhuseleko. Sithembe." conf=0.35: medium:lexical:Ungaluchukumisi
- FP "Ukuqhuba kancinci akusosiphakamiso." conf=0.75: high:lexical:akusosiphakamiso | medium:semantic:Ukuqhuba
- FP "Kufana nedolophu yeziporho. Kanti nguLwesibini nje" conf=0.25: medium:contamination:Kanti
- FP "Ihlabathi lifumene ifilitha ethambileyo ngale ntsasa." conf=0.35: medium:morphology:Ihlabathi lifumene
- FP "Inkungu ayikhathalelanga ishedyuli yakho." conf=0.3: medium:lexical:ayikhathalelanga
- FP "Abamelwane bakho bakhona. Kuthiwa kunjalo. Andinakuqinisekisa." conf=0.25: medium:lexical:Andinakuqinisekisa
- FP "NeGoogle Maps iyathengathenga namhlanje." conf=0.25: medium:lexical:iyathengathenga
- FP "Inkungu ifikile ingamenyanga. Inkungu yoqobo." conf=0.3: medium:lexical:ingamenyanga
- FP "Inkungu iyiselile intaba." conf=0.5: high:lexical:iyiselile
- FP "Ukuhamba uye kwibhinikhisi ngoku luhambo." conf=0.4: medium:lexical:kwibhinikhisi
- FP "Intsasa ilibele ukurenda." conf=0.55: high:lexical:ukurenda
- FP "Ukuba ungaphakathi, wenza ngokuphosakeleyo." conf=0.3: medium:lexical:ngokuphosakeleyo
- FP "Le yimozulu oya kuyikhumbula kwitrafi kaDisemba." conf=0.3: medium:lexical:kwitrafi
- FP "Kuvakala ngathi ilizwe likwisimo esihle." conf=0.4: medium:semantic:likwisimo
- FP "Iinkwenkwezi ziphumile, ukuCimwa akukwazi oku." conf=0.3: medium:lexical:ukuCimwa
- FP "Kuzolile ngaphandle. Cishe okusolisayo." conf=0.45: medium:contamination:Cishe
- FP "Imozulu egqibeleleyo yokuzenza uza kulala kwangoko." conf=0.3: medium:semantic:kulala
- FP "Izikhova ziyawugweba umsebenzi wakho wesikrini." conf=0.35: medium:lexical:ziyawugweba
- FP "IKapa iyabengezela. Mhlawumbi." conf=0.5: high:lexical:iyabengezela
- FP "Ibhitshi okanye" conf=0.3: medium:semantic:Ibhitshi
- FP "Izihlangu zingakhethwa. Isimilo siyanyanzelelwa." conf=0.55: medium:lexical:siyanyanzelelwa | medium:semantic:Isimilo
- FP "I-boerie roll yesidlo sakusasa? Ngempelaveki? Yamkelekile." conf=0.4: medium:semantic:sakusasa
- FP "Iislipas, iibhulukhwe ezimfutshane, ilanga. Imanyano emithathu." conf=0.25: medium:lexical:Iislipas
- FP "Linamafu kancinci, kuqashelwa kancinci." conf=0.3: medium:lexical:Linamafu
- FP "Amafu akho, ilanga likho. Umlinganiselo ukuqashelo." conf=0.4: medium:lexical:ukuqashelo
- FP "Amafu ajikelezile. Ukuba mangaphi kuyimpikiswano." conf=0.3: medium:lexical:ajikelezile
- FP "Kunamafu kancinci. Ungabhejeli ukosa inyama kuko" conf=0.3: medium:lexical:Ungabhejeli
- FP "Mhlawumbi imvula. Thatha isambrela." conf=0.3: medium:lexical:isambrela
- FP "Imvula imhlawumbi ikho. Isibhakabhaka asikatyikityi nto." conf=0.4: medium:lexical:asikatyikityi
- FP "Iimeko ezimanzi, mhlawumbi. Ungasicaphuli kwi braai." conf=0.3: medium:lexical:Ungasicaphuli
- FP "Kusenokuna. Kusenokoyikisa nje." conf=1: high:lexical:Kusenokuna | high:lexical:Kusenokoyikisa
- FP "Kusenokutshiza kancinci. Kungenakuhlupha." conf=1: high:lexical:Kusenokutshiza | high:lexical:Kungenakuhlupha
- FP "Ukubanda koko sikubhejayo. Ungathembi ifestile enelanga ebusika." conf=0.35: medium:lexical:sikubhejayo
- FP "Imini efudumeleyo iyeza, mhlawumbi." conf=0.3: medium:semantic:Imini
- MISS [spelling] "Kubanda" (git 0510415 (native review) Kubanda → Kuyabanda) conf=0.05
- FP "Umoya waseMzantsi-Mpuma ufike ungamenywanga njengesiqhelo" conf=0.25: medium:lexical:ungamenywanga
- FP "Umoya unamandla — neengabangaba zihamba ngeenyawo" conf=0.25: medium:lexical:neengabangaba
- FP "Uhlobo lwengqeleolukwenza u-Google underfloor heating Bloenfontein" conf=0.65: medium:semantic:lwengqeleolukwenza | medium:lexical:lwengqeleolukwenza
- MISS [spelling] "Isihlalo semoto sakho sisixhobo ngoku." (git 0510415 (native review) sakho → yakho) conf=0.1
- MISS [spelling] "Iimodeli zithi kuhle. Inyaniso inelungelo lokwahluka." (git 0510415 (native review) lokwahluka. → lokwahluka) conf=0.05
- MISS [wrong-sense] "Imvu inetha ngamandla kangangokuba kufanele ihlawule irenti." (adversarial wrong-sense: imvula → imvu (sheep)) conf=0.2
- MISS [wrong-sense] "Ewe, imvu ina ngecala. Yinto eqhelekileyo yaseMzantsi Afrika." (adversarial wrong-sense: imvula → imvu (sheep)) conf=0.15
- MISS [wrong-sense] "Amafutha ayazibonakalisa namhlanje." (adversarial wrong-sense: amafu → amafutha (fat)) conf=0.15
- MISS [wrong-sense] "Amafutha akhangeleka erhaneleka nyhani." (adversarial wrong-sense: amafu → amafutha (fat)) conf=0.1
- MISS [wrong-sense] "Ingqondo ifikile yaye ize nabahlobo bayo." (adversarial wrong-sense: ingqele → ingqondo (mind)) conf=0.15
- MISS [wrong-sense] "50/50 ukufumana amazwi. Njengomdlalo." (adversarial wrong-sense: amanzi → amazwi (words)) conf=0.2
- MISS [wrong-sense] "Isibane siqumba ngokupheleleyo." (adversarial wrong-sense: isibhakabhaka → isibane (lamp)) conf=0.15
- MISS [wrong-sense] "Isibane sivele saba yi-Carte Blanche ngokupheleleyo." (adversarial wrong-sense: isibhakabhaka → isibane (lamp)) conf=0.2
- MISS [boundary] "Imozulu embikakhulu" (adversarial boundary: embi kakhulu fused) conf=0.1
- MISS [boundary] "Imozulu inedrama ifuna uCarte Blanche." (adversarial boundary: ine drama fused) conf=0.1
- MISS [boundary] "Yilinde ngaphakathi le meko. Iintaba azisayindawo" (adversarial boundary: azisayi ndawo fused) conf=0.05

</details>

## st — 520 good, 89 bad (scored classes)

| | precision | recall | TP | FP | FN | TN |
|---|---|---|---|---|---|---|
| baseline (old skill) | 12% | 8% | 7 | 52 | 82 | 468 |
| rebuilt (corpus-backed) | 39% | 85% | 76 | 117 | 13 | 403 |

| class | n | baseline recall | rebuilt recall | rebuilt ≥0.5 |
|---|---|---|---|---|
| wrong-sense | 26 | 8% | 54% | 15% |
| wrong-language | 19 | 0% | 95% | 79% |
| untranslated | 18 | 28% | 100% | 11% |
| spelling | 20 | 0% | 100% | 95% |
| calque | 4 | 0% | 100% | 100% |
| register | 1 | 0% | 100% | 0% |
| wrong-dialect | 1 | 0% | 100% | 100% |
| rewritten | 81 | 10% | 35% | 15% |

Baseline cannot see: wrong-language, spelling, calque, register, wrong-dialect. Weak-good rows (future_review / UI labels) flagged: baseline 19/89, rebuilt 21/89.

Pass rule for st: wrong-sense recall 8% → 54%, wrong-language recall 0% → 95%, precision 12% → 39% ⇒ **PASS**

<details><summary>misses and false positives</summary>

- FP "Modumo wa seaduma" conf=0.55: high:lexical:seaduma
- FP "Ho monate" conf=0.25: medium:semantic:monate
- FP "Modumo wa seaduma o a tla" conf=0.3: medium:lexical:seaduma
- FP "uv. e hodimu  haholo" conf=0.25: medium:lexical:hodimu
- FP "Sena ke tlhahlobo ea lehodimo. Le pasitse." conf=0.3: medium:contamination:pasitse
- FP "Lula ka ntlong. Lithaba li ntse li le teng moo li leng teng." conf=0.25: medium:semantic:leng
- FP "Lehodimo le a duma. Lula haufi le marulelo." conf=0.25: medium:semantic:duma
- FP "Lijinse tse metsi letsatsi lohle. Kotlo ea setso." conf=0.3: medium:lexical:Lijinse
- FP "U lebetse jase ea hao? Bokahohle bo bone." conf=0.4: medium:contamination:bone
- FP "Paka sekhele. Kapa o se ke oa paka. Ha re tsebe le rona." conf=0.45: medium:semantic:tsebe
- FP "Lehodimo ha le tsebe. Kena klubeng." conf=0.35: medium:lexical:klubeng
- FP "Lehodimo le fana le matšoao a tsoakaneng hape." conf=0.25: medium:semantic:fana
- FP "Maru a teng feela. Ha ho litšepiso." conf=0.25: medium:lexical:litšepiso
- FP "Lehodimo ha le fane letho." conf=0.25: medium:semantic:fane
- FP "Letsatsi le monate la ho tsamaea, empa le lebe ho leka ho chesa letlalo." conf=0.55: medium:semantic:monate | medium:semantic:letlalo
- FP "Leholimo le matšoenyehong. Le nna, ka nnete." conf=0.3: medium:lexical:matšoenyehong
- FP "Ha ho mpe, ha ho motle. Joalo ka dethi ea 6/10." conf=0.5: medium:semantic:motle | medium:lexical:dethi
- FP "Lehodimo le a buffera." conf=0.25: medium:lexical:buffera
- FP "Esita le leholimo ha le khathalehe kajeno." conf=0.25: medium:lexical:khathalehe
- FP "Lehodimo le fana le 'ke tla leka hosane' matla." conf=0.25: medium:semantic:fana
- FP "Leholimo le lekaneng. Ha le leholo, ha le lebe." conf=0.3: medium:semantic:leholo
- FP "Leholimo lena le na le 'meh' karolong e 'ngoe le e 'ngoe." conf=0.35: medium:contamination:meh
- FP "Maru a itlamile ho ba karolelano." conf=0.5: high:contamination:itlamile
- FP "Lehodimo le na le 'mala oa sekoahelo sa Tupperware sa khale." conf=0.35: medium:semantic:mala
- FP "SPF 50 kapa o tla itshola ka bosiu." conf=0.25: medium:contamination:itshola
- FP "O tla shebahala joalo ka lobster. O lemoselitsoe." conf=0.25: medium:lexical:lemoselitsoe
- FP "katiba ,liborele,setlolo sa letsatsi ha ho buisanoe" conf=0.25: medium:lexical:liborele
- FP "O ka besa steak holim'a pavement hona joale." conf=0.4: medium:semantic:hona
- FP "Letsatsi ha le khathalele merero ea hao." conf=0.25: medium:lexical:khathalele
- FP "Baraleli ba kite ba na le nako e ntle." conf=0.35: medium:lexical:Baraleli
- FP "Esita le dikoekoe di tsamaea kajeno." conf=0.25: medium:lexical:dikoekoe
- FP "Ha ho setaele sa moriri se bonahalang. Ba pholosehileng feela." conf=0.35: medium:lexical:pholosehileng
- FP "Mophefumulo oa hao o etsa li-special effects." conf=0.3: medium:lexical:Mophefumulo
- FP "Hona ha se seo brosure ea bohahlauli e neng e se tšepisa." conf=0.35: medium:contamination:tšepisa
- FP "ha wa hatsela fela ,o hatsetse haholo phapang e kgolo" conf=0.3: medium:contamination:fela
- FP "Duvet e utloisitse mosebetsi." conf=0.35: medium:lexical:utloisitse
- FP "Ha ho motho ea ingolisitseng bakeng sa mocheso ona." conf=0.35: medium:lexical:ingolisitseng
- FP "Sofa e entsoe nyeoe e matla ea ho dula." conf=0.3: medium:contamination:Sofa
- FP "O hopola bethe ea hao mme o tsoile metsotso e leshome le metso e 'meli." conf=0.45: medium:lexical:tsoile
- FP "Shaoara e ne e le ntho e ntle ka ho fetisisa. Tsohle li theohela tlase joale." conf=0.4: medium:lexical:Shaoara
- FP "Koloi e kgohletse habeli pele e dumela ho starta." conf=0.4: medium:lexical:starta
- FP "Highveld winter: ke moo o aparang dijakete tse pedi ho lata post." conf=0.25: medium:lexical:dijakete
- FP "Welkom-cold kajeno. Serame se phunyeletsang di-jersey tse tharo eka ha di yo." conf=0.3: medium:contamination:Welkom-cold
- FP "Geyser e tripile bosiu. Ehlile e entse jwalo." conf=0.85: high:lexical:jwalo | medium:lexical:tripile
- FP "Serame mohloeng. Serame ho bakkie. Serame ka sekotlolong sa phoofolo ea lapeng." conf=0.4: medium:lexical:mohloeng
- FP "Letsatsi le tjhabile. O se ke wa thetswa. Nature e bua leshano." conf=0.35: medium:semantic:tjhabile
- FP "Dithaele tsa fatše bosiung ba  kajeno ke balotsana ,bona hore o apara ntho maotong" conf=0.35: medium:semantic:kajeno
- FP "Karoo morning. Mofuta o etsang hore o hlomphe molemi e mong le e mong ya kgethileng bophelo bona." conf=0.5: medium:contamination:morning
- FP "Heater ya koloi ke yona relationship ya bohlokwa ka ho fetisisa bophelong ba hao hona jwale." conf=1: high:lexical:jwale | medium:semantic:yona | medium:semantic:hona
- FP "Di-koppies di shebahala jwalo ka postcard. Maoto a hao a ikutlwa eka ke ice blocks." conf=0.7: high:lexical:jwalo
- FP "Cold ya mofuta o etsang hore o Google 'underfloor heating Bloemfontein'." conf=0.45: medium:contamination:Cold
- FP "Hadedas tse tharo, makhoaba a mabeli, le motho a le mong ea thothomelang haufi le sebaka sa linonyana." conf=0.55: medium:lexical:makhoaba | medium:lexical:thothomelang
- FP "Maluti-frost morning. Lesotho e a e exporta mahala." conf=0.75: medium:contamination:Maluti-frost | medium:contamination:morning | medium:lexical:exporta
- FP "Coffee letsatsing stoepong. Ke lona lebaka lohle leo re dulang mona." conf=0.35: medium:lexical:stoepong
- FP "Dula o na le metsi kapa o   fetohe sehwapa" conf=0.35: medium:lexical:sehwapa
- FP "Tara e bonolo. Batho ba bonolo le ho feta." conf=0.3: medium:contamination:Tara
- FP "Ha o futhumetse. O a 'glow'. Ehlile." conf=0.3: medium:contamination:glow
- FP "Lislipase ho tara e ne e le phoso." conf=0.35: medium:contamination:tara
- FP "Leholimo la libhulukoe tse khutšoanyane? Lena ke leholimo la lipanty." conf=0.55: medium:lexical:libhulukoe | medium:lexical:lipanty
- FP "Leqhoa senooeng sa hao le nkile metsotsoana e 30 feela." conf=0.3: medium:lexical:senooeng
- FP "Paee ea garage hobane kitchen ke lava." conf=0.4: medium:lexical:Paee
- FP "Setuuruili sa hao ke setjheso." conf=0.3: medium:lexical:Setuuruili
- FP "Grimase ea hao e na le nako ea ho fela ea 9 hoseng." conf=0.7: medium:lexical:Grimase | medium:contamination:fela
- FP "Butle butle ke fetoha letamo lekhutlong." conf=0.35: medium:lexical:lekhutlong
- FP "Kofi ea hao ea leqhoa e qhibilihile pele o fihla koloing." conf=0.55: medium:lexical:qhibilihile | medium:semantic:fihla
- FP "Ha ke bone letho. Letho." conf=0.3: medium:contamination:bone
- FP "Silent Hill vibes. Ntle le dimanka. Re tšepa." conf=0.35: medium:lexical:dimanka
- FP "Ho boneha: hanyenyane nul." conf=0.7: medium:lexical:boneha | medium:lexical:nul
- FP "Lefatše le fumane filitha e bonolo hoseng." conf=0.3: medium:lexical:filitha
- FP "Moholi ha o khathalele lenaneo la hao." conf=0.3: medium:lexical:khathalele
- FP "Ho boneha ho sponsoritsoe ke motho. Motho." conf=0.65: medium:lexical:boneha | medium:lexical:sponsoritsoe
- FP "Moholi o mokoto haholo o na le maikutlo." conf=0.3: medium:semantic:mokoto
- FP "Tsela ea hao ea ho kena ke novele ea sephiri joale." conf=0.4: medium:semantic:Tsela
- FP "Moholi o fihlile a sa memioa. Moholi oa setso." conf=0.3: medium:lexical:memioa
- FP "Moholi o noele thaba." conf=0.25: medium:lexical:noele
- FP "Ho tsamaea ho ea bining joale ke leeto." conf=0.3: medium:lexical:bining
- FP "Ho boneha: vibes feela." conf=0.3: medium:lexical:boneha
- FP "Leholimo la molingoa oa mantlha mona." conf=0.25: medium:lexical:molingoa
- FP "Boloka letsatsi lena mohopolong." conf=0.35: medium:semantic:Boloka
- FP "Lehodimo le fana le tsohle kajeno." conf=0.25: medium:semantic:fana
- FP "Lena ke leholimo leo o tla le thella sephetphetheng sa Tšitoe." conf=0.4: medium:lexical:sephetphetheng
- FP "Esita le sebaka sa liphakinki se bonahala se setle kajeno." conf=0.55: medium:lexical:liphakinki | medium:semantic:sebaka
- FP "Ha ho hlokahale filitha. Sheba kantle feela." conf=0.5: medium:lexical:filitha | medium:semantic:Sheba
- FP "Lebaka la hao la ho dula ka hare le sa tsoa fela." conf=0.4: medium:contamination:fela
- FP "Ke sona sena. Mona feela." conf=0.25: medium:semantic:sona
- FP "Mofuta oa lehodimo o etsang hore o leboge lintho tsa mahala." conf=0.6: high:contamination:leboge
- FP "Tšolla kofi kantle. Re tšepe." conf=0.25: medium:lexical:Tšolla
- FP "Afrika e iponahatsa hape. Ka khotso ka ho qhibilihisang." conf=0.55: medium:lexical:qhibilihisang | medium:semantic:khotso
- FP "ke bosiu bobotle ho bona Molalatladi" conf=0.25: medium:lexical:bobotle
- FP "Kae-kae tswiritswiri e binela ka matla." conf=0.3: medium:lexical:tswiritswiri
- FP "Merubisi e ahlola nako ea hao ea skrini." conf=0.25: medium:contamination:Merubisi
- FP "Digwagwa di kene puisanong." conf=0.25: medium:contamination:Digwagwa
- FP "Melimo ea leholimo e a iponahatsa." conf=0.3: medium:lexical:Melimo
- FP "Haeba u sebetsa kajeno, re u utloela bohloko." conf=0.35: medium:lexical:utloela
- FP "Mashala ha a na ho itukisa ka bo 'ona." conf=0.35: medium:lexical:itukisa
- FP "Tong e a bitsa. Araba eona." conf=0.25: medium:contamination:Tong
- FP "Lichopo li a bitsa. Setulo le sona." conf=0.35: medium:lexical:Lichopo
- FP "Boerie roll bakeng sa lijo tsa hoseng? Mafelong a beke? E lokile." conf=0.45: medium:semantic:hoseng
- FP "Slip-slops, libhulukoe tse khutšoanyane, letsatsi. Boraro bo bong." conf=0.3: medium:lexical:libhulukoe
- FP "Maru a teng, letsatsi le teng. Tekanyo ke phohmisetso." conf=0.3: medium:lexical:phohmisetso
- FP "Maemo a metsi, mohlomong. U se ke ua re qotsa braaing." conf=0.25: medium:lexical:braaing
- FP "Ho ka tšela hanyane. Ho ka se tshoenyehe." conf=0.5: medium:lexical:tshoenyehe | medium:semantic:tšela
- FP "Ho bonahala ho bata. Thermomethara e re etsa hore re hakanye." conf=0.35: medium:lexical:Thermomethara
- FP "Mohlomong ho na le ntho e phehoang. Lula u le haufi le marulelo." conf=0.35: medium:lexical:phehoang
- MISS [wrong-sense] "Dikausu tse metsi. Boko bo boholo." (review/xh-st-addendum.md rain[16]) conf=0.15
- FP "Probably Weather e kopanya dikakanyo tsa boemo ba leholimo tse tsoang ho Open-Meteo, WeatherAPI.com, MET Norway le Pirate Weather ho u fa ponelopele e tšepahalang." conf=1: medium:contamination:Probably | medium:contamination:Weather | medium:contamination:Weather | medium:contamination:fa
- MISS [wrong-sense] "ho fihla ho" (git a38c32d (native review) gusts) conf=0.05
- FP "Tobetsa konopo ya `Share` ya Safari ka tlase ho skirini sa hao" conf=0.25: medium:lexical:skirini
- MISS [wrong-sense] "Tlanya `×` ka holimo ho koala litaelo tsena" (git a38c32d (native review) tlanya (click) reverted to tobetsa (press) by native) conf=0
- FP "Probably Weather e tla hlaha skrineng sa hao sa lehae — tobetsa letshwao ho bula app." conf=0.5: medium:contamination:Probably | medium:contamination:Weather
- FP "Ha o bone `Add to Home Screen`? Tobetsa `Edit Actions` ka tlase ho menyu ya Share, ebe u e nolofatsa." conf=0.3: medium:contamination:bone
- MISS [wrong-sense] "Chrome ho iPhone e ke ke ea kenya di-app. Tlanya ka tlase ho bula sebaka sena ho Safari, joale latela mehato." (git a38c32d (native review) tlanya (click) reverted to tobetsa (press) by native) conf=0.05
- FP "Tobetsa menyu ea sebatli, ebe Kenya app — kapa leka hape ka motsotsoana." conf=0.25: medium:lexical:sebatli
- MISS [wrong-sense] "moea o otlang ka sefutho" (git ecdfe11 (native review) gusts) conf=0
- FP "ho  a tjhesa" conf=0.55: high:lexical:tjhesa
- FP "mohodi oa eketseha  tlosa mabone  a koloi" conf=0.6: high:lexical:mohodi
- FP "The correct Sesotho spelling is moholi (fog/mist), not mohodi." conf=1: high:lexical:mohodi | medium:contamination:spelling | medium:contamination:fog | medium:contamination:mist
- FP "Ho chesa\" is the standard spelling for \"It's hot\" (rather than Ho tjhesa)." conf=1: high:lexical:tjhesa | medium:contamination:spelling | medium:contamination:hot
- FP "Free State e sa tsoa hopola hore e na le mokgwa wa mariha  can still use  winter setting  at the end of the sentence to make it sound less stiff" conf=0.4: medium:contamination:stiff
- FP "jackets → dijakete" conf=0.55: high:lexical:dijakete
- FP "Letsatsi le monate la ho tsamaea, empa le lebe ho leka ho chesa letlalo.”" conf=0.55: medium:semantic:monate | medium:semantic:letlalo
- FP "Haeba u sebetsa kajeno, re u utloela bohloko.”" conf=0.35: medium:lexical:utloela
- MISS [wrong-sense] "Lieta tsa hao li tla ba le lesedi le lebe." (adversarial wrong-sense: letsatsi → lesedi (light)) conf=0.05
- MISS [wrong-sense] "Sekhele se robehile ka mosi oa pele. Setso." (adversarial wrong-sense: moea → mosi (smoke)) conf=0.2
- MISS [wrong-sense] "Bohobe bo hlakileng" (adversarial wrong-sense: bosiu → bohobe (bread)) conf=0.1
- MISS [wrong-sense] "Bohobe bo hlakileng." (adversarial wrong-sense: bosiu → bohobe (bread)) conf=0.1
- MISS [wrong-sense] "Ho na le mohlolo." (adversarial wrong-sense: moholi → mohlolo (miracle)) conf=0
- MISS [wrong-sense] "Boemo ba lefatshe bo matla" (adversarial wrong-sense: leholimo → lefatshe (earth)) conf=0.05
- MISS [wrong-sense] "Hoa bata, lefatshe le hlakile" (adversarial wrong-sense: leholimo → lefatshe (earth)) conf=0
- MISS [wrong-language] "Pula e boima thata e lokela ho lefa rente." (adversarial wrong-language: haholo → thata) conf=0.05

</details>

## af — 990 good, 75 bad (scored classes)

| | precision | recall | TP | FP | FN | TN |
|---|---|---|---|---|---|---|
| baseline (old skill) | 37% | 21% | 16 | 27 | 59 | 963 |
| rebuilt (corpus-backed) | 64% | 77% | 58 | 32 | 17 | 958 |

| class | n | baseline recall | rebuilt recall | rebuilt ≥0.5 |
|---|---|---|---|---|
| wrong-sense | 18 | 6% | 50% | 0% |
| wrong-language | 18 | 11% | 100% | 39% |
| untranslated | 17 | 12% | 94% | 6% |
| diacritic | 18 | 61% | 67% | 50% |
| spelling | 3 | 0% | 100% | 100% |
| calque | 1 | 0% | 0% | 0% |
| rewritten | 10 | 0% | 0% | 0% |

Baseline cannot see: spelling, calque. Weak-good rows (future_review / UI labels) flagged: baseline 10/90, rebuilt 7/90.

Pass rule for af: wrong-sense recall 6% → 50%, wrong-language recall 11% → 100%, precision 37% → 64% ⇒ **PASS**

<details><summary>misses and false positives</summary>

- FP "Die lug het voluit bedonerd gegaan." conf=0.35: medium:lexical:bedonerd
- FP "Klein ysbomme val. Binne is die enigste plan." conf=0.3: medium:lexical:ysbomme
- FP "Die hond staar na die reen asof dit n persoonlike belediging is." conf=0.8: high:morphology:reen | medium:morphology:reen
- FP "Die verkeer het pas onthou daar is n ding soos reen bestaan weer." conf=0.8: high:morphology:reen | medium:morphology:reen
- FP "Twee druppels op die voorruit en die hele N1 se geheue is skoon gewas." conf=0.35: medium:semantic:geheue
- FP "Reen? Moontlik. Sal ek my lewe daar op wed? Nooit." conf=0.8: high:morphology:Reen | medium:morphology:Reen
- FP "Schrödinger se reën. Dit is én is nie." conf=0.25: medium:lexical:Schrödinger
- FP "Nie Troufoto weer nie. Nie die einde van die wereld nie." conf=0.8: high:morphology:wereld | medium:morphology:wereld
- FP "Hierdie weer het n 'meh' houding." conf=0.3: medium:contamination:meh
- FP "Ten minste reen dit nie. Dis die standaard." conf=0.8: high:morphology:reen | medium:morphology:reen
- FP "Die wolke het 'miskien' geRSVP en in elk geval opgedaag." conf=0.25: medium:lexical:geRSVP
- FP "Daai wolke beteken swaai-boulwerk. Vra enige oom by die hek." conf=0.25: medium:semantic:oom
- FP "Die maan het 'n 'moenie steur nie'-bordjie opgehang." conf=0.3: medium:morphology:moenie
- FP "Selfs die meeuë loop vandag." conf=0.25: medium:lexical:meeuë
- FP "Gratis mikrodermabrasie op die promenade vandag." conf=0.25: medium:lexical:mikrodermabrasie
- FP "Maak toe, maak vas, gee oor." conf=0.35: medium:semantic:vas
- FP "Eerste een op moet die ketel aansit. Dis die wet." conf=0.35: medium:contamination:wet
- FP "Die roomyswa speel almal se volkslied." conf=0.25: medium:lexical:roomyswa
- FP "Skooldrag met 'n langbroek was vandag 'n gok. Sterkte, my kind." conf=0.5: high:contamination:gok
- FP "Jy hoor die hadidas, maar jy sien niks. Onheilspellend? Nee. Net Dinsdag." conf=0.25: medium:lexical:hadidas
- FP "Ysswemmers check nie die weer nie. Die weer check hulle." conf=0.25: medium:lexical:Ysswemmers
- FP "Van hier bo lyk almal se probleme onskerp. Werk vir my." conf=0.3: medium:lexical:onskerp
- FP "Karoo-nagmis: so skaars dat die dominee dit môre gaan noem." conf=0.3: medium:semantic:môre
- FP "Hierdie is die weer wat ons wil he. Net soos dit is." conf=0.75: high:morphology:he | medium:morphology:he
- FP "Padkos smaak beter onder 'n lug sonder einde." conf=0.4: medium:semantic:onder
- FP "Steek die Weber aan. Dit is die wet." conf=0.25: medium:contamination:wet
- FP "Lyk helder-ish. Die modelle en die lug stem nie altyd saam nie." conf=0.45: medium:lexical:helder-ish
- FP "Bewolk-ish. Moenie die braai daarop wed nie." conf=0.25: medium:lexical:Bewolk-ish
- FP "Wind is op die kaarte. Peg die wasgoed vas." conf=0.25: medium:semantic:vas
- FP "Lyk koud-ish. Die termometer hou ons aan die raai." conf=0.25: medium:lexical:koud-ish
- FP "Warm-ish, waarskynlik. Hou die water naby." conf=0.25: medium:lexical:Warm-ish
- FP "Helder-ish nag. Moenie ons by die sterre hou nie." conf=0.25: medium:lexical:Helder-ish
- MISS [calque] "Verwyder onlangs" (LANGUAGE_AUDIT_PHASE3_REPORT.md HIGH-AF-1) conf=0.05
- MISS [untranslated] "Sky's playing kat-en-muis." (lang-packs/af/errors-observed.md) conf=0.05
- MISS [wrong-sense] "Dis nie wolwe nie, dis 'n lokprent." (adversarial wrong-sense: wolke → wolwe (wolves)) conf=0.05
- MISS [wrong-sense] "Die wolwe het 'n oomblik." (adversarial wrong-sense: wolke → wolwe (wolves)) conf=0.05
- MISS [wrong-sense] "Die sambreel het gebreek met die eerste wond. Klassiek." (adversarial wrong-sense: wind → wond (wound)) conf=0
- MISS [wrong-sense] "Twintig minute se opera, dan maak die seun of niks gebeur het nie." (adversarial wrong-sense: son → seun (boy/son)) conf=0.1
- MISS [wrong-sense] "Die seun speel siek vandag." (adversarial wrong-sense: son → seun (boy/son)) conf=0.15
- MISS [wrong-sense] "Die lig het n volle vloermoer." (adversarial wrong-sense: lug → lig (light)) conf=0.05
- MISS [wrong-sense] "Die nek het 'n weighted blanket oor alles kom gooi." (adversarial wrong-sense: nag → nek (neck)) conf=0.05
- MISS [wrong-sense] "Kyk mooi. Oor tien minute is dit nek én Noordpool." (adversarial wrong-sense: nag → nek (neck)) conf=0.15
- MISS [wrong-sense] "Dis bloedig wurm." (adversarial wrong-sense: warm → wurm (worm)) conf=0.1
- MISS [diacritic] "Die tuin se uiteindelik dankie." (adversarial diacritic: sê → se) conf=0
- MISS [diacritic] "Selfs die skape se kuiwe le vandag agteroor." (adversarial diacritic: lê → le) conf=0
- MISS [diacritic] "Die Hoeveld hou nie van subtiel nie en ons is dankbaar." (adversarial diacritic: Hoëveld → Hoeveld) conf=0.1
- MISS [diacritic] "Hoeveld-winter: die enigste plek waar jy twee jasse aantrek om die pos te gaan haal." (adversarial diacritic: Hoëveld → Hoeveld) conf=0.1
- MISS [diacritic] "Die Hooglandlug na reën behoort in 'n botteltjie verkoop te word." (adversarial diacritic: ná → na) conf=0.2
- MISS [diacritic] "Kaapstad na 'n front: skoon, helder, en yskoud eerlik." (adversarial diacritic: ná → na) conf=0

</details>

## Verdict: PASS — zu:pass xh:pass st:pass af:pass (10.2 s for 3625 items)

Excluded adversarial wrong-sense substitutes (not attested, so they would be caught as unknown words rather than wrong sense): zu:inkuku, st:pudi, st:mabu