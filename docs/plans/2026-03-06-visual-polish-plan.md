# Visual Polish Plan — Probably Weather

## Audit Summary

The app looks good but has accumulated design inconsistencies:
- **Glass panels:** 5 different border-radius values (12-20px), 4 blur values (8-16px), 10+ opacity levels
- **Typography:** No standard scale, mixed units
- **Spacing:** Mixed px/rem, no consistent rhythm

## Approach

CSS-only changes in `app.css`. No HTML structure changes. No JS changes. No functionality changes. Organized by screen, highest impact first.

## Phase 1: Global Consistency Pass (standardize glass + spacing tokens)

**What:** Unify glass panel treatment across the app without changing the look.

Pick 3 tiers and apply consistently:
- **Glass-subtle:** blur(8px), bg rgba(255,255,255,0.08), border rgba(255,255,255,0.12), radius 12px
- **Glass-standard:** blur(12px), bg rgba(255,255,255,0.12), border rgba(255,255,255,0.15), radius 16px
- **Glass-heavy:** blur(16px) saturate(120%), bg rgba(255,255,255,0.15), border rgba(255,255,255,0.18), radius 16px

Changes:
- `.card` (line 254): keep blur(16px), standardize radius to 16px (was 20px)
- `.glass-panel` (line 350): keep blur(16px), standardize shadow
- `.hourly-card, .daily-card` (line 453): standardize radius to 12px (already 12px, OK)
- `.hourly-row.hourly-header` (line 543): keep blur(8px), standardize radius to 8px (already 8px, OK)
- `.search-screen` (line 705): standardize to blur(12px) (already 12px, OK)
- `.section ul li` (line 1218): standardize radius to 12px (was 15px)
- `.hourly-card detail` (line 1281): standardize radius to 12px (was 15px)
- `.daily-card detail` (line 1334): standardize radius to 12px (was 15px)
- Mobile sidebar card (line 1907): standardize radius to 12px (was 14px)
- Buttons (`.save-btn`, `.cancel-btn`, `.manage-btn`): keep radius 20px (pill shape, intentional)

## Phase 2: Settings Screen (highest-priority polish area per brief)

**What:** Make Settings feel premium and consistent with rest of the app.

Changes:
- Section headers (`h3`): add letter-spacing 0.5px, slightly lighter opacity (0.85), add 4px bottom margin for breathing room
- `.settings-option`: increase vertical padding slightly (0.5rem -> 0.6rem), standardize border-bottom opacity to 0.12
- `.settings-option select`: standardize border-radius to 8px, consistent bg opacity 0.12
- Toggle/checkbox: ensure consistent sizing with the select elements
- About section: reduce line-height to 1.5, add slightly smaller font (0.85rem), improve spacing between paragraphs
- Section gaps: standardize gap between sections to 1.5rem

## Phase 3: Home Screen — Subtle Refinements

**What:** Tighten top-area spacing, de-emphasize Save button.

Changes:
- `.tagline`: reduce margin-bottom slightly (less gap before hero)
- `.save-current-btn`: reduce opacity to 0.7 (from 1.0), add hover-to-full-opacity
- `.brand-title` + `.brand-location`: tighten gap slightly
- No changes to hero temp, headline, sidebar, or sources pill

## Phase 4: Hourly + 7-Day Screens

**What:** Tighten row rhythm, standardize alignment.

Changes:
- `.hourly-row`: standardize padding to 10px 8px (was 12px 8px), consistent gap
- `.daily-row`: match padding rhythm with hourly
- Header rows: ensure consistent font-size 0.7rem and font-weight 600
- `.day-badge`: standardize radius to 4px, font-size 0.6rem (already close)
- Row borders: standardize bottom-border opacity to 0.08 (very subtle)

## Phase 5: Search Screen

**What:** Tighten vertical looseness.

Changes:
- `.search-screen .screen-panel-header`: reduce bottom padding
- `.search-screen #searchInput`: tighten margin/padding
- `.section h3`: reduce margin-bottom slightly
- Result rows: standardize to 12px radius (matching Phase 1)

## Phase 6: Bottom Nav (minimal)

**What:** Slightly improve active state clarity.

Changes:
- Active nav button: add subtle bottom-border or opacity change (2px solid rgba(255,255,255,0.5))
- Inactive buttons: ensure consistent opacity (0.6)
- Active: opacity 1.0

## What I Will NOT Touch

- Background image system
- Weather logic / data flow
- Navigation behavior
- Source expand/collapse (just fixed, working)
- Touch targets (will not shrink anything)
- Hero temperature dominant scale
- Weather-state color system
- Particle animations
- Service worker
- Any JS files

## Implementation Order

1. Phase 1 (global glass) — establishes consistent baseline
2. Phase 2 (settings) — highest visual impact
3. Phase 3 (home) — subtle, careful
4. Phase 4 (hourly + 7-day) — row rhythm
5. Phase 5 (search) — tightening
6. Phase 6 (nav) — minimal final touch

Each phase gets its own commit. Preview verified between phases.
