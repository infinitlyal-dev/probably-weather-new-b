# The pairs job

Makes line + photo pairs to the recipe (`RECIPE.md`, from Al's taste grades of 25 Sept 2026), checks them,
and adds them to ONE rolling page for Al with every item pre-marked. **Nothing it makes goes into the app.**
Only what Al ticks ships, wired by a later session.

Hourly since 26 Sept 2026 (Al: image making "about 10 an hour, so the fixes finish, he can complete the
second ad, and the soft launch can start").

## What one run does
Rewritten 27 Sept 2026 after Al's verdict on batches 2–9 ("a Complete and utter fail in creativity. We
basically got the same theme and setup across almost all of them"): every brief had come off one template.
Now the picture comes from the joke, and variety is checked before anything is made (`RECIPE.md` §3).

1. Stops if `review\pairs-job\PAUSE` exists (`--manual` runs once by hand and leaves the file in place).
2. Stops while backing off after a rate limit (1 h, 2 h, 4 h, 8 h, then a day), and for the week once Codex's
   weekly usage has passed 90 % (until the week's reset; Sol's code reviews share that allowance). The usage is
   read from Codex's own session records — the main `codex` limit's weekly window, never another model's.
3. Reads Al's exports from Downloads: the newest `pairs-rolling-ruled*.json` (every pair and line on the page
   when he pressed Export is ruled and leaves the page; a copy goes to `rolling-ruled\`; an older export not yet
   read is superseded; a pair he ruled No or Neither puts its spot back on the queue, twice at most) and
   `meh-photos-ruled.json` (every photo he left on REPLACE is queued; a queued photo he kept is dropped, unless
   its pair is already made).
4. Makes nothing while 40 pairs wait on the page, or without the catalogue. Otherwise takes the next targets (5
   at most) from `review\pairs-job\targets.json` in Al's order: his three named photos (tier 1), then the photos
   marked REPLACE on `review\meh-photos-for-al.html`, most-shown first (tier 2), then extra photos for the
   thinnest weathers — fog, heat, cold-clear (tier 3). Tier 9 is parked (older targets that order leaves out).
5. Sol (Codex, `gpt-5.6-sol`, on the ChatGPT plan) writes THREE candidate lines per target, each with its
   Afrikaans and — written with the line — its picture. **The line names the weather and works on its own** (Al,
   27 Sept 2026): read without the photo it still makes sense ("Even the ice tray looks nervous." fails; "It's so hot
   even the ice tray looks nervous." passes); the photo makes the joke funnier, it never carries it. The picture: the joke's own situation (the pegs still on the line,
   the taxi indicating), or none for a mood line. It is shown the catalogue of the app's photos, the pairs
   waiting, the banned setups and the set's counts (subjects, settings, shots, recent casts), and told to cast
   from what the set has least of. No template: the subject, place and camera come from the idea.
6. The recipe filter drops lines that name the calendar, Eskom, a person in a photo, "vibes", run long, or were
   written before.
7. **The variety check, before any photo is made:** the banned setups (read off the picture, and by Sol), and Sol
   reads every idea against the catalogue (`live-photos.json`), the pairs waiting and the other ideas, and every
   line against the bank's lines for its weather, the job's own earlier lines and the formulas used up (no
   near-repeats), and reads every line on its own — a line that needs its picture is not made. One idea per target, in queue order, that is not a repeat and keeps the mix over any five pairs
   side by side (at most two of any subject, setting or cast, one garden, one gate, never the same subject in the
   same setting twice); a target with none waits (three tries), and two spare targets are written so the batch
   still fills. Mood lines (no picture) go onto the page as lines for the bank, five a run at most, no photo.
8. Two takes per chosen idea, each made for its slot: the writer's picture, cast and camera, the weather at its
   folder's strength, the slot's weekday and time of day (weekends are leisure), an aspirational setting, candid
   never posed, the subject in the top half, real-camera realism. At most 10 images a run; no new pair's photos
   after 40 minutes, so the judge and the save always land inside the task's 90-minute limit.
9. Sol judges all the takes side by side, blind to the lines but told each photo's slot and intended picture:
   each photo alone (realism, waxy skin, AI tells, grit, aspirational, day fit, weather strength, posing, words,
   shows its picture, a banned setup, a repeat of an app photo, where the subject sits, and **every person's body**
   — where the arms and legs are, how they sit, stand or hold things, whether the pose is possible; anything
   unclear is a NO — Al, 27 Sept 2026), then lookalikes across
   the batch — a pair's take that looks like another pair's pick is passed over, or the pair is pre-marked NO.
   A pair is pre-marked USE only when its pick is realistic (4+) and passes every rule; a subject reaching past
   60 % of the frame (where Home D writes the joke) is pre-marked NO.
10. Rebuilds `review\pairs-rolling.html` (every waiting pair, then the lines for the bank, then any Afrikaans to
   check — a proposal on a pair already wired, added by a session); Al exports `pairs-rolling-ruled.json`.

`catalogue.mjs --repo <tree>` writes `live-photos.json`: one line per photo in the app, written once and kept
(new photos described by Sol, retired ones dropped). Run it after a wiring session, then reinstall.
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
