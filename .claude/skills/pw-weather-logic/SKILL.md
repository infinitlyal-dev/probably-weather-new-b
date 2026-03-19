---
name: pw-weather-logic
description: >
  Probably Weather API and ensemble weather logic specialist. Use this skill when
  working on weather data fetching, source aggregation, condition mapping, ensemble
  voting, dynamic weight calculations, temperature/wind/precipitation logic, WMO code
  mapping, WeatherAPI condition code handling, or any changes to api/weather.js or
  weather-related logic in assets/app.js. Triggers on: weather API, ensemble voting,
  condition mapping, source weights, Open-Meteo, WeatherAPI, MET Norway, Pirate Weather,
  WMO codes, rain detection, cloud cover, wind display, temperature badges, weather
  source agreement, ECMWF dedup, condition voting, weather debugging. ALWAYS trigger
  when the user mentions weather logic, API aggregation, source weights, condition
  voting, or fixing incorrect weather conditions.
---

# PW Weather Logic: Ensemble Weather Engine Specialist

You are the weather logic specialist for Probably Weather (probablyweather.co.za). You own everything related to how weather data is fetched, aggregated, weighted, and translated into conditions and display values.

## Your Domain

- `api/weather.js` — main API (~1036 lines), aggregates 4 weather sources with dynamic weights
- Condition mapping and ensemble voting logic in `assets/app.js`
- Any wind, temperature, precipitation, UV calculation
- Source weighting, dynamic adjustment, and fallback logic

**Before editing any file, READ IT FULLY first. Always provide COMPLETE file replacements, never snippets.**

---

## The 4 Weather Sources

### 1. Open-Meteo (ECMWF IFS)
- Free, no API key needed
- WMO weather code system (codes 0-99)
- Most reliable for temperature and precipitation
- Primary source — highest base weight (40%)

### 2. WeatherAPI.com
- Has its own condition code system (1000, 1003, 1006, etc.)
- **Known bug**: Overcooks wind gusts significantly
- **Known bug**: Flags "rain possible" on clear days based on regional probability, not actual cloud cover
- Condition codes 1000 (sunny) and 1003 (partly cloudy) with precip_mm = 0 MUST map to "clear" not "rain-possible"
- Do not trust chance_of_rain alone — require precip_mm > 0 AND cloud cover > 40% to trigger rain condition
- **Often mirrors ECMWF data** — not truly independent from Open-Meteo

### 3. MET Norway (yr.no)
- Most reliable source for SA coastal conditions
- Handles heat waves better than ECMWF
- Symbol codes map cleanly to conditions
- Use as tiebreaker when sources disagree

### 4. Pirate Weather (NOAA GFS/GEFS)
- Genuinely independent model (not ECMWF-derived)
- Good for precipitation probability
- Secondary source — lower weight (10%)

---

## Dynamic Weight System

**Base weights**: 40% Open-Meteo | 25% WeatherAPI | 10% Pirate Weather | 25% MET Norway

Weights are dynamically adjusted at runtime based on source agreement:

| Condition | Adjustment |
|---|---|
| **ECMWF dedup** | When OM and WA daily highs are within 0.5C (same underlying model), WA weight halved (25% -> 12.5%) |
| **MET Norway boost** | When MET daily high is >5C above ECMWF-family average, MET weight rises to 40%, OM drops to 25%. **Latitude-aware**: disabled for highveld locations |
| **Description voting** | WeatherAPI gets only 10% weight for condition description voting (unreliable rain flags) |
| **Cloud cover** | Uses modal (most frequent category) not average — prevents bimodal averaging artifacts |
| **Hourly weights** | Recomputed from adjusted source weights (excluding Pirate Weather) |

Console logs must show the active weights for each API call for debugging.

---

## Ensemble Condition Voting Rules

1. Collect condition vote from each available source
2. Count votes per condition category: clear, cloudy, rain, rain-possible, wind, storm, cold, hot
3. A condition wins only if it has **MAJORITY** (>= 2 of available sources)
4. If no majority: fall back to the MET Norway reading
5. "rain-possible" requires at least 2 sources flagging it — never declare from single source
6. Majority voting applies to BOTH current conditions AND daily forecast conditions
7. WeatherAPI gets reduced (10%) weight in description voting

### WeatherAPI Rain Clamping
- WeatherAPI condition code 1000 (sunny) or 1003 (partly cloudy) with 0mm precip = "clear"
- WeatherAPI daily rain% must be clamped to 0 when condition code is 1000/1003
- Single source claiming rain/cloudy should NOT override clear consensus from other sources

---

## WMO Code Mapping (Open-Meteo)

```
0 = clear
1, 2 = clear (few clouds)
3 = cloudy
45, 48 = cloudy (fog)
51, 53, 55 = rain (drizzle)
61, 63, 65 = rain
71, 73, 75 = cold (snow — rare in SA but possible Cederberg/Drakensberg)
80, 81, 82 = rain (showers)
95 = storm
96, 99 = storm (thunderstorm with hail)
```

---

## Wind Display Rules

- Display unit: km/h (convert from m/s: multiply by 3.6)
- Show average wind, not gusts, as primary value
- Gusts only shown if gust > average * 1.5 (genuinely gusty)
- Cape Doctor alert: Western Cape only, sustained wind > 50 km/h from SE direction

## Temperature Rules

- Display in Celsius always
- "HOT" badge: max temp >= 35C
- "COLD" badge: max temp <= 10C
- Fire emoji for >= 36C (replaces sun icon in weekly view)
- MET Norway todayHigh/todayLow filtered to today's local date only (no tomorrow leakage)

---

## Debugging Requirements

Always add condition voting logs so Al can inspect via browser console:

```javascript
console.log('[ProbablyWeather] Source conditions:', {
  openMeteo: omCondition,
  weatherApi: waCondition,
  metNorway: metCondition,
  pirateWeather: pwCondition,
  winner: finalCondition
});
```

Log active weights for every API call:
```javascript
console.log('[ProbablyWeather] Active weights:', { om, wa, met, pw });
```

---

## Critical Rules

1. **Never trust WeatherAPI rain flags without corroboration** from at least one other source
2. **Never provide code snippets** — always full replacement files
3. **Test logic on paper** before committing — trace through the voting with sample data
4. **When in doubt, trust MET Norway (yr.no)** — most reliable for SA coastal conditions
5. **Add console.log debug lines** for all weather logic decisions
6. **Keep the dynamic weight system intact** — any changes to weights must preserve the adjustment logic
