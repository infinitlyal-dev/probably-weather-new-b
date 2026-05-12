# DESIGN_AUDIT_FINDINGS.md

> Drift between `DESIGN.md` and the shipped UI that was NOT applied as a low-risk fix.
> Categorised P0 (anti-slop / brand violation), P1 (consistency, real-user pain), P2 (nice-to-have refinement).
> SA6 deliberately deferred everything below to keep this PR visual-polish-only.

---

## P0 — anti-slop or brand-protection drift

### P0-1 Settings panel uses opaque white surface and `#111` body text
**File:** `assets/app.css:1068–1091, 1124–1127`
The settings selects render `background: rgba(255,255,255,0.95)` with `color: #111` and option text `color: #111; background: #fff`. The labels in `.settings-option label` are also `color: #111`. DESIGN.md §4 / §5 / §8.2: surfaces in PW are translucent glass over a photograph, body text is `--brand-cream` (`#FFF8F0`). This row is the one place the app drops into a hard-light "form UI" look — inconsistent with the rest of the screen panel system.
**Why deferred:** Touching this risks unreadable selects on light photos (the current "iOS-form" treatment was likely a contrast workaround). Needs a designed glass-select pattern (translucent dark surface, light text, custom chevron) before swapping.
**Fix sketch:** Build a `.settings-option select` variant that uses `var(--panel-bg)` with the existing pill/control radius and inherits cream body text.

### P0-2 Heat-state screen title uses `.description`'s orange
**File:** `assets/app.css:496`
`body.weather-heat .screen-title { color: #ff8c42; }` shares the same `#ff8c42` as the (also-hardcoded) `.description` colour at line 295. On hot days both elements sing the same loud orange and the visual hierarchy collapses. DESIGN.md §4 weather-state tints expect screen titles to be slightly *less* saturated than condition labels, not match them.
**Why deferred:** Picking the new heat-title tint needs a screenshot pass to confirm legibility on the heat-condition backgrounds.

---

## P1 — consistency / real-user pain

### P1-1 `.description` colour ignores weather-state tint system
**File:** `assets/app.css:295`
The condition headline (e.g. "Dit reën", "Storm coming") is hardcoded to `#ff8c42`. On a rain day with a rain-tinted body palette, the orange "Dit reën" headline fights the blue-shifted body text. Per DESIGN.md §4, the description should pick up a state-aware tint the same way `.screen-title` does.
**Fix sketch:**
```css
.description { color: var(--description, #ff8c42); }
body.weather-rain { --description: #b3e5fc; }
body.weather-cold { --description: #b3e5fc; }
body.weather-storm { --description: #d1c4e9; }
body.weather-clear { --description: #ffd54f; }
body.weather-heat { --description: #ff8c42; } /* keep the existing orange */
```

### P1-2 Hi/Lo colours may fall below AA on bright-sun photos
**File:** `assets/app.css:264, 271`
`#ff6b6b` (hi) on a backlit-cloud or pale-Karoo photo gives ~3.4:1 contrast even with the text shadow. `#5ddfff` (lo) is worse on the brightest dawn/day frames. The text-shadow currently masks this, but it's a fragile guarantee.
**Fix sketch:** Either deepen the colours (`#ff5252` / `#40c4ff`) or strengthen the scrim under the hi/lo line specifically. SA4 should adjudicate.

### P1-3 Global focus halo too dark on dark photos
**File:** `assets/app.css:4, 58–67`
`--focus-ring-shadow: rgba(0,0,0,0.85)` blends into dusk / night / storm photos where the page is already very dark. The 2px white outline still reads, but the halo is doing zero work and the focus indicator looks thinner than on light photos.
**Fix sketch:** Replace the single dark halo with a dual-ring (`0 0 0 2px rgba(0,0,0,0.85), 0 0 0 5px rgba(255,255,255,0.45)`) so there's always a contrast edge regardless of background luminance. Coordinate with SA4.

### P1-4 Tagline letter-spacing not tabular-aware
**File:** `assets/app.css:204`
Tagline has `letter-spacing: 0.5px` plus a glowing white text-shadow. Combined with the system stack, in Afrikaans ("Geen Ja-Nee-Miskien-weer meer.") the hyphens get visually swallowed by the glow. Low risk to drop letter-spacing on the tagline only, but better to test against all 5 languages first.

