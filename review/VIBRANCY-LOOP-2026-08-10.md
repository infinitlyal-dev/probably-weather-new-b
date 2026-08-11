# Vibrancy loop — five iterations, for Al's pick

> **Verdict pass, 2026-08-10.** Al kept 1–4 as the direction; iteration 5 was
> sent back for fixes before judging. What changed since his ruling:
> the light-dash artifact was traced (it is the rain, not the tape — see below),
> the tape was re-geometried off the app header, the ink sheet was rendered
> (`output/ink/index.html`), the EN voice strings were marked approved in code,
> and the wash got its own contrast gate (`scripts/verify-wash-contrast.mjs`).

Contact sheet: **`output/vibrancy/index.html`** — six strips (baseline + five),
each with Home and Hourly on a storm photograph and a sunny one, 390×844.

Nothing is in `app.css`. Every iteration is a candidate stylesheet in
`review/vibrancy/iter-N.css`, layered cumulatively, so the answer can be "1–3",
"all five", "1, 2 and 5", or "none".

## The five, in one line each

| # | Move | Critique it answers |
|---|---|---|
| 1 | **The room takes the photograph's light** — a blurred, darkened copy of the same hero behind the page, scrimmed off before the data | The print was the only object in the room and the room had nothing to do with the picture |
| 2 | **"Probably" gets the share card's voice** — gold, bigger, tight to the number | The app's own word was a grey label; on the share card it is 112px of gold and it IS the design |
| 3 | **The evidence is printed on the same paper** — cream ink and a cream wash on the stats pill | Fixing the top half made the dashboard alphabet underneath it look worse |
| 4 | **The room follows you** — secondary panels let the same light through | Leave Home and the identity vanishes; Hourly is any weather app's list |
| 5 | **The print becomes an object somebody stuck there** — warm tape across the corner, a contact shadow, a hairline of thickness on the stock | The print was a perfect rectangle with a symmetrical dot: a card doing an impression of a photograph |

Iteration 5 is the only one that **undoes** an earlier decision: it hides M9's
gold pin, because tape and pin are two fasteners doing one job and the dot is
the one a design system picks. Restoring the pin is deleting one line, and
iteration 5 is separable from 1–4.

## Gates

Every stack was run through the full fold matrix, not just the last one:

| Stack | Fold matrix |
|---|---|
| 1 | PASS 72/72 |
| 2 | PASS 72/72 |
| 3 | PASS 72/72 |
| 4 | PASS 72/72 |
| 5 (all five together) | PASS 72/72 |

Suite: 86 files / 21,727 tests green. One run failed a single test while a fold
gate was saturating the CPU in parallel; three subsequent clean runs were green
and I did not capture which test it was — flagging it rather than calling it
nothing.

## Two defects the loop found (both fixed in app.css, both yours to reverse)

1. **The grain never painted on Home.** The warmth pass put the tile on `#bg`,
   which is `position: fixed; z-index: -1` — and CSS paints negative-z stacking
   contexts *before* in-flow block boxes, so body's own opaque background covered
   it. Measured by sampling a pixel: flat page colour with the tile on `#bg`, the
   layer underneath only appeared when body's background was removed. The tile is
   now on `body`, where the page colour actually reaches the glass.
2. **The polaroid foot has been left-aligned since M9 shipped**, though the
   stylesheet says `text-align: center` and the ruling says centred.
   `main#home-screen.main #headline` (two IDs, app.css:1865) out-specifies the
   rule that declares it. Found by asking the browser which rules matched, not by
   reading the file. Restored with a two-id/two-class selector; if you prefer the
   left-aligned foot you have been living with, say so and it comes back out.

## The light dashes — traced, not guessed

You read them as debris from the tape/pin layer. They are not: they are the
**rain particles**, a shipped feature since long before this loop, and the wash
is simply the first background they have ever been visible against.

Measured by rendering each scene twice and diffing the pixels with `#particles`
emptied:

| Scene | Pixels that change when the particles are removed |
|---|---|
| Storm | **684** (28 bars of 2×20px white at 0.75 alpha) |
| Sunny | **0** — `createParticles` only runs for rain/storm/cold/wind, so the beach frame has none at all |

So on the storm frames they are rain, and on the beach frame there is nothing
there to remove — what you saw on the sunny shot was the tape's first version,
which was cold grey and sat off the corner like a sticker. Both are dealt with:
the rain is now thin, tapered and quiet (in iteration 1, where the wash that
exposed it lives), and the tape is warm and on the print.

## The tape and the header — measured

A strip of width *w* rotated by *r* has a bounding box `w·sin r + h·cos r` tall.
At 86px and 40° that is 74px centred two pixels below the card's top edge, so it
reached y≈48 while the app header only ends at y≈79 — it was lying across the
brand at every viewport in the matrix, exactly as you saw. It is now 70px at 30°,
started inside the card: the box tops out within a few pixels of the print's own
edge and never enters the header band.

## The wash's own gate (new)

`scripts/verify-wash-contrast.mjs` renders Hourly with and without the wash on
both photographs, samples the **painted** background inside each surface, and
scores the ink that sits on it. It fails if anything drops below 4.5:1 or loses
more than 0.5:1 to the wash.

| Surface | With wash | Without |
|---|---|---|
| Hourly rows (both scenes, 6 each) | 19.25:1 primary / 8.83:1 secondary | identical to the pixel |
| Chart card caption | 8.91:1 | 8.91:1 |
| Voice line, sunny (worst case) | 9.16:1 | 9.46:1 |

The wash costs 0.30:1 at its worst point, on a line that is at double the
threshold either way. The data rows never see it at all — the scrim is already
at page colour before the table starts.

## Also worth your eye

- The ink sheet is a separate deliverable: `output/ink/index.html`, four markers
  on both photographs, rendered on the kept 1–4 stack, with the contrast of each
  ink on the print stock measured rather than eyeballed — petrol 6.8:1, deep
  pink 6.5:1, pen green 5.9:1, the black control 15.8:1. All four clear the bar
  at caption size; the choice is taste, not legibility.
- Iteration 4 needed the app header hidden behind the panels (`visibility`, no
  reflow). The opaque panel had been covering it all along — that is how "no app
  header on secondary screens" was implemented — so this only makes the existing
  intent explicit.
