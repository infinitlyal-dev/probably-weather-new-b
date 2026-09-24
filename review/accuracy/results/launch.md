# Accuracy eval — launch

Generated 2026-09-24T22:31:02.813Z. 2026-06-24 → 2026-09-22, six SA airports, METAR ground truth. Observed "windy" = sustained ≥ 30 km/h or gust ≥ 45 km/h.

## What the phone shows (frontend display key)

| city | hours | said rain | false rain, same hour | false rain, ±1 h | hours with rain | rain missed (nothing wet) | rain not called rain | windy hours | windy served sky-only | said wind | false wind |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Cape Town | 2164 | 68 | 18 (26.5%) | 6 (8.8%) | 103 | 16 (15.5%) | 53 (51.5%) | 219 | 60 (27.4%) | 123 | 1 (0.8%) |
| Johannesburg | 2151 | 62 | 18 (29%) | 8 (12.9%) | 67 | 4 (6%) | 15 (22.4%) | 90 | 20 (22.2%) | 22 | 0 (0%) |
| Durban | 2154 | 119 | 17 (14.3%) | 7 (5.9%) | 174 | 21 (12.1%) | 70 (40.2%) | 72 | 6 (8.3%) | 108 | 4 (3.7%) |
| Gqeberha | 2087 | 119 | 34 (28.6%) | 14 (11.8%) | 190 | 22 (11.6%) | 101 (53.2%) | 150 | 26 (17.3%) | 148 | 4 (2.7%) |
| Bloemfontein | 2039 | 67 | 44 (65.7%) | 37 (55.2%) | 51 | 7 (13.7%) | 26 (51%) | 33 | 1 (3%) | 41 | 3 (7.3%) |
| George | 2145 | 117 | 29 (24.8%) | 7 (6%) | 215 | 41 (19.1%) | 121 (56.3%) | 33 | 8 (24.2%) | 38 | 4 (10.5%) |
| **All six** | 12740 | 552 | 160 (29%) | 79 (14.3%) | 800 | 111 (13.9%) | 386 (48.3%) | 597 | 121 (20.3%) | 480 | 16 (3.3%) |

Keys served (all six): clear 4728 · cloudy 2371 · rain-possible 1832 · cold-clear 1128 · partly-cloudy 792 · fog 617 · rain 552 · wind 480 · uv 147 · thunder 38 · cold 34 · heat 19 · hail 2

## Server now.conditionKey

| city | hours | said rain | false rain, same hour | false rain, ±1 h | hours with rain | rain missed (nothing wet) | rain not called rain | windy hours | windy served sky-only | said wind | false wind |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Cape Town | 2164 | 68 | 18 (26.5%) | 6 (8.8%) | 103 | 25 (24.3%) | 53 (51.5%) | 219 | 65 (29.7%) | 123 | 1 (0.8%) |
| Johannesburg | 2151 | 62 | 18 (29%) | 8 (12.9%) | 67 | 6 (9%) | 15 (22.4%) | 90 | 44 (48.9%) | 22 | 0 (0%) |
| Durban | 2154 | 119 | 17 (14.3%) | 7 (5.9%) | 174 | 26 (14.9%) | 70 (40.2%) | 72 | 7 (9.7%) | 108 | 4 (3.7%) |
| Gqeberha | 2087 | 119 | 34 (28.6%) | 14 (11.8%) | 190 | 42 (22.1%) | 101 (53.2%) | 150 | 33 (22%) | 148 | 4 (2.7%) |
| Bloemfontein | 2039 | 67 | 44 (65.7%) | 37 (55.2%) | 51 | 15 (29.4%) | 26 (51%) | 33 | 2 (6.1%) | 41 | 3 (7.3%) |
| George | 2145 | 117 | 29 (24.8%) | 7 (6%) | 215 | 61 (28.4%) | 121 (56.3%) | 33 | 8 (24.2%) | 38 | 4 (10.5%) |
| **All six** | 12740 | 552 | 160 (29%) | 79 (14.3%) | 800 | 175 (21.9%) | 386 (48.3%) | 597 | 159 (26.6%) | 480 | 16 (3.3%) |

Keys served (all six): clear 5377 · cloudy 2581 · cold-clear 1128 · partly-cloudy 908 · rain-possible 766 · fog 700 · rain 552 · wind 480 · uv 155 · thunder 38 · cold 34 · heat 19 · hail 2

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
