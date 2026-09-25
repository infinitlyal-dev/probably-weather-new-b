# Live accuracy recorder — real sources, real airports, every hour

Started 24 September 2026 (launch run). The backtest in `review/accuracy/` scores four of the five sources through stand-ins from Open-Meteo's archive. This records what **production actually served** at the six harness airports, next to what those airports reported, so forecast changes can be judged on the real thing.

## What it does

Once an hour, at ten past (Windows scheduled task **"ProbablyWeather accuracy recorder"**):

- `GET /api/version` once, then `GET /api/weather` at each airport's coordinates (FACT Cape Town, FAOR Johannesburg, FALE Durban, FAPE Gqeberha, FABL Bloemfontein, FAGG George — `lib/sources.mjs` CITIES), one retry at most;
- one METAR call to aviationweather.gov for all six stations (last 3 hours).

That is 6 forecast reads an hour, the cost Al ruled fine. A read may be served from production's own cache (`meta.serverCache`), which is what a user in that spot would have seen.

Each run appends one JSON line per airport to `review/accuracy/live/<SAST date>.jsonl` (the served payload: now, 7 days, the next 48 hours, `meta` with every source's vote, description, today's range and weight; plus that station's METAR reports) and one line to `recorder.log`. About 2 MB a day. The data files are git-ignored.

**What production does not expose (yet):** each source's own temperature, rain chance and wind. Production's `meta` carries each source's condition vote and today's min/max only. From the release after `e7d1260`, `meta.sourceNow` / `meta.sourceToday` carry the rest and the recorder keeps them automatically.

## Where it runs

- Script: a copy of `record.mjs` in `%USERPROFILE%\pw-accuracy-recorder\` (so it keeps running whatever branch the repo is on). The copy in this folder is the source of truth; re-run the installer after changing it.
- Data: `C:\Users\27741\OneDrive\Desktop\Probably weather new\probably-weather-new-c\review\accuracy\live\`.
- It may wake the PC for its reading (the task's "Wake the computer to run this task", Al's YES of 25 Sept 2026) — but Windows honours that only while the power plan allows wake timers, and on this PC "Allow wake timers" is **Disable** (checked 25 Sept, plugged in and on battery). To let it wake: Control Panel → Power Options → Change plan settings → Change advanced power settings → Sleep → Allow wake timers → Enable. Until then it runs only while the PC is awake, and after a sleep it runs once when the PC wakes, so the log shows a gap for the hours asleep. To stop it waking the PC: `$t = Get-ScheduledTask 'ProbablyWeather accuracy recorder'; $t.Settings.WakeToRun = $false; Set-ScheduledTask -InputObject $t`.
- All eight reads go out at once; a run takes a few seconds. If OneDrive is holding the day file, a line goes to `held-<date>.jsonl` beside the script in `%USERPROFILE%\pw-accuracy-recorder\` instead of being lost.

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
