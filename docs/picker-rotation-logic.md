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

Weeks run **Monday to Sunday in SAST**. The 4-week cycle is anchored to the Monday of launch week:

> **`WEEK_ANCHOR = Monday 25 May 2026, 00:00 SAST (UTC+2)`** — Sunday 24 May 22:00 UTC

Every Monday at midnight SAST, the picker rolls over to the next week folder. After week 4, it loops back to week 1. Launch day (Saturday 30 May 2026) sits inside week_1, exactly as it did under the original Saturday-anchored formula, so the week the app showed did not jump when the boundary moved (changed 2026-09-06).

| Days since anchor | Active week | Content |
|-------------------|-------------|---------|
| 0–6               | week_1      | week A  |
| 7–13              | week_2      | week B  |
| 14–20             | week_3      | week A  |
| 21–27             | week_4      | week B  |
| 28–34             | week_1 (cycle restarts) | week A |
| …                 | …           | …       |

The four folders carry a **two-week A/B cycle**: week_1 and week_3 hold week A, week_2 and week_4 hold week B (Al's set-001 curation grid, laid out on disk by `scripts/layout-set-001-grid.mjs`).

The formula in the code:

```js
const elapsed = nowMs - WEEK_ANCHOR_MS;
if (elapsed < 0) return 1;                    // before the anchor → week 1
return (Math.floor(elapsed / WEEK_MS) % 4) + 1;
```

**Why SAST and not the device clock?** Every user sees the same flip at the same instant, and that instant is a South African Monday midnight. SAST has no daylight saving, so this is plain arithmetic (UTC + 2h) and needs no timezone database.

**Why was it Saturday before?** The original 2026-05-26 picker anchored the cycle to the launch instant itself — Saturday 30 May 2026 00:00 SAST — and chose the image index at random, so the day of the week never mattered to it. The curation and humour pairing that followed were built on Monday-indexed weeks, which is why the anchor moved.

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

**The day is the index.** Within the chosen `<condition>/week_<N>/<time>/` folder, the picker serves the image whose number is the SAST weekday: **Monday = 1 … Sunday = 7**. Every open on a given day shows the same photograph for that condition and time-of-day, which is what lets a line written for that photograph (assets/hero-lines.js) stay on it, and lets a Saturday photograph carry a braai line without ever appearing on a Tuesday.

```js
const sastDay = new Date(nowMs + 2 * 60 * 60 * 1000).getUTCDay(); // 0 = Sun … 6 = Sat
return sastDay === 0 ? 7 : sastDay;
```

The same function (`getRotationDay`) feeds the condition bank's weekend and day-tag routing in app.js (`getLocationDayOfWeek`), so photograph, line and weekend rule can never disagree about what day it is.

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
3. ~~Random per-render vs deterministic~~ — resolved 2026-09-06: the index is the SAST weekday (see above).
