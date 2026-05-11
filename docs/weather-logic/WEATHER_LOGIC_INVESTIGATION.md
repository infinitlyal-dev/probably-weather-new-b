# Weather Logic Investigation

**Date:** 2026-05-10
**Author:** Claude (claude-opus-4-7[1m])
**Scope:** Read-only investigation of how Probably Weather aggregates 4 weather APIs and selects a single headline condition. Two known bugs are referenced throughout but no code is changed.

**Key files:**
- `api/weather.js` — server-side aggregator (1172 lines)
- `assets/app.js` — frontend, including `computeTodaysHero` / `computeHomeDisplayCondition` (1642 lines)
- `assets/weather-copy.js` — i18n copy bank for 11 hero labels, 11 headlines, 10 witty pools (126 lines)
- `assets/weather-visuals.js` — condition→folder alias table (17 lines)
- `assets/images/bg/{clear,cloudy,cold,fog,heat,rain,storm,wind}/` — 8 background image folders, 24 images each (192 total)

---

## Executive summary

1. **Bug 1 (thunder/hail not surfaced) has TWO root causes, not one.** First: hourly aggregation drops condition descriptions entirely — only `tempC, feelsLikeC, rainChance, windKph, cloudPct, uv` survive into the hourly array, so the hourly chart cannot ever know an hour contains thunder or hail (`api/weather.js:599-626`). Second: at the daily/now level, thunder *is* recognized in `categorizeDesc` and `deriveCondition` priority 1 (mapped to `'storm'`), but the description has to win the weighted majority vote in `pickWeightedMostCommon`. WeatherAPI is the most thunder-aware source and gets only **10% description voting weight** (`DESC_WEIGHTS = [1, 0.1, 1, 1]`, line 631); a single thunder vote from WA can be drowned out by 3 sources reporting plain "rain". Net effect: thunder is regularly silenced.

2. **Hail has no internal condition at all.** It collapses to `'cold'` (`deriveCondition` priority 3, line 1095-1096: `d.includes('hail') ... return 'cold'`) — meaning a thunderstorm-with-hail event maps to either `'storm'` (if 'thunder' wins) or `'cold'` (if 'hail' wins), never to a hail-specific UI state. There is no `hail/` image folder, no hail copy bucket, no hail badge, no hail in the hero-label set.

3. **Bug 2 (UV beats cold in Joburg 5°/13°) is a priority-order bug in `deriveCondition`.** Moderate UV (`uvIndex >= 6`) sits at priority 16; the chilly check (`tempC <= 10`) sits at priority 14 — but the chilly check is gated by `dailyHighC <= 14`. At midday in winter Joburg, current temp is ~13°C (above the 10° threshold), so the chilly rung never fires. The UV rung then wins, even though the day's high is 13°C. **There is no temperature gate on the UV rung.**

4. **The hourly chart inherits Bug 1 mechanically.** `aggregatedHourly[i]` lacks a description field. The hourly UI in `app.js` never receives per-hour `'storm' | 'rain' | ...` keys — just numbers. So even if the user opens "Hourly" they see only `rainChance %` going up, no way to know it's a thunderstorm, no way to surface hail.

5. **The "fog majority" pattern (lines 859-865, 674-681) is bespoke to fog.** No equivalent guard exists for thunder, hail, snow, or sleet. So any single-source thunder/hail/snow vote can either win (if it dominates the weighted vote) or be silenced (if not) — but it's never confidence-checked the way fog is.

6. **Description voting is the central choke point.** Because every condition decision flows through `pickWeightedMostCommon` operating on raw description strings, and because the weights are fixed at `[1, 0.1, 1, 1]`, the system is structurally biased toward whichever description three of the non-WA sources happen to share — usually a generic one.

---

## 1. Weather API contracts (per source)

### 1.1 Open-Meteo (`api.open-meteo.com/v1/forecast`)

Request (`api/weather.js:159-165`):

