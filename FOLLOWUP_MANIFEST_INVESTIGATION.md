# Follow-up — `env(safe-area-inset-top) = 0` on iOS PWA: manifest investigation

**Status:** Investigation note for the post-launch polish bundle. NOT FIXED in the Phase 2.5 hotfix — the hotfix (CSS-only 44px floor in `assets/app.css:1910`) defends against the symptom regardless of root cause. This document scopes the underlying iOS state question for a later, cleaner fix.

**Symptom Al saw on his iPhone (production build `2390e74`, slot `pw-v2026-05-12-006`):**
- "Probably Weather" title rendered behind the iOS notch.
- Tagline overlapped status bar time/signal/battery indicators.
- Save button up against the status bar.

The CSS rule at line 1910 was `padding: max(0.5rem, env(safe-area-inset-top)) ...`. On a notched iPhone in PWA standalone mode, that SHOULD resolve to ~44-48px. Al's iPhone resolved it to 8px (the 0.5rem floor), meaning iOS reported `env(safe-area-inset-top) = 0` to the page.

---

## What we know

### Meta tags (correct as of HEAD)

`index.html` head section, untouched since at least January 2026:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
<meta name="apple-mobile-web-app-capable" content="yes"/>
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
```

These are the textbook trio for "iOS PWA with translucent status bar that overlays the page". With these set:
- iOS Safari standalone mode SHOULD report `env(safe-area-inset-top) ≈ 44-48px` on notched devices.
- iOS Safari in tab mode (non-standalone) reports `env(safe-area-inset-top) = 0` because the URL bar handles its own spacing.

### manifest.json (correct as of HEAD)

```json
{
  "display": "standalone",
  "scope": "/",
  "start_url": "/",
  ...
}
```

The manifest declares `display: standalone`. Combined with `apple-mobile-web-app-capable: yes`, iOS treats the installed PWA as a standalone app.

### git history of manifest.json

```
ba0a178 2026-03-20  fix: change manifest short_name to ProbablyWeather (FIX-5)
4500e47 2026-03-06  launch prep: icons, favicon, nav active state, Twitter cards, manifest fix
56bfa32 2026-02-08  Fix icon paths and clean up manifest.json
3b0e097 2026-01-23  Update manifest.json
```

The most recent meaningful update was 2026-03-20 — six weeks before Phase 1 / 2 / 2.5. **No change to manifest in Phase 1 or Phase 2.**

### git history of `viewport-fit=cover` and `apple-mobile-web-app-status-bar-style`

Both meta tags have been in `index.html` since January 2026 (`7855f8a 2026-01-23 Enhance viewport and app settings`). Untouched in Phase 1 or 2.

### Diff `index.html` baseline vs HEAD

Phase 1 + Phase 2 changes to `index.html`:
- SA4 added preconnect + Vercel Analytics scripts.
- SA1 / SA2.5 bumped version string to 1.4.
- SA6 polish made nav buttons explicit tablist semantics.
- Phase 2 deleted duplicate "Data sources" Settings section.

**No meta-tag changes. No manifest changes. So the safe-area regression Al saw is NOT something we shipped in Phase 1 or 2.** The bug has existed at least since January 2026 in the case-where-env()-returns-0 path. Al just never noticed because his iPhone PWA was historically getting non-zero env() values.

---

## Working hypothesis: stale install context

The strongest hypothesis for why iOS now reports `env(safe-area-inset-top) = 0` to Al's iPhone:

**iOS Home Screen PWAs cache the manifest + initial HTML at install time. Some properties become "frozen" at install. If the PWA was added to the Home Screen BEFORE `viewport-fit=cover` landed (pre-2026-01-23), iOS may treat the installed app as if it doesn't want safe-area handling — and pass `env() = 0` to the running page, even if the served HTML now has `viewport-fit=cover`.**

This isn't documented behavior, but it's consistent with:
- Reports on the Apple Developer forums of PWAs that "stopped getting safe-area-inset" after meta-tag changes were deployed but the user never reinstalled.
- The fact that Al's tests on a freshly-installed PWA on a different device might give a different result.
- The fact that the SW serves new HTML on every visit, but iOS may use the manifest snapshot taken at Add-to-Home-Screen time for display-mode and status-bar decisions.

**Other candidates worth ruling out before merging this into a permanent fix:**

1. **Display-mode regression.** If at some point the manifest had `display: minimal-ui` or `browser` and got installed by Al before being corrected to `standalone`, the cached manifest could still drive `display: browser` behavior. **Falsified** — git history shows manifest has always had `display: standalone` since the earliest checked-in version.

2. **Maskable icon issue.** Some iOS bugs around safe-area are tied to icon configuration. **Unlikely** — icons declared correctly, including maskable variants.

3. **Theme-color conflict.** `theme_color` in manifest vs `meta name="theme-color"` mismatch can cause iOS to fall back to default chrome rendering. **Both set to `#1a1a2e`.** No mismatch.

