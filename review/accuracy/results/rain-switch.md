# Accuracy eval — rain-switch

Generated 2026-10-12T21:05:49.583Z. 2026-06-24 → 2026-09-22, six SA airports, METAR ground truth. Observed "windy" = sustained ≥ 30 km/h or gust ≥ 45 km/h.

## What the phone shows (frontend display key)

| city | hours | said rain | false rain, same hour | false rain, ±1 h | hours with rain | rain missed (nothing wet) | rain not called rain | windy hours | windy served sky-only | said wind | false wind |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Cape Town | 2164 | 53 | 14 (26.4%) | 2 (3.8%) | 103 | 30 (29.1%) | 64 (62.1%) | 219 | 29 (13.2%) | 130 | 1 (0.8%) |
| Johannesburg | 2151 | 5 | 1 (20%) | 1 (20%) | 67 | 12 (17.9%) | 55 (82.1%) | 90 | 20 (22.2%) | 28 | 0 (0%) |
| Durban | 2154 | 106 | 10 (9.4%) | 4 (3.8%) | 174 | 26 (14.9%) | 76 (43.7%) | 72 | 2 (2.8%) | 107 | 4 (3.7%) |
| Gqeberha | 2087 | 0 | 0 (null%) | 0 (null%) | 190 | 53 (27.9%) | 186 (97.9%) | 150 | 6 (4%) | 168 | 8 (4.8%) |
| Bloemfontein | 2039 | 6 | 0 (0%) | 0 (0%) | 51 | 25 (49%) | 43 (84.3%) | 33 | 2 (6.1%) | 54 | 4 (7.4%) |
| George | 2145 | 104 | 23 (22.1%) | 7 (6.7%) | 215 | 54 (25.1%) | 128 (59.5%) | 33 | 0 (0%) | 37 | 4 (10.8%) |
| **All six** | 12740 | 274 | 48 (17.5%) | 14 (5.1%) | 800 | 200 (25%) | 552 (69%) | 597 | 59 (9.9%) | 524 | 21 (4%) |

Keys served (all six): clear 4138 · partly-cloudy 1976 · breezy 1407 · cloudy 1306 · cold-clear 1128 · rain-possible 1091 · fog 694 · wind 524 · rain 274 · uv 104 · cold 38 · thunder 38 · heat 20 · hail 2

## Server now.conditionKey

| city | hours | said rain | false rain, same hour | false rain, ±1 h | hours with rain | rain missed (nothing wet) | rain not called rain | windy hours | windy served sky-only | said wind | false wind |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Cape Town | 2164 | 53 | 14 (26.4%) | 2 (3.8%) | 103 | 37 (35.9%) | 64 (62.1%) | 219 | 34 (15.5%) | 130 | 1 (0.8%) |
| Johannesburg | 2151 | 5 | 1 (20%) | 1 (20%) | 67 | 14 (20.9%) | 55 (82.1%) | 90 | 19 (21.1%) | 28 | 0 (0%) |
| Durban | 2154 | 106 | 10 (9.4%) | 4 (3.8%) | 174 | 30 (17.2%) | 76 (43.7%) | 72 | 2 (2.8%) | 107 | 4 (3.7%) |
| Gqeberha | 2087 | 0 | 0 (null%) | 0 (null%) | 190 | 64 (33.7%) | 186 (97.9%) | 150 | 6 (4%) | 168 | 8 (4.8%) |
| Bloemfontein | 2039 | 6 | 0 (0%) | 0 (0%) | 51 | 26 (51%) | 43 (84.3%) | 33 | 2 (6.1%) | 54 | 4 (7.4%) |
| George | 2145 | 104 | 23 (22.1%) | 7 (6.7%) | 215 | 67 (31.2%) | 128 (59.5%) | 33 | 0 (0%) | 37 | 4 (10.8%) |
| **All six** | 12740 | 274 | 48 (17.5%) | 14 (5.1%) | 800 | 238 (29.8%) | 552 (69%) | 597 | 63 (10.6%) | 524 | 21 (4%) |

Keys served (all six): clear 4353 · partly-cloudy 2020 · breezy 1441 · cloudy 1307 · cold-clear 1128 · rain-possible 793 · fog 697 · wind 524 · rain 274 · uv 105 · cold 38 · thunder 38 · heat 20 · hail 2

## Cloud call (7 Oct 2026)

"No grey" = the station reported no broken or overcast layer below 20,000 ft. SA airports do not report high cloud, so this cannot see cirrus: a cloudy call over "no grey" is a sky with no low or mid blanket, not proven blue.

### Phone

| city | said cloudy (with cloud report) | cloudy over no grey | hours with grey cloud | grey served clear / partly / uv / cold-clear / heat |
|---|---|---|---|---|
| Cape Town | 254 | 92 (36.2%) | 620 | 92 (14.8%) |
| Johannesburg | 106 | 53 (50%) | 222 | 46 (20.7%) |
| Durban | 245 | 88 (35.9%) | 592 | 159 (26.9%) |
| Gqeberha | 245 | 145 (59.2%) | 496 | 123 (24.8%) |
| Bloemfontein | 134 | 80 (59.7%) | 126 | 9 (7.1%) |
| George | 284 | 107 (37.7%) | 739 | 203 (27.5%) |
| **All six** | 1268 | 565 (44.6%) | 2795 | 632 (22.6%) |

### Server

| city | said cloudy (with cloud report) | cloudy over no grey | hours with grey cloud | grey served clear / partly / uv / cold-clear / heat |
|---|---|---|---|---|
| Cape Town | 269 | 96 (35.7%) | 620 | 113 (18.2%) |
| Johannesburg | 95 | 48 (50.5%) | 222 | 55 (24.8%) |
| Durban | 245 | 90 (36.7%) | 592 | 169 (28.5%) |
| Gqeberha | 258 | 147 (57%) | 496 | 133 (26.8%) |
| Bloemfontein | 109 | 61 (56%) | 126 | 14 (11.1%) |
| George | 296 | 116 (39.2%) | 739 | 230 (31.1%) |
| **All six** | 1272 | 558 (43.9%) | 2795 | 714 (25.5%) |

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
