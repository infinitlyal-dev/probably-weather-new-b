# Probably Weather — Claude Code Master Instructions

## PROJECT IDENTITY
Probably Weather (probablyweather.co.za) is a South African PWA weather app with a strong personality.
It combines 5 weather sources into a weighted ensemble forecast and serves it with SA-flavoured humour and warmth.
The app's personality is its superpower. Never let technical work dilute the SA tone.

## THE DEVELOPER
Al is not a coder. He cannot safely apply code snippets or partial diffs.
**ALWAYS provide complete replacement files. Never provide partial code snippets.**
Never instruct Al to manually edit a file. All changes go via GitHub → Vercel auto-deploy.

## REPO & DEPLOY
- GitHub: https://github.com/infinitlyal-dev/probably-weather-new-b
- Live app: https://www.probablyweather.co.za
- Live API: https://www.probablyweather.co.za/api/weather?lat=-34.1163&lon=18.8362
- Vercel project: prj_DkYaenXGD5TANTVLyEwn1NG06BF7 / team: team_yiwk7JTdU3fdQVwcuOmsEVlT
- Every push to main auto-deploys via Vercel. Never push broken code.
- Local repo path: C:\Users\27741\OneDrive\Desktop\Probably weather new\probably-weather-new-b

## KEY FILES
- `api/weather.js` — main API (~2456 lines), aggregates 5 weather sources with dynamic weights
- `assets/app.js` — main frontend (~2793 lines), all rendering and UI logic
- `assets/weather-copy.js` — server-side 5-language copy bank (source of truth; split to `assets/copy/<lang>.js` at build time)
- `assets/witty-day-tags.js` — structural day-of-week metadata for witty lines (weekday/weekend/day-named gating)
- `assets/app.css` — all styling (~3306 lines)
- `index.html` — single page shell with all meta/OG tags
- `sw.js` — service worker (offline/cache logic)
- `manifest.json` — PWA manifest
- `assets/images/bg/` — background images by condition folder
- Tests: `npx vitest run` → ~2684 tests across 59 files (2026-07-02); `npm run build` runs the copy-split drift gate + import-scan.

## THE 5 WEATHER SOURCES
1. **Open-Meteo** (ECMWF IFS) — free, no key, high accuracy, primary source
2. **WeatherAPI.com** — has condition codes, tendency to overcook wind gusts and flag "rain possible" incorrectly. **Often mirrors ECMWF data** — not truly independent.
3. **MET Norway (yr.no)** — very reliable for SA coastal conditions, handles heat waves better than ECMWF
4. **Pirate Weather** (NOAA GFS/GEFS) — genuinely independent model, good for precipitation probability. Only source with daily wind+cloud (used for forecast days 2–6).
5. **Tomorrow.io** — radar-informed hourly precipitation (added 2026-05). Full weight in description voting + a live precip override; daily coverage is day-0 only.

**Known WeatherAPI issue**: condition code 1003 (Partly cloudy) with 0mm precip should map to "clear", not "rain-possible". WeatherAPI frequently flags rain on clear days — do not trust its rain_chance alone.

## SOURCE WEIGHTS (DYNAMIC)
Base weights: 35% Open-Meteo | 25% WeatherAPI | 15% Pirate Weather | 25% MET Norway

Weights are **dynamically adjusted** at runtime based on source agreement:
- **ECMWF dedup**: When OM and WA daily highs are within 0.5°C (same underlying model), WA weight is halved (25% → 12.5%)
- **MET Norway boost**: When MET Norway daily high is >5°C above ECMWF-family average (common during SA heat waves), MET Norway weight increases to 40% and OM drops to 25%
- **Description voting**: WeatherAPI gets only 10% weight for condition description voting (unreliable rain flags); Tomorrow.io gets full weight. See `DESC_WEIGHTS` / `HOURLY_DESC_WEIGHTS` in api/weather.js for the live 5-source weight arrays.
- **Cloud cover**: Uses modal (most frequent category) not average — prevents bimodal averaging artifacts
- Hourly weights are recomputed from the adjusted source weights (excluding Pirate Weather; Tomorrow.io is included hourly)

