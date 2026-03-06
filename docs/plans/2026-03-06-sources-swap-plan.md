# Sources Content Swap — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the broken expand-down sources panel with a content swap — tapping the pill fades out the witty line and byline, fades in the source ranges, auto-collapses after 4 seconds.

**Architecture:** A `.sources-open` class on `.sidebar` drives pure CSS visibility toggling between description/byline and a new `#sourcesSwap` element. JS handles the toggle + auto-collapse timer. No positioning tricks, no z-index changes, no global listeners.

**Tech Stack:** Vanilla HTML, CSS (within existing mobile media query), vanilla JS (within existing IIFE in app.js)

**Design doc:** `docs/plans/2026-03-06-sources-swap-design.md`

---

### Task 1: Add the swap element to HTML

**Files:**
- Modify: `index.html:90-91`

**Step 1: Add the `#sourcesSwap` div between `.weather-byline` and `.card-sources`**

In `index.html`, after line 90 (`<div id="weatherByline" ...>`) and before line 91 (`<div class="card card-sources" ...>`), insert:

```html
        <div id="sourcesSwap" class="sources-swap"></div>
```

**Step 2: Verify the HTML is valid**

Open `index.html` and confirm the sidebar structure is:
1. `#description`
2. `#weatherByline`
3. `#sourcesSwap` (new)
4. `#sourcesCard`

**Step 3: Commit**

```bash
git add index.html
git commit -m "html: add #sourcesSwap element for sources content swap"
```

---

### Task 2: Add global CSS hide rule for `.sources-swap`

**Files:**
- Modify: `assets/app.css:1542-1544`

**Step 1: Add `.sources-swap` to the existing global hide rule**

At line 1542, the current rule is:

```css
.sources-toggle,
.sources-detail {
  display: none;
}
```

Change to:

```css
.sources-toggle,
.sources-detail,
.sources-swap {
  display: none;
}
```

This ensures `.sources-swap` is hidden on desktop and by default everywhere.

**Step 2: Commit**

```bash
git add assets/app.css
git commit -m "css: hide .sources-swap by default (desktop + global)"
```

---

### Task 3: Add mobile CSS for the content swap

**Files:**
- Modify: `assets/app.css` — inside the `@media (max-width: 768px)` block, after the existing `.sources-toggle` rule at line 1996-1998

**Step 1: Add the swap CSS rules**

After the existing `.sources-toggle { display: flex; }` rule (line 1996-1998) and before the closing `}` of the media query (line 1999), insert:

```css
  /* ── Sources content swap ── */
  .sidebar .description,
  .sidebar .weather-byline,
  .sidebar .sources-swap {
    transition: opacity 0.25s ease;
  }

  .sidebar.sources-open .description,
  .sidebar.sources-open .weather-byline {
    opacity: 0;
    max-height: 0;
    overflow: hidden;
    pointer-events: none;
    margin: 0;
    padding: 0;
    transition: opacity 0.25s ease, max-height 0.2s ease 0.1s;
  }

  .sources-swap {
    text-align: right;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.6;
    white-space: pre-line;
    color: rgba(255,255,255,0.92);
    text-shadow: 2px 2px 6px rgba(0,0,0,0.95);
  }

  .sidebar.sources-open .sources-swap {
    display: block;
  }

  .sidebar.sources-open .sources-arrow {
    transform: rotate(180deg);
  }
```

**Why these specific properties:**
- `opacity 0 + max-height 0` on description/byline: fades out AND collapses space so `.sources-swap` sits where they were
- `pointer-events: none`: prevents invisible elements catching taps
- `transition delay on max-height`: opacity fades first (0.25s), then space collapses (after 0.1s delay) for smooth feel
- `.sources-swap` styling: matches the existing `.weather-byline` font treatment (12px, 600 weight, right-aligned, text-shadow)
- `.sources-open .sources-arrow`: flips the arrow, replaces the old `.card-sources.expanded` rule

**Step 2: Remove the old `.card-sources.expanded` rules that are now unused**

Delete lines 1963-1965 (the old arrow rotation):
```css
  .card-sources.expanded .sources-toggle .sources-arrow {
    transform: rotate(180deg);
  }
```

