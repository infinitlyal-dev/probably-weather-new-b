# Installs the pairs job as a Windows scheduled task (runs hidden, no window), the same way the
# accuracy recorder is installed.
#
#   powershell -ExecutionPolicy Bypass -File review\pairs-job\install-pairs-job.ps1
#
# Copies run.mjs, page.mjs, RECIPE.md and opus-lines.json to %USERPROFILE%\pw-pairs-job\ (so it runs whatever
# branch or worktree the repo is on) and keeps its queue, state, log and batches in the working copy's
# review\pairs-job\. Its pages land in review\ next to Al's other pages.
# Pause it: create review\pairs-job\PAUSE. Stop it: see README.md in this folder.

$ErrorActionPreference = 'Stop'
$TaskName = 'ProbablyWeather pairs job'
$RuntimeDir = Join-Path $env:USERPROFILE 'pw-pairs-job'
$Repo = 'C:\Users\27741\OneDrive\Desktop\Probably weather new\probably-weather-new-c'
$DataDir = Join-Path $Repo 'review\pairs-job'
$Node = (Get-Command node.exe).Source

New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null
New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
foreach ($f in 'run.mjs', 'page.mjs', 'RECIPE.md', 'opus-lines.json') { Copy-Item -Force (Join-Path $PSScriptRoot $f) (Join-Path $RuntimeDir $f) }
# The queue is copied once; after that the job's own copy (with what it has done) is the one it reads.
if (-not (Test-Path (Join-Path $DataDir 'targets.json'))) { Copy-Item (Join-Path $PSScriptRoot 'targets.json') (Join-Path $DataDir 'targets.json') }

$Action = New-ScheduledTaskAction -Execute 'conhost.exe' `
  -Argument "--headless `"$Node`" `"$RuntimeDir\run.mjs`" --data `"$DataDir`" --repo `"$Repo`"" `
  -WorkingDirectory $RuntimeDir
# Once a day at 07:30. Most runs end in a second: they wait while the last batch is unruled.
$Trigger = New-ScheduledTaskTrigger -Daily -At '07:30'
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 1) -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings `
  -Description 'Probably Weather: makes a small batch of line + photo pairs to the recipe for Al to tick (review/pairs-job). Nothing it makes ships without his tick.' -Force | Out-Null
Get-ScheduledTask -TaskName $TaskName | Select-Object TaskName, State
