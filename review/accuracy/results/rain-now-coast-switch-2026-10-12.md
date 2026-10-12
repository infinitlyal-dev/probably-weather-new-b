# "Rain's here" by description: coast only (12 Oct 2026)

Maat's ruling, waiting for Al's "push": the new rain rule works in **Western Cape, Garden Route and KZN coast** only. Every other region keeps today's rule exactly. It is built on branch `fix/rain-now-descriptive`. Nothing on main, nothing live.

How a place gets its region: the nearest measured weather station (the same map the fog rule already uses). Strand, Hermanus, Worcester → Western Cape. Knysna, Plettenberg Bay → Garden Route. Ballito, Richards Bay → KZN coast. Saldanha → West Coast, Jeffreys Bay → Eastern Cape, Pietermaritzburg → KZN inland: none of those get the rule.

## 1. The three coast regions, switch on

| | right when it says rain | rain hours caught |
|---|---|---|
| **2026 replay, 10 airports** (where the 73–75 % came from) | | |
| Western Cape | 90 % → **72 %** | 12 % → **39 %** |
| Garden Route | 98 % → **79 %** | 12 % → **41 %** |
| KZN coast | 100 % → **73 %** | 4 % → **39 %** |
| the three together | 96 % → **76 %** (78–81 % on the other two source set-ups) | 9 % → **40 %** (30–37 %) |
| **The app's own code, winter 2026** | | |
| Cape Town airport | 10 of 10 → **39 of 53 = 74 %** | 10 → **39 of 103 = 38 %** |
| George | 9 of 11 → **81 of 104 = 78 %** | 9 → **81 of 215 = 38 %** |
| Durban | 14 of 14 → **96 of 106 = 91 %** | 14 → **96 of 174 = 55 %** |
| **Live, real source words** (24 Sept to 12 Oct) | | |
| the three coast airports | 15 of 25 = 60 % → **27 of 45 = 60 %** | 16 % → **29 %** |

Nationally, on the 2026 replay, "Rain's here" stays **72–74 % right** (today 73–75 %), and rain hours caught go from 7–10 % to **16–19 %**.

## 2. Inland is today's code, hour for hour

- **The app's own code, 12,740 hours:** at Johannesburg, Gqeberha and Bloemfontein, all **6,277 hours are identical to today in every column** (hero, server answer, reason, rain %, everything). The only hours that changed are on the coast, and every one of them is an hour that became "Rain's here": Cape Town 43 (29 wet at the airport), George 93 (72 wet), Durban 92 (82 wet). The proof script refuses to run on swapped, truncated or mismatched files.
- **2026 replay:** **0 of 59,285 inland hours** differ from today.
- **The real handler at every region point:** the same rainy sky at all 20 station points (13 regions), plus Saldanha, Plettenberg Bay, Jeffreys Bay, Ballito, Pietermaritzburg and a point outside South Africa. It fires only in the three coast regions. Everywhere else the answer equals today's ladder on the same inputs, and the % is not lifted.

## 3. Strand tonight, switch on (Strand is Western Cape)

| SAST | sources describing rain | rain | the app said | with the switch |
|---|---|---|---|---|
| 18:10 | none | 0 mm | Cloudy | Cloudy |
| 19:10 | 2 | 0.4 mm | Might rain | Might rain |
| 20:10 | 3, 2 families | 1.0 mm | Might rain, 47 % | **Rain's here, 70 %** |
| 21:10 | 4, 3 families | 1.2 mm | Might rain, 47 % | **Rain's here, 70 %** |
| 22:10 | 3, 3 families | 0.6 mm | Might rain, 42 % | **Rain's here, 70 %** |

## 4. The live recorder scores it from now on

The recorder already saves everything the rule needs every hour: each source's words, the app's exact inputs and the airport report. So it needs no change. `score.mjs` (the live score) now has a "coast only" table per region, in two versions: everything recorded, and only the hours since 23:00 SAST tonight. For each read it re-runs the app's own rule. Once the rule is live it also checks that what the app served matches. Run it with:

```
node C:\Users\27741\pw-rainnow\review\accuracy\live\score.mjs
```

**What to watch:** live on the coast it is so far 60 % right, not the replay's 76 %. That's on only 45 calls, and Cape Town airport had 12 wet readings in 19 days. A few weeks of wet weather on the coast will show which number holds.

<details><summary>Checks</summary>

- All tests pass (21,582) and the build is clean. Sol reviewed the switch three times: HOLD (fixes to how it is measured, not to the rule), HOLD (two tighter checks), SHIP. Record: `rain-now-coast-switch-sol.md`.
- Sol confirmed the switch itself fails closed. Only the three named regions turn it on, and an older cached answer without the flag keeps today's rule.
- Files: `C:\Users\27741\pw-rainnow\review\accuracy\rain-now-switch-proof.mjs` (hour-for-hour proof), `...\live\rain-now-switch-lib.mjs` (live scoring), `...\v3\rainnow-descriptive.mjs` ("coast switch" rule).
</details>
