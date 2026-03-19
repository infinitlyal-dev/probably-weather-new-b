# Image System Audit — Probably Weather
**Audit Date:** 2026-03-19
**Auditor:** Claude (Sonnet 4.5)
**Status:** READ-ONLY AUDIT

---

## EXECUTIVE SUMMARY

**Overall Rating:** 🟡 **AMBER**

The image system is functional but incomplete. The code still uses a 7-day cycle while the 14-day spec is partially implemented. Several critical condition folders are missing, and there's a significant mismatch between folder names and API condition keys. The temp folder contains valuable completed images for the `cold` condition that haven't been moved to the repo.

**Issue Breakdown:**
- **CRITICAL:** 4 issues
- **SHOULD-FIX:** 5 issues
- **NICE-TO-HAVE:** 2 issues

---

## CRITICAL ISSUES

### **[CRITICAL]** Missing Required Condition Folders
The API generates these condition keys, but folders don't exist:
- **`uv`** — Currently aliased to `clear` in code, but no dedicated folder exists (as intended per spec)
- **`rain-possible`** — Currently aliased to `cloudy` in code, but no dedicated folder exists (as intended per spec)

**NOTE:** Per the spec, `uv` and `rain-possible` are intentionally aliases. However, the actual critical issue is that **`fog`** and **`heat`** folders exist but are never referenced in the API's `deriveCondition()` function under their actual folder names.

**Actual Mismatch:**
- API returns: `fog` (line 1023 of api/weather.js)
- Folder exists: `fog/` ✓
- API returns: `heat` (lines 995, 1029 of api/weather.js)
- Folder exists: `heat/` ✓
- **BUT:** Code aliases in `setBackgroundFor()` show only `rain-possible → cloudy` and `uv → clear`. No aliasing for fog/heat/cold, so they should work correctly.

**Re-assessment:** This is NOT critical. Fog and heat are properly handled.

### **[CRITICAL]** Code Still Uses 7-Day Cycle
**File:** `C:\Users\27741\OneDrive\Desktop\Probably weather new\probably-weather-new-b\assets\app.js`
**Line:** 622
```javascript
const DAY_IMAGE_COUNT = 7;
```

**Lines 631-633:**
```javascript
const dayOfWeek = new Date().getDay(); // 0=Sun, 1=Mon...6=Sat
const dayNum = dayOfWeek === 0 ? 7 : dayOfWeek; // Convert to 1-7 (Mon-Sun)
const imgFile = timeOfDay === 'day' ? `day_${dayNum}` : timeOfDay;
```

**Impact:**
- Code currently picks `day_1` through `day_7` based on day of week
- 14-day spec requires `day_1` to `day_10` (weekdays, 2-week cycle), `day_11`/`day_12` (Saturdays), `day_13`/`day_14` (Sundays)
- Current implementation means Mondays always show the same image (no 2-week variety)
- Weekend images (`day_11`-`day_14`) are never displayed

