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
7. Two takes per pair with the realism brief; at most 8 images a run.
8. Sol judges the takes blind (realism, waxy skin, AI tells, where the subject sits); the job picks one and
   flags a pair whose subject reaches the joke's band (below ~55 % of the frame), pre-marked NO.
9. Writes `review\pairs-batch-<n>.html`; Al exports `pairs-batch-<n>-ruled.json` to Downloads.

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
- The writer is Sol because the Claude CLI's login had expired (25 Sept). Moving the writer to Opus needs
  that login back and a small change to `run.mjs` (a session); the job then stops mixing.
