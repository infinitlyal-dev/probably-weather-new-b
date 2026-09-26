# The pairs job

Makes line + photo pairs to the recipe (`RECIPE.md`, from Al's taste grades of 25 Sept 2026), checks them,
and adds them to ONE rolling page for Al with every item pre-marked. **Nothing it makes goes into the app.**
Only what Al ticks ships, wired by a later session.

Hourly since 26 Sept 2026 (Al: image making "about 10 an hour, so the fixes finish, he can complete the
second ad, and the soft launch can start").

## What one run does
1. Stops if `review\pairs-job\PAUSE` exists.
2. Stops while backing off after a rate limit (1 h, 2 h, 4 h, 8 h, then a day), and for the week once Codex's
   weekly usage has passed 90 % (until the week's reset; Sol's code reviews share that allowance). The usage is
   read from Codex's own session records — the main `codex` limit's weekly window, never another model's.
3. Reads Al's exports from Downloads: `pairs-rolling-ruled*.json` (every pair on the page when he pressed Export
   is ruled and leaves the page; copies go to `rolling-ruled\`) and `meh-photos-ruled.json` (every photo he
   left on REPLACE is queued; a queued photo he kept is dropped, unless its pair is already made).
4. Makes nothing while 40 pairs wait on the page. Otherwise takes the next targets (5 at most) from
   `review\pairs-job\targets.json` in Al's order: his three named photos (tier 1), then the photos marked
   REPLACE on `review\meh-photos-for-al.html`, most-shown first (tier 2), then extra photos for the thinnest
   weathers — fog, heat, cold-clear (tier 3). Tier 9 is parked (older targets that order leaves out).
5. Sol (Codex, `gpt-5.6-sol`, on the ChatGPT plan) writes each line and its Afrikaans, joke first, then a photo
   brief that sets the joke up. A replacement pair is told what was wrong with the photo it replaces.
6. The recipe filter drops lines that name the calendar, Eskom, a person in a photo, "vibes", or run long
   (a dropped target is written again next run, three tries at most).
7. Two takes per pair, each made for its slot: the weather at its folder's strength, the slot's weekday and time
   of day (weekends are leisure), an aspirational setting, someone reacting to the weather, the subject in the
   top half — Al's photo rules (`RECIPE.md` §3). At most 10 images a run; no new pair's photos after 40 minutes
   (the rest wait for the next run), so the judge and the save always land inside the task's 90-minute limit.
8. Sol judges the takes blind to the line but told each photo's slot: realism, waxy skin, AI tells, grit, an
   aspirational setting, day fit, weather-strength fit, posing, words in the picture, where the subject sits.
   A pair is pre-marked USE only when its pick is realistic (4+) and passes every rule; Home D is Home now, so a
   subject reaching past 60 % of the frame (where the joke is written) is pre-marked NO.
9. Rebuilds `review\pairs-rolling.html` (every waiting pair); Al exports `pairs-rolling-ruled.json`.

`queue-meh.mjs --data <folder>` rebuilds the queue in Al's order from `review\meh-photos\flags.json`.
`--remake <plan.json>` makes new photos for lines Al has already ruled (their photos were out), with the same
brief and judge, into `review\pairs-job\remakes\<name>\` — no page; the wiring session builds one.
`--page-only` rebuilds the rolling page.

## Start, pause, stop
- **Start** (install): `powershell -ExecutionPolicy Bypass -File review\pairs-job\install-pairs-job.ps1`
  — a hidden task every hour, "ProbablyWeather pairs job". Run it now: `schtasks /run /tn "ProbablyWeather pairs job"`.
- **Pause**: create an empty file `review\pairs-job\PAUSE` (in the OneDrive working copy). Delete it to resume.
  (It also stops by itself while 40 pairs wait, after a rate limit, or past 90 % of the week's Codex usage.)
- **Stop for good**: `schtasks /delete /tn "ProbablyWeather pairs job" /f`, then delete `%USERPROFILE%\pw-pairs-job`.

## Where things are
- Queue, state, log, each batch's lines, takes, judge notes, Al's exports: `review\pairs-job\` (OneDrive copy).
- The page: `review\pairs-rolling.html`. (Batch 1's own page, `review\pairs-batch-1.html`, is ruled.)
- Photos: `%USERPROFILE%\.codex\generated_images\<thread>\`.
- The writer is Sol (writer test, batch 1, Al's grades of 26 Sept: Sol matched Opus, so Sol stays).
