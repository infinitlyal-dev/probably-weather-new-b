# Sources Content Swap — Design

## Problem

The "4 sources" pill on mobile is visible and tappable, but the expanded source data has nowhere to display. The sidebar is fixed to the bottom-right, ~12px above the nav bar. Expanding content downward puts it behind the nav (z-index 100 > sidebar's 50). Expanding upward overlaps the witty line and byline.

## Solution: Content Swap

When the user taps the pill, the witty line (`.description`) and stats byline (`.weather-byline`) fade out and source range data fades in — same space, no layout shift. Auto-collapses after 4 seconds. Tap again to dismiss early.

### Visual States

**Collapsed (default):**
```
"Lekker braai weather"       <- .description
Wind 5 | Rain 0 | UV 6      <- .weather-byline
[4 sources v]                <- .sources-toggle
```

**Expanded:**
```
Open-Meteo: 15-23            <- #sourcesSwap
WeatherAPI: 14-22
MET Norway: 16-24
Pirate Wx: 15-23
[4 sources ^]                <- arrow flipped
```

## Changes

### HTML (index.html)

Add one new `<div>` as a direct child of `.sidebar`, between `.weather-byline` and `.card-sources`:

```html
<div id="sourcesSwap" class="sources-swap"></div>
```

### CSS (app.css — mobile media query only)

Toggle driven by `.sources-open` class on `.sidebar`:

- `.sources-swap` — hidden by default (display: none)
- `.sidebar.sources-open .description` — hidden
- `.sidebar.sources-open .weather-byline` — hidden
- `.sidebar.sources-open .sources-swap` — visible, right-aligned, white text
- `.sidebar.sources-open .sources-arrow` — rotate 180deg
- Crossfade via opacity transition (~0.25s)
- Desktop: `.sources-swap` stays `display: none` (added to the global hide rule)

### JS (app.js)

1. `renderSidebar()` — also populate `#sourcesSwap` with the source range text
2. Click handler — toggle `sources-open` on `.sidebar` instead of `expanded` on `#sourcesCard`
3. Auto-collapse — `setTimeout` removes `sources-open` after 4000ms; cleared on re-tap

### What this avoids

- No position: absolute or z-index changes (caused previous failures)
- No global event listeners like document.addEventListener (caused app hang)
- No runtime DOM creation (swap element exists in HTML, pre-populated during render)
- Desktop layout completely unaffected

### Edge cases

- Fewer than 4 sources: renderSidebar() already handles (filters valid temps, falls back to confidence key)
- Screen navigation: timer runs out naturally, no cleanup needed
- Rapid tapping: each tap clears previous timer, or collapses if already open
