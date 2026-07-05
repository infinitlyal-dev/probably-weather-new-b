# Layer 2 — Image Verdicts (vision pass)

**Production:** `58d6df3` · **Scope:** all 608 unique background images (deduplicated by sha256), each looked at once against real pixels via labelled contact sheets, verdict mapped to every rotation slot it serves.  
**Rotation:** 1,008 slots served by 608 unique images (dawn/dusk/night files are physically duplicated across week-pairs; fog dawn/dusk/night repeat across all four weeks).  
**Rubric anchor:** the **heat** category is the proven benchmark that passed the meme bar. Judged against it, not against generic weather-app standards.  
**Buckets:** KEEP-FUNNY (passes the meme bar — Al would send it to a friend) · KEEP-BEAUTIFUL (not funny but genuinely striking; pleasant stock does **not** qualify) · KILL-GENERIC (interchangeable stock feel — the enemy; lean-kill when torn) · BORDERLINE (used sparingly).  
**Taste terminal is Al.** Every KILL and the BORDERLINE queue for his ruling — nothing in this report is acted on until he rules. Read-only pass: no image was deleted, renamed, or replaced.

> **Not a kill criterion:** location-mismatch (coastal imagery for inland users) is known and accepted as atmospheric. Kills are about generic/stock feel, not geography.

## Summary

**608 unique images →** KEEP-FUNNY **102** · KEEP-BEAUTIFUL **124** · BORDERLINE **1** · KILL-GENERIC **381**  ·  keep-rate **37%**

| Condition | Funny | Beautiful | Borderline | Kill | Unique | Keep% |
|---|--:|--:|--:|--:|--:|--:|
| clear | 4 | 23 | 0 | 43 | 70 | 39% |
| cloudy | 5 | 15 | 1 | 49 | 70 | 29% |
| cold | 9 | 13 | 0 | 48 | 70 | 31% |
| cold-clear | 2 | 24 | 0 | 44 | 70 | 37% |
| fog | 1 | 6 | 0 | 42 | 49 | 14% |
| heat | 26 | 11 | 0 | 33 | 70 | 53% |
| rain | 7 | 11 | 0 | 52 | 70 | 26% |
| storm | 17 | 18 | 0 | 34 | 69 | 51% |
| wind | 31 | 3 | 0 | 36 | 70 | 49% |
| **total** | **102** | **124** | **1** | **381** | **608** | **37%** |

## Per-condition damage report (regeneration workload)

For each condition × time-slot: unique images now, unique **keepers** that survive, and **kills** = how many fresh unique images to regenerate to restore the pool to its current variety. (dawn/dusk/night uniques each serve 2 rotation slots — 4 for fog — so a killed dawn image leaves 2 empty slots; day uniques serve 1.)

| Condition | slot | unique | keepers | kills → regen | keepers (F/B) |
|---|---|--:|--:|--:|---|
| clear | day | 28 | 15 | 13 | 4/11 |
| clear | dawn | 14 | 3 | 11 | 0/3 |
| clear | dusk | 14 | 3 | 11 | 0/3 |
| clear | night | 14 | 6 | 8 | 0/6 |
| **clear total** |  | **70** | **27** | **43** |  |
| cloudy | day | 28 | 11 | 17 | 5/6 |
| cloudy | dawn | 14 | 5 | 8 (+1 BL) | 0/5 |
| cloudy | dusk | 14 | 2 | 12 | 0/2 |
| cloudy | night | 14 | 2 | 12 | 0/2 |
| **cloudy total** |  | **70** | **20** | **49 (+1 BL)** |  |
| cold | day | 28 | 12 | 16 | 6/6 |
| cold | dawn | 14 | 3 | 11 | 1/2 |
| cold | dusk | 14 | 3 | 11 | 1/2 |
| cold | night | 14 | 4 | 10 | 1/3 |
| **cold total** |  | **70** | **22** | **48** |  |
| cold-clear | day | 28 | 15 | 13 | 2/13 |
| cold-clear | dawn | 14 | 4 | 10 | 0/4 |
| cold-clear | dusk | 14 | 5 | 9 | 0/5 |
| cold-clear | night | 14 | 2 | 12 | 0/2 |
| **cold-clear total** |  | **70** | **26** | **44** |  |
| fog | day | 28 | 6 | 22 | 1/5 |
| fog | dawn | 7 | 0 | 7 | 0/0 |
| fog | dusk | 7 | 0 | 7 | 0/0 |
| fog | night | 7 | 1 | 6 | 0/1 |
| **fog total** |  | **49** | **7** | **42** |  |
| heat | day | 28 | 21 | 7 | 17/4 |
| heat | dawn | 14 | 3 | 11 | 2/1 |
| heat | dusk | 14 | 5 | 9 | 2/3 |
| heat | night | 14 | 8 | 6 | 5/3 |
| **heat total** |  | **70** | **37** | **33** |  |
| rain | day | 28 | 10 | 18 | 5/5 |
| rain | dawn | 14 | 2 | 12 | 0/2 |
| rain | dusk | 14 | 4 | 10 | 1/3 |
| rain | night | 14 | 2 | 12 | 1/1 |
| **rain total** |  | **70** | **18** | **52** |  |
| storm | day | 27 | 22 | 5 | 11/11 |
| storm | dawn | 14 | 1 | 13 | 0/1 |
| storm | dusk | 14 | 6 | 8 | 3/3 |
| storm | night | 14 | 6 | 8 | 3/3 |
| **storm total** |  | **69** | **35** | **34** |  |
| wind | day | 28 | 19 | 9 | 18/1 |
| wind | dawn | 14 | 3 | 11 | 1/2 |
| wind | dusk | 14 | 8 | 6 | 8/0 |
| wind | night | 14 | 4 | 10 | 4/0 |
| **wind total** |  | **70** | **34** | **36** |  |
| **ALL** |  | **608** | **226** | **381** |  |

**Bottom line:** 226 unique keepers survive; **381 kills** (+1 BORDERLINE) are the regeneration queue if Al wants to restore full rotation variety. Kills concentrate in the dawn/dusk/night slots (peopleless moody exteriors, motif repeats) and thin out the day slots least (the day images carry most of the gags).

> **Slot-count caveat:** #499 is the one image byte-identical across *different* slot-types (storm `dawn/3` in weeks 1+3 **and** `day/2` in week 3 — same pixels, 3 slots). It's counted once under its `dawn` slot above; it's a KILL either way, so the keeper/regen math is unaffected. Every other unique stays within a single slot-type.

## Standing casting / architecture rule flags

Surfaced even on keepers, per the brief. These are the hard brand rules (diverse casting · no red face-brick default · positive-vibes/no-litter/no-text · weekend-only braai).

**`text`** — Readable text in image (hard casting rule: no readable text) · **10** image(s):
- `#22` clear/week_4/day/1 · *KEEP-BEAUTIFUL* — fixing a bike outside a jacaranda village cafe — charming SA
- `#99` cloudy/week_{1,3}/dawn/1 · *KEEP-BEAUTIFUL* — leaving the poskantoor with a parcel on a wet dorp street — authentic SA
- `#159` cold/week_3/day/5 · *KEEP-FUNNY* — two friends under a yellow umbrella and road-closed-due-to-rain sign — SA winter humor, diverse
- `#204` cold/week_{2,4}/night/1 · *KEEP-FUNNY* — late-night PJ snack run in the cold, kettle-corn sign — quirky, diverse
- `#290` fog/week_2/day/3 · *KEEP-FUNNY* — fogged-out uitkykpunt viewpoint — the view with no view
- `#332` heat/week_1/day/3 · *KEEP-BEAUTIFUL* — lively Durban-style promenade, ice-cream cart, diverse crowd
- `#338` heat/week_2/day/2 · *KEEP-FUNNY* — office HEATWAVE SURVIVAL ZONE, two women toughing it out
- `#341` heat/week_2/day/5 · *KEEP-FUNNY* — dashboard reads 38C on the open Karoo road
- `#350` heat/week_3/day/7 · *KEEP-BEAUTIFUL* — two workers on a water break against the bakkie — authentic SA heat
- `#458` rain/week_{1,3}/night/3 · *KEEP-BEAUTIFUL* — neon-lit rainy CT street, Table Mountain — moody, characterful

**`redbrick`** — Red face-brick default (wrong class signal — aspirational middle-class, NOT working-class) · **9** image(s):
- `#11` clear/week_2/day/4 · *KEEP-FUNNY* — dad reclining with a beer while the kid mows — supervising gag
- `#212` cold-clear/week_1/day/2 · *KEEP-BEAUTIFUL* — frost-covered lemons on the tree — striking cold-clear detail
- `#213` cold-clear/week_1/day/3 · *KEEP-FUNNY* — ginger cat warming on the car bonnet in the frost
- `#217` cold-clear/week_1/day/7 · *KEEP-BEAUTIFUL* — grandfather and grandchild with a puppy on a frosty patio — warm
- `#218` cold-clear/week_2/day/1 · *KILL-GENERIC* — boerboel sunning against the wall in the frost — quiet, no hook
- `#219` cold-clear/week_2/day/2 · *KEEP-BEAUTIFUL* — frosty-morning parkrun — authentic SA community, diverse
- `#226` cold-clear/week_3/day/2 · *KEEP-BEAUTIFUL* — grandfather and grandson at chess on a frosty patio — warm, genuine
- `#245` cold-clear/week_{1,3}/dawn/7 · *KEEP-BEAUTIFUL* — hadeda taking off from the frosty lawn — dynamic, SA-iconic
- `#301` fog/week_3/day/7 · *KILL-GENERIC* — wheeling the bin out in a gown in the fog — quiet chore

**`class`** — Class-register signal off-brand (aspirational-register rule) · **1** image(s):
- `#109` cloudy/week_{2,4}/dawn/4 · *BORDERLINE* — newspaper vendor between cars at the robot — iconic SA street vs aspirational-register rule

**`litter`** — Visible litter / mess (positive-vibes rule: no litter) · **2** image(s):
- `#541` wind/week_1/day/3 · *KILL-GENERIC* — Wheelie bins blown over with refuse scattered across the pavement, people bracing — the gag is undercut by litter, which breaks the positive-vibes rule
- `#558` wind/week_3/day/6 · *KILL-GENERIC* — Wheelie bins blown over with rubbish strewn across the driveway — scattered litter again breaks the positive-vibes rule

**`braai-weekend-gate`** — Braai imagery — must be weekend-gated (braai only on Sat/Sun slots) · **3** image(s):
- `#554` wind/week_3/day/2 · *KEEP-FUNNY* — Braai flames whipping sideways in the wind as someone feeds the fire — peak SA wind gag, but braai imagery should be weekend-gated
- `#591` wind/week_{2,4}/dusk/4 · *KEEP-FUNNY* — Man carrying the braai grill inside while a woman wrangles a flapping cover at sunset — SA salvage gag, but braai imagery should be weekend-gated
- `#596` wind/week_{1,3}/night/2 · *KEEP-FUNNY* — Two mates laughing at the braai at night as sparks blow in the wind, Table Mountain and city lights behind — diverse, warm; braai should be weekend-gated

