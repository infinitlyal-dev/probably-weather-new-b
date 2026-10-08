# New sets — quality loop, 8 Oct 2026 (Vonk)

All 69 photographs of the 7 Oct brief (`review/image-brief-2026-10-07.md`), judged by eye against one fixed list, the
fails regenerated through Codex, three rounds at most. **Result: 68 pass, 1 still fails** (breezy/dusk-5, faces).
Phone renders with the lines: `review/new-sets-phone-2026-10-08/{partly-cloudy,breezy,cloudy}.jpg`.

## The list (every photograph, every round)

1. **Dry** — no puddles, wet sheen or reflections, unless the scene is wet by nature (shoreline, hose, sprinklers, pool, a car being washed, the furrow in Prince Albert).
2. **Not a render** — no plastic skin, CGI sheen or glamour-shoot look.
3. **No readable text, logos or plates.** (South African flags appear in several breezy frames; a flag is not text.)
4. **Nothing blown over or broken.**
5. **No white plastic chairs.**
6. **Time of day** matches the slot.
7. **Sky matches the set** — partly cloudy: real cumulus and blue; breezy: wind in light things only, clear or partly cloudy; cloudy: a flat grey lid, no sunset colour, no storm.
8. **Faces reachable into the safe band** — `scripts/anchor-faces.mjs` on Al's phone (414x715): no face under the number, "Probably …", the buttons or the joke at any anchor (see `review/crop-audit-2026-10-08.md`).
9. **Subject in the middle and upper two-thirds**; the lower third quiet.

## How the fails were made again

`node scripts/regen-new-set-photo.mjs <file> --round N [--note …]` — Codex `gpt-6-astra` (ChatGPT login) driving its
built-in image tool; the tool does not say which GPT Image version ran. One generation per fail per round. Prompt: the
brief's heading and scene, the time slot, the set's sky rule, the brief's verbatim tail, then Al's two sentences last
("The ground is completely dry …" and "The main subject's head sits between 40% and 62% of the frame height."). Rounds
2–3 for face fails added: "Every person's face sits between 40% and 55% of the frame height …" (round 3: 42–52 %).
Each replaced photograph is kept beside it as `<name>.before-qc-r<N>.png`, each raw take as `<name>.qc-r<N>-original.png`;
`log.md` has one line per take.

Two things went wrong on the way and were caught:
- **Round 1, three runs in parallel handed one image to three files** (breezy dusk-7, night-1, night-2 — all the night-2
  washing-line scene). The script now takes the image from its own Codex thread only and runs one at a time; dusk-7 and
  night-1 were made again; night-2 kept the take, which is its own scene.
- **The breezy set rule, handed over whole, made Astra put every cue in every frame** (a flag, a kite and a wind-pump on a
  Pretoria stoep). From round 2 breezy gets the rule's limits only and "add no flags, kites or wind-pumps the scene does not name".

## Verdicts

