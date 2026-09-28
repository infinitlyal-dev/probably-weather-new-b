// GUSTS — the hero's gust line per region, and the gust correction where a SA Weather Service station proved it
// (review/accuracy/v7/PLAN.md, EVAL §14, 28 Sept 2026). Al, Strand, 28 Sept: "those gusts dont stop. it is pumping
// outside ... and our app is saying cloudy vibes for strand right now." The rules that passed their pre-registered
// test (tuned March–June 2026, proven July → 28 Sept at every gust-reporting SYNOP station and airport) are in
// gust-table.js, generated from the results; where nothing passed, the answer is exactly today's (a gust of 55 km/h,
// no correction).
import { GUST_TABLE } from './gust-table.js';
import { regionOf } from './regions.js';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const round1 = (x) => Math.round(x * 10) / 10;

/** Today's gust line for the hero's Windy rung (km/h) — api/weather.js WIND_NOW_GUST_KPH. */
export const GUST_LINE_TODAY = 55;
/** A place takes a station's correction only within this distance of one of the towns listed for it (a town may
 *  carry its own, smaller radius — `km` — where a larger circle would cross a ridge or reach another coast). */
export const TOWN_KM = 5;

const STRAND_68911 = { lat: -34.1408, lon: 18.8483, km: 15 };
function km(aLat, aLon, bLat, bLon) {
  const R = Math.PI / 180, dLat = (bLat - aLat) * R, dLon = (bLon - aLon) * R;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * R) * Math.cos(bLat * R) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 8 × 45° sectors (N, NE, E, SE, S, SW, W, NW) of a FROM bearing; null without one. */
export const sectorOf = (deg) => (isNum(deg) ? Math.floor((((deg % 360) + 360 + 22.5) % 360) / 45) : null);

/**
 * The Windy rung's gust line (km/h) and "enough sources" count at this place: the region's shipped rule, the Strand
 * zone's own decision within 15 km of 68911, today's (55, none) everywhere else.
 */
export function gustRuleAt(lat, lon) {
  const region = regionOf(lat, lon);
  const today = { gustLineKph: GUST_LINE_TODAY, sourcesAt25: 0, region, rule: 'today' };
  if (!region) return today;
  if (GUST_TABLE.strandZone && km(lat, lon, STRAND_68911.lat, STRAND_68911.lon) <= STRAND_68911.km) {
    const z = GUST_TABLE.strandZone;
    return z.rule === 'today' ? today : { gustLineKph: z.gustLineKph, sourcesAt25: z.sourcesAt25 ?? 0, region, rule: z.rule };
  }
  const r = GUST_TABLE.regions[region];
  return r ? { gustLineKph: r.gustLineKph, sourcesAt25: r.sourcesAt25 ?? 0, region, rule: r.rule } : today;
}

/** The shipped station whose listed towns include this place (nearest town within TOWN_KM), or null. */
export function gustStationAt(lat, lon) {
  let best = null;
  for (const s of GUST_TABLE.stations) {
    for (const t of s.towns) {
      const d = km(lat, lon, t.lat, t.lon);
      if (d <= (t.km ?? TOWN_KM) && (!best || d < best.d)) best = { d, station: s, town: t.name };
    }
  }
  return best;
}

/**
 * The factor every source's gust takes here: the covering station's ratio for the wind's direction (Open-Meteo's
 * bearing, the one the app shows). 1 where no station covers the place or there is no bearing.
 */
export function gustFactorAt(lat, lon, dirDeg) {
  const hit = gustStationAt(lat, lon);
  const sector = sectorOf(dirDeg);
  if (!hit || sector === null) return { factor: 1, station: hit?.station.id ?? null, town: hit?.town ?? null, sector };
  const f = hit.station.sectors[sector];
  return { factor: isNum(f) ? f : 1, station: hit.station.id, town: hit.town, sector };
}

export const correctGust = (g, factor) => (isNum(g) ? round1(g * factor) : null);
