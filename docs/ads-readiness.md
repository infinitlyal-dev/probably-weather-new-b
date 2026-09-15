# Ads readiness — DRAFT (branch `ads-readiness`, do not merge)

Prepared 2026-09-15 as close-out item J. A draft for Al to rule on, not a launch:

- **Not deployed.** `vercel.json` carries `git.deploymentEnabled["ads-readiness"] = false`, so commits on this branch do not build a Vercel deployment (production or preview). `tests/csp-ads.test.js` pins it.
- **Inert if merged by accident.** No ad script, no loader, no consent component. The Home slot ships `hidden`; the privacy additions describe behaviour that does not exist yet; the AdSense CSP is only printed, never written to `vercel.json`.

What is on the branch:

| File | Change |
|---|---|
| `privacy.html` | Google AdSense added as a vendor; the required third-party-cookie disclosure; a section on the ad choice; Google's advertising cookies named; opt-outs |
| `index.html`, `assets/app.css` | the one Home ad slot, hidden, styled only under `body.ads-on` |
| `scripts/generate-csp.mjs` | `buildAdsCsp()` and `node scripts/generate-csp.mjs --ads` |
| `tests/csp-ads.test.js` | the ads policy's shape; `vercel.json` still ships the enforced policy; the branch never deploys; the slot ships hidden with no ad script |
| `docs/ads-readiness-consent.json` | the ad-choice banner and Settings row in five languages, with the lang-check record |
| `vercel.json` | `git.deploymentEnabled` for this branch only |

## 1. What this draft runs into

The monetisation plan on record says otherwise. `Son-Memory/projects/probably-weather.md`:

> **Monetisation (locked 2026-05-16):** Adsterra-first + Media.net parallel, skip AdSense initially. Home + Sources AD-FREE; ad slots only Hourly/Weekly/DayDetailHourly/DayDetailSummary.

This draft follows the 2026-09-15 brief instead — AdSense, one slot on Home below the fold. Both points contradict the lock. Nothing here should merge until Al rules on them (section 8).

## 2. Vendors

