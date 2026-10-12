# "Rain's here" when the sources say it is raining — the numbers (12 Oct 2026)

**What started it.** Strand tonight: steady light rain from about 18:00. The app said "Probably Might rain.", 47 %, with the cloudy photo and a cloudy-night joke. At 21:14 it still said the same, with four sources describing rain (saved: `C:\Users\27741\pw-rainnow\review\accuracy\incidents\strand-2026-10-12-2055.json`).

**The candidate.** "Rain's here" when at least 3 sources describe rain now, from at least 2 model families (Open-Meteo + WeatherAPI count as one), and the hour's blended rain is at least 0.5 mm. It doesn't look at the % at all. It's added on top of today's rule (2 sources, 90 %, 2 mm). Today's rule, the radar route and "Showers nearby" are unchanged.

## The table: 2026 at 10 airports, 78,338 hours (the replay the 73–75 % came from)

| rule | "Rain's here" calls | right that hour (±1 h) | dry when it said rain | rain hours caught (±1 h) |
|---|---|---|---|---|
| **Today** | 372 | **73 %** (84 %) | 100 = 27 % | **272 of 3,702 = 7 %** (12 %) |
| **Today + candidate** | 3,197 | **48 %** (64 %) | 1,664 = 52 % | **1,533 = 41 %** (52 %) |
| Neighbour (a): 0.3 mm | 4,379 | 44 % (60 %) | 2,468 = 56 % | 1,911 = 52 % (62 %) |
| Neighbour (b): 2 sources, 2 families | 3,300 | 47 % (62 %) | 1,753 = 53 % | 1,547 = 42 % (53 %) |

**By region (today → today + candidate): right when it said rain · rain hours caught**

| region | today | + candidate |
|---|---|---|
| Western Cape | 90 % · 12 % | **72 % · 39 %** |
| Garden Route | 98 % · 12 % | **79 % · 41 %** |
| KZN coast | 100 % · 4 % | **73 % · 39 %** |
| Highveld | 65 % · 3 % | 58 % · 41 % |
| Eastern Cape | 59 % · 6 % | 48 % · 42 % |
| Northern Cape | 78 % · 14 % | 42 % · 50 % |
| Free State | 76 % · 9 % | 36 % · 40 % |
| Lowveld | 36 % · 4 % | 27 % · 42 % |
| North West | 20 % · 1 % | 24 % · 52 % |
| Limpopo | 13 % · 1 % | 20 % · 33 % |

**The same question, measured two more ways**

- **Real source words, live** (the hourly recorder, 6 airports, 24 Sept to 12 Oct, 2,325 readings): right 70 % → **69 %**, rain caught 27 % → **43 %**.
- **The app's own code, end to end** (6 airports, winter, June to Sept 2026, 12,740 hours): right 93 % → **74 %**, rain caught 5 % → **44 %**.

**Hours like tonight's** (3+ sources describing rain, under 60 %, 0.5–2 mm). The archive has 368 of them. The airport was wet in only 25 % of them that hour, 39 % within an hour. In the Western Cape it was 7 of 12. Live there were 13 such readings, and 3 were wet.

## Strand tonight, hour by hour (the app's own reads)

| SAST | sources describing rain | rain | the app said | candidate | (a) 0.3 mm | (b) 2 sources |
|---|---|---|---|---|---|---|
| 18:10 | none (WeatherAPI "rain possible") | 0 mm | Cloudy | Cloudy | Cloudy | Cloudy |
| 19:10 | 2 (WeatherAPI, MET) | 0.4 mm | Might rain | Might rain | Might rain | Might rain |
| 20:10 | 3 (OM, WA, MET), 2 families | 1.0 mm | Might rain | **Rain's here** | Rain's here | Rain's here |
| 21:10 | 4 (OM, WA, MET, Tomorrow.io), 3 families | 1.2 mm | Might rain | **Rain's here** | Rain's here | Rain's here |

So it catches 2 of tonight's 4 wet hours. At the first hour of rain, no source was describing it yet. Same evening at Cape Town airport, 27 km away: the candidate would have said "Rain's here" at 20:10 and 21:10, and the airport reported dry both times.

## The cascade (wet hour → cloudy photo + cloudy joke), today's code, no change made

Rain at the airport, but the app showed "Might rain" (photo from the cloudy set, a cloudy line):

| Western Cape | Garden Route | Eastern Cape | KZN coast | Highveld | Free State | **all** |
|---|---|---|---|---|---|---|
| 59 of 103 = 57 % | 146/215 = 68 % | 133/190 = 70 % | 112/174 = 64 % | 43/67 = 64 % | 18/51 = 35 % | **511 of 800 = 64 %** |

Live, with real source words: 73 of 192 wet readings = 38 %. With the candidate, the replay's 64 % drops to 31 %, because the rain photo and rain lines take over.

## The honest line

If it ships everywhere: right-when-it-says-rain drops from **73–75 % to 48–54 %** on the archive (about where the old rule was before your 25 Sept ruling), and from 70 % to 69 % live. Rain hours caught go from **7–10 % to 28–41 %** on the archive and from 27 % to 43 % live.

**Vonk:** I'd ship it on the coast only (Western Cape, Garden Route, KZN coast). There it stays 72–79 % right and catches three to ten times more rain, Strand included. Inland in summer storm country it's wrong more often than right. That regional switch is yours to rule. I didn't tune for it.

<details><summary>What to know before ruling</summary>

- **Two things ship with it.** When the candidate says "Rain's here", the % beside it is raised to 70 (Likely), as the radar route already does. Tonight that means "Rain's here · 70 %" instead of "47 %". The phone also had to be told to trust the new reason; without that it quietly turns it back into "Might rain".
- **The archive has no real WeatherAPI, MET Norway or Tomorrow.io words.** Every "description" there is a stand-in weather model's code (same as on 25 Sept). Only the live numbers use real words, and they cover 19 days, 6 airports and 44 extra calls (30 of them wet).
- **The family rule only bites at 2 sources.** Only 2 of the 5 sources are ECMWF, so any 3 sources always span 2 families.
- **Two different "today" figures.** Today's rule keeps the 25 Sept vote count, so its 73–75 % is unchanged. The candidate counts sources the way production does. The 93 % comes from the end-to-end run: a different 6 airports, winter only.
- **Files:** archive replay `C:\Users\27741\pw-rainnow\review\accuracy\v3\rainnow-descriptive.mjs`; live check `C:\Users\27741\pw-rainnow\review\accuracy\live\rain-now-descriptive.mjs`; cascade `C:\Users\27741\pw-rainnow\review\accuracy\rain-now-cascade.mjs`; code on branch `fix/rain-now-descriptive` (not on main, nothing live).
</details>
