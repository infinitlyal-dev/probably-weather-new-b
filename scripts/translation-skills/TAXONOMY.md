# Error taxonomy — 2026-09-23

Classified against `RUBRIC.md` by fresh agents (one per batch), evidence computed by `taxonomy-input.mjs`. Primary type only; secondary types are in the batch outputs.

## The 306 flags of the 2026-09-19 back-translation check

| Type | af | zu | xh | st | all |
|---|---:|---:|---:|---:|---:|
| meaning reversed | 1 | 1 | 2 | 7 | 11 |
| detail dropped or changed | 27 | 41 | 31 | 32 | 131 |
| keyed to the wrong English line | 2 | 3 | 2 | 2 | 9 |
| translated from an out-of-date list | 0 | 1 | 0 | 1 | 2 |
| wrong spelling standard | 1 | 0 | 0 | 0 | 1 |
| too literal / stiff | 9 | 2 | 5 | 5 | 21 |
| joke lost | 43 | 17 | 25 | 21 | 106 |
| other | 2 | 7 | 13 | 3 | 25 |
| **total** | 85 | 72 | 78 | 71 | 306 |

## Human corrections (what the native reviewer, or Al for Afrikaans, fixed)

| Type | af | zu | xh | st | all |
|---|---:|---:|---:|---:|---:|
| meaning reversed | 0 | 0 | 2 | 0 | 2 |
| detail dropped or changed | 16 | 13 | 107 | 46 | 182 |
| keyed to the wrong English line | 0 | 0 | 3 | 2 | 5 |
| translated from an out-of-date list | 0 | 0 | 0 | 0 | 0 |
| wrong spelling standard | 1 | 0 | 2 | 2 | 5 |
| too literal / stiff | 16 | 5 | 71 | 7 | 99 |
| joke lost | 4 | 1 | 14 | 0 | 19 |
| other | 41 | 10 | 56 | 34 | 141 |
| **total** | 78 | 29 | 255 | 91 | 453 |

## Safety lines among them: 50

