# How the hero condition is decided — the whole chain, as a decision table

Written 22 September 2026 for Al, after the Strand incident (`review/condition-incident-20260922/INCIDENT.md`). Everything below is read from the code as it now stands; where a rule changed today the row says **CHANGED** and what it was before. Measurements come from `review/accuracy/` (12,740 station-hours, six SA airports, METAR ground truth).

## 0. What changed today, in one screen

| | before | after |
|---|---|---|
| "Rain's here." (key `rain`) on the hero | 31% chance for the hour was enough (server), or a 50% four-hour maximum (phone) | needs evidence for **this hour**: ≥ 2 sources describing rain, ≥ 60% blended chance **and** ≥ 0.3 mm blended amount — or Tomorrow.io radar > 0.5 mm/h. A probability is "Might rain." at most. |
| "Windy" | blended **mean** wind ≥ 30 (or ≥ 25 below the rain rungs); gusts never read; sat under a 30% rain chance and under high UV | mean ≥ 25 **or largest gust ≥ 55 km/h** (Open-Meteo, WeatherAPI, Pirate); above might-rain, cloud and UV; below rain that is actually falling |
| "Might rain." (key `rain-possible`) | ≥ 20% for the hour, then usually demoted to clear by the single-source guard | ≥ 30% for the hour (the line the stats row calls "Possible"); a probability might-rain is not demoted |
| Phone: hero vs stats | one number worded two ways in two places | one shared word ladder (`rainStatWord`), a test that fails if the hero says rain beside "Unlikely" |
| Daily ladder (week strip, day cards) | probability rungs | **unchanged** — measured as well calibrated, see §8 |
| Measured on 12,740 hours (phone) | false "Rain's here.": 55% of rain hours dry at the station (36% allowing ±1 h); windy hours served a sky-only hero: 34% | 29% (14%); 20% |

## 1. Each source's words — how raw codes become descriptions

The hero never sees numbers from the sources directly. Each source's code is mapped to an English description string, and every later rule that talks about "rain" is a keyword test on that string (`categorizeDesc`: thunder/storm → storm; snow/sleet/hail/freezing/ice → cold; rain/drizzle/shower/precip → rain; overcast or cloud (not partly/mainly) → cloudy; fog/mist/haze/smoke → fog; else clear).

| source | field used for "now" | rain words it can produce | quirks that matter |
|---|---|---|---|
| Open-Meteo | `current.weather_code` (WMO) | 51/53/55 drizzle, 61/63/65 rain, 80/81/82 rain showers, 95/96/99 thunderstorm | code 51 "Light drizzle" is common on dry days: counts as a rain vote |
| WeatherAPI | `current.condition.code` | 1063 **"Patchy rain possible"**, 1150–1195 drizzle/rain, 1240–1246 showers, 1273/1276 thunder | 1063 is a maybe but reads as rain; 1000 with 0 mm → "Clear sky", 1003 → "Partly cloudy" (clamps). Description vote weight 0.1. |
| Pirate Weather | `currently.icon` (icon=pirate) | rain, drizzle, light-rain, heavy-rain, precipitation, **possible-rain-\*** ("Possible rain"), thunderstorm | "Possible rain" reads as rain |
| MET Norway | `next_1_hours.summary.symbol_code` (a forecast for the coming hour) | lightrain… heavyrainshowersandthunder (full set) | no gusts in the compact endpoint; its rain **%** is a proxy: mm in the hour → 0 / 20 / 40 / 60 / 80 |
| Tomorrow.io | `weatherCode` of the current interval | 4000 drizzle, 4001 rain, 4200 light rain, 4201 heavy rain, 8000 thunderstorm | also `precipitationIntensity` (mm/h, radar-informed) — the one near-observation |

**CHANGED:** for the new rain-now vote count, a description containing "possible" ("Patchy rain possible", "Possible rain") does not count as a source describing rain. Everywhere else (description vote, guards) it still buckets as rain.

## 2. Weights and blends

