# Condition incident — Strand, Tuesday 22 September 2026

## What Al saw (about 16:11 SAST, desktop)

Hero: **"Rain's here."** over a rain photograph. Same screen: **"Rain Possible"** and **49%** for the day. Outside: cloudy and dry. An independent service at the same moment: partly sunny, 27 °C, 30% chance today, 15% for Wednesday (our 7-day: 49%). The hour before showed the same.

## What was captured, and when (all SAST)

| time | file | what |
|---|---|---|
| 16:35 | `deployed-api.json` + `.headers.txt` | the live `/api/weather` for Strand (-34.1163, 18.8362), `X-Vercel-Cache: MISS`, so a fresh five-source fan-out |
| 16:36 | `open-meteo.raw.json` | Open-Meteo current + hourly + daily, same request shape as production plus `precipitation,rain,showers` in `current` |
| 16:36 | `met-norway.raw.json` | MET Norway locationforecast compact |
| 16:36 | `tomorrow-io.raw.json` | Tomorrow.io timelines, 48 h hourly |
| 16:37 | `metar-now.json` | METARs (last 4 h) for FACT, FAOR, FALE, FAPE, FABL, FAGG |
| 16:50 | `deployed-app-render-1650.json` | what the deployed frontend painted for Strand (desktop and 375-wide phone) |
| 16:53 | `deployed-api-FACT.json` | the live API for Cape Town International's coordinates, the nearest METAR station to Strand |

**Not captured: WeatherAPI and Pirate Weather raw payloads.** Their keys exist only in Vercel's environment. The Vercel MCP token is refused for `projectEnvVars` (403), and the Vercel CLI login token on disk is expired (`invalidToken: true`). What those two sources said is recorded inside `deployed-api.json` (`meta.sourceConditions`, `meta.sourceRanges`, `now.conditionSignals.sourceVotes`): WeatherAPI "Patchy rain possible" (rain vote, range 18.7–31.8 °C), Pirate Weather "Partly cloudy" (clear vote, range 17–28.7 °C).

## What the deployed API resolved for Strand at 16:35

```
now.conditionKey     = rain
now.conditionReason  = moderate-rain-prob
selector inputs      = desc "Partly cloudy", rainChance 31.2, tempC 25, feelsLike 26.1,
                       windKph 10.9, uvIndex 2.6, cloudPct 61.72, maxWindKph 20.1, isDay true,
                       dailyHighC 29.7, dailyLowC 18.9
source votes         = Open-Meteo clear (Partly cloudy) | WeatherAPI rain (Patchy rain possible)
                       Pirate Weather clear (Partly cloudy) | MET Norway clear (Partly cloudy)
                       Tomorrow.io clear (Partly cloudy)            → 1/5 for rain
overrides            = none
weights              = OM 30 · WA 22 · PW 13 · MET 20 · TI 15
daily[0]             = rain / moderate-rain-prob / 49.3%   (descs: Light drizzle, Patchy rain possible, Partly cloudy ×3)
daily[1] (Wed)       = rain / moderate-rain-prob / 49.2%   (descs: Violent rain showers, Smoky haze, Cloudy)
confidence           = low, sourceAgreement 1/5
```

**The rule that fired:** `deriveCondition` rung 8, api/weather.js:3371 — `rainChance >= 30 → { key: 'rain', reason: 'moderate-rain-prob' }`. A 31% probability for the hour became the key that means "it is raining". Nothing in the selector looks at whether rain is falling; four of five descriptions saying "Partly cloudy" carried no weight against the number.

## What each source actually said for that hour (raw)

| source | current block | current hour (16:00) | notes |
|---|---|---|---|
| Open-Meteo | code 2 Partly cloudy, **precipitation 0, rain 0, showers 0**, wind 5.6, gust 15.5, cloud 60 | code 51 Light drizzle, prob **73%**, 0.4 mm, cloud 63, wind 4.8, gust 15.8 | 14:00 and 15:00 also code 51 at 88% / 86%; 17:00 code 2 at 57% |
| MET Norway | partlycloudy_day, **0 mm next hour**, wind 10.1, cloud 61.7 | partlycloudy, 0 mm, wind 5.0, cloud 49 | no rain in any hour 14:00–17:00 |
| Tomorrow.io | code 1101 Partly cloudy, intensity **0.02 mm/h**, prob 10, vis 16 km | 15:00Z–17:00Z: 0 mm/h, prob 0 | radar override needs > 0.5 mm/h; it did not fire |
| WeatherAPI | "Patchy rain possible" (raw not captured) | — | the one rain vote, weighted 0.1 in the description vote |
| Pirate Weather | "Partly cloudy" (raw not captured) | — | |

