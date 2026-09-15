# Ads readiness — DRAFT (branch `ads-readiness`, do not merge)

Close-out item J (2026-09-15), reworked the same day to Al's ruling:

> No Home slot at all. Slots on Hourly and Weekly, phones and tablets only, below the fold, never over content or the nav; Search slot as an optional flag off by default. Until a network is live, the slot renders a placeholder card in the app's own style, in all five languages, reading roughly "Weather apps don't grow on trees. There might be an ad here one day." Keep the privacy and consent work from the PR.

- **Not deployed.** `vercel.json` carries `git.deploymentEnabled["ads-readiness"] = false`, so commits on this branch build no Vercel deployment. `tests/csp-ads.test.js` pins it.
- **No network, no ad script.** `assets/ads-config.js` has `network: null`; no loader, no consent component, no request to anyone. The slots show the placeholder card only.

| File | Change |
|---|---|
| `assets/ads-config.js` | the ruling as data: `slots: { hourly: true, weekly: true, search: false }`, `network: null`, phones and tablets only |
| `index.html` | one `<aside class="ad-slot">` at the end of Hourly, Weekly and Search; the Home slot is gone |
| `assets/app.css` | the slot and placeholder card (≤1023px only, normal flow, below a one-screen body) |
| `assets/app.js` | `T.ads` (label + placeholder, five languages); `updateUILanguage` enables slots from the config and relabels them on a language switch |
| `privacy.html` | Google AdSense as a vendor; the third-party-cookie disclosure; the ad choice; Google's advertising cookies named; opt-outs (unchanged from the first draft) |
| `docs/ads-readiness-consent.json` | the POPIA ad-choice banner and Settings row in five languages (unchanged) |
| `scripts/generate-csp.mjs` | `buildAdsCsp()` and `node scripts/generate-csp.mjs --ads` (unchanged) |
| `tests/csp-ads.test.js` | the ads CSP; the branch never deploys; no Home slot; Hourly/Weekly slots after their content; Search behind a flag that is off; ≤1023px, never fixed; the placeholder in five languages; no ad script |
| `vercel.json` | `git.deploymentEnabled` for this branch only |

## 1. The slots

**Where.** An `<aside class="ad-slot" data-ad-slot="hourly|weekly|search" aria-label="Advertisement" hidden>` as the last child of `#hourly-screen`, `#week-screen` and `#search-screen` — after the screen's content, in normal flow. Nothing on Home, Sources, Settings or the day detail.

**Which are on.** `assets/ads-config.js`: Hourly on, Weekly on, Search off. `updateUILanguage` sets each slot's `hidden` from the config and adds `body.ads-slots` when any slot is on.

**Rules** (`assets/app.css`, `@media (max-width: 1023px)` — phones and tablets; the ≥1024px desktop postcard gets none):
- The screen body above an enabled slot is at least one screen tall (`min-height: 100dvh`), so the slot always starts below the fold.
- The slot is never `fixed`, `sticky` or `absolute`: it cannot sit over content or the nav.
- Its bottom margin clears the fixed nav (`--nav-h` + 24px + safe area) when scrolled to the end.
- The box is reserved: a label and a 250px-high frame (300×250 fits), so a late ad cannot move anything.

**The placeholder card.** Until `network` is set, the frame holds one line in the app's caption hand (Caveat, brand gold) on the app's surface colour:

| | |
|---|---|
| en | Weather apps don't grow on trees. There might be an ad here one day. |
| af | Weer-apps groei nie op bome nie. Hier kom dalk eendag 'n advertensie. |
| zu | Ama-app esimo sezulu awakhuli ezihlahleni. Kungenzeka kube nesikhangiso lapha ngolunye usuku. |
| xh | Ii-app zemozulu azikhuli emithini. Kusenokubakho intengiso apha ngenye imini. |
| st | Di-app tsa boemo ba lehodimo ha di mele difateng. Mohlomong ho tla ba le papatso mona ka tsatsi le leng. |

Label: Advertisement / Advertensie / Isikhangiso / Intengiso / Papatso.

**Language check** (`scripts/lang-check/lib/checker.mjs`, 2026-09-15). All four labels pass. The placeholders pass in af, xh and st. The first zu draft ("…awamili ezihlahleni…") was triage on one medium finding — `awamili` unattested — and the shipped line uses the attested `awakhuli` (pass, 0.15). Under CLAUDE.md rule 9, isiZulu, isiXhosa and Sesotho still wait for a native speaker before this is ever wired to production; the Afrikaans goes to Al.

## 2. Measured on this branch's build

Method: `output/_ads-slots.mjs` in the main repo — a static server over this worktree's `dist/`, the weather API mocked, Chromium; Hourly and Weekly opened from their nav controls, then scrolled to the end. "Overlaps" counts screen header and body children intersecting the slot; "nothing on top" means `elementFromPoint` at the slot's top, middle and bottom returns the slot.

