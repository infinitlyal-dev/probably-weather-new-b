---
name: pw-image-system
description: >
  Probably Weather background image system specialist. Use this skill when working on
  background image content, file naming conventions, condition-to-image mapping, the
  14-day image cycle, time-slot image selection, Nano Banana Pro generation briefs
  (via Higgsfield MCP or Leonardo), or generating new images for the assets/images/bg/
  folders. Triggers on: background images, image naming, condition folders, image
  cycle, day images, dawn images, dusk images, night images, Nano Banana Pro brief,
  image generation, SA image aesthetic, clear folder, cloudy folder, rain folder,
  weekend images, braai images, image slots, fallback images, cold-clear folder,
  image rotation system, pw-image-staging pipeline. ALWAYS trigger when the user
  mentions background images, image generation briefs, image naming conventions, the
  14-day cycle, or the cold-clear bucket for Probably Weather.
---

# PW Image System: Background Image Specialist

You are the image system specialist for Probably Weather. You own the background image content, file naming conventions, the condition-to-image mapping, and image generation briefs.

## Your Domain

- `assets/images/bg/` folder structure (what files exist in each condition folder)
- The 14-day day/weekend image cycle (which day_N image gets shown on which weekday)
- Dawn, dusk, night image sets (per-condition time-slot variations)
- Image generation briefs for Nano Banana Pro (via Higgsfield MCP, Leonardo, or ChatGPT Pro)
- Post-generation quality control and staging

**Read files fully before editing. Provide complete file replacements, never snippets.**

## Out of scope (do NOT edit)

The **image picker code** in `assets/app.js` (currently `setBackgroundFor()` calling `getWeatherBackgroundFolder()`) is **read-only for this skill**. It is owned by pw-weather-logic. This skill defines what files exist in `assets/images/bg/[condition]/` for the picker to find. New conditions, new rotation behavior, new aliasing, or new fallback logic require a pw-weather-logic change — never a pw-image-system change.

The weather algorithm and condition routing in `api/weather.js` is also out of scope. This skill is downstream of weather decisions: once a condition is resolved, this skill governs what image is shown.

---

## Folder Structure (verified in repo, 2026-05-17)

```
assets/images/bg/
  clear/
  cloudy/
  cold/         ← CT wet-cold (rain/drizzle/cloudy + low temp)
  cold-clear/   ← NEW 2026-05-17: high-veld dry-cold (clear/sun + low temp)
  fog/
  heat/         ← folder name is "heat" not "hot"
  rain/
  storm/
  wind/
  default.jpg   ← global fallback at folder root
```

UV and rain-possible are handled in the picker code as aliases — they don't have their own folders. Do not create those folders.

---

## File Naming Convention (14-Day Cycle)

The picker uses a mod-14 day-of-year rotation. **The day_N slot maps to day-of-week as follows** (verified against `setBackgroundFor` / `getWeatherBackgroundFolder` in app.js):

| Slot | Day type |
|---|---|
| `day_1` – `day_5` | Week 1 weekdays (Mon–Fri) |
| `day_6` | **Week 1 Saturday** |
| `day_7` | **Week 1 Sunday** |
| `day_8` – `day_12` | Week 2 weekdays (Mon–Fri) |
| `day_13` | **Week 2 Saturday** |
| `day_14` | **Week 2 Sunday** |
| `day.jpg` | FALLBACK ONLY, never use as a primary named slot |

**Weekend slots = `day_6`, `day_7`, `day_13`, `day_14`.** Braai content, family lunches, lazy-Sunday animals go here. Weekday slots = `day_1`–`day_5` and `day_8`–`day_12`. School-run, commute, lunch-break, dusk-return content goes here.

### Time-Slot Images (per condition folder)
- `dawn_1.jpg`, `dawn_2.jpg`, `dawn_3.jpg`
- `dusk_1.jpg`, `dusk_2.jpg`, `dusk_3.jpg`
- `night_1.jpg`, `night_2.jpg`, `night_3.jpg`

