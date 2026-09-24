# SA weather check — what the phone showed in the weather that matters (launch run)

Resolver replay `results/launch-hours.csv` (the shipped rules, 24 Jun → 22 Sep 2026, six airports, stand-ins for four sources) and the day rows of `forecast-candidates.mjs`. Winter sample.

| weather | where | hours | phone got it | share | what counts | note |
|---|---|---:|---:|---:|---|---|
| Cape cold front (rain + wind) | Cape Town | 20 | 20 | 100% | phone showed rain, might-rain, storm or wind |  |
| South-easter (dry, SE, ≥30 km/h or gusts ≥45) | Cape Town | 114 | 75 | 66% | phone showed wind | winter sample: the south-easter is a summer wind |
| Fog (FG reported) | Cape Town | 101 | 71 | 70% | phone showed fog |  |
| Fog (FG reported) | Gqeberha | 10 | 4 | 40% | phone showed fog |  |
| Fog (FG reported) | George | 37 | 13 | 35% | phone showed fog |  |
| Fog (FG reported) | Durban | 12 | 9 | 75% | phone showed fog |  |
| Thunderstorm (TS reported) | Johannesburg | 16 | 14 | 88% | phone showed storm or rain | Highveld storm season starts in October — few in this sample |
| Thunderstorm (TS reported) | Bloemfontein | 12 | 12 | 100% | phone showed storm or rain | Highveld storm season starts in October — few in this sample |

**Frost nights** (airport minimum ≤ 2 °C) — the served overnight low (as served at 06:00):

| where | nights | served low MAE (bias) | said ≤ 3 °C | drop Pirate MAE | Open-Meteo alone MAE |
|---|---:|---|---:|---:|---:|
| Johannesburg | 5 | 1.7 (1.7) | 2 | 0.9 | 1 |
| Bloemfontein | 47 | 3.5 (3.5) | 22 | 1.6 | 1.1 |
| George | 0 | null (null) | 0 | null | null |

**KZN heat:** Durban days with an observed high ≥ 28 °C: 2 (served high bias -1.1 °C). Summer heat is not in this sample.
