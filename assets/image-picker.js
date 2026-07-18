// Probably Weather — background image picker (date-based 4-week rotation).
//
// Reads from the new weekly batch folder structure:
//   assets/images/bg/<condition>/week_<1..4>/<dawn|day|dusk|night>/<1..7>.webp
//
// Pure functions only — DOM wiring lives in app.js so this module is unit-testable
// without jsdom.
//
// Week rotation is anchored to a fixed UTC instant representing Saturday
// 30 May 2026 at 00:00 SAST (UTC+2). Date.UTC is explicit and parser-safe.
// SAST midnight = 22:00 UTC the previous day, hence Date.UTC(2026, 4, 29, 22).
export const LAUNCH_DATE_MS = Date.UTC(2026, 4, 29, 22, 0, 0, 0);
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
// Backgrounds are CDN-cached immutable for one year. Bump this whenever any
// rotating WebP bytes change so returning clients request a fresh URL instead
// of retaining the old body at the stable filesystem path.
export const BG_IMAGE_URL_VERSION = '20260718-p1';

export const BG_IMAGE_SLOT_FOLDERS = [
  'clear', 'cloudy', 'cold', 'cold-clear', 'fog', 'heat', 'rain', 'storm', 'wind',
];
export const BG_IMAGE_SLOT_TIMES = ['dawn', 'day', 'dusk', 'night'];
const VALID_TIMES = new Set(BG_IMAGE_SLOT_TIMES);
// The 9 promoted folders. Folder names outside this set are *not* rejected —
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
 * Return the active rotation week (1..4) for a given UTC timestamp.
 *
 * The week boundary flips at the same UTC instant for everyone, which
 * corresponds to Saturday 00:00 SAST. Dates before launch return 1
 * (graceful default — users testing pre-launch see the first batch).
 * NaN / non-finite inputs also return 1 rather than throwing.
 */
export function getRotationWeek(nowMs = Date.now()) {
  if (!Number.isFinite(nowMs) || !Number.isFinite(LAUNCH_DATE_MS)) return 1;
  const elapsed = nowMs - LAUNCH_DATE_MS;
  if (elapsed < 0) return 1;
  return (Math.floor(elapsed / WEEK_MS) % 4) + 1;
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

/**
 * Return an integer 1..7 inclusive from Math.random().
 * Extracted for test mockability — tests stub Math.random and assert this maps
 * 0 → 1, 0.5 → 4, 0.99 → 7.
 */
export function pickRandomIndex() {
  return 1 + Math.floor(Math.random() * 7);
}
