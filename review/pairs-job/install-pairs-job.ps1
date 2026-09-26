# Installs the pairs job as a Windows scheduled task (runs hidden, no window), the same way the
# accuracy recorder is installed. Hourly since 26 Sept 2026 (Al: about 10 images an hour).
#
#   powershell -ExecutionPolicy Bypass -File review\pairs-job\install-pairs-job.ps1
#
# Copies run.mjs, page.mjs and RECIPE.md to %USERPROFILE%\pw-pairs-job\ (so it runs whatever branch or
# worktree the repo is on) and keeps its queue, state, log and batches in the working copy's
# review\pairs-job\. Its one rolling page lands in review\pairs-rolling.html next to Al's other pages.
# Pause it: create review\pairs-job\PAUSE. Stop it: see README.md in this folder.

$ErrorActionPreference = 'Stop'
$TaskName = 'ProbablyWeather pairs job'
$RuntimeDir = Join-Path $env:USERPROFILE 'pw-pairs-job'
$Repo = 'C:\Users\27741\OneDrive\Desktop\Probably weather new\probably-weather-new-c'
$DataDir = Join-Path $Repo 'review\pairs-job'
$Node = (Get-Command node.exe).Source

New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null
New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
foreach ($f in 'run.mjs', 'page.mjs', 'RECIPE.md') { Copy-Item -Force (Join-Path $PSScriptRoot $f) (Join-Path $RuntimeDir $f) }
# The queue is copied once; after that the job's own copy (with what it has done) is the one it reads.
# queue-meh.mjs rebuilds it in Al's order.
if (-not (Test-Path (Join-Path $DataDir 'targets.json'))) { Copy-Item (Join-Path $PSScriptRoot 'targets.json') (Join-Path $DataDir 'targets.json') }

$Action = New-ScheduledTaskAction -Execute 'conhost.exe' `
  -Argument "--headless `"$Node`" `"$RuntimeDir\run.mjs`" --data `"$DataDir`" --repo `"$Repo`"" `
  -WorkingDirectory $RuntimeDir
# Every hour from the next full hour, with no end. A run makes at most 5 pairs (10 images), usually in 15-30
# minutes; it makes nothing while 40 pairs wait for Al, while backing off after a rate limit, or once Codex's
# weekly usage has passed 90 % (until the week resets). It starts no new pair's photos after 40 minutes and
# may run up to 90; an hour that comes while a run is still going is skipped (IgnoreNew).
$Start = (Get-Date).Date.AddHours((Get-Date).Hour + 1)
$Trigger = New-ScheduledTaskTrigger -Once -At $Start -RepetitionInterval (New-TimeSpan -Hours 1)
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 90) -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings `
  -Description 'Probably Weather: hourly, makes line + photo pairs to the recipe onto one rolling page for Al to tick (review/pairs-job). Nothing it makes ships without his tick.' -Force | Out-Null
$t = Get-ScheduledTask -TaskName $TaskName
$i = $t | Get-ScheduledTaskInfo
$until = if ($t.Triggers[0].Repetition.Duration) { $t.Triggers[0].Repetition.Duration } else { 'no end' }
[pscustomobject]@{ TaskName = $t.TaskName; State = $t.State; Every = $t.Triggers[0].Repetition.Interval; Until = $until; NextRun = $i.NextRunTime }
