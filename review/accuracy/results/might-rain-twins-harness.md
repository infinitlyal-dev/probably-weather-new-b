# "Might rain." from the 30 % hour on the harness (Part B item 6, 8 Oct 2026)

Six airports, 2026-06-24 → 2026-09-22. 296 hours the shipped resolver served "Might rain." from the blended 30 % line. "Wet" = rain reported that hour or the hour either side.

| which slots were at 30 % or more | hours | wet | dry |
|---|---|---|---|
| only Open-Meteo and the WeatherAPI slot (ECMWF twice) | 204 | 61 (30 %) | 143 |
| at least one independent model | 92 | 43 (47 %) | 49 |

## Candidate rules: the "Might rain." hours each would keep

| rule | hours kept | wet | dry | wet hours lost | dry hours removed |
|---|---|---|---|---|---|
| today (no change) | 296 | 104 | 192 | 0 | 0 |
| A: an independent source at 30 % too | 92 | 43 | 49 | 61 | 143 |
| B: twins alone need 50 % | 133 | 60 | 73 | 44 | 119 |
| B: twins alone need 60 % | 98 | 45 | 53 | 59 | 139 |

Blend bands of the twins-only hours:

| blend | hours | wet |
|---|---|---|
| 30–39 % | 94 | 26 (28 %) |
| 40–49 % | 69 | 18 (26 %) |
| 50–59 % | 35 | 15 (43 %) |
| 60–100 % | 6 | 2 (33 %) |
