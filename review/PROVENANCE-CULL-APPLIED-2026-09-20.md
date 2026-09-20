# The provenance cull, applied — 2026-09-20

Baken (Opus 5). Al's export `review/provenance-cull-ruled.json`: **417 cut, 0 rescued, 0 keepers cut.** Wired locally, one commit, nothing pushed. Production stays on `26c1a0b`.

## 1. Lines removed, per language

| | removed | left | how |
|---|---:|---:|---|
| **English** | **417 pairs** (411 distinct lines) | 1,123 on 293 photographs | `review/set-001-lines-bespoke-final.json` → `assets/hero-lines.js` |
| **Afrikaans** | **410 rows** | 1,108 | `apply-af-accepted.mjs` dropped every row whose English is no longer wired |
| **isiZulu** | 0 | — | no bespoke table exists; zu serves the condition bank |
| **isiXhosa** | 0 | — | same |
| **Sesotho** | 0 | — | same |

411 English lines left every photograph; 410 of them had Afrikaans (the 411th was the one row already held on `review/af-al.html`). Six of the 417 cut pairs were lines that survive on another photograph.

zu/xh/st is not an omission: `BESPOKE_TABLES` in `assets/app.js` holds `en` and `af` only, there is no `hero-lines-{zu,xh,st}.js`, and `review/translation-check-data.json` has 0 photograph rows for those three — 951 zu, 917 xh, 945 st, all bank. **The condition bank is untouched by the cull**, so nothing those languages serve has changed.

The generated tables regenerate from their own writers, not by hand: `build-hero-lines.mjs` (in sync, 1,299 keys, 4,979 line slots, 293 photographs) and `lang-check/apply-af-accepted.mjs` (1,108 rows written, 411 to `review/af-al.html`). Cross-checked: 0 removed AF rows whose English is still live, 0 surviving AF rows whose English is not.

## 2. Surviving totals

| condition | lines | photographs |
|---|---:|---:|
| wind | 193 | 35 |
| clear | 186 | 35 |
| cloudy | 174 | 35 |
| heat | 166 | 28 |
| cold | 88 | 35 |
| cold-clear | 86 | 28 |
| rain | 85 | 34 |
| storm | 80 | 35 |
| fog | 65 | 28 |
| **total** | **1,123** | **293 of 294** |

Photographs by surviving line count — **0: 1 · 1: 43 · 2: 56 · 3+: 194**. Full table per condition and time bucket: `node scripts/provenance-aftermath.mjs`. clear, cloudy, wind and heat sit at 2+ throughout; the thin end is storm (14 photographs on a single line), rain (12), fog and cold (6 each), cold-clear (5).

Of the 380 bank lines Al kept on 2026-08-23, **349 are still carried and 31 fall free** — uv 10, cold-clear 6, wind 3, clear 2, heat 2, hail 2, and one each of cold, cloudy, rain, storm, weekend, thunder. `--list-bank` prints them. Nothing is redeployed.

## 3. The bare photograph, and a correction

**The slot is `rain/week_2/day/3.webp` + `rain/week_4/day/3.webp`, photograph `fec85aba3f48` — not `rain/week_2/day/5.webp`.** The 2026-09-20 brief named day/5 because the split report did. `rain/week_2/day/5.webp` holds a different photograph (`a0ef2720c507`, two men under one umbrella), which kept its line and was never touched.

**And the three lines were not unruled.** `review/reroll-candidates/rain-w2-d3/candidates.json`, 2026-09-16, `chosen.ruledBy: "Al"` — Al picked candidate 2 of 3, and the ruling names those three lines: the photograph was generated to carry them. That is bucket A, not D. The cull page labelled them "no record" and he cut them on that label.

Cause, in one line: the split enumerated only the named `*-ruled.json` exports and read each photograph's slot from the authoring entry's `image` field, which a reroll leaves pointing at the old slot.

Nothing is resurrected. `review/slot-fill-rain-w2-d3.html` puts the decision back to Al on one screen:

