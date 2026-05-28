# Promote Execution Report — 2026-05-24

Companion to: `docs/promote-plan-2026-05-24.md`, `docs/promote-review-2026-05-24.md`.

---

## Phase 0 — Adversarial review outcome

Round 1: 24 findings. 8 applied, 8 rejected with reasoning. Round 2: SHIP verdict.

## Phase 1 — pre-promote state capture (PASSED)

| Item | Value |
|------|-------|
| HEAD | `2377ac11e58c7e86d37c7896a89b51c22a41d7e9` |
| origin/main | `24210a5382eaf0c020c1b32f2cf76d332b47b9f7` |
| Unpushed commits | 6 ✓ |
| Staging WebPs | 1008 ✓ |
| Old bg/ JPGs | 192 |
| Old bg/ size | 431M |
| Staging size | 181M |
| Vitest baseline | **4485 passed / 118 files** ✓ |

## Phase 2-5 — promote + OG regen (EXECUTED, SUCCEEDED)

Script ran cleanly through Phase 5:

- All 1,008 WebPs copied from staging to `assets/images/bg/<cond>/week_<1..4>/<time>/<1..7>.webp` ✓
- 191 old flat JPGs removed (8 OLD condition folders, max-depth 1) ✓
- `default.jpg` preserved at bg/ root ✓
- 144 per-slot non-empty spot-checks all passed ✓
- `og/*.jpg` regenerated from new WebP sources:
  - `og/cold-clear.jpg` 64.4 KB (NEW) ✓
  - 8 others refreshed ✓
  - 2 aliases (uv → clear, rain-possible → cloudy) copied ✓

## Phase 6 — post-promote vitest (FAILED → SCRIPT HALTED)

```
Test Files  1 failed | 117 passed (118)
     Tests  3 failed | 4482 passed (4485)
```

### Root cause (investigated)

Failing test file: `tests/og-image-share.test.js` (3 tests).
Error:
```
TypeError: u2 is not iterable
  at Gt (@vercel/og/dist/index.node.js:18262:31)
  at Ws (... :18331:42)
  at lI (... :20638:33)
  at render (... :21409:15)
```

This is a Satori-internal failure inside @vercel/og 0.11.1.

**Why it broke now:**

`api/og.js` lines 144-176 (`readBackgroundDataUrl`) try the OG-specific fallback chain from `assets/weather-visuals.js getOgBackgroundFallbackChain()`, which is:

```
1. assets/images/bg/<cond>/week_1/<time>/1.webp     (primary)
2. assets/images/bg/<cond>/week_1/day/1.webp        (time collapse)
3. assets/images/bg/clear/week_1/day/1.webp         (condition collapse)
4. assets/images/bg/default.jpg                     (last resort)
```

**Before promote:** steps 1-3 all 404 (no WebPs exist), step 4 reads `default.jpg`, JPEG embeds cleanly in `@vercel/og` → render succeeds. Tests pass.

**After promote:** step 1 succeeds (the new WebP exists), embeds the WebP data-URL into Satori → Satori 0.10.x (under `@vercel/og 0.11.1`) chokes on certain WebP encodings with `u2 is not iterable`. Render throws. Tests fail.

The tests weren't catching the WebP path before because there was nothing on disk to take that path.

### Impact if pushed without fix

`/api/og?lat=...&lon=...` would throw for EVERY share URL hitting production. WhatsApp / Twitter / Facebook share previews would degrade to whatever Vercel returns on a function crash (likely a 500 or empty preview). The middleware-rendered static OG cards (`/og/<cond>.jpg` referenced from index.html middleware) would still work — but the dynamic per-location card from `/api/og` would not.

This is a real production blocker, not a flaky test.

## Phase 7 onwards — NOT EXECUTED. ROLLED BACK.

Per task brief: "If anything is ambiguous or risky, HALT and ask Al rather than guessing."

### Rollback executed (clean)

| Action | Outcome |
|--------|---------|
| `rm -rf assets/images/bg/<cond>/week_<1..4>/` for all 9 buckets | All promoted WebPs removed |
| `rmdir assets/images/bg/cold-clear` | New empty cold-clear folder removed |
| `git checkout HEAD -- assets/images/bg/ og/ .gitattributes` | Old tracked JPGs and og/ restored; .gitattributes reset to text=auto |
| Verify | `find bg -name "*.webp"` = 0; `find bg -name "*.jpg"` = 193 (incl. wind/day_6.jpg restored from HEAD); 9 buckets; `npx vitest run` = **4485 passed** ✓ |

### Untracked artefacts intentionally KEPT for next iteration

- `docs/promote-plan-2026-05-24.md` (full plan)
- `docs/promote-review-2026-05-24.md` (round 1+2 review log)
- `docs/promote-report-2026-05-24.md` (this file)
- `docs/promote-commit-message.txt` (the commit message)
- `scripts/promote-image-library.sh` (the hardened script)
- `og/cold-clear.jpg` (the newly-generated cold-clear OG card — orphan now since source WebP rolled back, but the file content is good)

---

## Phase 7-9 — Re-run after OG fix (Option B applied)