4. **Al installed via "Add to Home Screen" in non-Safari (Chrome on iOS) which uses a different install path.** Less safe-area support. Worth confirming with Al which browser he installed from.

5. **iOS version specific bug.** Safe-area handling changed between iOS 16 and 17. Worth confirming Al's iOS version.

---

## What the Phase 2.5 hotfix does and doesn't do

**Does:** Defends against `env(safe-area-inset-top) = 0` by flooring the mobile `.container` padding-top at 44px. The brand/title clears the status bar area regardless of what iOS reports.

**Doesn't:** Restore the ideal "iPhone X gets exactly 44px, iPhone 14 Pro gets exactly 48px, Android gets exactly 8px" responsive behavior. The hotfix gives 44px to all small viewports unconditionally.

**Side effect:** Non-notched mobile devices (Android, iPhone SE) get ~36px more top padding than strictly needed. Acceptable visual cost for a hotfix.

---

## Recommended follow-up fix (post-launch polish bundle)

A cleaner fix uses JavaScript display-mode detection at boot to apply the 44px floor only when we know we're in a state that might give us env() = 0:

```js
// At app boot, before first paint
const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  || window.navigator.standalone === true;
if (isStandalone) {
  document.documentElement.classList.add('pwa-standalone');
}
```

Then in CSS:

```css
/* Default: rely on env() entirely */
@media (max-width: 480px) {
  .container {
    padding-top: max(0.5rem, env(safe-area-inset-top));
  }
}

/* Standalone PWA: floor at 44px in case iOS reports env() = 0 */
@media (max-width: 480px) {
  .pwa-standalone .container {
    padding-top: max(env(safe-area-inset-top, 0px), 44px);
  }
}
```

That gives:
- **Android Chrome PWA / iPhone SE PWA:** `env()` returns small or 0, floored at 44px. Tiny visual cost.
- **Notched iPhone PWA:** `env()` returns 44-48px, that wins. Exact behavior.
- **Browser tab (non-PWA):** `env()` returns 0, no floor applied. Browser chrome handles spacing.
- **Desktop:** unaffected (media query doesn't match).

### Alternative: ship JS-detected inset capture

A more aggressive fix is to measure the actual safe-area at boot via a hidden probe div and write it to a CSS custom property:

```js
const probe = document.createElement('div');
probe.style.cssText = 'position:fixed;top:0;padding-top:env(safe-area-inset-top,0px);visibility:hidden;';
document.body.appendChild(probe);
const measured = parseFloat(getComputedStyle(probe).paddingTop);
probe.remove();
document.documentElement.style.setProperty('--measured-sat', `${Math.max(measured, isStandalone ? 44 : 0)}px`);
```

Then CSS uses `var(--measured-sat)` instead of `env(safe-area-inset-top)`. This handles the "iOS lies and says 0" case explicitly.

Both approaches are post-launch polish — not needed before tester rollout. The CSS-only hotfix is enough.

---

## Questions to answer before the permanent fix

1. **Al's iOS version.** Reproduce on the same iOS version to confirm the trigger.
2. **Al's PWA install date.** If installed before 2026-01-23 (`viewport-fit=cover` landing), the stale-install hypothesis is strongest. If installed after, the hypothesis weakens — and we should look harder at iOS-specific bugs.
3. **What `display-mode: standalone` reports to JS on Al's iPhone.** If `false`, then he's not in standalone PWA mode, and `env()` returning 0 is correct iOS behavior — the real bug is elsewhere (e.g. he opened via Safari tab, not Home Screen icon).
4. **What `getComputedStyle(probe).paddingTop` resolves to with the probe pattern above, run on Al's iPhone.** Direct measurement of the actual inset iOS gives the page.

A 5-minute remote-debug session via Safari Web Inspector + Al's iPhone would resolve all four. Worth doing before deciding which permanent fix to ship.

---

## TL;DR

- Phase 2.5 hotfix is defensive — works regardless of root cause.
- Root cause is most likely a stale install state on Al's iPhone where iOS reports `env(safe-area-inset-top) = 0` to a page that asks for safe-area handling.
- Confirmed not introduced by Phase 1 or Phase 2 — bug has existed in the fallback path since at least January 2026.
- Cleaner permanent fix in post-launch polish: gate the 44px floor behind `display-mode: standalone` detection so non-PWA mobile viewports keep tight padding.
- Quick remote-debug session on Al's actual iPhone would let us pick the cleanest permanent solution with data instead of guesswork.
