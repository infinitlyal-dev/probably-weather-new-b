# Codex GPT-5.5 — Adversarial review of pre-tester audit

**Reviewer:** Codex CLI 0.130.0 invoking `gpt-5.5`
**Date:** 2026-05-12
**Invoked via:** `codex exec -m gpt-5.5 --skip-git-repo-check --sandbox read-only --json`
**Audit doc reviewed:** `PRE_TESTER_AUDIT.md` (local-only — not pushed)
**Source files reviewed:** `sw.js`, `middleware.js`, `assets/app.js`, `assets/install.js`, `assets/refresh-behaviour.js`, `assets/weather-emoji.js`, `assets/share-url.js`, `assets/startup-location.js`, `api/og.js`, `api/share.js`, `index.html`, plus Phase 1 notes.

## Reviewer's environment caveat

Codex's local shell was blocked at the Windows sandbox layer (sandbox=read-only) and could not read the local-only `PRE_TESTER_AUDIT.md`. It fell back to reading the pushed source from `infinitlyal-dev/probably-weather-new-b` via its GitHub connector. **This is actually a stronger adversarial pose:** Codex independently audited the code without anchoring on Vos's findings, then surfaced concrete issues regardless of whether Vos had already flagged them. Where its findings overlap with Vos, that's confirmation. Where they don't, that's the value of the second pair of eyes.

---

## Codex's response (verbatim)

## 1. Where Did Claude Code Miss Something?

I could not read local-only `PRE_TESTER_AUDIT.md`: the local shell failed at the Windows sandbox layer, and the file is not present on GitHub. I will not pretend to know what Vos listed there. From the pushed code, these are concrete issues worth checking against the audit:

- `sw.js:24` defines `API_CACHE_MAX_AGE`, but the offline `/api/weather` fallback never uses it. Any cached weather response is returned indefinitely once offline (`sw.js:107-116`). For tester rollout, this can show very stale weather as "offline fallback" instead of failing loudly or marking it stale.

- `sw.js:28-30` swallows `cache.addAll(CORE_ASSETS)` failures during install. A bad asset path or transient failure still installs the SW, leaving the offline shell only partially cached. That undermines the offline guarantee.

- `middleware.js:17` uses `https://www.probablyweather.co.za`, while `index.html:15-22` and `assets/share-url.js:1` use apex `https://probablyweather.co.za`. Middleware-generated OG image/canonical URLs can diverge from the actual share URL (`middleware.js:68-72`, `middleware.js:119-120`). If `www` is not fully configured, link previews break.

- `assets/startup-location.js:1-14` ignores `?city=` even though share URLs emit it (`assets/share-url.js:55-57`). A shared link with valid city + coords becomes `{ name: 'Unknown location' }` on app startup. If weather/reverse lookup is slow or offline, the recipient sees a worse location label than the URL already provided.

- `assets/app.js:1178-1185` builds share text containing `{url}` and also passes `url` separately to `navigator.share`. Many native share targets append the `url` field, so WhatsApp/SMS can receive duplicate links.

## 2. Are Any Critical Items Actually Nice, Or Vice Versa?

Cannot honestly reassess each Vos severity call without the unreadable `PRE_TESTER_AUDIT.md`.

Severity calls from the code above:

- Offline API cache age: escalate to HIGH, possibly CRITICAL for tester rollout. Weather can be materially wrong while the UI appears functional.
- Partial SW precache install: HIGH. Offline/install reliability is a rollout gate.
- Middleware apex/www mismatch: HIGH until production confirms both domains serve `/og/*.jpg` identically.
- Ignored `?city=` on shared app load: MEDIUM. Bad share UX, not app-breaking.
- Duplicate URL in native share: LOW/MEDIUM. Annoying and visible, but easy recovery.

## 3. What's The Failure Mode For Each Non-Obvious Change Shipped In Phase 1?

- SW auto-update (`assets/app.js:422-486`, `sw.js:33-47`): update found, SW activates, page reloads mid-session. User notices a flicker/toast. Recovery is normal reload; blast radius is all active clients on deploy. Worse failure: `registration.update()` never fires for a continuously foregrounded tab, so user stays stale until next launch/visibility event.

- Edge middleware OG injection (`middleware.js:99-139`): crawler gets rewritten OG tags with `www` asset URLs (`middleware.js:17`, `middleware.js:119`). If `www` is wrong or cached separately, WhatsApp/Facebook preview shows no image/wrong canonical. Recovery is domain fix + debugger scrape refresh. Blast radius is shared links only.

- Pull-to-refresh (`assets/app.js:1660-1777` approx): touch gesture can conflict with normal top-of-page scroll or iOS rubber-band. User notices stuck/false refresh pill or unexpected refresh. Recovery is release gesture/reload. Blast radius is mobile home screen only.

- Offline `/api/weather` fallback (`sw.js:89-121`): network fails, SW returns any cached response with `sw-offline: true`, regardless of age. User notices stale/wrong forecast first, especially after travel. Recovery is reconnect + fresh fetch or cache clear. Blast radius is offline/poor-network users.

