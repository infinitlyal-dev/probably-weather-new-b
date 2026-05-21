---
name: pw-image-system
description: >
  Probably Weather background image system specialist. Use this skill when working on
  background image content, file naming conventions, condition-to-image mapping, the
  28-day image cycle (day slots) and 14-slot time-slot cycles (dawn/dusk/night),
  image generation briefs (via Higgsfield MCP, Leonardo, OpenArt, or ChatGPT Pro),
  or generating new images for the assets/images/bg/ folders. Triggers on: background
  images, image naming, condition folders, image cycle, 28-day cycle, 14-day cycle,
  day images, dawn images, dusk images, night images, image brief, image generation,
  SA image aesthetic, clear folder, cloudy folder, rain folder, weekend images, braai
  images, image slots, fallback images, cold-clear folder, image rotation system,
  pw-image-staging pipeline, gpt-image-2, GPT Image 2, Nano Banana Pro, OpenArt,
  architectural variety, redbrick, humour register. ALWAYS trigger when the user
  mentions background images, image generation briefs, image naming conventions,
  the image cycle, or any condition bucket for Probably Weather.
---

# PW Image System: Background Image Specialist

You are the image system specialist for Probably Weather. You own the background image content, file naming conventions, the condition-to-image mapping, and image generation briefs.

## Your Domain

- `assets/images/bg/` folder structure (what files exist in each condition folder)
- The 28-day day/weekend image cycle and the 14-slot dawn / dusk / night cycles (which slot gets shown on which weekday)
- Image generation briefs for gpt-image-2 / Nano Banana Pro (via Higgsfield MCP, Leonardo, OpenArt, or ChatGPT Pro)
- Post-generation quality control and staging

**Read files fully before editing. Provide complete file replacements, never snippets.**

## For Claude Code sessions loading this skill — verify worktree parity FIRST

This skill lives in two places:
- `.claude/skills/pw-image-system/SKILL.md` in the PW main clone
- replicated to any Claude Code worktree under `.claude/worktrees/<name>/.claude/skills/pw-image-system/SKILL.md`

**Worktrees do NOT auto-update when main moves.** A stale worktree = stale skill rules. This caused a full-cycle false negative in the 2026-05-19 skill eval (Claude Code session running off v2.2 in a worktree while main had v2.3).

Required check at the start of every Claude Code session that intends to apply this skill:

```
cd "C:/Users/27741/OneDrive/Desktop/Probably weather new/probably-weather-new-c"
git pull
git rev-parse HEAD
git rev-parse --abbrev-ref HEAD
wc -c .claude/skills/pw-image-system/SKILL.md
grep "^- \*\*v" .claude/skills/pw-image-system/SKILL.md | tail -3
```

If the session is in a worktree at an older commit than main, halt and either checkout main, pull into the worktree, or copy the latest SKILL.md across before reading.

## Out of scope (do NOT edit)

The **image picker code** in `assets/app.js` (currently `setBackgroundFor()` calling `getWeatherBackgroundFolder()`) is **read-only for this skill**. It is owned by pw-weather-logic. This skill defines what files exist in `assets/images/bg/[condition]/` for the picker to find. New conditions, new rotation behavior, new aliasing, or new fallback logic require a pw-weather-logic change — never a pw-image-system change.

The weather algorithm and condition routing in `api/weather.js` is also out of scope. This skill is downstream of weather decisions: once a condition is resolved, this skill governs what image is shown.

**Picker extension to 28-day cycle:** the current picker uses a mod-14 rotation. Extending it to mod-28 (to read day_15–day_28) is a pw-weather-logic sprint that happens AFTER the v2.5 library is full — not a pw-image-system change. Until that sprint ships, day_15–day_28 sit in the repo unused. This is intentional: generate the library first, then flip the picker. Don't block library generation on the picker change.

---

## Folder Structure (verified in repo, 2026-05-17)

```
assets/images/bg/
  clear/
  cloudy/
  cold/         ← CT wet-cold (rain/drizzle/cloudy + low temp)
  cold-clear/   ← 2026-05-17: high-veld dry-cold (clear/sun + low temp)
  fog/
  heat/         ← folder name is "heat" not "hot"
  rain/
  storm/
  wind/
  default.jpg   ← global fallback at folder root (currently 1920×1080 landscape; flagged for eventual portrait replacement)
```

UV and rain-possible are handled in the picker code as aliases — they don't have their own folders. Do not create those folders.

**As of the 2026-05-19 audit:** `cold-clear/` folder does NOT yet exist on disk (the 23 staged candidates are in `pw-image-staging/inbox/cold-clear/` and `reviewed/cold-clear/`, awaiting `promote.py`). The other 8 condition folders are fully populated with 24 files each (the v2.4-era starter set).

---

## File Naming Convention (28-Day Cycle for Day Slots, 14-Slot Cycles for Time Slots) — v2.5

### Day slots — 28-day mod-28 rotation

| Slot | Day type |
|---|---|
| `day_1` – `day_5` | Week 1 weekdays (Mon–Fri) |
| `day_6` | **Week 1 Saturday** |
| `day_7` | **Week 1 Sunday** |
| `day_8` – `day_12` | Week 2 weekdays (Mon–Fri) |
| `day_13` | **Week 2 Saturday** |
| `day_14` | **Week 2 Sunday** |
| `day_15` – `day_19` | Week 3 weekdays (Mon–Fri) |
| `day_20` | **Week 3 Saturday** |
| `day_21` | **Week 3 Sunday** |
| `day_22` – `day_26` | Week 4 weekdays (Mon–Fri) |
| `day_27` | **Week 4 Saturday** |
| `day_28` | **Week 4 Sunday** |
| `day.jpg` | FALLBACK ONLY, never use as a primary named slot |

**Weekend slots = `day_6`, `day_7`, `day_13`, `day_14`, `day_20`, `day_21`, `day_27`, `day_28`.**
- **Saturdays (`day_6`, `day_13`, `day_20`, `day_27`)** — braai content, Weber-prep, fire-starting, kuier energy.
- **Sundays (`day_7`, `day_14`, `day_21`, `day_28`)** — family lunches, lazy-Sunday animals, multi-generational stoep scenes.
- **Weekday slots** (`day_1`–`day_5`, `day_8`–`day_12`, `day_15`–`day_19`, `day_22`–`day_26`) — school-run, commute, lunch-break, dusk-return content.

### Dawn / dusk / night slots — 14-slot mod-14 rotation each

The time-slot cycles ride on the same 14-day Mon→Sun→Mon→Sun cadence as the previous (pre-v2.5) day cycle, doubled in size from v2.4's 3 slots each to 14 slots each. Same Saturday / Sunday positions.

| Slot | Day type |
|---|---|
| `dawn_1` – `dawn_5` | Week 1 weekdays (Mon–Fri) |
| `dawn_6` | **Week 1 Saturday** |
| `dawn_7` | **Week 1 Sunday** |
| `dawn_8` – `dawn_12` | Week 2 weekdays (Mon–Fri) |
| `dawn_13` | **Week 2 Saturday** |
| `dawn_14` | **Week 2 Sunday** |

Same shape for `dusk_1`–`dusk_14` and `night_1`–`night_14`.

Weekend dawn / dusk / night slots (`dawn_6`, `dawn_7`, `dawn_13`, `dawn_14`, and the same numbers in dusk and night) lean toward weekend-coded content (early-Saturday-braai-prep dawn, lazy-Sunday-dusk-stoep, etc.). Weekday slots lean toward weekday-coded content (commute-dawn, after-work-dusk, school-night).

---

## Target Counts (Pre-launch Minimum) — v2.5

Per condition folder when complete:

| Slot family | Count |
|---|---|
| `day_1` – `day_28` | **28** |
| `day.jpg` fallback | 1 |
| `dawn_1` – `dawn_14` | **14** |
| `dusk_1` – `dusk_14` | **14** |
| `night_1` – `night_14` | **14** |
| **Total per condition** | **71** |

**Pre-launch minimum target. Pools may grow beyond these after launch** (the rotation system in Phase 2 reads a larger manifest and rotates which slots are active per week — so over time, each bucket can accumulate dozens more variants without needing all of them generated up-front).

Across 9 condition folders: 9 × 71 = **639 images at full pre-launch target.**

---

## Bucket-by-Bucket Reality (2026-05-19 filesystem audit) — v2.5

