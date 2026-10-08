# Landmark creep in the 77 library reframes (Al, 8 Oct 2026)

Each of the 77 reframes was put beside the photograph it replaced (contact sheets, 6 pairs each). **16** show a recognisable
landmark the original did not have: Table Mountain in 14 (from a garden, a street, a lobby, across the bay), Lion's Head in 2.
Six more gained only an unnamed mountain range and were left alone (042ba0a95388, 36ffe52cf7ec, 4e7c3b6e7580,
5a6dd26eb7db, 7d459440d824, d86d4f5699c2). Originals that already had a mountain (Sea Point, Camps Bay, the Boland vineyards …)
were not counted.

The 16, regenerated once each on Codex gpt-5.6-sol with the round-3 camera-terms framing plus Al's sentence ("No recognisable
landmark or mountain skyline; an ordinary suburban horizon." — the full note is `note.txt`); the scene, lines and face
anchors are as they were. All 16 takes are landmark-free.

1108cfd1192f 15e8f0aa4baa 1c5f757ee79a 2c5a9b3813f4 32dec9fbdcaa 3bb43b4437ad 5542dfc7215d 6bb604217e96 775f4f1b47b4
8fd1944f303b a373f1d83e2f c0246be3744d ca6d821f7c9b d878b96a3f71 decff597fe6c e8500f5dfaee

- Phone sheet: `phone/landmark-replacements.jpg` (414x715, each with its live line and anchor).
- Worth Al's eye: wind/week_1/night/1 (6bb604217e96) is dark and the woman at the gate is small; the camera-terms framing
  makes people smaller in all 16.
- Codex usage per image (its own count, from `log.md`): 57,750–86,429 tokens in (39,552–79,616 of them cached),
  462–551 out; 46–79 s each.
- Nothing in `assets/` changed. On Al's go: `node scripts/ingest-library-reframes.mjs` from these takes, the face check,
  the suite and the build.
