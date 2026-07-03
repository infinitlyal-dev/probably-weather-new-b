import { isRegionTagAt } from './geo-regions.js';

// Structural context metadata for witty lines (replaces the old
// WEEKDAY_ONLY_FRAGMENTS substring blocklist and weekend-filter.js's Saturday
// special-case).
//
// Tags are keyed by BIN + ROW INDEX, not by language. The five language arrays in
// each bin are row-aligned (same English line at the same index in every
// language), so a tag on an index applies to all five languages — a translation
// inherits its English row's tag. This is enforced in ONE place: dayAwarePool(),
// used by app.js getWittyLine and api/og.js pickWitty.
//
// Context tag shape:
//   { day?: 'weekday'|'weekend'|'sun'|'mon'|'tue'|'wed'|'thu'|'fri'|'sat',
//     time?: ['morning'|'day'|'evening'|'night'],
//     region?: 'western-cape'|'gauteng'|'highveld'|'free-state'|'karoo',
//     months?: [1..12] }
//   (absent) — any context
//
// No wording is stored or changed here — this is metadata over the existing bank.

const DAY_INDEX = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const COPY_FALLBACK = { hail: 'storm', thunder: 'storm' };

export const WITTY_DAY_TAGS = {
  witty: {
    // Day-named lines — show only on the day they name.
    fog: { 7: { day: 'tue' } },            // "Ghost town. But it's just Tuesday." (+ row-aligned af/zu/xh/st)
    'partly-cloudy': { 12: { day: 'weekend' } }, // "Almost a braai day." — braai PLAN
    weekend: { 19: { day: 'sat' } },       // "Saturday energy: maximum..."
    // Work-week lines — Mon–Fri only. cloudy[9] names Monday, so it is 'mon'.
    cloudy: { 9: { day: 'mon' } },
    heat: { 12: { day: 'weekday' }, 19: { day: 'weekday' }, 21: { day: 'weekday' } },
    rain: { 5: { day: 'weekday' }, 13: { day: 'weekday' }, 24: { day: 'weekday' }, 25: { day: 'weekday' }, 27: { day: 'weekday' }, 35: { day: 'weekday' } },
    clear: { 21: { day: 'weekday' } },
  },
  witty_low_confidence: {
    // braai lines here are all imagery/idiom ("don't bet the braai on it") — any day.
  },
};

export function timeSlotForHour(hour) {
  if (!Number.isFinite(Number(hour))) return null;
  const h = ((Math.floor(Number(hour)) % 24) + 24) % 24;
  if (h >= 5 && h <= 11) return 'morning';
  if (h >= 12 && h <= 16) return 'day';
  if (h >= 17 && h <= 20) return 'evening';
  return 'night';
}

export function seasonMonths(season) {
  if (season === 'winter') return [5, 6, 7, 8, 9];
  if (season === 'summer') return [10, 11, 12, 1, 2, 3];
  return [];
}

function normalizeContext(contextOrDay, hour) {
  if (contextOrDay && typeof contextOrDay === 'object' && !Array.isArray(contextOrDay)) {
    return contextOrDay;
  }
  return { day: contextOrDay, hour };
}

function normalizeTag(tag) {
  if (!tag) return {};
  if (typeof tag === 'string') return { day: tag };
  return tag;
}

// Fri-evening (>=16:00) counts as the weekend for braai plans, mirroring
// getWittyLine's isWeekend. Day-named tags ('sat' etc.) are exact-day only.
export function dayTagAllows(tag, day, hour) {
  const dayTag = normalizeTag(tag).day;
  if (!dayTag || !Number.isFinite(Number(day))) return true;
  if (dayTag === 'weekday') return day >= 1 && day <= 5;
  if (dayTag === 'weekend') return day === 0 || day === 6 || (day === 5 && Number(hour) >= 16);
  const named = DAY_INDEX[dayTag];
  if (named !== undefined) return day === named;
  return true; // unknown tag → don't hide
}

export function timeTagAllows(slots, hour) {
  if (!slots) return true;
  if (!Number.isFinite(Number(hour))) return true;
  const allowedSlots = Array.isArray(slots) ? slots : [slots];
  return allowedSlots.includes(timeSlotForHour(hour));
}

export function regionTagAllows(region, lat, lon) {
  if (!region) return true;
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) return true;
  const regions = Array.isArray(region) ? region : [region];
  return regions.some((entry) => isRegionTagAt(entry, lat, lon));
}

export function monthTagAllows(months, month) {
  if (!months) return true;
  if (!Number.isFinite(Number(month))) return true;
  const normalized = ((Math.floor(Number(month)) - 1) % 12 + 12) % 12 + 1;
  const allowedMonths = Array.isArray(months) ? months : [months];
  return allowedMonths.includes(normalized);
}

export function contextTagAllows(tag, context = {}) {
  const t = normalizeTag(tag);
  return dayTagAllows(t.day, Number(context.day), context.hour)
    && timeTagAllows(t.time, context.hour)
    && regionTagAllows(t.region, context.lat, context.lon)
    && monthTagAllows(t.months, context.month);
}

// The single enforcement point. Returns the non-empty lines allowed by every
// present context tag. Region tags fail open when coordinates are missing so a
// line can ride rather than going dark for unknown-location cards.
export function dayAwarePool(tagMap, arr, contextOrDay, hour) {
  const context = normalizeContext(contextOrDay, hour);
  const nonEmpty = [];
  const allowed = [];
  (Array.isArray(arr) ? arr : []).forEach((s, i) => {
    if (typeof s !== 'string' || s.trim() === '') return;
    nonEmpty.push(s);
    if (contextTagAllows((tagMap || {})[i], context)) allowed.push(s);
  });
  return allowed;
}

export function isWeekendContext(context = {}) {
  return dayTagAllows({ day: 'weekend' }, Number(context.day), context.hour);
}

function localizedPool(bank, bin, lang) {
  return bank?.[bin]?.[lang] || bank?.[bin]?.en;
}

function hasUsableLine(pool) {
  return Array.isArray(pool) && pool.some((s) => typeof s === 'string' && s.trim() !== '');
}

export function eligibleWittyPool({
  copy,
  tags = WITTY_DAY_TAGS,
  condition,
  lang = 'en',
  context = {},
  lowConfidence = false,
} = {}) {
  const safeCondition = condition || 'clear';

  if (lowConfidence) {
    const lcPool = localizedPool(copy?.witty_low_confidence, safeCondition, lang);
    if (hasUsableLine(lcPool)) {
      return {
        namespace: 'witty_low_confidence',
        bin: safeCondition,
        raw: lcPool,
        pool: dayAwarePool(tags.witty_low_confidence?.[safeCondition], lcPool, context),
      };
    }
  }

  if (isWeekendContext(context) && (safeCondition === 'clear' || safeCondition === 'heat')) {
    const weekendPool = localizedPool(copy?.witty, 'weekend', lang);
    if (hasUsableLine(weekendPool)) {
      return {
        namespace: 'witty',
        bin: 'weekend',
        raw: weekendPool,
        pool: dayAwarePool(tags.witty?.weekend, weekendPool, context),
      };
    }
  }

  const fb = COPY_FALLBACK[safeCondition];
  let bin = safeCondition;
  let lines = localizedPool(copy?.witty, safeCondition, lang);
  if (!lines && fb) { bin = fb; lines = localizedPool(copy?.witty, fb, lang); }
  if (!lines) { bin = 'clear'; lines = copy?.witty?.clear?.en || []; }

  return {
    namespace: 'witty',
    bin,
    raw: lines,
    pool: dayAwarePool(tags.witty?.[bin], lines, context),
  };
}
