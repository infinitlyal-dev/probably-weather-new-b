# Provenance split — 2026-09-20

Baken (Opus 5). Al's ruling: the app ships lines HE chose; machine-adopted lines come out. Nothing here is tagged, fixed, rewritten or wired — this is the split and the page he rules on. Production stays on `26c1a0b`.

> **CORRECTION, added when the cull was applied.** Bucket D below is wrong, and so is the slot it names. The three "no record" lines sit on photograph `fec85aba3f48`, which lives at `rain/week_2/day/3.webp` + `rain/week_4/day/3.webp` — not `rain/week_2/day/5.webp`. They have a ruling: `review/reroll-candidates/rain-w2-d3/candidates.json`, 2026-09-16, `chosen.ruledBy: "Al"`, and it names those three lines — Al chose candidate 2 of 3 as the photograph to carry them. That is a placement, bucket **A**.
>
> Cause: the split enumerated only the named `*-ruled.json` exports and never `review/reroll-candidates/*/candidates.json`, and it read the slot from the authoring entry's `image` field, which a reroll leaves pointing at the old slot. Corrected pre-cull split: **A 400, B 726, C 414, D 0** — and no photograph would have been left at zero.
>
> The cull page carried the wrong label on those three cards and Al cut them with the rest. They are on `review/slot-fill-rain-w2-d3.html` with their real record, to restore or replace. Everything else in this file stands: the other 414 cuts are all bucket C, correctly labelled. The guard against a recurrence is in `build-hero-lines.mjs`, proved by `scripts/verify-ruling-drift-guard.mjs`.

**The unit is the (photograph, line) PAIR, not the sentence.** The same line can be Al's pick on one picture and a machine's guess on another, and the pair is what renders. A line ticked for photograph X and now sitting on photograph Y has no ruling behind it.

**Live** = `review/set-001-lines-bespoke-final.json`, 1,540 pairs on 294 photographs, verified in sync with `assets/hero-lines.js` (`node scripts/build-hero-lines.mjs --check` → *in sync — 1302 keys, 6856 line slots, from 294 photographs*).

## Job 1 — the split

| | lines | photographs | what it is |
|---|---:|---:|---|
| **A** — Al placed it | **397** | 228 | he put this line on this photograph himself |
| **B** — Al ticked it | **726** | 246 | he ticked this line for this photograph, one card at a time |
| **C** — bulk-adopted | **414** | 172 | Astra's six buckets, adopted whole on 2026-09-05 (`d748068`), no per-line tick |
| **D** — no record | **3** | 1 | no ruled export behind the pair at all |
| | **1,540** | **294** | |

**A + B = 1,123 lines (73%) are his. C + D = 417 (27%) are not.**

### By condition

| condition | A | B | C | D | total | photographs |
|---|---:|---:|---:|---:|---:|---:|
| clear | 77 | 109 | 0 | 0 | 186 | 35 |
| cloudy | 68 | 106 | 0 | 0 | 174 | 35 |
| cold | 39 | 49 | **90** | 0 | 178 | 35 |
| cold-clear | 44 | 42 | **62** | 0 | 148 | 28 |
| fog | 33 | 32 | **69** | 0 | 134 | 28 |
| heat | 27 | 139 | 26 | 0 | 192 | 28 |
| rain | 40 | 45 | **83** | 3 | 171 | 35 |
| storm | 49 | 31 | **84** | 0 | 164 | 35 |
| wind | 20 | 173 | 0 | 0 | 193 | 35 |

clear, cloudy and wind are clean — every live line on them is Al's. The bulk adoption is concentrated in the five buckets he never reviewed card by card: cold, cold-clear, fog, rain, storm (388 of the 414 C lines).

### Photographs affected

- A touches 228 photographs, B 246; together **293 of 294** carry at least one line Al chose.
- C touches **172** photographs, D **1**.
- **If C and D come out whole, exactly 1 photograph goes to zero lines**: `rain/week_2/day/5.webp`.

### The records behind each bucket