| Viewport | Hourly slot | Weekly slot | Top at open vs fold | Overlaps content | End of scroll | Clear of nav | Nothing on top | Home slots | Search slot | Off-origin requests | Console errors |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 360×640 | shown | shown | 726 px vs 640 — below | 0 | 201–472 px | nav at 568 — yes | yes | 0 | hidden | 0 | 0 |
| 390×844 | shown | shown | 930 vs 844 — below | 0 | 405–676 | nav at 772 — yes | yes | 0 | hidden | 0 | 0 |
| 412×915 | shown | shown | 1,001 vs 915 — below | 0 | 476–747 | nav at 843 — yes | yes | 0 | hidden | 0 | 0 |
| 768×1024 | shown | shown | 1,110 vs 1,024 — below | 0 | 585–856 | nav at 952 — yes | yes | 0 | hidden | 0 | 0 |
| 1366×768 | not shown (desktop) | not shown | — | 0 | — | — | — | 0 | hidden | 0 | 0 |
| 1920×1080 | not shown (desktop) | not shown | — | 0 | — | — | — | 0 | hidden | 0 | 0 |

The same numbers for Hourly and Weekly: in both, the one-screen body is what places the slot. Screenshots: `output/ads-slots/hourly-390-en-end.png` and `weekly-390-<lang>-end.png` for all five languages.

**Loading, when a network is live.** Request the ad only when the slot approaches (an `IntersectionObserver` with about one screen of `rootMargin`), never on first paint, and only after the reader's ad choice (section 4). Report nothing to our server.

## 3. Privacy policy additions (`privacy.html`) — kept

- **Required disclosure.** AdSense requires the policy to say that third-party vendors, including Google, use cookies to serve ads based on prior visits, to name the vendors and ad networks, and to link their opt-outs ([Required content](https://support.google.com/adsense/answer/1348695)).
- **Your ad choice.** Ads picked for you (personalised) or general ads; for the general choice, cookies are still used for frequency capping and aggregated reporting ([Personalized and non-personalized ads](https://support.google.com/adsense/answer/9007336)). The choice lives on the device; Settings → Ad choices changes it; clearing site data resets it. Opt-outs: [My Ad Center](https://myadcenter.google.com/), [aboutads.info/choices](https://www.aboutads.info/choices/).
- **Cookies.** Google's advertising cookies named (`__gads`, `IDE`, `DSID`, `id`) with a link to the full list ([How Google uses cookies](https://policies.google.com/technologies/cookies)).
- **Vendors disclosed:** Google AdSense (added), Adsterra and Media.net (already there). Which network goes live first is still open (section 6, decision 1).

## 4. POPIA ad-choice banner — spec, kept

- **When.** Once per device, before the first ad request; again only if site data is cleared or the wording changes. Until a choice exists, no ad script loads.
- **Where and how.** A bottom sheet above the nav, never over the temperature or the headline; `role="dialog"`, focus on the first button, both buttons equal in size and weight, no close control that records a choice. The privacy link reuses `T.settings.privacyPolicy`.
- **Copy.** Five languages in `docs/ads-readiness-consent.json` (`adConsentTitle`, `adConsentBody`, `adConsentPersonalised`, `adConsentGeneral`, `adChoicesRow`); all 20 non-English strings passed lang-check after one revision.
- **Storage.** `localStorage` `pw_ad_choice` = `{"choice":"personalised"|"general","at":"YYYY-MM-DD","v":1}`, try/catch like the app's other storage.
- **Effect (AdSense).** `general` sets `requestNonPersonalizedAds = 1` before `adsbygoogle.js` loads ([ad tag settings](https://support.google.com/adsense/answer/7670312)); `personalised` is the default tag.
- **POPIA.** Personalised ads on consent (s11(1)(a)); general ads on legitimate interest (s11(1)(f)). To confirm with a lawyer — not verified here.
- **EEA, UK and Switzerland.** Google requires a certified CMP integrated with the IAB TCF for personalised ads there ([consent management requirements](https://support.google.com/adsense/answer/13554116)). This banner is not one.

## 5. CSP for AdSense — kept

Google supports only a strict CSP for AdSense ([Integrate the AdSense ad code with a CSP](https://support.google.com/adsense/answer/16283098)). `node scripts/generate-csp.mjs --ads` prints the policy on our inline-script hashes with `'strict-dynamic' 'unsafe-eval' 'unsafe-inline' https: http:`. Before it can be enforced: every parser-inserted `<script src>` must move behind a hashed bootstrap or a nonce, it must run Report-Only for a week, and `'unsafe-eval'` plus `https:` in `img-src`, `connect-src` and `frame-src` widen the policy for everyone.

## 6. Decisions still open for Al

Ruled on 2026-09-15 and closed: no Home slot; Hourly and Weekly only; no desktop slot; Search behind a flag, off; placeholder until a network is live.

1. **Which network first** — the 2026-05-16 lock says Adsterra first with Media.net in parallel, AdSense later; this draft's privacy and CSP work is written for AdSense.
2. **EEA, UK and Switzerland visitors:** a certified CMP, or non-personalised ads only there?
3. **Before a choice is made:** no ads (this draft), or general ads?
4. **Language:** native speakers for the isiZulu, isiXhosa and Sesotho banner and placeholder strings; Al on the Afrikaans.
5. **CSP:** nonce middleware or a hash bootstrap; and accepting `'unsafe-eval'` site-wide.
6. **Day-detail views:** the lock listed DayDetailHourly and DayDetailSummary as ad surfaces too; the ruling names Hourly and Weekly only, so they carry no slot here.
