# Logs — where to look

Written 2026-09-15. Vercel keeps about a day of request logs on this plan; 14-day metrics are Observability Plus (paid, not enabled). Longer history comes from a log drain to Axiom.

## Status

**Not installed yet.** The drain needs two things only Al can do: create the Axiom account, and approve the Axiom integration on Vercel (an OAuth consent screen). Everything below is ready for that five-minute job.

## Why Axiom

| | Axiom — Personal (free) | Better Stack — free |
|---|---|---|
| Log ingest | 500 GB / month | 3 GB / month |
| Retention | 30 days | 3 days (30 days is paid) |
| Card needed | no | — |
| Vercel | Marketplace integration installs the drain itself | — |

Sources: [axiom.co/pricing](https://axiom.co/pricing), [betterstack.com/pricing](https://betterstack.com/pricing), both read 2026-09-15. Better Stack's free tier does not give 30 days, so it does not fit the brief.

## What it costs on the Vercel side

Drains are a Pro feature (this team is on Pro) billed at **$0.50 per GB drained**, measured as uncompressed JSON ([vercel.com/docs/drains](https://vercel.com/docs/drains)). Measured volume today: **9 runtime log lines in the last hour** of production (8 info, 1 error). Request logs add one record per request, roughly 1–2 KB each. At a million requests a month that is 1–2 GB, i.e. about **$0.50–$1 a month**. Check the real figure under Vercel → Usage → Drains after the first week.

## Install (Al, once)

1. Open [vercel.com/integrations/axiom](https://vercel.com/integrations/axiom) → **Add Integration**.
2. Sign up to Axiom when asked (the free Personal plan; no card).
3. Scope: team **Albert Snyman's projects**, project **probably-weather-new-b** only.
4. Approve. Axiom creates a drain in the Vercel project and a dataset named **`vercel`**.
5. In Axiom, open the `vercel` dataset → Settings → confirm retention reads **30 days**.

Then tell the next session "drain installed"; it verifies with the checks below and marks this file done.

## Verify events are arriving

1. Open [www.probablyweather.co.za/api/version](https://www.probablyweather.co.za/api/version) and one forecast, e.g. [/api/weather?lat=-34.1163&lon=18.8362](https://www.probablyweather.co.za/api/weather?lat=-34.1163&lon=18.8362).
2. In Axiom → Query, run:

```
['vercel']
| where _time > ago(15m)
| where ['request.path'] startswith "/api/"
| project _time, ['request.path'], ['request.statusCode'], ['vercel.source']
| order by _time desc
```

Rows for `/api/version` and `/api/weather` within a minute or two mean the drain works. Vercel → Settings → Drains should show the Axiom drain as **enabled**, not errored.

## Where to look

| Question | Query in Axiom (`['vercel']` dataset) |
|---|---|
| Errors today | `where ['level'] == "error" and _time > ago(1d)` |
| A provider failing | `where message contains "[pw-source-fail]"` |
| Budget skips (LocationIQ, providers) | `where message contains "[pw-budget]"` |
| Share previews without a place | `where message contains "[pw-share-name]"` |
| CSP violations | `where message contains "[pw-csp]"` |
| Status codes by route | `summarize count() by ['request.path'], ['request.statusCode']` |
| Volume per day | `summarize count() by bin(_time, 1d)` |

The greppable prefixes are the ones the code already logs: `[pw-source-fail]` and `[pw-budget]` in `api/weather.js` and `api/geocode.js`, `[pw-share-fail]` and `[pw-share-name]` in `api/share.js`, `[pw-og-fail]` in `api/og.js`, `[pw-csp]` from `/api/csp-report`.

For the last few hours without Axiom: Vercel → project → **Logs**.
