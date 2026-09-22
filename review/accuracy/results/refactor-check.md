# Accuracy eval — refactor-check

Generated 2026-09-22T15:34:46.901Z. 2026-06-24 → 2026-09-22, six SA airports, METAR ground truth. Observed "windy" = sustained ≥ 30 km/h or gust ≥ 45 km/h.

## What the phone shows (frontend display key)

| city | hours | said rain | false rain, same hour | false rain, ±1 h | hours with rain | rain missed (nothing wet) | rain not called rain | windy hours | windy served sky-only | said wind | false wind |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Cape Town | 2164 | 200 | 115 (57.5%) | 68 (34%) | 103 | 11 (10.7%) | 18 (17.5%) | 219 | 118 (53.9%) | 14 | 0 (0%) |
| Johannesburg | 2151 | 124 | 72 (58.1%) | 47 (37.9%) | 67 | 2 (3%) | 7 (10.4%) | 90 | 27 (30%) | 0 | 0 (null%) |
| Durban | 2154 | 293 | 139 (47.4%) | 102 (34.8%) | 174 | 11 (6.3%) | 18 (10.3%) | 72 | 7 (9.7%) | 70 | 2 (2.9%) |
| Gqeberha | 2087 | 322 | 170 (52.8%) | 97 (30.1%) | 190 | 11 (5.8%) | 34 (17.9%) | 150 | 38 (25.3%) | 47 | 1 (2.1%) |
| Bloemfontein | 2039 | 166 | 129 (77.7%) | 112 (67.5%) | 51 | 4 (7.8%) | 12 (23.5%) | 33 | 1 (3%) | 10 | 0 (0%) |
| George | 2145 | 295 | 141 (47.8%) | 79 (26.8%) | 215 | 40 (18.6%) | 55 (25.6%) | 33 | 13 (39.4%) | 12 | 0 (0%) |
| **All six** | 12740 | 1400 | 766 (54.7%) | 505 (36.1%) | 800 | 79 (9.9%) | 144 (18%) | 597 | 204 (34.2%) | 153 | 3 (2%) |

Keys served (all six): clear 4793 · cloudy 2385 · rain 1400 · rain-possible 1213 · cold-clear 1128 · partly-cloudy 806 · fog 617 · uv 154 · wind 153 · thunder 38 · cold 32 · heat 19 · hail 2

## Server now.conditionKey

| city | hours | said rain | false rain, same hour | false rain, ±1 h | hours with rain | rain missed (nothing wet) | rain not called rain | windy hours | windy served sky-only | said wind | false wind |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Cape Town | 2164 | 201 | 119 (59.2%) | 77 (38.3%) | 103 | 20 (19.4%) | 21 (20.4%) | 219 | 133 (60.7%) | 24 | 0 (0%) |
| Johannesburg | 2151 | 125 | 71 (56.8%) | 45 (36%) | 67 | 5 (7.5%) | 5 (7.5%) | 90 | 50 (55.6%) | 1 | 0 (0%) |
| Durban | 2154 | 294 | 144 (49%) | 111 (37.8%) | 174 | 21 (12.1%) | 22 (12.6%) | 72 | 8 (11.1%) | 90 | 2 (2.2%) |
| Gqeberha | 2087 | 317 | 165 (52.1%) | 95 (30%) | 190 | 30 (15.8%) | 34 (17.9%) | 150 | 54 (36%) | 79 | 1 (1.3%) |
| Bloemfontein | 2039 | 168 | 131 (78%) | 115 (68.5%) | 51 | 12 (23.5%) | 12 (23.5%) | 33 | 4 (12.1%) | 29 | 3 (10.3%) |
| George | 2145 | 290 | 142 (49%) | 85 (29.3%) | 215 | 59 (27.4%) | 61 (28.4%) | 33 | 13 (39.4%) | 18 | 0 (0%) |
| **All six** | 12740 | 1395 | 772 (55.3%) | 528 (37.8%) | 800 | 147 (18.4%) | 155 (19.4%) | 597 | 262 (43.9%) | 241 | 6 (2.5%) |

Keys served (all six): clear 5439 · cloudy 2624 · rain 1395 · cold-clear 1128 · partly-cloudy 907 · fog 699 · wind 241 · uv 167 · rain-possible 49 · thunder 38 · cold 32 · heat 19 · hail 2

## Observed wind and model bias

| city | obs sustained p50 / p90 / p95 km/h | hours ≥ 30 sustained | hours gust ≥ 45 | median obs ÷ forecast mean | median obs gust ÷ forecast gust |
|---|---|---|---|---|---|
| Cape Town | 14.8 / 31.5 / 35.2 | 219 | 38 | 1.75 | 1.12 |
| Johannesburg | 13 / 24.1 / 29.6 | 88 | 10 | 1.61 | 1.22 |
| Durban | 9.3 / 24.1 / 27.8 | 60 | 32 | 0.99 | 0.95 |
| Gqeberha | 13 / 27.8 / 33.3 | 147 | 45 | 1.19 | 0.87 |
| Bloemfontein | 5.6 / 18.5 / 24.1 | 33 | 7 | 1.02 | 1.02 |
| George | 7.4 / 18.5 / 24.1 | 29 | 11 | 1.17 | 0.81 |

## Wind rule sweep (all six; predicting observed windy from blended mean ≥ T1 or max gust ≥ T2)

| gust source | mean ≥ | gust ≥ | precision | recall | F1 | hit | false alarm | miss |
|---|---|---|---|---|---|---|---|---|
| OM+WA+Pirate gust | 26 | 52 | 56% | 71.4% | 62.7 | 426 | 335 | 171 |
| any source gust | 26 | 52 | 54.8% | 72.7% | 62.5 | 434 | 358 | 163 |
| any source gust | 26 | 55 | 60.7% | 64% | 62.3 | 382 | 247 | 215 |
| OM+WA+Pirate gust | 26 | 55 | 62% | 62.5% | 62.2 | 373 | 229 | 224 |
| OM+WA+Pirate gust | 28 | 52 | 56.3% | 69.3% | 62.2 | 414 | 321 | 183 |
| OM+WA+Pirate gust | 30 | 52 | 56.5% | 69.2% | 62.2 | 413 | 318 | 184 |
| OM+WA+Pirate gust | 32 | 52 | 56.6% | 69% | 62.2 | 412 | 316 | 185 |
| OM+WA+Pirate gust | 35 | 52 | 56.6% | 69% | 62.2 | 412 | 316 | 185 |
| OM+WA+Pirate gust | 40 | 52 | 56.6% | 69% | 62.2 | 412 | 316 | 185 |
| OM+WA+Pirate gust | Infinity | 52 | 56.6% | 69% | 62.2 | 412 | 316 | 185 |
| any source gust | 30 | 52 | 55.1% | 71.2% | 62.1 | 425 | 347 | 172 |
| any source gust | 32 | 52 | 55.1% | 71.2% | 62.1 | 425 | 347 | 172 |
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
| partly-cloudy | 30 | 13.3% |
| cloudy | 98 | 11.2% |
| cold-clear | 22 | 0% |
| rain-possible | 4 | 25% |
| fog | 1 | 100% |
| uv | 61 | 1.6% |
| heat | 4 | 0% |
| cold | 2 | 100% |
| thunder | 11 | 81.8% |
| wind | 7 | 14.3% |
| hail | 1 | 100% |