| step | rule | code |
|---|---|---|
| base weights | OM 0.30 · WA 0.22 · Pirate 0.13 · MET 0.20 · TI 0.15 | api/weather.js:856 |
| ECMWF dedup | OM and WA today-high within 0.5 °C → WA weight halved | :1864 |
| MET boost | outside the Highveld, MET today-high > 5 °C above the OM/WA average → OM 0.25, MET 0.40 | :1877 |
| hourly weights | the four hourly sources (OM, WA, MET, TI — Pirate is daily/current only), renormalised | :1898 |
| any blend | weighted average over the sources that returned a number (`wAvg`, rounded to 0.1) | :1955 |
| cloud | **modal** bucket (clear < 25, partly < 55, mostly < 80, overcast), median inside the winning bucket | `pickModalCloud` |
| description winner | category-aware weighted vote with weights 1 · **0.1** (WA) · 1 · 1 · 1; the category with most weight wins, its heaviest description is the label | `pickWeightedMostCommon`, `DESC_WEIGHTS` |

## 3. What the now-selector is given

| input | how it is made | note |
|---|---|---|
| `desc` | weighted description winner across the five current descriptions | "Partly cloudy" in the incident |
| `rainChance` | blended **current-hour** probability from the hourly arrays (OM pp, WA chance_of_rain, MET mm-proxy, TI pp) | 31.2 in the incident (OM 73, TI 10) |
| `precipMm` **CHANGED (new)** | blended current-hour precipitation amount (OM mm, WA precip_mm, MET mm, TI intensity) | 0.2 in the incident |
| `rainVotes` **CHANGED (new)** | sources whose current description is rain and not a "possible" | 0 in the incident |
| `windKph` | blended mean of the five current winds | 10.9 |
| `gustKph` **CHANGED (new)** | largest current gust of OM, WA (`current.gust_kph`, newly read), Pirate | 20.1 |
| `tempC`, `feelsLikeC` | blended | |
| `uvIndex` | blended current-hour UV (OM, WA) — null at night | |
| `cloudPct` | modal current-hour cloud | 61.7 |
| `isDay` | Open-Meteo/Pirate sunrise–sunset for now | |
| `dailyHighC`, `dailyLowC` | blended day-0 | gates the cold rungs |
| `sourceDescs` | the five raw descriptions | hail/thunder consensus |

## 4. The NOW ladder (`deriveCondition`, `now: true`) — first matching row wins

| # | if | key | reason | status |
|---|---|---|---|---|
| 0a | one source says hail and another says storm/rain/shower/drizzle/thunder | hail | two-source-consensus-hail | unchanged |
| 0b | one says thunder/lightning, another corroborates | thunder | two-source-consensus-thunder | unchanged |
| 1 | winner desc has thunder/storm/tornado | storm | desc-storm-keyword | unchanged |
| 1.5 | cold signal (feels ≤ 12 or low ≤ 6 or temp ≤ 12) + clear sky (cloud < 30) + dry (chance < 20) + day high ≤ 18 + no precip/fog desc | cold-clear | dry-cold-clear-sky | unchanged |
| 2 | feels ≤ −5 or temp ≤ 0 | cold | extreme-cold-* | unchanged |
| 3 | desc has snow/sleet/ice/hail/blizzard/freezing | cold | desc-winter-precip | unchanged |
| 4 | temp ≥ 35 or feels ≥ 38 | heat | extreme-heat-* | unchanged |
| **5n** | **rainVotes ≥ 2 AND rainChance ≥ 60 AND precipMm ≥ 0.3** | rain | rain-now | **CHANGED** — was `rainChance ≥ 60 → rain` |
| **6n** | **mean wind ≥ 25, or gust ≥ 55** | wind | sustained-wind / gust-wind | **CHANGED** — was mean ≥ 30 here and ≥ 25 lower down, gusts unread, and both sat under a 30% rain chance and under high UV |
| 7n | day, UV ≥ 8, cloud < 55 and not overcast, day high ≥ 15 | uv | high-uv-with-temp-gate | unchanged rule, now below wind |
| **8n** | winner desc has rain/drizzle/shower/precip (but 5n failed) | rain-possible | desc-rain-unconfirmed | **CHANGED** — was `rain` |
| **9n** | rainChance ≥ 30 | rain-possible | rain-possible-prob | **CHANGED** — was `rainChance ≥ 30 → rain` (moderate-rain-prob); the old `≥ 20 → rain-possible` is gone |
| 10n | cloud ≥ 80 (or desc overcast with no cloud number) | cloudy | overcast | unchanged |
| 13 | desc has fog/mist/haze | fog | desc-fog-keyword | unchanged |
| 14 | temp ≤ 10 and day high ≤ 14 | cold | chilly-with-daily-gate | unchanged |
| 15 | temp ≥ 30 | heat | warm-temp | unchanged |
| 16 | day, UV ≥ 6, cloud < 40, day high ≥ 15 | uv | moderate-uv-with-temp-gate | unchanged |
| 17 | cloud ≥ 55 (or desc cloudy) | cloudy | mostly-cloudy | unchanged |
| 18 | cloud 30–54 (or desc partly/mainly clear/fair) | partly-cloudy | partly-cloudy | unchanged |
| 19 | desc has clear/sunny/fair/wind | clear | desc-clear-keyword | unchanged |
| 20 | — | clear | fallback-clear | unchanged |

