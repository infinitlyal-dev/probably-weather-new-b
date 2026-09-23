# Blend vs sources — does the blend beat every single source it blends?

Generated 2026-09-23T21:45:43.567Z by `review/accuracy/blend-vs-sources.mjs`. 2026-06-24 → 2026-09-22, six SA airports, METAR ground truth, the five archived stand-ins of `lib/sources.mjs`, and the blend production computes from them. REPORT ONLY — no weight or threshold was changed.

## Verdict

A cell is **yes** when the blend's score is better than every one of the five sources' — for the high, low and daily rain: the day-0 blend as served at 06:00; for hourly rain: the current hour's blended % (`hourly[localHour].rainChance`, the now-ladder's input) at every hour; for wind: `now.windKph`; for gusts: production's gust figure (the largest of Open-Meteo, WeatherAPI and Pirate). "by" is the margin in the metric's unit (°C, km/h, Brier). **(noise)** = the day-block bootstrap 95% interval of the difference includes zero: the sample cannot tell the two apart. † = a source that is not an input to that blend (Pirate has no hourly slot; MET Norway and Tomorrow.io carry no weight in the low; production reads no gust from them).

On rain the WeatherAPI stand-in's probability is Open-Meteo's own (identical at every hour), so OM and WA always score alike there.

| metric | Cape Town | Johannesburg | Durban | Gqeberha | Bloemfontein | George | All six |
|---|---|---|---|---|---|---|---|
| (a) daily high — MAE °C | **yes** — by 0.01 over MET (within noise) | **no** — TI by 0.05 (noise); OM by 0.03 (noise) | **no** — OM by 0.26; TI by 0.23; PW by 0.09 (noise) | **yes** — by 0.05 over OM (within noise) | **no** — TI by 0.33 | **yes** — by 0.08 over TI (within noise) | **no** — TI by < 0.01 (noise) |
| (b) daily low — MAE °C | **yes** — by 0.11 over WA (within noise) | **yes** — by 0.27 over WA | **no** — OM by 0.58; MET† by 0.58 | **no** — TI† by 0.59; WA by 0.26; MET† by 0.03 (noise) | **no** — OM by 1.72; MET† by 1.45; TI† by 0.53; WA by 0.21 | **yes** — by 0.02 over OM (within noise) | **no** — OM by 0.28; MET† by 0.12 (noise) |
| (c) rain, hourly probability — Brier | **yes** — by 0.0010 over TI (within noise) | **yes** — by 0.0012 over TI (within noise) | **yes** — by 0.0002 over TI (within noise) | **yes** — by 0.0087 over TI | **no** — MET by 0.0032 (noise); TI by 0.0025 (noise) | **yes** — by 0.0058 over TI (within noise) | **yes** — by 0.0027 over TI |
| (c) rain, daily chance — Brier | **yes** — by 0.0020 over OM (within noise) | **yes** — by 0.0037 over PW (within noise) | **yes** — by 0.0066 over OM (within noise) | **no** — OM by 0.0208; WA by 0.0208 | not scored | **no** — OM by 0.0228 (noise); WA by 0.0228 (noise) | **no** — OM by 0.0054 (noise); WA by 0.0054 (noise) |
| (d) wind, hourly mean — MAE km/h | **no** — PW by 0.92 | **no** — PW by 0.59; MET by 0.22; OM by 0.09 (noise) | **yes** — by 0.19 over OM | **yes** — by 0.05 over WA (within noise) | **yes** — by 0.32 over OM | **yes** — by 0.32 over MET | **yes** — by 0.30 over OM |
| (d) gust, hours with a METAR gust — MAE km/h | **no** — TI† by 0.65 (noise); OM by 0.55 (noise) | **yes** — by 1.15 over MET† (within noise) | **yes** — by 1.04 over MET† (within noise) | **no** — WA by 3.87; PW by 1.37 (noise); OM by 0.47 (noise) | **yes** — by 0.50 over OM (within noise) | **no** — WA by 3.86 (noise); MET† by 2.73 (noise); PW by 0.84 (noise); OM by 0.55 (noise) | **yes** — by 0.05 over WA (within noise) |

### Read-out