After Al chose Option B (point api/og.js at static og/*.jpg files):

- `api/og.js`, `assets/weather-visuals.js`, `tests/og-paths.test.js` modified to use new `getOgStaticBackground*` helpers.
- 2-round codex-rescue adversarial review on the OG fix → SHIP verdict.
  See `docs/og-fix-review-2026-05-24.md` for the full review log.
- Re-ran `scripts/promote-image-library.sh`. All 7 phases passed:
  - Pre-flight: 1008 staging WebPs verified, 4501 tests baseline (4485 + 16 new OG-helper tests).
  - Copy: 1008 WebPs into `assets/images/bg/<cond>/week_<1..4>/<time>/<1..7>.webp`.
  - Delete: 191 old JPGs removed from 8 condition folders.
  - OG regen: 12 og/*.jpg refreshed including new `og/cold-clear.jpg`.
  - **Post-promote vitest: 4501 passing (zero regression)** — the OG fix DID resolve the @vercel/og + WebP failure.
  - Scoped `git add` staged exactly 1,222 files (1008 WebPs + 192 JPG deletes + 12 og files + 10 code/docs). Zero junk staged.
- Commit `f960705` created with full bundled changelog.
- Pushed to origin/main as a single push (`24210a5..f960705`).

## Phase 10 — Production verification (post-deploy)

Vercel auto-deploy `dpl_CrTZ7FyEFmYnMSyXzimYwBbfYzCF` for commit `f960705`:

- Polled with retry loop on `/assets/images/bg/cold-clear/week_1/day/1.webp` — 200 after ~20s.
- Full HTTP verification suite, all GREEN:

| # | Test | Result |
|---|------|--------|
| 1 | `/assets/images/bg/cold-clear/week_1/day/1.webp` | 200, `image/webp`, immutable 1-year cache ✓ |
| 2 | `/assets/images/bg/clear/week_2/dawn/3.webp` | 200, `image/webp`, immutable ✓ |
| 3 | `/og/cold-clear.jpg` | 200, `image/jpeg`, 7-day browser / 30-day CDN ✓ |
| 4 | `/og/uv.jpg` (round-1 preservation test) | 200, `image/jpeg` — dedicated file served, not collapsed to clear ✓ |
| 5 | `/api/og?lat=-34.1&lon=18.83&lang=en` (the WebP-breaking endpoint) | **200, `image/png`** ✓ |
| 6 | `/api/og?lat=-34.1&lon=18.83&lang=af` | 200, `image/png` — `?lang=` preserved ✓ |
| 7 | `/api/weather?lat=-29.1&lon=26.2` (Bloemfontein) | `ok:true`, condition derived ✓ |
| 8 | Root page `/` | 200, `text/html` ✓ |

The critical previously-failing case — `/api/og` for a Strand lat/lon — now returns a valid PNG share card. The WebP/Satori incompatibility is resolved by reading static JPEGs from `og/`.

## Final state

- **production:** healthy, serving 4-week WebP rotation + cold-clear backgrounds + per-condition dynamic OG cards + static OG card with new `og/cold-clear.jpg`
- **rollback artifacts preserved on disk:** `../pw-image-staging/compressed/` (181 MB), prior-deploy JPGs still in git history at `origin/main~1` and earlier
- **next steps for operator:** none. Deploy successful. Promote operation complete.

---

## Original HALT recommendation (kept for history)

The promote script worked exactly as designed. It caught a real production-breaking regression at the local-verification gate (Phase 6 vitest) before any push happened. **No production impact. HEAD unchanged. All 6 commits still queued for push.**

The blocker is the `api/og.js` ⇄ `@vercel/og 0.11.1` ⇄ WebP incompatibility. The promote operation surfaced it; the fix is a separate concern.

**Three options for next step (pick one):**

### Option A — Fix `api/og.js` to transcode WebP→JPEG in-process, bundle the fix into the promote commit. RECOMMENDED.

- Modify `readBackgroundDataUrl` (api/og.js:144) so when the candidate is a `.webp`, use `sharp` to read it as a buffer and re-encode to JPEG before base64.
- Sharp is already a dependency (used by `tools/build-og-images.mjs`).
- Add a unit test for the transcode path.
- Re-run the full promote (Phase 1-7) with the fix in place; expect 4488 tests pass (3 fixed + baseline).
- Single commit bundles asset migration + `api/og.js` fix.

**Risk:** sharp at runtime in Vercel Functions adds ~150ms cold start for OG cards. Acceptable.
**Time:** ~30 min code change + verification.

### Option B — Use static `og/<cond>.jpg` as `api/og.js` background source (skip dynamic per-condition WebP).

- Modify `api/og.js readBackgroundDataUrl` to read `og/<cond>.jpg` directly instead of bg/ WebPs.
- Lose time-of-day variation in dynamic OG cards (all dawn/day/dusk/night use the same canonical day image).
- Simpler change, no new dependency, no cold-start cost.

**Risk:** OG cards are slightly less rich. WhatsApp previews never showed time-of-day variation anyway because their crawler hits once and caches for ~30 days, so the user-facing impact is near-zero.
**Time:** ~10 min.

### Option C — Defer the promote entirely. Don't push the 6 commits yet.

- Working tree returns to exactly the pre-session state. Production keeps serving old flat JPGs (which are still tracked). Cold-clear is not live yet.
- Address the `@vercel/og` ⇄ WebP issue in a separate task before re-attempting promote.

**Risk:** none.
**Time:** zero now, full task re-execution later.

### Operator's lean

Option **A** is the cleanest end-state: asset migration AND OG renderer fixed in one atomic commit, single deploy, single verification window. Sharp's already in deps. The change is bounded.

But this is Al's call. **Halting and asking, per task brief.**
