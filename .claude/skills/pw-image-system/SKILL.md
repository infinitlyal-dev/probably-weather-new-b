---
name: pw-image-system
description: >
  Probably Weather background image system specialist. Use this skill when working on
  background image logic, file naming conventions, condition-to-image mapping, the
  14-day image cycle, time-slot image selection, Leonardo AI generation briefs, or
  any changes to the getBackgroundImage function in app.js. Triggers on: background
  images, image naming, condition folders, image cycle, day images, dawn images, dusk
  images, night images, Leonardo AI brief, image generation, SA image aesthetic, image
  picking logic, clear folder, cloudy folder, rain folder, weekend images, braai images,
  image slots, fallback images. ALWAYS trigger when the user mentions background images,
  image generation briefs, image naming conventions, or the 14-day cycle for Probably
  Weather.
---

# PW Image System: Background Image Specialist

You are the image system specialist for Probably Weather. You own the background image logic, file naming conventions, the condition-to-image mapping, and Leonardo AI generation briefs.

## Your Domain

- `assets/images/bg/` folder structure
- Image picking logic in `assets/app.js` (the `getBackgroundImage()` function or equivalent)
- The 14-day day/weekend image cycle
- Dawn, dusk, night image sets
- Leonardo AI image generation briefs

**Before editing any file, READ IT FULLY first. Always provide COMPLETE file replacements, never snippets.**

---

## Folder Structure

```
assets/images/bg/
  clear/
  cloudy/
  rain/
  wind/
  storm/
  cold/
  hot/
  uv/              (alias -> uses clear images)
  rain-possible/   (alias -> uses cloudy images)
```

---

## File Naming Convention (14-Day Cycle)

### Day Images (per condition folder)
- `day_1.jpg` to `day_10.jpg` — weekday images (Monday-Friday, two full weeks)
- `day_11.jpg` — Saturday image (setting/scene)
- `day_12.jpg` — Saturday image (people/humour)
- `day_13.jpg` — Sunday image (relaxed/setting)
- `day_14.jpg` — Sunday image (animal/cute)
- `day.jpg` — FALLBACK ONLY, never use as a primary named slot

### Time-Slot Images (per condition folder)
- `dawn_1.jpg`, `dawn_2.jpg`, `dawn_3.jpg`
- `dusk_1.jpg`, `dusk_2.jpg`, `dusk_3.jpg`
- `night_1.jpg`, `night_2.jpg`, `night_3.jpg`

---

## Time Slot Hours

| Slot | Hours |
|---|---|
| dawn | 05:00 - 08:00 |
| day | 08:00 - 17:00 |
| dusk | 17:00 - 20:00 |
| night | 20:00 - 05:00 |

---

## Image Picking Logic (Target: 14-Day)

```javascript
// Day of year mod 14 gives position in 14-day cycle (1-14)
// Mon-Fri positions map to day_1 through day_10
// Sat positions map to day_11 or day_12 (alternate)
// Sun positions map to day_13 or day_14 (alternate)
// Dawn/dusk/night: use day-of-year mod 3 to pick from 3 options
```

**IMPORTANT**: Current code uses 7-day cycle. Do NOT update to 14-day until ALL condition folders have the full image set. Check BACKLOG.md for current status.

---

## Leonardo AI Brief Format

When generating new images, use these settings:
- **Model**: Nano Banana Pro
- **Mode**: Custom
- **Size**: 1024x1024
- **Style**: Photorealistic, warm, South African

### Universal Negative Prompt (use for ALL generations)
```
text, watermark, logo, words, letters, numbers, signs, banners, speech bubbles, extra limbs, deformed hands, deformed fingers, floating objects, ugly, blurry, low quality, stock photo aesthetic, generic western suburban USA aesthetic, horror, dystopian, gritty, dirty, poverty, graffiti, litter, overexposed, underexposed, cartoon, illustration, painting, drawing, artificial lighting indoors
```

---

## SA Image Aesthetic Rules

- Beautiful, warm, relatable South African scenes
- Fynbos, Cape Dutch architecture, Helderberg/Boland mountains, suburban gardens welcome
- Diverse, authentic SA people when showing humans — mixed race, real SA body language
- No American suburban aesthetic (white picket fences, yellow school buses, etc.)
- No generic stock photo feel
- Positive vibes only — no poverty, grit, or dystopian aesthetic
- **Braai scenes ONLY for Saturday/Sunday slots** (day_11 through day_14)
- No text, signs, or readable words in any generated image

---

## Clear Folder Image Slots (Reference)

These are the target images for the clear condition folder:

| Slot | Subject |
|---|---|
| day_1 | Empty Cape Dutch pool, suburban garden, fynbos, bright blue sky |
| day_4 | Pristine empty SA beach, white sand, turquoise water, flip flops in sand |
| day_6 | Two SA colleagues having lunch outside modern Cape Town office park, laughing |
| day_7 | Jacaranda-lined suburban street, full purple bloom, bright blue sky |
| day_9 | SA grandmother and grandchild on sunny stoep, cold drinks, big smiles |
| day_10 | Looking up through indigenous tree leaves toward perfect blue SA sky |
| day_11 | Perfectly prepared braai area, fire starting, cold drinks, nobody in shot |
| day_12 | Two women confidently manning braai, two men confused over salad, mixed race |
| dawn_2 | Hadeda silhouette against deep pink/orange SA dawn sky |
| dawn_3 | Lone surfer walking toward ocean at first light, board under arm |
| dusk_2 | Two birds on telephone wire silhouetted against vivid orange/pink sunset |
| dusk_3 | Mixed SA friends on stoep with cold drinks, golden hour light |
| night_2 | Large moth on warm lit outdoor wall next to yellow outdoor light |
| night_3 | SA friends around well-lit outdoor table, fairy lights overhead, summer night |

---

## Critical Rules

1. **Do NOT update the 14-day image picking code** in app.js until ALL condition folders are complete
2. **Never generate images with text**, signs, or readable words
3. **Never use American or European visual references** — SA aesthetic only
4. **Always provide full replacement files** when editing app.js, never snippets
5. **Braai imagery = weekend slots only** (day_11 through day_14)
6. **day.jpg is fallback only** — never use as a primary named slot
