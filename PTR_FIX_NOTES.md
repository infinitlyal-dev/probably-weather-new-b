# PTR affordance — visible-at-rest bug fix

**Date:** 2026-05-11 evening (follow-up to `74cae95`)
**Commit:** [`daef94b`](https://github.com/infinitlyal-dev/probably-weather-new-b/commit/daef94b) — `fix(ptr): pill must be invisible at rest`
**Branch:** `main` (HEAD `daef94b`, SW `pw-v2026-05-11-010`, 257/257 tests)

---

## The bug

Al's screenshot (2026-05-11 evening, post `74cae95` deploy) showed the `#ptrAffordance` pill **permanently visible at the top of the home screen**, overlapping "Somerset West, Western Cape" / Save button / Language button, with the "Pull to refresh" text wrapping onto two lines because the container was too narrow.

Expected behaviour: invisible at rest. Slides in from above only when the user starts pulling down at `scrollY === 0`. Snaps back to invisible after release.

## Root cause

In commit `74cae95` I wrote:

```css
.ptr-affordance {
  position: absolute;
  top: -64px;
  /* ... */
}
```

And mounted the pill as a child of `#home-screen` (which I gave `position: relative` to anchor it).

`#home-screen` is a flex column inside `.container`. Its top edge is wherever the brand title sits. `top: -64px` from there put the pill 64px above the brand title — exactly in the header area, fully inside the viewport.

Compounding issues:
- No `opacity: 0` / `visibility: hidden` / `pointer-events: none` at rest. The pill was just `pointer-events: none`, which prevented tap-blocking but not VISIBLE display.
- No `white-space: nowrap` or `min-width` on the pill. The container was sized to fit content via default flex sizing, but with the spinner + text + padding it couldn't fit "Pull to refresh" on one line in the cramped space between brand title and Save button → text wrapped.

## My verification gap

In the prior commit's "verified in preview" section, I wrote:

> `#ptrAffordance` div is in the DOM after page load

That was **the bug itself, not a passing test**. The pill existing in the DOM at page load doesn't mean it's invisible — it means it exists. The right gate would have been "pill is invisible at rest" — confirmed via computed-style assertion of `opacity:0` AND `visibility:hidden` AND a hit-test at the top of the viewport returning the header content, not the pill.

Al was right to flag this.

## The fix

### CSS (`assets/app.css`)

- `position: absolute` → `position: fixed` (viewport-anchored, not bound to home-screen's positioning context)
- `top: -64px` → `top: max(8px, env(safe-area-inset-top))` (only relevant when visible)
- `transform: translateX(-50%)` → `transform: translate(-50%, var(--ptr-slide))` with `--ptr-slide: -160px` default (offscreen above viewport)
- Added: `opacity: 0`, `visibility: hidden`, `pointer-events: none` at rest
- Added: `white-space: nowrap` (prevents the longest 5-language string from wrapping)
- Added: `min-width: 260px` (sized for "Tlohela ho ntjhafatsa" / Sotho release + spinner + padding); `max-width: calc(100vw - 2rem)` for sub-300px viewports
- New `.ptr-affordance.ptr-active` rule that flips `opacity: 1` + `visibility: visible`. JS toggles this only during a pull gesture.
- Transition: `visibility 0s linear 0.25s` on exit so the slide-up completes before the element leaves the a11y tree; `visibility 0s linear 0s` on entry (immediate).
- Removed: `position: relative` from `#home-screen` (no longer needed since pill is fixed, not absolute).

### JS (`assets/app.js` `setupPullToRefresh`)

- Pill mounted on `document.body`, NOT inside `#home-screen`. The original child-of-home-screen mounting was the source of the positioning context bug.
- `touchmove` with `dy > 0` calls `showActive()` — adds `.ptr-active` class AND sets inline `opacity: 1` / `visibility: visible` (belt-and-braces against any cascade weirdness in any browser).
- `touchmove` updates `--ptr-slide` CSS variable inline; the CSS transform reads `var(--ptr-slide)` so finger tracking works.
- `touchend` snap-back: `removeProperty('--ptr-slide')` → CSS transitions back to default `-160px` (offscreen). `setTimeout(HIDE_TRANSITION_MS + 50)` removes `.ptr-active` and clears inline opacity/visibility once the slide-up finishes — so the pill leaves the a11y tree only after it's visually gone.

## Verification this time

This is what should have been the gate previously:

**Preview, computed styles at page load:**
- `opacity: "0"` ✓
- `visibility: "hidden"` ✓
- `pointer-events: "none"` ✓
- `position: "fixed"` ✓
- `transform: matrix(...)` placing rect at `top = -152px` (above viewport) ✓
- Mounted on `<body>`, not `#home-screen` ✓

**Hit-test at viewport top** (y = 10, 20, 40, 60, 80px, x = viewport center):
- Returns `DIV.brand-title` / `DIV.brand-text` / `HEADER.header` ✓
- Pill never appears in `elementFromPoint` results ✓
- Pill never appears in `elementsFromPoint` results either ✓

**Tests:** 257/257 passing (244 → 257, +13 new hidden-at-rest assertions).

**Screenshot:** preview tool's screenshot endpoint timed out (same quirk as the wind banner work). Inspection via `getBoundingClientRect` + `elementFromPoint` is functionally equivalent for the "is anything visible where it shouldn't be?" question — and both confirm the pill is invisible.

**One thing the preview couldn't fully verify:** the slide-down transition when `.ptr-active` is added. The preview tool's `getComputedStyle` has a known stale-cache quirk on dynamically-created elements (hit this same wall during the wind banner work). The CSS rule has higher specificity and is correctly in the stylesheet; the JS now also sets inline `opacity: 1` / `visibility: visible` as belt-and-braces. Real iOS Safari and Chrome will compute the cascade normally. Al will verify on his iPhone.

## What I learned

- **"Element exists in DOM" is not equivalent to "element is visible."** Future preview-verification checklists for any UI work must specifically assert `getComputedStyle.opacity` AND `visibility` AND a hit-test at the expected/unexpected coordinate.
- **`position: absolute` + child of a complex container = positioning surprises.** Should have used `position: fixed` from the start — viewport-anchored overlays are simpler to reason about and don't inherit parent layout quirks.
- **Belt-and-braces inline styles (when cascade is the contract).** If a class-driven CSS rule is load-bearing for visibility, also set inline styles from JS to avoid any environment where cascade behaves unexpectedly. The cost is small (two lines of JS); the safety is total.

## Test count

| Phase | Tests |
|---|---|
| Pre-refresh (Phase B-2) | 202 |
| Refresh behaviour first cut (`74cae95`) | 244 (+42) |
| **PTR visible-at-rest fix (`daef94b`)** | **257 (+13)** |
