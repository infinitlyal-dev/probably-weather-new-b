// Observation side of the accuracy harness: METAR archive → one record per
// local (SAST) hour per station.
//
// Source: Iowa Environmental Mesonet ASOS/METAR archive (mesonet.agron.iastate.edu),
// `format=onlycomma`, `data=all`, routine (3) + special (4) reports, UTC.
// Files: review/accuracy/obs/metar-<ICAO>-<from>-<to>.csv
//
// Truth here is what the station REPORTED, never a forecast:
//   precip  — present-weather group carries RA / DZ / SN / SG / PL / GR / GS / UP
//             (any intensity, incl. SHRA / TSRA). "VC.." (in the vicinity, not at
//             the station) and "RE.." (recent, not now) do not count.
//   thunder — TS in a present-weather group (not VCTS).
//   fog     — FG (not VCFG); mist — BR; haze — HZ.
//   wind    — sknt (knots, 10-min mean) → km/h; gust — the METAR gust group → km/h.
//   cloud   — the highest okta layer (FEW 2 · SCT 4 · BKN 6 · OVC/VV 8) → %;
//             CAVOK / SKC / NSC / CLR → 0.
//
// One record per hour: the routine report at :00 when present (SA airports report
// hourly on the hour), else the report nearest the top of the hour. The other
// reports in the same hour are kept in `all` so a rain SPECI at :20 is not lost:
// `precipAnyReport` is true if ANY report in the hour carried precipitation.

import { readFileSync } from 'node:fs';

const KT_TO_KPH = 1.852;
const MILE_TO_KM = 1.609344;
export const SAST_OFFSET_HOURS = 2;

const OKTA = { FEW: 2, SCT: 4, BKN: 6, OVC: 8, VV: 8 };

function num(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (s === '' || s === 'M') return null;
  if (s === 'T') return 0; // trace
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.length && !l.startsWith('#'));
  const header = lines[0].split(',');
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    // The raw METAR column can contain commas only inside quotes; IEM does not
    // quote, and SA METARs carry no commas, so a plain split is safe here.
    const cols = lines[i].split(',');
    if (cols.length < header.length) continue;
    const row = {};
    header.forEach((h, k) => { row[h] = cols[k]; });
    rows.push(row);
  }
  return rows;
}

export function classifyPresentWeather(wxcodes) {
  const out = { precip: false, thunder: false, fog: false, mist: false, haze: false, tokens: [] };
  const raw = String(wxcodes || '').trim();
  if (!raw || raw === 'M') return out;
  for (const tokRaw of raw.split(/\s+/)) {
    const tok = tokRaw.replace(/^[+-]/, '');
    out.tokens.push(tokRaw);
    if (!tok || tok.startsWith('VC') || tok.startsWith('RE')) continue;
    if (/(RA|DZ|SN|SG|PL|GR|GS|UP)/.test(tok)) out.precip = true;
    if (/TS/.test(tok)) out.thunder = true;
    if (/FG/.test(tok)) out.fog = true;
    if (/BR/.test(tok)) out.mist = true;
    if (/HZ/.test(tok)) out.haze = true;
  }
  return out;
}

export function cloudPctFromLayers(row) {
  const metar = String(row.metar || '');
  if (/\bCAVOK\b|\bSKC\b|\bNSC\b|\bCLR\b|\bNCD\b/.test(metar)) return 0;
  let okta = null;
  for (const k of ['skyc1', 'skyc2', 'skyc3', 'skyc4']) {
    const c = String(row[k] || '').trim();
    if (OKTA[c] != null) okta = Math.max(okta ?? 0, OKTA[c]);
  }
  if (okta == null) return null;
  return Math.round((okta / 8) * 100);
}

function toRecord(row) {
  const utc = new Date(row.valid.replace(' ', 'T') + 'Z');
  const local = new Date(utc.getTime() + SAST_OFFSET_HOURS * 3600e3);
  const wx = classifyPresentWeather(row.wxcodes);
  const tmpf = num(row.tmpf);
  const sknt = num(row.sknt);
  const gust = num(row.gust);
  const vsby = num(row.vsby);
  return {
    station: row.station,
    utc: utc.toISOString(),
    localIso: local.toISOString().slice(0, 16),
    localHourKey: local.toISOString().slice(0, 13), // 'YYYY-MM-DDTHH'
    minute: utc.getUTCMinutes(),
    tempC: tmpf == null ? null : Math.round(((tmpf - 32) * 5) / 9 * 10) / 10,
    windKph: sknt == null ? null : Math.round(sknt * KT_TO_KPH * 10) / 10,
    windKt: sknt,
    gustKph: gust == null ? null : Math.round(gust * KT_TO_KPH * 10) / 10,
    gustKt: gust,
    visKm: vsby == null ? null : Math.round(vsby * MILE_TO_KM * 10) / 10,
    cloudPct: cloudPctFromLayers(row),
    precip: wx.precip,
    thunder: wx.thunder,
    fog: wx.fog,
    mist: wx.mist,
    haze: wx.haze,
    wx: wx.tokens.join(' '),
    metar: row.metar,
  };
}

/**
 * Load one station's CSV → Map<localHourKey, hourRecord>.
 * hourRecord = the chosen report's fields + { all: [reports], precipAnyReport, thunderAnyReport }.
 */
export function loadStationHourly(csvPath) {
  const rows = parseCsv(readFileSync(csvPath, 'utf8'));
  const byHour = new Map();
  for (const row of rows) {
    if (!row.valid || row.valid === 'M') continue;
    const rec = toRecord(row);
    // Bucket by the UTC hour the report belongs to: a :50 report describes the
    // coming hour boundary less well than the :00 one, so the top-of-hour
    // report is preferred and the rest are kept as `all`.
    const list = byHour.get(rec.localHourKey) || [];
    list.push(rec);
    byHour.set(rec.localHourKey, list);
  }
  const out = new Map();
  for (const [key, list] of byHour) {
    list.sort((a, b) => a.minute - b.minute);
    const chosen = list.find((r) => r.minute === 0) || list[0];
    out.set(key, {
      ...chosen,
      all: list,
      precipAnyReport: list.some((r) => r.precip),
      thunderAnyReport: list.some((r) => r.thunder),
    });
  }
  return out;
}

/** True when the station reported precipitation at hour h, or in h-1 / h+1. */
export function precipNear(hourly, key) {
  const t = new Date(key + ':00:00Z').getTime();
  for (const d of [-1, 0, 1]) {
    const k = new Date(t + d * 3600e3).toISOString().slice(0, 13);
    const r = hourly.get(k);
    if (r && (r.precip || r.precipAnyReport)) return true;
  }
  return false;
}