Audit-grounded state as of 2026-05-19. **Existing files stay untouched** per Al's 2026-05-19 decision ("i dont want to change any of the existing images"). The rotation system handles eventual dimension reconciliation when it ships.

| Condition | Existing on disk (24 each = v2.4-era starter set) | New slots to fill for v2.5 target |
|---|---|---|
| `clear` | 24 (22 portrait, 2 squares: day_1, day_11) | day_15–28, dawn_4–14, dusk_4–14, night_4–14 → **47 new** |
| `cloudy` | 24 portrait (mixed dims, all ~9:16-ish) | day_15–28, dawn_4–14, dusk_4–14, night_4–14 → **47 new** |
| `cold` | 24 portrait | **47 new** |
| `cold-clear` | 0 on disk + 23 in staging pipeline awaiting promote (5 reviewed anchors + 18 inbox candidates) | day_4–28 *if all 23 staged survive review*, dawn_4–14, dusk_4–14, night_4–14 → **~47 new after promote** (exact count depends on review outcomes) |
| `fog` | 24 portrait | **47 new** |
| `heat` | 24 portrait | **47 new** |
| `rain` | 24 portrait (`rain/day_4` was flagged 2026-05-06 "added people not in source" — accept or replace separately, doesn't block the 47 new) | **47 new** |
| `storm` | 24 portrait | **47 new** |
| `wind` | 24 mixed: 17 portrait + 5 squares (day_2, day_3, day_4, day_5, day_7) + 2 landscapes (dusk_1, night_2) + 2 reversed-portrait (day, day_1) | **47 new** (existing outliers stay per Al — rotation buys time later) |
| **Total new** | | **~423 images** across 9 buckets |

**Cost at OpenArt Medium tier** (35 credits / image): 423 × 35 = **~14,805 credits** for the full library. Current 26,515 OpenArt balance covers this 1.8× before subscription renewal. Comfortable headroom.

---

## Existing Image Dimensions (audited 2026-05-19) — v2.5

The 193 existing images on disk span four dimension classes. **All grandfathered.** All new images from v2.5 onward at canonical 1008 × 1792 (see Image Generation Spec below).

| Dimension | Aspect | Count | Where |
|---|---|---|---|
| `1024 × 1024` | square | 7 | 2 in `clear/` (day_1, day_11), 5 in `wind/` (day_2, day_3, day_4, day_5, day_7) |
| `1920 × 1080` | 16:9 landscape | 3 | 2 in `wind/` (dusk_1, night_2), 1 at `bg/default.jpg` root fallback (flagged for eventual portrait replacement) |
| `1376 × 768` | reversed-portrait (landscape orientation but tall ratio in transposed form) | 2 | 2 in `wind/` (`day.jpg`, `day_1`) |
| `1536 × 2752` / `941 × 1672` / `768 × 1376` | 9:16-adjacent portraits (all approximately 0.558–0.563 ratio) | 181 | spread across all 8 populated folders in various ratios |

New 1008 × 1792 images will sit alongside these grandfathered variants in the same folders. The picker doesn't care about dimensions — it picks by slot name. Mobile viewport sizing handles the variance.

---

## Time Slot Hours

| Slot | Hours |
|---|---|
| dawn | 05:00 – 08:00 |
| day | 08:00 – 17:00 |
| dusk | 17:00 – 20:00 |
| night | 20:00 – 05:00 |

---

## Image Generation Spec (updated 2026-05-19 for v2.4, dimension grandfather list refreshed 2026-05-19 for v2.5)

### Canonical dimension: **1008 × 1792**

True 9:16 portrait. This is OpenArt's native preset for 9:16 / 1k tier. Higgsfield's `aspect_ratio: 9:16` parameter targets the same ratio at 2k. The earlier v2.x spec said "1024×1792" but that is a 4:7 ratio (0.571), not true 9:16 (0.5625) — at non-standard ratios the model can return a slightly squished frame. **1008 × 1792 is the v2.4+ target.**

**Grandfathered exceptions** (audited 2026-05-19):
- 4 cold-clear anchor images locked 2026-05-17 at `aspect_ratio: 2:3` stay as-is.
- 19 cold-clear candidates from 2026-05-19 overnight Higgsfield batch at 9:16/2k stay as-is (in staging pipeline awaiting promote).
- All 193 existing images on disk at the four dimension classes documented in "Existing Image Dimensions" above stay as-is. The rotation system (Phase 2) handles eventual incremental reconciliation post-launch.

**ALL NEW IMAGES from v2.4+ onward: 1008 × 1792.**

### Model selection

- **Default for volume work: `gpt-image-2`** (also labelled "Image 2.0" / "GPT Image 2"). It is the canonical model for batched bucket generation across the cycles. Available via Higgsfield MCP (`model: gpt_image_2`), OpenArt (deep-link `/suite/create-image/gpt-image-2`), and ChatGPT Pro browser.
- **Reserved use only — Nano Banana Pro (`nano_banana_2`):** (a) the 23 existing cold-clear images already generated stay grandfathered on Nano Banana Pro, (b) PW marketing/promo asset creation only, (c) one-off hero images where Nano Banana Pro's more saturated/atmospheric character matters more than cost-per-image.
- **Higgsfield credits (1413 remaining as of 2026-05-19) are NOT used for volume batching.** Reserved for promo, character-continuity work, and one-offs. Volume goes through Leonardo + OpenArt via Minnie autonomous.

### Quality tier

- **Default for production batches: Quality = Medium.** PW backgrounds sit behind a UI overlay (location label, temperature, byline, hourly strip, weather icons). High-tier's extra detail — brick texture, fabric weave, jacaranda branch intricacy, kitchen-interior depth — lands precisely where the UI obscures it. The user never sees that detail. Medium (35 credits / image at OpenArt 9:16/1k) is the right cost/value point for backgrounds. Wall-time per image at Medium: ~62 s.
- **Reserved for High tier:** marketing materials, app-store screenshots, Play Store feature graphic, social media hero images — anywhere the image is NOT occluded by UI. High is 130 credits / image (3.7× Medium), ~137 s wall-time (2.2× Medium). Both tiers produce the same 1008×1792 dimensions; quality affects model compute, not resolution.
- **Low tier (5 credits / image):** available but untested. Use only for rapid-iteration drafts where final quality doesn't matter. Auto Polish would normally compensate for Low's coarseness — but PW keeps Auto Polish OFF (see Critical Rule #16), so Low at OpenArt will read rougher than at other platforms.

OpenArt credit cost confirmed via 2026-05-19 recon: **Low 5 / Medium 35 / High 130** per image at 9:16 / 1k. Cost gradient steeper than visible-quality gradient.

### Generation lanes (see also "Platform Knowledge" at end of skill)

**Lane A — Higgsfield MCP (promo, character-continuity, one-offs):** Direct from claude.ai or Claude Code via the Higgsfield MCP `generate_image` tool. Use `model: gpt_image_2` or `nano_banana_2`, `aspect_ratio: 9:16`, `resolution: 2k`, `quality: medium` (gpt_image_2 only). Higgsfield credits.

**Lane B — Leonardo (burn-down before subscription cancellation):** Via Minnie autonomous-overnight on `gpt-image-2`. 66 tokens per image (Leonardo pricing). Subscription cancelling end-June 2026 — burn down before then.

**Lane C — OpenArt (burn-down before account closure, primary volume lane):** Via Minnie autonomous on `gpt-image-2` (OpenArt label "GPT Image 2"). Deep-link `/suite/create-image/gpt-image-2`. Account closes soon — burn down the 26,515-credit balance before then. Generation default: 9:16 / 1k / Medium / Auto Polish OFF / count 1.

**Lane D — ChatGPT Pro (browser, manual, character-continuity batches):** ChatGPT Images 2.0 in Thinking mode. 8 coherent images per single prompt with native character continuity. Best for "show this SA family of 4 across 8 different daily-slot scenes" — same characters maintain identity across 8 frames. Manual download per browser.

### Negative Prompt (scene-aware, 2026-05-19)

**Base block — applied to ALL generations:**

```
text, watermark, logo, words, letters, numbers, signs, banners, speech bubbles,
extra limbs, deformed hands, deformed fingers, floating objects, ugly, blurry,
low quality, stock photo aesthetic, generic western suburban USA aesthetic,
horror, dystopian, gritty, dirty, poverty, graffiti, litter, overexposed,
underexposed, cartoon, illustration, painting, drawing
```

**High-risk prop extension — applied to ALL generations** (added v2.4):

```
car number plate, license plate, house number, appliance brand logos,
branded bottle labels, branded packaging, school uniform crests, school badges,
trail markers, shop signage, road signs, billboards, magazine covers,
newspaper headlines, t-shirt slogans
```

The base block already says "text, watermark, logo, words, letters, numbers, signs" — but specific props commonly violate these rules because gpt-image-2 renders text on them eagerly. The high-risk prop list names the things the model defaults to lettering. **Also prefer affirmative phrasing in the positive prompt** to push the model away from these defaults: "plain unbranded bottle" beats "no Coca-Cola"; "generic coffee mug" beats "no Starbucks"; "unbranded school blazer in navy" beats "no school crest". Affirmative-positive beats negative-block for gpt-image-2 specifically.

**Day-only addition — scene-aware** — append to base + prop block for **OUTDOOR** day-slot (08:00–17:00) generations only:

```
artificial lighting indoors
```

**Decision rule:**
- **Outdoor day-slot scene** (suburban patio, garden, beach, street, park, school gate) → base + prop block + `artificial lighting indoors`.
- **Indoor day-slot scene** (rainy lunch in kitchen, cold soup at the table, cloudy office, fog indoors morning coffee, kettle on the stove during a storm) → base + prop block ONLY. Lamps, ceiling lights, kitchen lights are legitimately on in these scenes even at midday.
- **Dawn / dusk / night (any setting)** → base + prop block only. These scenes legitimately use warm artificial light — kitchen lights, lamps, fairy lights, battery lanterns, street lights.

v2.3's day-only modifier fired on ALL day-slot scenes including indoor ones. v2.4 refines: the modifier targets the actual problem (outdoor scenes that shouldn't have desk lamps glowing in the background), not legitimate indoor light at midday.

### Diversity Instructions (scoped by HUMAN COUNT, 2026-05-19)

Diversity guidance scales with how many humans are actually in the frame. The point is to prevent the model defaulting to one race in scenes where multiple people are present — NOT to engineer every frame to display every population group.

**Count 0 — no humans in frame** (animal, object, landscape only):
Omit the diversity instruction entirely.

**Count 1 — solo scene**:
Specify the character's identity directly in the prompt (e.g. "Black SA grandmother in her mid-60s", "Indian SA father in his early-40s", "Coloured SA teenager"). The group-diversity boilerplate creates a contradiction in a solo scene — one person cannot be a "mixed race group." Across the cycle, rotate the demographics — don't make every solo subject the same race.

**Count 2–3 — couple / household / intimate family / small workplace**:
Specify each character's identity directly in the prompt, like the solo rule but for each person (e.g. "Black SA father in his 40s and his two daughters, one 8 and one 12"). DO NOT include the four-group boilerplate — a 3-person family physically cannot represent Black + Coloured + White + Indian SA together without the model adding extra figures or distorting identities. Families do NOT need to be engineered to display every population group. Mixed-heritage families are fine, single-heritage families are fine, what matters is the scene feels authentic and the demographics are varied across the cycle.

**Count 4+ — public / group scene** (restaurant, office park, beach, market, party of 5+):
Include the group-diversity boilerplate:

```
Include diverse South African characters — mixed race group reflecting the real
diversity of South Africa. Show Black, Coloured, White, and Indian South Africans
naturally together. No stereotyping. Natural body language and authentic SA
clothing/style.
```

**Universal rule across all counts:** Across the full cycle of any one condition folder (28 day slots + 14 each for dawn / dusk / night), rotate the demographics of the human subjects. Don't make every solo subject in the cold-clear bucket Black; don't make every couple in the heat bucket White. The diversity goal lives at the BUCKET level (variety across the cycle), not at the FRAME level (every frame must show every group).

This is the canonical scope for PW. The rule is "do not let the model default to one race only in group scenes AND vary demographics across the cycle in single/small scenes," not "force diversity in every frame regardless of subject."

---

## SA Image Aesthetic Rules

- Beautiful, warm, relatable South African scenes
- **Nationally representative** — Joburg, Pretoria, Durban, Cape Town suburbs, Bloemfontein, Limpopo, Garden Route, KZN, Free State, Mpumalanga, Eastern Cape, Karoo
- Cape Dutch architecture, Helderberg/Boland mountains, suburban gardens, jacarandas, bougainvillea, fynbos
- **Modern aspirational SA middle-class** as the default architectural register — NOT stock suburban, NOT working-class, NOT struggling. See "Architectural Variety" below for the specifics.
- Diverse, authentic SA people — mixed race, real SA body language, modest middle-income texture
- No American suburban aesthetic (white picket fences, yellow school buses, mailboxes at the curb)
- No generic stock-photo feel
- **Positive vibes only — no poverty, grit, or dystopian aesthetic**
- **Braai scenes ONLY for Saturday slots** (`day_6`, `day_13`, `day_20`, `day_27`). Sunday slots (`day_7`, `day_14`, `day_21`, `day_28`) get family-lunch / lazy-Sunday / cute-animal content.
- No text, signs, or readable words in any generated image

---

## Architectural Variety (NEW v2.4)

**The redbrick problem.** Both Nano Banana Pro and gpt-image-2 default to RED FACE-BRICK when given "SA suburban" or "modern face-brick" prompts. This is a global model bias that produces a stock 1980s suburban look. PW's aesthetic is **aspirational middle-class SA — NOT stock suburban, NOT working-class, NOT struggling**. Default red-brick reads as the wrong class signal.

Al's verdict on the 2026-05-19 cold-clear overnight batch: *"all the houses and buildings are made from redbrick. we can use this batch but the rest of the images we make for this condition has to have some variety in the houses. Modern yes, but not all redbrick."*

### Banned phrase patterns (will anchor red brick)

- Bare "face-brick" without a qualifier → anchors red brick.
- "Modern suburban home" without architectural detail → anchors red brick.
- "Middle-class SA home" without specification → anchors red brick.
- "SA suburban house" with no further description → anchors red brick.

### Required: affirmatively specify the architectural type per prompt

Rotate across the cycle of each condition folder. **Nine canonical SA suburban / residential types:**

1. **Rendered white-plaster double-storey** — aluminum-frame windows, glass balustrades, clean modern lines. Sandton / Bryanston / Waterfall feel.
2. **Painted stock-brick** — sage / terracotta / navy / charcoal accents, steel-frame windows. 1980s-90s suburb refreshed.
3. **Modern minimalist concrete + glass** — cantilevered roofs, frameless glass walls, integrated water features. Camps Bay / Constantia architect-built.
4. **Tan / cream face-brick (NOT red)** — textured contemporary face-brick, double garages, paved driveways. Helderberg estates / Stellenbosch.
5. **Cape Dutch revival** — gabled, whitewashed, oak shutters, slate roof. Western Cape farmhouses, wine estate adjacent.
6. **Sandstone / exposed stone** — Free State estate homes, Eastern Cape farms.
7. **Karoo flat-roofed white** — Karoo / Northern Cape interior. Simple, geometric, lime-washed.
8. **1970s suburban with painted accents** — face-brick refreshed with painted trim, modern windows. Older suburbs gentrified.
9. **KZN tropical** — low-slung, deep eaves, terracotta tiles, indigenous garden integration. Ballito / La Lucia / Umhlanga.

### Regional appropriateness per condition mood

| Condition | Lean toward (types) |
|---|---|
| cold-clear (high-veld dry-cold) | 1, 2, 3, 4, 6, 8 — Joburg / Pretoria / Bloemfontein / Free State context |
| cold (CT wet-cold) | 3, 5, 8 — Cape Town / Boland context |
| heat (high-veld + KZN summer) | 1, 3, 4, 7, 9 — Joburg / Karoo / KZN |
| rain | 5, 8, 9 — Cape Town winter rainfall + KZN summer storms |
| storm | 1, 2, 3, 4 — high-veld 4pm thunderstorm prototype |
| wind | 5, 8 (Cape Doctor) — but also 9 (KZN coastal berg wind) |
| clear | any — vary aggressively |
| cloudy | any — vary aggressively |
| fog | 5, 6, 9 — Garden Route / Drakensberg / KZN South Coast |

### Aspirational anchor language (include where natural)

- Manicured indigenous gardens (fynbos, agapanthus, bougainvillea, restio grasses, palm)
- Paved driveways with cobble accents
- Double garages (closed, or with car visible inside)
- Security walls with planters (not razor wire)
- Built-in braais on covered patios
- Pool / water feature integration
- Modern garden furniture (teak, powder-coated steel)
- Aluminum-frame sliders / stack-doors
- Cantilevered roofs / deck overhangs

### Aspirational area inspiration (visual anchor only — do NOT name in prompts)

Bryanston, Constantia, Helderberg, Waterfall, Sandton residential, Ballito, La Lucia, Umhlanga, Camps Bay, Stellenbosch wine estates, Plettenberg Bay. **Do NOT name these areas in prompts** (the model will lean copyrighted/place-recognisable). Use them as VISUAL anchors when writing the architectural description.

### Bucket-level rotation rule

Architectural variety lives at the BUCKET level per the same logic as the count-aware diversity rule. **No one architectural type should appear more than 3 times within any 14-slot window of the cycle.** For the 28-day cycle that means no single type exceeds 6 instances total across day_1–day_28; for the 14-slot dawn / dusk / night cycles the rule applies as a flat 3-instance cap. Within a single frame, pick ONE type and commit to its details — don't blend (a Cape Dutch farmhouse with a cantilevered concrete roof is incoherent).

### Motif Diversity (NEW v2.6)

Mirror the architecture rotation rule for thematic motifs. A bucket has a vocabulary of recurring visual motifs; repeating one too often makes the rotation pool feel samey — motif clustering was the primary failure mode Al identified in the wind+heat review.py session. Canonical motif vocabularies per bucket — use these tags when checking a batch for coverage, and when filling the `motif` field of every JSON sidecar (required from v2.6 — see Critical Rule #17's companion note and the rotation-system note):

- **wind:** trampoline-airborne, washing-on-line, braai-cover-chase, dustbin-blown-over, sunglasses-or-cap-blown-off, kite-or-flag, leaf-or-paper-vortex, hair-horizontal, shop-canopy-flapping, patio-umbrella-inverted, plant-pot-toppled, gate-swinging, dog-ears-back
- **heat:** pool, ice-cube, sweat-bead, hot-bakkie-seat, sprinkler, melting-chocolate-or-ice-cream, dog-on-cool-tiles, fan-or-aircon, shade-seeking, biltong-reference, slip-slop-melt, sunburn-line, hose-pipe-cool-down, ice-water-jug
- **storm:** lightning-bolt, hailstones, candle-or-lantern, dog-under-bed, washing-being-rescued, swimming-pool-overflow, gas-cooker-bredie, leaking-roof-bucket, hail-on-bakkie, child-window-watching, power-out-darkness, sirens-or-emergency
- **rain:** wet-dog, wellies-puddle, umbrella, leaking-gutter, fogged-window, raincoat-hood, wet-suede-or-canvas, cat-watching-from-sill, kitchen-light-on, soup-on-stove, rain-on-roof-tin
- **fog:** GPS-confused, dog-walker-trust-exercise, headlights-low, vanishing-fence-or-path, isolated-figure, light-cone-from-window, mist-on-mountain, spider-web-jeweled
- **cold:** soup, double-jersey, breath-cloud, duvet-or-blanket, hot-water-bottle, scarf-pulled-up, beanie-and-mug, fireplace-or-heater, dog-in-jersey
- **cold-clear:** frost-on-grass, breath-cloud, puffer-with-sunglasses, frozen-bird-bath, dignified-squinting-dog, frost-on-trampoline, bare-jacaranda-silhouette, frosted-patio-furniture, frozen-pool-cover
- **clear:** beach, jacaranda, hadeda, pool-occupied, garden-fynbos, blue-sky-overhead, golden-hour-lawn, kombuis-window-light, surfer-walk, mountain-bike-trail
- **cloudy:** indecisive-sky, dog-walk-jersey, woolies-bag, beige-vibe, half-blue-half-grey, neutral-light-lounge, jacket-over-arm, two-views-from-window

**The rule** (refined from "no motif more than once" per Al's feedback — that was too strict and starved real batches):

- **No motif may appear more than 3 times per 47-brief batch.** Within that limit, **no two instances of the same motif may share scene-type** — same motif + same scene-type is a visual repeat and fails. Example: three `pool` images in heat are fine if one is kids cannonballing, one is a lone dawn-lap swimmer, one is an abandoned-floaty dusk reflection. Three `pool` images where all show kids splashing = fail.
- **Prohibit motif clustering** (same motif + same scene-type). **Allow motif rotation** (same motif + different scene-type). A motif may recur up to 3× only if every instance is a genuinely different scene-type.
- **Canonical ★ anchors get strict treatment.** The lines marked ★ in the Humour Register are bucket-defining shorthand — their motif appears **EXACTLY ONCE per 47-brief batch**. The ★ marks them as the bucket's signature, not as the brief-writer's favourite hook to reuse. (For wind the ★ anchors are the trampoline and the involuntary-yoga trees; the trampoline maps to the `trampoline-airborne` motif, which therefore appears once and once only in a wind batch.)

---

## Humour Register (NEW v2.4)

PW's hero copy includes weather-specific witty lines — koud-maar-lekker absurdity, SA winks, gentle truth-telling. The full T-table lives in `assets/weather-copy.js` (also catalogued for image-brief reference at `pw-image-staging/batches/v2.4-humour-pull.md`).

**COGNITIVE-DISSONANCE REGISTER (generalised, v2.6)** — applies across buckets where natural. The visual cues say one condition while the actual condition is the opposite. The viewer's brief recalibration IS the joke. Cold-clear is the clearest example (looks like summer, is winter — see the dedicated subsection below). Other candidates: heat dusk/night (looks like a cool evening, the bakkie-seat still burns at 7pm), storm intervals (golden light between thunder cells, deceptive calm), fog clearing (feels like dawn, actually noon). When writing briefs in these buckets, ask: is there a moment where the visual register can briefly read as a different condition before the actual signals reveal the truth? That moment is high-value humour.

**Curated energy-anchor lines per bucket, English** (★ marks the canonical bucket-defining anchor — see Motif Diversity for its strict once-per-batch treatment):

**clear** — "Africa's sky just hits different." · "Main character weather right here." · "The Helderberg is showing off today." · "Even the hadedas sound happy." · "The kind of day that makes people text 'lekker dag hey'." · "Africa showing off again. Quietly devastating."

**cloudy** — "The sky's giving absolutely nothing." · "Good day for a walk, bad day for a tan." · "The sky's giving 'I'll try again tomorrow' energy." · "The vibe is beige. Accept it." · "Perfect weather for a Woolies run and Netflix." · "The clouds RSVP'd 'maybe' and showed up anyway."

**cold (CT wet-cold)** — "Ja, it's jersey weather. Double jersey." · "Cold enough for soup. And a second soup." · "Your breath is doing special effects." · "The duvet understood the assignment." · "Your jacket has a jacket. It's that kind of day." · "The dog refused to go outside. Fair." · "You're not cold, you're 'lekker koud'. Big difference."

**cold-clear (high-veld dry-cold)** — *no dedicated witty bucket in the T-table yet, but the image register IS defined — see "Cold-clear humour register" subsection below.* Short version: cognitive-dissonance humour, the scene looks like a perfect summer day until the cold-weather signals reveal the truth. Adjacent T-table lines closest in spirit: *"You're not cold, you're lekker koud."* · *"Your breath is doing special effects."*

**fog** — "Silent Hill vibes. Without the monsters. Hopefully." · "Even your GPS is confused." · "Walking the dog has become a trust exercise." · "The world ends two metres past the gate." · "Cape Town just got a dimmer switch." · "The morning forgot to render."

**heat** — "Stay hydrated or become a biltong." · "You could fry an egg on the N1." · "The pool is not optional." · "You're not sweating. You're 'glowing'. Sure." · "Everyone with a pool just became very popular." · "Don't touch the seatbelt buckle. Trust us." · "Even the shade is sweating."

**rain** — "The garden's saying dankie at last." · "Good soup weather, not gonna lie." · "Your suede shoes chose today? Bold." · "The dog is staring at the rain like it's a personal insult." · "Yes, it's raining sideways. South Africa speciality." · "Forgot your jacket? The universe noticed."

**storm** — "The dog's under the bed. Smart move, honestly." · "Even the hadedas are quiet." · "This is why Noah built a boat." · "The braai is cancelled. Yes, really." · "Somewhere a roof is someone's new kite." · "Pak die kar onder die boom in."

**wind** — ★ **"The trees are doing involuntary yoga."** · ★ **"Someone's trampoline is now two streets away."** · "Table Mountain's tablecloth is out." · "The Cape Doctor is making house calls." · "Even the seagulls are walking today." · "Your washing just moved to the neighbour's yard." · "The braai cover is in the next suburb."

### How to USE these in image briefs

The lines are **mood/humour ENERGY ANCHORS for the bucket, not literal prompt-image pairings.** An image does NOT need to illustrate one specific line. Multiple images per bucket can share the same energy register without any one image being a 1:1 visual of a line.

**Example:** a wind/day_8 image of an overturned trampoline two yards over a fence is in the spirit of "Someone's trampoline is now two streets away" without literally illustrating that line. The trampoline image could be captioned by EITHER wind line and still work. The image carries the SA absurdity register; the copy line floats over it.

**Image briefs SHOULD aim for:**

- One small absurd moment per scene (where natural — not every image needs to be funny)
- SA-specific humour cues: an unimpressed dog watching frost form, a beanie blown sideways mid-stride, a braai cover flapping in wind, a child in puffer-jacket trying to drink hot chocolate too fast and pulling a face, a teenager wearing shorts in 5°C "because it's not THAT cold", a sleeping cat refusing to acknowledge the snow alert
- Truth-telling moments: someone forgetting their gloves, washing pulled half-off a line mid-gust, a wet shoe held up in disgust
- Quiet absurdity NOT slapstick — no cartoonish exaggeration, no sight gags, no clowning

**Image briefs SHOULD NOT:**

- Force humour into every frame — quiet contemplative images are also canonical (dusk_1 frosted sunglasses is canonical, no humour)
- Try to illustrate the witty line literally — that produces a sight gag, not the desired register
- Use comedic exaggeration — proportions stay realistic, expressions stay subtle

### Cold-clear humour register (added 2026-05-19 from Al's review.py walkthrough)

PW's T-table has no dedicated witty bucket for cold-clear yet. The defining humour register for this bucket, per Al's review.py session insight:

> "The humour lies in the idea that it's cold but looks deceptively like a perfect weather day. Like nature is messing with your mind."

This is **cognitive-dissonance humour, NOT slapstick or accident-based**. The visual deception is the joke. The image LOOKS like summer / sunny / holiday weather but the cold-weather signals reveal the truth.

**Cold-weather signals required for the visual contradiction to land:**
- Visible breath OR breath implied (mug steam, frost-pluming exhale)
- Frost on grass / patio / windscreens / trampolines
- Puffer jackets, beanies, scarves, gloves (winter wardrobe in summer-looking light)
- Bare winter trees (jacaranda silhouettes against a sunset)
- Dry brown highveld grass — never wet green

**Examples of the cold-clear cognitive-dissonance register:**

- Person in stylish aviator sunglasses + heavy puffer jacket — reads as ski-resort glamour, is just Joburg in July
- Bright cloudless deep-blue sky + frost on the patio grass — looks like swimming weather, is hot-chocolate weather
- Empty pool with sun glittering on the water, two people on loungers reading in puffers and beanies
- Kid in shorts paired with thick puffer jacket and beanie: "it's not THAT cold, Ma"
- Adult drinking iced coffee outside at 5°C because "the sun is out and it's bright"
- Trampoline frosted white but golden morning sun catching it like summer
- Patio breakfast scene that LOOKS like summer Sunday but everyone in scarves and woollen socks
- Dog basking in a sunbeam on a frosted lawn, dignified squint
- Wine glasses on outdoor table in golden light but the moisture on them is frost, not condensation
- Two kids running on dry brown grass under blazing blue sky in puffer jackets, breath visible

The viewer should briefly think "oh, nice day" before clocking the cold-weather signals. That moment of recalibration IS the joke.

**Apply this register to roughly 40% of cold-clear briefs** (slightly higher than the general 30% humour rate per v2.4, because cold-clear's whole bucket identity benefits from leaning into the visual contradiction). Other 60% stay quiet/contemplative: frost on aviator sunglasses still life, grey cat watching breath form in cold air, dignified bare-tree silhouettes against deep navy dusk sky.

---

## Prompt discipline (locked 2026-05-17)

**Moment, not tableau.** Every prompt must specify what is HAPPENING, not just the setting. This is now formalised as **Critical Rule #17** — every brief tells a complete micro-story. Apply the **verb test**: the brief's one-sentence summary must contain a subject + active verb + consequence (or implied consequence). "X is happening" fails; "X does Y because Z" / "X has just done Y" / "X is about to Y" pass.

- Tableau (fails): "Mom blows on mug, son stands there"
- Moment (lands): "Mom reaches to button son's school-blazer collar as he checks the gate"

Bucket signals (frost, breath, jacket, fynbos, jacaranda) become wallpaper without a moment.

## Brief integrity check (added 2026-05-19)

Before sending any prompt for generation, count the humans you actually wrote into the prompt and confirm:

1. **Visible-count matches stated count.** If your metadata says "family of 4" but the prompt text only describes mother + two children, that's a mismatch. Fix one or the other. Models add or distort figures to satisfy contradictory cues.
2. **Diversity rule matches count.** Re-run the Count 0 / 1 / 2-3 / 4+ check against the count you just verified. Don't carry forward a stale diversity bucket from a previous draft.
3. **No engineered demographics in small groups.** If you wrote a 2-3 person scene and the prompt still says "Black, Coloured, White, and Indian South Africans together," delete that line. The four-group boilerplate is for Count 4+ only.
4. **Architectural type stated affirmatively.** Confirm the prompt picks ONE of the 9 canonical SA types and commits to its details — not bare "face-brick" or "modern suburban". (v2.4)
5. **High-risk props worded affirmatively.** Confirm any bottles, mugs, vehicles, school items, signage are described as "plain unbranded ___" / "generic ___" / etc. in the positive prompt, not just listed in the negative. (v2.4)
6. **Motif uniqueness within batch.** (v2.6) Confirm this brief's primary motif (from the canonical vocabulary in Motif Diversity) doesn't already appear 3 times in this batch's manifest, and isn't a canonical ★ anchor that has already been used once. If it does, change one of them — usually this one, since later briefs in the batch have less flexibility.
7. **Story has a verb.** (v2.6) Confirm the brief's one-sentence summary contains a subject + active verb + consequence (or implied consequence). "X is happening" fails. "X does Y because Z" / "X has just done Y" / "X is about to Y" all pass.

## Banned content (in addition to the universal negative prompt)

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

### cold-clear (high-veld dry-cold)
**Routing trigger** (owned by pw-weather-logic): `dailyHighC < 15` AND condition in {clear, sun, partly_cloudy}.
**Mood:** Crisp, awake, sharp. Sun + cold air at the same time. *"Koud maar lekker."* Joburg/Pretoria/Bloemfontein winter morning prototype.
**Signals (must appear):** Visible breath OR breath implied (mug steam); frost on grass/lawn/windscreens; bare winter trees (jacaranda); dry brown highveld grass — never wet green; clear blue or navy sky; aspirational SA suburban architecture (NOT bare red face-brick — see Architectural Variety).
**Wardrobe:** Thick puffer jackets, woolly jumpers, beanies, scarves, gloves, sunglasses paired with winter wear (the cold-clear signature), closed shoes, layered.
**Locked 4 anchor images (2026-05-17, grandfathered at aspect_ratio 2:3):**
- `cold-clear/dawn_1.jpg` candidate — Black SA mother buttoning son's school blazer at back gate, both breath visible (Higgsfield job `cb44f773`). **Count: 2 humans (mother + son). Falls under Count 2-3 bucket — identities specified directly, no four-group boilerplate.**
- `cold-clear/day_1.jpg` candidate (weekday) — Boerbull on sunlit modern suburban patio, breath visible, ear cocked (Higgsfield job `7e4aa8eb`). **Count: 0 humans — diversity clause omitted.**
- `cold-clear/dusk_1.jpg` candidate — Frosted aviator sunglasses + steaming coffee + paperback on modern outdoor table (Higgsfield job `58436ea4`). **Count: 0 humans — diversity clause omitted.**
- `cold-clear/night_1.jpg` candidate — Grey cat approaching battery LED lantern on modern patio (Higgsfield job `5a1cffaa`). **Count: 0 humans — diversity clause omitted.**

Plus dusk_2 added 2026-05-19 (Indian SA father pulling frost cover, 1 human bucket, job `7c354bf1`), plus 16 overnight batch candidates awaiting review.

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

## Clear Folder Image Slots (Reference — original 14-slot starter set)

Target subjects for the clear condition folder. This is the **14-slot starter set** drafted under v2.0 — under v2.5 the clear bucket extends to 28 day slots + 14 each for dawn / dusk / night, so day_15–28 and dawn_4–14 / dusk_4–14 / night_4–14 are new slots to draft during the clear batch run. The 14-slot table below stays as a worked example of how subject variety distributes across a 2-week sub-cycle.

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

Subjects mix people scenes, animal scenes (hadeda, dog, cat, moth), and object/element scenes (flip flops, sunset, beach) naturally across the cycle. No forced quota — variety comes from genuinely different subjects across the cycle.

---

## Image Quality Checklist (Post-Generation)

Before committing any new image to the repo (or promoting from pw-image-staging), verify:

1. **No text/signs/words** visible anywhere in the image
2. **No deformed hands/faces** — AI generation artifact check
3. **Correct orientation and ratio** — portrait 1008 × 1792 (true 9:16, OpenArt 1k preset or Higgsfield 9:16 / 2k). All pre-v2.5 grandfathered dimensions are fine alongside in-cycle.
4. **File size** — should be under 500 KB for web performance. PNG output from OpenArt at 1k is ~2 MB; `review.py`'s JPG q92 conversion (on approve) lands closer to target. If a reviewed JPG is still over 500 KB, the resize/WebP step in `promote.py` handles it — but the bulk of the size reduction is `review.py`'s work.
5. **SA authenticity** — does it look like South Africa, not California or Europe?
6. **Mood match** — does the image match the condition folder's mood?
7. **Human count matches diversity rule** — 0 humans = no diversity clause was needed; 1 human = identity specified; 2-3 humans = each identity specified, no four-group demand; 4+ humans = group boilerplate applied. The image should match the bucket the prompt was built for.
8. **Demographics vary across the cycle** — across the full cycle of this condition folder (28 day + 14 each for dawn / dusk / night), are the demographics of human subjects varied (not all the same race)?
9. **Architectural type varies across the cycle** — not all red brick, not all one type. Aim for at least 4 of the 9 canonical types represented across the 28 day-images, with no single type exceeding 6 instances total (the 3-per-14-slot-window rule).
10. **No floating objects** — common AI artifact, especially with outdoor scenes
11. **No licensed content** — no Springbok jerseys, no team kits, no brand logos, no recognizable real people, no copyrighted characters
12. **No high-risk prop text** — check car plates blank, mugs unbranded, school crests obscured, signs blank
13. **No banned mood** — no poverty, grit, dystopian, political, religious

---

## pw-image-staging pipeline (built and verified 2026-05-19)

Generated images do NOT go directly into the PW repo. They land in a staging area outside the repo, get Al's approval, then promote into the repo on a feature branch.

**Location:** `C:\Users\27741\OneDrive\Desktop\Probably weather new\pw-image-staging\` (sibling to PW repo on OneDrive)

**Structure:**
```
pw-image-staging/
├── inbox/[condition]/[time]/         ← downloads land here, named by job ID
├── reviewed/[condition]/[time]/      ← Al-approved images, sequential filename
├── batches/                          ← batch manifest JSON files + reference docs
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

### Compression & promote.py (operational note, corrected v2.6)

OpenArt's gpt-image-2 outputs PNG at ~2 MB per image (verified 2026-05-19 recon). PW's image size target is 200–500 KB. **PNG → JPG q92 compression happens at REVIEW time via `review.py`'s `to_jpg` function.** By the time files reach the `reviewed/` folder they are already JPG. `promote.py` is therefore a **pure move-and-rename operation** — it copies approved JPGs from `reviewed/<condition>/<slot>/` to `assets/images/bg/<condition>/`, renames per the slot scheme, and commits. It does NOT compress.

*(Corrected in v2.6 — v2.5 wrongly described promote.py as the compression step. The compression has always been review.py's job, on approve. If a reviewed JPG is still over 500 KB, a resize / WebP fallback in promote.py handles the residue — but the bulk of the size reduction is review.py's q92 conversion.)*

---

## Rejection feedback loop (added v2.6)

When Al rejects an image in `review.py`, the script appends one JSON line to `pw-image-staging/batches/_rejection-motifs.jsonl` capturing the slot, condition, motif (from the sidecar), scene_type, and an optional one-line reason Al types at reject time.

**When generating a REPLACEMENT batch** (e.g. a wind round 2 to refill rejected slots), the brief-writer MUST read `_rejection-motifs.jsonl` first and treat every motif listed there as an **ANTI-anchor for that bucket** — penalised harder than the standard 3-per-batch Motif Diversity rule. A motif that was just rejected should be avoided entirely in the replacement batch, or used at most once and only in a markedly different scene-type. The goal: do not regenerate the same kind of image that just got rejected.

The brief-writer must **log the applied anti-list to the replacement manifest's meta-pass section** so Al can see, at a glance, which rejected motifs were steered away from and by how much. If `_rejection-motifs.jsonl` is absent or empty, note "no prior rejections on file" in the meta-pass and proceed normally.

This loop only bites on replacement/round-2 batches. A first-pass batch for a fresh bucket has no rejection history to read.

---

## Image rotation system (planned, Phase 2)

The 28-day-day / 14-slot-time-variants cycle is the current shipping system (extended from v2.4's 14-day single cycle when v2.5 set new target counts). Phase 2 design (locked 2026-05-17) is a larger pool per condition with a Sunday-midnight Vercel cron rotating active subsets per week.

**Files (Phase 2):**
- `assets/images/manifest.json` — source of truth, every image per bucket + week pointer
- `assets/images/active.json` — runtime, this week's active set per bucket

Frontend reads `active.json`. Existing SW propagation handles instant rollout.

**Implementation deferred** until pools are full enough to launch rotation cleanly. Until then, the in-place cycle stays (extended to 28-day for day slots / 14-slot for time variants). Picker-side changes for rotation are pw-weather-logic's territory — see "Out of scope" for the picker-extension note.

### Weekly-batch composition note (NEW v2.6)

When `active.json` is composed weekly, the picker logic **must not select two images that share a motif within the same 7-day active window** — two `trampoline-airborne` wind images in one week reads as a repeat to a daily user. This is a **pw-weather-logic requirement for when rotation ships**: pw-image-system cannot enforce it directly (this skill writes briefs, it does not pick), but the rotation picker depends on motif metadata being present.

Therefore, **every brief from v2.6 onward MUST include a `motif` field in its JSON sidecar**, drawn from the canonical motif vocabulary in the Motif Diversity subsection. Pair it with a `scene_type` field so the clustering rule (same motif + same scene-type) is machine-checkable. Example sidecar:

```json
{
  "condition": "wind",
  "slot": "day_19",
  "count_bucket": "0",
  "humour_register": "humorous",
  "motif": "trampoline-airborne",
  "scene_type": "object-only-aftermath",
  "architectural_type": 8,
  "anchor_line": "Someone's trampoline is now two streets away."
}
```

Without the `motif` field in every sidecar, the rotation system has no way to space motifs across the weekly set — so this is a hard requirement on brief output, not an optional nicety.

---

## Critical Rules

1. **ALL new images must be portrait 1008 × 1792 (true 9:16)** — OpenArt `gpt-image-2` at 9:16 / 1k preset or Higgsfield at `aspect_ratio: 9:16`, `resolution: 2k`. Never landscape, never square, never 4:7. All pre-v2.5 grandfathered images (193 files at four dimension classes) stay as-is per the 2026-05-19 audit.
2. **This skill never edits the image picker code.** `setBackgroundFor()` and `getWeatherBackgroundFolder()` in `assets/app.js` are owned by pw-weather-logic. New conditions, new rotation, new aliasing, picker-extension from mod-14 to mod-28 — all require a pw-weather-logic change.
3. **Never generate images with text**, signs, or readable words. The high-risk prop blacklist extends the base negative for cars, houses, appliances, branded bottles, school items, trail markers, shop signage, magazines, newspapers, t-shirts.
4. **Never use American or European visual references** — SA aesthetic only
5. **Braai imagery = Saturday slots only** (`day_6`, `day_13`, `day_20`, `day_27`). Sunday slots (`day_7`, `day_14`, `day_21`, `day_28`) get family-lunch / lazy-Sunday content. Weekend dawn / dusk / night slots ride on the 14-slot cycle (Saturdays at `*_6` and `*_13`, Sundays at `*_7` and `*_14`).
6. **`day.jpg` is fallback only** — never use as a primary named slot
7. **Diversity instructions are count-aware** — 0 humans = omit. 1 human = specify identity directly. 2-3 humans = specify each identity directly, NO four-group boilerplate. 4+ humans = group boilerplate applies. Families must NEVER be engineered to display every population group.
8. **Negative prompts are scene-aware** — base block + high-risk prop block always. Add `artificial lighting indoors` ONLY for OUTDOOR day-slot (08:00–17:00) generations. Indoor day-slot scenes use base + prop block only (kitchen/lounge/office lamps are legitimate at midday). Dawn/dusk/night use base + prop block alone.
9. **Run the brief integrity check before generation** — visible-count matches stated count, diversity rule matches count, no engineered four-group demand in 2-3 person scenes, architectural type stated affirmatively, high-risk props worded affirmatively.
10. **Check file sizes** — images over 1 MB will slow the app, especially on mobile data. OpenArt PNGs land at ~2 MB; promote.py JPG-converts.
11. **Nationally representative** — spread SA regional references across all folders, not just Western Cape. Vary demographics across the full cycle of each condition folder.
12. **No licensed content** — no Springbok/Bafana/team kits, no brand logos, no recognizable real people, no IP characters, no named neighbourhoods in the prompt text (use them as visual anchors only).
13. **Every prompt is a moment, not a tableau** — specify what is happening, not just the setting
14. **No loadshedding as a default** — SA loadshedding has been largely resolved; only include if specifically relevant
15. **This skill never touches the weather algorithm** — image system is downstream of weather decisions
16. **OpenArt Auto Polish toggle MUST be OFF for every PW generation.** Auto Polish rewrites the v2.x brief with OpenArt's own prompt enhancement, producing unpredictable output. The brief integrity check assumes the brief lands exactly as written. Auto Polish breaks that assumption. (v2.4)
17. **Every brief must specify a moment that tells a complete micro-story.** Not a still life of a bucket signature — a small narrative beat with implied before/after. Test: the brief's one-sentence summary must contain a subject + active verb + consequence (or implied consequence). "Wind blowing through trees" fails. "Sunglasses fly off a Camps Bay jogger and skid across the boardwalk" lands. (v2.6) — *companion metadata note:* every v2.6+ JSON sidecar must also carry a `motif` field drawn from the canonical vocabulary in Motif Diversity, so the rotation system can space motifs across the weekly active set.

---

## Versioning

- **v1.0** (2026-03 to 2026-05-17) — Original canonical skill. Square 1024×1024. 7 conditions (no cold-clear, no fog listed). Leonardo only. Stale function name reference and incorrect day-of-week → day_N mapping.
- **v2.0** (2026-05-17, morning) — Portrait. Added cold-clear condition with 4 locked anchor jobs. Added Higgsfield MCP / ChatGPT Pro / Minnie generation lanes. Added moment-not-tableau prompt rule. Added pw-image-staging pipeline reference. Added image rotation system (Phase 2). Documented banned content. Folder list aligned to actual repo state (heat not hot, fog added, cold-clear new).
- **v2.1** (2026-05-17, evening) — Three surgical ship-blocker fixes from Claude Code self-eval: function name reference corrected, day-of-week mapping fixed, obsolete 7-day-vs-14-day rule dropped.
- **v2.2** (2026-05-18) — Three fixes from Claude Code self-eval + GPT-5.5 adversarial review of v2.1: diversity scoped by scene presence (later proved too coarse — see v2.3), negative prompt split into base + day-only modifier, aspect ratio reconciled to 9:16 + 2k resolution.
- **v2.3** (2026-05-19) — Two surgical fixes from GPT-5.5 adversarial review of v2.2: (a) **Diversity rule re-bucketed by count** — v2.2's "2+ humans" bucket forced a four-group demand on couples and 3-person families. v2.3 splits the bucket: Count 0 omits, Count 1 specifies identity, Count 2-3 specifies each identity directly WITHOUT four-group boilerplate, Count 4+ keeps the group boilerplate. (b) Added "Brief integrity check" prompt-discipline section.
- **v2.4** (2026-05-19, evening) — Ten-item folded update from Al's overnight-batch feedback + OpenArt platform recon. (1) Canonical dimension is now **1008 × 1792** (true 9:16, OpenArt 1k preset / Higgsfield 9:16 target). 2:3 cold-clear anchors and 19 overnight-batch 9:16/2k candidates grandfathered. (2) **Default model = `gpt-image-2`**; `nano_banana_2` reserved for promo + grandfathered set. (3) **Default quality = Medium** (35 cr/img at OpenArt); High reserved for non-UI-occluded marketing assets. (4) Auto Polish MUST be OFF (new Critical Rule #16). (5) **Architectural Variety mandate (NEW section)** — 9 canonical SA types with regional appropriateness map; bare "face-brick" / "modern suburban" / "middle-class SA home" banned (all anchor red brick); rotate at the bucket level. (6) **Humour Register (NEW section)** — curated T-table lines per bucket as mood/energy anchors, not literal scene scripts; canonical wind anchors "trees doing involuntary yoga" + "trampoline two streets away" preserved. (7) Scene-aware day-only negative — `artificial lighting indoors` modifier now fires on OUTDOOR day-slot scenes only; indoor day-slot scenes use base + prop block alone. (8) High-risk prop blacklist extends the base negative — prefer affirmative-positive phrasing over negative blocks. (9) Worktree-vs-main parity check note added at the top. (10) **Platform Knowledge section (NEW LIVING)** — OpenArt entry verified 2026-05-19 with full deep-link / credit / wall-time / quirks coverage.
- **v2.5** (2026-05-19, late) — Five-item folded update from the 2026-05-19 full filesystem audit + new target counts. **All v2.4 rules unchanged** (architectural variety, humour register, count-aware diversity, gpt-image-2 default, OpenArt platform knowledge). (1) **New target counts:** 28 day images per condition (was 14), 14 dawn / 14 dusk / 14 night per condition (was 3 each), 1 day.jpg fallback (unchanged) → **71 per bucket, ~639 across 9 buckets** at pre-launch minimum. (2) **Day-of-week mapping extended to 28-slot mod-28 rotation** — Saturday slots are now `day_6`, `day_13`, `day_20`, `day_27`; Sunday slots are `day_7`, `day_14`, `day_21`, `day_28`. Dawn / dusk / night stay on a 14-slot Mon→Sun→Mon→Sun cadence (Saturdays at `*_6` and `*_13`, Sundays at `*_7` and `*_14`). (3) **Audit-grounded bucket-by-bucket reality table replaces v2.4's "12+ more needed" stale claim** — actual filesystem state: 8 condition folders fully populated with 24 files each (193 total), cold-clear folder absent (23 in staging pipeline). 47 new slots per bucket = **~423 new images total** for full v2.5 library. Existing 193 stay untouched per Al's 2026-05-19 decision. (4) **Existing image dimensions clarification** — audit catalogued four dimension classes: 7 squares (2 in clear, 5 in wind), 3 16:9 landscapes (2 in wind + bg/default.jpg), 2 reversed-portrait (wind), 181 ~9:16-adjacent portraits at three sub-resolutions. All grandfathered; rotation system handles reconciliation post-launch. v2.4's claim of "105 v1.0 squares" was stale — the audit found 7. (5) **promote.py re-compression operational note** — PNG-from-OpenArt at 2 MB must be JPG-q85 or WebP-compressed before landing in the PW repo (target under 500 KB). Documented in pw-image-staging section so the compression step survives future maintainer rewrites. Architectural variety rotation rule re-worded for clarity at 28-slot scale (no type > 3 in any 14-slot window, so no type > 6 across 28 day slots). Image Quality Checklist items 8 and 9 wording refreshed for full-cycle scope.
- **v2.5.1** (2026-05-19) — Single surgical addition: **cold-clear humour register** subsection added to the Humour Register section. Fills the gap flagged in the v2.4 humour pull ("cold-clear has no dedicated witty bucket"). Captured from Al's review.py walkthrough of the cold-clear staging inbox: the bucket's humour is **cognitive dissonance** — the scene looks like a perfect summer day until the cold-weather signals (visible breath, frost, puffer jackets, bare jacaranda) reveal the truth. NOT slapstick, NOT accident-based. Apply to ~40% of cold-clear briefs (vs the general 30% humour rate), the other 60% quiet/contemplative. The earlier "cold-clear uses `cold` lines" note updated to point at the new subsection.
- **v2.6** (2026-05-21) — Eight-item folded update from Al's wind+heat review.py session (94 generated, motif-clustering rejections identified as the primary failure mode). All v2.5.1 rules unchanged. (1) **Motif Diversity (NEW subsection)** — canonical motif vocabularies per bucket; rule cap of 3-per-batch per motif AND no two same-motif briefs may share scene-type; canonical ★ anchors strictly once-per-batch. (2) **Critical Rule #17 (NEW)** — every brief tells a story (subject + active verb + consequence). (3) **Rotation system note** — picker must not select two same-motif images within a 7-day active.json window; all v2.6+ briefs require a `motif` field in the JSON sidecar. (4) **Brief integrity check items 6+7** — motif uniqueness, story-verb check. (5) **Cognitive-dissonance humour generalised** — register applies across buckets (heat dusk, storm intervals, fog clearing) not just cold-clear. (6) **Rejection feedback loop (NEW section)** — review.py appends rejections to _rejection-motifs.jsonl; replacement-batch brief-writer reads file as anti-anchor list. (7) **Promote.py spec corrected** — review.py does PNG→JPG-q92 at approve time; promote.py is move-and-rename only. (8) **Motif clustering refinement** — folded into Motif Diversity rule wording: prohibit same-motif + same-scene-type, allow same-motif + different-scene-type.

---

## Platform Knowledge (LIVING — Minnie updates as platforms change)

This section captures verified platform-specific knowledge for each generation lane. Future Minnie sessions update the relevant entry as platforms shift. Each entry has a last-verified date — **if it's > 60 days old, treat as stale and re-recon before batching.**

---

### Lane A — Higgsfield MCP (reserved for promo, not volume)

- **Status:** ✅ Mapped
- **Last verified:** 2026-05-19
- **Models in use:**
  - `gpt_image_2` (Image 2.0) — character continuity work, promo
  - `nano_banana_2` (Nano Banana Pro) — atmospheric landscape promo, grandfathered cold-clear set
- **API integration:** Higgsfield MCP `generate_image` tool, can fire from claude.ai or Claude Code directly
- **Parameters:** `model`, `aspect_ratio` (use `9:16`), `resolution` (use `2k`), `quality` (gpt_image_2 only — use `medium`), `count` (1-4), `prompt`
- **Credits:** ~2-10 per image depending on model + quality. Balance check via the Higgsfield MCP `balance` tool. As of 2026-05-19: 1413.64 credits remaining.
- **Quirks:** gpt_image_2 includes a `quality` parameter; nano_banana_2 does not. Both return CloudFront URLs that don't expire.

---

### Lane B — Leonardo (via Minnie)

- **Status:** ✅ Mapped (existing Minnie platform memory in `references/leonardo.md`)
- **Last verified:** prior to 2026-05-19 (platform-class JSON exists in Minnie's references/)
- **Model:** `gpt-image-2` / Image 2.0 at 66 tokens per image (Leonardo's pricing)
- **Balance as of 2026-05-19:** 138k tokens, subscription cancelling end-June 2026 — **burn-down lane**
- **Throughput:** Minnie autonomous-overnight handles batches
- **Quirks:** Negative Prompt is a separate field in Leonardo's web UI (unlike Higgsfield's inline). Minnie's automation handles this; the prompt format passed to Minnie should keep positive + negative semantically separated.

---

### Lane C — OpenArt (via Minnie) — **PRIMARY VOLUME LANE**  [VERIFIED 2026-05-19]

- **Status:** ✅ Mapped
- **Last verified:** 2026-05-19
- **Direct deep-link:** `https://openart.ai/suite/create-image/gpt-image-2`
- **Model label in OpenArt UI:** `GPT Image 2` (`New` badge). Subtitle: "OpenAI's next-gen image model".
- **Auth state:** cached at `~/.claude/skills/minnie/.auth/openart-state.json` (Minnie replays this for autonomous sessions; ~35 KB cookies + localStorage)
- **Credits per image (1k resolution, 9:16 aspect):**
  - **Low:** 5
  - **Medium:** 35  ← **PW production default**
  - **High:** 130
- **Wall-time per image:**
  - Medium: 62 s
  - High: 137 s
  - Low: faster than Medium (untested)
- **Output:**
  - Format: PNG, RGB
  - Dimensions: **1008 × 1792** (true 9:16 at 1k preset, identical across quality tiers)
  - File size: ~2 MB at any tier — requires re-compression in `promote.py` (JPG q85 or WebP convert) before landing in the PW repo
- **Output location:** NOT in the create-image right panel. Generated images land in `/suite/media` under "This Month". Autonomous flows must navigate there to retrieve.
- **Full-res URL pattern:**
  - Thumbnails: `cdn.openart.ai/thumbnail/production/...webp`
  - Full-res: `cdn.openart.ai/openart-ai/production/...png` (curl-able, no browser dialog needed)
  - Safer approach: open the lightbox and read displayed `<img src>` directly — points to full-res PNG.
- **CRITICAL: Auto Polish toggle MUST be OFF** (Critical Rule #16). Otherwise OpenArt rewrites the brief.
- **Balance check:** visible top-right of any OpenArt page. As of 2026-05-19: **26,515 credits**, ~10 days to renewal — **burn-down lane**
- **Aspect ratio control:** `Output` button in create panel → click to open. Select `9:16` preset for 1008×1792, or use "Customize Size" for exact dimensions (click lock icon "Unlock to edit size" first).
- **Image count:** 1–4 per generation. **PW always uses 1** (deterministic, easier to manage in staging pipeline).
- **Default model on `/suite/create-image`:** Nano Banana Pro. Use the explicit deep-link `/suite/create-image/gpt-image-2` to skip the model swap.
- **Quirks (verified 2026-05-19):**
  - Ref-based clicks WORK on the Image tab (improvement vs. earlier video-tab platform memory).
  - Customize Size W/H fields are DISABLED by default — click the lock icon to enable.
  - Google One Tap FedCM popup fires on every page load; harmless but persistent (dismiss with X/Escape, or use explicit Login button).
  - SSE channel disconnects periodically with `ERR_CONNECTION_RESET` on `/suite/api/server-events` — non-fatal; generation completes regardless. The "Generating" body text indicator is a more reliable completion signal.
  - Cost is debited UPFRONT on Generate click — capture balance before, fire, reconcile after.
  - "Limited-time offer! 50% off annual plans" banner is always visible at top — non-blocking, safe to ignore.
- **Cost budgeting for full PW image library at v2.5 target:** 9 condition folders × 71 slots = 639 total slots. After subtracting the 193 grandfathered images, ~423 new images at Medium = **~14,805 credits**. Current 26,515 balance covers the full new-image set 1.8× before renewal — comfortable headroom.

---

### Lane D — ChatGPT Pro (direct browser, manual paste)

- **Status:** ✅ Mapped (manual lane, no Minnie automation)
- **Last verified:** prior to 2026-05-19
- **Model:** `gpt-image-2` Thinking mode via ChatGPT.com (Al has 2× Pro accounts)
- **Unique capability:** 8 coherent images per single prompt with native character continuity. Best for: "show this SA family of 4 across 8 different daily-slot scenes in heat bucket" — same characters maintain identity across 8 images.
- **Credits:** included in Pro subscription (unlimited under fair use)
- **Output:** download via browser save (no API). Save path is Al-managed.
- **Aspect ratio:** select "Tall" option in UI for portrait.
- **Quirks:** no negative prompt field — gpt-image-2 largely ignores negatives natively. Lean entirely on positive phrasing. (This is why the v2.4 prop-blacklist section emphasises affirmative-positive over negative-block.)

---

## Reference documents

- Full T-table humour pull per condition (English): `pw-image-staging/batches/v2.4-humour-pull.md`
- OpenArt platform recon: `pw-image-staging/batches/2026-05-19-openart-recon-report.md`
- **Full filesystem audit (the audit that grounded v2.5):** `pw-image-staging/batches/2026-05-19-FULL-IMAGE-LIBRARY-AUDIT.md`
- Son-Memory project file: `Son-Memory/projects/probably-weather.md`
- 2026-05-19 cold-clear overnight batch (16 briefs at v2.3): `pw-image-staging/batches/2026-05-19-cold-clear-full-batch.md`
