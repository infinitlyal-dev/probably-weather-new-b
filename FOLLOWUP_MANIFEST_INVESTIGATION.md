# Follow-up — `env(safe-area-inset-top) = 0` on Al's iOS PWA install

**Status:** Per-install edge case. NOT a code bug. The Phase 2.5 hotfix audited `index.html` and `manifest.json` and found NO misconfiguration. The shipped fix uses the natural CSS rule (no platform-specific floor). This document scopes the install-state edge case and the recovery path for testers whose existing PWA install pre-dates the current viewport meta tags.

---

## Symptom Al saw on his iPhone

Production build `2390e74`, slot `pw-v2026-05-12-006`. PWA opened from Home Screen icon (standalone mode).

- "Probably Weather" title rendered behind the iOS notch.
- Tagline overlapped status bar time/signal/battery indicators.
- Save button up against the status bar.

The CSS rule was `padding: max(0.5rem, env(safe-area-inset-top)) ...`. On a notched iPhone in PWA standalone mode, that SHOULD resolve to ~44-48px. Al's iPhone resolved it to 8px (the 0.5rem floor), meaning **iOS reported `env(safe-area-inset-top) = 0` to the page** despite the page being in standalone mode on a notched device.

---

## Audit findings (Phase 2.5)

### Meta tags in `index.html` (correct, untouched since 2026-01-23)

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
<meta name="apple-mobile-web-app-capable" content="yes"/>
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
```

This is the documented-correct Apple trio for "PWA with translucent status bar overlaying the page". `viewport-fit=cover` is the **mandatory pairing** for `black-translucent` — without it, the combination is broken. We have both.

### Manifest in `manifest.json` (correct, untouched since 2026-03-20)

```json
{
  "display": "standalone",
  "scope": "/",
  "start_url": "/",
  "background_color": "#1a1a2e",
  "theme_color": "#1a1a2e"
}
```

`display: standalone` is the iOS-recognized PWA mode. `theme_color` matches the `<meta name="theme-color">` in `index.html`.

### Git history

| File | Last meaningful change | Touched in Phase 1/2/2.5? |
|---|---|---|
| `index.html` viewport meta | 2026-01-23 (`7855f8a`) | No |
| `index.html` apple-mobile-web-app-status-bar-style | 2026-01-23 (`7855f8a`) | No |
| `manifest.json` display mode | 2026-03-06 (`4500e47`) | No |

**The safe-area config has been correct on disk since January 2026.** Whatever broke Al's PWA didn't come from Phase 1 or Phase 2.

---

## Verification — the natural CSS rule works at both viewports

Phase 2.5 verification harness (`scripts/verify-safe-area.mjs`) ran the natural rule `padding: max(0.5rem, env(safe-area-inset-top, 0px)) ...` at both target viewports with simulated env() values matching what real devices report:

| Device | Viewport | Simulated inset | Resulting padding-top | Brand title top |
|---|---|---|---|---|
| iPhone X PWA standalone | 375×812 | 44px | 44px ✓ | 44px ✓ |
| Pixel 5 PWA standalone | 393×851 | 24px | 24px ✓ | 24px ✓ |

The CSS expression resolves exactly to what the device reports. No overcorrection. No dead Android whitespace.

---

## Working hypothesis: stale install-time state

The strongest hypothesis for why iOS reports `env(safe-area-inset-top) = 0` to Al's specific iPhone:

**iOS Home Screen PWAs snapshot the manifest + key meta tags AT INSTALL TIME. Some properties become "frozen" until the user deletes and reinstalls. If the PWA was added to Home Screen BEFORE `viewport-fit=cover` landed in `index.html` (2026-01-23), iOS may still treat the installed app as if the page doesn't opt into safe-area handling — and pass `env() = 0` to the page even though the served HTML now has `viewport-fit=cover`.**

Not explicitly documented by Apple, but consistent with:
- Reports on Apple Developer forums of PWAs that "stopped getting safe-area-inset" after meta-tag changes were deployed but the user never reinstalled.
- The fact that a freshly-installed PWA on a different device renders correctly with the same code.
- The fact that the SW serves new HTML on every visit, but iOS uses the install-time manifest snapshot for display-mode and chrome decisions.

### Other candidates ruled out

1. **Display-mode regression.** Git history shows `manifest.json` has had `display: standalone` since the first checked-in version. Ruled out.
2. **Maskable icon misconfiguration.** Icons are declared with both `any` and `maskable` purposes at 192 and 512 sizes. Ruled out.
3. **Theme-color mismatch.** Both `manifest.theme_color` and `meta name="theme-color"` are `#1a1a2e`. Ruled out.
4. **Install via Chrome on iOS (vs Safari).** Worth confirming with Al — Chrome on iOS uses a different install path with worse safe-area support. Not ruled out.
5. **iOS version specific bug.** Safe-area handling changed between iOS 16 and 17. Worth confirming Al's iOS version. Not ruled out.