```js
const openMeteoRequest = fetchJson(
  `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
  `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,relative_humidity_2m,cloud_cover` +
  `&hourly=temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,wind_gusts_10m,cloud_cover,relative_humidity_2m,uv_index` +
  `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,weather_code,sunrise,sunset` +
  `&timezone=auto&forecast_days=7`
);
```

**Condition field:** `weather_code` — WMO code (integer).
**UV field:** `uv_index_max` (daily), `uv_index` (hourly).
**Temperature fields:** `temperature_2m`, `apparent_temperature`, `temperature_2m_max`, `temperature_2m_min`.

**WMO code map** (`api/weather.js:137-149`) — single source of truth for severe-weather signals from this API:

```js
const openMeteoCodeMap = {
  0:'Clear sky', 1:'Mainly clear', 2:'Partly cloudy', 3:'Overcast',
  45:'Fog', 48:'Depositing rime fog',
  51:'Light drizzle', 53:'Moderate drizzle', 55:'Dense drizzle',
  56:'Light freezing drizzle', 57:'Dense freezing drizzle',
  61:'Slight rain', 63:'Moderate rain', 65:'Heavy rain',
  66:'Light freezing rain', 67:'Heavy freezing rain',
  71:'Slight snow fall', 73:'Moderate snow fall', 75:'Heavy snow fall',
  77:'Snow grains',
  80:'Slight rain showers', 81:'Moderate rain showers', 82:'Violent rain showers',
  85:'Slight snow showers', 86:'Heavy snow showers',
  95:'Thunderstorm',
  96:'Thunderstorm with slight hail',
  99:'Thunderstorm with heavy hail',
};
```

**Severe-weather codes:**
| Phenomenon | Open-Meteo code | Mapped string | Categorized as | Drives UI condition |
|---|---|---|---|---|
| Thunderstorm | 95 | `"Thunderstorm"` | `'storm'` | `'storm'` |
| Thunder + slight hail | 96 | `"Thunderstorm with slight hail"` | `'storm'` (because the string contains 'thunder' first; checked before 'hail' in `categorizeDesc`) | `'storm'` |
| Thunder + heavy hail | 99 | `"Thunderstorm with heavy hail"` | `'storm'` | `'storm'` |
| Lightning (no thunder code) | not in map | n/a | n/a | n/a |
| Hail without thunder | not in map | n/a | n/a | n/a |

**No standalone hail or lightning code exists in Open-Meteo's WMO set.** Open-Meteo only reports hail when paired with thunder (codes 96/99). Standalone hail is invisible from this source.

### 1.2 WeatherAPI.com (`api.weatherapi.com/v1/forecast.json`)

Request (`api/weather.js:166-171`):

```js
fetchJson(
  `https://api.weatherapi.com/v1/forecast.json?key=${WEATHERAPI_KEY}` +
  `&q=${lat},${lon}&days=7&aqi=no&alerts=no`
);
```

**Condition field:** `condition.code` (integer) + `condition.text` (string). Parsing uses `text` directly as the description (`api/weather.js:273-274`).
**UV field:** `forecast.forecastday[i].day.uv`.
**Temperature fields:** `current.temp_c`, `current.feelslike_c`, `forecastday[i].day.maxtemp_c`, `forecastday[i].day.mintemp_c`, `forecastday[i].hour[h].temp_c`, `forecastday[i].hour[h].feelslike_c`.

**WeatherAPI condition codes for severe weather** (these are NOT in the codebase — quoting from WeatherAPI's published docs):

| Phenomenon | WA code | WA text | Currently parsed by app? |
|---|---|---|---|
| Thundery outbreaks possible | 1087 | "Thundery outbreaks possible" | text passes through as-is → 'storm' if `categorizeDesc` runs |
| Patchy light rain with thunder | 1273 | "Patchy light rain with thunder" | 'storm' |
| Moderate or heavy rain with thunder | 1276 | "Moderate or heavy rain with thunder" | 'storm' |
| Patchy light snow with thunder | 1279 | "Patchy light snow with thunder" | 'storm' (thunder beats snow in `categorizeDesc` order) |
| Moderate or heavy snow with thunder | 1282 | "Moderate or heavy snow with thunder" | 'storm' |
| Ice pellets (hail-equivalent) | 1237 | "Ice pellets" | not matched by any keyword; falls to `'clear'` via `categorizeDesc` |
| Light showers of ice pellets | 1261 | "Light showers of ice pellets" | matched as `'rain'` (text contains 'showers') — **not as hail** |
| Moderate or heavy showers of ice pellets | 1264 | "Moderate or heavy showers of ice pellets" | matched as `'rain'` — **not as hail** |
| Patchy light rain | 1240 | varies | 'rain' |

**Two specific WeatherAPI quirks the codebase already handles** (`api/weather.js:266-282`):
- Code 1003 ("Partly cloudy") with 0mm precip → forced to "Partly cloudy" (preserves partly-cloudy state)
- Code 1000 ("Sunny") with 0mm precip → forced to "Clear sky" (clamps a known WA quirk)

The WA description weight is **0.1** in `DESC_WEIGHTS` (line 631) because of WA's tendency to overcook rain/storm flags.

### 1.3 MET Norway (`api.met.no/weatherapi/locationforecast/2.0/compact`)

Request (`api/weather.js:178-184`):

```js
fetch(
  `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`,
  { headers: { 'User-Agent': NOMINATIM_UA }, signal: AbortSignal.timeout(timeoutMs) }
);
```

**Condition field:** `properties.timeseries[i].data.next_1_hours.summary.symbol_code` (string, e.g., `"rainandthunder_day"`). The `_day | _night | _polartwilight` suffix is stripped before lookup (line 450).
**UV field:** **NOT PROVIDED in compact endpoint.** `api/weather.js:471` confirms: `todayUv: null, // MET Norway compact doesn't provide UV`.
**Temperature fields:** `data.instant.details.air_temperature` (per timestep). Daily high/low computed by filtering today's timestamps and taking min/max.

**MET symbol map** (`api/weather.js:416-427`):

```js
const metSymbolMap = {
  'clearsky':'Clear sky', 'fair':'Fair', 'partlycloudy':'Partly cloudy',
  'cloudy':'Cloudy', 'fog':'Fog', 'sleet':'Sleet',
  'lightsleet':'Light sleet', 'heavysleet':'Heavy sleet',
  'lightrainshowers':'Light rain showers', 'rainshowers':'Rain showers',
  'heavyrainshowers':'Heavy rain showers',
  'lightrain':'Light rain', 'rain':'Rain', 'heavyrain':'Heavy rain',
  'lightrainandthunder':'Light rain and thunder',
  'rainandthunder':'Rain and thunder',
  'heavyrainandthunder':'Heavy rain and thunder',
  'lightsnow':'Light snow', 'snow':'Snow', 'heavysnow':'Heavy snow',
};
```

