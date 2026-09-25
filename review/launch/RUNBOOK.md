# When something breaks — Probably Weather launch runbook

Plain steps for Al. Nothing here needs code.

## Roll back a bad release (one step)

Vercel → the **probably-weather-new-b** project → **Deployments** → the production deployment *before* the bad one → **⋯** → **Instant Rollback**. The old version is live again within seconds; nothing is rebuilt.

(On the Hobby plan Vercel rolls back only to the deployment just before; on Pro, to any earlier one. The git way also works and takes about two minutes: `git revert <sha>` and push to `main`.)

After a rollback, a later push goes live again as normal.

## Switch one weather source off (no new code)

1. Vercel → project → **Settings** → **Environment Variables** → add `PW_SOURCES_OFF` for **Production**, value the source: `tomorrow`, `pirate`, `weatherapi`, `met` or `open-meteo` (several with commas: `tomorrow, pirate`).
2. **Deployments** → the current production deployment → **⋯** → **Redeploy**. It takes about two minutes.

The app stops asking that source and blends the rest; the Sources page says it is "sitting this one out". To switch it back on, delete the variable and Redeploy. A misspelt name switches nothing off and says so in the logs (`[pw-sources-off] … names no source`).

## Alerts

Every 30 minutes GitHub reads the live site and `/api/health` (it calls no weather provider). When something is wrong it opens an issue titled **[PW alert] …** in the repository and mentions you, so GitHub emails you. The issue closes itself when the problem is gone.

**Once, right after the push that brings this in:** GitHub → the repository → **Actions** → **Launch alert** → **Run workflow**. The run's log should end with "healthy at …". GitHub runs the 30-minute schedule only from `main`, so it starts only once this is on `main`.

Two known gaps (fixes waiting for a reviewed session): while `/api/health` itself is down, the other open alerts are closed and reopened when it answers again (extra emails, nothing missed); and if Upstash is ever unplugged from the project entirely, the page says "not configured" and no alert fires for it.

| alert | what it means | what to do |
|---|---|---|
| The site is down | the home page does not answer | if a release just went out, roll it back |
| The health check is not answering | the API may be down | open the app; if the forecast does not load, roll back |
| The shared cache (Upstash) is failing | usually "max requests limit exceeded": the free Upstash plan is used up. The app still works, but every visit then asks the providers | switch Upstash to pay-as-you-go (money page) |
| N forecasts failed in the last hour | people are seeing "Couldn't fetch weather" | if a release just went out, roll it back; otherwise check Vercel → Logs |
| *Source* is failing | one provider keeps erroring; the app carries on without it | if it lasts, switch it off (above) |
| *Source* has used 90 % of today's allowance | a busy day; the app keeps working without it until the next UTC day | if it happens daily, that source's paid plan (money page) |
| Open-Meteo has used 80 % of this month's plan | the main source's paid plan is nearly used | Open-Meteo Professional before it runs out |

Vercel also emails you as usage nears the plan's limits (all plans); on Pro, Vercel's own error-spike alerts can be switched on under the project's **Alerts** as well.

## How many people came

Vercel → project → **Analytics**. It counts visits without cookies. The Hobby plan includes 50,000 events a month; after that it stops counting until the month turns (Pro counts on, at about $0.03 per 1,000).

## Numbers behind this page

`review/launch/results/` (load test, visit cost, speed) and `review/accuracy/` (forecast).
