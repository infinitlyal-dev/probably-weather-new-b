# Maat rulings on the October drafts (isiXhosa + isiZulu)

Reviewed 2026-10-10 against review/lines-backtranslation-2026-10.md (branch vonk/oct-10). Scope: meaning, grammar, tone. Not nativeness — no native speaker has seen these.

Apply exactly as written. Every replaced line goes through the normal gate (deterministic checks + blind back-translation) before it lands; if a replacement fails the gate, hold it and say so. Keep the provisional tag on everything.

## isiXhosa — 15 fixes, 7 releases, 2 stay held

### Fixes (replace the draft with the line given)

| key | replace with | why |
|---|---|---|
| hero:52fa9e2e3b6b | Akukho sithunzi nesinye ebaleni imini yonke. Usompempe akazange afinyeze amehlo. | "azimeze" isn't a word; squint = finyeza amehlo |
| hero:8d960369fd27 | Umpompo womoya wenza umsebenzi wakusasa. Ingca iyawangawangisa nje. | "iyawuphungela isandla" is not a wave; wangawangisa = wave |
| hero:052cd437e1af | Impahla iza koma phambi kwekhefu lokuqala. Umoya omncinci uqale umsebenzi kwangethuba. | "komelela" = get strong; dry = koma |
| hero:1d8c84ac2fde | Iinwele zakhe zifike kuqala evenkileni yesonka. Umoya omncinci unamacebo awo angeCawa. | plural of icebo is amacebo, not iicebo |
| hero:b8e6f92e8e84 | Isanti iwela indlela ukhozo ngokhozo. Akukho mntu ungxamileyo apha. | "ingqanga" is not a grain; ukhozo = grain |
| hero:3bc0c957a3eb | Isiqingatha seenkwenkwezi singemva kwamafu. Izibane ezincinci zizithathela indawo. | "zibathathela" uses the people concord; stars take zi- |
| witty.rain[49] | Imvula efama ayiyiyo imozulu nje. Ngumvuzo owa uvela esibhakabhakeni. | "owela esibhakabhakeni" = falls in the sky; needs "from" |
| witty.wind[41] | Ilaphu letafile li-ayiniwe kwaye lilungele umsebenzi wangomso. | "lu-ayinile" is the wrong class concord for ilaphu |
| witty.cold[65] | Kufutshane ngokwaneleyo ukuba ulincome, kude ngokwaneleyo ukuba ungalimbi. Kugqibelele. | "ungawuqhwanyazeli" = don't blink at it; shovel = mba |
| witty.cold[73] | Ingqele emanzi yaselwandle: lolo hlobo lugqobhoza iimpahla ezine nomoya omhle. | layers = clothes (iimpahla), not blankets (iingubo) |
| witty.cold-clear[48] | Yimozulu efanelekileyo yokomisa impahla. Impahla iza koma ize ibe ngumkhenkce, ngolo landelelwano. | typo "kuoma" |
| witty.heat[48] | Ababaleki bango-5:30 abomelelanga kunathi. Bakrelekrele nje ngakumbi. | draft lost the negative ("aren't fitter") |
| witty.fog[44] | Iinkomo ziyazi kanye apho zikhoyo. Thina asinakutsho njalo. | second sentence was muddled; now "we can't say the same" |
| witty.fog[95] | Abamelwane abakufutshane bakude ngeekhilomitha ezingamashumi amathathu, kwaye ngokuhlwanje bakubona kancinci nangakumbi. | "even less", not "not at all" (the BT drift Vonk flagged) |
| hero:2071c8a37d11 | Isaqhwithi esincinci sothuli sihamba phambi kwakhe. Asikhabi nokukhaba iipedali. | was held; "doesn't push the bicycle" ≠ pedalling. Apply only if it passes the gate, else keep held |

### Release (held by the checker, line is fine — apply as provisional)
hero:2ee611032a66 · hero:72637f2e8156 · hero:3908d5812ded · witty.rain[52] · witty.cloudy[72] · witty.cold[89] · witty.heat[45] · witty.fog[99]

### Stay held
witty.fog[68] (failed the safety check — stays English).

### No change
Every other applied isiXhosa line stands. Note for the record, not for action: "kusasa" in witty.cloudy[38] is correct isiXhosa (morning), even though it reads as "tomorrow" to an isiZulu eye.

## isiZulu — 4 fixes, nothing else changes

| key | replace with | why |
|---|---|---|
| hero:52fa9e2e3b6b | Asikho nesisodwa isithunzi enkundleni usuku lonke. Unompempe akazange afinyeze amehlo. | squint = finyeza amehlo, not "close his eyes" |
| hero:967a77a46dcc | Okunsomi phansi, okumhlophe esibhakabhakeni. Imibala kaLwesihlanu yamukelwe. | isiZulu has a word for purple (nsomi); "I-purple" is lazy |
| hero:3bc0c957a3eb | Uhhafu wezinkanyezi ungemuva kwamafu. Izibani ezincane zizibambele. | "covering for them" = standing in (bambela); "doing their work" lost the joke |
| witty.cold[101] | Lokho kukhanya okukodwa okuncane ngumuntu owenza ubusika kahle: iqhugwane, umlilo, kuphelile. | hut = iqhugwane, not "grass house" |

Every other applied isiZulu line stands, including the two Breezy slots already filled.

## The four mislabelled isiZulu lines that are live

1. "Phatha ihembe nesijele" — isijele = jail. Replace with "Phatha ihembe nejezi." (ijezi = jersey). Gate it, then it can go in the same commit.
2. The three partly-cloudy lines keyed to the wrong English ("Cloud cover, low effort", "Halfway to a Highveld thunderstorm", "Cloudy enough to comment"): re-draft each from its correct English through the same gate and add them to review/lines-backtranslation-2026-10.md under a "re-keyed" heading for Maat. Don't ship those three until Maat has ruled on them.

## After applying
Re-run the suite and build, rebuild the back-translation report, commit on vonk/oct-10, push the branch. The language commits still don't go to main until Al says push.