Why these numbers (all from `review/accuracy/results/before.md`):

- **Rain now.** Across 12,740 hours, when the shipped rules said rain, the station was dry in the same hour 55% of the time. Hours in the 30–60% band were wet within ±1 h only 40–57% of the time; two sources describing rain, on their own, only 35%. Requiring the vote, the probability and the amount together brings false rain to 29% same-hour / 14% ±1 h, and the "nothing wet on screen when it rained" rate does not rise from it (the residual rise is the wind rung, see §10).
- **Wind.** The models' blended mean wind reads under the airport anemometer by a median factor of 1.75 at Cape Town and 1.61 at Johannesburg; their gust reads about right (0.87–1.22). A forecast gust of 55–60 km/h had the station at Beaufort 5 or more in half the hours and near-calm in 9%; 50–55 km/h: 30% and 18%. Mean ≥ 25 or gust ≥ 55 scores precision 59% / recall 64% against observed fresh-breeze hours, versus 63% / 39% for the mean-only rule.
- **30% for might-rain.** The stats row already words 30–54% "Possible"; the hero now agrees with it. Below 30% the hero says the sky.

## 5. After the ladder — the overrides, in order (`applyVoteConsensus`, then the handler)

| # | rule | effect | status |
|---|---|---|---|
| A | FIX-001: key is rain-possible or cloudy, ≥ 3 sources active, fewer than 2 sources voted rain/cloudy/storm/fog, and neither OM nor MET voted rain | → clear (`majority-override-clear`) | **CHANGED:** does not apply to `rain-possible-prob` — a ≥ 30% blended chance is already a five-source verdict |
| B | FIX-002: fog with fewer than 2 fog votes | → clear | unchanged |
| C | B-2 consensus: storm/wind/heat/cold need ≥ 2 sources individually near the trigger | → clear | **CHANGED:** a source supports wind at mean ≥ 20 **or gust ≥ 44** (80% of either trigger) |
| D | Tomorrow.io radar: current-hour intensity > 0.5 mm/h | → rain, rainChance raised to ≥ 70 | unchanged |
| E | Tomorrow.io code 8000 | → storm | unchanged |
| F | next-hour radar > 0.5 mm/h and not already rain | rainChance raised to ≥ 60 (feeds "might rain" on the phone) | unchanged |
| G | Layer A fog detector: visibility < 1.5 km (min of OM/TI), RH ≥ 90, dew spread ≤ 2, chance < 30, mm < 0.2; only over clear/partly/cloudy | → fog | unchanged |
| H | Layer A.2: ≥ 1 true-fog vote (not mist/haze) + RH ≥ 78 + wind ≤ 10, over clear/partly/cloudy | → fog | unchanged |
| I | confidence: low when < (active − 1) sources agree with the final key's family, or a fog trend is coming, or one source | `meta.confidence`, the "n/5 sources agree" line | unchanged |

