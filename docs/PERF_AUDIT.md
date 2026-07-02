# Probably Weather — Cold-Load Performance Audit

**Date:** 2026-05-30
**Measured by:** Vos (Opus 4.8) — measurement only, NO code changes.
**Target:** https://www.probablyweather.co.za (LIVE production), repo HEAD `a852574`.
**Method:** Playwright + Chrome DevTools Protocol against the live site. Mobile emulation (360×640, DPR 3, Moto-G4-class), **4× CPU throttle**, **Slow 4G** via CDP (`download 200 KB/s, upload 93.75 KB/s, latency 150 ms`), cache disabled. Before every run: cache + cookies cleared, `clearPermissions()`, service worker unregistered, `localStorage`/`sessionStorage`/caches cleared → true first-visit cold load. CWV via in-page `PerformanceObserver` (paint / LCP / layout-shift / longtask); waterfall via CDP `Network.*` with ms offsets from navigation start.

> **Honesty note — read this.** Earlier drafts of this file stated conclusions ahead of clean data (first from Playwright runs that errored; then from runs contaminated by a persisted geolocation grant; then a draft that asserted an "8-second timeout dominates" verdict built on a single anomalous run). All were discarded. **This version reports only what the clean n=4 dataset actually shows, including the one run that disagrees with the other three.** Every number is from a run that returned that exact value. Lighthouse (`12.8.2`) is installed but couldn't be driven cleanly headless this session, so these are the `PerformanceObserver` equivalents (same primitives Lighthouse uses); Speed Index and the 0-100 score are absent.

---

## Raw data — 4 clean cold GPS-denied runs (Slow 4G, 4× CPU)

Every run: permissions cleared, no GPS answer → app falls to ipapi.co IP fallback, then `/api/weather`.

| Run | FCP (ms) | LCP (ms) | LCP el | CLS | TBT (ms) | **Weather rendered (ms)** | ipapi start→fin | /api/weather start→fin |
|-----|--------:|--------:|--------|----:|--------:|--------------------------:|-----------------|------------------------|
| A | 728 | 728 | `#temp` | 0.024 | 90 | **9999** ⚠️ outlier | 9340 → 9877 | 9926 → 9996 |
| B | 644 | 644 | `#temp` | 0.111 | 0 | **1871** | 1416 → 1797 | 1824 → 1884 |
| C | 636 | 636 | `#temp` | 0.154 | 0 | **1832** | 1409 → 1769 | 1792 → 1874 |
| D | 612 | 612 | `#temp` | 0.157 | 0 | **1842** | 1395 → 1745 | 1781 → 1813 |

**Median weather-rendered = ~1857 ms** (B/C/D cluster within 39 ms of each other; A is a lone ~8 s outlier discussed below). Also measured: a **GPS-granted-instant** path (separate n=3) rendered weather at ~1775 ms.

---

## Median Core Web Vitals — cold mobile, Slow 4G

| Metric | Median | Threshold | Verdict |
|--------|-------:|----------:|---------|
| **FCP** | **640 ms** | 1800 ms | ✅ PASS (excellent) |
| **LCP** | **640 ms** | 2500 ms | ✅ PASS* |
| **TBT** | **0 ms** (A: 90 ms) | 200 ms | ✅ PASS |
| **CLS** | **0.14** | 0.1 | ❌ **FAIL (marginal)** |
| **Weather content rendered** | **~1857 ms** (typical) · **9999 ms** (worst observed) | — | the felt-load number |

\* **LCP "passes" but the LCP element is `#temp` = "--°"** — the placeholder, not the forecast. Even at the typical ~1.85 s, the green LCP (~640 ms) is the blank temperature, not real content. The number that matches what a user feels is "weather rendered."

---

## Verdict — what the data actually says

**Cold load is typically fast (~1.85 s to weather on Slow 4G), but two real problems show up in the trace — and neither is what was assumed.**

**1. A cold-start tail-latency risk in the geolocation path.** Three of four runs rendered weather at ~1.85 s — ipapi.co resolved in ~350–400 ms (~1400 → ~1780 ms) and `/api/weather` returned in ~60 ms. But one run (A) stalled ~8 s before ipapi.co even fired (first request at 9340 ms vs ~1400 ms in the others), pushing weather to ~10 s. That matches the boot code: `getCurrentPosition(..., { timeout: 8000 })` (`assets/app.js` ~line 2284) — when the geolocation call hangs instead of erroring fast, the app waits the full 8 s timeout before falling back to ipapi. So the *typical* cold load is fine, but the app has an **8-second worst-case floor** whenever GPS neither answers nor rejects promptly (locked-down devices, slow first-fix, permission-prompt stalls). 1-in-4 in this small sample; on real phones with an actual permission prompt the stall is plausibly more common. **This is a tail risk, not the median — stated honestly because an earlier draft wrongly made it the headline.**

