// Structural day metadata for witty lines (replaces the old WEEKDAY_ONLY_FRAGMENTS
// substring blocklist and weekend-filter.js's Saturday special-case).
//
// Tags are keyed by BIN + ROW INDEX, not by language. The five language arrays in
// each bin are row-aligned (same English line at the same index in every
// language), so a tag on an index applies to all five languages — a translation
// inherits its English row's tag. This is enforced in ONE place: pickDayAware(),
// used by app.js getWittyLine and api/og.js pickWitty.
//
// Tag values:
//   'weekday'  — Mon–Fri only (commute / office / work-day lines)
//   'weekend'  — Sat / Sun / Fri-evening only (braai *plans*; braai *imagery* is
//                left untagged so it fires any day — owner ruling 2026-07-02)
//   'sun'|'mon'|'tue'|'wed'|'thu'|'fri'|'sat' — that weekday only (day-named lines)
//   (absent)   — any day
//
// No wording is stored or changed here — this is metadata over the existing bank.

const DAY_INDEX = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

export const WITTY_DAY_TAGS = {
  witty: {
    // Day-named lines — show only on the day they name.
    fog: { 7: 'tue' },            // "Ghost town. But it's just Tuesday." (+ row-aligned af/zu/xh/st)
    'partly-cloudy': { 12: 'weekend' }, // "Almost a braai day." — braai PLAN
    weekend: { 19: 'sat' },       // "Saturday energy: maximum..."
    // Work-week lines — Mon–Fri only. cloudy[9] names Monday, so it is 'mon'.
    cloudy: { 9: 'mon' },
    heat: { 12: 'weekday', 19: 'weekday', 21: 'weekday' },
    rain: { 5: 'weekday', 13: 'weekday', 24: 'weekday', 25: 'weekday', 27: 'weekday', 35: 'weekday' },
    clear: { 21: 'weekday' },
  },
  witty_low_confidence: {
    // braai lines here are all imagery/idiom ("don't bet the braai on it") — any day.
  },
};

// Fri-evening (>=16:00) counts as the weekend for braai plans, mirroring
// getWittyLine's isWeekend. Day-named tags ('sat' etc.) are exact-day only.
export function dayTagAllows(tag, day, hour) {
  if (!tag) return true;
  if (tag === 'weekday') return day >= 1 && day <= 5;
  if (tag === 'weekend') return day === 0 || day === 6 || (day === 5 && Number(hour) >= 16);
  const named = DAY_INDEX[tag];
  if (named !== undefined) return day === named;
  return true; // unknown tag → don't hide
}

// The single enforcement point. Returns the lines allowed on `day` AND non-empty.
// Never returns an empty list when the bin has any non-empty line: if the day
// filter would empty the pool, it falls back to all non-empty lines (a slightly
// off-day line beats a blank). The caller does the random / hash pick.
export function dayAwarePool(tagMap, arr, day, hour) {
  const nonEmpty = [];
  const allowed = [];
  (Array.isArray(arr) ? arr : []).forEach((s, i) => {
    if (typeof s !== 'string' || s.trim() === '') return;
    nonEmpty.push(s);
    if (dayTagAllows((tagMap || {})[i], day, hour)) allowed.push(s);
  });
  return allowed.length ? allowed : nonEmpty;
}