- `af-1226` (af, flag) detail dropped or changed — "Unplug the things. The sky has plans." — "Unplug" became "switch off" - weaker action, drops the lightning-surge safety point
- `af-fb-2159` (af, correction) detail dropped or changed — "Unplug the things. The sky has plans." — 'die goed' (vague 'stuff') is generic; after specifies 'toestelle' (devices) for storm-safety clarity.
- `af-fb-2408` (af, correction) other — "Probably a scorcher. A hat's not a bad idea." — preference: 'blaker' was valid AF slang for scorcher; Al preferred keeping English 'scorcher'.
- `zu-0064` (zu, flag) detail dropped or changed — "Hail's down — cover the bakkie." — 'cover' (mboza) becomes 'vala' (close/shut); the hail instruction changes.
- `zu-0264` (zu, flag) detail dropped or changed — "Sunscreen, but keep a hoodie close." — 'hoodie' mistranslated as 'isijele' (jail) instead of 'ijezi' (jersey), a known confusion.
- `zu-0271` (zu, flag) other — "SPF 50 or regret it by tonight." — Meaning intact; 'ngokuhlwa' (tonight) is the isiXhosa form — isiZulu uses 'kusihlwa'.
- `zu-0274` (zu, flag) other — "Protect that face! It's the only one you've got." — Meaning intact; 'Kunye' looks isiXhosa and 'onabu' is a wrong concord (expected 'onabo').
- `zu-0327` (zu, flag) detail dropped or changed — "Close it, tie it down, surrender." — 'surrender' becomes 'unikele' (give/offer it); surrender needs the reflexive 'uzinikele'.
- `zu-fb-0022` (zu, correction) detail dropped or changed — "High UV" — "I-UV ephezulu" omits "level"; "Izinga le-UV" correctly names the UV index/level.
- `zu-fb-0027` (zu, correction) detail dropped or changed — "Thunder rolling in." — "Ukuduma" alone is ambiguous (roar/fame); "kwezulu" (of the sky) specifies weather thunder.
- `xh-0025` (xh, flag) detail dropped or changed — "Don't even think about driving somewhere." — imperative 'don't even think' reads as a past-tense statement, not a warning
- `xh-0150` (xh, flag) detail dropped or changed — "Bring a jacket. Or sunscreen. Or both." — 'jacket' rendered as 'isilamba', not a recognisable Xhosa word for jacket (cf. ibhatyi)
- `xh-0266` (xh, flag) detail dropped or changed — "Reapply that sunscreen or suffer." — 'Reapply' becomes 'Use' — drops the reapplication advice
- `xh-0638` (xh, flag) detail dropped or changed — "Your headlights are doing a 'thoughts and prayers'." — 'headlights' rendered as an unrecognised word, not the standard 'izibane zemoto'
- `xh-0842` (xh, flag) detail dropped or changed — "Mist building, maybe. Headlights wouldn't hurt." — drops hedge 'maybe' (states fog as fact); 'wouldn't hurt' becomes 'aren't dangerous'
- `xh-fb-0083` (xh, correction) too literal / stiff — "Wait it out indoors. The mountains aren't going anywhere." — 'Yima phakathi' is terse/ambiguous (stop in the middle); clarified to wait out indoors.
- `xh-fb-0084` (xh, correction) too literal / stiff — "Tiny ice bombs falling. Indoors is the only plan." — Before is a verbless fragment; after adds natural verb 'Hlala' (stay).
- `xh-fb-0112` (xh, correction) other — "Bring a jacket. Or sunscreen. Or both." — 'Isithinteli selanga' (invented compound) replaced with clearer loanword 'iSunscreen'; 'jacket' also reworded.
- `xh-fb-0148` (xh, correction) too literal / stiff — "Sunscreen is not optional, boet." — passive 'ayinakukhethwa' (cannot be chosen) reworded to idiomatic 'ayisosikhetho' (is not a choice)
- `xh-fb-0150` (xh, correction) detail dropped or changed — "You will look like a lobster. You've been warned." — 'will look like' (uya kubonakala) narrowed to 'will be red' (kubomvu), changing the comparison
- `xh-fb-0151` (xh, correction) other — "Protect that face! It's the only one you've got." — noun-class concord fixed throughout (elo→obo, lelinye→bubo) to correctly match ubuso
- `xh-fb-0153` (xh, correction) detail dropped or changed — "Reapply that sunscreen or suffer." — before omits the object entirely ('use again'); after restores 'lo sunscreen'
- `xh-fb-0154` (xh, correction) too literal / stiff — "Hat, sunnies, sunscreen. Non-negotiable." — formal Xhosa translations (umnqwazi, izipeki, ikhrimu) swapped for natural colloquial loanwords
- `xh-fb-0156` (xh, correction) other — "Your future self will thank you for that sunscreen." — 'ingomso lakho lakho' has a duplicated 'lakho' — apparent typo, meaning unchanged
- `xh-fb-0157` (xh, correction) too literal / stiff — "Walking to the car counts as a sun hazard today." — 'is regarded as a hazard' restructured to more natural 'puts you at risk'
- `xh-fb-0159` (xh, correction) too literal / stiff — "The back of your neck. You forgot that bit." — English-like word order replaced with natural Xhosa object-fronted structure
- `xh-fb-0160` (xh, correction) other — "Sunscreen budget: higher than your data bill." — plural 'iibhajethi' corrected to singular 'ibhajethi' to match the one budget
- `xh-fb-0233` (xh, correction) too literal / stiff — "Your high beams are making it worse, boet." — vague statement made into direct actionable command about headlights
- `xh-fb-0272` (xh, correction) detail dropped or changed — "Mist building, maybe. Headlights wouldn't hurt." — command 'turn on lights' overstated vs soft 'wouldn't hurt'; but drops 'maybe' hedge on mist
- `xh-fb-0277` (xh, correction) too literal / stiff — "Wind's likely. Hold onto the braai cover." — 'maybe exists' awkward phrasing fixed to natural 'is possible'; grila->osa inyama
- `xh-fb-0279` (xh, correction) too literal / stiff — "Wind's on the cards. Peg the washing down." — 'on the cards' calque fixed; adds 'with pegs' detail matching 'peg the washing'
- `xh-fb-0282` (xh, correction) detail dropped or changed — "Hot-ish, likely. Keep the water close." — '-ish' hedge on 'hot' dropped in before, fixed by adding 'kancinci'(a little)
- `xh-fb-0283` (xh, correction) detail dropped or changed — "Probably a scorcher. A hat's not a bad idea." — 'scorcher' undertranslated as plain 'hot day', fixed to 'very hot'; concord also fixed
- `xh-fb-0299` (xh, correction) detail dropped or changed — "Hold onto your hat, the Southeaster means business" — 'means business' idiom mistranslated as 'is working', fixed to 'is determined/serious'
- `st-0870` (st, flag) meaning reversed — "Mist building, maybe. Headlights wouldn't hurt." — Tells drivers to switch headlights off in fog; the 'maybe' hedge is also dropped.
- `st-0890` (st, flag) detail dropped or changed — "Wind's on the cards. Peg the washing down." — 'Hokahanya' (coordinate) replaces 'peg down' (secure) — the wind-securing advice turns vague.
- `st-0936` (st, flag) detail dropped or changed — "Gusty winds" — 'Meya e matla' = 'strong winds', not 'gusty' — house term for gusts differs.
- `st-fb-0015` (st, correction) detail dropped or changed — "gusts" — 'ho fihla ho' (~to arrive at) doesn't mean 'gusts'; corrected to 'moea o otlang ka sefutho'.
- `st-fb-0340` (st, correction) detail dropped or changed — "gusts" — Wrong verb 'otla' (hit) for wind; should be 'foka' (blow); also singular not plural.
- `st-fb-0365` (st, correction) detail dropped or changed — "Don't even think about driving somewhere." — 'otlela' isn't the standard word for 'drive'; needs 'kganna'.
- `st-fb-0378` (st, correction) detail dropped or changed — "Sunscreen, but keep a hoodie close." — Before ('clouds, no problem') omits the sunscreen/hoodie advice entirely.
- `st-fb-0379` (st, correction) detail dropped or changed — "Sunscreen is not optional, boet." — 'Setofo' is the wrong word for sunscreen; correct term is 'setlolo'.
- `st-fb-0381` (st, correction) detail dropped or changed — "Reapply that sunscreen or suffer." — Before never names 'sunscreen'; vague verb, unclear 'suffer' consequence.
- `st-fb-0382` (st, correction) detail dropped or changed — "Hat, sunnies, sunscreen. Non-negotiable." — 'Setofo' is wrong/incomplete word for sunscreen; needs 'setlolo sa letsatsi'.
- `st-fb-0384` (st, correction) detail dropped or changed — "Your future self will thank you for that sunscreen." — 'Setofo' is wrong/incomplete word for sunscreen; needs 'setlolo' (recurring error).
- `st-fb-0385` (st, correction) detail dropped or changed — "Sunscreen budget: higher than your data bill." — 'Setofo' is wrong/incomplete word for sunscreen; needs 'Setlolo' (recurring error).
- `st-fb-0391` (st, correction) other — "Stay hydrated or become a biltong." — 'biltong' left in English; native term 'sehwapa' used instead.
- `st-fb-0402` (st, correction) other — "Mist building, maybe. Headlights wouldn't hurt." — Before was correct (lights ON); the 'fix' reverses it to 'remove' lights — flag, don't ship.
- `st-fb-0404` (st, correction) too literal / stiff — "Hot-ish, likely. Keep the water close." — Postposed 'mohlomong' is less natural than modal 'ka' for 'likely'.
- `st-fb-0410` (st, correction) too literal / stiff — "Hold onto your hat, the Southeaster means business" — 'Speaks truthfully' is a stiff calque; 'doesn't play around' matches 'means business'.