**MET Norway codes that are NOT in the map** (and would fall through to the unknown raw string, then `categorizeDesc → 'clear'`):

The MET Norway symbol_code spec includes a much larger set than what's mapped:
- `rainshowersandthunder`, `lightrainshowersandthunder`, `heavyrainshowersandthunder` — variants of rain-showers + thunder
- `sleetshowersandthunder`, `lightsleetshowersandthunder`, `heavysleetshowersandthunder`
- `snowshowersandthunder`, `lightsnowshowersandthunder`, `heavysnowshowersandthunder`
- `snowandthunder`, `lightsnowandthunder`, `heavysnowandthunder`
- `lightssleetshowersandthunder` (note: real spec spelling)
- `heavysleetandthunder`, `lightsleetandthunder`, `sleetandthunder`
- `lightsleetshowers`, `sleetshowers`, `heavysleetshowers`
- `lightsnowshowers`, `snowshowers`, `heavysnowshowers`

If MET returns any of these the lookup misses and the raw symbol_code (e.g., `"sleetshowersandthunder"`) becomes the description. `categorizeDesc` would catch 'thunder' → 'storm', so that case partly survives. But snow-shower-only codes (no 'thunder' substring) pass straight through and `categorizeDesc` would only catch them via a later 'snow' keyword check — wait, **`categorizeDesc` does NOT check for 'snow'**. Tracing line 1163-1172:

```js
function categorizeDesc(desc) {
  const d = String(desc || '').toLowerCase();
  if (d.includes('thunder') || d.includes('storm') || d.includes('tornado')) return 'storm';
  if (d.includes('rain') || d.includes('drizzle') || d.includes('shower') || d.includes('precip')) return 'rain';
  if (d.includes('snow') || d.includes('sleet') || d.includes('hail') || d.includes('freezing')) return 'cold';
  ...
}
```

`categorizeDesc` does check 'snow' / 'sleet' / 'hail' / 'freezing' but maps them all to **`'cold'`**, not their own bucket. This means a winter precip event is voted as 'cold' for majority purposes — confusing alongside the actual cold-temperature gate.

### 1.4 Pirate Weather (`api.pirateweather.net/forecast/{key}/{lat,lon}?units=si`)

**Condition field:** `currently.icon` and `daily.data[i].icon` (string).
**UV field:** `daily.data[i].uvIndex`.
**Temperature fields:** `currently.temperature`, `daily.data[i].temperatureHigh`, `daily.data[i].temperatureLow` (already in C with units=si).

**Pirate icon map** (`api/weather.js:151-157`):

```js
const pirateIconMap = {
  'clear-day':'Clear sky', 'clear-night':'Clear sky',
  'rain':'Rain', 'snow':'Snow', 'sleet':'Sleet',
  'wind':'Windy', 'fog':'Fog', 'cloudy':'Cloudy',
  'partly-cloudy-day':'Partly cloudy', 'partly-cloudy-night':'Partly cloudy',
  'hail':'Hail', 'thunderstorm':'Thunderstorm', 'tornado':'Tornado',
};
```

**Pirate Weather is the only API in the codebase that has a standalone `'hail'` icon mapping.** It produces the literal string `"Hail"` — which then flows into `categorizeDesc` and matches the `d.includes('hail')` branch → returns `'cold'`. So even though the API distinguishes hail, the app collapses it to 'cold'.

Pirate Weather is **excluded from hourly aggregation** (`api/weather.js:8-9`, line 128). Reason given: "its hourly.data starts at the current hour (not midnight), making alignment with other sources impossible." So Pirate Weather contributes to *current* and *daily* condition decisions only.

---

## 2. App-internal condition set

The app distinguishes a finite set of conditions. Each row below traces a condition from `deriveCondition`'s output through every layer that needs to know about it.

| Internal key | Hero label | Has headline copy | Has witty pool | Image folder | Background alias |
|---|---|---|---|---|---|
| `'storm'` | "Severe weather" / "Erge weer" | yes | yes (~32 lines × 5 langs) | `bg/storm/` (24 imgs) | — |
| `'rain'` | "Wet conditions" | yes | yes | `bg/rain/` (24 imgs) | — |
| `'rain-possible'` | "Possible showers" | yes | **no witty pool** | none | aliased to `bg/cloudy/` |
| `'wind'` | "Gusty winds" | yes | yes | `bg/wind/` (24 imgs) | — |
| `'cold'` | "Chilly" | yes | yes | `bg/cold/` (24 imgs) | — |
| `'heat'` | "Very hot" | yes | yes | `bg/heat/` (24 imgs) | — |
| `'uv'` | "High UV" | yes | yes | none | aliased to `bg/clear/` |
| `'fog'` | "Low visibility" | yes | yes | `bg/fog/` (24 imgs) | — |
| `'cloudy'` | "Overcast" | yes | yes | `bg/cloudy/` (24 imgs) | — |
| `'partly-cloudy'` | "Partly cloudy" | yes | **no witty pool** | none | aliased to `bg/cloudy/` |
| `'clear'` | "Pleasant" | yes | yes | `bg/clear/` (24 imgs) | — |
| `'night'` | "Clear night" | yes | yes | (uses `bg/clear/night_*` filenames) | — |

