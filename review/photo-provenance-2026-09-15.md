# Photo provenance — set-001 (2026-09-15)

The 294 curated photographs in review/set-001-draft.json, traced to where they came from. Read-only: nothing was removed, moved or re-encoded. Per-photograph detail: review/photo-provenance-2026-09-15.json.

## How

- **Byte chain.** Every repo WebP matches the draft's sha1-12 (294/294). 178 are byte-identical to a WebP in pw-image-staging/compressed/, which tools/compress_to_webp.cjs made from PWIMAGES_BATCHES/<condition>/<week>/<slot>/ in alphabetical order; the batch file name carries the staging tag (tools/_gather_pwimagesweekly.ps1): LIVE (was live as a JPG), NEW (reviewed/), FRESH (inbox/). Every mapped pair was re-checked perceptually (dHash distance ≤ 10: all 178).
- **Replacements.** 14 match review/replacements/ perceptually (dHash ≤ 12).
- **The other 102.** The commit that first put those exact bytes in the repo (git log --find-object), plus a crop-tolerant perceptual match (9:16 cover crops, three positions) against 1,008 compressed WebPs, 29 replacements and 72 reroll candidates.
- **Metadata.** C2PA/JUMBF and generator strings read from each original's first 256 KB; EXIF and XMP read from the metadata blocks (sharp). The shipped WebPs carry no metadata at all (VP8 only), so any provenance lives in the originals.
- **People and brands.** All 294 on 13 contact sheets (6×4, 260×462 px), then 19 suspects cropped at full resolution.

## By category

| Category | Photographs |
|---|---|
| AI — batch record names the generator | 117 |
| AI — made by us, generator not recorded | 107 |
| AI — per-image record | 70 |
| Licensed stock | 0 |

No photograph shows stock evidence: no EXIF block in any original that could be read (0 of 217), no camera maker, no stock-agency or rights string in XMP, no licence record. Four earlier "camera" hits (SONY, DJI) were three- and four-letter byte patterns inside image data; none of those files has an EXIF block.

## By generator evidence

| Evidence | Photographs |
|---|---|
| OpenAI GPT Image — C2PA manifest naming OpenAI in the original PNG | 68 |
| Leonardo or GPT Image 2 — meme batch 2, commit 4791826 (2026-07-17); review/tools/build-meme-batch-2-prompts.mjs built "Leonardo/GPT-Image-2 prompts" | 57 |
| reviewed stage of the staging pipeline (Higgsfield / Leonardo jobs per its README); no per-image job record | 57 |
| Leonardo AI — commit 2008e23 (2026-02-03) "Add 48 Leonardo AI background images" | 26 |
| live JPG added by c24e4c4 ("feat: complete 14-day image set for all 8 condition folders") — no generator named | 22 |
| GPT Image 2 — commit 8617c37 (2026-08-18) "Two candidates per cut slot on GPT Image 2" | 15 |
| Al generated it (scripts/ingest-replacements.mjs; commit cf5f254); no generator named, no C2PA in the PNG | 14 |
| Leonardo AI — commit 0ab0268 (2026-03-12) "New Leonardo AI generated backgrounds" | 14 |
| live JPG with no add in git history under that name | 9 |
| Leonardo AI (Nano Banana 2 / gemini-image-2) — commit 76edf51 (2026-03-10) | 5 |
| reroll candidate (review/reroll-candidates); the sheet's "Leonardo" mentions are the Sandton tower, not a generator | 5 |
| Higgsfield job — staging sidecar | 2 |

## Flags

### Recognisable brands (nothing removed; for Al to rule)

| Slot | Hash | What is visible |
|---|---|---|
| clear/week_1/day/4.webp | f673af851f9c | brand: Nike swoosh on a football boot |
| clear/week_2/day/2.webp | 9ab8b9f07431 | brand: ABSA logo on the tower top (Johannesburg skyline) |
| cold/week_1/day/3.webp | 084405b1c79a | brand: Volkswagen badge on the grille (Polo) |
| cold/week_2/day/3.webp | a37a31d9aa79 | brand: GOLDAIR name on the heater |
| cold-clear/week_1/day/3.webp | 042ba0a95388 | brand: "…LUX" (Hilux) model lettering on the tailgate |
| heat/week_1/dawn/2.webp | 0828ca00553f | brand (possible): product lettering on the inflatable pool ("…Pool") |
| rain/week_2/day/3.webp | 3bd49d0acf2b | brand; setting: Subaru badge; number plate and streetscape read Australian rather than South African |
| rain/week_1/night/4.webp | c8df884e9ec0 | brand: Toyota logo on the steering wheel |
| rain/week_1/night/7.webp | d28204abf829 | brand: "DELUXE COFFEE" and "THE GIN BAR" neon signs — names of real Cape Town businesses — and "CAPE TOWN BOOKS" |
| storm/week_1/dawn/6.webp | 56af96f529d2 | brand: Nike swoosh on the T-shirt |
| storm/week_1/day/2.webp | 41e6c19016c1 | brand (possible): shopfront lettering, partly visible ("Sho…") |
| storm/week_1/day/4.webp | b08495c9d832 | brand: SPAR and other sponsor boards around the cricket field |

Low, not flagged: a Toyota Fortuner identifiable by its shape with no badge in frame (4210c1f4), bakkies and sedans with no badge visible.

### Recognisable real people

None seen. Every person on the 13 sheets reads as generated; no face resembled a public figure at contact-sheet or crop resolution. This is a visual review, not face matching.

### Generator not recorded

107 photographs came through the project's own pipeline or wiring commits, but no record names the tool that made that particular image. Flagged here as weaker provenance, not as unknown — each has a route into the project's own generation work, and none shows stock or camera evidence:

- 57 from the staging pipeline's reviewed stage (its README names Higgsfield and Leonardo jobs; only 2 reviewed images kept a job sidecar, and those two are counted under per-image records)
- 22 live JPGs added by c24e4c4 "feat: complete 14-day image set for all 8 condition folders", which names no generator
- 14 replacements Al generated after the 2026-08-14 crop rulings (scripts/ingest-replacements.mjs, commit cf5f254); the PNGs carry no C2PA
- 9 live JPGs whose file name has no add in git history
- 5 reroll wave 1 images (f4fe8b7), matched to review/reroll-candidates; that contact sheet's "Leonardo" mentions are the Sandton tower, not a generator

## Limits

- C2PA survives only in originals that were never re-saved; the JPG stages and the WebP library have none, so absence of C2PA is not evidence either way.
- Perceptual matching can miss heavy crops or edits; the 57 meme-batch-2 and 15 cut-replacement photographs are attributed through the commits that wired them, not through a matched original.
- Brand review is visual at crop resolution; small print on clothing or cars can still be missed.
