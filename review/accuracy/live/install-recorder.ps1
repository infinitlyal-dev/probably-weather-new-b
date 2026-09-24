# Installs the hourly accuracy recorder as a Windows scheduled task (runs hidden, no window).
#
#   powershell -ExecutionPolicy Bypass -File review\accuracy\live\install-recorder.ps1
#
# Copies record.mjs to %USERPROFILE%\pw-accuracy-recorder\ (so it runs whatever branch or
# worktree the repo is on) and writes its data to the working copy's review\accuracy\live\.
# Stop it: see README.md in this folder.

$ErrorActionPreference = 'Stop'
$TaskName = 'ProbablyWeather accuracy recorder'
$RuntimeDir = Join-Path $env:USERPROFILE 'pw-accuracy-recorder'
$DataDir = 'C:\Users\27741\OneDrive\Desktop\Probably weather new\probably-weather-new-c\review\accuracy\live'
$Node = (Get-Command node.exe).Source

New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null
New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
Copy-Item -Force (Join-Path $PSScriptRoot 'record.mjs') (Join-Path $RuntimeDir 'record.mjs')

# conhost --headless runs the console program without opening a window.
$Action = New-ScheduledTaskAction -Execute 'conhost.exe' `
  -Argument "--headless `"$Node`" `"$RuntimeDir\record.mjs`" --out `"$DataDir`"" `
  -WorkingDirectory $RuntimeDir
# Every hour at :10 (the airports' :00 reports are in by then), starting at the next :10.
$Start = (Get-Date).Date.AddHours((Get-Date).Hour).AddMinutes(10)
if ($Start -lt (Get-Date)) { $Start = $Start.AddHours(1) }
$Trigger = New-ScheduledTaskTrigger -Once -At $Start -RepetitionInterval (New-TimeSpan -Hours 1)
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings `
  -Description 'Probably Weather: records production forecasts + METAR at six airports hourly (review/accuracy/live).' -Force | Out-Null
Get-ScheduledTask -TaskName $TaskName | Select-Object TaskName, State
