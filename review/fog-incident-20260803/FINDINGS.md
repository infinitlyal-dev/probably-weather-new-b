# Fog miss — Strand, 2026-08-03

**Captured:** 2026-08-03T14:29:47Z (16:29 SAST). Coords -34.1163, 18.8362.
**Reported by Al:** thick fog physically present. **App showed:** clear / "Partly cloudy".

## Verdict

**Nothing was dropped by the pipeline.** All five sources missed the fog. Both fog paths in
`api/weather.js` were correctly evaluated and both correctly returned false on the data they were given.
This is an upstream source-coverage failure, not an aggregation bug.

## Raw values, per source

| Source | Fog / visibility field | Value at capture | Fog? |
|---|---|---|---|
| Open-Meteo | `hourly.visibility` (m) @ 16:00 | **35300** (35.3 km) | no |
| Open-Meteo | `current.weather_code` | **2** (partly cloudy) | no |
| Open-Meteo | `current.relative_humidity_2m` | **82** % | below 90 gate |
| Open-Meteo | T 20.6 / dew 17.4 @16:00 → spread | **3.2** °C | above 2 gate |
| MET Norway | `fog_area_fraction` (%) @14:00Z | **0** | explicit no |
| MET Norway | `next_1_hours.summary.symbol_code` | **partlycloudy_day** | no |
| Tomorrow.io | `values.visibility` (km, realtime) | **14** | no |
| Tomorrow.io | `values.weatherCode` | **1102** (mostly cloudy) | no |
| WeatherAPI | NOT CAPTURED — key absent from local `.env` | app read desc "Clear sky" | no |
| Pirate Weather | NOT CAPTURED — key absent from local `.env` | app read desc "Partly cloudy" | no |

MET Norway `fog_area_fraction` is 0 at every timestep in the captured horizon.

## What the deployed app resolved

`conditionKey: "clear"`, `conditionLabel: "Partly cloudy"`, `conditionReason: "majority-override-clear"`.

Source votes: Open-Meteo clear · WeatherAPI clear · Pirate clear · MET Norway clear · Tomorrow.io cloudy.
Override applied: `majority-override-clear` (1/5 voted rain/cloudy/storm/fog).

Fog detector output (`meta.conditionConfidence.fogSignal`):
`visKm 35.3 · humidity 82 · dewSpread 3.2` → `detectorVerdict: "none"`.

## Why each fog path did not fire

**Path 1 — `detectAdvectionFog` (api/weather.js:2457).** Needs ALL of:
`visM < 1500` · `humidity >= 90` · `dewSpread <= 2` · no precipitation.
Actual: **35300 m, 82 %, 3.2 °C**. All three primary gates failed, by wide margins — not marginal misses.
The detector reads visibility from **Open-Meteo only** (api/weather.js:591).

**Path 2 — `corroboratedFogUpgrade` (api/weather.js:2591).** Requires `fogVoteCount >= 1`.
Actual fog votes: **0**. This path exists specifically to cover the case where OM visibility misses but
another source calls fog — it needs a fog vote and there wasn't one.

## Secondary observations (not today's cause)

1. **Tomorrow.io visibility is available but never requested.** The app calls
   `/v4/timelines` with `fields=temperature,precipitationIntensity,precipitationProbability,weatherCode,windSpeed,humidity,cloudCover` (api/weather.js:514)
   — no `visibility`. The realtime endpoint returns `visibility: 14` for this location. The comment at
   api/weather.js:591 ("the other four sources expose no visibility field") is factually wrong for Tomorrow.io.
   It would not have changed today's outcome (14 km is not fog), but it is the only second visibility signal available.
2. **This exact failure at this exact location is already documented in the code**: api/weather.js:1769 and :2581
   record "Strand 2026-06-01: 43.7 km in dense ground fog". Today is 35.3 km in fog — the same failure mode, recurring.
3. `now.humidity` (66) differs from `fogSignal.humidity` (82) because the former is the cross-source
   median and the latter is Open-Meteo's hourly value. Not a bug, but worth knowing when reading the payload.
4. Final condition was `clear` with `cloudPct: 68` — the majority-override turned Tomorrow.io's cloudy
   vote into clear. Separate from the fog question; noted only.

## Evidence gap

WeatherAPI and Pirate Weather raw responses could not be captured: `WEATHERAPI_KEY` and
`PIRATE_WEATHER_KEY` are absent from the local `.env` (0 chars); only `TOMORROWIO_API_KEY` is present.
MET_USER_AGENT is also empty locally — MET was re-fetched with a substitute UA.
Their descriptions are known second-hand from the live app payload ("Clear sky", "Partly cloudy"), so
neither cast a fog vote; but their raw visibility fields (WeatherAPI exposes `current.vis_km`) are unverified.

## Files

`01-open-meteo.json` · `02-met-norway.json` · `03-weatherapi.json` (403 error body) ·
`04-pirate-weather.json` (404 error body) · `05-tomorrow-io.json` · `06-live-app-api.json`
