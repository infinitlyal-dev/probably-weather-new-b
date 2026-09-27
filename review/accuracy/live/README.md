# Live accuracy recorder — real sources, real airports, every hour

Started 24 September 2026 (launch run). The backtest in `review/accuracy/` scores four of the five sources through stand-ins from Open-Meteo's archive. This records what **production actually served** at the six harness airports, next to what those airports reported, so forecast changes can be judged on the real thing.

## What it does

Once an hour, at ten past (Windows scheduled task **"ProbablyWeather accuracy recorder"**):

- `GET /api/version` once, then `GET /api/weather` at each airport's coordinates (FACT Cape Town, FAOR Johannesburg, FALE Durban, FAPE Gqeberha, FABL Bloemfontein, FAGG George — `lib/sources.mjs` CITIES) and at Al's two spots (Strand, Cape Town city), one retry at most;
- one METAR call to aviationweather.gov for all six stations (last 3 hours).

That is 8 forecast reads an hour (192 a day), the cost Al ruled fine. A read may be served from production's own cache (`meta.serverCache`), which is what a user in that spot would have seen.

## What our reads cost real users (27 September 2026)

Al's finding: in one day the live app answered 276 weather requests, almost all of them this recorder and our checks, and Tomorrow.io was skipped on 91 of them (the name lookup on some). From the data here: every run got Tomorrow.io on exactly 3–6 of its 8 reads, never 7 or 8 — the fingerprint of Tomorrow.io's **3 requests a second** ceiling hit by eight fan-outs fired in the same second, not of a spent daily allowance (the log line said only "over ceiling"; it now names the window). So:

- every weather read carries **`own=1`**: production makes no LocationIQ call for it (no name lookup, no `?reverse=1`), gives it Tomorrow.io only under **our own cap — 4 an hour, 96 a day** (`api/_lib/provider-budget.js` `OWN_TRAFFIC_BUDGETS`; 16% of the free 25/hour and 19% of the 500/day, so real users keep 21/hour and 404/day), never caches its answer for the cell or at the edge, and never leads a cell or takes its lock, so a real user arriving in the same 2 km cell fetches for themselves at once. The flag bypasses no rate limit and no budget;
- every read also carries **`name=<the place>`**, which the server as it stands already takes as "no lookup needed" (a caller's name is never cached for anyone else: the cell caches `Unknown`, which the app resolves itself) — so LocationIQ is spared from the first run, before the `own=1` release ships;
- the eight reads go out **0.4 s apart**, inside 3 a second, and **which place goes first turns with the hour**, so under the own cap every place gets the radar in half its hours.

Radar sample (`review/accuracy/v4/radar.mjs`): a radar-alone "Rain's here" came on ~9% of the reads that had Tomorrow.io (19 of 213, 24–27 Sept). At 4 Tomorrow.io reads an hour that is ~8 readings a day in a showery week like this one (~60 a week), about the pace the sample grew at before; a dry week gives few at any cap. `score.mjs` reads `now`, `daily`, `hourly` and `meta` only — never `location.name` — so scoring is unchanged.

**After changing `record.mjs`, re-run the installer** (below): the scheduled task runs the copy in `%USERPROFILE%\pw-accuracy-recorder\`, not this file.

Each run appends one JSON line per airport to `review/accuracy/live/<SAST date>.jsonl` (the served payload: now, 7 days, the next 48 hours, `meta` with every source's vote, description, today's range and weight; plus that station's METAR reports) and one line to `recorder.log`. About 2 MB a day. The data files are git-ignored.

**What production does not expose (yet):** each source's own temperature, rain chance and wind. Production's `meta` carries each source's condition vote and today's min/max only. From the release after `e7d1260`, `meta.sourceNow` / `meta.sourceToday` carry the rest and the recorder keeps them automatically.

## Where it runs

- Script: a copy of `record.mjs` in `%USERPROFILE%\pw-accuracy-recorder\` (so it keeps running whatever branch the repo is on). The copy in this folder is the source of truth; re-run the installer after changing it.
- Data: `C:\Users\27741\OneDrive\Desktop\Probably weather new\probably-weather-new-c\review\accuracy\live\`.
- It may wake the PC for its reading (the task's "Wake the computer to run this task", Al's YES of 25 Sept 2026) — but Windows honours that only while the power plan allows wake timers, and on this PC "Allow wake timers" is **Disable** (checked 25 Sept, plugged in and on battery). To let it wake: Control Panel → Power Options → Change plan settings → Change advanced power settings → Sleep → Allow wake timers → Enable. Until then it runs only while the PC is awake, and after a sleep it runs once when the PC wakes, so the log shows a gap for the hours asleep. To stop it waking the PC: `$t = Get-ScheduledTask 'ProbablyWeather accuracy recorder'; $t.Settings.WakeToRun = $false; Set-ScheduledTask -InputObject $t`.
- The eight reads go out 0.4 s apart; a run takes a few seconds. If OneDrive is holding the day file, a line goes to `held-<date>.jsonl` beside the script in `%USERPROFILE%\pw-accuracy-recorder\` instead of being lost.

## Install / reinstall

```powershell
powershell -ExecutionPolicy Bypass -File review\accuracy\live\install-recorder.ps1
```

## Stop it

```powershell
Unregister-ScheduledTask -TaskName 'ProbablyWeather accuracy recorder' -Confirm:$false
```

(To pause instead: `Disable-ScheduledTask -TaskName 'ProbablyWeather accuracy recorder'`; `Enable-ScheduledTask` resumes.) Delete `%USERPROFILE%\pw-accuracy-recorder\` afterwards if you like; the data stays in `review\accuracy\live\`.

## Check it is running

```powershell
Get-ScheduledTask -TaskName 'ProbablyWeather accuracy recorder' | Get-ScheduledTaskInfo
Get-Content 'C:\Users\27741\OneDrive\Desktop\Probably weather new\probably-weather-new-c\review\accuracy\live\recorder.log' -Tail 5
```

## Score it

```
node review/accuracy/live/score.mjs            # reads every *.jsonl here (or --dir <folder>)
```

A replayed (cached) payload keeps the numbers of the moment it was computed, while its `meta.localHour` is refreshed: the scorer aligns every record on `meta.updatedAtLabel`, never on `localHour`.

`results/live-score.md`: served condition vs the airport's report in the same hour, the served high/low vs the observed max/min, the rain-chance calibration, per source where production exposes it.

**Al's note, checked from 25 Sept 2026 on** (`review/rain-fog-frost-ruled.json`): *"it has been showing fog a lot when it isnt really that foggy and the rain thing i noticed the last couple of days and it felt off."* The score's last section counts it per release (`servedVersion`): fog shown against fog or mist at the airport, "Rain's here" and "Showers nearby." (`conditionReason` `showers-nearby`) against rain at the airport that hour or the next, and Strand and Cape Town city's fog and rain calls (no station there, counted only). The served rule is in `meta.conditionConfidence.fogSignal.rule` and `.rainRule`.