Source cross-checks:
- Hero labels and headlines: 11 conditions in `weather-copy.js:6-32`, lines 6-31.
- Witty pools: 10 conditions in `weather-copy.js:33-126`. **`rain-possible` and `partly-cloudy` are missing witty pools entirely.** Frontend falls back to `T.witty.clear.en` per `assets/app.js:628`.
- Image folders verified by `ls assets/images/bg/`: `clear/ cloudy/ cold/ fog/ heat/ rain/ storm/ wind/`. Eight folders, no `hail/` or `thunder/` or `partly-cloudy/`.
- Background alias table (`assets/weather-visuals.js:1-5`):

```js
export const WEATHER_BACKGROUND_ALIASES = {
  'rain-possible': 'cloudy',
  'partly-cloudy': 'cloudy',
  uv: 'clear',
};
```

**Confirm/deny user's question:**
- **Thunder as a distinct condition: NO.** It collapses to `'storm'` everywhere. There is no thunder image, no thunder-specific copy, no thunder badge.
- **Lightning as a distinct condition: NO.** Not detected by any source's mapping; would only register if a description contains 'thunder' or 'storm'.
- **Hail as a distinct condition: NO.** Pirate Weather alone reports `"Hail"`; `deriveCondition` priority 3 collapses it to `'cold'` (line 1095-1096). No image, no copy.

---

## 3. Condition-selection logic

Two separate functions decide a condition. They run at different times.

### 3.1 Server-side: `deriveCondition` (api/weather.js:1067-1157)

This is the **primary condition decider**. It runs once at API response time, produces `nowConditionKey`, and ships it to the client as `now.conditionKey`. It's also called per-day for the 7-day forecast.

**Verbatim priority order** (quoted from lines 1086-1156):

```js
function deriveCondition({ desc, rainChance, tempC, feelsLikeC, windKph, uvIndex, cloudPct, maxWindKph, isDay = true, dailyHighC }) {
  const d = String(desc || '').toLowerCase();

  const effectiveWind = windKph;
  const isTrulyOvercast    = isNum(cloudPct) && cloudPct >= 80;
  const isMostlyCloudy     = isNum(cloudPct) && cloudPct >= 55;
  const isSignificantCloud = isNum(cloudPct) && cloudPct >= 40;
  const isPartlyCloudy     = isNum(cloudPct) && cloudPct >= 30 && cloudPct < 55;

  const descSaysOvercast = d.includes('overcast');
  const descSaysPartly   = d.includes('partly') || d.includes('mainly clear') || d.includes('fair');
  const descSaysCloudy   = d.includes('cloud') && !descSaysPartly;
  const cloudyByDesc     = !isNum(cloudPct) && (descSaysOvercast || descSaysCloudy);
  const overcastByDesc   = !isNum(cloudPct) && descSaysOvercast;
  const partlyByDesc     = !isNum(cloudPct) && descSaysPartly;

  // 1. Storm
  if (d.includes('thunder') || d.includes('storm') || d.includes('tornado')) return 'storm';

  // 2. Extreme cold
  if (isNum(feelsLikeC) && feelsLikeC <= -5) return 'cold';
  if (isNum(tempC) && tempC <= 0)             return 'cold';

  // 3. Winter precipitation
  if (d.includes('snow') || d.includes('sleet') || d.includes('ice') ||
      d.includes('hail') || d.includes('blizzard') || d.includes('freezing')) return 'cold';

  // 4. Extreme heat
  if (isNum(tempC) && tempC >= 35)            return 'heat';
  if (isNum(feelsLikeC) && feelsLikeC >= 38) return 'heat';

  // 5. Heavy rain
  if (isNum(rainChance) && rainChance >= 60)  return 'rain';

  // 6. High UV — daytime only, not overcast, not significantly cloudy
  if (isDay && isNum(uvIndex) && uvIndex >= 8 && !(isTrulyOvercast || isMostlyCloudy || overcastByDesc)) return 'uv';

  // 7. Strong wind
  if (isNum(effectiveWind) && effectiveWind >= 30) return 'wind';

  // 8. Moderate rain
  if (isNum(rainChance) && rainChance >= 30)  return 'rain';

  // 9. Rain by description
  if (d.includes('rain') || d.includes('drizzle') || d.includes('shower') || d.includes('precip')) return 'rain';

  // 10. Moderate wind
  if (isNum(effectiveWind) && effectiveWind >= 25) return 'wind';

  // 11. Overcast
  if (isTrulyOvercast || overcastByDesc)      return 'cloudy';

  // 12. Possible rain
  if (isNum(rainChance) && rainChance >= 20)  return 'rain-possible';

  // 13. Fog / mist / haze
  if (d.includes('fog') || d.includes('mist') || d.includes('haze')) return 'fog';

  // 14. Cold (chilly)
  if (isNum(tempC) && tempC <= 10) {
    if (!isNum(dailyHighC) || dailyHighC <= 14) return 'cold';
    debugLog(`[Cold gate] tempC=${tempC} but dailyHighC=${dailyHighC} > 14 → not cold`);
  }

  // 15. Hot (warm)
  if (isNum(tempC) && tempC >= 30)            return 'heat';

  // 16. Moderate UV — daytime only, not significantly cloudy (40%+ blocks UV)
  if (isDay && isNum(uvIndex) && uvIndex >= 6 && !(isSignificantCloud || isMostlyCloudy || cloudyByDesc)) return 'uv';

  // 17. Mostly cloudy
  if (isMostlyCloudy || cloudyByDesc)         return 'cloudy';

  // 18. Partly cloudy
  if (isPartlyCloudy || partlyByDesc)         return 'partly-cloudy';

  // 19. Clear by description
  if (d.includes('clear') || d.includes('sunny') || d.includes('fair') || d.includes('wind')) return 'clear';

  // 20. Fallback
  return 'clear';
}
```

