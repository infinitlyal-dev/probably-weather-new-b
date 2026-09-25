// THE LAST WEEK at Al's spots (Strand, Cape Town city) and the six recorder cities, 18 → 25 Sept 2026
// (PLAN.md §6, with Fable's change 9). Three columns per hour:
//   · what the app said — the recorder's reading where there is one (from 24 Sept 23:58 SAST; Al's two spots from
//     25 Sept 16:10), else the app's fog detector and rain rung replayed on Open-Meteo's archive (best_match as
//     itself; ECMWF, GFS, UK Met Office and ICON standing in for the other four sources — the one-fog-word and
//     description fog paths and Tomorrow.io's radar cannot be replayed, so a replayed hour shows fog only when
//     the detector would have fired);
//   · what the new rules say — the fog detector with the strict gates in the regions where they ship (rain and
//     frost do not change); on recorded hours, the recorded humidity with Open-Meteo's archived wind for that hour;
//   · what happened — the airport's report. Strand and Cape Town city have no station: Cape Town airport's report
//     is shown as nearby context (27 km from Strand), never as their truth.
//   node review/accuracy/v3/lastweek.mjs
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { DATA, RESULTS, isNum, round } from '../v2/lib.mjs';
import { regionOf } from '../../../api/_lib/regions.js';
import { FOG_STRICT_REGIONS, FOG_STRICT_MIN_HUMIDITY, FOG_STRICT_MAX_WIND_KPH, RAIN_NOW_MIN_PROB, RAIN_NOW_MIN_MM } from '../../../api/weather.js';
import { loadStationHourly } from '../lib/obs.mjs';

