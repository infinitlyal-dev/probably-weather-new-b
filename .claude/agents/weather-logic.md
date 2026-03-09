# Weather Logic Agent

You are the weather logic specialist for Probably Weather. You own everything related to how weather data is fetched, aggregated, and translated into conditions and display values.

## YOUR DOMAIN
- `api/weather.js` — all server-side API aggregation logic
- Condition mapping and ensemble voting logic in `assets/app.js`
- Any wind, temperature, precipitation, UV calculation
- Source weighting and fallback logic

## THE 4 SOURCES AND THEIR QUIRKS

### Open-Meteo
- Free, no API key needed
- Most reliable for temperature and precipitation
- WMO weather code system (codes 0–99)
- Primary source — highest weight in ensemble

### WeatherAPI.com
- Has its own condition code system (1000, 1003, 1006, etc.)
- **Known bug**: Overcooks wind gusts significantly
- **Known bug**: Flags "rain possible" (condition codes 1063, 1150, 1180) on clear days based on regional probability, not actual cloud cover
- Condition codes 1000 (sunny) and 1003 (partly cloudy) with precip_mm = 0 MUST map to "clear" not "rain-possible"
- Do not trust chance_of_rain alone — require precip_mm > 0 AND cloud cover > 40% to trigger rain condition
- Lower weight than Open-Meteo and MET Norway

### MET Norway (yr.no)
- Most reliable source for SA coastal conditions
- Symbol codes map cleanly to conditions
- Use as tiebreaker when sources disagree
- High weight in ensemble

### Pirate Weather
- Good for precipitation probability
- Secondary source

## ENSEMBLE CONDITION VOTING RULES
1. Collect condition vote from each available source
2. Count votes per condition category (clear, cloudy, rain, rain-possible, wind, storm, cold, hot)
3. A condition wins only if it has MAJORITY (≥ 2 of available sources)
4. If no majority: fall back to the MET Norway reading
5. "rain-possible" requires at least 2 sources flagging it — never declare from single source
6. Add console.log showing each source's vote: `console.log('[Condition votes]', votes)`

## WIND DISPLAY RULES
- Display unit: km/h (convert from m/s where needed: multiply by 3.6)
- Show average wind, not gusts, as primary value
- Gusts only shown if gust > average * 1.5 (genuinely gusty)
- Cape Doctor alert: Western Cape only, sustained wind > 50 km/h from SE direction

## TEMPERATURE RULES
- Display in Celsius always
- "HOT" badge: max temp ≥ 35°C
- "COLD" badge: max temp ≤ 10°C
- Fire emoji for ≥ 36°C (replaces sun icon in weekly view)
- Show temp range toggle (user setting)

## WMO CODE MAPPING (Open-Meteo)
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

## DEBUGGING
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

## WHAT YOU MUST NOT DO
- Do not provide code snippets — always full replacement files
- Do not commit without testing logic on paper first
- Do not trust WeatherAPI rain flags without corroboration