**Total per condition folder when complete:** 14 day images + 1 day fallback + 3 dawn + 3 dusk + 3 night = **24 images**.

---

## Time Slot Hours

| Slot | Hours |
|---|---|
| dawn | 05:00 – 08:00 |
| day | 08:00 – 17:00 |
| dusk | 17:00 – 20:00 |
| night | 20:00 – 05:00 |

---

## Image Generation Spec (locked 2026-05-17)

When generating new images, use these settings:

- **Model:** Nano Banana Pro
- **Mode:** Custom
- **Size:** **1536 × 2752** (PORTRAIT — never landscape or square)
- **Aspect:** Portrait, fits mobile phone screens
- **Style:** Photorealistic, warm, South African
- **Output:** JPG, optimised for web (target 200–500 KB per image; resize if over 1 MB)

### Generation lanes

**Lane A — Higgsfield MCP (primary, 2026-05-17 onward):** Direct from Claude.ai or Claude Code via the Higgsfield MCP `generate_image` tool. Use `model: nano_banana_2`, `aspect_ratio: 2:3`. Set "Always allow" on the approval gate for batch work. Uses Higgsfield credits (~4 per image).

**Lane B — Leonardo (burn-down before subscription cancellation):** Same model. 140 tokens per 1k/2k image, 250 per 4K. No Relaxed mode for third-party models. Use Minnie autonomous-overnight for batches.

**Lane C — ChatGPT Pro (character continuity):** ChatGPT Images 2.0 in Thinking mode, 8 coherent images per prompt with native character consistency. Use when one consistent SA family/character across 8 variations is wanted.

**Lane D — OpenArt (burn-down before account closure):** Minnie recon required first to build platform-class memory. Then autonomous overnight.

### Universal Negative Prompt (use for ALL generations)

```
text, watermark, logo, words, letters, numbers, signs, banners, speech bubbles,
extra limbs, deformed hands, deformed fingers, floating objects, ugly, blurry,
low quality, stock photo aesthetic, generic western suburban USA aesthetic,
horror, dystopian, gritty, dirty, poverty, graffiti, litter, overexposed,
underexposed, cartoon, illustration, painting, drawing, artificial lighting indoors
```

### Diversity Instructions (use for ALL prompts featuring people)

```
Include diverse South African characters — mixed race group reflecting the real
diversity of South Africa. Show Black, Coloured, White, and Indian South Africans
naturally together. No stereotyping. Natural body language and authentic SA
clothing/style.
```

Mixed-race groups in scenes are the canonical default for PW — this is not "force diversity in every frame," it's "do not let the model default to one race only." Families, friend groups, colleagues, public scenes all use this guidance.

---

## SA Image Aesthetic Rules

- Beautiful, warm, relatable South African scenes
- **Nationally representative** — Joburg, Pretoria, Durban, Cape Town suburbs, Bloemfontein, Limpopo, Garden Route, KZN, Free State, Mpumalanga, Eastern Cape, Karoo
- Cape Dutch architecture, Helderberg/Boland mountains, suburban gardens, jacarandas, bougainvillea, fynbos
- Modern SA suburban as the default architectural spine — face-brick or rendered double-storey homes, aluminum-frame windows, paved patios, modern garden furniture, built-in braais
- Diverse, authentic SA people — mixed race, real SA body language, modest middle-income texture
- No American suburban aesthetic (white picket fences, yellow school buses, mailboxes at the curb)
- No generic stock-photo feel
- **Positive vibes only — no poverty, grit, or dystopian aesthetic**
- **Braai scenes ONLY for Saturday slots** (`day_6`, `day_13`). Sunday slots (`day_7`, `day_14`) get family-lunch / lazy-Sunday / cute-animal content.
- No text, signs, or readable words in any generated image

### Prompt discipline (locked 2026-05-17)

**Moment, not tableau.** Every prompt must specify what is HAPPENING, not just the setting.

- Tableau (fails): "Mom blows on mug, son stands there"
- Moment (lands): "Mom reaches to button son's school-blazer collar as he checks the gate"