**Key observations on priority:**

- Storm (priority 1) wins over everything except… nothing. Good.
- Extreme cold (2) is `feelsLike <= -5 OR temp <= 0`. South African temperatures rarely hit those levels even on Lesotho-border highveld winter mornings.
- **High UV (priority 6) sits ABOVE chilly (priority 14), strong wind (7), moderate rain (8), and cold (14).** Chilly is gated by `dailyHighC <= 14`. There is no equivalent temperature gate on either UV rung.
- The chilly rung's `dailyHighC <= 14` gate is the bug — it allows UV at index 6 to fire on days with high 13°C if the *current* tempC is between 11° and 13° at the moment of evaluation (since chilly only fires at tempC <= 10).
- UV's blocker is cloud cover, not temperature. Lines 1106 and 1143 both gate on `isMostlyCloudy / isSignificantCloud / overcastByDesc / cloudyByDesc` — never on temp.

**`uvForCondition` time-of-day gating** (line 815):

```js
const uvForCondition = (localHour >= 10 && localHour < 16) ? medUv : null;
```

UV is suppressed before 10:00 and after 16:00, so the chilly bug only manifests during midday on cold days.

### 3.2 Frontend: `computeTodaysHero` and `computeHomeDisplayCondition` (assets/app.js:499-590)

The frontend has two more decision functions that re-rank the same data. They use `apiCondition = norm.conditionKey` (decided by server) but ALSO check rain probabilities, wind, cloud, UV against thresholds again.

`computeTodaysHero` priority order (quoted from lines 499-528):

```js
function computeTodaysHero(norm) {
  const apiCondition = (norm.conditionKey || '').toLowerCase();
  const dailyRain = norm.dailyRainPct;
  const effectiveWind = norm.windKph;
  const cloud = norm.cloudPct;
  const isTrulyOvercast    = isNum(cloud) && cloud >= 80;
  const isMostlyCloudy     = isNum(cloud) && cloud >= 55;
  const isSignificantCloud = isNum(cloud) && cloud >= 40;
  const isDay = norm.isDay !== false;
  if (isNum(dailyRain) && dailyRain >= 50) return 'rain';
  if (apiCondition === 'storm') return 'storm';
  if (apiCondition === 'cold') return 'cold';
  if (apiCondition === 'heat') return 'heat';
  if (isDay && apiCondition === 'uv' && !(isTrulyOvercast || isMostlyCloudy || isSignificantCloud)) return 'uv';
  if (isNum(dailyRain) && dailyRain >= 30) return 'rain';
  if (apiCondition === 'wind') return 'wind';
  if (isNum(effectiveWind) && effectiveWind >= 30) return 'wind';
  if (apiCondition === 'fog') return 'fog';
  if (apiCondition === 'cloudy') return 'cloudy';
  const hi = norm.todayHigh, low = norm.todayLow, uv = norm.uvDaily, feels = norm.feelsLike;
  if (isNum(feels) && feels <= -5) return 'cold';
  if (isNum(low) && low <= 0) return 'cold';
  if (isNum(hi) && hi >= THRESH.HOT_C) return 'heat';
  if (isDay && isNum(uv) && uv >= 8 && !(isTrulyOvercast || isMostlyCloudy || isSignificantCloud)) return 'uv';
  if (isNum(effectiveWind) && effectiveWind >= 25) return 'wind';
  if (isNum(hi) && hi <= 10) return 'cold';
  if (isMostlyCloudy) return 'cloudy';
  return 'clear';
}
```

Note that `computeTodaysHero` re-checks `apiCondition === 'uv'` BEFORE checking `low <= 0` or `hi <= 10`. So if the server returned 'uv', the frontend's hero pass also picks UV — even if today's low is 5°C and high is 13°C. The hero label will say "High UV" / "UV's hectic" with a sunny pool image.

`computeHomeDisplayCondition` (lines 530-590) has a similar structure but with rain-possible logic and majority voting from `norm.sourceConditions`. It also re-applies the UV check at line 572 without temperature gating.

---

## 4. API-code-to-condition mapping

### Per-source mapping table (combines API code → mapped string → `categorizeDesc` bucket → `deriveCondition` output)