### **[CRITICAL]** Completed Cold Images Not Moved from Temp Folder
**Location:** `C:\Users\27741\AppData\Local\Temp\pw-source\assets\images\bg\cold\`

**Completed images in temp (22 files):**
- `dawn_1.jpg`, `dawn_2.jpg`, `dawn_3.jpg`
- `day_1.jpg` through `day_14.jpg` (missing `day_5.jpg`)
- `dusk_1.jpg`, `dusk_2.jpg`, `dusk_3.jpg`
- `night_1.jpg`, `night_2.jpg`, `night_3.jpg`

**Repo only has (11 files):**
- `dawn.jpg`, `day.jpg`, `day_1.jpg` through `day_7.jpg`, `dusk.jpg`, `night.jpg`

**Impact:** 13 missing images means cold condition can't use 14-day cycle or numbered dawn/dusk/night variants.

### **[CRITICAL]** Temp Folder Also Has `wind/day_6.jpg`
**Location:** `C:\Users\27741\AppData\Local\Temp\pw-source\assets\images\bg\wind\day_6.jpg`

**Repo has:** `wind/day_1.jpg` through `wind/day_7.jpg` (7 files)
**Temp has:** One additional file (`day_6.jpg`) — likely a replacement/update

**Impact:** Version mismatch — unclear if temp version is newer/better than repo version.

---

## SHOULD-FIX ISSUES

### **[SHOULD-FIX]** Incomplete 14-Day Coverage Across All Conditions
Most condition folders are stuck at 7-day coverage. Missing images for 14-day spec:

**Folders with 7-day coverage only (need day_8 to day_14):**
- `clear/` — has `day_1` to `day_7`, needs `day_8` to `day_14`
- `cloudy/` — has `day_1` to `day_7`, needs `day_8` to `day_14`
- `fog/` — has `day_1` to `day_7`, needs `day_8` to `day_14`
- `heat/` — has `day_1` to `day_7`, needs `day_8` to `day_14`
- `rain/` — has `day_1` to `day_7`, needs `day_8` to `day_14`
- `storm/` — has `day_1` to `day_7`, needs `day_8` to `day_14`
- `wind/` — has `day_1` to `day_7`, needs `day_8` to `day_14` (but temp has `day_6.jpg` — check if duplicate)

**Total missing:** 7 conditions × 7 images = **49 images needed** to complete 14-day spec

### **[SHOULD-FIX]** Missing Numbered Dawn/Dusk/Night Variants
Per spec, each condition should have:
- `dawn_1.jpg`, `dawn_2.jpg`, `dawn_3.jpg`
- `dusk_1.jpg`, `dusk_2.jpg`, `dusk_3.jpg`
- `night_1.jpg`, `night_2.jpg`, `night_3.jpg`

**Current status:** All conditions have single `dawn.jpg`, `dusk.jpg`, `night.jpg` fallbacks.
**Only `cold/` has numbered variants** (but they're in temp folder, not repo).

**Impact:** Time-of-day images don't cycle — users see same dawn/dusk/night image every time for each condition.

### **[SHOULD-FIX]** Time Slot Logic Is Correct, But Not Documented
**File:** `assets\app.js`, lines 627
```javascript
const timeOfDay = hour >= 5 && hour < 8 ? 'dawn' : hour >= 8 && hour < 17 ? 'day' : hour >= 17 && hour < 20 ? 'dusk' : 'night';
```

**Spec says:**
- Dawn: 05:00–08:00 ✓
- Day: 08:00–17:00 ✓
- Dusk: 17:00–20:00 ✓
- Night: 20:00–05:00 ✓

**Status:** Implementation matches spec exactly. However, there's no comment in the code explaining the time ranges.

### **[SHOULD-FIX]** Image Fallback Chain Incomplete
**File:** `assets\app.js`, line 634
```javascript
bgImg.onerror = () => { bgImg.src = `${base}/${folder}/day.jpg`; bgImg.onerror = () => { bgImg.src = `${base}/${fallbackFolder}/day.jpg`; }; };
```

**Current behavior:**
1. Try `[condition]/[time].jpg` (e.g., `cold/dawn_1.jpg`)
2. If fails → Try `[condition]/day.jpg`
3. If fails → Try `[fallbackFolder]/day.jpg` (fallback folder is `cloudy` for `cold`, else `clear`)

**Issue:** No fallback to `default.jpg` at root (`assets/images/bg/default.jpg` exists but is never used).

**Recommendation:** Add a third-level fallback to `default.jpg` as final safety net.

### **[SHOULD-FIX]** Clear Folder Missing `dusk.jpg` Fallback… Wait, It Exists!
**Correction:** `clear/dusk.jpg` EXISTS (found in Glob results). This is NOT an issue.

**Re-check of all fallback files:**

| Condition | dawn.jpg | day.jpg | dusk.jpg | night.jpg |
|-----------|----------|---------|----------|-----------|
| clear     | ✓        | ✓       | ✓        | ✓         |
| cloudy    | ✓        | ✓       | ✓        | ✓         |
| cold      | ✓        | ✓       | ✓        | ✓         |
| fog       | ✓        | ✓       | ✓        | ✓         |
| heat      | ✓        | ✓       | ✓        | ✓         |
| rain      | ✓        | ✓       | ✓        | ✓         |
| storm     | ✓        | ✓       | ✓        | ✓         |
| wind      | ✓        | ✗       | ✓        | ✓         |

**Actual Issue:** `wind/day.jpg` is MISSING. This is the only missing fallback file.

---

## NICE-TO-HAVE ISSUES

### **[NICE-TO-HAVE]** Image Picker Doesn't Vary Time-Slot Images Yet
**File:** `assets\app.js`, line 633
```javascript
const imgFile = timeOfDay === 'day' ? `day_${dayNum}` : timeOfDay;
```

**Current behavior:**
- Day images cycle through `day_1` to `day_7` (soon `day_14`)
- Dawn/dusk/night always use static `dawn.jpg`, `dusk.jpg`, `night.jpg`

**Spec intent:** Dawn/dusk/night should also cycle through numbered variants (`dawn_1`, `dawn_2`, `dawn_3`, etc.).

**Why nice-to-have:** System works fine with static time-slot fallbacks. Variety is a polish feature, not a functional requirement.

### **[NICE-TO-HAVE]** No Console Logging for Image Selection
When debugging condition mapping, there are helpful console logs showing source weights and condition votes. But there's no logging for which image file was selected.

**Recommendation:** Add `console.log` in `setBackgroundFor()` showing:
```javascript
console.log(`🖼️ Background: ${folder}/${imgFile}.jpg (condition: ${condition}, hour: ${hour}, timeOfDay: ${timeOfDay}, dayNum: ${dayNum})`);
```

---

## IMAGE INVENTORY

### Legend
- ✅ **Complete per 14-day spec** (day_1 to day_14 + dawn/dusk/night variants)
- 🟡 **Partial** (7-day cycle only, or missing some time slots)
- ❌ **Minimal** (only fallback files, no numbered variants)
- 🔵 **In Temp Folder** (not yet moved to repo)

| Condition | Dawn | Day Images | Dusk | Night | Status |
|-----------|------|------------|------|-------|--------|
| **clear** | dawn.jpg<br>dusk.jpg | day.jpg<br>day_1.jpg to day_7.jpg | dusk.jpg | night.jpg | 🟡 7-day only |
| **cloudy** | dawn.jpg | day.jpg<br>day_1.jpg to day_7.jpg | dusk.jpg | night.jpg | 🟡 7-day only |
| **cold** | dawn.jpg<br>🔵 dawn_1–3 | day.jpg<br>day_1.jpg to day_7.jpg<br>🔵 day_1–14 (missing day_5) | dusk.jpg<br>🔵 dusk_1–3 | night.jpg<br>🔵 night_1–3 | 🔵 14-day ready in temp<br>🟡 7-day in repo |
| **fog** | dawn.jpg | day.jpg<br>day_1.jpg to day_7.jpg | dusk.jpg | night.jpg | 🟡 7-day only |
| **heat** | dawn.jpg | day.jpg<br>day_1.jpg to day_7.jpg | dusk.jpg | night.jpg | 🟡 7-day only |
| **rain** | dawn.jpg | day.jpg<br>day_1.jpg to day_7.jpg | dusk.jpg | night.jpg | 🟡 7-day only |
| **storm** | dawn.jpg | day.jpg<br>day_1.jpg to day_7.jpg | dusk.jpg | night.jpg | 🟡 7-day only |
| **wind** | dawn.jpg | day_1.jpg to day_7.jpg<br>🔵 day_6.jpg (duplicate?) | dusk.jpg | night.jpg | 🟡 7-day only<br>❌ **MISSING day.jpg fallback** |

### Detailed File Counts

| Condition | Total Files in Repo | Expected (14-day full spec) | Completion % |
|-----------|---------------------|------------------------------|--------------|
| clear     | 11                  | 18 (day_1–14 + 4 time fallbacks) | 61% |
| cloudy    | 11                  | 18                           | 61% |
| cold      | 11                  | 18 (22 with numbered dawn/dusk/night) | 61% (50% if counting variants) |
| fog       | 11                  | 18                           | 61% |
| heat      | 11                  | 18                           | 61% |
| rain      | 11                  | 18                           | 61% |
| storm     | 11                  | 18                           | 61% |
| wind      | 10 ⚠️               | 18                           | 56% |

**Note:** `wind/` is missing `day.jpg` fallback, which is critical for error handling.

---

## CODE ANALYSIS

### Background Image Picker Function
**File:** `C:\Users\27741\OneDrive\Desktop\Probably weather new\probably-weather-new-b\assets\app.js`
**Function:** `setBackgroundFor(condition)`
**Lines:** 622–635

**Current Implementation:**
```javascript
const DAY_IMAGE_COUNT = 7;  // ❌ Should be 14
function setBackgroundFor(condition) {
  const base = 'assets/images/bg', aliasMap = { 'rain-possible': 'cloudy', 'uv': 'clear' };
  const folder = aliasMap[condition] || condition, fallbackFolder = condition === 'cold' ? 'cloudy' : 'clear';
  const hour = getLocationHour(activePlace?.lon);
  const timeOfDay = hour >= 5 && hour < 8 ? 'dawn' : hour >= 8 && hour < 17 ? 'day' : hour >= 17 && hour < 20 ? 'dusk' : 'night';

  // ❌ Comment says Mon-Sun (1-7), but spec requires 14-day cycle
  const dayOfWeek = new Date().getDay(); // 0=Sun, 1=Mon...6=Sat
  const dayNum = dayOfWeek === 0 ? 7 : dayOfWeek; // Convert to 1-7 (Mon-Sun)

  // ❌ Only day images cycle; dawn/dusk/night are static
  const imgFile = timeOfDay === 'day' ? `day_${dayNum}` : timeOfDay;

  // ✅ Triple-fallback chain works correctly (except no final default.jpg fallback)
  if (bgImg) {
    bgImg.src = `${base}/${folder}/${imgFile}.jpg`;
    bgImg.onerror = () => {
      bgImg.src = `${base}/${folder}/day.jpg`;
      bgImg.onerror = () => {
        bgImg.src = `${base}/${fallbackFolder}/day.jpg`;
      };
    };
  }
}
```

**Analysis:**

✅ **Working correctly:**
- Time slot ranges match spec exactly
- Alias map correctly redirects `uv → clear` and `rain-possible → cloudy`
- Fallback logic handles missing images gracefully
- Uses location-aware hour calculation (respects time zones)

❌ **Not working per spec:**
- Uses 7-day cycle instead of 14-day
- Doesn't cycle dawn/dusk/night images (always uses static fallbacks)
- No day-of-week awareness for weekend vs. weekday images
- No final fallback to `default.jpg`

**14-Day Cycle Logic (What It Should Be):**

Per spec:
- `day_1` to `day_10` → Weekdays (Mon–Fri, rotating over 2 weeks)
- `day_11`, `day_12` → Saturdays (alternating weekly)
- `day_13`, `day_14` → Sundays (alternating weekly)

**Required changes:**
```javascript
const DAY_IMAGE_COUNT = 14;