Delete lines 1968-1981 (the old `.sources-detail` expand panel — this was the broken approach):
```css
  .sources-detail {
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.3s ease, padding 0.3s ease;
    padding: 0 10px;
    background: rgba(0,0,0,0.5);
    border-radius: 0 0 12px 12px;
    margin-top: -4px;
  }

  .card-sources.expanded .sources-detail {
    max-height: 120px;
    padding: 8px 10px 8px;
  }

  .sources-detail .value {
    font-size: 11px;
    font-weight: 500;
    line-height: 1.5;
    white-space: pre-line;
    text-align: right;
    color: rgba(255,255,255,0.92);
  }
```

**Step 3: Commit**

```bash
git add assets/app.css
git commit -m "css: add mobile content swap rules, remove old expand panel"
```

---

### Task 4: Update JS — renderSidebar() populates #sourcesSwap

**Files:**
- Modify: `assets/app.js:786-787`

**Step 1: Add a third `safeText` call to `renderSidebar()`**

At line 786-787, the current code is:

```js
    safeText($('#confidenceValue'), text);
    safeText($('#confidenceValueDesktop'), text);
```

Add a third line after:

```js
    safeText($('#confidenceValue'), text);
    safeText($('#confidenceValueDesktop'), text);
    safeText($('#sourcesSwap'), text);
```

**Step 2: Commit**

```bash
git add assets/app.js
git commit -m "js: populate #sourcesSwap in renderSidebar()"
```

---

### Task 5: Update JS — replace click handler with swap + auto-collapse

**Files:**
- Modify: `assets/app.js:772-777`

**Step 1: Replace the toggle handler**

The current handler at lines 772-777 is:

```js
  // Sources tap-to-expand (mobile only — CSS hides toggle on desktop)
  const sourcesToggle = $('#sourcesToggle');
  const sourcesCard = $('#sourcesCard');
  if (sourcesToggle && sourcesCard) {
    sourcesToggle.addEventListener('click', () => { sourcesCard.classList.toggle('expanded'); });
  }
```

Replace with:

```js
  // Sources tap-to-swap (mobile only — CSS hides toggle on desktop)
  const sourcesToggle = $('#sourcesToggle');
  const sidebarEl = document.querySelector('.sidebar');
  let sourcesTimer = null;
  if (sourcesToggle && sidebarEl) {
    sourcesToggle.addEventListener('click', () => {
      const opening = !sidebarEl.classList.contains('sources-open');
      if (sourcesTimer) { clearTimeout(sourcesTimer); sourcesTimer = null; }
      if (opening) {
        sidebarEl.classList.add('sources-open');
        sourcesTimer = setTimeout(() => { sidebarEl.classList.remove('sources-open'); sourcesTimer = null; }, 4000);
      } else {
        sidebarEl.classList.remove('sources-open');
      }
    });
  }
```

**Why this works:**
- `opening` checks current state before toggling — avoids race conditions with the timer
- `clearTimeout` on every tap — prevents stale timers from previous taps
- Opening: adds class + starts 4s auto-collapse
- Closing (re-tap): removes class + clears timer
- No global listeners, no DOM creation, all contained in the existing IIFE scope

**Step 2: Commit**

```bash
git add assets/app.js
git commit -m "js: sources pill swaps content with 4s auto-collapse"
```

---

### Task 6: Bump service worker and push

**Files:**
- Modify: `sw.js:1-7`

**Step 1: Bump SW version to v9**

Change:
```js
const SW_VERSION = 'pw-v8';
```
To:
```js
const SW_VERSION = 'pw-v9';
```

Update the comment header to match.

**Step 2: Commit all remaining changes and push**

```bash
git add sw.js
git commit -m "chore: bump SW to v9 for sources swap release"
git push origin main
```

**Step 3: Verify deployment**

After Vercel auto-deploys (~30s), verify:
```bash
curl -sL "https://www.probablyweather.co.za/sw.js" | head -3
```
Expected: Shows `pw-v9`

```bash
curl -sL "https://www.probablyweather.co.za/assets/app.js" | grep -c "sources-open"
```
Expected: Non-zero (confirms new JS is live)

```bash
curl -sL "https://www.probablyweather.co.za/index.html" | grep -c "sourcesSwap"
```
Expected: Non-zero (confirms new HTML element is live)

---

## Summary

| Task | File | What |
|------|------|------|
| 1 | index.html | Add `#sourcesSwap` element |
| 2 | app.css | Add `.sources-swap` to global hide rule |
| 3 | app.css | Mobile swap CSS + remove old expand CSS |
| 4 | app.js | Populate `#sourcesSwap` in renderSidebar() |
| 5 | app.js | New click handler with auto-collapse timer |
| 6 | sw.js | Bump to v9, push, verify deployment |