- (a) daily high: the blend beats every source at **3 of 6** airports; all six pooled: **no** — TI by < 0.01 (noise). Losses the sample can see (outside noise): Durban (OM, TI); Bloemfontein (TI).
- (b) daily low: the blend beats every source at **3 of 6** airports; all six pooled: **no** — OM by 0.28; MET† by 0.12 (noise). Losses the sample can see (outside noise): Durban (OM, MET†); Gqeberha (TI†, WA); Bloemfontein (OM, MET†, TI†, WA).
- (c) rain, hourly probability: the blend beats every source at **5 of 6** airports; all six pooled: **yes** — by 0.0027 over TI. No loss the sample can tell from noise.
- (c) rain, daily chance: the blend beats every source at **3 of 5** airports; all six pooled: **no** — OM by 0.0054 (noise); WA by 0.0054 (noise). Losses the sample can see (outside noise): Gqeberha (OM, WA).
- (d) wind, hourly mean: the blend beats every source at **4 of 6** airports; all six pooled: **yes** — by 0.30 over OM. Losses the sample can see (outside noise): Cape Town (PW); Johannesburg (PW, MET).
- (d) gust, hours with a METAR gust: production's gust figure beats every source at **3 of 6** airports; all six pooled: **yes** — by 0.05 over WA (within noise). Losses the sample can see (outside noise): Gqeberha (WA).
- The day's high read in the evening: at 18:00 the same day-0 blend has MAE 1.20 °C (bias −0.8) against 0.84 (−0.1) at 06:00; by then MET's high has dropped out and Tomorrow.io's "today" is only the evening. Every slot fed its full calendar day gives 0.83 — the weighting rules are identical in all three rows, so the evening loss comes from the windows (Tomorrow.io's evening-only "high", MET's high gone).
- The blended low (MAE 1.67 °C, bias +1.2) is worse than Open-Meteo's low alone (1.39, +0.4). It blends only OM, WA and PW (LOW_WEIGHTS); the PW stand-in's lows have bias +3.0 over all six and +8.0 at Bloemfontein, the WA stand-in's +1.1. Whether the real Pirate Weather carries the GFS stand-in's night-time error is not shown here.
- Wind: at Cape Town (source biases −7.8 to −5.5 km/h) and Johannesburg (source biases −6.9 to −4.2 km/h) every source reads under the airport anemometer. A weighted mean of five low numbers is still low, so there the least-low source beats the blend; elsewhere the blend wins.
- The blend is closest to the observed high on 11.5% of days (the most often closest is TI, 24.9%). An average is rarely the nearest on a given day; what it can win is the size of the misses, which is what MAE and Brier measure.
- Production's weight adjustments at 06:00: the ECMWF dedup halved WeatherAPI on 312 of 534 days; the MET boost fired on 3 (George). With the UKMO stand-in in MET's slot the boost is nearly idle, so this backtest says little about it.

## Method

