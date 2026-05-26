# Background Image Picker — Rotation Logic

**Plain-English explainer of how Probably Weather decides which background image to show. Reviewable by a non-coder.**

---

## The shape of the image library

Every condition has its own folder. Each folder is split into 4 weekly batches. Each batch is split into 4 time-of-day slots. Each slot holds 7 numbered images.

```
assets/images/bg/
├── clear/
│   ├── week_1/
│   │   ├── dawn/        ← 1.webp … 7.webp
│   │   ├── day/         ← 1.webp … 7.webp
│   │   ├── dusk/        ← 1.webp … 7.webp
│   │   └── night/       ← 1.webp … 7.webp
│   ├── week_2/  (same shape)
│   ├── week_3/  (same shape)
│   └── week_4/  (same shape)
├── cloudy/   (same shape)
├── cold/
├── cold-clear/
├── fog/
├── heat/
├── rain/
├── storm/
└── wind/
```

Total: **9 conditions × 4 weeks × 4 time-slots × 7 images = 1,008 images.**

---

## How the week is chosen

The 4-week cycle is anchored to one fixed moment in time:

> **`LAUNCH_DATE = Saturday 30 May 2026, 00:00 SAST (UTC+2)`**

Every Saturday at midnight SAST, the picker rolls over to the next week. After week 4, it loops back to week 1.

| Days since launch | Active week |
|-------------------|-------------|
| 0–6               | week_1      |
| 7–13              | week_2      |
| 14–20             | week_3      |
| 21–27             | week_4      |
| 28–34             | week_1 (cycle restarts) |
| 35–41             | week_2      |
| …                 | …           |

The formula in the code:

```js
const elapsed = Date.now() - LAUNCH_DATE_MS;
if (elapsed < 0) return 1;                    // before launch → week 1
return (Math.floor(elapsed / WEEK_MS) % 4) + 1;
```

**Why anchored to a fixed UTC moment?** So every user worldwide sees the same week flip at the same instant. SA users see Saturday-midnight SAST, UK users see Friday-22:00 BST — but it's the same global flip.

---

## How the time-of-day is chosen

The picker calls the existing `getTimeOfDay()` helper. It buckets the current local time at the user's searched location:

| Slot   | Hours (when sunrise/sunset is known) | Hours (fallback) |
|--------|---------------------------------------|------------------|
| dawn   | 45min before sunrise → 30min after    | 05:00 – 08:00    |
| day    | 30min after sunrise → 45min before sunset | 08:00 – 17:00 |
| dusk   | 45min before sunset → 15min after     | 17:00 – 20:00    |
| night  | everything else                       | 20:00 – 05:00    |

This logic was **not changed** in this rewrite — same code path as before.

---

## How the specific image is chosen

Within the chosen `<condition>/week_<N>/<time>/` folder, the picker picks a random integer 1..7. Each page render gets a fresh random pick, so refreshing the page swaps the image. The service worker caches each WebP after first load, so re-shows are instant.

---

## The fallback chain

If a file is missing or 404s, the picker walks four steps in order. Each step only fires when the previous step actually failed.

1. **Primary pick** — `assets/images/bg/<condition>/week_<N>/<time>/<r>.webp`
2. **Week-1 collapse** — `assets/images/bg/<condition>/week_1/<time>/1.webp` (same condition, same time, first image of week_1)
3. **Sibling-folder fallback** — `assets/images/bg/<fallback>/week_1/<time>/1.webp`
   - `cold` falls back to `cloudy`
   - everything else falls back to `clear`
4. **Final guard** — `assets/images/bg/default.jpg` (the only condition-agnostic image that's guaranteed to exist; kept as JPG because the file pre-exists from before the WebP migration)

Each fallback step is logged to the browser console with the prefix `[Image picker]` when it actually fires. The happy path (step 1 succeeds) logs nothing about fallbacks — just the chosen path.

---

## Defensive clamping

If something upstream passes a garbage value, the picker substitutes safe defaults rather than producing an undefined-segment URL:

| Bad input              | Substituted with |
|------------------------|------------------|
| empty / null condition | `clear`          |
| unknown time-of-day    | `day`            |
| week outside 1..4      | `1`              |
| index outside 1..7     | `1`              |
| NaN week or index      | `1`              |

This means even a totally broken weather payload won't produce a broken URL — it'll fall through to `clear/week_1/day/1.webp`, which is guaranteed to exist after promote.

---

## What was NOT changed

- `getTimeOfDay()` — same solar-aware logic as before.
- `getWeatherBackgroundFolder()` / `getWeatherBackgroundFallbackFolder()` — same alias table (`rain-possible → cloudy`, `uv → clear`, etc.). `cold-clear` is passed through unchanged because it's not in the alias table.
- `#bgImg` CSS — already had `object-fit: cover` + `object-position: center center` (lines 1670-1676 of app.css). Non-canonical-aspect images (the 9 cold-clear edge cases) render correctly with no CSS change needed.
- Service worker image-cache rule — already matches `.webp`. The cache version was bumped to `pw-v2026-05-26-001` to purge old JPG entries on the next deploy.

---

## Known open items (out of scope for this task)

1. **OG dynamic-image generation** (`api/og.js` → `getOgBackgroundPath()`) still reads `assets/images/bg/<condition>/day_1.jpg`. After promote, those JPG files will be removed and OG generation will 404. This needs a separate update synchronised with the promote step.
2. **Spec literal `<condition>/day/1.webp` fallback** — the original spec mentioned this as a "legacy fallback" but no such path exists in either the old or new structure. Interpreted as the sibling-folder fallback (step 3 above), which preserves the legacy chain's semantics.
3. **Random per-render vs deterministic-per-hour** — the spec asked for `Math.random()` per call. This means every refresh picks a different image, which can miss the SW cache. A deterministic alternative (e.g., index based on `Math.floor(localHour / 4)`) would hit the cache more reliably. Flagging for future consideration.
