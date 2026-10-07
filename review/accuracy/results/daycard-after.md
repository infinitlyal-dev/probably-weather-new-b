# Accuracy eval — daycard-after

Generated 2026-10-07T08:35:48.821Z. 2026-06-24 → 2026-09-22, six SA airports, METAR ground truth. Observed "windy" = sustained ≥ 30 km/h or gust ≥ 45 km/h.

## What the phone shows (frontend display key)

| city | hours | said rain | false rain, same hour | false rain, ±1 h | hours with rain | rain missed (nothing wet) | rain not called rain | windy hours | windy served sky-only | said wind | false wind |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Cape Town | 2164 | 10 | 0 (0%) | 0 (0%) | 103 | 28 (27.2%) | 93 (90.3%) | 219 | 60 (27.4%) | 135 | 1 (0.7%) |
| Johannesburg | 2151 | 5 | 1 (20%) | 1 (20%) | 67 | 9 (13.4%) | 55 (82.1%) | 90 | 20 (22.2%) | 28 | 0 (0%) |
| Durban | 2154 | 14 | 0 (0%) | 0 (0%) | 174 | 41 (23.6%) | 158 (90.8%) | 72 | 6 (8.3%) | 129 | 4 (3.1%) |
| Gqeberha | 2087 | 0 | 0 (null%) | 0 (null%) | 190 | 37 (19.5%) | 186 (97.9%) | 150 | 26 (17.3%) | 168 | 8 (4.8%) |
| Bloemfontein | 2039 | 6 | 0 (0%) | 0 (0%) | 51 | 15 (29.4%) | 43 (84.3%) | 33 | 1 (3%) | 54 | 4 (7.4%) |
| George | 2145 | 11 | 2 (18.2%) | 0 (0%) | 215 | 41 (19.1%) | 200 (93%) | 33 | 8 (24.2%) | 39 | 4 (10.3%) |
| **All six** | 12740 | 46 | 3 (6.5%) | 1 (2.2%) | 800 | 171 (21.4%) | 735 (91.9%) | 597 | 121 (20.3%) | 553 | 21 (3.8%) |

Keys served (all six): clear 4728 · partly-cloudy 2283 · rain-possible 2266 · cold-clear 1128 · cloudy 879 · fog 617 · wind 553 · uv 147 · rain 46 · thunder 38 · cold 34 · heat 19 · hail 2

## Server now.conditionKey

| city | hours | said rain | false rain, same hour | false rain, ±1 h | hours with rain | rain missed (nothing wet) | rain not called rain | windy hours | windy served sky-only | said wind | false wind |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Cape Town | 2164 | 10 | 0 (0%) | 0 (0%) | 103 | 37 (35.9%) | 93 (90.3%) | 219 | 65 (29.7%) | 135 | 1 (0.7%) |
| Johannesburg | 2151 | 5 | 1 (20%) | 1 (20%) | 67 | 12 (17.9%) | 55 (82.1%) | 90 | 44 (48.9%) | 28 | 0 (0%) |
| Durban | 2154 | 14 | 0 (0%) | 0 (0%) | 174 | 46 (26.4%) | 158 (90.8%) | 72 | 7 (9.7%) | 129 | 4 (3.1%) |
| Gqeberha | 2087 | 0 | 0 (null%) | 0 (null%) | 190 | 57 (30%) | 186 (97.9%) | 150 | 33 (22%) | 168 | 8 (4.8%) |
| Bloemfontein | 2039 | 6 | 0 (0%) | 0 (0%) | 51 | 23 (45.1%) | 43 (84.3%) | 33 | 2 (6.1%) | 54 | 4 (7.4%) |
| George | 2145 | 11 | 2 (18.2%) | 0 (0%) | 215 | 61 (28.4%) | 200 (93%) | 33 | 8 (24.2%) | 39 | 4 (10.3%) |
| **All six** | 12740 | 46 | 3 (6.5%) | 1 (2.2%) | 800 | 236 (29.5%) | 735 (91.9%) | 597 | 159 (26.6%) | 553 | 21 (3.8%) |

Keys served (all six): clear 5162 · partly-cloudy 2534 · rain-possible 1196 · cloudy 1173 · cold-clear 1128 · fog 700 · wind 553 · uv 155 · rain 46 · thunder 38 · cold 34 · heat 19 · hail 2

## Cloud call (7 Oct 2026)

"No grey" = the station reported no broken or overcast layer below 20,000 ft. SA airports do not report high cloud, so this cannot see cirrus: a cloudy call over "no grey" is a sky with no low or mid blanket, not proven blue.

### Phone

| city | said cloudy (with cloud report) | cloudy over no grey | hours with grey cloud | grey served clear / partly / uv / cold-clear / heat |
|---|---|---|---|---|
| Cape Town | 185 | 65 (35.1%) | 620 | 81 (13.1%) |
| Johannesburg | 74 | 44 (59.5%) | 222 | 36 (16.2%) |
| Durban | 157 | 57 (36.3%) | 592 | 148 (25%) |
| Gqeberha | 145 | 79 (54.5%) | 496 | 110 (22.2%) |
| Bloemfontein | 78 | 59 (75.6%) | 126 | 7 (5.6%) |
| George | 213 | 80 (37.6%) | 739 | 184 (24.9%) |
| **All six** | 852 | 384 (45.1%) | 2795 | 566 (20.3%) |

### Server