## 6. The DAILY ladder (week strip, day cards, `daily[0].conditionKey`) — unchanged

Same function with `now: false`; rungs 5–12 are the shipped ones: ≥ 60% → rain (heavy-rain-prob) · UV ≥ 8 → uv · mean ≥ 30 → wind · ≥ 30% → rain (moderate-rain-prob) · desc rain → rain · mean ≥ 25 → wind · overcast → cloudy · ≥ 20% → rain-possible. Then Rec 4 (rain-possible/cloudy with < 2 weather votes and no OM/MET rain → clear), the fog demotion to the sky key, and the daily storm/heat/cold consensus. Inputs per day: desc = weighted vote of the sources' daily descriptions (Open-Meteo's daily code is the **worst hour** of the day), rainChance = the blend in §8, temp = blended high, wind and cloud = the noon hour (days 0–1) or the sources' daily maxima (days 2–6).

## 7. The phone (`assets/app.js`)

**`normalizePayload`** turns the payload into the numbers the screen uses:

| field | rule | note |
|---|---|---|
| `rainPct` (stats row, hero rungs) | **maximum** blended chance over `hourly[localHour … localHour+3]` — the next four hours, not the current hour | a high-water mark; radar/rain-now payloads use `max(now.rainChance, that)` |
| `dailyRainPct` | `daily[0].rainChance` | the 49% Al saw |
| `rainLater` | four-hour max < 30 and daily ≥ 50 | words the stat "Later" |
| `rainNowOverride` | server reason is `tomorrow-io-radar-override` **or `rain-now`** (CHANGED) | the only routes to a rain hero |
| `conditionKey` | `now.conditionKey` | |

**`computeHomeDisplayCondition`** — the key the hero, photograph and lines follow:

| # | if | display | status |
|---|---|---|---|
| 1 | server thunder / hail / storm / cold / cold-clear / heat | that key | unchanged |
| 2 | server `rain` **with** `rainNowOverride` | rain | unchanged rule, second route added |
| **3** | server `rain` **without** evidence (a payload cached before today's server shipped) and four-hour max ≥ 30 | rain-possible | **CHANGED** — was: rain if ≥ 2 rain votes; and the next line was `four-hour max ≥ 50 → rain`, the rung that painted the incident |
| **4** | server `wind`, or blended mean ≥ 30 | wind | **CHANGED** — moved above might-rain and UV |
| 5 | four-hour max ≥ 30 and (≥ 2 rain/cloudy votes, or no votes) | rain-possible | unchanged |
| 6 | `rainLater` | rain-possible | unchanged |
| 7 | server uv (day, cloud < 40, day high ≥ 15) | uv | unchanged |
| 8 | server fog | fog | unchanged |
| 9 | server cloudy and (≥ 2 rain/cloudy votes, or cloud ≥ 55) | cloudy | unchanged |
| 10 | blended mean ≥ 25 | wind | unchanged |
| 11 | `computeSkyCondition`: thunder/hail/storm/fog by key; **four-hour max ≥ 30 → rain-possible** (CHANGED: was ≥ 50 → rain); cloud ≥ 60 cloudy; ≥ 30 partly-cloudy | that | |
| 12 | cloud ≥ 55 | cloudy | unchanged |
| 13 | — | clear | |

**From key to what is on screen:**

| surface | rule |
|---|---|
| photograph folder | `WEATHER_BACKGROUND_ALIASES`: rain-possible → **cloudy**, partly-cloudy → cloudy, uv → clear, hail/thunder → storm; else the key's own folder (clear, cloudy, rain, wind, storm, cold, cold-clear, fog, heat). Time slot from real sunrise/sunset; week and weekday pick the frame. |
| condition line | `headlines[key]` — rain "Rain's here.", rain-possible "Might rain.", wind "Windy" family… in the user's language |
| witty line | `witty[key]` pool, day/season/place-gated; low-confidence pool when `meta.confidence` is low; bespoke line if the photograph has one; night pool 21:00–04:59 |
| stats row / desktop byline rain word | **`rainStatWord`** (CHANGED: one function for both): < 10 None · < 30 Unlikely · < 55 Possible · else Likely; "Possible later" when today's daily key is rain/rain-possible and the number is < 30; "Later" when `rainLater` |
| day badge (week strip) | storm → Rainy; cold/cold-clear → Cold; heat → Hot; today with rain ≥ 30 or key rain/rain-possible: first hour ≥ 25% → Showers / Rain tonight / Rain this morning / Rain later, ≤ 2 h away → Rainy if ≥ 50 else Showers; key rain → Rainy; rain-possible → Showers; uv → High UV; wind → Windy; then numeric fallbacks |
| hourly icon | storm/fog by the hour's own description vote; temp ≤ 0 cold; **hour chance ≥ 50 rain icon, ≥ 30 rain-possible icon**; ≥ 35 heat; cloud ≥ 55 cloudy, ≥ 30 partly; ≤ 10 cold; else clear (unchanged — a per-hour forecast icon, not the hero) |

## 8. The daily rain % — is it the highest source, or a blend?

It is a **weighted blend**, not a maximum: `wAvg(dailies, dailyW, d => d.rains[i])` over the sources that carry a number for that day. Each source's own number is that source's daily chance, which is by definition a day-maximum figure:

| source | day figure fed to the blend |
|---|---|
| Open-Meteo | `precipitation_probability_max` (max of its 24 hourly probabilities) |
| WeatherAPI | `daily_chance_of_rain` (clamped to 0 when code 1000/1003 with 0 mm) |
| Pirate Weather | `precipProbability` (GEFS ensemble) |
| MET Norway | day 0 only: max mm over today's remaining hours → 0 / 20 / 40 / 60 / 80 / 95 |
| Tomorrow.io | day 0 only: max hourly probability over today's remaining hours |

So the day's number is "chance of rain at some point today", blended — the same definition the independent service uses. Measured over 535 station-days (blended value read at 06:00 vs any rain reported that day): 0–20% → rained 6% · 20–30% → 33% · 30–40% → 67% · 40–50% → 70% · 50–60% → 58% · 60–80% → 84% · 80–100% → 96%. The 30–50% band **under**-states rain if anything. **Verdict: it does not read wet; no change to the blend.** Wednesday's 49% against the other service's 15% is a forecast disagreement, not an aggregation error — the observation on Wednesday decides it.

The one wet lean in the daily path is descriptive, not numeric: Open-Meteo's daily code is the day's worst hour, so one drizzle hour makes the day's label "Light drizzle". The daily `rain` key was right 80% of days anyway (138 days), so it is left alone.

## 9. Every threshold in one place

| what | value | where |
|---|---|---|
| rain now | ≥ 2 rain votes, ≥ 60%, ≥ 0.3 mm | `RAIN_NOW_MIN_VOTES / _PROB / _MM` |
| might rain (now) | ≥ 30% | `RAIN_POSSIBLE_NOW_MIN_PROB` |
| might rain (daily) | ≥ 20%; rain ≥ 30%; heavy ≥ 60% | deriveCondition daily rungs |
| radar rain | > 0.5 mm/h current hour; next hour > 0.5 → chance ≥ 60 | handler |
| wind (now) | mean ≥ 25 or gust ≥ 55; support at 20 / 44 | `WIND_NOW_MEAN_KPH / _GUST_KPH` |
| wind (daily) | mean ≥ 30 strong, ≥ 25 moderate | deriveCondition daily rungs |
| phone wind fallback | mean ≥ 30 early, ≥ 25 late | computeHomeDisplayCondition |
| heat | ≥ 30 warm, ≥ 35 extreme, feels ≥ 38 | `HEAT_WARM_C`, `HEAT_EXTREME_C` |
| cold | temp ≤ 10 with day high ≤ 14; temp ≤ 0 or feels ≤ −5 extreme | |
| cold-clear | feels ≤ 12 / low ≤ 6 / temp ≤ 12, cloud < 30, chance < 20, high ≤ 18 | |
| UV | ≥ 8 high (cloud < 55), ≥ 6 moderate (cloud < 40), day high ≥ 15, daytime | |
| cloud | overcast ≥ 80, mostly ≥ 55, significant ≥ 40, partly ≥ 30 | |
| fog detector | vis < 1.5 km, RH ≥ 90, dew spread ≤ 2, chance < 30, mm < 0.2; trend: vis < 2 km, RH ≥ 90, spread ≤ 2.5 within 3 h | `detectAdvectionFog` |
| corroborated fog | ≥ 1 true-fog vote, RH ≥ 78, wind ≤ 10 | `FOG_VOTE_*` |
| stats word | < 10 None, < 30 Unlikely, < 55 Possible, else Likely | `rainStatWord` |

## 10. Before and after, measured (phone layer; full tables in `review/accuracy/results/compare-before-vs-after.md`)

| city | said rain | false rain, same hour | false rain, ±1 h | rain, nothing wet shown | windy hours served sky-only | said wind | wind while station calm |
|---|---|---|---|---|---|---|---|
| Cape Town | 200 → 68 | 57.5% → 26.5% | 34% → 8.8% | 10.7% → 15.5% | 53.9% → 27.4% | 14 → 123 | 0% → 0.8% |
| Johannesburg | 124 → 62 | 58.1% → 29% | 37.9% → 12.9% | 3% → 6% | 30% → 22.2% | 0 → 22 | 0% → 0% |
| Durban | 293 → 119 | 47.4% → 14.3% | 34.8% → 5.9% | 6.3% → 12.1% | 9.7% → 8.3% | 70 → 108 | 2.9% → 3.7% |
| Gqeberha | 322 → 119 | 52.8% → 28.6% | 30.1% → 11.8% | 5.8% → 11.6% | 25.3% → 17.3% | 47 → 148 | 2.1% → 2.7% |
| Bloemfontein | 166 → 67 | 77.7% → 65.7% | 67.5% → 55.2% | 7.8% → 13.7% | 3% → 3% | 10 → 41 | 0% → 7.3% |
| George | 295 → 117 | 47.8% → 24.8% | 26.8% → 6% | 18.6% → 19.1% | 39.4% → 24.2% | 12 → 38 | 0% → 10.5% |
| **All six** | 1400 → 552 | 54.7% → 29% | 36.1% → 14.3% | 9.9% → 13.9% | 34.2% → 20.3% | 153 → 480 | 2% → 3.3% |

Read it as:

- **False "Rain's here." fell by more than half** (same hour) and to under half (±1 h), in every city.
- **Windy hours served a sky-only hero fell from 34% to 20%**, Cape Town from 54% to 27%. Of the 480 hours now headlined Windy, the station was at Beaufort 5 or more in 301 and near-calm in 16.
- **The cost, stated:** "rain reported, nothing wet on screen" rose from 9.9% to 13.9% of rainy hours (79 → 111). That rise is the wind rung taking rainy hours: 29 rainy hours now read Windy, and in 17 of them the station was windy too. In a wind-versus-might-rain conflict the station was windy 54% of the time and wet 25%, so wind keeps the hero; the stats row still shows the rain % beside it. The "rain not called rain" column (18% → 48%) is the evidence bar itself: those hours show "Might rain." with the percentage, not a dry sky.
- **Residual:** Bloemfontein's false-rain stays high (65.7% same hour) — Highveld convective showers that the models place over the airport and the airport does not see. Tightening nationally would cost the coast; a Highveld-specific bar is a separate decision.
- **What the replay cannot see:** Tomorrow.io radar and WeatherAPI's station-influenced current block. Both only add true "now" hits in production, so the live strict-miss rate should sit below the replay's.