Bucket signals (frost, breath, jacket, fynbos, jacaranda) become wallpaper without a moment.

### Banned content (in addition to the universal negative prompt)

- Cape Town landmarks (Table Mountain, Lion's Head, V&A Waterfront, Bo-Kaap, stadium) — too place-specific
- Recognizable real people
- Licensed sports kits (Springbok jerseys, Bafana kits, Stormers/Sharks/Bulls jerseys, Premier League shirts) — copyright
- Copyrighted IP (Disney, Marvel, branded characters, brand logos)
- Christian / religious iconography (Manna's lane, not PW)
- Township scenes as a stereotyped default
- Loadshedding as a constant signature — SA loadshedding has been largely resolved for over a year. Battery lanterns/candle-lit kitchens are not a default; only use if specifically relevant.
- News, current events, political content, election imagery
- Specific TV shows, films, streaming services (licensed + dates the imagery)
- Dated cultural references that will go stale quickly

---

## Conditions Reference

### clear (warm, sunny)
**Mood:** Warm and easy. Postcard SA. Saturday-after-rugby. Jacaranda streets. Beach days. Pool days. Braai weather on Saturday slots.

### cloudy
**Mood:** Soft, ambiguous. "The weather doesn't know what to do." Bring-a-jersey-just-in-case. Half-blue half-grey skies. Indecisive SA midday.

### cold (CT wet-cold)
**Routing trigger** (owned by pw-weather-logic): `dailyHighC < 15` AND condition in {rain, drizzle, cloudy, fog}.
**Mood:** Wrapped-up, indoor-leaning, drizzle-grey. CT winter. Soup, blankets, takeaways. "Stormers weather."

### cold-clear (NEW 2026-05-17 — high-veld dry-cold)
**Routing trigger** (owned by pw-weather-logic): `dailyHighC < 15` AND condition in {clear, sun, partly_cloudy}.
**Mood:** Crisp, awake, sharp. Sun + cold air at the same time. *"Koud maar lekker."* Joburg/Pretoria/Bloemfontein winter morning prototype.
**Signals (must appear):** Visible breath OR breath implied (mug steam); frost on grass/lawn/windscreens; bare winter trees (jacaranda); dry brown highveld grass — never wet green; clear blue or navy sky; modern suburban architecture.
**Wardrobe:** Thick puffer jackets, woolly jumpers, beanies, scarves, gloves, sunglasses paired with winter wear (the cold-clear signature), closed shoes, layered.
**Locked 4 anchor images (2026-05-17):**
- `cold-clear/dawn_1.jpg` candidate — Black SA mother buttoning son's school blazer at back gate, both breath visible (Higgsfield job `cb44f773`)
- `cold-clear/day_1.jpg` candidate (weekday) — Boerbull on sunlit modern suburban patio, breath visible, ear cocked (Higgsfield job `7e4aa8eb`)
- `cold-clear/dusk_1.jpg` candidate — Frosted aviator sunglasses + skinned coffee + paperback on modern outdoor table (Higgsfield job `58436ea4`)
- `cold-clear/night_1.jpg` candidate — Grey cat approaching battery LED lantern on modern patio (Higgsfield job `5a1cffaa`)

These 4 are anchors pending pw-image-staging pipeline build for proper review + sequential naming + promotion.

### fog
**Mood:** Hushed, secretive. Garden Route winter mornings. KZN South Coast morning mist. Drakensberg dawn cloud. Quiet not threatening.

### heat
**Mood:** Heavy, slow, sweaty, finding-shade. SA summer slog. Pool, beach, shade, ice, fan. Highveld Jan/Feb 35°C+. KZN summer humidity.

### rain
**Mood:** Steady, wet, productive-indoor. Not stormy, just rainy. *"Lekker for sleeping in."* Wet dog, wet shoes, kids in puddles in wellies.

### storm
**Mood:** Dramatic but contained. Highveld 4pm summer thunderstorm. Lightning, hail dread, washing being pulled off the line. *"Pak die kar onder die boom in."*

### wind
**Mood:** Cape Doctor or berg wind. Patio umbrella inside-out. Hair blowing. Trampoline disaster waiting to happen.

---

## Clear Folder Image Slots (Reference)

Target subjects for the clear condition folder. Day-type column corrects the v1.0/v2.0 mapping to match what the picker code actually does. Other condition folders should follow similar variety across the 14-day cycle (per-folder slot maps are v2.2 work — draft them while batching that folder, not speculatively).

| Slot | Day type | Subject |
|---|---|---|
| `day_1` | weekday | Empty Cape Dutch pool, suburban garden, fynbos, bright blue sky |
| `day_4` | weekday | Pristine empty SA beach, white sand, turquoise water, flip flops in sand |
| `day_6` | **Saturday W1** | Perfectly prepared braai area, fire starting, cold drinks, nobody in shot |
| `day_7` | **Sunday W1** | SA grandmother and grandchild on sunny stoep, cold drinks, big smiles |
| `day_9` | weekday | Two SA colleagues having lunch outside modern Joburg office park, laughing |
| `day_10` | weekday | Looking up through indigenous tree leaves toward perfect blue SA sky |
| `day_11` | weekday | Jacaranda-lined suburban street, full purple bloom, bright blue sky |
| `day_13` | **Saturday W2** | Two women confidently manning braai, two men confused over salad, mixed race |
| `day_14` | **Sunday W2** | Mixed SA family Sunday lunch around modern outdoor table, multi-generation |
| `dawn_2` | — | Hadeda silhouette against deep pink/orange SA dawn sky |
| `dawn_3` | — | Lone surfer walking toward ocean at first light, board under arm |
| `dusk_2` | — | Two birds on telephone wire silhouetted against vivid orange/pink sunset |
| `dusk_3` | — | Mixed SA friends on stoep with cold drinks, golden hour light |
| `night_2` | — | Large moth on warm lit outdoor wall next to yellow outdoor light |
| `night_3` | — | SA friends around well-lit outdoor table, fairy lights overhead, summer night |

Subjects mix people scenes, animal scenes (hadeda, dog, cat, moth), and object/element scenes (flip flops, sunset, beach) naturally across the 14-day cycle. No forced quota — variety comes from genuinely different subjects across the cycle.

---

## Image Quality Checklist (Post-Generation)

Before committing any new image to the repo (or promoting from pw-image-staging), verify:

1. **No text/signs/words** visible anywhere in the image
2. **No deformed hands/faces** — AI generation artifact check
3. **Correct orientation** — must be portrait (taller than wide, ~1536×2752)
4. **File size** — should be under 500 KB for web performance. If over 1 MB, resize or convert to WebP.
5. **SA authenticity** — does it look like South Africa, not California or Europe?
6. **Mood match** — does the image match the condition folder's mood?
7. **Diversity** — if people are shown, is the group diverse?
8. **No floating objects** — common AI artifact, especially with outdoor scenes
9. **No licensed content** — no Springbok jerseys, no team kits, no brand logos, no recognizable real people, no copyrighted characters
10. **No banned mood** — no poverty, grit, dystopian, political, religious

---

## pw-image-staging pipeline (planned, locked design 2026-05-17)

Generated images do NOT go directly into the PW repo. They land in a staging area outside the repo, get Al's approval, then promote into the repo on a feature branch.

**Location:** `C:\Users\27741\OneDrive\Desktop\Probably weather new\pw-image-staging\` (sibling to PW repo on OneDrive)

**Structure:**
```
pw-image-staging/
├── inbox/[condition]/[time]/         ← downloads land here, named by job ID
├── reviewed/[condition]/[time]/      ← Al-approved images, sequential filename
├── batches/                          ← batch manifest JSON files
└── tools/
    ├── download_batch.py             ← Lane A/B/C downloader
    ├── review.py                     ← Local CLI reviewer (a/r/s/u/q)
    └── promote.py                    ← Copy reviewed → PW repo on feature branch
```

**Flow:**
1. Generation lane produces image with a job ID.
2. `download_batch.py` reads batch manifest, downloads to `inbox/[condition]/[time]/` with metadata sidecar.
3. Al runs `review.py` — walks the inbox, opens each image, accepts `a` (approve) / `r` (reject) / `s` (skip) / `u` (undo) / `q` (quit). Approved files move to `reviewed/[condition]/[time]/` with sequential filename.
4. When a bucket has enough approved images, Al runs `promote.py`. It copies files into the PW repo at `assets/images/bg/[condition]/[time]/`, commits to a feature branch. Al pushes manually.

**The PW production repo stays untouched until Al explicitly promotes.**

The pipeline itself is not yet built.

---

## Image rotation system (planned, Phase 2)

The 14-day cycle is the current shipping system. Phase 2 design (locked 2026-05-17) is a larger pool per condition with a Sunday-midnight Vercel cron rotating 7 active per week.

**Files (Phase 2):**
- `assets/images/manifest.json` — source of truth, every image per bucket + week pointer
- `assets/images/active.json` — runtime, this week's active 7 per bucket

Frontend reads `active.json`. Existing SW propagation handles instant rollout.

**Implementation deferred** until pools are full enough to launch rotation cleanly. Until then, the existing 14-day cycle stays. Picker-side changes for rotation are pw-weather-logic's territory.

---

## Critical Rules

1. **ALL new images must be portrait** — 1536×2752 from Nano Banana Pro, never landscape or square
2. **This skill never edits the image picker code.** `setBackgroundFor()` and `getWeatherBackgroundFolder()` in `assets/app.js` are owned by pw-weather-logic. New conditions, new rotation, new aliasing all require a pw-weather-logic change.
3. **Never generate images with text**, signs, or readable words
4. **Never use American or European visual references** — SA aesthetic only
5. **Braai imagery = Saturday slots only** (`day_6`, `day_13`). Sunday slots (`day_7`, `day_14`) get family-lunch / lazy-Sunday content.
6. **`day.jpg` is fallback only** — never use as a primary named slot
7. **Always include diversity instructions** in prompts featuring people
8. **Check file sizes** — images over 1 MB will slow the app, especially on mobile data
9. **Nationally representative** — spread SA regional references across all folders, not just Western Cape
10. **No licensed content** — no Springbok/Bafana/team kits, no brand logos, no recognizable real people, no IP characters
11. **Every prompt is a moment, not a tableau** — specify what is happening, not just the setting
12. **No loadshedding as a default** — SA loadshedding has been largely resolved; only include if specifically relevant
13. **This skill never touches the weather algorithm** — image system is downstream of weather decisions

---

## Versioning

- **v1.0** (2026-03 to 2026-05-17) — Original canonical skill. Square 1024×1024. 7 conditions (no cold-clear, no fog listed). Leonardo only. Stale function name reference and incorrect day-of-week → day_N mapping.
- **v2.0** (2026-05-17, this morning) — Portrait 1536×2752. Added cold-clear condition with 4 locked anchor jobs. Added Higgsfield MCP / ChatGPT Pro / Minnie generation lanes. Added moment-not-tableau prompt rule. Added pw-image-staging pipeline reference. Added image rotation system (Phase 2). Documented banned content. Folder list aligned to actual repo state (heat not hot, fog added, cold-clear new).
- **v2.1** (2026-05-17, evening) — Three surgical ship-blocker fixes from Claude Code self-eval: (a) removed stale `getBackgroundImage()` function reference, scope statement now names real `setBackgroundFor()` / `getWeatherBackgroundFolder()` and disavows edits to picker code; (b) corrected day-of-week → day_N mapping to match what the picker actually does (Sat = day_6 or day_13, Sun = day_7 or day_14, weekdays = the rest); (c) updated Critical Rule #1 / #2 wording for picker-code scope and removed the obsolete "don't update 14-day cycle yet" rule (the 14-day cycle is shipping). Clear folder slot table re-mapped to correct weekday/weekend positions. Slot subject maps for the other 8 condition folders parked as v2.2 work — drafted while batching each folder, not speculatively.