> **Redbrick concentration:** the red face-brick default clusters hard in **cold-clear** (#213, 217, 218, 219, 226, 245) and recurs elsewhere — a systemic model-default worth a casting-prompt fix on the next regeneration batch, not just per-image kills.

## Over-representation clusters (thinning levers)

Motifs that recur across the set. Each image below is an individually-valid verdict, but the *cluster* is over-supplied — Al can thin to one representative per time-slot. Listed so the repetition is visible in one place.

| Motif | Images (idx · verdict) |
|---|---|
| berg-cottage-lightning | #538 x |
| blown-bins | #571 x |
| blown-trampoline | #557 x, #585 x |
| blown-umbrella | #542 x, #547 x, #552 K, #593 x |
| candlelit-dinner | #537 x |
| chase | #577 x |
| coastal-lightning | #515 x |
| coffee-watching | #506 x, #507 x, #516 x, #602 x |
| cozy-indoor | #164 K, #492 K, #496 K, #500 x, #520 x |
| dinner | #58 K, #67 K, #70 K, #120 K |
| dog-hiding | #486 x, #503 x |
| fairy-light-table | #605 x |
| filming-lightning | #522 K, #531 x |
| hair-in-wind | #556 x, #589 x |
| hat-blown | #566 K, #570 K |
| huddle-in-wind | #581 K, #583 K |
| kitesurf | #559 x |
| leak-bucket | #536 K |
| pets-storm | #529 x |
| suburb-lightning | #514 x |
| suit-in-wind | #579 x |
| veld-lightning | #530 x |
| washing | #580 x, #587 K, #598 K |
| watching-through-glass | #550 x |
| wind-wrecks-meal | #565 K, #594 K, #601 K |
| window-watching | #532 x, #533 x |
| windswept-cat | #606 x |

*(K = currently KEEP, x = currently KILL. The lightning-landscape family — coastal / veld / suburb / berg-cottage — is collectively the biggest over-supply: many dramatic bolts, few with a unique SA hook. Keepers were limited to the landmark/character shots; Al can swap his favourites in.)*

## Full verdict table

Sorted by global index (condition order, then day/dawn/dusk/night, then path). `slots` is a compact glob covering **every** rotation slot the image serves (`week_{1,3}` = served in weeks 1 and 3). Hash = sha256 prefix.

### clear  ·  70 unique  (F 4 · B 23 · BL 0 · KILL 43)

| idx | hash | slots served | slot | verdict | flags | reason |
|--:|---|---|---|---|---|---|
| 1 | `ddc0477fea66` | `clear/week_1/day/1` | day | KILL-GENERIC |  | Cape tidal pool with sun glare — coastal stock |
| 2 | `a4b08dc87c98` | `clear/week_1/day/2` | day | KEEP-BEAUTIFUL |  | lighting the fire pit at a Cape Dutch home — warm, diverse social |
| 3 | `8cc71f5fc16b` | `clear/week_1/day/3` | day | KEEP-FUNNY |  | big pool cannonball splash, slops on the deck |
| 4 | `dcf9dcadd8dd` | `clear/week_1/day/4` | day | KEEP-BEAUTIFUL |  | multigenerational family feast outdoors — vibrant, diverse |
| 5 | `b0d1a24a5c7a` | `clear/week_1/day/5` | day | KILL-GENERIC |  | lone thorn tree under a big sky — Africa cliche |
| 6 | `06eaefededb1` | `clear/week_1/day/6` | day | KILL-GENERIC |  | couple lunch at an office-park restaurant — dining lifestyle stock |
| 7 | `14fb224fa5c5` | `clear/week_1/day/7` | day | KILL-GENERIC |  | empty beach with umbrella and chairs — postcard stock |
| 8 | `fed27f42e409` | `clear/week_2/day/1` | day | KEEP-BEAUTIFUL |  | rooftop drinks with the Joburg skyline — vibrant, diverse urban |
| 9 | `668c55878419` | `clear/week_2/day/2` | day | KEEP-BEAUTIFUL |  | dad tackled by kids under the jacaranda — genuine family joy |
| 10 | `af548a81e72b` | `clear/week_2/day/3` | day | KEEP-BEAUTIFUL |  | gran watering flowers while the kid blows bubbles — warm Karoo stoep |
| 11 | `10d8826354b0` | `clear/week_2/day/4` | day | KEEP-FUNNY | `redbrick` | dad reclining with a beer while the kid mows — supervising gag |
| 12 | `90566b9c8c8c` | `clear/week_2/day/5` | day | KILL-GENERIC |  | revolving-door office entrance — corporate generic |
| 13 | `e6cf92909ea4` | `clear/week_2/day/6` | day | KEEP-FUNNY |  | hadeda on the sprinkler lawn — SA-iconic bird |
| 14 | `dde50ae61ffb` | `clear/week_2/day/7` | day | KILL-GENERIC |  | iced tea and sunglasses poolside still-life — no subject |
| 15 | `ebf034ee4420` | `clear/week_3/day/1` | day | KEEP-BEAUTIFUL |  | diverse kids team eating slap chips on the curb — authentic SA |
| 16 | `58cc7849b613` | `clear/week_3/day/2` | day | KILL-GENERIC |  | loading the cooler into the bakkie — outing lifestyle stock |
| 17 | `ae7148dc2255` | `clear/week_3/day/3` | day | KEEP-BEAUTIFUL |  | hadeda foraging in the agapanthus — SA garden close-up |
| 18 | `752ebaed7c7a` | `clear/week_3/day/4` | day | KILL-GENERIC |  | man walking to a glass office — generic |
| 19 | `e82abc3e568f` | `clear/week_3/day/5` | day | KILL-GENERIC |  | fire pit and chairs at golden hour, no people — lifestyle stock |
| 20 | `d4f4422c3141` | `clear/week_3/day/6` | day | KILL-GENERIC |  | empty backyard pool with toys — stock |
| 21 | `a9c1572f1be4` | `clear/week_3/day/7` | day | KILL-GENERIC |  | women on laptops on a Joburg rooftop — lifestyle stock |
| 22 | `8f3a85aa6dd7` | `clear/week_4/day/1` | day | KEEP-BEAUTIFUL | `text` | fixing a bike outside a jacaranda village cafe — charming SA |
| 23 | `ffa952ab3ec4` | `clear/week_4/day/2` | day | KEEP-BEAUTIFUL |  | kids playing catch on the lawn, Cape Dutch — genuine joy, diverse |
| 24 | `2a9561bafba5` | `clear/week_4/day/3` | day | KEEP-BEAUTIFUL |  | boerewors coils on the braai, diverse friends — authentic SA |
| 25 | `8984c42db91c` | `clear/week_4/day/4` | day | KILL-GENERIC |  | pool and protea garden over the mountains — scenic stock |
| 26 | `eb699c28bbf7` | `clear/week_4/day/5` | day | KEEP-FUNNY |  | women manning the braai, men lost with the salad — gender-flip gag, diverse |
| 27 | `5ab21fef44c2` | `clear/week_4/day/6` | day | KILL-GENERIC |  | golden retriever asleep on the deck — quiet, no hook |
| 28 | `e6d44805dd42` | `clear/week_4/day/7` | day | KEEP-BEAUTIFUL |  | full-bloom jacaranda street — iconic SA-beautiful |
| 29 | `cff3e24151cd` | `clear/week_{1,3}/dawn/1` | dawn | KILL-GENERIC |  | still dam at dawn — calm-water landscape stock |
| 30 | `b5ab611bcb18` | `clear/week_{1,3}/dawn/2` | dawn | KEEP-BEAUTIFUL |  | woman surfer facing the sea at dawn — striking, diverse |
| 31 | `19a5a826af31` | `clear/week_{1,3}/dawn/3` | dawn | KILL-GENERIC |  | trio jogging a winelands road — fitness lifestyle stock |
| 32 | `e32a01c0606b` | `clear/week_{1,3}/dawn/4` | dawn | KILL-GENERIC |  | man stretching on a frosty field — fitness stock |
| 33 | `216ca43059bf` | `clear/week_{1,3}/dawn/5` | dawn | KILL-GENERIC |  | Karoo koppie at dawn — landscape stock |
| 34 | `a340018f05ab` | `clear/week_{1,3}/dawn/6` | dawn | KILL-GENERIC |  | man walking the dog with coffee — lifestyle stock |
| 35 | `f644b0ec4586` | `clear/week_{1,3}/dawn/7` | dawn | KILL-GENERIC |  | dog asleep on the stoep at golden hour — quiet, no hook |
| 36 | `270b3c1bd383` | `clear/week_{2,4}/dawn/1` | dawn | KEEP-BEAUTIFUL |  | woman surfer at the water edge, birds and Cape mountains — evocative, diverse |
| 37 | `10a90cb12229` | `clear/week_{2,4}/dawn/2` | dawn | KILL-GENERIC |  | dad and child on the lawn at golden hour — quiet lifestyle, no hook |
| 38 | `e06a6a41f5d4` | `clear/week_{2,4}/dawn/3` | dawn | KILL-GENERIC |  | elderly woman watering the garden at dawn — gardening lifestyle stock |
| 39 | `164b05f8f58e` | `clear/week_{2,4}/dawn/4` | dawn | KILL-GENERIC |  | runner catching breath on the promenade — fitness stock |
| 40 | `015fe1a72983` | `clear/week_{2,4}/dawn/5` | dawn | KEEP-BEAUTIFUL |  | hadeda silhouette on a roof against a fiery dawn — striking, SA-iconic |
| 41 | `973df3298cfc` | `clear/week_{2,4}/dawn/6` | dawn | KILL-GENERIC |  | sunrise over Cape Town from the mountain — scenic postcard |
| 42 | `9864fb8df7da` | `clear/week_{2,4}/dawn/7` | dawn | KILL-GENERIC |  | lone figure on a wet beach at sunrise — atmospheric stock |
| 43 | `807a7662d68e` | `clear/week_{1,3}/dusk/1` | dusk | KILL-GENERIC |  | walking the dog at golden hour — lifestyle stock |
| 44 | `97eef9dd1eb9` | `clear/week_{1,3}/dusk/2` | dusk | KEEP-BEAUTIFUL |  | loading surfboards at dusk under a pink sky — evocative, diverse |
| 45 | `98f17f8df236` | `clear/week_{1,3}/dusk/3` | dusk | KILL-GENERIC |  | man watching the sunset on a hill — contemplative lifestyle stock |
| 46 | `bf7062d4d99b` | `clear/week_{1,3}/dusk/4` | dusk | KILL-GENERIC |  | golden hillside at sunset — landscape stock |
| 47 | `b767e97f8692` | `clear/week_{1,3}/dusk/5` | dusk | KILL-GENERIC |  | Highveld plains sunset — landscape stock |
| 48 | `9101b145de85` | `clear/week_{1,3}/dusk/6` | dusk | KILL-GENERIC |  | footprints in beach sand at sunset — atmospheric stock |
| 49 | `d08e7a2c6bc7` | `clear/week_{1,3}/dusk/7` | dusk | KEEP-BEAUTIFUL |  | passing a plate over the garden fence, strelitzia — authentic diverse neighbourliness |
| 50 | `ccaf3314493d` | `clear/week_{2,4}/dusk/1` | dusk | KILL-GENERIC |  | two friends with wine on a winelands bench — pretty but lifestyle stock |
| 51 | `7a05ada067d7` | `clear/week_{2,4}/dusk/2` | dusk | KILL-GENERIC |  | hose coiled on the lawn at sunset — object stock |
| 52 | `541d9d0e1594` | `clear/week_{2,4}/dusk/3` | dusk | KILL-GENERIC |  | man mowing the lawn at golden hour — chore lifestyle stock |
| 53 | `a3c3db310750` | `clear/week_{2,4}/dusk/4` | dusk | KEEP-BEAUTIFUL |  | young man mountain-biking through dust at sunset — dynamic, diverse |
| 54 | `88617f054c9b` | `clear/week_{2,4}/dusk/5` | dusk | KILL-GENERIC |  | two birds on a wire against a sunset — postcard trope |
| 55 | `b8f8ea343b77` | `clear/week_{2,4}/dusk/6` | dusk | KILL-GENERIC |  | friends walking arm-in-arm at dusk — lifestyle, no hook |
| 56 | `57c238720a6e` | `clear/week_{2,4}/dusk/7` | dusk | KILL-GENERIC |  | friends on the stoep at sunset with drinks — social lifestyle stock |
| 57 | `d3c3724ad566` | `clear/week_{1,3}/night/1` | night | KILL-GENERIC |  | laundry on the line under the moon — odd atmospheric stock |
| 58 | `c4472f5adb6d` | `clear/week_{1,3}/night/2` | night | KEEP-BEAUTIFUL | `motif-dinner` | long fairy-lit dinner table at night — festive, diverse, striking ambiance |
| 59 | `1fdbbd1ca958` | `clear/week_{1,3}/night/3` | night | KILL-GENERIC |  | biltong board and lantern under the moon — atmospheric still-life |
| 60 | `4d38ef49c99d` | `clear/week_{1,3}/night/4` | night | KEEP-BEAUTIFUL |  | friends stargazing at the Milky Way — evocative, diverse |
| 61 | `6060e4d415b8` | `clear/week_{1,3}/night/5` | night | KILL-GENERIC |  | ordinary family stoep dinner at night — lifestyle stock |
| 62 | `b665da789417` | `clear/week_{1,3}/night/6` | night | KILL-GENERIC |  | Milky Way over a peak — astro-landscape stock |
| 63 | `ed4291a686a0` | `clear/week_{1,3}/night/7` | night | KILL-GENERIC |  | Cape Town city lights at night — generic cityscape |
| 64 | `56cc7d4d9f45` | `clear/week_{2,4}/night/1` | night | KILL-GENERIC |  | Southern Cross over the veld — astro-landscape stock |
| 65 | `d80b42b77cdf` | `clear/week_{2,4}/night/2` | night | KILL-GENERIC |  | two men over drinks at night — lifestyle stock |
| 66 | `45aba72d1eee` | `clear/week_{2,4}/night/3` | night | KILL-GENERIC |  | man stargazing by his car — quiet lifestyle stock |
| 67 | `056fd7c90e16` | `clear/week_{2,4}/night/4` | night | KEEP-BEAUTIFUL | `motif-dinner` | lively fairy-lit dinner party — vibrant, diverse |
| 68 | `928ed2d8b02f` | `clear/week_{2,4}/night/5` | night | KEEP-BEAUTIFUL |  | child and mom spot the cat on the moonlit lawn — sweet, diverse |
| 69 | `5b1fb72a7e58` | `clear/week_{2,4}/night/6` | night | KEEP-BEAUTIFUL |  | moth at the stoep light — characterful SA-night detail |
| 70 | `22e65e5fd954` | `clear/week_{2,4}/night/7` | night | KEEP-BEAUTIFUL | `motif-dinner` | lively fairy-lit dinner party — vibrant, diverse |

### cloudy  ·  70 unique  (F 5 · B 15 · BL 1 · KILL 49)

| idx | hash | slots served | slot | verdict | flags | reason |
|--:|---|---|---|---|---|---|
| 71 | `43784257b98a` | `cloudy/week_1/day/1` | day | KEEP-BEAUTIFUL |  | god-rays over huddled Karoo sheep — striking light |
| 72 | `c8be0a1f383b` | `cloudy/week_1/day/2` | day | KEEP-BEAUTIFUL |  | schoolgirls netball jump-ball under grey sky — authentic SA sport, diverse |
| 73 | `5477e28c417f` | `cloudy/week_1/day/3` | day | KEEP-BEAUTIFUL |  | shelf cloud rolling over the veld — striking weather |
| 74 | `d11239bfdd59` | `cloudy/week_1/day/4` | day | KEEP-FUNNY |  | three men and the braai debate — diverse banter |
| 75 | `a5869ed3b614` | `cloudy/week_1/day/5` | day | KILL-GENERIC |  | woman at the window with coffee — indoor stock |
| 76 | `3975a423d9c8` | `cloudy/week_1/day/6` | day | KILL-GENERIC |  | white laundry under grey clouds — laundry-line stock |
| 77 | `8bc9f9cb40af` | `cloudy/week_1/day/7` | day | KEEP-FUNNY |  | two dachshunds watching the grey through the door |
| 78 | `a4e1da997c4a` | `cloudy/week_2/day/1` | day | KILL-GENERIC |  | woman on a picnic blanket wiping her brow — ambiguous lifestyle |
| 79 | `46d1e21b3c47` | `cloudy/week_2/day/2` | day | KILL-GENERIC |  | boy looking up at the overcast — quiet, no hook |
| 80 | `f6dabaf05d72` | `cloudy/week_2/day/3` | day | KILL-GENERIC |  | windowsill plant over a grey town — atmospheric interior stock |
| 81 | `e92586b665e9` | `cloudy/week_2/day/4` | day | KILL-GENERIC |  | hi-vis worker on a wet building site — documentary, no hook |
| 82 | `1c536cb795d4` | `cloudy/week_2/day/5` | day | KILL-GENERIC |  | empty rugby field under grey — quiet, no hook |
| 83 | `92d7d25f019b` | `cloudy/week_2/day/6` | day | KEEP-BEAUTIFUL |  | chameleon on a branch in the grey-lit garden — SA nature character |
| 84 | `8ccc38cc256f` | `cloudy/week_2/day/7` | day | KILL-GENERIC |  | lighting the braai under grey — prep, no strong hook |
| 85 | `dfbad3537118` | `cloudy/week_3/day/1` | day | KEEP-FUNNY |  | pausing mid-mow to eye the threatening clouds |
| 86 | `71fe452a10ff` | `cloudy/week_3/day/2` | day | KEEP-FUNNY |  | two retirees metal-detecting on an overcast beach |
| 87 | `7877d1b8b794` | `cloudy/week_3/day/3` | day | KILL-GENERIC |  | washing on the line before the rain — laundry stock |
| 88 | `380b93001539` | `cloudy/week_3/day/4` | day | KEEP-FUNNY |  | man on the roof eyeing the clouds over his solar panels — SA-relatable |
| 89 | `7276d059c79f` | `cloudy/week_3/day/5` | day | KEEP-BEAUTIFUL |  | diverse family at a craft market under grey — authentic SA life |
| 90 | `ef65147533f9` | `cloudy/week_3/day/6` | day | KILL-GENERIC |  | woman with coffee over a rainy grey city — moody indoor stock |
| 91 | `314f10bfdae9` | `cloudy/week_3/day/7` | day | KILL-GENERIC |  | colourful laundry under grey — laundry stock |
| 92 | `c2de8f3d92d8` | `cloudy/week_4/day/1` | day | KILL-GENERIC |  | gran watering hydrangeas under grey — gardening lifestyle stock |
| 93 | `f963b62c7cc6` | `cloudy/week_4/day/2` | day | KEEP-BEAUTIFUL |  | Karoo sheep auction, farmers at the pen — authentic, characterful |
| 94 | `ff9dad1070e0` | `cloudy/week_4/day/3` | day | KILL-GENERIC |  | unloading shopping before the rain — lifestyle stock |
| 95 | `f4ea0b142206` | `cloudy/week_4/day/4` | day | KILL-GENERIC |  | scruffy dog on the patio under grey — quiet, no hook |
| 96 | `042fefd4132d` | `cloudy/week_4/day/5` | day | KILL-GENERIC |  | two men at the gas braai under grey — lifestyle, no hook |
| 97 | `ee6954ad4647` | `cloudy/week_4/day/6` | day | KILL-GENERIC |  | man with an umbrella eyeing the sky, back to camera — quiet |
| 98 | `df763f00eea2` | `cloudy/week_4/day/7` | day | KILL-GENERIC |  | ordinary suburban street, patchy cloud — stock |
| 99 | `ebb6499fc990` | `cloudy/week_{1,3}/dawn/1` | dawn | KEEP-BEAUTIFUL | `text` | leaving the poskantoor with a parcel on a wet dorp street — authentic SA |
| 100 | `b4550b38b94d` | `cloudy/week_{1,3}/dawn/2` | dawn | KILL-GENERIC |  | commuter eyeing the sky at the taxi rank — no strong hook |
| 101 | `e9e72a0c1a59` | `cloudy/week_{1,3}/dawn/3` | dawn | KILL-GENERIC |  | towels and basket under grey — laundry stock |
| 102 | `4f833d5c5db4` | `cloudy/week_{1,3}/dawn/4` | dawn | KEEP-BEAUTIFUL |  | painting a turquoise Bo-Kaap house — iconic, vibrant SA |
| 103 | `edb28ce375ed` | `cloudy/week_{1,3}/dawn/5` | dawn | KILL-GENERIC |  | bin collectors eyeing the sky — documentary, no hook |
| 104 | `a2accba333c9` | `cloudy/week_{1,3}/dawn/6` | dawn | KILL-GENERIC |  | man walking the dog at dawn — lifestyle stock |
| 105 | `922d1f4d30d8` | `cloudy/week_{1,3}/dawn/7` | dawn | KEEP-BEAUTIFUL |  | child pressed to the window over a grey city — sweet, diverse |
| 106 | `eaa329ca0fcc` | `cloudy/week_{2,4}/dawn/1` | dawn | KILL-GENERIC |  | misty Highveld veld at dawn — landscape stock |
| 107 | `41da6c10f313` | `cloudy/week_{2,4}/dawn/2` | dawn | KEEP-BEAUTIFUL |  | mother and son making koeksisters, flour everywhere — warm, diverse, SA |
| 108 | `5f26348d76d0` | `cloudy/week_{2,4}/dawn/3` | dawn | KEEP-BEAUTIFUL |  | fishermen launching a boat at dawn — authentic Cape harbour |
| 109 | `1a7797cabfa9` | `cloudy/week_{2,4}/dawn/4` | dawn | BORDERLINE | `class` | newspaper vendor between cars at the robot — iconic SA street vs aspirational-register rule |
| 110 | `92a92df55156` | `cloudy/week_{2,4}/dawn/5` | dawn | KILL-GENERIC |  | colourful boats in a moody dawn harbour — scenic postcard |
| 111 | `6c2fdfff70be` | `cloudy/week_{2,4}/dawn/6` | dawn | KILL-GENERIC |  | woman trail-running the stormy Cape coast — fitness lifestyle |
| 112 | `d411804af654` | `cloudy/week_{2,4}/dawn/7` | dawn | KILL-GENERIC |  | empty coastal road under a moody sky — landscape stock |
| 113 | `9692723cb288` | `cloudy/week_{1,3}/dusk/1` | dusk | KILL-GENERIC |  | flat grey overcast over a dark city — flat, no subject |
| 114 | `791e756ecc1d` | `cloudy/week_{1,3}/dusk/2` | dusk | KILL-GENERIC |  | cyclist on a mountain pass at dusk — fitness lifestyle |
| 115 | `e9403097167e` | `cloudy/week_{1,3}/dusk/3` | dusk | KEEP-BEAUTIFUL |  | schoolgirls with hockey sticks crossing the field at dusk — authentic SA, diverse |
| 116 | `0e1a4e312bcc` | `cloudy/week_{1,3}/dusk/4` | dusk | KILL-GENERIC |  | winelands wedding photo shoot at dusk — pretty but lifestyle stock |
| 117 | `be5e7c7a3085` | `cloudy/week_{1,3}/dusk/5` | dusk | KILL-GENERIC |  | dad and daughter lighting the Weber at dusk — braai lifestyle, no hook |
| 118 | `59bb649ee46d` | `cloudy/week_{1,3}/dusk/6` | dusk | KILL-GENERIC |  | man with coffee at dusk, profile — quiet lifestyle |
| 119 | `efb29ce6153a` | `cloudy/week_{1,3}/dusk/7` | dusk | KILL-GENERIC |  | young man studying by lamplight — quiet indoor stock |
| 120 | `b84b9a7c9647` | `cloudy/week_{2,4}/dusk/1` | dusk | KEEP-BEAUTIFUL | `motif-dinner` | lively diverse stoep dinner at dusk — vibrant |
| 121 | `c2845db66d7b` | `cloudy/week_{2,4}/dusk/2` | dusk | KILL-GENERIC |  | silhouette and Table Mountain against a blazing sunset — iconic postcard |
| 122 | `f20554e03039` | `cloudy/week_{2,4}/dusk/3` | dusk | KILL-GENERIC |  | dog asleep on a cushion at dusk — quiet, no hook |
| 123 | `78fb94ea9359` | `cloudy/week_{2,4}/dusk/4` | dusk | KILL-GENERIC |  | couple at the pizza oven at dusk — lifestyle, no hook |
| 124 | `01edf502a02c` | `cloudy/week_{2,4}/dusk/5` | dusk | KILL-GENERIC |  | suburban rooftops at sunset — landscape stock |
| 125 | `fada902c14d5` | `cloudy/week_{2,4}/dusk/6` | dusk | KILL-GENERIC |  | suburban rooftops and antennas at dusk — ordinary stock |
| 126 | `41a1917dbae9` | `cloudy/week_{2,4}/dusk/7` | dusk | KILL-GENERIC |  | lone figure at a Karoo picnic table at dusk — atmospheric, quiet |
| 127 | `ee562e8adf73` | `cloudy/week_{1,3}/night/1` | night | KILL-GENERIC |  | dark cloudy night over the Karoo — dark landscape stock |
| 128 | `5df9bca2b532` | `cloudy/week_{1,3}/night/2` | night | KILL-GENERIC |  | Bengal cat asleep on the couch at night — quiet, no hook |
| 129 | `af302e2742f8` | `cloudy/week_{1,3}/night/3` | night | KILL-GENERIC |  | man up the driveway eyeing the cloudy night — quiet lifestyle |
| 130 | `fca59241d0f8` | `cloudy/week_{1,3}/night/4` | night | KEEP-BEAUTIFUL |  | gran pulling washing off the line at night before the storm — authentic, warm light |
| 131 | `6eb54cab3c82` | `cloudy/week_{1,3}/night/5` | night | KILL-GENERIC |  | hi-vis worker on a dark road with a torch — documentary dark |
| 132 | `fd0a18b25b4e` | `cloudy/week_{1,3}/night/6` | night | KILL-GENERIC |  | bakkie on a dark dirt road at night — atmospheric stock |
| 133 | `e25e5992ff0b` | `cloudy/week_{1,3}/night/7` | night | KEEP-BEAUTIFUL |  | torch-lit figure to the windmill under a moonlit sky — striking, moody Karoo |
| 134 | `1ce80a59c7b3` | `cloudy/week_{2,4}/night/1` | night | KILL-GENERIC |  | boy reading under a lamp at night — quiet cozy stock |
| 135 | `69862fc2a138` | `cloudy/week_{2,4}/night/2` | night | KILL-GENERIC |  | grandpa knitting in the armchair at night — quiet cozy |
| 136 | `de04770a56bb` | `cloudy/week_{2,4}/night/3` | night | KILL-GENERIC |  | girl in a gown eyeing the night sky — quiet, no hook |
| 137 | `82fcb37eff89` | `cloudy/week_{2,4}/night/4` | night | KILL-GENERIC |  | hooded teen on the curb lit by phone — moody stock |
| 138 | `e87c5b906c04` | `cloudy/week_{2,4}/night/5` | night | KILL-GENERIC |  | valley of suburban lights at night — atmospheric stock |
| 139 | `3d221a5aace3` | `cloudy/week_{2,4}/night/6` | night | KILL-GENERIC |  | child reading on the stoep under a stormy sky — cozy, quiet |
| 140 | `bd171c6b6e37` | `cloudy/week_{2,4}/night/7` | night | KILL-GENERIC |  | coastal road with town lights at night — atmospheric stock |

### cold  ·  70 unique  (F 9 · B 13 · BL 0 · KILL 48)

| idx | hash | slots served | slot | verdict | flags | reason |
|--:|---|---|---|---|---|---|
| 141 | `44689ab7898f` | `cold/week_1/day/1` | day | KILL-GENERIC |  | colleagues with coffee at the office window — lifestyle stock |
| 142 | `dc5ac4e3868b` | `cold/week_1/day/2` | day | KEEP-BEAUTIFUL |  | group huddled around the patio heater — cozy cold social, diverse |
| 143 | `d8ecdadd10a8` | `cold/week_1/day/3` | day | KILL-GENERIC |  | lamp + mug + jersey on the windowsill — cozy still-life |
| 144 | `b248f487052e` | `cold/week_1/day/4` | day | KEEP-BEAUTIFUL |  | family sharing a potjie indoors — warm, diverse, SA winter comfort |
| 145 | `efe4bd8cba3a` | `cold/week_1/day/5` | day | KEEP-BEAUTIFUL |  | frosty winelands vineyard at dawn — striking, cold-apt |
| 146 | `3edd5a2c5f60` | `cold/week_1/day/6` | day | KEEP-FUNNY |  | old dog wrapped in a blanket by the frosty window |
| 147 | `3fcfb2b87a83` | `cold/week_1/day/7` | day | KILL-GENERIC |  | woman bundled on a park bench with coffee — quiet, no hook |
| 148 | `9ff14684dcd2` | `cold/week_2/day/1` | day | KILL-GENERIC |  | young man breathing visible steam by a Karoo cottage — plain portrait |
| 149 | `9df3ba126647` | `cold/week_2/day/2` | day | KEEP-FUNNY |  | child burrowed in a duvet fort against the cold |
| 150 | `d3de1926905d` | `cold/week_2/day/3` | day | KEEP-FUNNY |  | walking a small dog in a doggy jersey on a wet street |
| 151 | `08c461c74e9c` | `cold/week_2/day/4` | day | KEEP-BEAUTIFUL |  | family bundled under a blanket on the couch — cozy, diverse cold-huddle |
| 152 | `30307b4b49c4` | `cold/week_2/day/5` | day | KEEP-FUNNY |  | pouring the kettle over a frozen windscreen — SA cold gag |
| 153 | `95aa5d603d4d` | `cold/week_2/day/6` | day | KILL-GENERIC |  | Cape Dutch farmhouse in a muddy field under grey — landscape stock |
| 154 | `b4adeaba1c67` | `cold/week_2/day/7` | day | KILL-GENERIC |  | rainy view from the stoep over misty winelands — atmospheric, no subject |
| 155 | `a1b475c602fb` | `cold/week_3/day/1` | day | KILL-GENERIC |  | bare winter vineyard under misty mountains — landscape stock |
| 156 | `7f7ad8548b9e` | `cold/week_3/day/2` | day | KILL-GENERIC |  | schoolboy head-down walking to school in the cold — quiet, bleak |
| 157 | `83e944cbfa2a` | `cold/week_3/day/3` | day | KEEP-FUNNY |  | wool socks drying on the bar heater — SA winter detail |
| 158 | `d9c48a235cc2` | `cold/week_3/day/4` | day | KILL-GENERIC |  | two women with coffee at the office window — lifestyle stock |
| 159 | `0f384484ae14` | `cold/week_3/day/5` | day | KEEP-FUNNY | `text` | two friends under a yellow umbrella and road-closed-due-to-rain sign — SA winter humor, diverse |
| 160 | `44af2aeba2a4` | `cold/week_3/day/6` | day | KILL-GENERIC |  | frost on the garden table and sunglasses — cold still-life |
| 161 | `339f8109e3bb` | `cold/week_3/day/7` | day | KILL-GENERIC |  | cold hands round a steaming mug — cozy still-life |
| 162 | `c049b4e672c9` | `cold/week_4/day/1` | day | KILL-GENERIC |  | jersey pulled over the nose on a wet street — cold-bundle stock |
| 163 | `b6dbfe87e5ae` | `cold/week_4/day/2` | day | KILL-GENERIC |  | grandpa by the bar heater in the lounge — cozy quiet |
| 164 | `636807010be7` | `cold/week_4/day/3` | day | KEEP-BEAUTIFUL | `motif-cozy` | family bundled by the fire with hot drinks — warm, diverse cold-comfort |
| 165 | `825a6ff64124` | `cold/week_4/day/4` | day | KILL-GENERIC |  | frost on the garden tap — cold still-life |
| 166 | `60d8ab334f19` | `cold/week_4/day/5` | day | KILL-GENERIC |  | boerboel at the open door in the cold — quiet, no hook |
| 167 | `e07bca8ea2ee` | `cold/week_4/day/6` | day | KILL-GENERIC |  | couple and dog on a cold windswept beach — lifestyle, no hook |
| 168 | `59179350db9e` | `cold/week_4/day/7` | day | KEEP-BEAUTIFUL |  | snow-dusted Cape peaks over a fynbos trail — striking, cold-apt |
| 169 | `13b538b6e4d9` | `cold/week_{1,3}/dawn/1` | dawn | KEEP-FUNNY |  | small dog in a knitted jumper on the frosty lawn |
| 170 | `5731da5e0f73` | `cold/week_{1,3}/dawn/2` | dawn | KILL-GENERIC |  | woman with a mug in the doorway at dawn — cozy quiet |
| 171 | `bbba6c120fec` | `cold/week_{1,3}/dawn/3` | dawn | KEEP-BEAUTIFUL |  | mom zipping her sons jacket before school — tender, diverse cold morning |
| 172 | `00989238a8dc` | `cold/week_{1,3}/dawn/4` | dawn | KEEP-BEAUTIFUL |  | Karoo farmer with sheep at cold dawn — authentic, atmospheric |
| 173 | `3f832407ba53` | `cold/week_{1,3}/dawn/5` | dawn | KILL-GENERIC |  | parent fixing a schoolboys collar at the gate — redundant with 171 |
| 174 | `f1d4b2b54c8a` | `cold/week_{1,3}/dawn/6` | dawn | KILL-GENERIC |  | man scraping the frosted car window — redundant de-icing see 152 |
| 175 | `628d097a55e4` | `cold/week_{1,3}/dawn/7` | dawn | KILL-GENERIC |  | frosty car under bare trees at dawn — frost-car stock |
| 176 | `1a39c9910579` | `cold/week_{2,4}/dawn/1` | dawn | KILL-GENERIC |  | granny wrapped in a blanket on a cold stoep — quiet, slightly bleak |
| 177 | `efdca46b2a33` | `cold/week_{2,4}/dawn/2` | dawn | KILL-GENERIC |  | boy training on a cold wet street at dawn — fitness stock |
| 178 | `7475e002cd4c` | `cold/week_{2,4}/dawn/3` | dawn | KILL-GENERIC |  | kettle steaming and toast on the counter — kitchen still-life |
| 179 | `694613fd5169` | `cold/week_{2,4}/dawn/4` | dawn | KILL-GENERIC |  | woman shivering on a misty highland trail — quiet, bleak-ish |
| 180 | `2f56b7f02f5a` | `cold/week_{2,4}/dawn/5` | dawn | KILL-GENERIC |  | rumpled empty bed at dawn — no subject |
| 181 | `db4f52af633f` | `cold/week_{2,4}/dawn/6` | dawn | KILL-GENERIC |  | frost on a Fortuner windscreen — frost-car stock |
| 182 | `cc55bb473970` | `cold/week_{2,4}/dawn/7` | dawn | KILL-GENERIC |  | fiery misty sunrise over proteas — striking but landscape stock |
| 183 | `f1349a0375bd` | `cold/week_{1,3}/dusk/1` | dusk | KEEP-BEAUTIFUL |  | kids by the glowing bar heater, rain on the window — warm, diverse SA winter |
| 184 | `530ef9c27b67` | `cold/week_{1,3}/dusk/2` | dusk | KILL-GENERIC |  | couple by the fireplace at dusk — cozy-fire lifestyle motif |
| 185 | `a51e0134b069` | `cold/week_{1,3}/dusk/3` | dusk | KILL-GENERIC |  | granddad wrapped in a blanket on a cold stoep — quiet, bleak-ish |
| 186 | `b8af04ae654f` | `cold/week_{1,3}/dusk/4` | dusk | KILL-GENERIC |  | child with blocks by the gas heater at dusk — redundant cozy-heater |
| 187 | `8d014b48a123` | `cold/week_{1,3}/dusk/5` | dusk | KILL-GENERIC |  | man hiking down the mountain at sunset — fitness lifestyle |
| 188 | `d0a465c134a5` | `cold/week_{1,3}/dusk/6` | dusk | KILL-GENERIC |  | woman bundled with a mug on the couch — cozy quiet |
| 189 | `2075c3e34891` | `cold/week_{1,3}/dusk/7` | dusk | KEEP-FUNNY |  | tabby sprawled on the bar heater — SA winter cat gag |
| 190 | `16ff6c4b009d` | `cold/week_{2,4}/dusk/1` | dusk | KILL-GENERIC |  | woman jogging the dog in the cold — fitness lifestyle |
| 191 | `faeb74712034` | `cold/week_{2,4}/dusk/2` | dusk | KILL-GENERIC |  | granny with a blanket and dog on the stoep — cozy quiet |
| 192 | `8cc0e2a4cb52` | `cold/week_{2,4}/dusk/3` | dusk | KILL-GENERIC |  | misty cold beach at dusk — landscape stock |
| 193 | `6dacc116516e` | `cold/week_{2,4}/dusk/4` | dusk | KEEP-BEAUTIFUL |  | tasting the soup on the stove — warm winter cooking, diverse |
| 194 | `abf16c113fdb` | `cold/week_{2,4}/dusk/5` | dusk | KILL-GENERIC |  | hot chocolate and marshmallows over Cape Town — cozy still-life stock |
| 195 | `e55af14b7642` | `cold/week_{2,4}/dusk/6` | dusk | KILL-GENERIC |  | cozy fireside armchairs in a stone cottage — fire still-life, no people |
| 196 | `b61c75160d45` | `cold/week_{2,4}/dusk/7` | dusk | KILL-GENERIC |  | Camps Bay under stormy dusk — scenic postcard |
| 197 | `4d3c47957780` | `cold/week_{1,3}/night/1` | night | KILL-GENERIC |  | walking to a warm-lit door on a cold night — quiet, back to camera |
| 198 | `6e34728b5f81` | `cold/week_{1,3}/night/2` | night | KILL-GENERIC |  | empty bed with a lamp at night — no subject |
| 199 | `f192b3ef6616` | `cold/week_{1,3}/night/3` | night | KEEP-BEAUTIFUL |  | three friends round the paraffin heater at night — warm, diverse cold huddle |
| 200 | `0a4163652fa6` | `cold/week_{1,3}/night/4` | night | KILL-GENERIC |  | dog asleep on the bed at night — quiet, no hook |
| 201 | `81ff280e85ca` | `cold/week_{1,3}/night/5` | night | KILL-GENERIC |  | wool socks + mug + book on the couch — cozy still-life |
| 202 | `ab268daadccc` | `cold/week_{1,3}/night/6` | night | KILL-GENERIC |  | granny knitting under a lamp at night — cozy quiet |
| 203 | `0cf2acaa4c43` | `cold/week_{1,3}/night/7` | night | KEEP-BEAUTIFUL |  | bundled kid reading by torchlight — SA loadshedding and cold, relatable |
| 204 | `b3c6e74bfcfa` | `cold/week_{2,4}/night/1` | night | KEEP-FUNNY | `text` | late-night PJ snack run in the cold, kettle-corn sign — quirky, diverse |
| 205 | `554cf535da91` | `cold/week_{2,4}/night/2` | night | KILL-GENERIC |  | man breathing steam under the stars on the stoep — quiet atmospheric |
| 206 | `b6001c42c973` | `cold/week_{2,4}/night/3` | night | KILL-GENERIC |  | woman working under a blanket at night — quiet lifestyle |
| 207 | `c2cab3d13aee` | `cold/week_{2,4}/night/4` | night | KILL-GENERIC |  | steaming hot bath on a cold night — still-life, no subject |
| 208 | `a24c89fca736` | `cold/week_{2,4}/night/5` | night | KEEP-BEAUTIFUL |  | couple by a campfire under the Milky Way, Karoo — striking, evocative |
| 209 | `389bf9f20003` | `cold/week_{2,4}/night/6` | night | KILL-GENERIC |  | roaring fireplace close-up — fire still-life |
| 210 | `9e343cbdc5f7` | `cold/week_{2,4}/night/7` | night | KILL-GENERIC |  | Milky Way over the frosty Karoo veld — astro-landscape stock |

### cold-clear  ·  70 unique  (F 2 · B 24 · BL 0 · KILL 44)

| idx | hash | slots served | slot | verdict | flags | reason |
|--:|---|---|---|---|---|---|
| 211 | `ed88abf02958` | `cold-clear/week_1/day/1` | day | KEEP-BEAUTIFUL |  | weathered Karoo farmer over the veld, blue sky — authentic character |
| 212 | `e4e4c907db40` | `cold-clear/week_1/day/2` | day | KEEP-BEAUTIFUL | `redbrick` | frost-covered lemons on the tree — striking cold-clear detail |
| 213 | `fdb3fb47673a` | `cold-clear/week_1/day/3` | day | KEEP-FUNNY | `redbrick` | ginger cat warming on the car bonnet in the frost |
| 214 | `43dc1982b6f4` | `cold-clear/week_1/day/4` | day | KEEP-BEAUTIFUL |  | dad seeing his son into the bakkie on a frosty morning — tender, diverse |
| 215 | `371ea6c11aca` | `cold-clear/week_1/day/5` | day | KEEP-BEAUTIFUL |  | schoolkids running on the frosty field — authentic, diverse, lively |
| 216 | `fe1fdfe802db` | `cold-clear/week_1/day/6` | day | KEEP-BEAUTIFUL |  | family washing the car in the frost — warm, diverse |
| 217 | `7cf09cd6982a` | `cold-clear/week_1/day/7` | day | KEEP-BEAUTIFUL | `redbrick` | grandfather and grandchild with a puppy on a frosty patio — warm |
| 218 | `45f77f76f9e8` | `cold-clear/week_2/day/1` | day | KILL-GENERIC | `redbrick` | boerboel sunning against the wall in the frost — quiet, no hook |
| 219 | `949f0991e471` | `cold-clear/week_2/day/2` | day | KEEP-BEAUTIFUL | `redbrick` | frosty-morning parkrun — authentic SA community, diverse |
| 220 | `779e4280e7e8` | `cold-clear/week_2/day/3` | day | KILL-GENERIC |  | dad and son bundled on a frosty street — redundant parent-schoolkid-cold |
| 221 | `56dc41e2c4b7` | `cold-clear/week_2/day/4` | day | KILL-GENERIC |  | couple walking the dog with coffee in the frost — lifestyle stock |
| 222 | `fd6c59518faf` | `cold-clear/week_2/day/5` | day | KEEP-BEAUTIFUL |  | frosted spider web backlit by the sun — striking cold-clear macro |
| 223 | `819e66efc130` | `cold-clear/week_2/day/6` | day | KEEP-BEAUTIFUL |  | tending herbs at the window, frost outside — warm-vs-cold, diverse |
| 224 | `0606598a07b1` | `cold-clear/week_2/day/7` | day | KEEP-BEAUTIFUL |  | family breakfast in the bright winter morning — warm, diverse |
| 225 | `9bc0e657920c` | `cold-clear/week_3/day/1` | day | KILL-GENERIC |  | hadeda silhouette against a bare tree — bird-silhouette stock |
| 226 | `42349f744ddf` | `cold-clear/week_3/day/2` | day | KEEP-BEAUTIFUL | `redbrick` | grandfather and grandson at chess on a frosty patio — warm, genuine |
| 227 | `31cab776f83c` | `cold-clear/week_3/day/3` | day | KILL-GENERIC |  | woman on a laptop by a frosty window — WFH lifestyle |
| 228 | `ff9f3953b718` | `cold-clear/week_3/day/4` | day | KILL-GENERIC |  | tabby sunning on a frosty lawn — quiet, no hook |
| 229 | `63272c175d07` | `cold-clear/week_3/day/5` | day | KEEP-BEAUTIFUL |  | mom zipping a grumpy toddler by the frosty window, porridge — warm, relatable |
| 230 | `3abcb1fac596` | `cold-clear/week_3/day/6` | day | KILL-GENERIC |  | mom walking bundled kids to school in the frost — redundant motif |
| 231 | `03521727d46c` | `cold-clear/week_3/day/7` | day | KILL-GENERIC |  | woman checking her phone at a frosty roadside — quiet commuter |
| 232 | `4065545e44d8` | `cold-clear/week_4/day/1` | day | KILL-GENERIC |  | woman walking the Lab in the frost — dog-walk lifestyle |
| 233 | `dd277f4f7cf9` | `cold-clear/week_4/day/2` | day | KEEP-FUNNY |  | puffer jacket + shorts + beanie in the frost — SA winter gag |
| 234 | `0f67cc84665b` | `cold-clear/week_4/day/3` | day | KILL-GENERIC |  | frosty lawn + pool + modern house — property stock |
| 235 | `66923fd510ea` | `cold-clear/week_4/day/4` | day | KILL-GENERIC |  | scraping frost off the windscreen — redundant de-icing |
| 236 | `d28352e7c67a` | `cold-clear/week_4/day/5` | day | KEEP-BEAUTIFUL |  | oupa with a crossword and coffee on the frosty stoep — characterful, warm |
| 237 | `4d264dd6f3a4` | `cold-clear/week_4/day/6` | day | KILL-GENERIC |  | man sipping a cappuccino outside a cafe — coffee lifestyle stock |
| 238 | `3a245c2be397` | `cold-clear/week_4/day/7` | day | KILL-GENERIC |  | office lunch around the patio heater — lifestyle, redundant heater |
| 239 | `4018df89f04b` | `cold-clear/week_{1,3}/dawn/1` | dawn | KILL-GENERIC |  | mom fixing a school tie in the frost — redundant parent-schoolkid motif |
| 240 | `4048387777c6` | `cold-clear/week_{1,3}/dawn/2` | dawn | KILL-GENERIC |  | hi-vis bike commuter in the frosty dawn — commute/fitness |
| 241 | `2a0099db134d` | `cold-clear/week_{1,3}/dawn/3` | dawn | KILL-GENERIC |  | frost-covered trampoline at dawn — property, no strong hook |
| 242 | `fc1876ca5b41` | `cold-clear/week_{1,3}/dawn/4` | dawn | KILL-GENERIC |  | man stretching before a frosty run — fitness stock |
| 243 | `0c0c39d412de` | `cold-clear/week_{1,3}/dawn/5` | dawn | KILL-GENERIC |  | two steaming mugs on a frosty table — still-life |
| 244 | `157cc96f13f2` | `cold-clear/week_{1,3}/dawn/6` | dawn | KEEP-BEAUTIFUL |  | mom and child feeding chickens on a frosty smallholding — warm, diverse, SA |
| 245 | `eed7c0c46429` | `cold-clear/week_{1,3}/dawn/7` | dawn | KEEP-BEAUTIFUL | `redbrick` | hadeda taking off from the frosty lawn — dynamic, SA-iconic |
| 246 | `cdb7e5bcef86` | `cold-clear/week_{2,4}/dawn/1` | dawn | KILL-GENERIC |  | jogger with a big cloud of cold breath at dawn — fitness stock |
| 247 | `78d55f275ec0` | `cold-clear/week_{2,4}/dawn/2` | dawn | KILL-GENERIC |  | de-icing the windscreen at dawn — redundant de-icing |
| 248 | `16417b9db10c` | `cold-clear/week_{2,4}/dawn/3` | dawn | KILL-GENERIC |  | frost-covered wheelie bins on the verge — quiet, no hook |
| 249 | `4d0ec6d8d4c0` | `cold-clear/week_{2,4}/dawn/4` | dawn | KILL-GENERIC |  | dog asleep on a mat in the frosty dawn — quiet, no hook |
| 250 | `c0c4a3eeb627` | `cold-clear/week_{2,4}/dawn/5` | dawn | KILL-GENERIC |  | granny with coffee on the stoep at dawn — quiet, atmospheric |
| 251 | `51b110e053e5` | `cold-clear/week_{2,4}/dawn/6` | dawn | KEEP-BEAUTIFUL |  | family scrambling into the frosted car in the morning — busy, diverse |
| 252 | `7fac4c0e5a61` | `cold-clear/week_{2,4}/dawn/7` | dawn | KEEP-BEAUTIFUL |  | guineafowl crossing the frosty road at dawn — SA-iconic, characterful |
| 253 | `2b4b1eafb735` | `cold-clear/week_{1,3}/dusk/1` | dusk | KILL-GENERIC |  | mug + sunglasses + keys on a frosty table — still-life |
| 254 | `0051649d84e5` | `cold-clear/week_{1,3}/dusk/2` | dusk | KILL-GENERIC |  | dog at the gate eyeing the warm house at dusk — quiet |
| 255 | `4ee0bf212885` | `cold-clear/week_{1,3}/dusk/3` | dusk | KILL-GENERIC |  | oldster with a mug over the veld at sunset — quiet contemplative |
| 256 | `04b40fe21517` | `cold-clear/week_{1,3}/dusk/4` | dusk | KILL-GENERIC |  | laundry on the line at frosty dusk — laundry stock |
| 257 | `b8c7819a2f6d` | `cold-clear/week_{1,3}/dusk/5` | dusk | KEEP-BEAUTIFUL |  | friends round the fire pit at dusk — warm, diverse cold social |
| 258 | `47699b1e23ac` | `cold-clear/week_{1,3}/dusk/6` | dusk | KILL-GENERIC |  | couple with wine under a blanket by the window — lifestyle stock |
| 259 | `c10241676fcd` | `cold-clear/week_{1,3}/dusk/7` | dusk | KEEP-BEAUTIFUL |  | covering the lemon tree against frost, dog watching — characterful SA-winter task |
| 260 | `0ea9b7c21d51` | `cold-clear/week_{2,4}/dusk/1` | dusk | KILL-GENERIC |  | couple walking home with flowers and groceries — lifestyle stock |
| 261 | `efd9c202aa81` | `cold-clear/week_{2,4}/dusk/2` | dusk | KILL-GENERIC |  | woman walking home on a frosty street — quiet, no hook |
| 262 | `c19b2bf4d644` | `cold-clear/week_{2,4}/dusk/3` | dusk | KEEP-BEAUTIFUL |  | two horses breathing steam at frosty sunset — evocative, SA-rural |
| 263 | `fe10d856437b` | `cold-clear/week_{2,4}/dusk/4` | dusk | KEEP-BEAUTIFUL |  | dad and son carrying firewood at frosty dusk — warm, genuine, diverse |
| 264 | `e9b045413ea5` | `cold-clear/week_{2,4}/dusk/5` | dusk | KILL-GENERIC |  | cat silhouette at the window against a pink sunset — quiet atmospheric |
| 265 | `3059c2a7ee7d` | `cold-clear/week_{2,4}/dusk/6` | dusk | KEEP-BEAUTIFUL |  | girl leaping for a dunk at frosty dusk — dynamic, diverse |
| 266 | `f4d059908c17` | `cold-clear/week_{2,4}/dusk/7` | dusk | KILL-GENERIC |  | two men chatting on a frosty street — quiet lifestyle |
| 267 | `929ce372c06f` | `cold-clear/week_{1,3}/night/1` | night | KILL-GENERIC |  | cat to the lantern and mug on the stoep — cozy still-life |
| 268 | `0d0ff64216ce` | `cold-clear/week_{1,3}/night/2` | night | KEEP-BEAUTIFUL |  | filling hot water bottles at night — SA winter ritual, warm, diverse |
| 269 | `7563eedc5863` | `cold-clear/week_{1,3}/night/3` | night | KILL-GENERIC |  | Southern Cross over a Cape Dutch house — astro-landscape |
| 270 | `0fcb012c48ab` | `cold-clear/week_{1,3}/night/4` | night | KILL-GENERIC |  | woman breathing steam at the stars in PJs — quiet atmospheric |
| 271 | `1e7a8f8641e4` | `cold-clear/week_{1,3}/night/5` | night | KILL-GENERIC |  | friends gathered at a warm-lit doorway at night — quiet-ish |
| 272 | `9eabbd13450f` | `cold-clear/week_{1,3}/night/6` | night | KILL-GENERIC |  | moonlit frosty stoep with mugs — still-life |
| 273 | `26a93f97e9de` | `cold-clear/week_{1,3}/night/7` | night | KILL-GENERIC |  | wine and cheese board by candlelight — lifestyle still-life |
| 274 | `b5b6b3c83e85` | `cold-clear/week_{2,4}/night/1` | night | KEEP-BEAUTIFUL |  | family roasting marshmallows over the fire pit at night — warm, diverse |
| 275 | `8cc6367de3d1` | `cold-clear/week_{2,4}/night/2` | night | KILL-GENERIC |  | wheeling out the bin in the cold night — chore, dark |
| 276 | `844e452a8f6a` | `cold-clear/week_{2,4}/night/3` | night | KILL-GENERIC |  | kettle steaming by a frosty window — kitchen still-life |
| 277 | `929560dd0f32` | `cold-clear/week_{2,4}/night/4` | night | KILL-GENERIC |  | family bundled on the couch by a frosty window — redundant cozy-couch |
| 278 | `9af633383ef0` | `cold-clear/week_{2,4}/night/5` | night | KILL-GENERIC |  | dog asleep on a bed, snow outside — quiet, no hook |
| 279 | `f52d1c0ed9ac` | `cold-clear/week_{2,4}/night/6` | night | KILL-GENERIC |  | man studying in gloves by a frosty window — quiet, flat |
| 280 | `e3118492a2ab` | `cold-clear/week_{2,4}/night/7` | night | KILL-GENERIC |  | friends walking a frosty street at night — quiet lifestyle |

### fog  ·  49 unique  (F 1 · B 6 · BL 0 · KILL 42)

| idx | hash | slots served | slot | verdict | flags | reason |
|--:|---|---|---|---|---|---|
| 281 | `3fbe216c40e0` | `fog/week_1/day/1` | day | KILL-GENERIC |  | golfer walking in the fog — quiet, mild |
| 282 | `4ccdc196e04a` | `fog/week_1/day/2` | day | KEEP-BEAUTIFUL |  | god-rays through the misty trees, man + dog — striking fog light |
| 283 | `cca354da1037` | `fog/week_1/day/3` | day | KEEP-BEAUTIFUL |  | tabby on a stone wall in the fog, ghostly figures — moody, characterful |
| 284 | `8027b1778e4a` | `fog/week_1/day/4` | day | KILL-GENERIC |  | misty winelands vineyard — landscape stock |
| 285 | `0ae0192ab536` | `fog/week_1/day/5` | day | KILL-GENERIC |  | lone tree on a foggy hill — minimalist landscape stock |
| 286 | `27e3362fd4b8` | `fog/week_1/day/6` | day | KILL-GENERIC |  | people walking a misty path — quiet, no hook |
| 287 | `ff06a1494a58` | `fog/week_1/day/7` | day | KILL-GENERIC |  | car headlights in thick fog — conveys fog but no hook |
| 288 | `b0695f2cebc7` | `fog/week_2/day/1` | day | KILL-GENERIC |  | rugby posts in the fog — empty field, quiet |
| 289 | `3260e5912302` | `fog/week_2/day/2` | day | KEEP-BEAUTIFUL |  | dewy spider web on fynbos in the fog — atmospheric macro |
| 290 | `75d50e2a3b1b` | `fog/week_2/day/3` | day | KEEP-FUNNY | `text` | fogged-out uitkykpunt viewpoint — the view with no view |
| 291 | `bd1172b4a9a0` | `fog/week_2/day/4` | day | KILL-GENERIC |  | driving a pass in thick fog — atmospheric, no hook |
| 292 | `a26cb997d112` | `fog/week_2/day/5` | day | KILL-GENERIC |  | Lab emerging from the fog on a walk — foggy-walk stock |
| 293 | `3b6a6b044e9a` | `fog/week_2/day/6` | day | KILL-GENERIC |  | man driving tense in the fog — atmospheric, no hook |
| 294 | `14d3cb85427c` | `fog/week_2/day/7` | day | KILL-GENERIC |  | dewy web on a fence in fog — redundant web see 289 |
| 295 | `96f755061e2e` | `fog/week_3/day/1` | day | KILL-GENERIC |  | foggy harbour with boats — scenic stock |
| 296 | `f23e83d55db3` | `fog/week_3/day/2` | day | KILL-GENERIC |  | woman walking the dog in low fog — foggy-walk stock |
| 297 | `02a5622cc2a2` | `fog/week_3/day/3` | day | KILL-GENERIC |  | hiker on a misty mountain path — quiet, no hook |
| 298 | `e0509e567a6e` | `fog/week_3/day/4` | day | KILL-GENERIC |  | foggy street, apartment block barely visible — atmospheric stock |
| 299 | `5fc88303ff34` | `fog/week_3/day/5` | day | KILL-GENERIC |  | man cycling into the fog — foggy-commute stock |
| 300 | `a36a468defe3` | `fog/week_3/day/6` | day | KILL-GENERIC |  | foggy suburban street, house barely visible — atmospheric stock |
| 301 | `e202753ff25a` | `fog/week_3/day/7` | day | KILL-GENERIC | `redbrick` | wheeling the bin out in a gown in the fog — quiet chore |
| 302 | `7b6de3ab0922` | `fog/week_4/day/1` | day | KILL-GENERIC |  | low fog over suburban rooftops — atmospheric stock |
| 303 | `a3fd7587848b` | `fog/week_4/day/2` | day | KILL-GENERIC |  | bakkie driving a foggy road — foggy-drive stock |
| 304 | `09da29bb55ff` | `fog/week_4/day/3` | day | KEEP-BEAUTIFUL |  | tablecloth fog cascading over the ridge — striking SA weather |
| 305 | `7a304fe3b183` | `fog/week_4/day/4` | day | KILL-GENERIC |  | blank signpost in thick fog — minimal, no hook |
| 306 | `9e48bf577e26` | `fog/week_4/day/5` | day | KILL-GENERIC |  | misty winelands vineyard with god-rays — landscape stock |
| 307 | `5e43ce62393b` | `fog/week_4/day/6` | day | KILL-GENERIC |  | foggy street with a pale sun disc — atmospheric stock |
| 308 | `406f496bae17` | `fog/week_4/day/7` | day | KEEP-BEAUTIFUL |  | grape pickers in the misty vineyard at dawn — authentic, atmospheric, diverse |
| 309 | `1dc5c3cfe096` | `fog/week_{1,2,3,4}/dawn/1` | dawn | KILL-GENERIC |  | cows in a frosty misty field, one staring — quiet animal/landscape |
| 310 | `3dc7ae899f20` | `fog/week_{1,2,3,4}/dawn/2` | dawn | KILL-GENERIC |  | misty wetland at dawn — landscape stock |
| 311 | `f0a699d8f8db` | `fog/week_{1,2,3,4}/dawn/3` | dawn | KILL-GENERIC |  | foggy street with glowing lamps — atmospheric stock |
| 312 | `6eba2bcf3423` | `fog/week_{1,2,3,4}/dawn/4` | dawn | KILL-GENERIC |  | window light beaming through fog — moody, no subject |
| 313 | `2345921dd065` | `fog/week_{1,2,3,4}/dawn/5` | dawn | KILL-GENERIC |  | schoolboy waiting at a foggy roadside — quiet, bleak-ish |
| 314 | `b6ad8106ce57` | `fog/week_{1,2,3,4}/dawn/6` | dawn | KILL-GENERIC |  | misty lake at dawn — landscape stock |
| 315 | `88f884c93f2a` | `fog/week_{1,2,3,4}/dawn/7` | dawn | KILL-GENERIC |  | woman trail-running a misty forest — fitness + landscape |
| 316 | `fe5774dcc921` | `fog/week_{1,2,3,4}/dusk/1` | dusk | KILL-GENERIC |  | car headlights on a misty road at dusk — foggy-drive stock |
| 317 | `b43278152ad0` | `fog/week_{1,2,3,4}/dusk/2` | dusk | KILL-GENERIC |  | misty dirt road at dusk — atmospheric stock |
| 318 | `7caffe81fca4` | `fog/week_{1,2,3,4}/dusk/3` | dusk | KILL-GENERIC |  | sea fog rolling over the coastal town — scenic, no subject |
| 319 | `28a6f313803c` | `fog/week_{1,2,3,4}/dusk/4` | dusk | KILL-GENERIC |  | foggy street with a red tail-light glow — atmospheric stock |
| 320 | `26260612a6f2` | `fog/week_{1,2,3,4}/dusk/5` | dusk | KILL-GENERIC |  | woman walking the dog under foggy lamps — foggy-walk stock |
| 321 | `a67edaa1585b` | `fog/week_{1,2,3,4}/dusk/6` | dusk | KILL-GENERIC |  | selfie with no view in the fog — redundant fogged-view joke see 290 |
| 322 | `751d5c5528b8` | `fog/week_{1,2,3,4}/dusk/7` | dusk | KILL-GENERIC |  | misty Drakensberg peaks at dusk — scenic landscape |
| 323 | `96c9a21e7319` | `fog/week_{1,2,3,4}/night/1` | night | KILL-GENERIC |  | Cape Town lights under low fog — cityscape stock |
| 324 | `a061315cfbe7` | `fog/week_{1,2,3,4}/night/2` | night | KILL-GENERIC |  | foggy street lamp at night — atmospheric stock |
| 325 | `7ab64822580e` | `fog/week_{1,2,3,4}/night/3` | night | KILL-GENERIC |  | insects at the stoep light in the fog — atmospheric, redundant see 69 |
| 326 | `bba8e41bc375` | `fog/week_{1,2,3,4}/night/4` | night | KILL-GENERIC |  | man walking a foggy street at night, warm light — atmospheric stock |
| 327 | `216875afead7` | `fog/week_{1,2,3,4}/night/5` | night | KEEP-BEAUTIFUL |  | robot glowing through thick fog, colour on the wet road — striking SA street |
| 328 | `8d83f59505ba` | `fog/week_{1,2,3,4}/night/6` | night | KILL-GENERIC |  | couple watching the foggy night from the window — cozy lifestyle |
| 329 | `a94870b02afa` | `fog/week_{1,2,3,4}/night/7` | night | KILL-GENERIC |  | lone figure under a foggy streetlamp — cinematic but generic-moody |

### heat  ·  70 unique  (F 26 · B 11 · BL 0 · KILL 33)

| idx | hash | slots served | slot | verdict | flags | reason |
|--:|---|---|---|---|---|---|
| 330 | `50dba1a3f6c0` | `heat/week_1/day/1` | day | KEEP-FUNNY |  | head in the chest freezer, hadeda in the garden — SA heat gag |
| 331 | `052e2de0e3a6` | `heat/week_1/day/2` | day | KEEP-FUNNY |  | dramatic relief at the aircon, diverse trio |
| 332 | `894c8492a7d3` | `heat/week_1/day/3` | day | KEEP-BEAUTIFUL | `text` | lively Durban-style promenade, ice-cream cart, diverse crowd |
| 333 | `b1ae5ed3f1e4` | `heat/week_1/day/4` | day | KEEP-FUNNY |  | frying an egg on the car bonnet, kids watching |
| 334 | `94bc39da15a9` | `heat/week_1/day/5` | day | KEEP-FUNNY |  | melting ice-cream cone dripping on the promenade |
| 335 | `50daf0380471` | `heat/week_1/day/6` | day | KEEP-FUNNY |  | slops melted onto hot tarmac |
| 336 | `5020ea98a21b` | `heat/week_1/day/7` | day | KEEP-FUNNY |  | Karoo stoep heat — one collapsed under the table |
| 337 | `64d5f64a9ce2` | `heat/week_2/day/1` | day | KEEP-FUNNY |  | recoiling from a scorching car door, bougainvillea |
| 338 | `09982a0a196b` | `heat/week_2/day/2` | day | KEEP-FUNNY | `text` | office HEATWAVE SURVIVAL ZONE, two women toughing it out |
| 339 | `f66e134e3542` | `heat/week_2/day/3` | day | KEEP-BEAUTIFUL |  | black family in an inflatable pool, cold drinks — warm summer joy |
| 340 | `4499d728ba19` | `heat/week_2/day/4` | day | KEEP-FUNNY |  | bulldog flopped panting on cool tiles |
| 341 | `bc3c55df9e9a` | `heat/week_2/day/5` | day | KEEP-FUNNY | `text` | dashboard reads 38C on the open Karoo road |
| 342 | `606bd69dda8d` | `heat/week_2/day/6` | day | KILL-GENERIC |  | generic office pair at a desk, weak heat signal |
| 343 | `dbadc260a0fb` | `heat/week_2/day/7` | day | KEEP-FUNNY |  | chocolate bar melted across the car dashboard |
| 344 | `af6a66e2446f` | `heat/week_3/day/1` | day | KEEP-FUNNY |  | golden retriever commandeers the kids paddling pool |
| 345 | `03ad07a882ce` | `heat/week_3/day/2` | day | KILL-GENERIC |  | sprinkler on a dry lawn — stock |
| 346 | `2e3073b45d31` | `heat/week_3/day/3` | day | KILL-GENERIC |  | watermelon cut on a patio — interchangeable summer stock |
| 347 | `275d92576ef5` | `heat/week_3/day/4` | day | KILL-GENERIC |  | wilted flower in cracked drought earth — bleak, off register |
| 348 | `8d70df96c3e2` | `heat/week_3/day/5` | day | KEEP-FUNNY |  | African grey parrot claims the pedestal fan, Karoo |
| 349 | `36ba2e709a95` | `heat/week_3/day/6` | day | KILL-GENERIC |  | woman with a cold bottle at a window — plain indoor stock |
| 350 | `df1649bb4b6f` | `heat/week_3/day/7` | day | KEEP-BEAUTIFUL | `text` | two workers on a water break against the bakkie — authentic SA heat |
| 351 | `11f962f33aae` | `heat/week_4/day/1` | day | KILL-GENERIC |  | towel over head at an informal market — off aspirational register |
| 352 | `6e3d6f6f4343` | `heat/week_4/day/2` | day | KEEP-FUNNY |  | tabby splooting in a sunbeam on cool tiles |
| 353 | `255a783ecb51` | `heat/week_4/day/3` | day | KEEP-FUNNY |  | melted treat on a car roof in the parking lot |
| 354 | `0cf7886d0369` | `heat/week_4/day/4` | day | KILL-GENERIC |  | man reading on a mall bench — generic |
| 355 | `6f3b27b384f3` | `heat/week_4/day/5` | day | KEEP-FUNNY |  | office worker dramatic hot-car-door reaction, diverse |
| 356 | `d34fb4cca7ab` | `heat/week_4/day/6` | day | KEEP-FUNNY |  | dog flat-out under the ceiling fan, modern home |
| 357 | `ff8aa6503074` | `heat/week_4/day/7` | day | KEEP-BEAUTIFUL |  | kids through the sprinkler, parents on the stoep — summer joy, diverse |
| 358 | `f210863976ea` | `heat/week_{1,3}/dawn/1` | dawn | KILL-GENERIC |  | man walking a suburban street at dusk — generic |
| 359 | `aec07bc8084d` | `heat/week_{1,3}/dawn/2` | dawn | KILL-GENERIC |  | lone acacia at golden hour — striking but the definitive Africa cliche |
| 360 | `844ccaf4333e` | `heat/week_{1,3}/dawn/3` | dawn | KEEP-FUNNY |  | fried egg on the car at sunset — heat gag |
| 361 | `3d5ba6fd7a81` | `heat/week_{1,3}/dawn/4` | dawn | KEEP-FUNNY |  | corgi floating in the inflatable pool at golden hour |
| 362 | `a0b8cf3a92e1` | `heat/week_{1,3}/dawn/5` | dawn | KILL-GENERIC |  | golden-hour doorway stretch — lifestyle stock |
| 363 | `9e79cedfe3b2` | `heat/week_{1,3}/dawn/6` | dawn | KEEP-BEAUTIFUL |  | tabby asleep on a sunlit ledge — warm domestic charm |
| 364 | `dabb2e34edf5` | `heat/week_{1,3}/dawn/7` | dawn | KILL-GENERIC |  | wheeling the Weber at golden hour — braai lifestyle stock |
| 365 | `f209487ee5a5` | `heat/week_{2,4}/dawn/1` | dawn | KILL-GENERIC |  | grandparents potting plants at golden hour — gardening lifestyle stock |
| 366 | `9e882423f92a` | `heat/week_{2,4}/dawn/2` | dawn | KILL-GENERIC |  | heat-exhausted jogger catching breath — fitness stock |
| 367 | `c19d58094ef4` | `heat/week_{2,4}/dawn/3` | dawn | KILL-GENERIC |  | sprinkler on a winelands garden at golden hour — pleasant stock |
| 368 | `60687e87f9f5` | `heat/week_{2,4}/dawn/4` | dawn | KILL-GENERIC |  | couple with coffee on the steps at golden hour — lifestyle stock |
| 369 | `69848b681db9` | `heat/week_{2,4}/dawn/5` | dawn | KILL-GENERIC |  | dog asleep against a Karoo wall at dusk — quiet atmospheric, no hook |
| 370 | `29a003a53e50` | `heat/week_{2,4}/dawn/6` | dawn | KILL-GENERIC |  | man watering the garden in the evening — everyday stock |
| 371 | `47a865772c1b` | `heat/week_{2,4}/dawn/7` | dawn | KILL-GENERIC |  | Karoo windmill and farmstead at golden hour — rural stock |
| 372 | `42cf1d5e1571` | `heat/week_{1,3}/dusk/1` | dusk | KEEP-BEAUTIFUL |  | dad hosing the laughing kids at golden hour — genuine family joy, diverse |
| 373 | `4ad5c9f93424` | `heat/week_{1,3}/dusk/2` | dusk | KILL-GENERIC |  | dramatic Cape sea sunset — striking but a generic sunset |
| 374 | `51c94d3fb63e` | `heat/week_{1,3}/dusk/3` | dusk | KILL-GENERIC |  | sunflower on a Karoo stoep at sunset — atmospheric stock |
| 375 | `8008693b97ee` | `heat/week_{1,3}/dusk/4` | dusk | KEEP-FUNNY |  | chihuahua sitting in the inflatable pool at dusk |
| 376 | `4222e1f98d3e` | `heat/week_{1,3}/dusk/5` | dusk | KILL-GENERIC |  | couple watering over the wall at dusk — lifestyle stock |
| 377 | `3a9d402c94e9` | `heat/week_{1,3}/dusk/6` | dusk | KILL-GENERIC |  | suburban street sprinklers at sunset — landscape stock |
| 378 | `4fb19238ba2c` | `heat/week_{1,3}/dusk/7` | dusk | KEEP-BEAUTIFUL |  | poolside braai party at golden hour — vibrant, diverse social scene |
| 379 | `1ab26f42c6ec` | `heat/week_{2,4}/dusk/1` | dusk | KILL-GENERIC |  | outdoor family dinner at dusk — warm but lifestyle stock |
| 380 | `ac42e2e4e4b5` | `heat/week_{2,4}/dusk/2` | dusk | KILL-GENERIC |  | man face-to-sky in the garden at golden hour — moody lifestyle stock |
| 381 | `acf34b853c7a` | `heat/week_{2,4}/dusk/3` | dusk | KILL-GENERIC |  | empty Weber by the pool at dusk — braai-object stock |
| 382 | `e9b15395c002` | `heat/week_{2,4}/dusk/4` | dusk | KEEP-BEAUTIFUL |  | couple braaing at golden hour, platter and fire — warm, diverse |
| 383 | `8295bc9c232e` | `heat/week_{2,4}/dusk/5` | dusk | KILL-GENERIC |  | pool reflecting the sunset — atmospheric stock |
| 384 | `d78daad1b59e` | `heat/week_{2,4}/dusk/6` | dusk | KEEP-FUNNY |  | dramatic heat-collapse starfish on the living-room floor |
| 385 | `45d05965812e` | `heat/week_{2,4}/dusk/7` | dusk | KILL-GENERIC |  | corporate group leaving the office at dusk — generic |
| 386 | `6913f03ac2c5` | `heat/week_{1,3}/night/1` | night | KEEP-FUNNY |  | cooling her feet in a basin on the balcony, city night — heat hack |
| 387 | `09999b1e33e4` | `heat/week_{1,3}/night/2` | night | KEEP-BEAUTIFUL |  | family sleeping outside under the Milky Way — striking SA-heat story |
| 388 | `a1b6e759072d` | `heat/week_{1,3}/night/3` | night | KEEP-FUNNY |  | Labrador on strike, flopped mid-walk in the heat |
| 389 | `1c3fdb556279` | `heat/week_{1,3}/night/4` | night | KILL-GENERIC |  | pedestal fan on the bed at 2am — bedroom stock |
| 390 | `57360fef3c7c` | `heat/week_{1,3}/night/5` | night | KILL-GENERIC |  | empty bed, misty window at night — atmospheric, no subject |
| 391 | `b0878078bbd5` | `heat/week_{1,3}/night/6` | night | KEEP-FUNNY |  | boerboel flat-out on cool tiles at night |
| 392 | `fa5a16220d17` | `heat/week_{1,3}/night/7` | night | KILL-GENERIC |  | kids on the floor with a fan at night — flat, no hook |
| 393 | `d83735e6e6da` | `heat/week_{2,4}/night/1` | night | KILL-GENERIC |  | ice water and ice tray bedside still-life — no subject |
| 394 | `3b370a59f9fd` | `heat/week_{2,4}/night/2` | night | KEEP-BEAUTIFUL |  | night pool party with beers and fairy lights — vibrant, diverse |
| 395 | `f9b4bb91dce1` | `heat/week_{2,4}/night/3` | night | KEEP-BEAUTIFUL |  | family on loungers under the stars — evocative heat-night |
| 396 | `6a945962127d` | `heat/week_{2,4}/night/4` | night | KILL-GENERIC |  | empty bed, moonlit windows — atmospheric, no subject |
| 397 | `f6f6b1646bae` | `heat/week_{2,4}/night/5` | night | KILL-GENERIC |  | man with a fan on the bed at night — bedroom stock |
| 398 | `99418a176106` | `heat/week_{2,4}/night/6` | night | KEEP-FUNNY |  | Labrador asleep on the cool bathroom floor at night |
| 399 | `6e508ccb58cc` | `heat/week_{2,4}/night/7` | night | KEEP-FUNNY |  | cooling off at the open fridge at night — heat move |

### rain  ·  70 unique  (F 7 · B 11 · BL 0 · KILL 52)

| idx | hash | slots served | slot | verdict | flags | reason |
|--:|---|---|---|---|---|---|
| 400 | `ea93fbda5aae` | `rain/week_1/day/1` | day | KEEP-FUNNY |  | mom + kids under a blown-out umbrella, splashing — SA rain gag, diverse |
| 401 | `5e5a79fbe257` | `rain/week_1/day/2` | day | KEEP-FUNNY |  | water-skiing down a flooded street — absurd SA rain gag |
| 402 | `868fd901ef14` | `rain/week_1/day/3` | day | KEEP-BEAUTIFUL |  | kids in raincoats jumping puddles — genuine joy, diverse |
| 403 | `621141036472` | `rain/week_1/day/4` | day | KEEP-BEAUTIFUL |  | family in gumboots through the flooded yard — warm, diverse |
| 404 | `23386fee9dfe` | `rain/week_1/day/5` | day | KEEP-BEAUTIFUL |  | ginger cat at the rainy window by the fire — cozy rainy-day mood |
| 405 | `ce00f047f64a` | `rain/week_1/day/6` | day | KILL-GENERIC |  | mom + son walking in the rain — rain-walk lifestyle |
| 406 | `08bf6772e3bd` | `rain/week_1/day/7` | day | KILL-GENERIC |  | woman journaling by a rainy window — cozy lifestyle stock |
| 407 | `2b85cbdecded` | `rain/week_2/day/1` | day | KILL-GENERIC |  | construction worker on a shovel in the pouring rain — documentary, bleak |
| 408 | `bf03207f99af` | `rain/week_2/day/2` | day | KILL-GENERIC |  | couple at a cafe watching the rain — cafe lifestyle stock |
| 409 | `94a717014510` | `rain/week_2/day/3` | day | KILL-GENERIC |  | warm kitchen window cooking in the rain — cozy, quiet |
| 410 | `9571f594a30c` | `rain/week_2/day/4` | day | KEEP-FUNNY |  | grumpy soggy cat sheltering under a chair in the flood |
| 411 | `b3f54834113f` | `rain/week_2/day/5` | day | KILL-GENERIC |  | car ploughing through a flooded street — flood-drive, generic |
| 412 | `486fd16a9238` | `rain/week_2/day/6` | day | KILL-GENERIC |  | woman driving tense in heavy rain — rain-drive stock |
| 413 | `40e78993fd5e` | `rain/week_2/day/7` | day | KILL-GENERIC |  | water gushing off a roof — rain-detail, no subject |
| 414 | `652cc55ceb6e` | `rain/week_3/day/1` | day | KEEP-BEAUTIFUL |  | teacher + schoolkids at the flooded playground — authentic SA, diverse |
| 415 | `30981a9f408a` | `rain/week_3/day/2` | day | KILL-GENERIC |  | rain sheeting off a corrugated roof — rain-detail, no subject |
| 416 | `86af34a1b074` | `rain/week_3/day/3` | day | KEEP-FUNNY |  | woman dancing in the rain with a newspaper brolly — joyful, characterful |
| 417 | `ed0f66318b6a` | `rain/week_3/day/4` | day | KILL-GENERIC |  | man eating alone at a wet cafe table — quiet, bleak |
| 418 | `d271f4c157d6` | `rain/week_3/day/5` | day | KILL-GENERIC |  | man pulling his hood up in the rain — quiet bundle |
| 419 | `24ff2c135f71` | `rain/week_3/day/6` | day | KEEP-BEAUTIFUL |  | couple drawing on the misted rainy window — warm, diverse |
| 420 | `f59b6f76a2cd` | `rain/week_3/day/7` | day | KEEP-FUNNY |  | two businessmen squeezed under one tiny umbrella — relatable, diverse |
| 421 | `2160c7cae6bd` | `rain/week_4/day/1` | day | KILL-GENERIC |  | teens sheltering under an eave — quiet, no hook |
| 422 | `f0aee4573488` | `rain/week_4/day/2` | day | KILL-GENERIC |  | muddy boots + jersey on the doormat — still-life detail |
| 423 | `0bf65b8d4c32` | `rain/week_4/day/3` | day | KILL-GENERIC |  | overflowing plant pot on the stoep — rain-detail |
| 424 | `241ddedb3b33` | `rain/week_4/day/4` | day | KILL-GENERIC |  | gumboots + muddy footprints by the door — rain-detail |
| 425 | `2ff259081d36` | `rain/week_4/day/5` | day | KILL-GENERIC |  | modern house + flooded yard after rain — property stock |
| 426 | `f187f10a5a46` | `rain/week_4/day/6` | day | KILL-GENERIC |  | farmer inspecting the runoff furrow — documentary, quiet |
| 427 | `7c08db3e9aee` | `rain/week_4/day/7` | day | KILL-GENERIC |  | car splashing a wave through the flood — flood-drive, generic |
| 428 | `280201230ad9` | `rain/week_{1,3}/dawn/1` | dawn | KILL-GENERIC |  | rainy city street reflections at dawn — wet-city stock |
| 429 | `afa49b48781a` | `rain/week_{1,3}/dawn/2` | dawn | KILL-GENERIC |  | kids under an umbrella at the bus stop — quiet, no hook |
| 430 | `88ab478a71b1` | `rain/week_{1,3}/dawn/3` | dawn | KILL-GENERIC |  | driving through a rainy dorp — rain-drive stock |
| 431 | `071d9824c25c` | `rain/week_{1,3}/dawn/4` | dawn | KEEP-BEAUTIFUL |  | mom handing a rainbow umbrella to her daughter before school — warm, diverse |
| 432 | `ea74bd658082` | `rain/week_{1,3}/dawn/5` | dawn | KILL-GENERIC |  | rain off a roof at golden hour — rain-detail + landscape |
| 433 | `faa43734048c` | `rain/week_{1,3}/dawn/6` | dawn | KILL-GENERIC |  | man taking off wet shoes at the door — quiet lifestyle |
| 434 | `9ef8811a702c` | `rain/week_{1,3}/dawn/7` | dawn | KILL-GENERIC |  | mug on a windowsill, rain outside — cozy still-life |
| 435 | `c7fbf962cd9a` | `rain/week_{2,4}/dawn/1` | dawn | KEEP-BEAUTIFUL |  | gran + grandchild baking on a rainy day — warm, diverse |
| 436 | `8708b00dd1de` | `rain/week_{2,4}/dawn/2` | dawn | KILL-GENERIC |  | wet suburban street at dawn after rain — atmospheric stock |
| 437 | `bc29725946e0` | `rain/week_{2,4}/dawn/3` | dawn | KILL-GENERIC |  | pulling on gumboots in the doorway — quiet lifestyle |
| 438 | `84246ae6ca72` | `rain/week_{2,4}/dawn/4` | dawn | KILL-GENERIC |  | heart drawn in the rainy condensation — still-life, no subject |
| 439 | `ba83dee71ab2` | `rain/week_{2,4}/dawn/5` | dawn | KILL-GENERIC |  | man lying awake to the rain in bed — quiet, cozy |
| 440 | `00f8eb187236` | `rain/week_{2,4}/dawn/6` | dawn | KILL-GENERIC |  | gran + cat watching the rain — redundant cozy-window |
| 441 | `0f7ae344ee68` | `rain/week_{2,4}/dawn/7` | dawn | KILL-GENERIC |  | rain on the pool at dawn — landscape stock |
| 442 | `71648fc051b3` | `rain/week_{1,3}/dusk/1` | dusk | KEEP-FUNNY |  | drenched cyclist grimacing while a passenger laughs — schadenfreude, diverse |
| 443 | `531aa52feade` | `rain/week_{1,3}/dusk/2` | dusk | KEEP-BEAUTIFUL |  | umbrella down a rainy Bo-Kaap street, Lions Head — iconic, striking |
| 444 | `59e45106eb02` | `rain/week_{1,3}/dusk/3` | dusk | KEEP-BEAUTIFUL |  | fisherman in yellow oilskins off the rocks in the rain — atmospheric, authentic |
| 445 | `040da1a047f8` | `rain/week_{1,3}/dusk/4` | dusk | KILL-GENERIC |  | rainy cobbled CT street with a bookshop at night — atmospheric, no subject |
| 446 | `5e8246208843` | `rain/week_{1,3}/dusk/5` | dusk | KILL-GENERIC |  | balcony over a rainy Joburg skyline — atmospheric stock |
| 447 | `cd6d56537241` | `rain/week_{1,3}/dusk/6` | dusk | KILL-GENERIC |  | rainy jacaranda street at dusk — scenic street stock |
| 448 | `081406921dd3` | `rain/week_{1,3}/dusk/7` | dusk | KILL-GENERIC |  | couple tasting soup in the kitchen — redundant cozy-cooking see 193 |
| 449 | `477af139ada5` | `rain/week_{2,4}/dusk/1` | dusk | KILL-GENERIC |  | man with coffee under the gutter overflow — mild, quiet |
| 450 | `b7b49c46c477` | `rain/week_{2,4}/dusk/2` | dusk | KEEP-BEAUTIFUL |  | family drying washing on the bar heater indoors — relatable SA rainy-day, diverse |
| 451 | `c892be6f44d7` | `rain/week_{2,4}/dusk/3` | dusk | KILL-GENERIC |  | rainy highway traffic jam at dusk — traffic stock |
| 452 | `0b5d114ee7fd` | `rain/week_{2,4}/dusk/4` | dusk | KILL-GENERIC |  | man taking off a wet jacket at the door — quiet lifestyle |
| 453 | `b80b5c1e403d` | `rain/week_{2,4}/dusk/5` | dusk | KILL-GENERIC |  | woman watching the rain over the pool — cozy window stock |
| 454 | `817d8e1e843e` | `rain/week_{2,4}/dusk/6` | dusk | KILL-GENERIC |  | woman waiting pensive in the car in the rain — quiet |
| 455 | `16f0495e47c7` | `rain/week_{2,4}/dusk/7` | dusk | KILL-GENERIC |  | muddy boots + paw prints in the doorway — still-life detail |
| 456 | `106d28a0128d` | `rain/week_{1,3}/night/1` | night | KILL-GENERIC |  | rainy vineyard at night, distant farmhouse — dark landscape stock |
| 457 | `87f28e66ed49` | `rain/week_{1,3}/night/2` | night | KILL-GENERIC |  | bulldog reluctant at the rainy door — quiet, mild |
| 458 | `840790135cf5` | `rain/week_{1,3}/night/3` | night | KEEP-BEAUTIFUL | `text` | neon-lit rainy CT street, Table Mountain — moody, characterful |
| 459 | `3dd43c4e9b0b` | `rain/week_{1,3}/night/4` | night | KILL-GENERIC |  | rainy suburban street with a lamp at night — atmospheric stock |
| 460 | `e6a67f800f6b` | `rain/week_{1,3}/night/5` | night | KILL-GENERIC |  | glowing pool in the rain at night — atmospheric stock |
| 461 | `43476ac3bd93` | `rain/week_{1,3}/night/6` | night | KEEP-FUNNY |  | family towelling the soggy dog after the rain — warm, diverse, relatable |
| 462 | `8bd09c0f2a42` | `rain/week_{1,3}/night/7` | night | KILL-GENERIC |  | muddy takkies drying by the bar heater — still-life, redundant |
| 463 | `77a1cf967f14` | `rain/week_{2,4}/night/1` | night | KILL-GENERIC |  | man watching rainy city lights from a window — cozy-window stock |
| 464 | `32b3a4d72d1b` | `rain/week_{2,4}/night/2` | night | KILL-GENERIC |  | backyard with fairy lights in the rain — atmospheric stock |
| 465 | `e66365b65f12` | `rain/week_{2,4}/night/3` | night | KILL-GENERIC |  | empty bedroom, rainy window at night — no subject |
| 466 | `a5ea2c68aebc` | `rain/week_{2,4}/night/4` | night | KILL-GENERIC |  | man driving at night in the rain — rain-drive stock |
| 467 | `0c813b729c06` | `rain/week_{2,4}/night/5` | night | KILL-GENERIC |  | gran reading by a lamp, rain outside — cozy quiet |
| 468 | `f449894c7ba4` | `rain/week_{2,4}/night/6` | night | KILL-GENERIC |  | dead umbrella in a flooded gutter — still-life, no subject |
| 469 | `9e3cc80791db` | `rain/week_{2,4}/night/7` | night | KILL-GENERIC |  | coaxing the reluctant dog out into the rain — quiet, redundant |

### storm  ·  69 unique  (F 17 · B 18 · BL 0 · KILL 34)

| idx | hash | slots served | slot | verdict | flags | reason |
|--:|---|---|---|---|---|---|
| 470 | `4d441898afd6` | `storm/week_1/day/1` | day | KEEP-FUNNY |  | Woman racing to rescue potted flowers before the storm while a man watches bemused from the window — a warm suburban gag |
| 471 | `c8cfd867472d` | `storm/week_1/day/2` | day | KEEP-BEAUTIFUL |  | Diverse group on a terrace watching a lightning bolt strike over the Drakensberg — dramatic and social |
| 472 | `b3e1239dd81c` | `storm/week_1/day/3` | day | KEEP-BEAUTIFUL |  | Diverse row of workers and shoppers sheltering under a shop awning watching the downpour — authentic SA slice-of-life |
| 473 | `e3f7fefc2b23` | `storm/week_1/day/4` | day | KEEP-BEAUTIFUL |  | Lone surfer silhouette walking the beach under a huge brooding storm cloud — dramatic sky (leans moody-stock) |
| 474 | `da3c8d038046` | `storm/week_1/day/5` | day | KEEP-FUNNY |  | Hooded figure fighting down a debris-strewn street with an inside-out broken umbrella — the classic storm-struggle gag |
| 475 | `0c3c0036731b` | `storm/week_1/day/6` | day | KEEP-BEAUTIFUL |  | Woman at a floor-to-ceiling window watching lightning over the night city skyline — elegant, striking |
| 476 | `c9317429553c` | `storm/week_1/day/7` | day | KEEP-BEAUTIFUL |  | Lightning striking behind a mountain with a warmly lit stone cottage in the foreground — atmospheric |
| 477 | `03357fb7b655` | `storm/week_2/day/1` | day | KEEP-FUNNY |  | Two car-guards in hi-vis laughing in a downpour, one holding a sign over his head as an umbrella — diverse, passes the meme bar |
| 478 | `0478b24f2624` | `storm/week_2/day/2` | day | KEEP-FUNNY |  | Two golfers carrying on across the fairway as lightning strikes behind them — the oblivious-golfer gag |
| 479 | `d09eebb882b5` | `storm/week_2/day/3` | day | KILL-GENERIC |  | Empty rugby stadium with lightning over the stand — moody but flat and peopleless, no hook despite the SA-sport nod |
| 480 | `8b186a0f5cb9` | `storm/week_2/day/4` | day | KILL-GENERIC |  | Storm-wrecked patio furniture and debris — aftermath wreckage, leans bleak against the positive-vibes rule |
| 481 | `72425df6ac89` | `storm/week_2/day/5` | day | KEEP-BEAUTIFUL |  | Platteland farmer shading his eyes in a corrugated-iron barn doorway as a dust storm and lightning roll in — strong SA atmosphere |
| 482 | `32e5db4cd2f6` | `storm/week_2/day/6` | day | KILL-GENERIC |  | Empty white-walled Cape Dutch street under storm cloud with a lone bird — atmospheric but generic moody-empty-street |
| 483 | `2581cee63f28` | `storm/week_2/day/7` | day | KEEP-BEAUTIFUL |  | Modern glass house with rain sheeting off the flat roof in a waterfall against the mountain — striking architectural rain |
| 484 | `818a6e89a5f5` | `storm/week_3/day/1` | day | KEEP-BEAUTIFUL |  | Man pulling a blue tarp over a bakkie load as the storm rolls in, farmhouse glowing behind — SA beat-the-storm narrative |
| 485 | `dac8823704af` | `storm/week_3/day/3` | day | KEEP-FUNNY |  | Storm-scared dog hiding under the dining table with lightning through the window — relatable pets-in-a-thunderstorm gag |
| 486 | `dda74f493d53` | `storm/week_3/day/4` | day | KILL-GENERIC | `motif-dog-hiding` | Dog hiding under a bed during lightning — near-identical motif to 485; keep one representative |
| 487 | `1c9e8b5c7561` | `storm/week_3/day/5` | day | KEEP-FUNNY |  | Cricket covers pulled over the pitch, kit bags abandoned on the outfield under storm cloud — the rain-stopped-play gag |
| 488 | `d7900b2a6fb3` | `storm/week_3/day/6` | day | KEEP-BEAUTIFUL |  | Enormous gold-lit anvil thundercloud towering over the suburb at sunset — genuinely spectacular cloud structure |
| 489 | `3bad3dfae37a` | `storm/week_3/day/7` | day | KEEP-FUNNY |  | Couple laughing with arms full of washing grabbed off the line as the storm hits — relatable rescue-the-laundry gag |
| 490 | `437731822d8c` | `storm/week_4/day/1` | day | KEEP-FUNNY |  | Diverse family dashing across a hail-covered lawn carrying the dog for cover, lightning behind — joyful scramble |
| 491 | `03ca73beb0b0` | `storm/week_4/day/2` | day | KILL-GENERIC |  | Dark empty Karoo veld with distant horizon lightning at dusk — atmospheric but a peopleless moody-landscape stock shot |
| 492 | `343e3dd6e618` | `storm/week_4/day/3` | day | KEEP-BEAUTIFUL | `motif-cozy-indoor` | Diverse family and kids with hands on the window watching lightning from a warm lounge — authentic domestic moment |
| 493 | `a9e2bd9787b5` | `storm/week_4/day/4` | day | KEEP-BEAUTIFUL |  | Lightning striking over Table Mountain seen across the bay from Blouberg with rough seas — iconic Cape Town image |
| 494 | `181d7c883563` | `storm/week_4/day/5` | day | KEEP-FUNNY |  | Man wrestling a patio umbrella in the rising wind as debris flies — relatable beat-the-storm comedy |
| 495 | `d5ba1f11fcce` | `storm/week_4/day/6` | day | KEEP-FUNNY |  | Young man filming the lightning on his phone from inside the car — the everyone-films-the-storm modern gag, diverse |
| 496 | `6b4857dd507d` | `storm/week_4/day/7` | day | KEEP-FUNNY | `motif-cozy-indoor` | Diverse family playing a board game at the table through the storm with a tea tray — warm make-the-best-of-it scene |
| 497 | `21cd4f12ac5c` | `storm/week_{1,3}/dawn/1` | dawn | KILL-GENERIC |  | Hail piled on a suburban driveway and lawn at dawn, car dusted — documentary-plain, the hail is the only hook |
| 498 | `82ab32f7e25c` | `storm/week_{1,3}/dawn/2` | dawn | KILL-GENERIC |  | Joburg highway packed with traffic under a purple storm sky at dawn — moody-urban stock, gridlock foreground |
| 499 | `03b8d3e5a890` | `storm/week_{1,3}/dawn/3 ; storm/week_3/day/2` | dawn | KILL-GENERIC |  | Lightning bolt over a plain modern-suburb street, wet road — dramatic bolt but interchangeable suburb backdrop |
| 500 | `f1f26ff1b48a` | `storm/week_{1,3}/dawn/4` | dawn | KILL-GENERIC | `motif-cozy-indoor` | Woman and small child at a lamp-lit window watching the wet dawn — warm but a motif-repeat of the window-watching keeper 492 |
| 501 | `9f22aeea34e2` | `storm/week_{1,3}/dawn/5` | dawn | KILL-GENERIC |  | Close-up of hail carpeting a garden bed by a stone house — pretty but pleasant-hail documentary, not striking enough |
| 502 | `bae39749cee2` | `storm/week_{1,3}/dawn/6` | dawn | KILL-GENERIC |  | Woman making coffee in a dark kitchen during a dawn storm — quiet domestic filler, no hook |
| 503 | `135baf75a010` | `storm/week_{1,3}/dawn/7` | dawn | KILL-GENERIC | `motif-dog-hiding` | Couple coaxing the scared dog out from under the bed — third dog-hiding variant; keep 485 as the representative |
| 504 | `52d00e2b22f6` | `storm/week_{2,4}/dawn/1` | dawn | KILL-GENERIC |  | Moody suburban house exterior at blue-hour with porch light and storm sky — peopleless generic-house-dawn |
| 505 | `8051f1c3947d` | `storm/week_{2,4}/dawn/2` | dawn | KILL-GENERIC |  | Runner in Nike gear hands-on-hips hesitating on a road under storm cloud — plain, the premise is too thin |
| 506 | `d25fb1153ed0` | `storm/week_{2,4}/dawn/3` | dawn | KILL-GENERIC | `motif-coffee-watching` | Woman in a gown with coffee on the porch watching the pink stormy dawn — pleasant but quiet, part of the coffee-watching cluster |
| 507 | `520137a1119a` | `storm/week_{2,4}/dawn/4` | dawn | KILL-GENERIC | `motif-coffee-watching` | Woman with coffee at the kitchen window, washing on the line under storm sky — diverse but a quiet coffee-watching repeat; subtle laundry gag |
| 508 | `94277458fbb9` | `storm/week_{2,4}/dawn/5` | dawn | KILL-GENERIC |  | Luxe modern house with infinity pool in the rain — pretty but peopleless aspirational-stock, no hook |
| 509 | `21d3c5b39746` | `storm/week_{2,4}/dawn/6` | dawn | KEEP-BEAUTIFUL |  | Man lighting a hurricane lantern in a farmhouse kitchen during a power cut — warm, characterful, culturally resonant, diverse |
| 510 | `2d0aa325c3b6` | `storm/week_{2,4}/dawn/7` | dawn | KILL-GENERIC |  | Flooded suburban street with a stop sign at dawn — flood documentary, leans mild-disaster and peopleless |
| 511 | `449ac51b76f2` | `storm/week_{1,3}/dusk/1` | dusk | KEEP-FUNNY |  | Diverse group piled out of the car filming a huge purple lightning bolt over the winelands mountain — social gag plus spectacular bolt |
| 512 | `f9af47cda240` | `storm/week_{1,3}/dusk/2` | dusk | KEEP-BEAUTIFUL |  | Two farmers loading hay onto a bakkie at dusk under the Drakensberg and golden storm light — atmospheric beat-the-storm narrative |
| 513 | `012477e282cc` | `storm/week_{1,3}/dusk/3` | dusk | KEEP-BEAUTIFUL |  | Woman on a balcony watching a dramatic sunset-storm over the city with lightning — genuinely striking urban sky |
| 514 | `05a3ab4a3961` | `storm/week_{1,3}/dusk/4` | dusk | KILL-GENERIC | `motif-suburb-lightning` | Lightning over a plain modern-suburb street at dusk — interchangeable with the other suburb-lightning frames |
| 515 | `cb8642ad87a0` | `storm/week_{1,3}/dusk/5` | dusk | KILL-GENERIC | `motif-coastal-lightning` | Double lightning bolt over a generic rocky coast at dusk — dramatic but landmark-less and redundant with the iconic Table Mountain frame 493 |
| 516 | `6a42e8e1caa1` | `storm/week_{1,3}/dusk/6` | dusk | KILL-GENERIC | `motif-coffee-watching` | Man with coffee at a glass wall watching the flooded street at dusk — quiet coffee/window-watching filler |
| 517 | `572a51d30dc5` | `storm/week_{1,3}/dusk/7` | dusk | KEEP-FUNNY |  | Metal bucket catching a roof leak in a dim hallway with a towel down — the storm-found-the-leak gag reads instantly |
| 518 | `025ed3cabe1b` | `storm/week_{2,4}/dusk/1` | dusk | KILL-GENERIC |  | Two men inspecting hail dents on a car bonnet in the dark — relatable but damage-focused and visually dull |
| 519 | `ce1b9b63ee46` | `storm/week_{2,4}/dusk/2` | dusk | KILL-GENERIC |  | Diverse group socialising by the infinity pool under a dusk storm sky — pleasant aspirational-social stock, no hook |
| 520 | `fb36740a2ba1` | `storm/week_{2,4}/dusk/3` | dusk | KILL-GENERIC | `motif-cozy-indoor` | Diverse extended family in a warm lamp-lit lounge with tea during the storm — strong casting but the cozy-indoor cluster is over-supplied (Al may swap this in for 496) |
| 521 | `8278f1fd2e1e` | `storm/week_{2,4}/dusk/4` | dusk | KILL-GENERIC |  | Flooded street at dusk with red-and-blue emergency lights reflecting — flood-disaster documentary, negative register |
| 522 | `1bf137ccfaad` | `storm/week_{2,4}/dusk/5` | dusk | KEEP-BEAUTIFUL | `motif-filming-lightning` | Young man on a balcony photographing a massive lightning bolt over the city skyline — striking clean silhouette, diverse |
| 523 | `9efe1fe7c742` | `storm/week_{2,4}/dusk/6` | dusk | KEEP-FUNNY |  | Diverse family at a candle- and phone-torch-lit dinner during a power cut as the storm rages — the SA load-shedding-dinner gag |
| 524 | `11e7f61188b1` | `storm/week_{2,4}/dusk/7` | dusk | KILL-GENERIC |  | Man standing by his bakkie surveying the hail on the ground at dusk — hail-aftermath filler, visually flat |
| 525 | `458c5fb3edaa` | `storm/week_{1,3}/night/1` | night | KEEP-BEAUTIFUL |  | Lightning bolt over a wet Cape dorp street at night, colourful cottages and a leading-line reflection to the mountain — striking with village character |
| 526 | `dbe0f1cc78b4` | `storm/week_{1,3}/night/2` | night | KEEP-FUNNY |  | Woman laughing as she yanks the washing off the line while her kids keep swimming and the storm rolls in — diverse, chaotic gag |
| 527 | `64cc93ed0856` | `storm/week_{1,3}/night/3` | night | KEEP-FUNNY |  | Man dashing barefoot through a flooded petrol station holding a pizza box over his head as a shield — relatable rain-dash gag, diverse |
| 528 | `e2f743112d09` | `storm/week_{1,3}/night/4` | night | KEEP-BEAUTIFUL |  | Spectacular lightning bolt over a coastal city at night with the lights twinkling below — genuinely stunning, SA-iconic |
| 529 | `076063a92503` | `storm/week_{1,3}/night/5` | night | KILL-GENERIC | `motif-pets-storm` | Person asleep with a pet on the bed, lightning through the window — quiet dim bedroom, part of the pets-in-a-storm cluster |
| 530 | `bb05a9d0602a` | `storm/week_{1,3}/night/6` | night | KILL-GENERIC | `motif-veld-lightning` | Wide dark Karoo veld with distant horizon lightning at night — peopleless moody-veld duplicate of 491 |
| 531 | `a7e3f5461ad2` | `storm/week_{1,3}/night/7` | night | KILL-GENERIC | `motif-filming-lightning` | Man filming the lightning on his phone through the window at night — the fourth filming-the-lightning frame; 522 is the keeper |
| 532 | `bb0451e10635` | `storm/week_{2,4}/night/1` | night | KILL-GENERIC | `motif-window-watching` | Boy wrapped in a towel at the window watching lightning over the city — sweet but a window-watching repeat; 492 is the keeper |
| 533 | `1a400ad1f8df` | `storm/week_{2,4}/night/2` | night | KILL-GENERIC | `motif-window-watching` | Diverse family in pyjamas at the window watching lightning over the city — well-cast but the window-watching cluster is over-supplied; 492 is the keeper |
| 534 | `ae5504efde4a` | `storm/week_{2,4}/night/3` | night | KILL-GENERIC |  | Dark house exterior with distant lightning over the mountain at night — peopleless generic-night-house |
| 535 | `0bf9ed8370dd` | `storm/week_{2,4}/night/4` | night | KEEP-BEAUTIFUL |  | Hurricane lantern glowing on a windowsill with a big lightning bolt over the city beyond — striking warm/cool contrast, load-shedding resonance |
| 536 | `2dc9d10318b7` | `storm/week_{2,4}/night/5` | night | KEEP-FUNNY | `motif-leak-bucket` | Couple laughing as they position a bucket to catch a roof leak over the bed — the human version of the leaky-roof gag |
| 537 | `4fd54792e3d6` | `storm/week_{2,4}/night/6` | night | KILL-GENERIC | `motif-candlelit-dinner` | Diverse family at a quiet candle-lit dinner during a power cut — motif-repeat of the stronger load-shedding-dinner 523 |
| 538 | `a4a1f87bd396` | `storm/week_{2,4}/night/7` | night | KILL-GENERIC | `motif-berg-cottage-lightning` | Lightning over the Drakensberg amphitheatre with a warm stone cottage — near-duplicate of 476 (538 may be the stronger; Al to pick one) |

### wind  ·  70 unique  (F 31 · B 3 · BL 0 · KILL 36)

| idx | hash | slots served | slot | verdict | flags | reason |
|--:|---|---|---|---|---|---|
| 539 | `552c5c4309ca` | `wind/week_1/day/1` | day | KEEP-FUNNY |  | Man sprinting across his garden chasing a wind-blown bag as the Southeaster rips through, mountain behind — Cape-wind gag |
| 540 | `90d4071b72c6` | `wind/week_1/day/2` | day | KEEP-BEAUTIFUL |  | Kitesurfer carving the chop off Blouberg with Table Mountain behind — the iconic Cape Doctor wind-sport image |
| 541 | `afe79b6ded39` | `wind/week_1/day/3` | day | KILL-GENERIC | `litter` | Wheelie bins blown over with refuse scattered across the pavement, people bracing — the gag is undercut by litter, which breaks the positive-vibes rule |
| 542 | `3a737a987df3` | `wind/week_1/day/4` | day | KILL-GENERIC | `motif-blown-umbrella` | Patio umbrella flipped inside-out by the pool with no people — a mild static object-gag, weak on its own |
| 543 | `a2b1cfe4b3a7` | `wind/week_1/day/5` | day | KEEP-FUNNY |  | Diverse schoolkids in blazers battling to school against the wind, leaves flying, one clutching his hair — lively and relatable |
| 544 | `00357f760303` | `wind/week_1/day/6` | day | KEEP-FUNNY |  | Family picnic on a deck as the wind whips a plate away and the palms bend, everyone grabbing and laughing — the wind-ruins-the-picnic gag |
| 545 | `d656b20a224e` | `wind/week_1/day/7` | day | KEEP-FUNNY |  | Man wrestling the car door and a child against the swirling wind — everyone has fought a car door in the Cape wind, diverse family |
| 546 | `3442cc22fc1e` | `wind/week_2/day/1` | day | KEEP-FUNNY |  | Woman laughing as her floral skirt and hair fly up in the wind on the street with Table Mountain behind — the Marilyn Cape-wind gag, diverse |
| 547 | `afe67e79d368` | `wind/week_2/day/2` | day | KILL-GENERIC | `motif-blown-umbrella` | Beach umbrella dragging across an empty beach with kit scattered — no people, a redundant second blown-umbrella object-gag |
| 548 | `259aec698a6d` | `wind/week_2/day/3` | day | KEEP-FUNNY |  | Woman taking a selfie on the promenade as the wind whips her braids everywhere, sea behind — diverse, lively fighting-for-the-shot gag |
| 549 | `5306c0597333` | `wind/week_2/day/4` | day | KEEP-FUNNY |  | Trampoline blown across the garden and pinned against the wall — the peak SA suburban wind gag, everyone knows a blown-trampoline story |
| 550 | `9b3467841abd` | `wind/week_2/day/5` | day | KILL-GENERIC | `motif-watching-through-glass` | Man with coffee at a glass door watching his patio furniture tumble outside — quiet watching-through-glass composition, subtle gag |
| 551 | `9204050ecced` | `wind/week_2/day/6` | day | KEEP-FUNNY |  | Businessman in a suit bracing against the wind under jacarandas, blossoms and briefcase flying — diverse, characterful, very Joburg |
| 552 | `b894c97dbc67` | `wind/week_2/day/7` | day | KEEP-FUNNY | `motif-blown-umbrella` | Cape Dutch home with a patio umbrella violently shredded and inverted by the wind — the strongest blown-umbrella frame, striking setting |
| 553 | `7cd322576ac9` | `wind/week_3/day/1` | day | KEEP-FUNNY |  | Grumpy cat on a wall with its fur blown flat by the wind, unimpressed — animal-reacting-to-weather, meme gold |
| 554 | `bd3efbb0dec1` | `wind/week_3/day/2` | day | KEEP-FUNNY | `braai-weekend-gate` | Braai flames whipping sideways in the wind as someone feeds the fire — peak SA wind gag, but braai imagery should be weekend-gated |
| 555 | `3017aed26007` | `wind/week_3/day/3` | day | KEEP-FUNNY |  | Small dog braced with ears pinned on the promenade against the wind, Table Mountain behind — animal-vs-wind, relatable |
| 556 | `ef2b2076607c` | `wind/week_3/day/4` | day | KILL-GENERIC | `motif-hair-in-wind` | Woman laughing with hair blown across her face walking through a gate — pleasant and diverse but the weakest of the hair-in-wind trio (546, 548 stronger) |
| 557 | `acfea5277048` | `wind/week_3/day/5` | day | KILL-GENERIC | `motif-blown-trampoline` | Trampoline flipped over by the pool at a modern house — a second blown-trampoline; 549 is the cleaner representative |
| 558 | `32452b101050` | `wind/week_3/day/6` | day | KILL-GENERIC | `litter` | Wheelie bins blown over with rubbish strewn across the driveway — scattered litter again breaks the positive-vibes rule |
| 559 | `1c2344fce437` | `wind/week_3/day/7` | day | KILL-GENERIC | `motif-kitesurf` | Diverse crowd on the beach watching kitesurfers at Blouberg — pleasant social-lifestyle, the striking single kitesurfer 540 covers this better |
| 560 | `da9bd60eb4b5` | `wind/week_4/day/1` | day | KILL-GENERIC |  | Wooden wind chimes swinging in the breeze over a bushveld garden — a quiet literal signifier with no human hook |
| 561 | `a04567442c8a` | `wind/week_4/day/2` | day | KEEP-FUNNY |  | Man wrestling a big striped beach umbrella while a little girl shields her face from flying sand — diverse beach-day-vs-wind gag |
| 562 | `498f048324a9` | `wind/week_4/day/3` | day | KEEP-FUNNY |  | Older man in a beanie fighting to read a newspaper the wind keeps folding on a promenade bench — the classic cant-read-the-paper gag |
| 563 | `d79431d01667` | `wind/week_4/day/4` | day | KEEP-FUNNY |  | Washing blown off the line and flying over the wall at a Cape Dutch house with bougainvillea — relatable washing-gone-with-the-wind |
| 564 | `b8a1fdaf8f80` | `wind/week_4/day/5` | day | KEEP-FUNNY |  | Family on a stoep as the wind scatters their gathering across the garden, a man chasing a tumbling beanbag — diverse, lively chaos |
| 565 | `ff5005f789ab` | `wind/week_4/day/6` | day | KEEP-FUNNY | `motif-wind-wrecks-meal` | Beach picnic-table lunch flying off in the wind, a woman lunging to catch a plate, all reacting — diverse, lively wind-steals-the-meal gag |
| 566 | `108ab968cdec` | `wind/week_4/day/7` | day | KEEP-FUNNY | `motif-hat-blown` | Couple walking the dog when a hat blows off and rolls down the pavement, both lunging after it — diverse, relatable chase gag |
| 567 | `7c7e0af2e296` | `wind/week_{1,3}/dawn/1` | dawn | KEEP-BEAUTIFUL |  | The tablecloth cloud pouring over Table Mountain at dawn above an empty Cape Town street with the SA flag — iconic, culturally-specific wind signature |
| 568 | `39021494d6a3` | `wind/week_{1,3}/dawn/2` | dawn | KILL-GENERIC |  | Lone palm bent hard by the wind at golden-hour sunrise — pretty but a pleasant bent-palm wind cliche, no hook |
| 569 | `5c0da4d6cccc` | `wind/week_{1,3}/dawn/3` | dawn | KILL-GENERIC |  | Rotary washing line with birds and a palm at dawn — quiet suburban filler, no gag or standout |
| 570 | `d53e9659509b` | `wind/week_{1,3}/dawn/4` | dawn | KEEP-FUNNY | `motif-hat-blown` | Mother reaching after her schoolboy's cap as the wind whips it down the street on the dawn school run — diverse, relatable |
| 571 | `4be3bbb74466` | `wind/week_{1,3}/dawn/5` | dawn | KILL-GENERIC | `motif-blown-bins` | Wheelie bin blown over with a box and leaves in the street at dawn — third blown-bin frame; 549-class gags are stronger |
| 572 | `9728190bc67c` | `wind/week_{1,3}/dawn/6` | dawn | KILL-GENERIC |  | Woman jogging into the wind at dawn, ponytail streaming — pleasant fitness-lifestyle, the wind premise is thin |
| 573 | `26eea1c28270` | `wind/week_{1,3}/dawn/7` | dawn | KILL-GENERIC |  | Cape Dutch house exterior at dawn with a garden bench and warm windows — pleasant but peopleless, no hook |
| 574 | `37b3dbc6b90d` | `wind/week_{2,4}/dawn/1` | dawn | KEEP-BEAUTIFUL |  | Grandmother and small child wrapped in a blanket on the deck watching the windy dawn, child pointing, palms bending — warm, diverse, tender |
| 575 | `34a6e7ee4499` | `wind/week_{2,4}/dawn/2` | dawn | KILL-GENERIC |  | Row of wind-bent trees along an empty suburban street at dawn with birds swirling — pleasant-moody, peopleless, no hook |
| 576 | `9638bb3af80c` | `wind/week_{2,4}/dawn/3` | dawn | KILL-GENERIC |  | Lone surfer walking the dawn beach with seagulls in the wind spray — moody-surfer stock, no gag |
| 577 | `691f699747f1` | `wind/week_{2,4}/dawn/4` | dawn | KILL-GENERIC | `motif-chase` | Man chasing a wind-blown beanbag across a Cape Dutch lawn at sunset — a redundant solo-chase; 539 is the representative |
| 578 | `01082a853faf` | `wind/week_{2,4}/dawn/5` | dawn | KILL-GENERIC |  | Row of birds all facing into the wind on the dawn beach — gently witty and pretty but quiet, no strong hook |
| 579 | `0f68d975b6f6` | `wind/week_{2,4}/dawn/6` | dawn | KILL-GENERIC | `motif-suit-in-wind` | Man in a suit walking under jacarandas at dawn, jacket flapping — the calmer twin of the stronger businessman gag 551 |
| 580 | `c16b772e6199` | `wind/week_{2,4}/dawn/7` | dawn | KILL-GENERIC | `motif-washing` | Washing blowing horizontal on the line at a stone farmhouse in golden light — atmospheric but no gag; 563 is the funny washing frame |
| 581 | `4a0b5d3b10ec` | `wind/week_{1,3}/dusk/1` | dusk | KEEP-FUNNY | `motif-huddle-in-wind` | Two women clinging together and laughing as they brace into the wind on the promenade at sunset — diverse, lively |
| 582 | `e582fc27c7fe` | `wind/week_{1,3}/dusk/2` | dusk | KILL-GENERIC |  | Wind-blasted bare tree in a dramatic mountain valley at dusk with debris flying — dramatic but a peopleless empty-landscape |
| 583 | `fbba3dfe6859` | `wind/week_{1,3}/dusk/3` | dusk | KEEP-FUNNY | `motif-huddle-in-wind` | Couple huddled together laughing as they walk into the wind on the beach with Table Mountain behind — relatable, warm |
| 584 | `5813c7f52608` | `wind/week_{1,3}/dusk/4` | dusk | KEEP-FUNNY |  | Man cycling into the wind under jacarandas at dusk, jacket billowing like a cape — diverse, dynamic, very SA |
| 585 | `79d331c20adb` | `wind/week_{1,3}/dusk/5` | dusk | KILL-GENERIC | `motif-blown-trampoline` | Trampoline flung and mangled against a tree at sunset — dramatic but the third blown-trampoline; 549 is the representative |
| 586 | `d9e5daeff8fc` | `wind/week_{1,3}/dusk/6` | dusk | KEEP-FUNNY |  | Diverse crowd battling a sandy wind along the beachfront promenade at sunset, shielding faces — lively collective wind-struggle |
| 587 | `55f1d80fdf9d` | `wind/week_{1,3}/dusk/7` | dusk | KEEP-FUNNY | `motif-washing` | Two women relaying to rescue the washing flying over the wall at a farmhouse dusk — lively human washing-rescue |
| 588 | `915c1de2c655` | `wind/week_{2,4}/dusk/1` | dusk | KEEP-FUNNY |  | Woman and kids carrying patio cushions inside as the wind whips the palms at golden hour — warm beat-the-wind salvage gag |
| 589 | `7c81a1ae1c2c` | `wind/week_{2,4}/dusk/2` | dusk | KILL-GENERIC | `motif-hair-in-wind` | Woman with her hair blown vertical getting out of the car, laughing — the funniest hair-moment but a fourth hair-in-wind; 546 is the keeper |
| 590 | `bdaac6c62d2e` | `wind/week_{2,4}/dusk/3` | dusk | KILL-GENERIC |  | Moody mountain at dusk with dramatic sunset clouds and a washing line — peopleless empty-landscape, no hook |
| 591 | `a040da136fd2` | `wind/week_{2,4}/dusk/4` | dusk | KEEP-FUNNY | `braai-weekend-gate` | Man carrying the braai grill inside while a woman wrangles a flapping cover at sunset — SA salvage gag, but braai imagery should be weekend-gated |
| 592 | `f2a777e704e5` | `wind/week_{2,4}/dusk/5` | dusk | KILL-GENERIC |  | Man calmly reading a book on the patio as the palms thrash behind him — gentle irony but a quiet lifestyle shot |
| 593 | `fd353480fda5` | `wind/week_{2,4}/dusk/6` | dusk | KILL-GENERIC | `motif-blown-umbrella` | Patio umbrella violently inverted at sunset with a chair knocked over — dramatic but another blown-umbrella; 552 is the representative |
| 594 | `96f9a1003486` | `wind/week_{2,4}/dusk/7` | dusk | KEEP-FUNNY | `motif-wind-wrecks-meal` | Diverse friends scrambling to save the dinner as the wind rips the tablecloth off at sunset — lively, well-cast meal-chaos |
| 595 | `d5579aa629ca` | `wind/week_{1,3}/night/1` | night | KILL-GENERIC |  | Patio furniture and umbrella blown over on a dark lawn at night — peopleless aftermath, no hook |
| 596 | `9248c64fdecc` | `wind/week_{1,3}/night/2` | night | KEEP-FUNNY | `braai-weekend-gate` | Two mates laughing at the braai at night as sparks blow in the wind, Table Mountain and city lights behind — diverse, warm; braai should be weekend-gated |
| 597 | `d8b0d009d132` | `wind/week_{1,3}/night/3` | night | KILL-GENERIC |  | Hurricane lantern on a stone patio with blown-over pots at night — moody still-life but peopleless and edges into mess |
| 598 | `c67fbc9adf72` | `wind/week_{1,3}/night/4` | night | KEEP-FUNNY | `motif-washing` | Two women wrangling the flying washing off the line by torchlight at night — diverse, lively after-dark scramble |
| 599 | `8626aa6cc488` | `wind/week_{1,3}/night/5` | night | KILL-GENERIC |  | Man bracing against the wind at his front gate at night — dark solo-brace, mild premise |
| 600 | `4f7e2e64427c` | `wind/week_{1,3}/night/6` | night | KILL-GENERIC |  | Empty dark backyard with washing line and streetlight — peopleless filler, no hook |
| 601 | `ada92c3cb143` | `wind/week_{1,3}/night/7` | night | KEEP-FUNNY | `motif-wind-wrecks-meal` | Diverse group at a fairy-light outdoor dinner as the wind whips napkins off the table, everyone grabbing — night meal-chaos, warm |
| 602 | `6e33146a7fad` | `wind/week_{2,4}/night/1` | night | KILL-GENERIC | `motif-coffee-watching` | Woman with coffee at the window at night watching the wind in the palms — quiet coffee-watching filler |
| 603 | `d07259f092f4` | `wind/week_{2,4}/night/2` | night | KILL-GENERIC |  | Fairy-lit patio with debris blown across it and an empty rocking chair at night — peopleless aftermath, mild mess |
| 604 | `2cf1bd73dcbe` | `wind/week_{2,4}/night/3` | night | KEEP-FUNNY |  | Woman wrestling a billowing curtain at an open window as the wind bursts in and papers fly — the relatable close-the-window gag, diverse |
| 605 | `047ba9523ed1` | `wind/week_{2,4}/night/4` | night | KILL-GENERIC | `motif-fairy-light-table` | Diverse friends laughing at a fairy-lit Cape Dutch table with wind in their hair — warm but no distinct gag; the fairy-light-table cluster is over-supplied |
| 606 | `39490da41272` | `wind/week_{2,4}/night/5` | night | KILL-GENERIC | `motif-windswept-cat` | Serene fluffy cat at a doorway with leaves blown around it at night — 553 is the funnier windswept-cat |
| 607 | `7f9001fc481b` | `wind/week_{2,4}/night/6` | night | KILL-GENERIC |  | Dark figure bent over wrestling something in the street under a streetlight at night — unclear and mild, edges into mess |
| 608 | `6ad30052cf4c` | `wind/week_{2,4}/night/7` | night | KILL-GENERIC |  | Empty dark suburban street with a streetlight-lit tree at night — peopleless filler, no hook |

## Ruling queue

- **381 KILL-GENERIC** queued for Al's spot-check. False-keeps are the danger, so the pass leaned KILL when torn; Al should scan for any false-kill he'd rescue.
- **1 BORDERLINE** queued for Al's ruling:
  - `#109` cloudy/week_{2,4}/dawn/4 — newspaper vendor between cars at the robot — iconic SA street vs aspirational-register rule
- Nothing in this report has been acted on. No image deleted, renamed, or replaced this pass.