| Source | Raw signal | Mapped to (description string) | `categorizeDesc` bucket | Likely `deriveCondition` output |
|---|---|---|---|---|
| Open-Meteo | code 95 | "Thunderstorm" | storm | storm |
| Open-Meteo | code 96 | "Thunderstorm with slight hail" | storm | storm (hail invisible) |
| Open-Meteo | code 99 | "Thunderstorm with heavy hail" | storm | storm (hail invisible) |
| Open-Meteo | code 71-77 (snow) | "...snow..." | cold | cold |
| Open-Meteo | code 56-67 (freezing) | "...freezing..." | cold | cold |
| Open-Meteo | code 80-82 (rain showers) | "rain showers" | rain | rain |
| Open-Meteo | code 45/48 (fog) | "Fog"/"Depositing rime fog" | fog | fog |
| WeatherAPI | code 1087 | text "Thundery outbreaks possible" | storm | storm |
| WeatherAPI | code 1273/1276 | text "...rain with thunder" | storm | storm |
| WeatherAPI | code 1279/1282 | text "...snow with thunder" | storm | storm (snow invisible) |
| WeatherAPI | code 1237 | text "Ice pellets" | **clear** (no keyword match) | depends on rain%/cloud% |
| WeatherAPI | code 1261/1264 | text "...showers of ice pellets" | **rain** (matches 'showers') | rain (hail invisible) |
| WeatherAPI | code 1066 | text "Patchy snow possible" | cold | cold |
| WeatherAPI | code 1000 | text "Sunny" | clear | clear (or 'uv' if UV high) |
| WeatherAPI | code 1003 | "Partly cloudy" (forced) | clear | partly-cloudy |
| MET Norway | `rainandthunder` | "Rain and thunder" | storm | storm |
| MET Norway | `lightrainandthunder` | "Light rain and thunder" | storm | storm |
| MET Norway | `heavyrainandthunder` | "Heavy rain and thunder" | storm | storm |
| MET Norway | `sleet` | "Sleet" | cold | cold |
| MET Norway | `lightsleet`/`heavysleet` | "Light sleet"/"Heavy sleet" | cold | cold |
| MET Norway | `rainshowersandthunder` | **NOT in metSymbolMap** — falls through as raw "rainshowersandthunder" | storm (matches 'thunder') | storm |
| MET Norway | `lightsnowshowers` etc. | **NOT in metSymbolMap** — raw "lightsnowshowers" | cold (matches 'snow') | cold |
| MET Norway | `sleetshowersandthunder` | **NOT in metSymbolMap** | storm | storm |
| MET Norway | `snowandthunder` | **NOT in metSymbolMap** | storm | storm |
| Pirate Weather | `thunderstorm` | "Thunderstorm" | storm | storm |
| Pirate Weather | `hail` | "Hail" | cold (matches 'hail') | cold |
| Pirate Weather | `tornado` | "Tornado" | storm | storm |
| Pirate Weather | `sleet` | "Sleet" | cold | cold |
| Pirate Weather | `wind` | "Windy" | clear (no keyword) | wind via `tempC/wind` numeric checks |

**Codes that are NOT mapped or are mismapped:**

1. **WeatherAPI ice pellets (codes 1237/1261/1264)** — text contains 'ice pellets' or 'ice pellets showers'. `categorizeDesc` matches 'showers' first → maps to `'rain'`. The `'ice'` keyword would map to 'cold' but 'showers' check runs first. So heavy ice pellets register as plain rain.
2. **MET Norway snow-shower variants** (`lightsnowshowers`, `snowshowers`, `heavysnowshowers`) — not in `metSymbolMap`, fall through as raw symbol_code strings. These do contain 'snow' so `categorizeDesc` catches them, but `deriveCondition` priority 3 `d.includes('snow')` catches them too. So they register as 'cold'. Mostly OK.
3. **MET Norway sleet-shower variants** (`lightsleetshowers`, `sleetshowers`, etc.) — not in `metSymbolMap`. Raw string contains 'sleet' → 'cold'. Mostly OK.
4. **MET Norway thunder-with-snow/sleet variants** — not in `metSymbolMap`. Raw string contains 'thunder' → 'storm' takes priority over 'snow'/'sleet'. Likely fine for thunder detection but loses the snow/sleet aspect.
5. **Lightning without precipitation (dry lightning)** — no source in the codebase has a "lightning" code mapping. Open-Meteo has no dry-lightning code. WeatherAPI has none. MET Norway has none in `metSymbolMap`. Pirate Weather has 'thunderstorm' but not bare lightning. Dry lightning never maps to any UI state.

---

## 5. Edge cases (log only — no proposed fixes)

These are observations, not necessarily bugs. Listing for completeness so the reviewer can challenge them.

1. **Description weights are fixed strings, not categories.** `pickWeightedMostCommon` (line 941) accumulates weight by exact description string. So "Thunderstorm" (Open-Meteo) and "Rain and thunder" (MET Norway) and "Patchy light rain with thunder" (WA) are three DIFFERENT descriptions that don't combine their weights — even though they all mean "thunder is happening". The weighted vote splits across nearly-synonymous descriptions and the most-common label wins. This may make thunder consensus harder than it should be.

2. **`deriveCondition` priority 1 reads the WINNING description, not the source-vote majority.** It only checks `d.includes('thunder')`. If the winning description is "Rain showers" because three sources said that and one said "Thundery outbreaks possible", priority 1 doesn't fire. So thunder can be invisible at the now-condition level if it's a minority view.

