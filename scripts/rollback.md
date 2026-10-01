# Rollback — putting the previous version live

Probably Weather deploys from GitHub: every push to `main` becomes a production deployment on Vercel within about two
minutes. If a release goes wrong, there are two ways back. Both were checked on 1 October 2026 (section 3).

Project: Vercel **probably-weather-new-b**, team **albert-snymans-projects** (projectId `prj_DkYaenXGD5TANTVLyEwn1NG06BF7`,
teamId `team_yiwk7JTdU3fdQVwcuOmsEVlT`). Live: https://www.probablyweather.co.za. The version that is live answers at
https://www.probablyweather.co.za/api/version (the git commit SHA; the app's Settings screen shows the same short SHA).

## 1. Vercel's own rollback (seconds, nothing rebuilt) — first choice

Vercel keeps every production deployment. Rolling back points the domain at an earlier one; nothing is rebuilt, so it
takes seconds. The project is on Vercel Pro, so any earlier production deployment can be chosen, not only the last one.

In the dashboard:
1. https://vercel.com/albert-snymans-projects/probably-weather-new-b/deployments
2. Find the production deployment *before* the bad one (the list shows the commit message and time).
3. Its **⋯** menu → **Instant Rollback** → confirm.
4. Check: https://www.probablyweather.co.za/api/version shows the earlier commit's SHA.

From Claude Code, with the Vercel connector (the tools named `mcp__…__list_deployments` and `mcp__…__request_rollback`):
1. `list_deployments` with `projectId prj_DkYaenXGD5TANTVLyEwn1NG06BF7`, `teamId team_yiwk7JTdU3fdQVwcuOmsEVlT`,
   `target production`, `limit 5` — each row has the commit SHA and message; `isRollbackCandidate: true` marks the ones
   that can be rolled back to.
2. `request_rollback` with the same projectId and teamId and the `deploymentId` (`dpl_…`) of the deployment to go back to.
3. Confirm with `/api/version`.

A rollback does not change `main`. The next push to `main` goes live as normal, so fix the code (or revert it, section 2)
before pushing again, or the bad release comes straight back.

## 2. Git revert and push (about two minutes, rebuilds) — when the dashboard is not to hand

This undoes the bad commit in git and lets Vercel deploy the result. It also fixes `main`, so later pushes stay good.

```bash
cd C:\Users\27741\pw-launch-run
git switch main
git pull --ff-only origin main
git revert --no-edit <sha-of-the-bad-commit>
git push origin main
```

If the bad release is several commits, revert each (newest first) or `git revert --no-edit <oldest-bad>^..<newest-bad>`.
Never `git reset`/`--force` on `main`: a force-push loses history and the recorder's and jobs' clones go out of step.

Watch the deployment at https://vercel.com/albert-snymans-projects/probably-weather-new-b/deployments (or
`list_deployments` as above); when it reads READY, https://www.probablyweather.co.za/api/version shows the revert's SHA.
The service worker picks the new build up on the next open (sw.js carries the commit SHA as its BUILD_ID).

## 3. Proof — the drill on a preview deployment (1 October 2026)

Run on the branch `rollback-drill`, never on production:
1. A "bad release" marker commit `abc3632` (one text file) was pushed; Vercel built preview
   `probably-weather-new-7dr7z2hy5-albert-snymans-projects.vercel.app`; its `/api/version` answered
   `abc3632d939fdc5fb372e4eb25327ec44032ae94`.
2. `git revert --no-edit abc3632` → `1dc0169`, pushed; Vercel built preview
   `probably-weather-new-mzjo3ih3p-albert-snymans-projects.vercel.app`; its `/api/version` answered
   `1dc0169b32724de7ae5746873a38a25d34b4a9b3` and the marker file was gone — the git path (section 2) works end to end
   against Vercel's build. Pushed 21:48:45 UTC; Vercel started the build at 21:48:47 and the revert preview was READY and answering the new SHA by 21:51 — under three minutes.
3. Vercel's Instant Rollback (section 1) only applies to production, so it cannot be drilled on a preview; its two tools
   (`list_deployments` showing `isRollbackCandidate`, `request_rollback`) were confirmed reachable from this machine on
   1 October 2026 (`list_deployments` returned the live production deployments with their SHAs). The Vercel docs
   (vercel.com/docs/deployments/rollback-production-deployment, read 1 Oct 2026) describe the same two steps.

## 4. The prompt — paste into Claude Code as it is

```
Probably Weather is broken after a release. Roll production back to the previous good version, following
C:\Users\27741\pw-launch-run\scripts\rollback.md exactly.
1. Read https://www.probablyweather.co.za/api/version and note the live SHA.
2. Use the Vercel connector: list_deployments (projectId prj_DkYaenXGD5TANTVLyEwn1NG06BF7, teamId
   team_yiwk7JTdU3fdQVwcuOmsEVlT, target production, limit 5). Pick the newest READY production deployment whose SHA is
   NOT the live one, show me its commit message, then request_rollback to it with the same projectId and teamId.
3. Wait until https://www.probablyweather.co.za/api/version returns that deployment's SHA, then open
   https://www.probablyweather.co.za/?lang=en and confirm the forecast loads.
4. If the Vercel connector is not available or step 2 fails, do section 2 of rollback.md instead: in
   C:\Users\27741\pw-launch-run run git switch main, git pull --ff-only origin main, git revert --no-edit <live SHA>,
   git push origin main, and wait for /api/version to show the revert's SHA.
5. Tell me in three lines: what was live, what is live now, and which way you used. Do not touch anything else.
```
