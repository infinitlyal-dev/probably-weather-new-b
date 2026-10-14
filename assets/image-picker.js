// Probably Weather — background image picker (date-based rotation).
//
// Reads from the weekly batch folder structure:
//   assets/images/bg/<condition>/week_<1..4>/<dawn|day|dusk|night>/<1..7>.webp
//
// Pure functions only — DOM wiring lives in app.js so this module is unit-testable
// without jsdom.
//
// THE DAY IS THE INDEX. Al's design, and the whole of the set-001 curation and
// humour pairing built on it: slot <n> is the weekday, Monday = 1 … Sunday = 7,
// so a photograph curated for Saturday (braai in shot, "Saturday, and…" in its
// lines) is served on Saturday and never on a Tuesday. Weeks run Monday–Sunday.
// The four week folders are a two-week A/B cycle — week_1 and week_3 hold week A,
// week_2 and week_4 hold week B — laid out on disk by scripts/layout-set-001-grid.mjs.
//
// Both the day and the week are taken in SAST (Africa/Johannesburg, UTC+2, no
// daylight saving — so plain arithmetic is exact and ICU-independent). Not the
// device clock and not UTC: a phone at 23:30 on a Sunday in SAST is still
// Sunday even though UTC has moved on, and a Monday-00:30 SAST open must land
// on Monday's photograph although UTC still says Sunday.
export const SAST_OFFSET_MS = 2 * 60 * 60 * 1000;
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;
// Week boundaries flip at Monday 00:00 SAST. The anchor is the Monday of launch
// week — Monday 25 May 2026 00:00 SAST = Sunday 24 May 22:00 UTC — so launch day
// (Saturday 30 May 2026) stays inside week_1 exactly as it did under the old
// Saturday-anchored formula, and the week the app is showing today does not jump.
export const WEEK_ANCHOR_MS = Date.UTC(2026, 4, 24, 22, 0, 0, 0);
// Backgrounds are CDN-cached immutable for one year. Bump this whenever any
// rotating WebP bytes change so returning clients request a fresh URL instead
// of retaining the old body at the stable filesystem path.
export const BG_IMAGE_URL_VERSION = '20261008-sets';

// Order is load-bearing: the built manifest indexes slots by folder position (rotatingImagePath), so new folders go
// on the END. partly-cloudy and breezy: Al's 7 Oct 2026 sets (review/image-brief-2026-10-07.md).
export const BG_IMAGE_SLOT_FOLDERS = [
  'clear', 'cloudy', 'cold', 'cold-clear', 'fog', 'heat', 'rain', 'storm', 'wind', 'partly-cloudy', 'breezy',
];
export const BG_IMAGE_SLOT_TIMES = ['dawn', 'day', 'dusk', 'night'];
const VALID_TIMES = new Set(BG_IMAGE_SLOT_TIMES);
// The 11 promoted folders. Folder names outside this set are *not* rejected —
// the picker is downstream and stays permissive — but a one-line console.warn
// surfaces typos that would otherwise silently 404 through the whole chain.
const KNOWN_FOLDERS = new Set(BG_IMAGE_SLOT_FOLDERS);

// The source tree stays directly previewable using its slot paths. Production
// build replaces this exact marker with a compact slot→content-hash manifest,
// then ships each unique WebP once under bg-canonical/.
const BG_IMAGE_SLOT_MANIFEST = /* __BG_IMAGE_SLOT_MANIFEST__ */ null;

function rotatingImagePath(base, folder, time, week, index) {
  if (base === 'assets/images/bg' && BG_IMAGE_SLOT_MANIFEST) {
    const folderIndex = BG_IMAGE_SLOT_FOLDERS.indexOf(folder);
    const timeIndex = BG_IMAGE_SLOT_TIMES.indexOf(time);
    if (folderIndex >= 0 && timeIndex >= 0) {
      const slotIndex = folderIndex * 112 + (week - 1) * 28 + timeIndex * 7 + (index - 1);
      const hashId = BG_IMAGE_SLOT_MANIFEST.slots[slotIndex];
      const hash = BG_IMAGE_SLOT_MANIFEST.hashes[hashId];
      if (hash) return `assets/images/bg-canonical/${hash}.webp`;
    }
  }
  return `${base}/${folder}/week_${week}/${time}/${index}.webp`;
}

