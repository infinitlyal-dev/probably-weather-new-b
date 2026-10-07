# Part B — same shape as the cloud bug, in the other conditions (7 Oct 2026)

**The shape:** a single number or a single source decides the headline, and the other sources can't overrule it, or two of them are enough to hold it.

This is a report only. Nothing has changed in the code. Full per-rung detail, with every count and query, is in the two agent reports (scratchpad `partB-ladder.md` and `partB-overrides.md`). The main counts I re-checked myself are marked ✔.

**Sources of evidence:**
- **"Harness":** six airports, 24 Jun – 22 Sep, 12,740 hours, replayed against what the airport reported.
- **"Live":** the recorder, 24 Sep – 7 Oct, with WeatherAPI's and Tomorrow.io's real wording.

## Changes what you see (photo and joke), ranked by how often it's wrong

| # | What fires | Decided by | Can the majority overrule it? | How many sources hold it | How often it was wrong | Example |
|---|---|---|---|---|---|---|
| 1 | Phone: "Might rain" when the day's chance is ≥ 50%, even with the next 4 hours dry (app.js:1951) | the day's blended % | no | none needed | harness: 860 hours, wet within an hour in only 73 (8.5%) ✔. It also overwrote 83 fog calls | dry Strand dawn on a 55% day: "Might rain." from 06:00 |
| 2 | Fog detector (weather.js:2731) | low visibility in Open-Meteo or Tomorrow.io, plus humid air | no | 1 | harness: 389 of 530 hours (73%) had no fog or mist reported ✔. Live: 17 fog heroes, none with fog at the airport. You ruled to keep it on 25 Sep | humid calm coastal dawn, airport CAVOK: "Foggy out there." |
| 3 | Radar "Rain's here" (weather.js:2675) | one Tomorrow.io reading > 0.5 mm/h | no | 1 | live: all 27 "Rain" heroes from 24–28 Sep came from this, 13 dry at the airport | Johannesburg 23 Sep: four sources clear, radar wins, dry night |
| 4 | Fog upgrade from one source's "Fog" (weather.js:2773) | one "Fog" word, plus humid and calm air | no | 1 | harness: 70% no fog or mist | Pirate "Fog" on a humid calm morning |
| 5 | Thunder from two words (weather.js:3713) | one thunder word plus any one rain-ish word; "possible" counts | no | 2 | live: WeatherAPI "Thundery outbreaks possible" plus one other word. Johannesburg 28 Sep 12:10 showed Thunder under CAVOK. Harness: thunder actually reported in 7 of 38 | Highveld afternoon, WeatherAPI hedging |
| 6 | Windy from one source's gust (weather.js:3809) | the single largest gust | only if no second source is near the line | 2 | live: 8 of 15 airport hours calm. Bloemfontein 29 Sep and 4 Oct: Windy for 11 hours on a WeatherAPI gust of 46–52, airport 3–9 knots | WeatherAPI overcooks the gust |
| 7 | "Might rain" from the 30% rule (weather.js:3822) | blended hour %, often just Open-Meteo + WeatherAPI (same model) | no (deliberately exempt) | 2 | harness: 70% dry within an hour when only those two cleared 30%. Live: 70% dry | the ECMWF twins at 35% on a dry afternoon |
| 8 | "Might rain" from rain words (weather.js:3817) | the winning description | no | 2 | harness: 67% dry same hour. Live: 63% dry within 75 minutes | two "Patchy rain possible"-type words |
| 9 | Phone: "Might rain" when the next 4 hours peak ≥ 30% (app.js:1946) | max blended % over 4 hours. Its vote check never takes effect, because a later line repeats the 30% rule | no | none needed | harness: 228 hours, 35% wet within an hour | one 60% hour three hours ahead |
| 10 | Fog on a 2–2 tie (weather.js:3508) | the description vote's tie-break | no | 2 | live: Durban 25 Sep 04:10, three sources clear, two "Fog", airport 6 km visibility | MET and Tomorrow.io fog vs three clear |
| 11 | Western Cape Windy at 17 km/h (wind.js) | model wind × 1.6 | only if fewer than 2 sources are near | 2 | 11% of calm hours called Windy (EVAL 14.1) | mild Cape Town afternoon |

## Day cards (week strip), not the main photo

| # | What | Finding |
|---|---|---|
| 12 | Daily Cloudy (weather.js:3846, 3872) | **The same bug as this morning, still open.** Day cards read the raw cloud number, not the new capped one. Of 101 noon "Cloudy" day cards, only 26 had grey cloud at the airport. 82 sat beside a hero that wasn't cloudy. |
| 13 | Daily wind (weather.js:3834) | Reads the Western Cape ×1.6 number against the old 25/30 lines, so 16 km/h is enough. The false rate isn't measured. |
| 14 | Daily rain ≥ 30% | Matches reality (30–50% days rained 69% of the time). Fine. |

## Looks fine on this evidence

- Rain-now (strict): 2% wrong.
- Showers nearby: 12–16% dry.
- Mean-wind Windy: airport calm 1.7%.
- Cold, heat, extreme heat and extreme cold: small samples, nothing contradicting.

## Side effect of Part A

The cap of 54% lets the high-UV rung fire. It fired 6 hours where it fired once before, all at Johannesburg, and 3 of those had grey cloud reported. This is small, but it's caused by the fix. If you want, I can keep the UV rung reading the raw number.

## Couldn't verify

- Whether Tomorrow.io is switched on in production now, and whether its "radar" is real radar over SA.
- Any real case of one Tomorrow.io thunder code turning the hero to storm.
- Fog with the strict regional rules: the harness doesn't apply them, so the fog numbers are overstated by about 30% at the coast.
- The live thunder count. The agent says 11 hours. I found 18 records carrying WeatherAPI's "Thundery outbreaks possible" next to the thunder rule, but couldn't cleanly count distinct hours.
- The daily wind false rate.