| photograph | first look (Anon's file; * = Anon's dry-ground re-run) | r1 | r2 | r3 | final |
|---|---|---|---|---|---|
| partly-cloudy/dawn-1 | pass (low sun on dry tarmac) | | | | **pass** |
| partly-cloudy/dawn-2* | pass (wet sand at the shoreline only) | | | | **pass** |
| partly-cloudy/dawn-3 | pass | | | | **pass** |
| partly-cloudy/dawn-4 | pass | | | | **pass** |
| partly-cloudy/dawn-5 | pass | | | | **pass** |
| partly-cloudy/dawn-6 | pass | | | | **pass** |
| partly-cloudy/dawn-7 | pass | | | | **pass** |
| partly-cloudy/day-1 | FAIL 1: wet, shining pavement | pass | | | **pass** |
| partly-cloudy/day-2 | FAIL 8: a head under the joke | — | pass (the joke rises at anchor 81) | | **pass** |
| partly-cloudy/day-3 | FAIL 9: the children in the lower third | pass | | | **pass** |
| partly-cloudy/day-4 | FAIL 9: the dog — the line's subject — at 70 %, under the joke | pass | | | **pass** |
| partly-cloudy/day-5 | pass | | | | **pass** |
| partly-cloudy/day-6 | pass (splash marks beside the pool only) | | | | **pass** |
| partly-cloudy/day-7 | pass | | | | **pass** |
| partly-cloudy/dusk-1* | FAIL 8: the man on the bench under the joke | — | FAIL 8 | pass | **pass** |
| partly-cloudy/dusk-2 | pass (the hose is the scene) | | | | **pass** |
| partly-cloudy/dusk-3 | pass (wet rocks and sand: the shore) | | | | **pass** |
| partly-cloudy/dusk-4 | FAIL 8: the worker's head under the joke | — | pass | | **pass** |
| partly-cloudy/dusk-5 | FAIL 8: a face under "Probably …" | — | pass | | **pass** |
| partly-cloudy/dusk-6 | pass (beach) | | | | **pass** |
| partly-cloudy/dusk-7 | FAIL 1: puddles on the farm road | pass | | | **pass** |
| partly-cloudy/night-1* | pass | | | | **pass** |
| partly-cloudy/night-2* | pass | | | | **pass** |
| partly-cloudy/night-3* | pass | | | | **pass** |
| partly-cloudy/night-4 | FAIL 8: both faces under "Probably …" | — | pass | | **pass** |
| partly-cloudy/night-5 | FAIL 1 + aspirational: wet street, peeling walls | pass | | | **pass** |
| partly-cloudy/night-6 | FAIL 1: wet, reflective paving | FAIL 8 (faces under the joke) | pass | | **pass** |
| partly-cloudy/night-7 | pass | | | | **pass** |
| breezy/dawn-1 | pass (Muizenberg beach: wet sand is the scene) | | | | **pass** |
| breezy/dawn-2 | FAIL 8: face under "Probably …" | — | pass (anchor 6) | | **pass** |
| breezy/dawn-3 | pass | | | | **pass** |
| breezy/dawn-4 | FAIL 1: wet promenade shining in the sun | pass | | | **pass** |
| breezy/dawn-5 | pass | | | | **pass** |
| breezy/dawn-6 | pass | | | | **pass** |
| breezy/dawn-7 | pass | | | | **pass** |
| breezy/day-1 | FAIL 1 + 9: wet paving, the children low | FAIL 8 (faces under "Probably …") | pass (anchor 26) | | **pass** |
| breezy/day-2 | FAIL 1: a puddle on the paving | FAIL 8 | pass | | **pass** |
| breezy/day-3 | FAIL 9: the family in the lower third | pass | | | **pass** |
| breezy/day-4 | pass | | | | **pass** |
| breezy/day-5 | pass | | | | **pass** |
| breezy/day-6 | pass (pool-side splashes only) | | | | **pass** |
| breezy/day-7 | pass | | | | **pass** |
| breezy/dusk-1 | FAIL 1: the deck boards wet and glossy | pass | | | **pass** |
| breezy/dusk-2 | FAIL aspirational + 9: crumbling walls, the children at the joke line | pass | | | **pass** |
| breezy/dusk-3 | pass | | | | **pass** |
| breezy/dusk-4 | FAIL 1: wet stoep tiles, a puddle on the pavement | FAIL: flag, kite and wind-pump on a Pretoria stoep; dog in the lower third | pass | | **pass** |
| breezy/dusk-5 | FAIL 8: face under "Probably …" | — | FAIL 8 | FAIL 8 + glamour look | **FAIL — faces under "Probably …" after three rounds; the round-2 take is kept** |
| breezy/dusk-6 | pass | | | | **pass** |
| breezy/dusk-7 | FAIL 1: wet, reflective quay | pass (second try; the first was the crossed image) | | | **pass** |
| breezy/night-1 | FAIL 1: the pavers glisten (borderline) | pass | | | **pass** — see the line note below |
| breezy/night-2 | FAIL 1: wet yard, a puddle | pass | | | **pass** |
| breezy/night-3* | pass | | | | **pass** |
| breezy/night-4 | pass (wet earth at the reservoir only) | | | | **pass** |
| breezy/night-5* | pass | | | | **pass** |
| breezy/night-6 | FAIL 9: the party in the lower third, faces under the joke | pass | | | **pass** |
| breezy/night-7 | pass | | | | **pass** |
| cloudy/dawn-1* | FAIL 8: face under "Probably …" | — | pass (anchor 67) | | **pass** |
| cloudy/dawn-3 | pass (beach) | | | | **pass** |
| cloudy/dawn-4* | pass | | | | **pass** |
| cloudy/dawn-5* | pass | | | | **pass** |
| cloudy/day-1* | pass | | | | **pass** |
| cloudy/day-2 | FAIL 8: face under "Probably …" (the wet drive is the car wash) | — | pass | | **pass** |
| cloudy/day-3-weekB* | pass (water in the trough only) | | | | **pass** |
| cloudy/day-4 | FAIL 1 + 7: wet stand, drizzle mood | pass | | | **pass** |
| cloudy/day-5* | pass | | | | **pass** |
| cloudy/dusk-1* | pass | | | | **pass** |
| cloudy/dusk-3* | FAIL 7: an orange band on the horizon | pass | | | **pass** |
| cloudy/dusk-4* | pass | | | | **pass** |
| cloudy/dusk-7 | FAIL 1 + 7: wet kraal, sunset colour | pass | | | **pass** |

Regenerated: round 1 — 20, round 2 — 13, round 3 — 2 (29 photographs in all). 40 are Anon's as delivered (13 of them his
dry-ground re-runs), 29 are new takes.

## Still failing, and one line note

- **breezy/dusk-5** — both faces sit under "Probably …" on Al's phone in all three takes (Astra keeps framing the woman
  at the top of the frame). Options: cut it, or keep it and accept the number over her face. My pick: cut, and give the
  slot one more brief with the woman sitting.
- **breezy/night-1** (line kept, as ruled): Maat's line says the security light "keeps switching on for nobody"; the new
  take has a dog sitting under it. The line still reads, but the picture argues with it. Not rewritten.

## What I could not verify

- The GPT Image version behind Codex's image tool (it is not reported).
- Text and logos were checked at contact-sheet size (~600 px wide), not pixel by pixel; nothing readable was seen.
- "Not a render" is my eye; two takes lean polished (breezy/dusk-4 r2 close-up, partly-cloudy/day-2 r2 scorer). Both pass, both worth a look.