| Vendor | Status | Policy |
|---|---|---|
| Google AdSense (Google LLC) | added in this draft | [how Google uses information from sites that use its services](https://policies.google.com/technologies/partner-sites) · [privacy policy](https://policies.google.com/privacy) |
| Adsterra | already disclosed | [adsterra.com/privacy-policy](https://adsterra.com/privacy-policy/) |
| Media.net | already disclosed | [media.net/privacy-policy](https://www.media.net/privacy-policy/) |

## 3. Privacy policy additions (`privacy.html`)

- **Required disclosure.** AdSense requires the policy to say that third-party vendors, including Google, use cookies to serve ads based on prior visits, to name the vendors and ad networks, and to link their opt-outs ([Required content](https://support.google.com/adsense/answer/1348695)). All three are in the Advertising section now.
- **Your ad choice.** Ads picked for you (personalised) or general ads. For the general choice the policy says only what Google's help page says: cookies are still used for frequency capping and aggregated ad reporting ([Personalized and non-personalized ads](https://support.google.com/adsense/answer/9007336)). The choice lives on the device, never on our server; Settings → Ad choices changes it; clearing site data resets it. Opt-outs: [My Ad Center](https://myadcenter.google.com/) and [aboutads.info/choices](https://www.aboutads.info/choices/).
- **Cookies.** Google's own advertising cookie names and purposes: `__gads`, `IDE`, `DSID`, `id` ([How Google uses cookies](https://policies.google.com/technologies/cookies)), with a link to the full list.
- **Left out on purpose:** anything about visitors in the EEA, the UK or Switzerland, because that depends on a decision (section 4).

## 4. POPIA ad-choice banner — spec

**When.** Once per device, before the first Google ad request; again only if site data is cleared or Al changes the wording. **Until a choice exists, no AdSense script loads** (a proposal — see decision 4).

**Where and how.** A bottom sheet above the nav, never over the temperature or the headline. `role="dialog"` with `aria-labelledby` on the title, focus on the first button, both buttons equal in size and weight (no nudging towards yes), no close control that records a choice. The privacy link reuses the app's reviewed `T.settings.privacyPolicy`.

**Copy** (all five languages in `docs/ads-readiness-consent.json`):

| Key | English |
|---|---|
| `adConsentTitle` | Ads keep this app free |
| `adConsentBody` | Google shows the ads here. Say yes and it may use cookies to pick ads for you. Say no and you still get ads, just not picked for you. Change your mind any time in Settings. |
| `adConsentPersonalised` | Yes, pick ads for me |
| `adConsentGeneral` | No, keep them general |
| `adChoicesRow` | Ad choices |

**Language check** (`node scripts/lang-check.mjs --file`, 2026-09-15). The first pass flagged all four titles, because the app's name trips "Weather" as untranslated English. It also flagged three bodies: zu `ezingakhethelwe` (unattested), xh `ezingakhethelwanga` (triage-high) and st `seng` / `tsona` (triage-high, off-sense). After one revision all 20 strings pass with no medium or high finding. Under CLAUDE.md rule 9, isiZulu, isiXhosa and Sesotho are still not wired until a native speaker rules, and the Afrikaans goes to Al.

**Storage.** `localStorage` `pw_ad_choice` = `{"choice":"personalised"|"general","at":"YYYY-MM-DD","v":1}`, in a try/catch like the app's other storage. Blocked storage means the banner shows again next session, and no personalised ads meanwhile.

**Effect.**
- `general`: before `adsbygoogle.js` loads, set `(adsbygoogle = window.adsbygoogle || []).requestNonPersonalizedAds = 1`. The request then carries `npa=1` ([Ads personalization settings in Google's publisher ad tags](https://support.google.com/adsense/answer/7670312)). Account-level non-personalised control in Privacy & messaging is deprecated ([notice](https://support.google.com/adsense/answer/16278928)), so the tag is the control.
- `personalised`: the default tag.
- Settings → Ad choices shows the current choice and reopens the sheet. A change applies from the next Home paint.

**POPIA.** Personalised ads rest on consent (s11(1)(a)); general ads on legitimate interest (s11(1)(f)). Cross-border transfer is already covered under s72 in the policy. **To confirm with a lawyer — not verified here.**

**Visitors in the EEA, the UK and Switzerland.** Google requires a Google-certified consent management platform integrated with the IAB TCF to serve personalised ads there: from 16 January 2024 in the EEA and UK, and from 31 July 2024 in Switzerland ([Google consent management requirements](https://support.google.com/adsense/answer/13554116)). This banner is not a certified CMP. See decision 3.

## 5. The Home slot

**Markup.** `<aside id="homeAdSlot" class="home-ad-slot" aria-label="Advertisement" hidden>`, a sibling after `.home-layout`, so it can never sit inside the forecast card.

**Phones and tablets only (≤768px).** The desktop Home (≥769px) is one fixed "postcard" screen. With the slot enabled at 1366×768 and 1920×1080, scrolling to it slid it under the polaroid and the Share / Hourly / My Location pills. At 1920×1080 it also pushed the big headline up under the nav. There is no below-the-fold on that layout, so this draft puts no Home slot on desktop (decision 7).

**Rules** (`assets/app.css`, all under `body.ads-on.home-active` inside `@media (max-width: 768px)`):
- With ads on, Home is at least one screen tall (`min-height: 100dvh`), so the slot starts below the fold at every width.
- It reserves `min-height: 304px` (label + a 336×280 frame), so a late ad cannot move anything.
- Its bottom margin clears the fixed nav plus the install banner above it.

**Measured on this branch's build.** Method: `J-slot.mjs` — a static server over `dist/`, the API answered by production, Chromium. Ads were switched on in the page for the measurement only.

| Viewport | Slot with ads on | Slot top vs fold | Overlaps forecast card | Card moved | At the end of scroll | Ad requests | Errors |
|---|---|---|---|---|---|---|---|
| 360×640 | shown | 664 px — 24 px below | no | no | 102–406 px on screen, 16 px above the install banner, nothing on top | 0 | 0 |
| 390×844 | shown | 868 px — 24 px below | no | no | 306–610 px, 16 px above the banner | 0 | 0 |
| 412×915 | shown | 939 px — 24 px below | no | no | 377–681 px, 22 px above the banner | 0 | 0 |
| 768×1024 | shown | 1,048 px — 24 px below | no | no | 486–790 px, 22 px above the banner | 0 | 0 |
| 1366×768 | not shown (desktop) | — | no | no | — | 0 | 0 |
| 1920×1080 | not shown (desktop) | — | no | no | — | 0 | 0 |

- **As shipped (ads off),** at every width the slot is present, `hidden` and `display: none`.
- **"Forecast card"** means `#heroCard`, `#weatherStatus`, `#headline`, `.stats-band`, `#feelsLine`, `#rangeLine`, `#agreeLine` and `.sidebar`. "Nothing on top" means `elementFromPoint` at the slot's top, middle and bottom returns the slot.
- **Home scrolls** inside `body.home-active`, not the document (562 px to the end on every phone).
- **Two earlier runs failed, and changed the CSS:** the install banner covered the slot's middle and the nav its bottom (the margin is now nav + 162 px), and the desktop slot slid under the postcard (desktop is now excluded).

**Loading, when built.** Mobile Home scrolls inside a container, not the document. Request the ad with an `IntersectionObserver` (root `null`, `rootMargin` about one screen) when the slot approaches, never on first paint. Report nothing to our server.

## 6. CSP for AdSense

Google supports **only a strict CSP** for AdSense: a nonce, `'strict-dynamic'` and `'unsafe-eval'`, with `'unsafe-inline' https: http:` as the fallback older browsers read. The reason is that the hosts its code loads from change ([Integrate the AdSense ad code with a CSP](https://support.google.com/adsense/answer/16283098)). Google also advises testing under `Content-Security-Policy-Report-Only` before enforcing.

`node scripts/generate-csp.mjs --ads` prints (our 19 inline-script hashes elided):

```
default-src 'self'; script-src <19 hashes> 'strict-dynamic' 'unsafe-eval' 'unsafe-inline' https: http:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https:; frame-src https:; worker-src 'self'; manifest-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; report-uri /api/csp-report
```

Before it can be enforced:
1. **Page loading changes.** Under `'strict-dynamic'` a CSP3 browser ignores `'self'` and host allowlists in `script-src`. Every parser-inserted `<script src>` is blocked: `assets/app.js` in `index.html`, the Vercel Insights script, and `install.html`'s modules. Each must be loaded by a hashed inline bootstrap (dynamic `import()` / `createElement('script')`), or carry a per-request nonce.
2. **Nonce or hash.** Google documents the nonce form. A nonce on a static site needs middleware to rewrite every HTML response, which costs the CDN cache on `index.html`. The hash form is the strict-CSP equivalent for static pages but is untested with AdSense: ship it as Report-Only first and read the `[pw-csp]` lines from `/api/csp-report` for a week.
3. **What widens for everyone.** `'unsafe-eval'` in `script-src`, and `https:` in `img-src`, `connect-src` and `frame-src`. The current policy allows one external host (`api.qrserver.com`).

## 7. Not deployed — how to check

`vercel.json` → `git.deploymentEnabled["ads-readiness"] = false`. The PR's checks should show no Vercel deployment for this branch.

## 8. Decisions for Al

1. **AdSense now**, against the 2026-05-16 lock (Adsterra first, Media.net in parallel, AdSense later)?
2. **A Home slot**, against "Home + Sources AD-FREE"? The lock's surfaces are Hourly, Weekly and the two day-detail views. The Home Hourly button was designed as the way into that ad surface (`index.html`: "Hourly is the ad surface").
3. **EEA, UK and Switzerland visitors:** a Google-certified CMP (Google's Privacy & messaging is one), or non-personalised ads only for those regions?
4. **Before a choice is made:** no ads (this draft), or general ads?
5. **Language:** native speakers for the isiZulu, isiXhosa and Sesotho banner strings; Al on the Afrikaans.
6. **CSP:** nonce middleware or a hash bootstrap; and accepting `'unsafe-eval'` site-wide.
7. **Desktop Home:** no slot (this draft), or a fixed rail in the empty gutter beside the postcard? A rail is visible on arrival, so it would not be below the fold.