3. **`isHighveld` weight gate** (line 538) — `lat > -28 && lon > 25`. This is meant to suppress MET Norway's heat-wave boost on the highveld where MET runs cold. The lat/lon bounds are crude — Bloemfontein (lat -29.1, lon 26.2) wouldn't qualify (lat fails), but Polokwane (lat -23.9, lon 29.4) and Johannesburg (lat -26.2, lon 28.0) would. This is unrelated to thunder/UV bugs but worth flagging as a region-rule fragility.

4. **Hourly `aggregatedHourly` uses `[0]=Open-Meteo, [1]=WeatherAPI, [2]=MET Norway`** with weights `HOURLY_SOURCE_WEIGHTS` derived from `[OM, WA, MET]`. Pirate Weather is excluded (not aligned to local midnight). So thunder/hail signals from Pirate Weather can never reach hourly chart even if hourly chart starts to use descriptions.

5. **Rain consensus exception trusts Open-Meteo and MET Norway** (line 846-847) but NOT Pirate Weather. Quote: `(v.source === 'Open-Meteo' || v.source === 'MET Norway') && v.vote === 'rain'`. Pirate Weather can't single-source-trigger rain even though its GEFS ensemble is named in the file header as the most independent rain source. Inconsistent.

6. **`computeTodaysHero` and `computeHomeDisplayCondition` and `deriveCondition` have OVERLAPPING but NOT IDENTICAL priority orders.** Server decides one key. Frontend re-ranks it three more times (sky condition, hero, home display). Each pass can override the server's decision. The server's chilly gate (`dailyHighC <= 14`) is NOT replicated in the frontend's UV check — so even if the server returned 'cold', the frontend's `if (apiCondition === 'uv') return 'uv'` branch (line 512) would never fire for a 'cold' API response, but the frontend ALSO has its own UV-driving line at 522 (`uv >= 8`) which has no temp gate.

7. **`night` is a condition only in `weather-copy.js` (hero-label and witty pool), but `deriveCondition` never returns `'night'`.** It's instead reached by frontend logic when `isDay === false` AND condition would be 'clear'. Worth noting but not bug-related.

8. **Cloud-cover bimodal averaging** is fixed by `pickModalCloud` (line 956-982). But the modal cloud is computed from hourly values across sources at each hour index — not from per-source condition vote. So an hour where MET says clear and OM says overcast (both 50% real-world likelihood) lands in the modal of the side with two sources. Mostly OK.

9. **`partly-cloudy` and `rain-possible` have heroLabels and headlines but NO witty pool.** Frontend (`getWittyLine` line 628) falls back to `T.witty.clear.en` for these. So a "Possible showers" headline gets a witty line written for clear weather. Unrelated to current bugs but worth noting.

---

## 6. Recommended fixes (PROPOSED — not implemented)

### Bug 1 — Thunder and hail not surfaced

**Three-part fix:**

**Part A: stop collapsing hail into 'cold'.** Introduce a new internal condition `'hail'` (or `'thunder-hail'` if we want to keep them as a single bucket) and route the appropriate API codes there:

- Open-Meteo codes 96/99 → could route to 'storm' but with a hail flag, OR to a new `'thunder-hail'` bucket
- Pirate Weather `'hail'` icon → new `'hail'` bucket (currently → 'cold')
- WeatherAPI codes 1237/1261/1264 → new `'hail'` bucket (currently → 'rain' via the 'showers' keyword race)

