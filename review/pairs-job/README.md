# The pairs job

Makes a small batch of line + photo pairs to the recipe (`RECIPE.md`, from Al's taste grades of
25 Sept 2026), checks them, and builds a short page for Al with every item pre-marked. **Nothing it
makes goes into the app.** Only what Al ticks ships, wired by a later session.

## What one run does
1. Stops if `review\pairs-job\PAUSE` exists.
2. Waits while the last batch is unruled: it runs again only once `Downloads\pairs-batch-<n>-ruled.json` exists.
3. Skips if Codex's weekly usage is over 85 % (Sol's code reviews share that allowance).
4. Takes the next 4 targets from `review\pairs-job\targets.json`: the spots of the 15 lines Al marked MEH
   first, then weak clear-weather photos, then thin spots.
5. Sol (Codex, `gpt-5.6-sol`, on the ChatGPT plan) writes each line and its Afrikaans, then a photo brief
   that sets the joke up. Batch 1 puts Opus-written lines (`opus-lines.json`) on alternate pairs, unlabelled,
   because the unattended writer is not Opus; `batch-1\key.json` says which is which.
6. The recipe filter drops lines that name the calendar, Eskom, a person in a photo, "vibes", or run long.
7. Two takes per pair with the realism brief, each made for its slot: the weather at its folder's strength
   (clear is pleasant sun, heat is heat), the slot's weekday and time of day (weekends are leisure), and an
   aspirational setting — Al's photo rules of 26 Sept 2026 (`RECIPE.md` §3). At most 8 images a run.
8. Sol judges the takes blind to the line but told each photo's slot: realism, waxy skin, AI tells, grit,
   an aspirational setting, day fit, weather-strength fit, where the subject sits. The job picks one; a pair
   is pre-marked USE only when its pick is realistic (4+) and passes every one of Al's setting rules. A
   subject that reaches Home D's joke band (below ~55 %) is a note, not a NO (Home D is not live).
9. Writes `review\pairs-batch-<n>.html`; Al exports `pairs-batch-<n>-ruled.json` to Downloads.

`--remake <plan.json>` makes new photos for lines Al has already ruled (their photos were out), with the
same brief and judge, into `review\pairs-job\remakes\<name>\` — no page; the wiring session builds one.

## Start, pause, stop
- **Start** (install, once): `powershell -ExecutionPolicy Bypass -File review\pairs-job\install-pairs-job.ps1`
  — a hidden daily task at 07:30 called "ProbablyWeather pairs job". Run it now:
  `schtasks /run /tn "ProbablyWeather pairs job"`.
- **Pause**: create an empty file `review\pairs-job\PAUSE` (in the OneDrive working copy). Delete it to resume.
  (It also pauses by itself while a batch waits for Al.)
- **Stop for good**: `schtasks /delete /tn "ProbablyWeather pairs job" /f`, then delete `%USERPROFILE%\pw-pairs-job`.

## Where things are
- Queue, state, log, each batch's lines, takes, judge notes and key: `review\pairs-job\` (OneDrive working copy).
- Pages: `review\pairs-batch-<n>.html`.
- Photos: `%USERPROFILE%\.codex\generated_images\<thread>\`.
- The writer is Sol because the Claude CLI's login had expired (25 Sept). **Writer test (batch 1, Al's
  grades of 26 Sept): Sol wrote M01 and M03, Opus wrote M02 and M04; all four LOVE. Sol matches Opus, so
  Sol stays the writer** (brief: "If Sol matches Opus, keep Sol"). The job mixed only in batch 1.