const FROM = '2026-09-18', TO = '2026-09-25';
const LIVE = 'C:/Users/27741/OneDrive/Desktop/Probably weather new/probably-weather-new-c/review/accuracy/live';
const PLACES = [
  { key: 'STRAND', name: 'Strand', lat: -34.1163, lon: 18.8362, metar: 'FACT', spot: 'Strand' },
  { key: 'CTCITY', name: 'Cape Town city', lat: -33.9249, lon: 18.4241, metar: 'FACT', spot: 'Cape Town city' },
  { key: 'FACT', name: 'Cape Town airport', lat: -33.9648, lon: 18.6017, metar: 'FACT' },
  { key: 'FAOR', name: 'Johannesburg', lat: -26.1392, lon: 28.2460, metar: 'FAOR' },
  { key: 'FALE', name: 'Durban', lat: -29.6144, lon: 31.1197, metar: 'FALE' },
  { key: 'FAPE', name: 'Gqeberha', lat: -33.9849, lon: 25.6173, metar: 'FAPE' },
  { key: 'FABL', name: 'Bloemfontein', lat: -29.0927, lon: 26.3024, metar: 'FABL' },
  { key: 'FAGG', name: 'George', lat: -34.0056, lon: 22.3789, metar: 'FAGG' },
];
const MODELS = ['best_match', 'ecmwf_ifs025', 'gfs_seamless', 'ukmo_seamless', 'icon_seamless'];
const VARS = ['visibility', 'relative_humidity_2m', 'temperature_2m', 'dew_point_2m', 'wind_speed_10m', 'precipitation', 'precipitation_probability', 'weather_code', 'cloud_cover'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- downloads (small; resumable) ----
for (const p of PLACES) {
  const f = path.join(DATA, `lastweek-${p.key}.json`);
  if (!existsSync(f)) {
    const u = `https://historical-forecast-api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}&hourly=${VARS.join(',')}&models=${MODELS.join(',')}&start_date=${FROM}&end_date=${TO}&timezone=Africa%2FJohannesburg`;
    const t = await (await fetch(u, { headers: { 'User-Agent': 'probably-weather accuracy check (research, low volume)' } })).text();
    JSON.parse(t); writeFileSync(f, t); await sleep(2000);
  }
}
for (const icao of [...new Set(PLACES.map((p) => p.metar))]) {
  const f = path.join(DATA, `lastweek-metar-${icao}.csv`);
  if (!existsSync(f)) {
    const u = `https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?station=${icao}&data=all&year1=2026&month1=9&day1=17&year2=2026&month2=9&day2=26&tz=Etc/UTC&format=onlycomma&latlon=no&elev=no&missing=M&trace=T&direct=no&report_type=3&report_type=4`;
    writeFileSync(f, await (await fetch(u)).text()); await sleep(4000);
  }
}

// ---- the recorder's readings: served key and reason per place and SAST hour ----
const served = new Map();   // `${key}|YYYY-MM-DDTHH` → { key, reason, humidity, rainChance }
for (const file of existsSync(LIVE) ? readdirSync(LIVE).filter((x) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(x)) : []) {
  for (const line of readFileSync(path.join(LIVE, file), 'utf8').split('\n')) {
    if (!line.trim()) continue; let r; try { r = JSON.parse(line); } catch { continue; }
    const p = r.api?.payload; if (!p?.now) continue;
    const key = r.icao || PLACES.find((x) => x.spot === r.spot)?.key; if (!key) continue;
    const hour = new Date(Date.parse(r.api.atUtc || r.runAtUtc) + 7200e3).toISOString().slice(0, 13);
    served.set(`${key}|${hour}`, { key: p.now.conditionKey, reason: p.now.conditionReason, humidity: p.meta?.conditionConfidence?.fogSignal?.humidity ?? null });
  }
}

const RAINY = (c) => isNum(c) && ((c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95);
const FAMILY = { best_match: 'ECMWF', ecmwf_ifs025: 'ECMWF', gfs_seamless: 'GFS', ukmo_seamless: 'UKMO', icon_seamless: 'ICON' };
const metProxy = (mm) => (!isNum(mm) ? null : mm === 0 ? 0 : mm < 0.5 ? 20 : mm < 1 ? 40 : mm < 2 ? 60 : 80);
const wavg = (pairs) => { let s = 0, w = 0; for (const [v, k] of pairs) if (isNum(v)) { s += v * k; w += k; } return w ? s / w : null; };

const out = { from: FROM, to: TO, places: {} };
for (const p of PLACES) {
  const j = JSON.parse(readFileSync(path.join(DATA, `lastweek-${p.key}.json`), 'utf8')).hourly;
  const obs = loadStationHourly(path.join(DATA, `lastweek-metar-${p.metar}.csv`));
  const region = regionOf(p.lat, p.lon), strict = FOG_STRICT_REGIONS.includes(region);
  const g = (v, m, i) => j[`${v}_${m}`]?.[i] ?? null;
  const hours = [];
  for (let i = 0; i < j.time.length; i++) {
    const hk = j.time[i].slice(0, 13);
    if (Date.parse(`${hk}:00:00Z`) - 7200e3 > Date.now()) break;
    const vis = g('visibility', 'best_match', i), rh = g('relative_humidity_2m', 'best_match', i), t = g('temperature_2m', 'best_match', i), dew = g('dew_point_2m', 'best_match', i);
    const pp = g('precipitation_probability', 'best_match', i), mm = g('precipitation', 'best_match', i), wind = g('wind_speed_10m', 'best_match', i);
    const spread = isNum(t) && isNum(dew) ? t - dew : null;
    const detector = (h) => isNum(vis) && vis < 1500 && isNum(h) && h >= 90 && isNum(spread) && spread <= 2 && (!isNum(pp) || pp < 30) && (!isNum(mm) || mm < 0.2);
    const strictOk = (h) => !strict || (isNum(h) && h >= FOG_STRICT_MIN_HUMIDITY && isNum(wind) && wind <= FOG_STRICT_MAX_WIND_KPH);
    // rain rung, today's rule, stand-ins [OM, WA, Pirate, MET, TI] = [best_match, ECMWF, GFS, UKMO, ICON]
    const fams = new Map(); for (const m of MODELS) { const c = g('weather_code', m, i); if (!fams.has(FAMILY[m]) || m === 'best_match') fams.set(FAMILY[m], c); }
    const votes = [...fams.values()].filter(RAINY).length;
    const chance = wavg([[pp, 0.30], [g('precipitation_probability', 'ecmwf_ifs025', i), 0.22], [metProxy(g('precipitation', 'ukmo_seamless', i)), 0.20], [g('precipitation_probability', 'icon_seamless', i), 0.15]]);
    const amount = wavg([[mm, 0.30], [g('precipitation', 'ecmwf_ifs025', i), 0.22], [g('precipitation', 'ukmo_seamless', i), 0.20], [g('precipitation', 'icon_seamless', i), 0.15]]);
    const rec = served.get(`${p.key}|${hk}`);
    const replayFog = detector(rh), replayRain = votes >= 2 && isNum(chance) && chance >= RAIN_NOW_MIN_PROB && isNum(amount) && amount >= RAIN_NOW_MIN_MM;
    const said = rec ? rec.key : replayRain ? 'rain' : replayFog ? 'fog' : 'other';
    // the new rules: only fog changes (strict gates here, if this region has them)
    const saidNow = said === 'fog' && (!rec || rec.reason === 'visibility-humidity-fog-detector') && !strictOk(rec ? rec.humidity ?? rh : rh) ? 'not fog' : said;
    const o = obs.get(hk);
    const fog = o ? ((o.all || [o]).some((x) => !x.precip && isNum(x.visKm) && x.visKm < 1) ? 'fog' : o.mist ? 'mist' : 'no fog') : null;
    const rained = o ? Boolean(o.precip || o.precipAnyReport) : null;
    hours.push({ hour: hk, source: rec ? 'recorded' : 'replayed', said, reason: rec?.reason ?? null, saidNow, fog, rained, metar: o?.metar?.replace(/^\w{4} \d{6}Z /, '').slice(0, 44) ?? null });
  }
  const count = (f) => hours.filter(f).length;
  out.places[p.key] = { name: p.name, region, strict, truthFrom: p.metar === p.key ? 'its own airport' : `${p.metar} (nearby context, not this place's truth)`, hours,
    summary: {
      fogSaid: count((h) => h.said === 'fog'), fogSaidNow: count((h) => h.saidNow === 'fog'),
      fogSaidAndFog: count((h) => h.said === 'fog' && h.fog === 'fog'), fogSaidNowAndFog: count((h) => h.saidNow === 'fog' && h.fog === 'fog'),
      fogHours: count((h) => h.fog === 'fog'), rainSaid: count((h) => h.said === 'rain'), rainSaidAndRained: count((h) => h.said === 'rain' && h.rained), rainHours: count((h) => h.rained),
      recorded: count((h) => h.source === 'recorded'),
    } };
}
mkdirSync(RESULTS, { recursive: true });
writeFileSync(path.join(RESULTS, 'v3-lastweek.json'), JSON.stringify(out, (k, x) => (typeof x === 'number' ? round(x, 2) : x), 1));
console.log(`LAST WEEK ${FROM} → ${TO} (recorded hours are what the app really said; the rest replayed)`);
for (const [k, p] of Object.entries(out.places)) {
  const s = p.summary;
  console.log(`${p.name.padEnd(18)} ${String(p.region).padEnd(13)} ${p.strict ? 'strict' : 'standard'} · fog said ${s.fogSaid} → ${s.fogSaidNow} (fog at ${p.truthFrom === 'its own airport' ? 'the airport' : 'FACT'} in ${s.fogSaidAndFog} → ${s.fogSaidNowAndFog} of them; fog hours ${s.fogHours}) · Rain's here ${s.rainSaid} (rained ${s.rainSaidAndRained}); rain hours ${s.rainHours} · recorded hours ${s.recorded}`);
}