- URL contract `?lang / ?lat / ?lon / ?bg / ?city` (`index.html:24-50`, `assets/share-url.js:47-60`, `assets/startup-location.js:1-14`): middleware uses `bg/city`, app uses `lat/lon/lang`, but app ignores `city`. Failure is preview says "Strand" while initial app state can say "Unknown location" until data loads. Recovery is parse city into startup place. Blast radius is shared-link recipients.

---

## Vos reconciliation

Cross-checked all 5 of Codex's findings against the actual code. Confirmed all 5 are real.

### Findings Codex caught that Vos missed

| # | Issue | Codex severity | Vos verdict after re-check | Final severity |
|---|---|---|---|---|
| Z1 | `sw.js:24` `API_CACHE_MAX_AGE` defined but unused — stale weather served forever when offline | HIGH/CRITICAL | Vos missed this entirely. Confirmed: const exists, offline path at `sw.js:106-116` never consults it. After a tester travels offline they could see week-old weather labeled as "offline mode". | **CRITICAL** |
| Z2 | `sw.js:28-30` `cache.addAll(CORE_ASSETS).catch(() => {})` — install completes with partial cache | HIGH | Vos missed. Confirmed: a single bad path silently degrades offline mode for all installs of that SW version. | **CRITICAL** |
| Z3 | `middleware.js:17` `www.` origin, rest of app uses apex | HIGH (conditional) | Vos missed. Verified prod: `curl -sI https://probablyweather.co.za/og/clear.jpg` returns 307 → `www.`. The apex DOES redirect to www. So crawlers will resolve via redirect, but inconsistency is real. | **SHOULD** — downgrade from Codex's HIGH because prod redirect is verified working, but cleanup is warranted. |
| Z4 | `?city=` ignored in `getSharedPlaceFromSearch` | MEDIUM | Vos missed. Confirmed: recipient of `?lat=-34&lon=18&city=Cape%20Town` sees "Unknown location" until reverse-geocode completes. Bad UX, especially with slow network. | **CRITICAL** — escalate from Codex's MEDIUM because shared links are a primary tester-rollout vector. First impression matters. |
| Z5 | Share button passes both `{url}` interpolated into `text` AND `url` separately to `navigator.share` | LOW/MEDIUM | Vos missed. Confirmed at `assets/app.js:1180-1185`. WhatsApp will show the URL twice in the share message. | **SHOULD** — keep as Codex called it. |

### Severity protocol applied

Per Al's instruction: "If Claude Code and Codex disagree on severity, default to the higher severity unless Codex's reasoning is clearly stronger."

- **Z1, Z2** — escalating to CRITICAL because both are silent offline-mode failures. Testers WILL go offline on the N2 highway / poor signal areas. Showing wrong weather while reporting "offline mode" is the exact failure that Probably Weather's ensemble strategy is designed to avoid. Both are one-line fixes.
- **Z3** — downgrading from Codex's HIGH to SHOULD because production verification shows the redirect chain works. Codex hedged this himself ("HIGH until production confirms"). Cleanup remains warranted to avoid future surprises.
- **Z4** — escalating from Codex's MEDIUM to CRITICAL. Shared links are how Al is rolling out to testers right now (WhatsApp). "Unknown location" on a shared link defeats the whole share flow.
- **Z5** — keeping Codex's LOW/MEDIUM call. Genuinely annoying UX but recovers naturally; not a rollout gate.

### Findings Vos called CRITICAL that Codex didn't disagree with

- **C1** (duplicate "Data sources" / "About" sections in `index.html`): Codex didn't see PRE_TESTER_AUDIT.md so he didn't comment, but visually inspecting `index.html:293-296` vs `:297-304` it's clearly a duplicate. Stays CRITICAL.

### Findings Vos called SHOULD/NICE that Codex didn't escalate

- **S2** (`api/share.js:132` `JSON.stringify` inside `<script>`): Codex didn't see this — fair, his audit was broad not deep. Vos's SHOULD call stands.
- **S3** (two visibilitychange listeners): no Codex commentary. Stays SHOULD.
- **S4** (stale activePlace in GPS callback): no Codex commentary. Stays SHOULD.
- All NICE items: no Codex commentary. Defer post-launch.

### Final CRITICAL fix list for Phase 2

1. **C1** — delete duplicate "Data sources" section in `index.html`
2. **Z1** — apply `API_CACHE_MAX_AGE` check to offline `/api/weather` fallback in `sw.js`
3. **Z2** — make `cache.addAll(CORE_ASSETS)` failure visible (log + degrade gracefully but don't silently complete install)
4. **Z4** — parse `?city=` in `getSharedPlaceFromSearch` and surface it as the initial place name

Plus folded-in cleanup:
5. **S1** — delete dead `T.settings.wittyIn` i18n key

All five fixes go in one commit, SW slot bump to `pw-v2026-05-12-006`, tests added for each behaviour change.
