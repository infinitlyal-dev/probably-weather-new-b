# Re-shoot brief — 15 cuts from Al's curation pass, 2026-08-18

Source: `review/set-001-cut-list.json`, derived from Al's export
(`review/set-001-crop-anchors-2026-08-18.json`, 279 keep / 15 cut, a complete
pass over all 294).

## The finding that changes the target

Al's read going in: *"The images cut were mostly ones made by Sol."* The data
says something sharper.

| | images | kept | cut | failure |
|---|---:|---:|---:|---:|
| the 29 re-shot on 2026-08-14 | 29 | 14 | **15** | **52%** |
| everything older | 265 | 265 | 0 | **0%** |

Every single cut came from the batch ingested four days ago. Nothing older was
cut at all. So this is not a slow drift in the library — it is one batch, or one
prompt recipe, that misses. Replacing "Sol's images" broadly would be replacing
265 frames that Al has just re-approved.

## Where the holes are

| bucket | had | cut | left | rotation slots lost |
|---|---:|---:|---:|---:|
| storm-night | 7 | 4 | **3** | 8 |
| wind-night | 7 | 4 | **3** | 8 |
| wind-day | 14 | 4 | 10 | 4 |
| rain-night | 7 | 2 | 5 | 4 |
| wind-dusk | 7 | 1 | 6 | 2 |

26 rotation slots in total. **storm-night and wind-night are down to three
photographs each** — over half of each bucket's rotation now has no image of its
own and falls through the picker's chain. Those two are the priority; wind-day
at 10 remaining is comfortable.

## What is wrong with them — Al's words

> "Its like it doesnt get our sense of humour, some of the images looked
> plastic, most of the buildings would be cream and then have this weird green
> finish, the architecture looks bland and not modern suburban SA, also it would
> always have a white plastic chair lying about when it is wind or storm. And
> its almost like it is afriad to add real world texture to the images."

Confirmed by eye on the frames themselves:

- **`wind/week_1/night/1`** — a Karoo farmstead: corrugated roof, ochre render,
  moon, windmill, tipped washtub *and* an overturned chair. Platteland trope,
  not the Helderberg. The chair again.
- **`wind/week_4/day/6`** — a collapsed navy gazebo beside a sports pavilion
  with a dugout and a flat grey sky. Reads Northern European; nothing in the
  frame says South Africa.

The pattern under both: **the blown-over object is doing the storytelling**. A
chair, a washtub, a gazebo — one prop knocked flat, centred, well lit. It is the
visual equivalent of explaining the joke, which is the exact failure
`review/PAIRING-TASTE.md` warns about for lines.

## What replacements have to do

1. **COUNTRYWIDE suburban, not farm and not Europe.** Al overruled a
   Helderberg-only reading of this on 2026-08-18: *"dont just make it
   Helderberg suburban, Johburg, Durban etc. The rest of the country needs to
   be part of it to otherwise it just starts feeling like a CT app and not
   countrywide."* Weighted to where each signature lives — Highveld storms in
   Gauteng, subtropical downpours in KZN, the wind belt across both Capes.
   Face-brick and plaster, security gates, palisade fencing, aloes and fynbos
   verges, paving.
2. **No blown-over prop as the subject.** Wind and storm show in what is *still
   standing* and straining — washing on a line, a palm bending, spray off a
   roofline, a gate swinging.
3. **Real-world texture.** Rust, damp patches, hose reels, a wheelie bin, marks
   on a wall. Al's note that it is "afraid to add texture" is the whole
   difference between a photograph and a render.
4. **Cream walls are fine; the green cast is not.** Whatever is putting a green
   finish on cream render has to go — a colour check on every candidate.
5. **Night frames must carry their own light.** storm-night and wind-night are
   the two thin buckets and the two hardest to light; a streetlight, a stoep
   light, a window is what makes a night frame readable at 89% of the screen.

## Priority order

1. `storm-night` ×4 (down to 3)
2. `wind-night` ×4 (down to 3)
3. `rain-night` ×2
4. `wind-day` ×4
5. `wind-dusk` ×1


## Outcome

All 15 generated on GPT Image 2 (2k, high, two candidates each), all 15 picked,
zero rejects. Ingested 2026-08-18 across 26 rotation slots. Prompts:
`review/reshoot-prompts-2026-08-18.md`. Picks: `review/reshoot-picks-2026-08-18.json`.