**Code changes (rough scope):**
- New entry in `WEATHER_BACKGROUND_ALIASES` if no new image folder; new entry in heroLabels/headlines/witty in `weather-copy.js`
- New keyword check in `categorizeDesc` BEFORE the rain check (so 'ice pellets' / 'ice pellets showers' doesn't get caught by the 'showers' branch)
- New priority rung in `deriveCondition` between current 1 (storm) and 2 (extreme cold), e.g.: `if (d.includes('hail') || d.includes('ice pellets')) return 'hail';`

**Copy needed:** ~30-40 lines of witty per condition × 5 languages = 150-200 lines per new bucket. Plus 5 hero labels and 5 headlines = trivial.

**New image folder:** if introducing `'hail'` and/or `'thunder-hail'` as distinct conditions, yes (24 images each, matching existing folder shape). Or alias to `bg/storm/` initially as a stop-gap.

**Part B: surface thunder via consensus, not just description winning.** Today `deriveCondition` priority 1 only triggers on the *winning* description. Replace with: count source votes for thunder/storm; if ≥1 source explicitly reports thunder/storm AND no source contradicts (no source says 'clear'/'sunny'), trigger 'storm'. This mirrors the existing fog-majority pattern but with a lower threshold because thunder is visible/dangerous and worth surfacing on minority report.

**Code changes:**
- Pre-compute `sourceConditionVotes` BEFORE `deriveCondition` (currently computed after, line 831)
- New helper: `anyThunderVote(votes)` returning true if any source's `vote === 'storm'` from `categorizeDesc`
- Insert at priority 1 of `deriveCondition` ahead of the `d.includes('thunder')` check

**Part C: preserve per-hour descriptions in `aggregatedHourly`.** Currently the hourly array drops descriptions. Add a `conditionKey` field to each hour entry, derived per-hour from the same `deriveCondition` logic but using that hour's data. Then the hourly chart UI can show a thunder icon at hour 14:00 instead of just "80% rain".

**Code changes:**
- Each source's hourly extraction needs to keep `desc` per hour (currently only OM has weather_code, WA has hour.condition.text — neither is being saved)
- `aggregatedHourly` map function adds `conditionKey: deriveCondition({ desc: pickedHourDesc, rainChance, ... })`
- Hourly UI (`assets/app.js`) renders a per-hour icon based on `conditionKey`

### Bug 2 — UV beats Cold incorrectly

**One-line fix:** add a temperature gate to BOTH UV rungs in `deriveCondition` (priorities 6 and 16). Specifically:

```js
// Priority 6 (high UV)
if (isDay && isNum(uvIndex) && uvIndex >= 8
    && !(isTrulyOvercast || isMostlyCloudy || overcastByDesc)
    && !(isNum(dailyHighC) && dailyHighC <= 18)) return 'uv';

// Priority 16 (moderate UV)
if (isDay && isNum(uvIndex) && uvIndex >= 6
    && !(isSignificantCloud || isMostlyCloudy || cloudyByDesc)
    && !(isNum(dailyHighC) && dailyHighC <= 18)) return 'uv';
```

The `<= 18` threshold is a judgment call (at 18°C with UV 6 you can still get burned, so we don't want to gate too low) — alternative: gate on `tempC` rather than `dailyHighC` so UV blocks when current is cold even if the day will warm. Open question for the reviewer.

**Mirror the gate in the frontend** in `computeTodaysHero` (line 512, 522) and `computeHomeDisplayCondition` (line 572) — same `dailyHighC` (or `norm.todayHigh`) check.

### Other issues surfaced

- **`partly-cloudy` and `rain-possible` need witty pools** (or keep falling back to clear's pool). Quick to add.
- **`isHighveld` lat/lon gate is crude.** Bloemfontein and Kimberley are inland but don't qualify. If MET Norway's cold bias is a real research finding, the gate should be more inclusive of the central interior.
- **Description-weighted voting fragments thunder consensus.** Even if Part B isn't implemented, mapping descriptions to coarse categories BEFORE voting (then voting on categories) would be more robust than voting on raw strings.

---

## 7. Open questions

A reviewer should challenge or confirm each of these:

1. **WeatherAPI ice-pellet code parsing.** The mapping table claims 1261/1264 ("Light/Moderate showers of ice pellets") map to `'rain'` because the text contains 'showers' and that keyword is checked before 'ice'. The actual API text for these codes may differ from what's documented; we should verify the actual `condition.text` returned for those codes against a WeatherAPI sample response.

2. **Open-Meteo code 96/99 description string in practice.** Code 96/99 mapped strings contain 'thunder' AND 'hail'. The codebase processes 'thunder' first in `categorizeDesc`. Is that actually what we want — to lose the hail aspect by virtue of regex order? Or should hail be a separate output that LIVES alongside storm?

3. **Pirate Weather's `hail` icon — frequency.** How often does Pirate Weather actually emit `'hail'`? If it's rare and unreliable on its own, single-source-trusting it would produce false positives. We need a sample of real PW responses during a SA hailstorm to confirm.

4. **MET Norway compact endpoint — is the symbol_code list in the codebase complete?** The `metSymbolMap` covers ~20 codes but the actual MET symbol_code spec has dozens more (sleetshowers*, snowshowers*, *andthunder variants etc.). The investigation listed several missing codes from memory of the spec — verify against api.met.no's published symbol_code list.

5. **UV temp gate threshold.** Choosing 18°C is arbitrary. Should it be tempC-based (current temp) instead of dailyHighC? Or a relative gate ("don't show UV if dailyHigh is more than 5°C below the seasonal average")?

6. **Bug 2 reproduction.** The user reports "5°/13° + UV 6 → UV picked". Is the current temperature in fact above 10°C at the moment of viewing? If current was 5°C the chilly gate WOULD fire. If current was 11-13°C it wouldn't. We're assuming midday viewing — should confirm by checking actual deployed-app screenshot timestamp.

7. **Are `computeTodaysHero` and `computeHomeDisplayCondition` necessary?** They re-decide what `deriveCondition` already decided. If the server's decision is correct, the frontend should just trust it. The double-decision is a probable source of inconsistency and hides the bug location. Worth proposing a consolidation if scope allows.

8. **`night` condition.** Witty/copy banks have a 'night' bucket but `deriveCondition` never returns it. Is that intentional (frontend handles night) or stale code? Not bug-related but worth confirming.

9. **Rain consensus exception — why OM+MET but not PW?** Pirate Weather is named in the file header (line 7) as "a genuinely independent model cross-check" with the lowest mean absolute error in V2 research. But the BUG-1 trusted-rain-source list excludes it (line 846-847). Inconsistent — should PW be added to the trusted list?

10. **Hail vs hail-with-thunder copy register.** If we introduce a `'hail'` condition, should hail-with-thunder use the storm copy bank or its own? Two storms-with-different-flavours competing for one screen is a UX call.

---

End of investigation. The recommended fixes section is proposal only — no code has been changed in this pass.
