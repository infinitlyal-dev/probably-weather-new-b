@echo off
REM Opens the curation tool the reliable way: a local server, then the browser.
REM Double-clicking the .html works too, but file:// origins are opaque and some
REM browsers refuse localStorage on them - which is where every verdict is saved.
REM Close the black console window when you are done to stop the server.
cd /d "%~dp0.."
start "PW review server" cmd /c "node scripts/serve-review.mjs"
timeout /t 2 >nul
start "" http://127.0.0.1:8788/review/crop-anchor-tool.html