**2. CLS marginally fails (0.14 median, up to 0.157).** Layout shifts after first paint — consistent with the background image and weather content popping in after the "--°" shell. This is a real, reproducible fail against the 0.1 threshold and is independent of connection speed.

**Cleared of suspicion by measurement:** **FCP/LCP (~640 ms) and TBT (~0–90 ms) pass comfortably.** **`/api/weather` returns in ~60 ms** — the 5-provider aggregation was *not* slow (Vercel served it near-instantly; the assumed "slow API round-trip" is disproven). The **background WebP is off the critical path** — it requests *after* weather renders and never blocks paint; the 1.5 GB→177 MB WebP conversion did its job and is correctly retired as a suspect. Asset weights are fine: app.js 48 KB gzip (151 KB raw), app.css 20 KB gzip, weather-copy.js 46 KB gzip.

---

## Candidate fixes — ranked by *measured* impact

1. **Fix CLS (0.14 → under 0.1).** *The only clean, reproducible threshold FAIL in the median.* Reserve space for the weather block and background so content doesn't shift when it populates — e.g. fixed min-height on `#weatherStatus`, and a gradient/solid behind `#bgImg` (which already has `width/height` attrs but the shift persists). Cheap, deterministic, and it's the one metric actually failing on a typical load.

2. **Harden the geolocation timeout against the 8-second tail.** Owns the worst-case (~8 s → ~1.8 s) even though it's not the median. Lower `timeout` from 8000 to ~2500 ms, and/or **race** `getCurrentPosition` against an immediate ipapi.co lookup and take whichever returns first (ipapi resolved in ~350–400 ms in the fast runs — it would usually win). Removes the 1-in-4 cold stall without changing the happy path.

3. **Render cached last-location + weather instantly on boot (stale-while-revalidate UI).** For **returning** visitors (the common post-launch case), `homePlace`/`savedLoc`/last forecast are already in localStorage; paint them at ~FCP (~0.64 s) and refresh in the background instead of showing "--°" until the live fetch returns. Turns the typical ~1.85 s into ~0.64 s for repeat users and also hides the #2 tail entirely for them.

4. **Don't serialise the forecast behind the location-name resolve.** On the GPS path a reverse-geocode (`/api/weather?reverse=1`) precedes the forecast; fire the forecast from coordinates immediately and fill the place name in async. Minor (~hundreds of ms) but free.

5. **Lazy-load `weather-copy.js` (46 KB gzip / 118 KB raw) out of the boot module graph; consider pre-caching a default bg / gradient on SW install.** `weather-copy.js` is a static `import` not needed for first paint (finishes ~1340 ms). `sw.js` `CORE_ASSETS` is confirmed **shell-only** (no bg image / default.jpg precached). Both are low priority — TBT already passes and the bg is off the critical path — but they're the remaining boot-graph and caching refinements, and a gradient placeholder also helps #1 (CLS).

**Retired (disproven):** "huge background images" and "slow /api/weather round-trip." WebP fixed image weight and the bg never blocks paint; the API returned in ~60 ms.

---

## Coverage / caveats

- **The headline honestly: typical cold load is ~1.85 s, not slow.** If testers consistently report multi-second waits, the likely culprits are (a) the **8 s geolocation tail** (fix #2) hitting more often on real devices with permission prompts than in automation, and/or (b) **warm-cache vs cold differences** / real-GPS-acquisition time that this emulated harness can't fully reproduce. Recommend confirming the felt-slowness against a real mid-tier Android before investing heavily — the emulated median does not reproduce a chronic multi-second delay.
- **CLS 0.14 is the one solid, reproducible fail** and is worth fixing regardless.
- **3G not separately tabulated:** the geolocation tail is bandwidth-independent; 3G only lengthens asset-transfer tails. Slow 4G (realistic SA median) is fully measured.
- **Automation geolocation ≠ real phone:** runs measured GPS-denied (no prompt) and GPS-granted-instant; a real first-grant GPS acquisition can take 1–10 s, which makes fix #2 more valuable. Measured paths bracket: ~1.78 s (granted) to ~1.85 s typical / ~10 s worst (denied+stall).
- **Methodology corrections made mid-audit (disclosed):** failed Playwright calls discarded; a persisted geolocation grant that contaminated two runs fixed with `clearPermissions()`; and the one ~10 s run is reported as the outlier it is, not as the median. n=4 GPS-denied + n=3 GPS-granted, all against live prod at HEAD `a852574`. No code changed, nothing committed.
