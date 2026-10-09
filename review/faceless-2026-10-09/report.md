# The three photographs that still failed the face rule — 9 Oct 2026 (Vonk)

Al's scenes (9 Oct), written so no face sits in the top of the frame; each keeps its lines, slots and bucket. Codex
gpt-5.6-sol, one at a time (`scripts/regen-library-photo.mjs --dir faceless-2026-10-09 --no-head`), the house tail,
camera-terms framing in `--note`. Scenes as sent: `scenes.json` (the pool's is round 2's).

| photograph | round 1 | round 2 | in place |
|---|---|---|---|
| storm/week_1/day/5 `20f3d07d3c47` → `02ce45e97097` (dog under the table) | pass | — | 2 slots |
| heat/week_1/night/6 `87546db18e01` → `4154d8900355` (pool party) | FAIL: people at the braai behind, heads under the number | pass: two people cut off at the chest, no one else | 4 slots |
| rain/week_1/day/2 `fbaca052756a` → `0e5b05676c08` (blanket fort) | pass | — | 2 slots |

Face check: `node scripts/anchor-faces.mjs --reframes --dir faceless-2026-10-09` (414x715, each photograph's longest
English line, at its existing anchor — 69 / 68 / 33 — which goes with it). Phone sheet: `phone/faceless-2026-10-09.jpg`.

Changes to Al's words, all to fit the slot the photograph keeps:
- Storm dog and blanket fort sit in DAY slots; Al's scenes said night. Written as "a Highveld afternoon thunderstorm,
  the sky outside dark as night" and "a cold, rainy day indoors, curtains half drawn and the lounge dim, rain streaking
  the window" (the fort is a rain photograph; its line is "Rain all day, and the lounge has become a cushion fort.").
- The house head-band sentence ("head between 40 % and 62 %") left out (`--no-head`): it contradicts a scene with no faces.
- The folder's weather sentence replaced (`--weather`) where it fought the scene: the hot NIGHT is not "hard bright sun",
  the storm's "people sheltering" fought "no people".
- The dry-ground sentence: in the pool prompt; left out of storm and rain by the script's rule (wet by nature) — both
  scenes are indoors.

Codex usage per image (its own count): storm 87,299 in (68,224 cached) / 475 out, 82 s; pool r1 87,042 (67,968) / 572,
54 s; pool r2 87,625 (68,352) / 608, 78 s; fort 87,327 (68,224) / 482, 57 s.
