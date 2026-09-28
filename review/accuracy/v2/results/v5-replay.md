# This morning, replayed on the shipped rules (28 Sept 2026)

Recorder readings at 07:10 and 08:10 UTC (09:10 and 10:10 SAST). "Served" is what production said; "now" is the same
recorded inputs through the shipped wind rule (api/_lib/wind.js) and the ladder; the sky is unchanged (its test failed).

| place, UTC | sources' wind (OM · WA · Pirate · MET · TI) | largest gust | served: wind, hero | now: wind (rule), hero | there |
|---|---|---|---|---|---|
| Strand, 07:10 | 11.4 · 10.4 · 22.5 · 39.2 · 18.4 | 23 | 19.2 km/h, clear (majority-override-clear); cloud 76.56 % → phone cloudy | 19.2 km/h (today), clear (majority-override-clear) | SAWS Strand 68911, 06 UTC: 28 km/h from 110°, gust 50 · Yr: 10 m/s (36 km/h) from the east · Al: wind pumping, palms bent hard; thin high streaks, some low cloud on the mountains |
| Strand, 08:10 | 14.7 · 11.2 · 25.6 · 36.7 · 18 | 29.9 | 20.2 km/h, cloudy (overcast); cloud 81.25 % → phone cloudy | 20.2 km/h (today), cloudy (overcast) |  |
| Cape Town city, 07:10 | 24.7 · 16.9 · 22.5 · 29.2 · — | 69.1 | 23.4 km/h, wind (gust-wind); cloud 62.5 % → phone wind | 37.4 km/h (BC ×1.6), wind (sustained-wind) | Cape Town airport (17 km) METAR 07 UTC: 11 km/h, CAVOK; 08 UTC: 9 km/h, CAVOK |
| Cape Town city, 08:10 | 21.8 · 16.2 · 25.6 · 28.8 · — | 63.4 | 22.6 km/h, wind (gust-wind); cloud 98.4 % → phone wind | 36.2 km/h (BC ×1.6), wind (sustained-wind) |  |

The phone shows the server's wind key as it is; with a server key it no longer re-derives Windy from the number
(Fable, plan item 7). Its cloud rung (cloud ≥ 60 % over a server "clear" → cloudy) is unchanged: the sky change failed its bar.
