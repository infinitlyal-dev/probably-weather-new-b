// WIND — the number the app shows and the Windy line the hero reads (review/accuracy/v5/PLAN.md, EVAL §12, 28 Sept
// 2026). Until then the now-wind was a plain weighted mean of the five sources; at Strand on 28 Sept that read 19 km/h
// while the SA Weather Service station in Strand measured 28 km/h gusting 50. The rule that passed its pre-registered
// test (tuned on 2025, proven on 2026 at 16 airports under three guesses of which model each source runs, with the
// live recorder's real sources as a guard) is in wind-table.js, generated from the results; where it was not proven
// or was blocked, the answer is exactly today's blend.
import { WIND_TABLE } from './wind-table.js';
import { WIND_WEIGHTS } from './wind-weights.js';
import { regionOf } from './regions.js';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const round1 = (x) => Math.round(x * 10) / 10;

/** Today's Windy line on the blended mean (km/h) — used wherever the v5 rule does not apply. */
export const WIND_MEAN_KPH_TODAY = 25;

/** Median of the numbers present; an even count takes the mean of the two middle values. */
export function median(values) {
  const v = (values || []).filter(isNum).sort((a, b) => a - b);
  if (!v.length) return null;
  const k = v.length >> 1;
  return v.length % 2 ? v[k] : (v[k - 1] + v[k]) / 2;
}

export const seasonOf = (month) => (month === 12 || month <= 2 ? 'DJF' : month <= 5 ? 'MAM' : month <= 8 ? 'JJA' : 'SON');
export const partOf = (hour) => (hour < 6 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening');

// Strand's own station (WMO 68911): the change is blocked within 15 km of it if its transfer test said so.
const STRAND_68911 = { lat: -34.1408, lon: 18.8483, km: 15 };
function km(aLat, aLon, bLat, bLon) {
  const R = Math.PI / 180, dLat = (bLat - aLat) * R, dLon = (bLon - aLon) * R;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * R) * Math.cos(bLat * R) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * The region where the v5 wind rule applies at this place, or null (today's blend): outside South Africa, a region
 * with no airport to learn from (no table), a region the test blocked, or near Strand's station if it blocked it.
 */
export function windRegionAt(lat, lon) {
  const t = WIND_TABLE;
  if (!t.rule) return null;
  const region = regionOf(lat, lon);
  if (!region || !t.regions.includes(region) || t.blockedRegions.includes(region)) return null;
  if (t.strandBlocked && km(lat, lon, STRAND_68911.lat, STRAND_68911.lon) <= STRAND_68911.km) return null;
  return region;
}

// Wind's own say-per-source (review/accuracy/v6, EVAL §13): the hourly sources are OM, WA, MET, TI — slots 0, 1, 3, 4
// of the five (Pirate has no hourly wind).
const HOURLY_SLOTS = [0, 1, 3, 4];
function weightedMean(values, weights) {
  let s = 0, ws = 0;
  values.forEach((v, i) => { if (isNum(v) && weights[i] > 0) { s += v * weights[i]; ws += weights[i]; } });
  return ws > 0 ? s / ws : null;
}

/**
 * One wind number (now, or one hour of the hourly array). raw = today's weighted blend; values = each source's own
 * wind for the same moment; slots = the same, one per source in its fixed place (null where a source did not answer —
 * five for kind 'now' [OM, WA, Pirate, MET, TI], four for kind 'hour' [OM, WA, MET, TI]); month 1–12 and hour 0–23 are
 * local. Returns the number to show and to decide with, and what made it (for meta.wind and the recorder).
 */
export function shapeWind({ raw, values, slots, kind = 'now', lat, lon, month, hour }) {
  const region = windRegionAt(lat, lon);
  const t = WIND_TABLE;
  if (!region || !isNum(raw)) return { kph: raw ?? null, rawKph: raw ?? null, rule: 'today', ratio: 1, region: region ?? regionOf(lat, lon) ?? null };
  // v6: where wind's own weights passed, each source's wind counts by how right it has been there (weights renormalise
  // over the sources that answered), × k — the ratio the Windy consensus then uses too.
  const lw = WIND_WEIGHTS.regions[region];
  if (lw && Array.isArray(slots) && (kind === 'now' || WIND_WEIGHTS.hourlyFollows)) {
    const w = kind === 'hour' ? HOURLY_SLOTS.map((i) => lw.weights[i]) : lw.weights;
    const k = kind === 'hour' ? lw.k4 : lw.k;
    const b = weightedMean(slots, w);
    if (isNum(b)) return { kph: round1(b * k), rawKph: raw, rule: 'LW', ratio: k, region, weights: w };
  }
  const base = t.rule.startsWith('M') ? median(values) : raw;
  if (!isNum(base)) return { kph: raw, rawKph: raw, rule: 'today', ratio: 1, region };
  const ratio = t.rule.endsWith('C') ? (t.ratios[region]?.[seasonOf(month)]?.[partOf(hour)] ?? 1) : 1;
  return { kph: round1(base * ratio), rawKph: raw, rule: t.rule, ratio, region };
}

/**
 * The hero's Windy line (km/h, on the number shapeWind returns) and the factor a single source's own wind is
 * multiplied by before the consensus check. Where the headline gate did not pass, or the rule does not apply, the
 * ladder reads today's raw blend at today's line.
 */
export function windLine(shaped) {
  const applies = shaped && shaped.rule !== 'today' && WIND_TABLE.headline?.ships;
  return applies
    ? { kph: shaped.kph, thresholdKph: WIND_TABLE.headline.thresholdKph, sourceFactor: shaped.ratio }
    : { kph: shaped?.rawKph ?? null, thresholdKph: WIND_MEAN_KPH_TODAY, sourceFactor: 1 };
}