| city | said cloudy (with cloud report) | cloudy over no grey | hours with grey cloud | grey served clear / partly / uv / cold-clear / heat |
|---|---|---|---|---|
| Cape Town | 239 | 83 (34.7%) | 620 | 102 (16.5%) |
| Johannesburg | 92 | 46 (50%) | 222 | 53 (23.9%) |
| Durban | 211 | 80 (37.9%) | 592 | 168 (28.4%) |
| Gqeberha | 234 | 139 (59.4%) | 496 | 129 (26%) |
| Bloemfontein | 95 | 53 (55.8%) | 126 | 14 (11.1%) |
| George | 271 | 110 (40.6%) | 739 | 226 (30.6%) |
| **All six** | 1142 | 511 (44.7%) | 2795 | 692 (24.8%) |

### Day card at noon (day 0)

| city | noon days with a cloud report | day card Cloudy | Cloudy over no grey | grey at noon | grey served light-sky |
|---|---|---|---|---|---|
| Cape Town | 91 | 13 | 3 (23.1%) | 29 | 5 (17.2%) |
| Johannesburg | 89 | 2 | 0 (0%) | 9 | 0 (0%) |
| Durban | 91 | 5 | 2 (40%) | 24 | 3 (12.5%) |
| Gqeberha | 91 | 6 | 3 (50%) | 18 | 3 (16.7%) |
| Bloemfontein | 88 | 2 | 2 (100%) | 7 | 0 (0%) |
| George | 91 | 5 | 4 (80%) | 17 | 3 (17.6%) |
| **All six** | 541 | 33 | 14 (42.4%) | 104 | 14 (13.5%) |

## Observed wind and model bias

| city | obs sustained p50 / p90 / p95 km/h | hours ≥ 30 sustained | hours gust ≥ 45 | median obs ÷ forecast mean | median obs gust ÷ forecast gust |
|---|---|---|---|---|---|
| Cape Town | 14.8 / 31.5 / 35.2 | 219 | 38 | 1.75 | 0.88 |
| Johannesburg | 13 / 24.1 / 29.6 | 88 | 10 | 1.61 | 1.22 |
| Durban | 9.3 / 24.1 / 27.8 | 60 | 32 | 0.99 | 0.94 |
| Gqeberha | 13 / 27.8 / 33.3 | 147 | 45 | 1.19 | 0.85 |
| Bloemfontein | 5.6 / 18.5 / 24.1 | 33 | 7 | 1.02 | 0.96 |
| George | 7.4 / 18.5 / 24.1 | 29 | 11 | 1.17 | 0.81 |

## Wind rule sweep (all six; predicting observed windy from blended mean ≥ T1 or max gust ≥ T2)

| gust source | mean ≥ | gust ≥ | precision | recall | F1 | hit | false alarm | miss |
|---|---|---|---|---|---|---|---|---|
| OM+Pirate gust | 26 | 52 | 56% | 71.4% | 62.7 | 426 | 335 | 171 |
| OM+WA+Pirate gust | 26 | 52 | 56% | 71.4% | 62.7 | 426 | 335 | 171 |
| any source gust | 26 | 52 | 54.8% | 72.7% | 62.5 | 434 | 358 | 163 |
| any source gust | 26 | 55 | 60.7% | 64% | 62.3 | 382 | 247 | 215 |
| OM+Pirate gust | 26 | 55 | 62% | 62.5% | 62.2 | 373 | 229 | 224 |
| OM+Pirate gust | 28 | 52 | 56.3% | 69.3% | 62.2 | 414 | 321 | 183 |
| OM+Pirate gust | 30 | 52 | 56.5% | 69.2% | 62.2 | 413 | 318 | 184 |
| OM+Pirate gust | 32 | 52 | 56.6% | 69% | 62.2 | 412 | 316 | 185 |
| OM+Pirate gust | 35 | 52 | 56.6% | 69% | 62.2 | 412 | 316 | 185 |
| OM+Pirate gust | 40 | 52 | 56.6% | 69% | 62.2 | 412 | 316 | 185 |
| OM+Pirate gust | Infinity | 52 | 56.6% | 69% | 62.2 | 412 | 316 | 185 |
| OM+WA+Pirate gust | 26 | 55 | 62% | 62.5% | 62.2 | 373 | 229 | 224 |
| current rule (mean only) | 25 | — | 63.2% | 39.2% | 48.4 | 234 | 136 | 363 |
| current rule (mean only) | 30 | — | 82.8% | 13.7% | 23.6 | 82 | 17 | 515 |

## Daily rain % calibration (535 station-days; blended daily % read at 06:00 vs. any rain reported that day)

| blended daily % | days | days it actually rained |
|---|---|---|
| 0–20% | 375 | 6.4% |
| 20–30% | 15 | 33.3% |
| 30–40% | 18 | 66.7% |
| 40–50% | 10 | 70% |
| 50–60% | 19 | 57.9% |
| 60–80% | 45 | 84.4% |
| 80–100% | 53 | 96.2% |

| daily key at 06:00 | days | days it actually rained |
|---|---|---|
| rain | 138 | 79.7% |
| clear | 156 | 4.5% |
| partly-cloudy | 95 | 10.5% |
| cloudy | 31 | 16.1% |
| cold-clear | 22 | 0% |
| rain-possible | 5 | 20% |
| fog | 1 | 100% |
| uv | 61 | 1.6% |
| heat | 5 | 0% |
| cold | 2 | 100% |
| thunder | 11 | 81.8% |
| wind | 7 | 14.3% |
| hail | 1 | 100% |