| bucket | export | lines |
|---|---|---:|
| A | `set-001-line-matches-ruled.json` — drag-match tool v2, 2026-08-27 | 348 |
| A | `al-bare-photo-lines-2026-09-06.json` — written by hand for bare photographs | 34 |
| A | `al-written-lines-2026-09-06.json` — typed straight onto the photograph | 15 |
| B | `set-001-lines-bespoke-ruled.json` — round 1, 2026-08-18 | 171 |
| B | `astra-kill-rescues.json` — rescued off the kill gallery, 2026-09-06 | 154 |
| B | `set-001-lines-bespoke-cloudy-v3-ruled.json` | 105 |
| B | `set-001-lines-bespoke-heat-v2-ruled.json` | 78 |
| B | `set-001-lines-bespoke-clear-v3-ruled.json` | 75 |
| B | `set-001-lines-bespoke-wind-ruled.json` | 53 |
| B | `set-001-lines-bespoke-round2-ruled.json` | 39 |
| B | `set-001-lines-bespoke-clear-v2-ruled.json` | 27 |
| B | `set-001-humour-test-batch-ruled.json` | 24 |
| C | `set-001-lines-bespoke-{cold,storm,rain,fog,cold-clear,heat}-v3-astra-ruled.json` | 90 / 84 / 83 / 69 / 62 / 26 |

`set-001-line-matches-r2-ruled.json` (2026-09-06) placed nothing new — `placedCount: 0`; its `mergedByHash` carries round 1 forward.

### Two things the split turned up

**1. The Astra adoption was 418 kept, not 410.** `d748068`'s own message says *418 lines kept (72 KEEP/FIX + 346 new)*, and the six exports hold 418 between them. 414 are live as C. Of the other four, two sit on pairs Al had already placed himself (A outranks the adoption): `cold/week_1/day/6` "The dog refused to go outside. Fair." and `fog/week_3/day/7` "Walking to the bin is now an expedition." The last two are the rerolled slot below.

**2. `rain/week_2/day/5.webp` was rerolled underneath its rulings.** All three D lines have a ruled export — against hash `3bd49d0acf2b`, the photograph that used to hold that slot. The slot now holds `fec85aba3f48`. One of the three was Al's own drag placement, two were Astra's. `build-hero-lines.mjs` has a reroll guard for exactly this, but it only checks the authoring file against the bytes; a *ruling* that points at the old photograph is not caught. The lines were carried across a photo swap and nobody re-ruled them.

### One sub-label, reported inside its bucket, not instead of it

348 of the 397 A lines and 16 of the B lines are sentences Al also kept in the 2026-08-23 condition-bank review (`set-001-bank-ruled.json`, 380 lines). 6 C lines and 1 D line are too: he ticked those **sentences**, but nobody ticked them onto those photographs. The cull page shows this on the card so he can weigh it; it does not change the bucket.

## Job 2 — the cull page

`review/provenance-cull.html` — built by `scripts/build-provenance-cull-page.mjs`, opens off disk or through `node scripts/serve-review.mjs`, remembers choices in `localStorage` (`pw_provenance_cull`), exports `review/provenance-cull-ruled.json`.

- **View 1, the keepers** — 1,123 A and B lines, condition tabs, each line on its photograph. Kept by default; the only act is CUT.
- **View 2, the condemned** — 417 C and D lines with the provenance label on the card. **Cut by default**; the only act is RESCUE. Exporting without opening a single card cuts the lot, which is the ruling as briefed. It opens on this view.
- The footer carries the consequence live: lines surviving, photographs left, photographs at zero.

Export shape: `liveBefore`, `ruling` (`cutFromKeepers`, `rescued`), `after` (`lines`, `photographs`, `photographsAtZero`), then `cutFromKeepers[]`, `rescued[]`, `keep[]`, `cut[]` — each row carrying id, hash, image, condition, time, week, day, slots, text, bucket and the provenance sentence.

## Job 3 — the aftermath

`scripts/provenance-aftermath.mjs` reads his export and states, per condition and time bucket, the photographs left at 0 / 1 / 2 / 3+ lines, plus which of the 380 bank lines are then unused. It writes nothing and proposes nothing.

Dry run of the default ruling (every C and D cut, nothing rescued) — `node scripts/provenance-aftermath.mjs --dry`:

- 1,123 lines surviving on 293 of 294 photographs.
- Photographs at 0 / 1 / 2 / 3+ lines: **1 / 43 / 56 / 194**.
- The one at zero: `rain/week_2/day/5.webp`.
- Thin buckets afterwards: storm (14 photographs on one line), rain (12 on one), fog and cold (6 each), cold-clear (5). clear, cloudy, wind and heat stay at 2+ throughout.
- Of the 380 bank lines Al kept on 2026-08-23, **349 are still carried by a surviving line and 31 fall free** — uv 10, cold-clear 6, wind 3, clear 2, heat 2, hail 2, and one each of cold, cloudy, rain, storm, weekend, thunder. `--list-bank` prints them.

## Held, per Al's instruction

Seasonal tagging (`review/seasonal-tags.html`), the Eskom page and the translation check stay paused until the cull is ruled — the tagging runs on the surviving set, not on this one.
