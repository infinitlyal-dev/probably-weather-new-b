// Weekend witty pool — day-of-week filtering.
//
// Lives in its own micro-module (Group 6 bundle split) so app.js can import
// it WITHOUT statically pulling the full five-language copy bank that used to
// share a file with it. assets/weather-copy.js re-exports both names, so the
// API endpoints and existing tests keep their import paths.
//
// WEATHER_COPY.witty.weekend is selected for clear/heat on any weekend day
// (Sat / Sun / Fri-evening). Its one day-NAMED line (index 19 in every
// language — "Saturday energy" / "Saterdagenergie" / "Amandla angoMgqibelo"
// (zu+xh) / "Matla a Moqebelo" (st)) must only surface on an actual Saturday.
// These fragments tag that line in all five languages; the filter drops it on
// non-Saturday days. No copy is invented or re-translated — existing
// native-reviewed lines are only re-bucketed by day.
export const WEEKEND_SATURDAY_FRAGMENTS = ['saturday energy', 'saterdagenergie', 'mgqibelo', 'moqebelo'];

/**
 * Filter a weekend witty pool so day-named lines only appear on their day.
 * Only Saturday-named lines exist today, so on any non-Saturday day the
 * Saturday line is dropped. Mirrors app.js's WEEKDAY_ONLY_FRAGMENTS approach:
 * a >=3-line floor guards against ever collapsing the pool.
 *
 * @param {string[]} pool  the weekend pool for the active language
 * @param {number} day     0=Sun … 6=Sat (from getLocationDayOfWeek)
 * @returns {string[]}     day-appropriate pool (new array; input untouched)
 */
export function filterWeekendPoolForDay(pool, day) {
  if (!Array.isArray(pool)) return pool;
  if (day === 6) return pool.slice();   // Saturday — every line is valid
  const filtered = pool.filter((line) => {
    const l = String(line).toLowerCase();
    return !WEEKEND_SATURDAY_FRAGMENTS.some((f) => l.includes(f));
  });
  return filtered.length >= 3 ? filtered : pool.slice();
}
