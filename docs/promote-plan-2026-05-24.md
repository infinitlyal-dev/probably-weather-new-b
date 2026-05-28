# Promote Plan — Image library v2 + cold-clear

Date: 2026-05-24.
Operator: Vos (Claude Opus 4.7) executing autonomously under Al's task brief.
Target: promote 1,008 staged WebP images + 6 unpushed commits to production at https://www.probablyweather.co.za.

**Status when this plan was written:** PLAN ONLY — adversarial review pending, no files moved.

---

## 0. Reconnaissance summary (facts the plan is built on)

| Fact | Value | Source |
|------|-------|--------|
| Unpushed commits | **6** (Al said 5 — the `1fae7b2 pw-image-system v2.6.2` doc commit is also pending) | `git log origin/main..HEAD` |
| Staging location | **OUTSIDE the repo** at `../pw-image-staging/compressed/` (sibling to repo). Al's brief said `pw-image-staging/compressed/` which read as repo-relative; actual path is one level up. | `find / -iname "*staging*"` |
| Staging integrity | 9 conditions × 4 weeks × 4 times × 7 files = **1,008 WebPs**, all 144 slots have exactly 7 files | per-slot count check |
| Staging size on disk | 181 MB (matches Al's ~177 MB estimate) | `du -sh` |
| Current `assets/images/bg/` | 9 folders (clear cloudy cold fog heat rain storm wind) × ~24 JPGs each + `default.jpg` at root = ~193 files, 431 MB. No `cold-clear/` folder yet. | `ls`, `du -sh` |
| Picker contract | `assets/images/bg/<cond>/week_<1..4>/<dawn\|day\|dusk\|night>/<1..7>.webp` — exact match to staging tree | `assets/image-picker.js` |
| cold-clear in picker `KNOWN_FOLDERS` | ✓ present | picker line 19-21 |
| `cold-clear` fallback | `getWeatherBackgroundFallbackFolder('cold-clear')` → `'clear'` (not `'cold'`) | `assets/weather-visuals.js:22` |
| `default.jpg` (final picker fallback) | exists at `assets/images/bg/default.jpg` — **MUST PRESERVE** | picker line 86 |
| SW cache version | `pw-v2026-05-26-001` — already bumped in commit `3001275`, **DO NOT double-bump** | `sw.js:13` |
| SW image matcher | already includes `.webp` (line 214) | `sw.js` |
| `vercel.json` `/assets/images/(.*)` | immutable 1-year header covers `.webp` via wildcard ✓ | `vercel.json:22-26` |
| `.vercelignore` | does **not** exist — but staging is OUTSIDE repo so irrelevant | filesystem |
| `.gitignore` excludes staging? | does not need to — staging is outside repo | `.gitignore` |
| LFS | configured (filter.lfs.required = true) but **0 files tracked**, no `.gitattributes` rules for `.jpg`/`.webp` — files are plain git blobs | `git lfs ls-files`, `.gitattributes` |
| Existing prod JPGs in git history | 431 MB of regular git blobs (not LFS) | `du -sh`, no LFS |
| Tests baseline | **4,485 passing / 118 files** — green right now | `npx vitest run` |
| OG generator (`tools/build-og-images.mjs`) | reads `assets/images/bg/<cond>/week_1/day/1.webp`, writes `og/<cond>.jpg`. Dependency: WebPs MUST be in place **before** running. | tool source |
| `og/` folder now | 11 JPGs (no `cold-clear.jpg`) | `ls og/` |
| middleware allowlist | already includes `cold-clear` | `middleware.js:20-22` |

---

## 1. Pre-promote state capture

Record these to `docs/promote-report-2026-05-24.md` BEFORE any move:

- `git rev-parse HEAD` (should be `2377ac1` at plan write-time)
- `git rev-parse origin/main` (the rollback target)
- `git log --oneline origin/main..HEAD` (the 6 commits to ship)
- `find assets/images/bg -type f | wc -l` (current file count = baseline)
- `find assets/images/bg -type f -name "*.jpg" | sort > /tmp/pre-jpgs.txt` (the list to delete, minus `default.jpg`)
- `find ../pw-image-staging/compressed -type f -name "*.webp" | wc -l` (expect 1008)
- `du -sh assets/images/bg` (size before)
- `npx vitest run 2>&1 | tail -3` (must show `4485 passed`)

Halt if:
- Test count is ≠ 4,485 (regression — fix first)
- WebP count is ≠ 1,008 (staging incomplete)
- `git status --short` has unexpected staged changes (only the pre-existing `D wind/day_6.jpg` deletion is allowed)
- `default.jpg` missing

---

## 2. The move operation (the script: `scripts/promote-image-library.sh`)

**Strategy: copy, not move.** Staging is preserved on disk as in-place rollback source. Cost: 181 MB extra disk, worth it.

### 2a. For each of the 9 conditions:

```
SRC=../pw-image-staging/compressed/<cond>
DST=assets/images/bg/<cond>
```

1. `mkdir -p $DST/week_{1,2,3,4}/{dawn,day,dusk,night}`
2. `cp -r $SRC/week_1/* $DST/week_1/`
3. `cp -r $SRC/week_2/* $DST/week_2/`
4. `cp -r $SRC/week_3/* $DST/week_3/`
5. `cp -r $SRC/week_4/* $DST/week_4/`
6. Verify: `find $DST -name "*.webp" | wc -l` == 112

### 2b. Delete old flat JPGs (PER condition, NOT including `default.jpg`)

For each of the 8 OLD condition folders (`clear cloudy cold fog heat rain storm wind` — NOT `cold-clear` since it has no old files):

```
find $DST -maxdepth 1 -type f -name "*.jpg" -delete
```

This removes the old flat `dawn_*.jpg`, `day*.jpg`, `dusk_*.jpg`, `night_*.jpg` files but leaves the new `week_*/` subdirectories untouched.

**Explicit guards:**
- Use `-maxdepth 1` to NEVER touch files inside `week_*/`
- `assets/images/bg/default.jpg` is at the bg/ root not inside any condition folder — UNTOUCHED by per-condition deletes
- `cold-clear/` folder: skip the delete step (no old flat files to remove)

### 2c. Post-condition verification

For each condition, assert:
- `find DST -mindepth 4 -maxdepth 4 -type d | wc -l` == 16  (4 weeks × 4 times)
- For each of those 16 dirs, `ls | wc -l` == 7
- For OLD conditions: `find DST -maxdepth 1 -type f -name "*.jpg" | wc -l` == 0
- `test -f assets/images/bg/default.jpg`  ← FINAL fallback intact

### 2d. Top-level invariant

- `find assets/images/bg -name "*.webp" | wc -l` == 1008
- `find assets/images/bg -maxdepth 1 -type f | wc -l` == 1  (only `default.jpg`)
- `find assets/images/bg -name "*.jpg" -not -name "default.jpg" | wc -l` == 0

If any assertion fails: HALT, do not proceed to OG / commit / push.

---

## 3. OG static regeneration

Run **after** images are in place:

```
node tools/build-og-images.mjs
```

This script:
- Reads `assets/images/bg/<cond>/week_1/day/1.webp` for each of 9 conditions + the explicit `default` entry (uses `clear/week_1/day/1.webp`)
- Writes `og/<cond>.jpg` (1200×630, ≤300KB JPEG)
- Copies aliases: `og/clear.jpg → og/uv.jpg`, `og/cloudy.jpg → og/rain-possible.jpg`

Expected output: 9 condition files + 2 alias files + `default.jpg` = **12** `og/*.jpg` files (was 11 before; `cold-clear.jpg` is new).

Verify:
- `ls og/*.jpg | wc -l` == 12
- `og/cold-clear.jpg` exists and is non-zero
- All `og/*.jpg` mtimes within last 60s

---

## 4. SW cache version bump

**Already done in commit `3001275`** (version `pw-v2026-05-26-001`). 
**Do NOT** bump again — double-bumping would invalidate the cache twice for no reason.

Verification step: `grep CACHE_VERSION sw.js | head -1` should print `const CACHE_VERSION = 'pw-v2026-05-26-001';`

---

## 5. `vercel.json` and `.vercelignore`

- `vercel.json` `/assets/images/(.*)` immutable cache header already covers `.webp` ✓ (no change)
- Vercel auto-detects `.webp` MIME via file extension — no explicit `Content-Type` header needed
- `.vercelignore` not required because the staging tree is OUTSIDE the repo (one directory up). Git can't see it. Vercel can't see it. No risk of accidental deploy.

Verification: `git status --porcelain | grep "pw-image-staging" | wc -l` == 0

---

## 6. Local pre-push verification

After promote + OG rebuild, BEFORE commit:

1. `npx vitest run` — expect `4485 passed` (zero regression). The picker tests assert path string shapes; they pass regardless of filesystem state, but a regression in any other module would fail here.
2. `node --input-type=module -e "import('./assets/image-picker.js').then(m => { const p = m.buildPickerPaths('cold-clear','clear','day',2,3); console.log(p[0]); })"` — primary path must exist as a real file (`test -f` it)
3. Spot-check 10 random paths from random buckets/weeks/times exist as files
4. `node tools/build-og-images.mjs` — re-run if not run; output `cold-clear.jpg` line should appear and the script exits 0
5. `git status --short` should show:
   - Untracked: 1,008 new `.webp` files under `assets/images/bg/*/week_*/`
   - Deleted: ~192 old `.jpg` files under `assets/images/bg/<cond>/`
   - Modified: 9 of 12 `og/*.jpg` files (regenerated) + 1 new (`og/cold-clear.jpg`)
   - The pre-existing `D wind/day_6.jpg` from before the session
   - NO unexpected modifications to source code

---

## 7. Git operations

### 7a. Stage explicitly

Use **explicit `git add` paths** — never `git add -A` (which would sweep the leftover untracked `.agents/`, `eval/`, `NATIVE_REVIEW_*` files):

```
git add assets/images/bg/
git add og/
```

Verify cleanly: `git status --porcelain | grep -v "^A\|^M\|^D" | wc -l` should be 0 in the staged area (only A/M/D entries staged).

### 7b. Commit

Single commit message:

```
Promote image library to production — 1,008 WebP, 4-week rotation, cold-clear live

- 1,008 WebPs at assets/images/bg/<cond>/week_<1..4>/<time>/<1..7>.webp
- 9 buckets including new cold-clear
- ~192 old flat JPGs removed; default.jpg fallback preserved
- og/ regenerated from new WebP sources (cold-clear.jpg new)
- Picker code + cold-clear condition + cold-clear copy already
  committed in HEAD; this commit makes the asset tree match.
```

### 7c. Push

Single push of all 7 commits (6 pre-existing + 1 promote):

```
git push origin main
```

This triggers Vercel auto-deploy.

---

## 8. Rollback plan

**Trigger:** Vercel deploy ERRORs, or post-deploy verification fails (default fallback served for >30s, OG cards 404, broken images visible on the live site).

### 8a. Quick rollback (revert the promote commit only)

If the picker code (committed in `3001275`) is fine and only the promote needs reverting — unlikely scenario but possible if e.g. a build hook rejects large binaries:

```
git revert HEAD --no-edit
git push origin main
```

Vercel redeploys the prior state in ~2 minutes.

### 8b. Full rollback (revert ALL 7 commits — back to last known-good)

If the picker code itself is broken on production:

```
git reset --hard 1fae7b2~1   # one commit before the first unpushed
git push --force-with-lease origin main
```

`1fae7b2~1` is the last commit that was already on origin/main before this session's work started. `--force-with-lease` is safer than `--force` — it'll refuse if anyone else pushed in the meantime.

### 8c. Confirm rollback worked

- Vercel deploy READY at the prior SHA
- `curl -fsS https://www.probablyweather.co.za/assets/images/bg/clear/day_1.jpg -o /dev/null` succeeds (the pre-promote URL works again)
- Browser hit to live URL renders the prior background flow

---

## 9. Production verification (post-push, post-deploy-READY)

1. Watch Vercel deploy via `mcp__85d9139c-...__list_deployments` — wait for status `READY`. If `ERROR`: trigger rollback 8b.
2. `curl -fsS -I https://www.probablyweather.co.za/assets/images/bg/clear/week_1/day/1.webp` — expect `200`, `Content-Type: image/webp`, `Cache-Control: public, max-age=31536000, immutable`
3. `curl -fsS -I https://www.probablyweather.co.za/assets/images/bg/cold-clear/week_1/day/1.webp` — same
4. `curl -fsS -I https://www.probablyweather.co.za/og/cold-clear.jpg` — expect `200`, `Content-Type: image/jpeg`
5. `curl -fsS "https://www.probablyweather.co.za/api/weather?lat=-29.1&lon=26.2"` — Bloemfontein weather; in winter conditions could return `condition: cold-clear`; cosmic always returns 200
6. Visual browser check at `https://www.probablyweather.co.za/`: page renders, bg image loads (network panel shows a `.webp` from `/assets/images/bg/<cond>/week_<N>/<time>/`), no console errors
7. Mobile/iOS check: same URL on iOS Safari, confirm `.webp` loads (not octet-stream) — Vercel sets `image/webp` automatically; iOS 14+ supports it

---

## 10. Risks identified BEFORE adversarial review

These are concerns the operator has already considered. Adversarial review should still find more.

1. **Commit size:** ~181 MB of new binary blobs in one commit. GitHub's hard push limit is 2 GB; single-file warning at 50 MB; we're far below both. But `git push` of 181 MB on a residential connection could take several minutes. Mitigation: `git push --progress` so the operator sees progress.
2. **Stale CDN edge nodes** during the deploy window: Vercel's edge CDN may serve a stale `index.html` for ~30s after deploy. If a user happens to hit during that window AND their browser already has the new SW (post-push), the SW will request the new `.webp` paths — but the edge might still serve the old build's manifest. Risk window is brief; the immutable cache means once the user has the new WebPs they're fine forever.
3. **Service worker propagation lag:** Users with `pw-v2026-05-25-XXX` or earlier already cached will keep serving stale image cache until SW updates. The new SW (v2026-05-26-001) on activate calls `caches.delete()` for non-current versions (verified by reading SW lines 1-15 — version bump implies cache purge). Risk: low.
4. **OG cards on share preview platforms** (WhatsApp, Twitter) often cache for 30 days. After deploy the new `og/cold-clear.jpg` will exist; existing shares of OTHER conditions get fresh content but cached previews persist. Acceptable.
5. **Cold-clear sibling fallback to `clear`:** if a cold-clear primary 404s for any reason, chain falls to `clear/week_1/<time>/1.webp`. Clear is heavily promoted (112 files). Safe.
6. **`default.jpg` is JPG not WebP:** intentional. It's the last-resort fallback. Path encoded in picker line 86 as a hard string. Survives.
7. **`pw-image-staging/` is on OneDrive:** OneDrive sync state could be partial. `find` shows 1008 files locally so it's complete at script-run time, but if OneDrive starts a sync mid-copy we could get partial files. Mitigation: `cp` finalizes file-by-file; even if OneDrive interrupts, we get N complete files not N corrupted ones. We verify file count after.
8. **Windows path / case-sensitivity:** the conditions `cold-clear` with hyphen — verified the staging folder is literally `cold-clear` (not `coldclear`, `cold_clear`, `Cold-Clear`). Windows FS is case-insensitive but git is case-sensitive. cp preserves case. Picker uses lowercase. Match.

---

## 10b. Round 1 review applied (2026-05-24)

Codex-rescue adversarial review returned 24 findings. Operator's response:

**Applied to script + repo (8 findings):**
- #9 MAJOR — `.gitattributes` now has `*.webp binary` + 9 other binary types (was only `* text=auto`)
- #15/#16/#17 MAJOR — script switched from `-f` to `-s` (file-exists + non-empty), per-file post-copy non-empty assertion, primary OneDrive-placeholder race guard
- #22 MINOR — `num()` helper strips whitespace from `wc -l` output before integer compare (Git Bash padding)
- #4 CRITICAL — script now does scoped `git add -- assets/images/bg/ og/ .gitattributes` itself (no manual operator `git add` step)
- #5 CRITICAL — preflight untracked-files allowlist halts on any unexpected untracked path
- #6 CRITICAL — preflight asserts exactly 6 unpushed commits and prints SHAs
- #13 MAJOR — defensive `|| true` on every grep pipeline
- #19 MAJOR — spot-check expanded from 5 to 144 files (one per cond × week × time)

**Rejected with reasoning (8 findings):**
- #1 CRITICAL — claim that picker contract wasn't proven. Picker's `KNOWN_FOLDERS`/`safeWeek`/`safeR` ranges are static constants (1..4, 1..7, exactly our 9 folders incl. `cold-clear`); the match is provable by inspection (already done in §0 fact table). Adding a runtime import of the picker would not add safety.
- #11 MAJOR — claim that `*.webp` / `*.jpg` globs are unquoted in `find`. Re-read: every `find ... -name '*.webp'` IS quoted in the script. Codex hallucinated this one.
- #12 MAJOR — claim that path variables are unquoted. Every `$STAGING`, `$DEST_BASE`, `$REPO_ROOT`, `$src`, `$dst` IS double-quoted. Hallucinated.
- #14 MAJOR — claim that `REMOVED_TOTAL=$((expr))` arithmetic could exit non-zero on a 0 result. False — only the bare `(( expr ))` compound command form exits non-zero on 0; the `x=$((expr))` assignment form always succeeds.
- #18 MAJOR — OG generation order already enforced (Phase 5 runs after Phase 4 invariants).
- #8 MAJOR — claim that 181 MB push without LFS is unsafe. GitHub's per-file limit is 100 MB; individual WebPs are ~few-hundred KB. Push total time on Al's connection is ~3-15 min depending on uplink. Within tolerance. LFS migration would change the deploy architecture and adds more risk than it removes.
- #2/#3/#20/#21 CRITICAL/MAJOR — two-phase additive-then-destructive deploy recommendation. Acknowledged as good general release-engineering advice, but Al's brief explicitly mandates single-deploy: the picker code (3001275), cold-clear wiring, copy, and asset tree must all land together so the SW v14 activate + new IMG_CACHE start + new picker requests new paths is one atomic state transition from the user perspective. A two-phase deploy would mean phase-1 ships images with the OLD picker (unable to read them) and phase-2 swaps picker code (causing exactly the same user-visible transition window in reverse). Net risk equivalent; coordination cost doubled. Single deploy accepted.

**Operator-side actions remaining (not script changes):**
- #7 CRITICAL — Vercel deploy verification. Documented in §9; operator runs post-push.
- #10 MAJOR — Live MIME smoke-test. Documented in §9 step 2.
- #23/#24 MINOR — vitest parser format / wind/day_6.jpg exception. Accepted as low-impact tech debt.

## 11. Open questions / explicit HALT points

- If adversarial review surfaces a critical issue → HALT, fix plan, re-review, do not execute.
- If staging file count drops below 1008 during pre-flight → HALT (OneDrive sync mid-session?).
- If post-promote test count drops below 4485 → HALT.
- If `og/cold-clear.jpg` size is 0 bytes after build-og-images.mjs → HALT.
- If Vercel deploy status is not READY within 5 minutes of push → start rollback evaluation.
- If post-deploy a real browser at the live URL shows the default fallback (`/assets/images/bg/default.jpg`) instead of a per-condition image → trigger rollback 8b.

Operator commits to reporting at each phase boundary.