// Warn-once per folder per session — without this, every pull-to-refresh
// fires 2-3 buildPickerPaths calls and would re-spam the same warning.
const __warnedFolders = new Set();
function warnUnknownFolder(folder) {
  if (typeof folder !== 'string' || folder.length === 0) return;
  if (KNOWN_FOLDERS.has(folder)) return;
  if (__warnedFolders.has(folder)) return;
  __warnedFolders.add(folder);
  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    console.warn(`[image-picker] unknown folder "${folder}" — primary path will likely 404 and fall through chain`);
  }
}

/** Test-only — clear the warned-folder set so the warn-once test stays deterministic. */
export function _resetWarnedFolders() {
  __warnedFolders.clear();
}

/**
 * Return the slot index (1..7) for a given UTC timestamp: the SAST weekday,
 * Monday = 1 … Sunday = 7.
 *
 * This is THE day function. The picker's slot, the bespoke hero line (which is
 * looked up by the photograph the slot resolves to) and the condition bank's
 * weekend / day-tag routing (app.js getLocationDayOfWeek) all derive from it,
 * so photograph, line and weekend rule cannot disagree about what day it is.
 * NaN / non-finite inputs return 1 rather than throwing.
 */
export function getRotationDay(nowMs = Date.now()) {
  if (!Number.isFinite(nowMs)) return 1;
  const sastDay = new Date(nowMs + SAST_OFFSET_MS).getUTCDay(); // 0 = Sun … 6 = Sat
  return sastDay === 0 ? 7 : sastDay;
}

/**
 * Return the active rotation week (1..4) for a given UTC timestamp.
 *
 * The week flips at Monday 00:00 SAST for everyone at the same instant. Dates
 * before the anchor return 1 (graceful default — pre-launch testers see the
 * first batch). NaN / non-finite inputs also return 1 rather than throwing.
 */
export function getRotationWeek(nowMs = Date.now()) {
  if (!Number.isFinite(nowMs) || !Number.isFinite(WEEK_ANCHOR_MS)) return 1;
  const elapsed = nowMs - WEEK_ANCHOR_MS;
  if (elapsed < 0) return 1;
  return (Math.floor(elapsed / WEEK_MS) % 4) + 1;
}

// HERO PAIRS (Al + Maat, 14 Oct 2026): a photograph and its line made as one idea, served OUTSIDE the slot grid.
// A pair carries its own rules instead of a slot: its condition folder, the times of day and the SAST weekdays
// (Mon=1 … Sun=7) it fits. Source: review/hero-pairs.json; scripts/build-hero-pairs.mjs writes this table.
// Photographs at assets/images/bg-pairs/<id>.webp; their lines are in hero-lines.js under bg-pairs/<id>.webp.
export const HERO_PAIRS_URL_VERSION = '20261014';
export const HERO_PAIRS = Object.freeze([
  // __HERO_PAIRS__  (generated — do not hand-edit)
  { id: "a01-clear-dawn-east", folder: "clear", times: ["dawn"], days: [1,2,3,4,5] },
  { id: "a02-clear-day-tree", folder: "clear", times: ["day"], days: [1,2,3,4,5] },
  { id: "a03-pc-day-garden", folder: "partly-cloudy", times: ["day"], days: [6,7] },
  { id: "a04-cloudy-day-plants", folder: "cloudy", times: ["day"], days: [1,2,3,4,5,6,7] },
  { id: "a05-cloudy-dusk-sundowners", folder: "cloudy", times: ["dusk"], days: [5,6,7] },
  { id: "a06-breezy-day-nextdoor", folder: "breezy", times: ["day"], days: [6,7] },
  { id: "a07-breezy-night-mozzies", folder: "breezy", times: ["night"], days: [1,2,3,4,5,6,7] },
  { id: "a08-rain-dawn-oupa", folder: "rain", times: ["dawn"], days: [1,2,3,4,5,6,7] },
  { id: "a09-rain-night-sprinkler", folder: "rain", times: ["night"], days: [1,2,3,4,5,6,7] },
  { id: "a10-pc-dusk-sink", folder: "partly-cloudy", times: ["dusk"], days: [1,2,3,4,5,6,7] },
]);

