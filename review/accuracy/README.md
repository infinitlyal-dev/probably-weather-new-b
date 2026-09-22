# Accuracy harness — the app's condition resolver against what the airports reported

Built 22 September 2026 for the Strand condition incident. It answers three questions with numbers, per city: how often we said **rain** when none was observed, how often we **missed** observed rain, how often observed **strong wind** was served as clear or cloudy.

## Ground truth

METAR reports from six SA airports, 24 June → 22 September 2026, from the Iowa Environmental Mesonet archive (`obs/metar-<ICAO>-*.csv`, routine + special reports, UTC). Present weather (RA, DZ, SH, TS, FG…), 10-minute mean wind, gust group, cloud layers. See `lib/obs.mjs` for exactly how a report becomes "precipitation at this hour", "windy", "calm".

| ICAO | city | reports | hours scored |
|---|---|---|---|
| FACT | Cape Town | 2,705 | 2,164 |
| FAOR | Johannesburg | 3,813 | 2,151 |
| FALE | Durban | 2,994 | 2,154 |
| FAPE | Gqeberha | 2,683 | 2,087 |
| FABL | Bloemfontein | 2,042 | 2,039 |
| FAGG | George | 3,433 | 2,145 |

## Forecast side

Open-Meteo's historical-forecast archive for the same coordinates and hours (`forecast/om/*.json`), which is the same provider, endpoint family and variables production's Open-Meteo call uses — plus four other models from the same archive (`forecast/om-models/*.json`) standing in for the other four production sources, in production's slot order and weights. `lib/sources.mjs` explains each stand-in and what cannot be reproduced (Tomorrow.io radar intensity; WeatherAPI's own vocabulary).

## The resolver

`lib/replay.mjs` runs the **shipped code**: `deriveCondition`, `applyVoteConsensus`, the description vote, modal cloud, the fog detectors — imported from `api/weather.js` — and the phone's `computeHomeDisplayCondition` / `computeSkyCondition` sliced from `assets/app.js`, fed a `norm` built the way `normalizePayload` builds it. The aggregation glue between those functions is copied from the handler with line numbers cited.

Proof the copy is faithful: extracting the consensus block into `applyVoteConsensus` changed none of the 12,740 replayed hours (`results/refactor-check.md`, identical to `before.md` field for field).

## Run

```
node review/accuracy/run-eval.mjs --tag before     # with the rules as they were
node review/accuracy/run-eval.mjs --tag after      # after a rule change
node review/accuracy/compare.mjs before after      # side by side
```

`results/<tag>.md` is the human report; `<tag>.json` the numbers; `<tag>-hours.csv` every scored hour (regenerated in ~45 s, not committed). `node review/accuracy/fetch-data.mjs` re-downloads the observation and forecast files.

## What it measures

- **false rain** — served `rain` with no precipitation reported that hour (strict) / in that hour or its neighbours (±1 h)
- **rain missed** — precipitation reported, nothing wet on screen (wet = rain, rain-possible, storm, thunder, hail); and the stricter "rain not called rain"
- **windy served sky-only** — station sustained ≥ 30 km/h or gust ≥ 45 km/h (Beaufort 5, a fresh breeze) served clear / partly-cloudy / cloudy / uv
- **false wind** — served `wind` while the station had < 20 km/h and no gust ≥ 30
- the observed wind distribution, model-vs-station wind bias, a threshold sweep for the wind rule, and a day-level calibration of the blended daily rain %

## Results (22 September 2026)

`results/compare-before-vs-after.md`. Headline, phone layer, all six cities: false "Rain's here." 54.7% → 29% same hour, 36.1% → 14.3% ±1 h; windy hours served sky-only 34.2% → 20.3%; rain with nothing wet on screen 9.9% → 13.9% (the wind rung taking 29 rainy hours, 17 of them windy at the station too). The reasoning behind every threshold is in `review/CONDITION-LOGIC.md` §4 and §10.