### P1-5 Settings option label override fights weather-state body colour
**File:** `assets/app.css:1071`
`.settings-option label { color: #111 }` exists because the surrounding `.settings-option select` is white. Bound up with P0-1. The label should inherit the panel's body colour once the surface is glassed.

### P1-6 Two "screen panel" radii inconsistent with DESIGN.md §6 radii table
**File:** `assets/app.css:1077 (border-radius: 20px on selects), 1141 (border-radius: 20px on .loader), 1438 (20px), 1457 (20px)`
DESIGN.md proposes `12px control / 16px card / 10px chip / 999px pill`. The codebase uses an undocumented `20px` for selects and the loader. Either DESIGN.md should add `--radius-large: 20px`, or these elements should drop to 16px. Defer until SA-coordinated.

### P1-7 `.recent-item::before` colour was opaque dark on glass (FIXED in this PR)
Was `color: #111`. Now `color: currentColor; opacity: 0.6`. Listed here for the record.

### P1-8 `.skip-link` partial radius
**File:** `assets/app.css:52`
`border-radius: 0 0 4px 0` makes the skip-link look nested into the top-left corner — intentional and fine, but worth documenting as a deliberate exception so a future "tidy" doesn't normalise it to 4px all-round.

---

## P2 — nice-to-have

### P2-1 No CSS custom-property tokens for the design system
**File:** `assets/app.css:1–6`
Only `--font-system`, `--focus-ring`, `--focus-ring-shadow`, `--panel-bg` exist as tokens. The brand colours, radii, motion durations, and weather-state tints are all inline literals scattered across 3088 lines. DESIGN.md gives them names (`--brand-sun`, `--radius-pill`, etc.). A future refactor PR could land these tokens without behaviour change — find/replace, no visual diff.

### P2-2 Motion durations inconsistent (0.12s / 0.2s / 0.25s / 0.3s / 0.32s)
**File:** scattered (`assets/app.css:143, 285, 407, 434, 950, 1117, 1418, 1460, 2283, 2294, 2304, 2320, 2354, 2648, 2693`)
DESIGN.md §6 nominates 0.2s/0.3s/0.32s. The codebase has at least five durations in use, mostly close to spec but the `0.12s` on `.install-banner-install` and `0.25s` on some screen-transition opacities are outliers.

### P2-3 Easings: most use plain `ease`; one uses the cubic-bezier
**File:** `assets/app.css:143, 434, 950, 1418, 2648`
Only the install banner uses `cubic-bezier(0.2, 0.8, 0.2, 1)`. DESIGN.md positions that easing as the "considered" curve; the rest stay on `ease`. Fine as-is, but if a future polish pass wants more deliberate motion, that bezier is the brand curve to reach for.

### P2-4 Text shadows for type-on-photo vary in opacity (0.5–0.9)
**File:** scattered (`.tagline` 0.5; `.headline` 0.9; `.temp` 0.9; `.weather-byline` 0.9; `.screen-title` 0.5)
Two clusters: "important" type uses 0.9, "less critical" uses 0.5. Working as intended, but `.screen-title` at 0.5 is the weakest legibility line of the system. Could be bumped to 0.7 without losing the elegance.

### P2-5 Tabular-nums could include forecast row numerics
**File:** `assets/app.css:29–30`
`.temp, .temp-hilo, .h-temp, .d-high, .d-low, .h-rain, .d-rain, .h-wind, .h-uv, .ds-low, .ds-high` are tabular. Some hourly/weekly forecast cells (`.h-rain`, `.d-rain` are covered; UV cell classes look covered too) — verify nothing in the hourly/weekly grid is non-tabular.

### P2-6 The `linear-gradient(135deg, #FFDD44, #FFAA00)` literal appears 5+ times
**File:** `assets/app.css:2666, 2683, 2854, 2887, 3000`
Future P2-1 token (`--gradient-sun`) makes this single-source.

### P2-7 Brand "amber" `#F5A623` appears as inline style in index.html
**File:** `index.html:289`
Tokens would also clean this up.

---

## Out-of-scope for SA6 (other agents own these)

- Copy strings / translations / Ja-Nee-Miskien voice → SA5 / `pw-ui-copy`
- Weather emoji and icon system → SA2
- Share button / OG image → SA3
- A11y contrast adjudication (P1-2, P1-3) → SA4
- Service worker / cache → SA1 / `pw-deploy`

## Summary

- **P0:** 2
- **P1:** 8 (one already fixed)
- **P2:** 7
- **Total drift items:** 17
