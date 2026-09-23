# Live sample — 2026-09-23

Production API read at **2026-09-23T21:28:59.514Z** → 2026-09-23T21:29:10.903Z (UTC); 2026-09-23 23:28 SAST. METAR: aviationweather.gov, fetched 2026-09-23T21:29:09.565Z.

**One moment at six airports is an anecdote, not a score.** It shows what the Sources page and the blend said at that moment next to what the airport reported; the backtest in `blend-vs-sources.md` is the measurement.

## What this one sample shows

- Blend high minus the observed max so far: Cape Town +1.8, Johannesburg -0.9, Durban -2.7, Gqeberha -5.4, Bloemfontein -2.7, George -3.6. Within 2 °C at 2 of 6. A single source's own max was closer than the blend's at 6 of 6 (Cape Town: WA, PW, TI; Johannesburg: OM; Durban: OM, PW; Gqeberha: OM, PW; Bloemfontein: OM, WA, PW, MET; George: OM, PW, MET).
- At local hour 23:00 Tomorrow.io's "today" is 1 hour(s) long, so its "high" is the late-evening temperature: -12.3 to 0.2 °C against the observed max, and it still carries its full weight in the blended high (MET's strict high is null after about 12:00, so it carries none).
- The Tomorrow.io radar override set the server key to rain at Johannesburg (latest report 23:00: no present weather, clear) — the one route to rain the backtest cannot replay.
- Current votes matching the airport's latest report (5 airports with a recent, observed report): OM 3/5 · WA 2/5 · PW 4/5 · MET 4/5 · TI 2/5 · blend 2/5.

## What the numbers cover

`meta.sourceRanges` (api/weather.js:2639–2643) is not one window:

| source | min / max shipped | window |
|---|---|---|
| Open-Meteo | `daily.temperature_2m_min/max[0]` | the whole local calendar day (:1183–1184) |
| WeatherAPI | `forecastday[0].day.mintemp_c/maxtemp_c` | the whole local calendar day (:1316–1317) |
| Pirate Weather | `temperatureMin` / `temperatureHigh` | low: calendar day; high: Pirate's daytime high, 06:00–18:00 (:1445, :1456–1457) |
| MET Norway | `displayLow` / `displayHigh` | now → midnight while ≥ 12 of today's hours remain (to about 12:00); after that the next 24 h of MET's series, mostly tomorrow (:1614–1637) |
| Tomorrow.io | `todayLow` / `todayHigh` | now → midnight, however few hours are left (:1774–1778) |

The blend (`daily[0].highC` / `lowC`, :2068–2069) takes MET's high only while its strict window holds (null after about 12:00, :1646), Tomorrow.io's rest-of-day high always, and gives MET and Tomorrow.io no weight in the low (:1974).

At this sample the API's local hour was **23:00**, so Tomorrow.io's "today" was 1 hour(s) long and MET's range was its next 24 hours (mostly tomorrow).

## Temperatures (°C): each source's range, the blend, and the airport so far today

| airport | OM min/max | WA min/max | PW min/max | MET min/max | TI min/max | blend low/high | observed min/max so far (reports, SAST) | blend high − obs max | blend low − obs min |
|---|---|---|---|---|---|---|---|---|---|
| Cape Town (FACT) | 16.0 / 25.0 | 15.6 / 20.0 | 16.4 / 19.2 | 15.4 / 23.8 | 20.2 / 20.2 | 15.9 / 21.8 | 14 / 20 (37, 00:00–23:00) | +1.8 | +1.9 |
| Johannesburg (FAOR) | 11.8 / 24.6 | 16.1 / 25.6 | 12.3 / 22.6 | 14.0 / 25.9 | 16.9 / 16.9 | 13.4 / 23.1 | 11 / 24 (43, 00:00–23:00) | -0.9 | +2.4 |
| Durban (FALE) | 17.6 / 26.6 | 18.4 / 25.2 | 15.8 / 27.3 | 19.6 / 24.6 | 21.0 / 21.0 | 17.5 / 25.3 | 18 / 28 (26, 00:00–23:00) | -2.7 | -0.5 |
| Gqeberha (FAPE) | 18.1 / 28.0 | 17.9 / 20.0 | 16.5 / 25.0 | 17.4 / 20.7 | 19.0 / 19.0 | 17.7 / 23.6 | 18 / 29 (31, 00:00–23:00) | -5.4 | -0.3 |
| Bloemfontein (FABL) | 12.5 / 24.3 | 15.7 / 25.9 | 13.3 / 22.7 | 10.2 / 25.2 | 12.7 / 12.7 | 13.7 / 22.3 | 14 / 25 (13, 05:00–20:00) | -2.7 | -0.3 |
| George (FAGG) | 16.0 / 21.7 | 16.0 / 20.4 | 16.4 / 22.2 | 15.4 / 20.6 | 16.3 / 16.3 | 16.1 / 20.4 | 16 / 24 (35, 00:00–23:00) | -3.6 | +0.1 |

Error of each source's own max against the observed max so far (°C):