Open-Meteo's hourly probability is where the 31% came from: the blend of OM 73%, TI 10% and the WA/MET figures for 16:00 landed at 31.2. OM alone at 15:00 was 86% while the blend was 57%.

**Ground truth.** METAR FACT (Cape Town International, ~35 km from Strand) 14:00Z = 16:00 SAST: `32021KT 9999 FEW040CB 24/15 Q1011` — no present weather, visibility 10 km+, a few cumulonimbus at 4000 ft, **wind 21 kt = 39 km/h from the north-west**. 13:00Z the same at 18 kt. Al at Strand: cloudy and dry. No METAR station in the six reported precipitation at 14:00Z (FAOR, FALE, FAPE, FABL, FAGG all dry).

## How the frontend turned the server's "rain" into "Rain's here."

1. `normalizePayload` (assets/app.js:2320–2340) sets `rainPct` to the **maximum blended probability over the next four hours** (`hourly[localHour .. localHour+3]`), not the current hour.
2. `computeHomeDisplayCondition` (assets/app.js:1708–1780): server key `rain` is only trusted when ≥ 2 sources voted rain or the radar override fired. Here 1 source did, so the key falls through to the numeric rungs: **`imminentRain >= 50 → 'rain'`**.
3. With the payload written at 15:xx (`meta.localHour = 15`), the window covered 15:00–18:00: `max(57.2, 31.2, 32.0, 17.4) = 57.2` → `'rain'` → `getHeadline('rain')` = "Rain's here.", the rain witty pool, `getWeatherBackgroundFolder('rain')` = the rain photographs.
4. The same code path at 16:50 with `meta.localHour = 16`: `max(31.2, 32, 17.4, 12.9) = 32` → `'rain-possible'` → "Might rain." with the cloudy folder. That is what `deployed-app-render-1650.json` records. Nothing else changed between 16:11 and 16:50 except the hour.
5. The server payload is cached 5 min fresh + 15 min stale, the browser keeps it 30 min in IndexedDB, so a 15:5x payload on screen at 16:11 is the normal case, not an anomaly.
6. The stats row reads the **same** `rainPct` and words it `< 30 unlikely · < 55 possible · ≥ 55 likely`. A four-hour max between 50 and 54 therefore paints **"Rain's here." next to "Rain Possible"** from one number. The 49% Al saw is `daily[0].rainChance` in the week strip.

So there are two independent probability-to-"raining now" conversions, and the incident needed only one of them:

- server: `rainChance ≥ 30 → rain` (and `≥ 60 → rain`), api/weather.js:3362, 3371;
- frontend: four-hour max `≥ 50 → rain`, assets/app.js:1750.

## The other half of Al's pattern, live at the same hour

`deployed-api-FACT.json` (16:53, Cape Town International's own coordinates): key **`clear`** (base `rain-possible` demoted by `majority-override-clear`, 1/5 rain votes), blended wind **11.4 km/h**, gust 29.2. The METAR for that hour: **39 km/h sustained** north-wester, no rain. The app served a clear sky over a fresh breeze because (a) wind uses the blended *mean* only (`effectiveWind = windKph`, gusts ignored, api/weather.js:3243), (b) the mean the models gave for the airport was less than a third of the anemometer, and (c) wind sits below the rain-probability rungs in the ladder, so even a 30 km/h mean loses to a 30% chance of rain.

## Diagnosis, one paragraph

"Rain" is produced from probability, twice, and never checked against precipitation. The server's selector turns a 30% hourly chance into the rain key; the frontend turns a 50% four-hour maximum into the rain headline, photograph and lines, overriding a 4-to-1 clear vote. Wind is judged on the blended mean speed alone, with gusts unread, and is ranked beneath those probability rungs, so windy days read as clear or cloudy. The fix is in `review/CONDITION-LOGIC.md` (the full ladder as it stands) and measured in `review/accuracy/` before and after.

## Fix and measurement (same day)

- The full chain as a decision table, with every changed row marked: `review/CONDITION-LOGIC.md`.
- The replay of the app's own resolver over 12,740 station-hours, before and after: `review/accuracy/results/compare-before-vs-after.md` (harness in `review/accuracy/`).
- Guard that fails if this can recur: `tests/hero-stats-consistency.test.js` — it runs the captured `deployed-api.json` through the shipped frontend at 15:00 and 16:00 and asserts the hero is not `rain`, and sweeps 5,000+ synthetic payloads for a hero that says rain beside a stat that says Unlikely.
- Served for this payload after the fix: server `rain-possible` (`rain-possible-prob`, 31%), phone "Might rain." over the cloudy folder, stats "Rain 32% Possible".