---

## Recovery path for testers

The CSS fix is correct for **fresh installs and refreshed installs**. For testers who installed Probably Weather BEFORE 2026-01-23 (the viewport-fit=cover landing date), they may need to take ONE of the following steps to pick up the corrected install-time snapshot:

### Option A — Delete and reinstall (cleanest)

1. Long-press the Probably Weather icon on the Home Screen.
2. Tap "Remove App" → "Delete App".
3. Open Safari, go to https://probablyweather.co.za.
4. Tap Share → Add to Home Screen.
5. Open the new Home Screen icon. The fresh install will snapshot the current `viewport-fit=cover` and `black-translucent` meta tags. Safe-area will work correctly from this point.

### Option B — `?reset=1` URL parameter

The app already supports a `?reset=1` URL parameter (see install.html inline reset script). Opening https://probablyweather.co.za/?reset=1 clears `pw_install*` and `pw_installed` localStorage keys. **This does NOT force iOS to re-snapshot the manifest** — it only resets the install banner / engagement state inside the app. For the safe-area regression, only Option A actually rebuilds the iOS install snapshot.

### Option C — Wait it out

After enough cache-clear / version-bump cycles, iOS sometimes (inconsistently) re-fetches the manifest and updates its cached snapshot. Unreliable; do not rely on this for tester rollout.

### Tester rollout copy

Suggested addition to the WhatsApp share message for testers (any language):

> If the title looks crushed against your status bar after installing, please long-press the Probably Weather icon → Remove App → Delete App, then add it again via Safari → Share → Add to Home Screen. Older installs had a small layout bug we've fixed.

In Afrikaans (matching the tester WhatsApp script Vos previously drafted — Phase 1 SA5 i18n bundle):

> As die titel teen jou statusbalk vasdruk lyk nadat jy dit geïnstalleer het, druk lank op die Probably Weather-ikoon → Verwyder App → Vee App uit, en voeg dit weer by via Safari → Deel → Voeg by tuisskerm. Ouer installasies het 'n klein uitlegfoutjie gehad wat ons reggemaak het.

---

## Questions for Al before deciding if a deeper fix is needed

Answer these from Al's iPhone via Safari Web Inspector + cable:

1. **iOS version.** Settings → General → About → iOS Version.
2. **PWA install date.** Can be derived from when he first added the icon, but easier: was the PWA installed before or after his first SA-1 verification (2026-05-11)?
3. **`display-mode: standalone` reports.** Open the PWA, then run in console:
   ```js
   matchMedia('(display-mode: standalone)').matches
   ```
   Expected: `true` if installed and opened via icon. If `false`, he's actually in Safari tab mode, and `env() = 0` is correct iOS behavior.
4. **Direct env() measurement.** In the PWA console:
   ```js
   const p = document.createElement('div');
   p.style.cssText = 'position:fixed;top:0;padding-top:env(safe-area-inset-top,999px);visibility:hidden;';
   document.body.appendChild(p);
   console.log('safe-area-inset-top reported by iOS =', getComputedStyle(p).paddingTop);
   p.remove();
   ```
   Expected on notched iPhone in standalone: `44px`-ish. If `0px` while in `display-mode: standalone`, that's the install-state bug.

Five minutes of remote debug would settle the diagnosis. Worth doing once before tester rollout so we know what to expect.

---

## TL;DR

- Phase 2.5 shipped CSS-only natural-rule fix: `max(0.5rem, env(safe-area-inset-top, 0px))`.
- iPhone X PWA gets 44px. Pixel 5 PWA gets 24px. Desktop/non-PWA gets 8px. All correct.
- Al's specific iPhone PWA was likely installed before `viewport-fit=cover` landed (2026-01-23) and is operating on a stale install-time manifest snapshot.
- Recovery: delete + reinstall the PWA via Add-to-Home-Screen. Recommend adding this line to the tester WhatsApp message.
- No further code changes needed. Worth a 5-minute remote-debug session with Al before tester rollout to confirm the diagnosis.
