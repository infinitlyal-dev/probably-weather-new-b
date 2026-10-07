# The cloud call — Strand, 7 Oct 2026, 07:00

Branch `calibration-cloud` (2 commits on top of 81957bd). Not on main. Waiting for Al.

## (a) This morning, run again

Same inputs both times: Open-Meteo's real Strand reply for today (07:00 cloud 67%, all of it high: low 0, mid 0, high 67), the other four sources rebuilt from the words they gave this morning (WeatherAPI "Overcast", Pirate "Clear sky", MET "Partly cloudy", Tomorrow.io "Cloudy").

| | live today (81957bd) | with the fix |
|---|---|---|
| hero | **Cloudy** | **Partly cloudy** |
| label beside it | "Mainly clear" (contradicts) | "Mainly clear" (agrees) |
| 07:00 in the hourly strip | clear | partly cloudy |
| what the phone shows | Cloudy | Partly cloudy |
| cloud % on the Sources page | 72 | 72 (unchanged) |

**The photograph will not change.** The app has no partly-cloudy photos: partly cloudy borrows the cloudy folder (`assets/weather-visuals.js:10`). The words and the joke change; the dark sky stays. To get a blue-sky photo on a cirrus morning, one of two rulings: partly cloudy borrows the clear folder instead, or thin high cloud lands on Clear rather than Partly cloudy. Neither is in this branch.

## (b) The scorecard

Six airports, 24 Jun – 22 Sep 2026, 12,740 hours, against what the airport reported. "Grey cloud" = the airport reported broken or overcast cloud below 20,000 ft. Airports here never report high cloud, so this can catch us missing a grey sky but cannot see cirrus.

What the phone shows:

| | live today | both rules | rule 1 only |
|---|---|---|---|
| said Cloudy, airport saw no grey cloud | 1,629 of 2,273 (72%) | 249 of 597 (42%) | 384 of 852 (45%) |
| airport saw grey cloud, we said partly cloudy or clear | 390 of 2,795 (14%) | 686 (25%) | 566 (20%) |
| airport-days better / worse | — | 183 / **52** | 168 / **34** |
| rain and wind scores | — | unchanged | unchanged |

Your rule was "if any station-day gets worse, stop and report". Some do, so I stopped. Every hour that got worse went Cloudy → Partly cloudy; none went to Clear. Worst days: Durban 21 Aug (14 hours worse, 5 better), George 30 Aug and 6 Sep (7 worse, 1 better each). George and Durban are where Open-Meteo most often misses low cloud.

By rule: rule 1 fixed 1,245 hours and broke 176 (7 to 1). Rule 2 fixed 135 and broke 120 (close to a coin flip). The harness can't reproduce WeatherAPI's own habits, so rule 2 may do better on real data than this shows. I couldn't verify that.

Full tables: `review/accuracy/results/compare-cloud-before-vs-cloud-after.md` and `…-vs-cloud-after-rule1.md`.

## (c) The rule

When Open-Meteo says there is almost no low or middle cloud (both under 20%), the app treats the sky as partly cloudy at most, however high the total cover. Rule 2: when at least half the sources say the sky is clear, the same cap applies.

## Also changed

- The hourly row for "now" carries the hero's answer, so the two can't disagree about the same hour.
- The label beside the condition keeps the sources' words when they match the condition, and uses the condition's own word when they don't.
- The hourly icons read the same capped figure, so the strip stops drawing grey clouds for cirrus. The cloud % numbers stay as the models gave them.
- Cost: two new Open-Meteo fields take each call from 3.0 to 3.2 units (+7%) on the 1M-unit plan. I left out high cloud (the prompt asked for it) because the rule never reads it and it would cost another 0.1 per call.
- Tests: `tests/cloud-high-cirrus.test.js` (this morning plus a real-grey-sky mirror), and the full suite passes: 161 files, 21,520 tests. Build passes.

## Your call

1. Ship both rules, ship rule 1 only, or neither. My pick is **rule 1 only**: it fixes this morning, gets most of the gain, and has 18 fewer worse days. Rule 2 can be measured on the real source words later.
2. The photograph question above, separately.

Not checked on a phone.

## Al's ruling (7 Oct 2026) — shipped

- Rule 1 only. Rule 2 is out of the code; its test is kept, skipped, waiting for a measurement on real source words.
- Partly cloudy borrows the **clear** photographs, in the app, on the share card and on the share link (`assets/weather-visuals.js`, `assets/share-url.js`). Rain-possible still borrows cloudy.
- High UV reads the raw cloud number (`deriveCondition` `uvCloudPct`).
- Harness on what shipped (`results/cloud-ruled.md`): phone Cloudy-with-no-grey 1,629 → 384, grey served light 390 → 566, 168 airport-days better / 34 worse, rain, wind and UV unchanged.