| airport | OM | WA | PW | MET | TI | blend | closest to the observed max |
|---|---|---|---|---|---|---|---|
| Cape Town | +5.0 | 0.0 | -0.8 | +3.8 | +0.2 | +1.8 | WA |
| Johannesburg | +0.6 | +1.6 | -1.4 | +1.9 | -7.1 | -0.9 | OM |
| Durban | -1.4 | -2.8 | -0.7 | -3.4 | -7.0 | -2.7 | PW |
| Gqeberha | -1.0 | -9.0 | -4.0 | -8.3 | -10.0 | -5.4 | OM |
| Bloemfontein | -0.7 | +0.9 | -2.3 | +0.2 | -12.3 | -2.7 | MET |
| George | -2.3 | -3.6 | -1.8 | -3.4 | -7.7 | -3.6 | PW |

## Right now: the airport's latest report against each source's current vote and the blend

Observed category = the report in the vote vocabulary of `categorizeDesc` (api/weather.js:3530): thunder → storm, precipitation → rain, fog/mist/haze → fog, BKN/OVC → cloudy, FEW/SCT/clear → clear. "unobserved" = an AUTO report with no present-weather sensor (`//`). ✓ = the vote matches.

A latest report more than 90 min older than the API read is shown but not marked (stale).

| airport | latest report (SAST, age) | observed | OM | WA | PW | MET | TI | blend (server `now.conditionKey`) |
|---|---|---|---|---|---|---|---|---|
| Cape Town | 23:00 (29 min) | no wx, 0/8, 13 km/h, 19°C → **clear** | Overcast → cloudy ✗ | Overcast → cloudy ✗ | Partly cloudy → clear ✓ | Partly cloudy → clear ✓ | Drizzle → rain ✗ | cloudy (overcast) ✗ |
| Johannesburg | 23:00 (29 min) | no wx, 0/8, 15 km/h, 15°C → **clear** | Clear sky → clear ✓ | Partly cloudy → clear ✓ | Partly cloudy → clear ✓ | Clear sky → clear ✓ | Light rain → rain ✗ | rain (tomorrow-io-radar-override) ✗ |
| Durban | 23:00 (29 min) | no wx, 0/8, 9 km/h, 21°C → **clear** | Clear sky → clear ✓ | Patchy rain possible → rain ✗ | Clear sky → clear ✓ | Clear sky → clear ✓ | Clear sky → clear ✓ | clear (desc-clear-keyword) ✓ |
| Gqeberha | 23:00 (29 min) | no wx, 8/8, 9 km/h, 19°C → **cloudy** | Overcast → cloudy ✓ | Patchy rain possible → rain ✗ | Cloudy → cloudy ✓ | Cloudy → cloudy ✓ | Overcast → cloudy ✓ | cloudy (overcast) ✓ |
| Bloemfontein | 20:00 (209 min) | no wx, 0/8, — km/h, 15°C → **clear** — stale | Overcast → cloudy | Patchy rain possible → rain | Partly cloudy → clear | Fog → fog | Partly cloudy → clear | fog (visibility-humidity-fog-detector) |
| George | 23:00 (29 min) | BR, 6/8, 2 km/h, 16°C → **fog** | Overcast → cloudy ✗ | Mist → fog ✓ | Cloudy → cloudy ✗ | Partly cloudy → clear ✗ | Overcast → cloudy ✗ | cloudy (overcast) ✗ |

## Sample provenance

| airport | API read at (UTC) | server cache | payload computed at | sources live | failed |
|---|---|---|---|---|---|
| Cape Town | 2026-09-23T21:28:59.515Z | miss | 2026-09-23T21:28:59.883Z | OM, WA, PW, MET, TI | — |
| Johannesburg | 2026-09-23T21:29:01.483Z | miss | 2026-09-23T21:29:01.471Z | OM, WA, PW, MET, TI | — |
| Durban | 2026-09-23T21:29:03.054Z | miss | 2026-09-23T21:29:03.036Z | OM, WA, PW, MET, TI | — |
| Gqeberha | 2026-09-23T21:29:04.620Z | miss | 2026-09-23T21:29:04.611Z | OM, WA, PW, MET, TI | — |
| Bloemfontein | 2026-09-23T21:29:06.195Z | miss | 2026-09-23T21:29:06.172Z | OM, WA, PW, MET, TI | — |
| George | 2026-09-23T21:29:07.757Z | miss | 2026-09-23T21:29:07.978Z | OM, WA, PW, MET, TI | — |

Raw latest METARs: `METAR FACT 232100Z 19007KT CAVOK 19/15 Q1019 NOSIG` · `METAR FAOR 232100Z 19008KT CAVOK 15/13 Q1030 NOSIG` · `METAR FALE 232100Z 20005KT CAVOK 21/18 Q1021 NOSIG` · `METAR FAPE 232100Z 24005KT 9999 OVC023 19/19 Q1024 NOSIG` · `METAR FABL 231800Z /////KT CAVOK 15/14 Q1027 NOSIG` · `METAR FAGG 232100Z AUTO 13001KT 4800 BR SCT001/// BKN003/// 16/16 Q1024`