function setBackgroundFor(condition) {
  // ... (same setup)

  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...6=Sat
  const weekOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 1)) / (7 * 24 * 60 * 60 * 1000));
  const isOddWeek = weekOfYear % 2 === 1;

  let dayNum;
  if (dayOfWeek === 0) { // Sunday
    dayNum = isOddWeek ? 13 : 14;
  } else if (dayOfWeek === 6) { // Saturday
    dayNum = isOddWeek ? 11 : 12;
  } else { // Monday (1) to Friday (5)
    const weekdayIndex = dayOfWeek; // 1-5
    dayNum = isOddWeek ? weekdayIndex : (weekdayIndex + 5);
  }

  const imgFile = timeOfDay === 'day' ? `day_${dayNum}` : timeOfDay;

  // ... (same fallback logic)
}
```

**BUT:** Per spec, do NOT update code until all folders are complete. Current 7-day implementation is intentional holding pattern.

---

## CONDITION FOLDER MAPPING

### API → Folder Mapping
**Source:** `C:\Users\27741\OneDrive\Desktop\Probably weather new\probably-weather-new-b\api\weather.js`
**Function:** `deriveCondition()` (lines 963–1042)

| API Condition Key | Folder Used | Alias? | Triggers |
|-------------------|-------------|--------|----------|
| `storm` | `storm/` | No | Thunder, storm, tornado |
| `cold` | `cold/` | No | Feels like ≤ -5°C, temp ≤ 0°C, snow/sleet/ice/hail |
| `heat` | `heat/` | No | Temp ≥ 35°C, feels like ≥ 38°C, or temp ≥ 30°C |
| `rain` | `rain/` | No | Rain chance ≥ 30%, or rain/drizzle/shower in desc |
| `uv` | **`clear/`** | Yes | UV ≥ 6 (daytime, not cloudy) |
| `wind` | `wind/` | No | Wind ≥ 25 kph |
| `cloudy` | `cloudy/` | No | Cloud cover ≥ 55%, or overcast |
| `rain-possible` | **`cloudy/`** | Yes | Rain chance 20–29% |
| `fog` | `fog/` | No | Fog/mist/haze in description |
| `clear` | `clear/` | No | Default/fallback, partly cloudy, sunny, fair |

**Aliasing logic (app.js line 624):**
```javascript
const aliasMap = { 'rain-possible': 'cloudy', 'uv': 'clear' };
```

✅ All API condition keys map to existing folders (either directly or via alias).

---

## TEMP FOLDER ANALYSIS

**Location:** `C:\Users\27741\AppData\Local\Temp\pw-source\assets\images\bg\`

**Total files in temp:** 23

### Cold Condition (22 files)
**Status:** 🔵 READY TO MOVE — 14-day spec nearly complete

| File | Status |
|------|--------|
| dawn_1.jpg, dawn_2.jpg, dawn_3.jpg | ✅ Ready |
| day_1.jpg, day_2.jpg, day_3.jpg, day_4.jpg, day_6.jpg, day_7.jpg, day_8.jpg, day_9.jpg, day_10.jpg, day_11.jpg, day_12.jpg, day_13.jpg, day_14.jpg | ✅ Ready (⚠️ **day_5.jpg MISSING**) |
| dusk_1.jpg, dusk_2.jpg, dusk_3.jpg | ✅ Ready |
| night_1.jpg, night_2.jpg, night_3.jpg | ✅ Ready |

**Missing:** `day_5.jpg` only (can use `day.jpg` fallback or generate)

### Wind Condition (1 file)
| File | Status |
|------|--------|
| day_6.jpg | ⚠️ Duplicate? Repo already has `wind/day_6.jpg` |

**Action needed:** Compare temp version vs. repo version — are they the same file, or is one an update?

---

## RECOMMENDATIONS

### Immediate Actions (Before Code Update)
1. **Move cold images from temp to repo** (22 files) — condition is 95% complete for 14-day spec
2. **Check `wind/day_6.jpg` in temp** — compare to repo version, keep better one
3. **Generate missing `cold/day_5.jpg`** — blocks full 14-day deployment for cold
4. **Generate `wind/day.jpg` fallback** — currently breaks fallback chain

### Image Generation Priorities (7 conditions × 7 images each)
To complete 14-day spec for all conditions, generate:
1. **Weekday images** — `day_8.jpg` to `day_10.jpg` (21 images)
2. **Weekend images** — `day_11.jpg` to `day_14.jpg` (28 images)

**Total needed:** 49 day images + numbered dawn/dusk/night variants (optional polish)

### Code Changes (Only After Images Complete)
1. Update `DAY_IMAGE_COUNT` from 7 to 14
2. Implement 14-day cycle logic (weekday rotation + weekend alternation)
3. Add optional dawn/dusk/night cycling (if numbered variants generated)
4. Add `default.jpg` as final fallback in error chain
5. Add console logging for image selection debugging

---

## FINAL VERDICT

**Overall Status:** 🟡 **AMBER**

**Why Amber:**
- ✅ System is functional — all conditions have working images
- ✅ Code logic is sound — time slots, aliasing, fallbacks all work
- ⚠️ Spec incomplete — 7-day cycle vs. 14-day target
- ⚠️ Valuable work (cold images) stuck in temp folder
- ❌ One critical fallback missing (`wind/day.jpg`)

**Blockers to Green:**
1. Move cold images from temp → repo (1 hour task)
2. Generate 1 missing image (`cold/day_5.jpg`) (5 min task)
3. Generate 1 critical fallback (`wind/day.jpg`) (5 min task)
4. Generate remaining 49 day images for 14-day spec (multi-day task)
5. Update code to 14-day cycle logic (1 hour task)

**System will not break**, but users currently see:
- Same image every Monday (no 2-week variety)
- Same dawn/dusk/night images always (no time-slot cycling)
- Weekend images (`day_11`–`day_14`) never displayed
- Wind condition vulnerable to broken image if `day_X.jpg` fails to load

---

## APPENDIX: FULL FILE LIST

### Repo Files (by condition)

**clear/** (11 files)
- dawn.jpg, day.jpg, dusk.jpg, night.jpg
- day_1.jpg, day_2.jpg, day_3.jpg, day_4.jpg, day_5.jpg, day_6.jpg, day_7.jpg

**cloudy/** (11 files)
- dawn.jpg, day.jpg, dusk.jpg, night.jpg
- day_1.jpg, day_2.jpg, day_3.jpg, day_4.jpg, day_5.jpg, day_6.jpg, day_7.jpg

**cold/** (11 files)
- dawn.jpg, day.jpg, dusk.jpg, night.jpg
- day_1.jpg, day_2.jpg, day_3.jpg, day_4.jpg, day_5.jpg, day_6.jpg, day_7.jpg

**fog/** (11 files)
- dawn.jpg, day.jpg, dusk.jpg, night.jpg
- day_1.jpg, day_2.jpg, day_3.jpg, day_4.jpg, day_5.jpg, day_6.jpg, day_7.jpg

**heat/** (11 files)
- dawn.jpg, day.jpg, dusk.jpg, night.jpg
- day_1.jpg, day_2.jpg, day_3.jpg, day_4.jpg, day_5.jpg, day_6.jpg, day_7.jpg

**rain/** (11 files)
- dawn.jpg, day.jpg, dusk.jpg, night.jpg
- day_1.jpg, day_2.jpg, day_3.jpg, day_4.jpg, day_5.jpg, day_6.jpg, day_7.jpg

**storm/** (11 files)
- dawn.jpg, day.jpg, dusk.jpg, night.jpg
- day_1.jpg, day_2.jpg, day_3.jpg, day_4.jpg, day_5.jpg, day_6.jpg, day_7.jpg

**wind/** (10 files) ⚠️
- dawn.jpg, dusk.jpg, night.jpg (**MISSING day.jpg**)
- day_1.jpg, day_2.jpg, day_3.jpg, day_4.jpg, day_5.jpg, day_6.jpg, day_7.jpg

**Root:**
- default.jpg (never used in current fallback chain)

### Temp Folder Files

**cold/** (22 files)
- dawn_1.jpg, dawn_2.jpg, dawn_3.jpg
- day_1.jpg, day_2.jpg, day_3.jpg, day_4.jpg, day_6.jpg, day_7.jpg, day_8.jpg, day_9.jpg, day_10.jpg, day_11.jpg, day_12.jpg, day_13.jpg, day_14.jpg (missing day_5.jpg)
- dusk_1.jpg, dusk_2.jpg, dusk_3.jpg
- night_1.jpg, night_2.jpg, night_3.jpg

**wind/** (1 file)
- day_6.jpg (duplicate? check vs. repo)

---

**End of Audit**
