# Installs the daily scorecard as a Windows scheduled task (runs hidden, no window).
#
#   powershell -ExecutionPolicy Bypass -File review\accuracy\scorecard\install-scorecard.ps1
#
# Copies make-scorecard.mjs to %USERPROFILE%\pw-scorecard\ (so it runs whatever branch or worktree the repo is on),
# reads the recorder's files in the working copy's review\accuracy\live\ and writes review\scorecard.html there.
# Every morning at 06:20 SAST — after the recorder's 06:10 run; if the PC was asleep, as soon as it wakes.
# Stop it:  Unregister-ScheduledTask -TaskName 'ProbablyWeather scorecard' -Confirm:$false

$ErrorActionPreference = 'Stop'
$TaskName = 'ProbablyWeather scorecard'
$RuntimeDir = Join-Path $env:USERPROFILE 'pw-scorecard'
$Review = 'C:\Users\27741\OneDrive\Desktop\Probably weather new\probably-weather-new-c\review'
$Node = (Get-Command node.exe).Source

New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null
Copy-Item -Force (Join-Path $PSScriptRoot 'make-scorecard.mjs') (Join-Path $RuntimeDir 'make-scorecard.mjs')

$Action = New-ScheduledTaskAction -Execute 'conhost.exe' `
  -Argument "--headless `"$Node`" `"$RuntimeDir\make-scorecard.mjs`" --live `"$Review\accuracy\live`" --out `"$Review\scorecard.html`"" `
  -WorkingDirectory $RuntimeDir
$Trigger = New-ScheduledTaskTrigger -Daily -At '06:20'
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings `
  -Description 'Probably Weather: rebuilds review\scorecard.html every morning from the accuracy recorder''s files (no network).' -Force | Out-Null
Get-ScheduledTask -TaskName $TaskName | Select-Object TaskName, State