- **Truth.** METAR (`lib/obs.mjs`), one report per local hour (the top-of-hour report when present). Daily max/min = the highest/lowest of those hourly temperatures (whole °C) on the local SAST day — the same hourly sampling the models' daily max/min use. A day is scored for temperature when ≥ 18 of its 24 hours carry a temperature and at least one falls in 04:00–08:59 (where the minimum usually is) and in 12:00–16:59 (the maximum).
- **Rain truth.** "Precipitation reported that hour" is `lib/obs.mjs`'s definition (RA/DZ/SN/SG/PL/GR/GS/UP in any report of the hour, not VC, not RE). An hour whose every report has `//` in the present-weather slot (an AUTO report without a present-weather sensor) observed nothing and is **not scored**; a day is scored for rain when ≥ 18 of its hours have a report and none of them is such an hour.
- **Sources.** Each stand-in on its own: daily max/min of its hourly temperatures on the local calendar day; hourly probability as production carries it for that slot (Open-Meteo, WeatherAPI, Tomorrow.io native %, MET Norway the mm → % proxy ladder, api/weather.js:1683–1687; Pirate's own % for reference only); daily chance = the day's maximum hourly % (Open-Meteo: `precipitation_probability_max`; MET: the daily mm ladder, :1597–1602), over the full calendar day; wind = hourly `wind_speed_10m` and `wind_gusts_10m`.
- **The blend** is production's arithmetic, copied from the handler with line numbers: base weights OM 0.30 · WA 0.22 · PW 0.13 · MET 0.20 · TI 0.15 (:876); WeatherAPI halved when its day high is within 0.5 °C of Open-Meteo's (:1889–1896); outside the Highveld (lat > −28 and lon > 25), MET → 0.40 and OM → 0.25 when MET's day high is > 5 °C above the OM/WA average (:1903–1917); hourly weights re-normalised over OM, WA, MET, TI (:1924–1926); the low blended with LOW_WEIGHTS — MET and Tomorrow.io at zero, the WeatherAPI halving kept (:1974); `resolveWeights` (:1935) and `wAvg` (:1978), rounding to 0.1 included. The adjustments are decided **per day** from that day's highs, and per hour for the hourly blends (MET's high drops out at noon, so the MET boost can only fire before it).
- **What each slot feeds day 0** when the app is opened at 06:00: Open-Meteo and WeatherAPI the calendar day; Pirate its daytime high (`temperatureHigh`, 06:01–18:00 in Pirate's documentation, :1456) and calendar-day minimum (:1445); MET Norway now → midnight, and nothing once fewer than 12 of today's hours remain (:1614–1647); Tomorrow.io now → midnight whatever is left (:1774–1780). "Full-day inputs" feeds every slot its calendar day instead (weighting only); "as served at 18:00" is the same day-0 blend read in the evening.
- **Hourly blends** (rain %, mm, the hourly-strip wind) use the four hourly slots — Pirate has none (:866–867); `now.windKph` blends all five current winds with the source weights (:2251). Production's gust figure is the largest of Open-Meteo's, WeatherAPI's and Pirate's (:2264–2265); MET and Tomorrow.io publish none (:1656, :1792).
- **Noise.** 95% intervals from 1000 day-block bootstrap draws (whole days resampled, so an hourly score's within-day correlation is kept).

## Coverage and how often production's weight adjustments fired

| | Cape Town | Johannesburg | Durban | Gqeberha | Bloemfontein | George |
|---|---|---|---|---|---|---|
| days scored, temperature | 90 | 90 | 90 | 90 | 85 | 89 |
| days scored, rain | 90 | 90 | 90 | 90 | 0 (85 dropped: unobserved hours) | 81 (8 dropped: unobserved hours) |
| hours scored, rain | 2164 | 2151 | 2154 | 2087 | 1355 (684 unobserved) | 2120 (25 unobserved) |
| hours scored, wind / with a gust group | 2164 / 40 | 2151 / 22 | 2152 / 39 | 2087 / 49 | 2035 / 11 | 2145 / 15 |
| WeatherAPI halved (ECMWF dedup), days at 06:00 | 37 | 66 | 21 | 61 | 69 | 58 |
| MET boost fired, days at 06:00 / hours | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 3 / 46 |

## (a) Daily high

MAE °C (bias: forecast − observed)

|  | Cape Town | Johannesburg | Durban | Gqeberha | Bloemfontein | George | All six |
|---|---|---|---|---|---|---|---|
| days | 90 | 90 | 90 | 90 | 85 | 89 | 534 |
| OM — Open-Meteo (best_match) | 1.04 (+0.4) | 0.63 (+0.1) | 0.73 (+0.2) | 0.79 (−0.3) | 1.25 (−0.9) | 1.24 (−0.8) | 0.94 (−0.2) |
| WA — WeatherAPI (stand-in: ECMWF IFS 0.25°) | 0.96 (−0.3) | 0.77 (−0.3) | 2.15 (+1.8) | 0.89 (−0.4) | 1.06 (−0.8) | 1.17 (−0.5) | 1.17 (−0.1) |
| PW — Pirate Weather (stand-in: GFS) | 1.21 (+0.6) | 0.98 (−0.2) | 0.90 (−0.4) | 1.33 (+1.0) | 1.29 (−0.5) | 1.32 (−0.9) | 1.17 (−0.1) |
| MET — MET Norway (stand-in: UKMO) | 0.77 (−0.0) | 1.12 (−1.0) | 1.27 (+0.8) | 0.93 (+0.5) | 1.01 (−0.6) | 1.25 (+1.0) | 1.06 (+0.1) |
| TI — Tomorrow.io (stand-in: ICON) | 1.03 (−0.1) | 0.61 (−0.2) | 0.76 (+0.1) | 0.97 (+0.6) | 0.66 (−0.3) | 0.98 (−0.5) | 0.84 (−0.1) |
| **blend, as served at 06:00** | 0.76 (+0.1) | 0.66 (−0.3) | 0.99 (+0.5) | 0.75 (+0.2) | 0.99 (−0.7) | 0.89 (−0.3) | 0.84 (−0.1) |
| blend, full-day inputs (sensitivity) | 0.77 (+0.1) | 0.66 (−0.3) | 0.96 (+0.6) | 0.75 (+0.2) | 0.97 (−0.7) | 0.87 (−0.3) | 0.83 (−0.1) |
| blend, as served at 18:00 (sensitivity) | 1.01 (−0.4) | 1.06 (−0.9) | 0.87 (−0.2) | 0.96 (−0.6) | 1.76 (−1.6) | 1.61 (−1.3) | 1.20 (−0.8) |

| share of days closest to the observation (ties split) | Cape Town | Johannesburg | Durban | Gqeberha | Bloemfontein | George | All six |
|---|---|---|---|---|---|---|---|
| OM — Open-Meteo (best_match) | 9.5% | 25% | 26.6% | 21.5% | 5.8% | 7.9% | 16.2% |
| WA — WeatherAPI (stand-in: ECMWF IFS 0.25°) | 23.1% | 14.3% | 5% | 16.9% | 12.1% | 16.9% | 14.7% |
| PW — Pirate Weather (stand-in: GFS) | 13.2% | 14.8% | 24.6% | 15% | 11% | 10.7% | 14.9% |
| MET — MET Norway (stand-in: UKMO) | 26.4% | 10.4% | 10.1% | 20% | 13.6% | 25.8% | 17.7% |
| TI — Tomorrow.io (stand-in: ICON) | 17.6% | 22% | 25.5% | 14.6% | 52.2% | 19.1% | 24.9% |
| **blend, as served at 06:00** | 10.1% | 13.5% | 8.2% | 12% | 5.4% | 19.7% | 11.5% |

## (b) Daily low

The three blend rows are identical by construction: LOW_WEIGHTS (:1974) gives MET Norway and Tomorrow.io no weight, so their windows never reach the low.

MAE °C (bias: forecast − observed)

|  | Cape Town | Johannesburg | Durban | Gqeberha | Bloemfontein | George | All six |
|---|---|---|---|---|---|---|---|
| days | 90 | 90 | 90 | 90 | 85 | 89 | 534 |
| OM — Open-Meteo (best_match) | 1.07 (−0.6) | 1.38 (−1.1) | 1.60 (+1.4) | 2.03 (+2.0) | 1.23 (+0.6) | 1.03 (+0.1) | 1.39 (+0.4) |
| WA — WeatherAPI (stand-in: ECMWF IFS 0.25°) | 1.07 (+0.5) | 1.32 (−1.0) | 2.88 (+2.7) | 1.69 (+1.6) | 2.73 (+2.6) | 1.09 (+0.2) | 1.79 (+1.1) |
| PW — Pirate Weather (stand-in: GFS) | 1.86 (+1.3) | 2.48 (+2.4) | 2.85 (+2.7) | 2.23 (+2.0) | 8.03 (+8.0) | 1.84 (+1.6) | 3.17 (+3.0) |
| MET — MET Norway (stand-in: UKMO) | 1.49 (+1.1) | 1.77 (−1.4) | 1.60 (+0.6) | 1.91 (+1.7) | 1.50 (−0.5) | 1.06 (−0.5) | 1.56 (+0.2) |
| TI — Tomorrow.io (stand-in: ICON) | 1.19 (+0.0) | 1.75 (−1.3) | 2.73 (+2.7) | 1.36 (+0.7) | 2.42 (+2.4) | 1.82 (+1.6) | 1.87 (+1.0) |
| **blend, as served at 06:00** | 0.96 (+0.1) | 1.05 (−0.3) | 2.18 (+2.1) | 1.95 (+1.9) | 2.94 (+2.8) | 1.01 (+0.4) | 1.67 (+1.2) |
| blend, full-day inputs (sensitivity) | 0.96 (+0.1) | 1.05 (−0.3) | 2.18 (+2.1) | 1.95 (+1.9) | 2.94 (+2.8) | 1.01 (+0.4) | 1.67 (+1.2) |
| blend, as served at 18:00 (sensitivity) | 0.96 (+0.1) | 1.05 (−0.3) | 2.18 (+2.1) | 1.95 (+1.9) | 2.94 (+2.8) | 1.01 (+0.4) | 1.67 (+1.2) |

| share of days closest to the observation (ties split) | Cape Town | Johannesburg | Durban | Gqeberha | Bloemfontein | George | All six |
|---|---|---|---|---|---|---|---|
| OM — Open-Meteo (best_match) | 28.3% | 9.8% | 29.8% | 5.5% | 44.7% | 18.5% | 22.6% |
| WA — WeatherAPI (stand-in: ECMWF IFS 0.25°) | 16.3% | 13.3% | 7.2% | 13.8% | 2.4% | 14.4% | 11.3% |
| PW — Pirate Weather (stand-in: GFS) | 8.5% | 16.7% | 7% | 12.5% | 2.4% | 11.2% | 9.8% |
| MET — MET Norway (stand-in: UKMO) | 10.4% | 19.3% | 40% | 13.3% | 37.1% | 32.4% | 25.3% |
| TI — Tomorrow.io (stand-in: ICON) | 21.1% | 8.3% | 5.6% | 46.7% | 8.8% | 7.1% | 16.4% |
| **blend, as served at 06:00** | 15.4% | 32.6% | 10.4% | 8.2% | 4.7% | 16.3% | 14.7% |

## (c) Rain

### Hourly probability — Brier score (skill against the sample's own rain frequency). Lower Brier is better. PW† is not in the hourly blend (no hourly slot); MET is its mm → % proxy; WA's stand-in probability is OM's own

|  | Cape Town | Johannesburg | Durban | Gqeberha | Bloemfontein | George | All six |
|---|---|---|---|---|---|---|---|
| hours | 2164 | 2151 | 2154 | 2087 | 1355 | 2120 | 12031 |
| hours with rain | 4.8% | 3.1% | 8.1% | 9.1% | 3.8% | 10.1% | 6.6% |
| OM — Open-Meteo (best_match) | 0.0444 (+0.020) | 0.0233 (+0.228) | 0.0499 (+0.328) | 0.0680 (+0.178) | 0.0469 (−0.296) | 0.0664 (+0.271) | 0.0499 (+0.197) |
| WA — WeatherAPI (stand-in: ECMWF IFS 0.25°) | 0.0444 (+0.020) | 0.0233 (+0.228) | 0.0499 (+0.328) | 0.0680 (+0.178) | 0.0469 (−0.296) | 0.0664 (+0.271) | 0.0499 (+0.197) |
| PW — Pirate Weather (stand-in: GFS) | 0.0340 (+0.251) | 0.0222 (+0.263) | 0.0561 (+0.244) | 0.0786 (+0.051) | 0.0416 (−0.149) | 0.0640 (+0.298) | 0.0497 (+0.199) |
| MET — MET Norway (stand-in: UKMO) | 0.0311 (+0.315) | 0.0201 (+0.334) | 0.0440 (+0.408) | 0.0625 (+0.245) | 0.0280 (+0.227) | 0.0672 (+0.263) | 0.0429 (+0.309) |
| TI — Tomorrow.io (stand-in: ICON) | 0.0305 (+0.328) | 0.0178 (+0.409) | 0.0346 (+0.534) | 0.0596 (+0.280) | 0.0287 (+0.208) | 0.0608 (+0.333) | 0.0391 (+0.370) |
| **blend, the current hour (`hourly[localHour].rainChance`)** | 0.0295 (+0.350) | 0.0166 (+0.450) | 0.0344 (+0.536) | 0.0508 (+0.386) | 0.0312 (+0.139) | 0.0549 (+0.397) | 0.0364 (+0.413) |

Reliability, all six (forecast bin → share of those hours with rain reported; n):

| forecast % | OM | WA | PW | MET | TI | **blend** |
|---|---|---|---|---|---|---|
| 0–10 | 0.9% (9928) | 0.9% (9928) | 1.4% (10320) | 2.4% (10960) | 1.7% (10661) | 1% (10104) |
| 10–20 | 6.6% (333) | 6.6% (333) | 10.9% (258) | — | 19.7% (259) | 7.7% (390) |
| 20–30 | 13% (247) | 13% (247) | 20.6% (180) | 35% (642) | 26.5% (196) | 16.9% (254) |
| 30–40 | 13.9% (166) | 13.9% (166) | 22.7% (132) | — | 39.3% (168) | 24.9% (217) |
| 40–50 | 23.4% (154) | 23.4% (154) | 29.7% (101) | 64.9% (188) | 37.7% (130) | 26.7% (206) |
| 50–60 | 25.3% (154) | 25.3% (154) | 28% (118) | — | 44.2% (120) | 35.5% (200) |
| 60–70 | 22.4% (125) | 22.4% (125) | 31.2% (109) | 80% (140) | 50% (100) | 49.3% (223) |
| 70–80 | 30.8% (146) | 30.8% (146) | 40.9% (127) | — | 67.6% (102) | 70.5% (193) |
| 80–90 | 40.1% (182) | 40.1% (182) | 44.4% (171) | 82.2% (101) | 59.8% (92) | 83.9% (155) |
| 90–100 | 69.1% (596) | 69.1% (596) | 65% (515) | — | 83.3% (203) | 83.1% (89) |
| reliability term (lower = better calibrated) | 0.0139 | 0.0139 | 0.0102 | 0.0032 | 0.0015 | 0.0022 |
| resolution term (higher = sharper separation) | 0.0257 | 0.0257 | 0.0223 | 0.0223 | 0.0239 | 0.0275 |

Yes/no at the now-ladder's own lines, all six: **might rain** = hour % ≥ 30 (`RAIN_POSSIBLE_NOW_MIN_PROB`); **rain-now pair** = % ≥ 60 **and** ≥ 0.3 mm (`RAIN_NOW_MIN_PROB`, `RAIN_NOW_MIN_MM`) — the numeric half of the rain-now rung; its third condition, ≥ 2 sources describing rain, is not a per-source quantity and is scored with the whole resolver in `run-eval.mjs`. MET's % is its mm proxy, so its pair is simply ≥ 1 mm.

| line | contender | POD (rain hours caught) | FAR (yes-hours dry) | CSI | frequency bias | hits / false alarms / misses |
|---|---|---|---|---|---|---|
| might rain ≥ 30% | OM | 82% | 56.9% | 39.4% | 1.90 | 656 / 867 / 144 |
| might rain ≥ 30% | WA | 82% | 56.9% | 39.4% | 1.90 | 656 / 867 / 144 |
| might rain ≥ 30% | PW | 73.8% | 53.7% | 39.8% | 1.59 | 590 / 683 / 210 |
| might rain ≥ 30% | MET | 39.6% | 26.1% | 34.8% | 0.54 | 317 / 112 / 483 |
| might rain ≥ 30% | TI | 63.9% | 44.2% | 42.4% | 1.14 | 511 / 404 / 289 |
| might rain ≥ 30% | **blend** | 78.8% | 50.9% | 43.4% | 1.60 | 630 / 653 / 170 |
| rain-now pair ≥ 60% & ≥ 0.3 mm | OM | 52.4% | 30.5% | 42.6% | 0.75 | 419 / 184 / 381 |
| rain-now pair ≥ 60% & ≥ 0.3 mm | WA | 56.9% | 35.1% | 43.5% | 0.88 | 455 / 246 / 345 |
| rain-now pair ≥ 60% & ≥ 0.3 mm | PW | 45.3% | 37.4% | 35.6% | 0.72 | 362 / 216 / 438 |
| rain-now pair ≥ 60% & ≥ 0.3 mm | MET | 24.4% | 19.1% | 23% | 0.30 | 195 / 46 / 605 |
| rain-now pair ≥ 60% & ≥ 0.3 mm | TI | 34.8% | 27% | 30.8% | 0.48 | 278 / 103 / 522 |
| rain-now pair ≥ 60% & ≥ 0.3 mm | **blend** | 51.9% | 25.6% | 44% | 0.70 | 415 / 143 / 385 |

| might-rain line, CSI by city | Cape Town | Johannesburg | Durban | Gqeberha | Bloemfontein | George | All six |
|---|---|---|---|---|---|---|---|
| OM — Open-Meteo (best_match) | 31.8% | 43.3% | 43.1% | 40.9% | 26.9% | 42.9% | 39.4% |
| WA — WeatherAPI (stand-in: ECMWF IFS 0.25°) | 31.8% | 43.3% | 43.1% | 40.9% | 26.9% | 42.9% | 39.4% |
| PW — Pirate Weather (stand-in: GFS) | 38.2% | 43.3% | 44% | 36.5% | 26.6% | 43.8% | 39.8% |
| MET — MET Norway (stand-in: UKMO) | 32.2% | 39.1% | 43.6% | 29.4% | 29.2% | 33.5% | 34.8% |
| TI — Tomorrow.io (stand-in: ICON) | 41% | 45.9% | 49.8% | 39.8% | 33% | 41.7% | 42.4% |
| **blend, the current hour (`hourly[localHour].rainChance`)** | 38.3% | 47.1% | 49.3% | 42.5% | 30.7% | 45.4% | 43.4% |

### Daily chance against "precipitation reported that day" — Brier (skill). Sources: their own calendar-day figure; the blend: as served at 06:00 (MET and Tomorrow.io then cover 06:00–24:00)

|  | Cape Town | Johannesburg | Durban | Gqeberha | Bloemfontein | George | All six |
|---|---|---|---|---|---|---|---|
| days | 90 | 90 | 90 | 90 | 0 | 81 | 441 |
| days with rain | 26.7% | 11.1% | 25.6% | 38.9% | — | 48.1% | 29.7% |
| OM — Open-Meteo (best_match) | 0.0930 (+0.524) | 0.0187 (+0.811) | 0.0819 (+0.570) | 0.0539 (+0.773) | — | 0.1929 (+0.227) | 0.0859 (+0.588) |
| WA — WeatherAPI (stand-in: ECMWF IFS 0.25°) | 0.0930 (+0.524) | 0.0187 (+0.811) | 0.0819 (+0.570) | 0.0539 (+0.773) | — | 0.1929 (+0.227) | 0.0859 (+0.588) |
| PW — Pirate Weather (stand-in: GFS) | 0.0980 (+0.499) | 0.0163 (+0.835) | 0.1199 (+0.370) | 0.0816 (+0.657) | — | 0.2620 (−0.050) | 0.1126 (+0.461) |
| MET — MET Norway (stand-in: UKMO) | 0.1183 (+0.395) | 0.0307 (+0.689) | 0.1204 (+0.367) | 0.1694 (+0.287) | — | 0.2820 (−0.130) | 0.1413 (+0.323) |
| TI — Tomorrow.io (stand-in: ICON) | 0.1104 (+0.435) | 0.0176 (+0.822) | 0.0986 (+0.482) | 0.1246 (+0.476) | — | 0.2681 (−0.074) | 0.1209 (+0.421) |
| **blend, as served at 06:00** | 0.0910 (+0.535) | 0.0126 (+0.872) | 0.0753 (+0.604) | 0.0747 (+0.686) | — | 0.2157 (+0.136) | 0.0914 (+0.562) |
| blend, full-day inputs (sensitivity) | 0.0874 (+0.553) | 0.0158 (+0.840) | 0.0766 (+0.597) | 0.0684 (+0.712) | — | 0.2113 (+0.154) | 0.0895 (+0.572) |
| blend, as served at 18:00 (sensitivity) | 0.1029 (+0.474) | 0.0144 (+0.854) | 0.0796 (+0.582) | 0.0867 (+0.635) | — | 0.2230 (+0.107) | 0.0988 (+0.527) |

Reliability, all scored days (forecast bin → share of those days with rain reported; n):

| forecast % | OM | WA | PW | MET | TI | **blend** |
|---|---|---|---|---|---|---|
| 0–20 | 7% (298) | 7% (298) | 10.1% (317) | 8.9% (305) | 11.9% (336) | 7.4% (309) |
| 20–40 | 29.2% (24) | 29.2% (24) | 61.5% (13) | 54.7% (64) | 71.4% (21) | 54.2% (24) |
| 40–60 | 90% (10) | 90% (10) | 42.9% (7) | 90% (20) | 77.3% (22) | 64% (25) |
| 60–80 | 66.7% (18) | 66.7% (18) | 63.6% (11) | 95.8% (24) | 89.5% (19) | 89.7% (39) |
| 80–100 | 90.1% (91) | 90.1% (91) | 87.1% (93) | 100% (28) | 97.7% (43) | 100% (44) |
| reliability term | 0.0068 | 0.0068 | 0.0107 | 0.0431 | 0.0220 | 0.0114 |
| resolution term | 0.1238 | 0.1238 | 0.1032 | 0.1108 | 0.1042 | 0.1258 |

Yes/no at the daily ladder's rain lines (≥ 30% → rain, :3407; ≥ 60% → rain, :3398), all scored days:

| line | contender | POD | FAR | CSI | frequency bias | hits / false alarms / misses |
|---|---|---|---|---|---|---|
| ≥ 30% | OM | 81.7% | 15.7% | 70.9% | 0.97 | 107 / 20 / 24 |
| ≥ 30% | WA | 81.7% | 15.7% | 70.9% | 0.97 | 107 / 20 / 24 |
| ≥ 30% | PW | 71.8% | 19.7% | 61% | 0.89 | 94 / 23 / 37 |
| ≥ 30% | MET | 52.7% | 4.2% | 51.5% | 0.55 | 69 / 3 / 62 |
| ≥ 30% | TI | 67.2% | 9.3% | 62.9% | 0.74 | 88 / 9 / 43 |
| ≥ 30% | **blend** | 78.6% | 14.2% | 69.6% | 0.92 | 103 / 17 / 28 |
| ≥ 30% | blend, full-day inputs | 78.6% | 14.2% | 69.6% | 0.92 | 103 / 17 / 28 |
| ≥ 30% | blend at 18:00 | 77.9% | 13.6% | 69.4% | 0.90 | 102 / 16 / 29 |
| ≥ 60% | OM | 71.8% | 13.8% | 64.4% | 0.83 | 94 / 15 / 37 |
| ≥ 60% | WA | 71.8% | 13.8% | 64.4% | 0.83 | 94 / 15 / 37 |
| ≥ 60% | PW | 67.2% | 15.4% | 59.9% | 0.79 | 88 / 16 / 43 |
| ≥ 60% | MET | 38.9% | 1.9% | 38.6% | 0.40 | 51 / 1 / 80 |
| ≥ 60% | TI | 45% | 4.8% | 44% | 0.47 | 59 / 3 / 72 |
| ≥ 60% | **blend** | 60.3% | 4.8% | 58.5% | 0.63 | 79 / 4 / 52 |
| ≥ 60% | blend, full-day inputs | 61.8% | 6.9% | 59.1% | 0.66 | 81 / 6 / 50 |
| ≥ 60% | blend at 18:00 | 51.1% | 4.3% | 50% | 0.53 | 67 / 3 / 64 |

## (d) Wind

### Hourly mean wind — MAE km/h (bias: forecast − METAR 10-minute mean)

|  | Cape Town | Johannesburg | Durban | Gqeberha | Bloemfontein | George | All six |
|---|---|---|---|---|---|---|---|
| hours | 2164 | 2151 | 2152 | 2087 | 2035 | 2145 | 12734 |
| OM — Open-Meteo (best_match) | 7.70 (−7.3) | 5.45 (−5.0) | 3.33 (−0.2) | 4.51 (−0.1) | 3.23 (−1.1) | 3.90 (−2.0) | 4.70 (−2.7) |
| WA — WeatherAPI (stand-in: ECMWF IFS 0.25°) | 7.21 (−6.7) | 6.02 (−5.6) | 4.54 (−2.1) | 4.37 (−0.9) | 3.44 (+0.2) | 3.74 (−1.6) | 4.91 (−2.8) |
| PW — Pirate Weather (stand-in: GFS) | 6.26 (−5.5) | 4.95 (−4.2) | 5.26 (+4.4) | 4.51 (−1.8) | 4.31 (+3.1) | 3.93 (+0.2) | 4.88 (−0.6) |
| MET — MET Norway (stand-in: UKMO) | 7.21 (−6.8) | 5.32 (−4.6) | 4.50 (+2.2) | 5.45 (−4.4) | 3.81 (+0.3) | 3.56 (−0.7) | 4.99 (−2.4) |
| TI — Tomorrow.io (stand-in: ICON) | 8.07 (−7.8) | 7.11 (−6.9) | 3.42 (−0.8) | 6.49 (−5.7) | 3.29 (−1.8) | 3.69 (−2.2) | 5.36 (−4.2) |
| **blend, `now.windKph` (the hero)** | 7.17 (−6.9) | 5.54 (−5.2) | 3.14 (+0.4) | 4.32 (−2.3) | 2.91 (−0.1) | 3.24 (−1.4) | 4.40 (−2.6) |
| blend, hourly strip (4 hourly sources) | 7.39 (−7.1) | 5.69 (−5.4) | 3.33 (−0.2) | 4.38 (−2.4) | 3.04 (−0.7) | 3.35 (−1.6) | 4.55 (−2.9) |

### Gusts — MAE km/h (bias), only the hours whose METAR carries a gust group (reported when gusts exceed the mean by ≥ 10 kt, so this is the gusty tail, not all hours). MET† and TI† gusts exist in the archive but production reads none

|  | Cape Town | Johannesburg | Durban | Gqeberha | Bloemfontein | George | All six |
|---|---|---|---|---|---|---|---|
| hours | 40 | 22 | 39 | 49 | 11 | 15 | 176 |
| OM — Open-Meteo (best_match) | 10.42 (−10.0) | 11.05 (−9.8) | 9.14 (+0.5) | 10.87 (+8.4) | 6.83 (−3.8) | 12.50 (+7.4) | 10.29 (−0.7) |
| WA — WeatherAPI (stand-in: ECMWF IFS 0.25°) | 10.98 (+8.9) | 13.25 (−12.2) | 10.95 (−9.1) | 7.46 (+3.1) | 8.35 (−2.1) | 9.19 (+2.9) | 9.96 (−0.5) |
| PW — Pirate Weather (stand-in: GFS) | 12.50 (−8.4) | 14.81 (−14.2) | 16.09 (−15.9) | 9.97 (−5.7) | 9.58 (−6.2) | 12.21 (−5.0) | 12.67 (−9.6) |
| MET — MET Norway (stand-in: UKMO) | 14.08 (−13.9) | 10.54 (−10.2) | 8.17 (−1.8) | 13.03 (−11.1) | 8.84 (−8.7) | 10.33 (−5.0) | 11.39 (−8.9) |
| TI — Tomorrow.io (stand-in: ICON) | 10.33 (−9.2) | 11.79 (−10.8) | 9.82 (+0.6) | 11.50 (−10.9) | 10.11 (−2.0) | 22.84 (−22.8) | 11.78 (−8.4) |
| **production gust (largest of OM, WA, PW)** | 10.98 (+8.9) | 9.39 (−7.5) | 7.13 (+2.9) | 11.34 (+9.6) | 6.33 (+0.7) | 13.05 (+9.6) | 9.91 (+5.3) |

## What the stand-ins cannot show

- **Four of the five sources are approximations.** Only Open-Meteo is the production provider itself (same endpoint family and variables). WeatherAPI is stood in for by ECMWF IFS 0.25°, Pirate Weather by GFS, MET Norway by the UK Met Office global model, Tomorrow.io by ICON (`lib/sources.mjs`). None of them carries the real provider's own post-processing, blending or vocabulary.
- **The WeatherAPI stand-in adds nothing independent on rain.** Its hourly probability is identical to Open-Meteo's in 13104 of 13104 hours (both are the archive's ECMWF-ensemble probability) and its amount in 11593; its temperatures do differ. Real WeatherAPI has its own `chance_of_rain`, its "Patchy rain possible" habit and the code-1000/1003 clamps (:1321, :1339–1342, :1373–1377) — none reproduced.
- **The MET Norway stand-in is more independent than MET Norway is.** MET's Locationforecast uses ECMWF's high-resolution model everywhere outside the Nordic region (MET's own documentation), so in production MET, Open-Meteo and — by the handler's own assumption — WeatherAPI may all be ECMWF underneath: the live blend has less model diversity than this backtest, which should shrink any averaging benefit measured here. The UKMO stand-in also has **no probability field** (its archived `precipitation_probability` is 0 in 13104 of 13104 hours), so it is scored the way production scores MET: its amount through the mm → % ladder.
- **Pirate Weather** is NOAA GFS/GEFS with Pirate's own processing; its daily `precipProbability` is a GEFS ensemble figure, stood in for by the day's maximum hourly GFS-derived %. Its daytime-window high (06:01–18:00) is reproduced in the blend input.
- **Tomorrow.io's radar is absent.** Its `precipitationIntensity` is radar-informed and drives the override (current hour > 0.5 mm/h → rain); there is no radar archive, so neither the override nor the radar-shaped hourly amounts are in this backtest (ICON's model amounts stand in). The live sample caught the override firing at Johannesburg under a CAVOK METAR.
- **"Now" values are forecast hours here.** Production's current wind, temperature and description come from each provider's current-conditions block (WeatherAPI's is station-influenced, Open-Meteo's a 15-minute value, MET's the first forecast step); the stand-ins can only offer the forecast value for that hour.
- **Archive, not the forecast the app showed.** Open-Meteo's historical-forecast archive stitches together the first hours of each successive model run, so every hour here is a short-lead forecast (a few hours old). The app at 06:00 showed the afternoon from older runs; real errors are larger than these, and whether blending helps more or less at longer leads is not measured here.
- **Production's day-0 windows change through the day.** The morning read (06:00) is scored; the "18:00" rows show the same blend in the evening, when MET's high has dropped out and Tomorrow.io's "today" is only the evening hours.
- **An airport is not the city, and a grid cell is not a point.** FACT is on the Cape Flats, not in Strand; FALE (King Shaka) is some 35 km north of central Durban; FAOR is out on the Highveld east of Johannesburg. Each model answers for its own grid cell (the archive snaps each model to its grid point; e.g. the stand-ins for Gqeberha sit at −33.91, 25.55 against the runway at −33.98, 25.62). A 9–25 km cell's rain probability is expected to exceed the rain frequency at one point — for every source alike.
- **METAR sampling.** Hourly whole-degree temperatures (the true extremes fall between reports); present weather only at report time (a shower between reports is seen only if a special report was issued); no rain amounts in SA METARs, so amounts can only be scored as yes/no; Bloemfontein's overnight AUTO reports (21:00–05:00 SAST, 684 hours) observe no present weather — those hours are not scored and **no Bloemfontein day can be scored for daily rain**; gusts appear only when they exceed the mean by ≥ 10 kt.
- **Hour alignment.** The archive's hour-T values describe the hour ending at T (Open-Meteo convention); the METAR hour T holds the T:00 report and any specials to T:59; production's own MET and WeatherAPI hourly values describe the hour starting at T. The offset is the same for every stand-in, so it cannot favour one — it does blur every hourly rain score a little.
- **One winter.** 2026-06-24 → 2026-09-22: Cape frontal rain, a dry Highveld winter, no summer convection. The ranking may differ in summer.
- **The existing replay (`lib/replay.mjs`) differs from production in two places this script does not share:** it blends the day-0 low with the high's weights (production uses LOW_WEIGHTS, :1974–1975, :2069), and it feeds MET and Tomorrow.io their full-day high/low at every hour (production: MET null after ~12:00, Tomorrow.io rest-of-day). Its line citations also predate a ~20-line shift in api/weather.js (e.g. base weights now :876, not :856).

## Files

- `review/accuracy/blend-vs-sources.mjs` — this measurement (`node review/accuracy/blend-vs-sources.mjs`, a few seconds; `--hour`, `--late`, `--boot` change the read hours and the draws).
- `results/blend-vs-sources.json` — every number above, the bootstrap intervals, and every scored day (`days.columns` / `days.rows`).
- `results/blend-vs-sources-hours.csv` — every scored hour with each source, the blends and the observation (git-ignored, regenerated).
- `results/live-sample-2026-09-23.md` / `.json` — one live read of production at the six airports (an anecdote).


## Review (Sol, gpt-5.6-sol, 2026-09-24)

Sol read `blend-vs-sources.mjs` against the production blend (`api/weather.js` 1880–2045) and the
report. One MEDIUM, recorded here rather than patched (the session's Sol budget was spent, and an
unreviewed change to the harness would be worse than a documented limit):

- `blend5` fills every missing source slot with a record before `resolveWeights`, so the harness can
  never take production's equal-weight fallback for the daily LOW when Open-Meteo, WeatherAPI and
  Pirate are all missing but MET / Tomorrow.io answered (api/weather.js 1935–1975). **No effect on
  the numbers above**: every archive slot answered on every scored day, so that branch never arises
  in this sample. It would matter only if the harness is later run on data with gaps.