/** Whole weeks since WEEK_ANCHOR_MS (not folded into the 4-week cycle); 0 before the anchor or on a bad input. */
export function getAbsoluteWeek(nowMs = Date.now()) {
  if (!Number.isFinite(nowMs) || nowMs < WEEK_ANCHOR_MS) return 0;
  return Math.floor((nowMs - WEEK_ANCHOR_MS) / WEEK_MS);
}

/**
 * The hero pair that takes this cell (condition folder + time of day) today, or null for the library slot.
 *
 * Each pair takes ONE of its allowed weekdays per week in its cell; the library serves every other day, so a pair
 * joins the rotation instead of replacing it. The day steps through the pair's allowed days one week at a time (offset
 * by its position in the table, so pairs spread out), and a pair whose day is already taken in that cell by an earlier
 * pair moves to its next free allowed day. Deterministic: every re-paint of the same cell on the same day agrees.
 */
export function pickHeroPair(folder, timeOfDay, nowMs = Date.now(), pairs = HERO_PAIRS) {
  const day = getRotationDay(nowMs);
  const week = getAbsoluteWeek(nowMs);
  const taken = new Set();
  let chosen = null;
  pairs.forEach((pair, i) => {
    if (pair.folder !== folder || !pair.times.includes(timeOfDay) || !pair.days.length) return;
    for (let k = 0; k < pair.days.length; k++) {
      const d = pair.days[(week + i + k) % pair.days.length];
      if (taken.has(d)) continue;
      taken.add(d);
      if (d === day && !chosen) chosen = pair;
      break;
    }
  });
  return chosen;
}

/** The URL of a hero pair's photograph (versioned like the grid: the folder is served immutable for a year). */
export function heroPairPath(pair, base = 'assets/images/bg-pairs') {
  return `${base}/${pair.id}.webp?v=${HERO_PAIRS_URL_VERSION}`;
}

/**
 * Build the 4-step fallback chain for a single picker selection.
 *
 * Step 1: primary pick (week_<N>/<time>/<r>)
 * Step 2: week_1 same-condition same-time, index 1 (week-collapse)
 * Step 3: week_1 sibling-folder same-time, index 1 (condition-collapse —
 *         cold falls back to cloudy, every other condition falls back to clear,
 *         matching the legacy chain semantics)
 * Step 4: assets/images/bg/default.jpg (final guard, served as JPG because
 *         that file pre-exists and is the only condition-agnostic fallback)
 *
 * All inputs are defensively clamped so a malformed condition string never
 * produces an undefined-segment URL.
 */
export function buildPickerPaths(folder, fallbackFolder, timeOfDay, week, r, base = 'assets/images/bg') {
  warnUnknownFolder(folder);
  const safeFolder = (typeof folder === 'string' && folder.length) ? folder : 'clear';
  const safeFallback = (typeof fallbackFolder === 'string' && fallbackFolder.length) ? fallbackFolder : 'clear';
  const safeTime = VALID_TIMES.has(timeOfDay) ? timeOfDay : 'day';
  const safeWeek = (Number.isInteger(week) && week >= 1 && week <= 4) ? week : 1;
  const safeR = (Number.isInteger(r) && r >= 1 && r <= 7) ? r : 1;
  // Dedupe-preserving-order. Three collapse cases produce equal entries:
  //   r === 1                       → primary == week_1 fallback
  //   folder === fallbackFolder     → week_1 fallback == sibling fallback
  //   both                          → all three primary entries collapse to one
  // Without dedupe, the chain wastes 1-2 redundant fetches before reaching default.jpg.
  const versionedWebp = (url) => `${url}?v=${BG_IMAGE_URL_VERSION}`;
  const raw = [
    versionedWebp(rotatingImagePath(base, safeFolder, safeTime, safeWeek, safeR)),
    versionedWebp(rotatingImagePath(base, safeFolder, safeTime, 1, 1)),
    versionedWebp(rotatingImagePath(base, safeFallback, safeTime, 1, 1)),
    `${base}/default.jpg`,
  ];
  return Array.from(new Set(raw));
}