- **The three the cull removed**, each with its real record, and which of them was also his own drag placement (one — `witty:rain#53`; the other two came from Astra's bucket and were swept up by the reroll ruling).
- **Three bank lines he ruled KEEP on 2026-07-05 that no photograph carries**, chosen against what is in the frame — a windscreen in heavy rain, wipers mid-sweep, stacked brake lights, a minibus taxi ahead: `witty:rain:27` "Every taxi on the road has decided to freestyle.", `witty:rain:14` "Everyone's forgotten how to drive. Again.", `witty:rain:5` "Joburg drivers are panicking already." Each already has native-reviewed Afrikaans in the bank, so promoting one costs no new translation.

Exports `review/slot-fill-rain-w2-d3-ruled.json`. Until he rules, the slot serves a condition-bank line, which is the documented behaviour for a photograph with no bespoke lines.

## 4. The guard

`scripts/build-hero-lines.mjs` already refused a slot whose BYTES moved under its lines. It now also refuses a RULING whose PHOTOGRAPH moved under it:

> RULING DRIFT — rain/week_2/day/5.webp was ruled on photograph 3bd49d0acf2b, which is no longer in the set; that slot now holds a0ef2720c507. 3 live line(s) still rest on that ruling (set-001-line-matches-ruled.json, set-001-lines-bespoke-rain-v3-astra-ruled.json): …

The test is the **hash**, not the slot: `99f7b2a` re-laid the whole grid on 2026-09-06, so nearly every export names a slot its photograph has left — harmless, because the lines attach by hash. What is not harmless is a ruling whose photograph is gone. A ruling none of whose lines survive is history, not a defect.

`node scripts/verify-ruling-drift-guard.mjs` proves it on the real case: it puts the three lines back, asserts the build refuses and names the vanished photograph, the slot, the photograph now in that slot, the export and the live line, then restores the tree and asserts `--check` still passes. It restores in a `finally` block.

Second drift, same root: all 294 authoring entries still annotated the slot they occupied before the re-layout. `scripts/sync-authoring-slots.mjs` re-points them (keeping the old value as `authoredFor`), and `build-hero-lines.mjs` now refuses while the two disagree. Provably inert — `assets/hero-lines.js` is byte-identical afterwards, because it never read those fields.

## 5. Seasonal exposure, on the surviving set

The 2026-09-19 audit found 68 seasonal photograph lines. **11 were cut, 57 survive.** Ten of the eleven are grade D (school run / holiday), one grade C:

`N172` summer clothes · `N194` `N167` `N473` `N291` `N432` `N433` `N577` `N578` school · `N574` `N400` holiday

`review/seasonal-tags.html` is rebuilt from the shorter list: **62 rows — 57 photograph lines + the 5 bank lines**. `review/seasonal-tags-worklist.json` records the 11 under `culled` so the count is traceable. Al is not asked about a line that no longer exists.

## 6. Translation check, on the surviving set

**311 flagged → 306.** 409 Afrikaans pairs dropped (their English is off every photograph); the back-translations were not re-run.

| | before | after |
|---|---:|---:|
| af | 90 | **85** |
| zu | 72 | **72** |
| xh | 78 | **78** |
| st | 71 | **71** |
| **total** | **311** | **306** |

Only five went. The cull could only touch `af/photo` rows, and most of the Afrikaans flags sit on lines Al had ticked himself, which survived. zu/xh/st are entirely bank rows and did not move.

## 7. Gates

| gate | result |
|---|---|
| serial suite (`vitest run --no-file-parallelism`) | **118 files, 22,415 tests, 0 failed** |
| fold matrix | **PASS — 72/72** (18 viewports × EN/AF × one-line/longest) |
| language gate (`apply-af-accepted.mjs`) | 1,108 rows written, 411 held, no medium/high finding |
| copy-split drift + import-scan (`build.mjs`) | PASS; 1,008/1,008 slots byte-equivalent, 294 canonical WebPs |
| image budget | PASS — 1,008 WebP ≤ 300 KiB |
| bespoke-line gate | **PASS — 9 checks** |
| gate shots | 24 shots → `output/gate-2026-08-14/`, real pairings |
| month-gate proof | **PASS — 0 out of season/place**, 12 months, EN+AF, Strand + Johannesburg |
| month-gate control | exit 1, as it must |

Three gates had to be corrected before they told the truth, and each correction is a real defect in the gate, not a loosened bar:

- **`verify-bespoke-lines.mjs`** asserted the pre-2026-09-19 invariant, "the caption is one of this photograph's lines", with no knowledge of the season and place gate that now sits between the lines and the screen. Once the cull left one photograph with a single summer-tagged line, the app correctly fell back to a condition line in September and the gate called it a failure. It now asserts "one of the lines in season here", and where nothing is in season, that the condition line stands.
- **`tests/bespoke-line-af.test.js`** hunted the shipped table for a photograph with partial Afrikaans coverage. There were two; the cull removed the lines that carried both gaps, and every surviving photograph is now fully translated. The behaviour under test is `applyBespokeLine`'s per-language pool, not the completeness of the table, so it now makes the gap with a stub when the table has none.
- **`tests/bespoke-line-season.test.js`** pinned ≥ 77 tagged bank-derived lines; one tagged line came off its photograph with the 417, so the floor is 76. Tracked to the real count, not loosened.

The month-gate proof, in full: first Saturday of every month June 2026 → May 2027, 12:00 SAST, English and Afrikaans, Strand and Johannesburg, the real picker plus every one of the 1,008 slot paths. ~14,900 photograph line-draws a month, **0 out of season or out of place in every month**. 76 tags in force (64 months, 28 region). Between 32 and 104 photographs a month fall back to a condition line because nothing on them is in season — pre-existing, and the reason the bespoke gate needed correcting.

## Held

Seasonal tagging, the Eskom page and the translation check stay paused for Al. Nothing pushed; the branch is local.