Console logs show the active weights for each API call for debugging.

## CONDITION & IMAGE SYSTEM
Images live in: `assets/images/bg/[condition]/[filename].jpg`
Condition folders (9, see KNOWN_FOLDERS in assets/image-picker.js): `clear`, `cloudy`, `rain`, `wind`, `storm`, `cold`, `cold-clear`, `fog`, `heat`. Aliased conditions with no own folder: `uv` → clear, `rain-possible`/`partly-cloudy` → cloudy, `hail`/`thunder` → storm. (The hot-weather condition/key is `heat`, not `hot` — there is no `hot` folder or emoji.)

Time slots (used in filenames):
- `dawn` — 05:00–08:00
- `day` — 08:00–17:00  
- `dusk` — 17:00–20:00
- `night` — 20:00–05:00

Day image naming (14-day cycle — UPDATE IN PROGRESS):
- `day_1.jpg` to `day_10.jpg` — weekday images (Mon–Fri, two-week cycle)
- `day_11.jpg`, `day_12.jpg` — Saturday images
- `day_13.jpg`, `day_14.jpg` — Sunday images
- `day.jpg` — fallback only, do not use as primary
- `dawn_1.jpg` to `dawn_3.jpg`, `dusk_1.jpg` to `dusk_3.jpg`, `night_1.jpg` to `night_3.jpg`

**Current code uses 7-day cycle. Will be updated to 14-day once all images are complete.**

## LANGUAGES
The app supports 5 languages: English, Afrikaans, Zulu, Xhosa, Sotho.
All new user-facing strings must include translations for all 5 languages.
Language strings live in `assets/app.js` in the `translations` object.

## SA CULTURAL RULES
- Braai references only on weekends (Saturday/Sunday images and copy)
- Hadeda, fynbos, Cape Dutch, Helderberg references are welcome
- Western Cape / Cape Town is primary context but app works nationally
- No Eskom jokes on home screen (removed — too dated/negative)
- Humour is warm and self-aware, never mean or gritty
- Images: beautiful, authentic SA, positive vibes only. No poverty, graffiti, litter, horror aesthetic.

## ENSEMBLE CONDITION LOGIC RULES
- Condition requires MAJORITY vote (at least 2 of available sources) to declare rain or cloudy
- Majority voting applies to both current conditions AND daily forecast conditions
- Single source claiming rain/cloudy should NOT override clear consensus from other sources
- WeatherAPI condition codes 1000 (sunny) and 1003 (partly cloudy) with 0mm precip = "clear"
- WeatherAPI gets reduced (10%) weight in description voting — its rain flags are unreliable
- Cloud cover uses modal (most frequent bucket) not weighted average
- MET Norway todayHigh/todayLow filtered to today's local date only (no tomorrow leakage)
- When in doubt, trust MET Norway (yr.no) — it is the most reliable source for SA coastal conditions

## WORKING RULES FOR CLAUDE CODE
1. Work autonomously unless genuinely blocked
2. Commit each logical fix separately with a clear commit message
3. Push to main after each commit so Vercel deploys
4. Never commit broken code — test logic before committing
5. Read existing file content fully before editing — do not assume structure
6. When replacing a file, replace the ENTIRE file, not sections
7. Add console.log debug lines for weather logic decisions (condition voting, source weights) — helps Al debug via browser console
8. Keep prompts focused — do one thing well per session

## CURRENT OUTSTANDING TASKS
See `.claude/tasks/BACKLOG.md` for the full task list.

## SUBAGENTS
Specialist agents are in `.claude/agents/`. Delegate to them when their domain is relevant:
- `weather-logic.md` — API aggregation, condition mapping, ensemble voting
- `ui-copy.md` — SA copy, translations, tone, humour
- `image-system.md` — background image naming, condition folders, Leonardo AI briefs
- `pwa-deploy.md` — Vercel, GitHub, Play Store, PWA manifest, service worker
