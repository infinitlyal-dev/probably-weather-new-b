// LIVE SAMPLE — production's own per-source numbers at the six harness airports, read
// ONCE, next to what those airports reported today. One moment at six places: an
// anecdote, not a score. The backtest is blend-vs-sources.mjs.
//
//   node review/accuracy/live-sample.mjs            # 6 production calls + 1 METAR call, then write
//   node review/accuracy/live-sample.mjs --from review/accuracy/results/live-sample-2026-09-23.json
//                                                   # re-render a saved sample, no network
//
// Production: GET https://www.probablyweather.co.za/api/weather?lat=&lon= at each airport's
// coordinates (lib/sources.mjs CITIES) — one call per airport, one retry on failure, nothing more.
// METAR: aviationweather.gov data API, last 24 h, all six stations in one call; the IEM
// archive (the harness's own source) only if that fails.
//
// WHAT meta.sourceRanges COVERS — not one window. api/weather.js:2639–2643 ships, per live
// source, minTemp = displayLow ?? todayLow and maxTemp = displayHigh ?? todayHigh:
//   Open-Meteo     daily.temperature_2m_max/min[0]           whole local calendar day            :1183–1184
//   WeatherAPI     forecastday[0].day.maxtemp_c/mintemp_c    whole local calendar day            :1316–1317
//   Pirate Weather daily[0].temperatureHigh / temperatureMin  high = Pirate's DAYTIME high
//                                                            (06:00–18:00); low = calendar day   :1445, :1456–1457
//   MET Norway     displayHigh / displayLow                  now → local midnight while ≥ 12 of
//                                                            today's hours remain (to ~12:00);
//                                                            after that MET's next 24 h — mostly
//                                                            TOMORROW                            :1614–1637
//   Tomorrow.io    todayHigh / todayLow                      now → local midnight, however few
//                                                            hours remain                        :1774–1778
// The blend beside them, daily[0].highC / lowC (:2068–2069), takes MET's high only while its
// strict window holds (todayHigh is null after ~12:00, :1646) and Tomorrow.io's rest-of-day
// high always; the blended LOW gives MET and Tomorrow.io no weight (LOW_WEIGHTS, :1974).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ACCURACY_ROOT, CITIES } from './lib/sources.mjs';
import { classifyPresentWeather, SAST_OFFSET_HOURS } from './lib/obs.mjs';

const API = 'https://www.probablyweather.co.za/api/weather';
const AWC = 'https://aviationweather.gov/api/data/metar';
const UA = 'probably-weather accuracy harness (review/accuracy/live-sample.mjs)';
const KT_TO_KPH = 1.852;
const OBS_WINDY = { sustainedKph: 30, gustKph: 45 };   // run-eval.mjs: Beaufort 5 or a gust you notice
const SLOTS = ['Open-Meteo', 'WeatherAPI', 'Pirate Weather', 'MET Norway', 'Tomorrow.io'];
const SHORT = { 'Open-Meteo': 'OM', WeatherAPI: 'WA', 'Pirate Weather': 'PW', 'MET Norway': 'MET', 'Tomorrow.io': 'TI' };

const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const FROM = argOf('--from', null);

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const sastIso = (ms) => new Date(ms + SAST_OFFSET_HOURS * 3600e3).toISOString().slice(0, 16);
const fmt = (v, d = 1) => (isNum(v) ? (Math.round(v * 10 ** d) / 10 ** d).toFixed(d) : '—');
const signed = (v) => (isNum(v) ? `${v > 0 ? '+' : ''}${fmt(v)}` : '—');

async function getOnce(url, as) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return as === 'json' ? r.json() : r.text();
}
// One try and one retry — never more.
async function getWithOneRetry(url, as = 'json') {
  const at = new Date().toISOString();
  try { return { ok: true, at, attempts: 1, body: await getOnce(url, as) }; } catch (e1) {
    try { return { ok: true, at, attempts: 2, firstError: String(e1.message || e1), body: await getOnce(url, as) }; } catch (e2) {
      return { ok: false, at, attempts: 2, error: String(e2.message || e2) };
    }
  }
}

// ---- METAR text → the fields this sample needs (present conditions only, not the trend) ----
const WX_TOKEN = /^(\+|-|VC|RE)?(MI|BC|PR|DR|BL|SH|TS|FZ)?(DZ|RA|SN|SG|IC|PL|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|PY|PO|SQ|FC|SS|DS)*$/;
function parseMetarText(raw) {
  const body = String(raw || '').split(/\s(?:RMK|TEMPO|BECMG|NOSIG)\b/)[0];
  const toks = body.trim().split(/\s+/).slice(2); // skip the report type / station / time tokens; none of the patterns below matches them
  let tempC = null, windKt = null, gustKt = null, okta = null, clearCode = false, cloudUnobserved = false;
  const wx = [];
  for (const t of toks) {
    let m;
    if ((m = /^(M?\d{2})\/(M?\d{2})?$/.exec(t))) { tempC = Number(m[1].replace('M', '-')); continue; }
    if ((m = /^(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?KT$/.exec(t))) { windKt = Number(m[2]); gustKt = m[3] ? Number(m[3]) : null; continue; }
    if ((m = /^(FEW|SCT|BKN|OVC|VV)(\d{3}|\/\/\/)/.exec(t))) { okta = Math.max(okta ?? 0, { FEW: 2, SCT: 4, BKN: 6, OVC: 8, VV: 8 }[m[1]]); continue; }
    if (/^(CAVOK|NSC|SKC|NCD|CLR)$/.test(t)) { clearCode = true; continue; }
    if (/^\/{6,}/.test(t)) { cloudUnobserved = true; continue; }
    if (t.length >= 2 && t !== 'AUTO' && t !== 'COR' && WX_TOKEN.test(t)) wx.push(t);
  }
  return {
    tempC, windKt, gustKt,
    cloudOkta: clearCode ? 0 : okta,
    cloudUnobserved: cloudUnobserved && okta == null && !clearCode,
    wxFromText: wx.join(' '),
    // "//" in the present-weather slot = not observed (the overnight AUTO reports at
    // Bloemfontein and some at George) — a dry-looking report that observed nothing.
    wxNotObserved: /(^|\s)\/\/(\s|$)/.test(body),
  };
}

function observedCategory(o) {
  // The observed hour in the source-vote vocabulary (categorizeDesc, api/weather.js:3530–3547):
  // storm / rain / fog / cloudy / clear. BKN–OVC (≥ 6 oktas) = cloudy, FEW–SCT = clear
  // (categorizeDesc files "Partly cloudy" under clear).
  if (o.wxNotObserved && !o.wx.precip && !o.wx.thunder) return 'unobserved';
  if (o.wx.thunder) return 'storm';
  if (o.wx.precip) return 'rain';
  if (o.wx.fog || o.wx.mist || o.wx.haze) return 'fog';
  if (!isNum(o.cloudOkta)) return 'unobserved';
  return o.cloudOkta >= 6 ? 'cloudy' : 'clear';
}

// ---- fetch (or load) ----
const STALE_MIN = 90;   // a latest report older than this is not "right now"

let sample;
if (FROM) {
  const { summary: _derived, sastDate: _date, ...raw } = JSON.parse(readFileSync(path.resolve(FROM), 'utf8'));
  sample = raw;   // the fetched evidence; everything derived is recomputed below
  process.stderr.write(`re-rendering ${FROM} (no network)\n`);
} else {
  const startedAt = new Date().toISOString();
  const api = {};
  for (const [icao, c] of Object.entries(CITIES)) {
    const url = `${API}?lat=${c.lat}&lon=${c.lon}`;
    const r = await getWithOneRetry(url, 'json');
    api[icao] = { url, at: r.at, attempts: r.attempts, ok: r.ok && r.body?.ok !== false, error: r.error ?? r.firstError ?? null, payload: r.ok ? pickPayload(r.body) : null };
    process.stderr.write(`${icao} API ${api[icao].ok ? 'ok' : 'FAILED ' + api[icao].error} (${r.at})\n`);
  }
  const ids = Object.keys(CITIES).join(',');
  let metarSource = 'aviationweather.gov', metarUrl = `${AWC}?ids=${ids}&format=json&hours=24`;
  let reports = [];
  const m = await getWithOneRetry(metarUrl, 'json');
  if (m.ok && Array.isArray(m.body)) {
    reports = m.body.map((x) => ({ icao: x.icaoId, obsTimeUtc: isNum(x.obsTime) ? new Date(x.obsTime * 1000).toISOString() : (x.reportTime ? new Date(x.reportTime).toISOString() : null), temp: x.temp, wspd: x.wspd, wgst: x.wgst, wxString: x.wxString ?? null, metarType: x.metarType ?? null, rawOb: x.rawOb }));
  } else {
    // Fallback: the IEM archive the harness already uses, today and yesterday (UTC).
    metarSource = 'IEM ASOS/METAR archive (fallback)';
    const now = new Date(); const y = new Date(now.getTime() - 86400e3);
    metarUrl = `https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?${Object.keys(CITIES).map((s) => `station=${s}`).join('&')}&data=metar&year1=${y.getUTCFullYear()}&month1=${y.getUTCMonth() + 1}&day1=${y.getUTCDate()}&year2=${now.getUTCFullYear()}&month2=${now.getUTCMonth() + 1}&day2=${now.getUTCDate() + 1}&tz=Etc/UTC&format=onlycomma&latlon=no&elev=no&missing=M&trace=T&direct=no&report_type=3&report_type=4`;
    const f = await getWithOneRetry(metarUrl, 'text');
    if (f.ok) {
      const lines = f.body.split(/\r?\n/).filter((l) => l && !l.startsWith('#'));
      const hdr = lines[0].split(',');
      for (const l of lines.slice(1)) {
        const c = l.split(','); const row = {}; hdr.forEach((h, k) => { row[h] = c[k]; });
        reports.push({ icao: row.station, obsTimeUtc: new Date(row.valid.replace(' ', 'T') + 'Z').toISOString(), temp: null, wspd: null, wgst: null, wxString: null, metarType: null, rawOb: row.metar });
      }
    }
  }
  const endedAt = new Date().toISOString();
  sample = { startedAtUtc: startedAt, endedAtUtc: endedAt, api, metar: { source: metarSource, url: metarUrl, fetchedAt: m.at, reports } };
}

function pickPayload(b) {
  if (!b || typeof b !== 'object') return null;
  const lh = b.meta?.localHour;
  return {
    location: b.location,
    now: {
      tempC: b.now?.tempC, windKph: b.now?.windKph, rainChance: b.now?.rainChance, cloudPct: b.now?.cloudPct,
      conditionKey: b.now?.conditionKey, conditionLabel: b.now?.conditionLabel, conditionReason: b.now?.conditionReason,
      isDay: b.now?.isDay, gustKph: b.gustKph ?? null, maxWindKph: b.maxWindKph ?? null,
      numeric: b.now?.conditionSignals?.numeric ?? null,
    },
    daily0: b.daily?.[0] ? { highC: b.daily[0].highC, lowC: b.daily[0].lowC, rainChance: b.daily[0].rainChance, conditionKey: b.daily[0].conditionKey, conditionLabel: b.daily[0].conditionLabel } : null,
    hourNow: isNum(lh) ? b.hourly?.[lh] ?? null : null,
    meta: {
      sources: b.meta?.sources, sourceRanges: b.meta?.sourceRanges, sourceWeights: b.meta?.sourceWeights,
      sourceConditions: b.meta?.sourceConditions, localHour: lh, utcOffsetSeconds: b.meta?.utcOffsetSeconds,
      serverCache: b.meta?.serverCache, updatedAtLabel: b.meta?.updatedAtLabel, confidence: b.meta?.confidence, schema: b.meta?.schema,
    },
  };
}

// ---- per airport ----
const startMs = Date.parse(sample.startedAtUtc);
const today = sastIso(startMs).slice(0, 10);
const rows = [];
for (const icao of Object.keys(CITIES)) {
  const a = sample.api[icao];
  const p = a?.payload;
  const reps = sample.metar.reports
    .filter((r) => r.icao === icao && r.obsTimeUtc)
    .map((r) => {
      const t = parseMetarText(r.rawOb);
      const wxStr = r.wxString ?? t.wxFromText;
      const o = {
        utc: r.obsTimeUtc, sast: sastIso(Date.parse(r.obsTimeUtc)), raw: r.rawOb,
        tempC: isNum(r.temp) ? r.temp : t.tempC,
        windKph: isNum(r.wspd) ? Math.round(r.wspd * KT_TO_KPH * 10) / 10 : (isNum(t.windKt) ? Math.round(t.windKt * KT_TO_KPH * 10) / 10 : null),
        gustKph: isNum(r.wgst) ? Math.round(r.wgst * KT_TO_KPH * 10) / 10 : (isNum(t.gustKt) ? Math.round(t.gustKt * KT_TO_KPH * 10) / 10 : null),
        wxString: wxStr || '', wx: classifyPresentWeather(wxStr || ''), wxNotObserved: t.wxNotObserved,
        cloudOkta: t.cloudOkta,
      };
      o.category = observedCategory(o);
      o.windy = (isNum(o.windKph) && o.windKph >= OBS_WINDY.sustainedKph) || (isNum(o.gustKph) && o.gustKph >= OBS_WINDY.gustKph);
      return o;
    })
    .sort((x, y) => x.utc.localeCompare(y.utc));
  const todays = reps.filter((r) => r.sast.slice(0, 10) === today && isNum(r.tempC));
  const obsMax = todays.length ? Math.max(...todays.map((r) => r.tempC)) : null;
  const obsMin = todays.length ? Math.min(...todays.map((r) => r.tempC)) : null;
  const latestAny = reps.length ? reps[reps.length - 1] : null;
  const latestAgeMin = latestAny ? Math.round((Date.parse(a?.at ?? sample.startedAtUtc) - Date.parse(latestAny.utc)) / 60000) : null;
  // Only a recent report is compared with "now"; an older one is shown but not scored.
  const latest = latestAny && latestAgeMin <= STALE_MIN ? latestAny : null;
  const ranges = {}; for (const s of p?.meta?.sourceRanges || []) ranges[s.name] = s;
  const votes = {}; for (const v of p?.meta?.sourceConditions || []) votes[v.source] = v;
  const blendHigh = p?.daily0?.highC ?? null, blendLow = p?.daily0?.lowC ?? null;
  const perSource = SLOTS.map((name) => {
    const rg = ranges[name] || null, v = votes[name] || null;
    return {
      name, live: !!rg,
      minTemp: rg?.minTemp ?? null, maxTemp: rg?.maxTemp ?? null,
      maxErr: isNum(rg?.maxTemp) && isNum(obsMax) ? Math.round((rg.maxTemp - obsMax) * 10) / 10 : null,
      minErr: isNum(rg?.minTemp) && isNum(obsMin) ? Math.round((rg.minTemp - obsMin) * 10) / 10 : null,
      desc: v?.desc ?? null, vote: v?.vote ?? null,
      voteMatchesObserved: v && latest && latest.category !== 'unobserved' ? v.vote === latest.category : null,
    };
  });
  const blendKey = p?.now?.conditionKey ?? null;
  // The server key in the same vocabulary: rain-possible counts as rain-ish only when it rained.
  const keyBucket = { rain: 'rain', storm: 'storm', thunder: 'storm', hail: 'storm', fog: 'fog', cloudy: 'cloudy', clear: 'clear', 'partly-cloudy': 'clear', uv: 'clear', 'rain-possible': 'rain-possible', wind: 'wind' }[blendKey] ?? blendKey;
  let blendMatches = null;
  if (latest && latest.category !== 'unobserved' && blendKey) {
    if (keyBucket === 'wind') blendMatches = latest.windy;
    else if (keyBucket === 'rain-possible') blendMatches = latest.category === 'rain' ? true : (latest.category === 'clear' || latest.category === 'cloudy' ? null : false);
    else blendMatches = keyBucket === latest.category;
  }
  rows.push({
    icao, name: CITIES[icao].name, apiOk: !!a?.ok, apiAt: a?.at ?? null, apiError: a?.error ?? null,
    serverCache: p?.meta?.serverCache ?? null, computedAt: p?.meta?.updatedAtLabel ?? null, localHour: p?.meta?.localHour ?? null,
    sourcesLive: (p?.meta?.sources || []).filter((s) => s.ok).map((s) => s.name), sourcesFailed: (p?.meta?.sources || []).filter((s) => !s.ok).map((s) => s.name),
    sourceWeights: p?.meta?.sourceWeights ?? null,
    perSource, blendHigh, blendLow,
    blendHighErr: isNum(blendHigh) && isNum(obsMax) ? Math.round((blendHigh - obsMax) * 10) / 10 : null,
    blendLowErr: isNum(blendLow) && isNum(obsMin) ? Math.round((blendLow - obsMin) * 10) / 10 : null,
    blendNow: { key: blendKey, label: p?.now?.conditionLabel ?? null, reason: p?.now?.conditionReason ?? null, tempC: p?.now?.tempC ?? null, windKph: p?.now?.windKph ?? null, gustKph: p?.now?.numeric?.gustKph ?? null, rainChance: p?.now?.rainChance ?? null },
    blendMatchesObserved: blendMatches,
    obs: {
      reportsToday: todays.length, firstSast: todays[0]?.sast ?? null, lastSast: todays[todays.length - 1]?.sast ?? null, max: obsMax, min: obsMin,
      latest: latestAny ? { sast: latestAny.sast, utc: latestAny.utc, ageMin: latestAgeMin, stale: !latest, tempC: latestAny.tempC, windKph: latestAny.windKph, gustKph: latestAny.gustKph, wx: latestAny.wxString, wxNotObserved: latestAny.wxNotObserved, cloudOkta: latestAny.cloudOkta, category: latestAny.category, windy: latestAny.windy, raw: latestAny.raw } : null,
      precipReportedToday: todays.some((r) => r.wx.precip), unobservedWxReportsToday: todays.filter((r) => r.wxNotObserved).length,
    },
  });
}

// ---- write ----
const outDir = path.join(ACCURACY_ROOT, 'results');
mkdirSync(outDir, { recursive: true });
const base = path.join(outDir, `live-sample-${today}`);
writeFileSync(`${base}.json`, JSON.stringify({ ...sample, sastDate: today, summary: rows }, null, 1));

const md = [];
md.push(`# Live sample — ${today}`, '');
md.push(`Production API read at **${sample.startedAtUtc}** → ${sample.endedAtUtc} (UTC); ${sastIso(startMs).replace('T', ' ')} SAST. METAR: ${sample.metar.source}, fetched ${sample.metar.fetchedAt}.`, '');
md.push('**One moment at six airports is an anecdote, not a score.** It shows what the Sources page and the blend said at that moment next to what the airport reported; the backtest in `blend-vs-sources.md` is the measurement.', '');

// Headline — facts read off the tables below, nothing more.
{
  const withObs = rows.filter((r) => isNum(r.blendHighErr));
  const hi = withObs.map((r) => `${r.name} ${signed(r.blendHighErr)}`).join(', ');
  const within2 = withObs.filter((r) => Math.abs(r.blendHighErr) <= 2).length;
  const beatBlendHigh = withObs.map((r) => ({ r, better: r.perSource.filter((s) => isNum(s.maxErr) && Math.abs(s.maxErr) < Math.abs(r.blendHighErr)).map((s) => SHORT[s.name]) }));
  const tiErrs = rows.map((r) => r.perSource.find((s) => s.name === 'Tomorrow.io')?.maxErr).filter(isNum);
  const radar = rows.filter((r) => r.blendNow.reason === 'tomorrow-io-radar-override');
  const scored = rows.filter((r) => r.obs.latest && !r.obs.latest.stale && r.obs.latest.category !== 'unobserved');
  md.push('## What this one sample shows', '');
  const lhH = rows.find((r) => isNum(r.localHour))?.localHour;
  md.push(`- Blend high minus the observed max so far: ${hi}. Within 2 °C at ${within2} of ${withObs.length}. A single source's own max was closer than the blend's at ${beatBlendHigh.filter((x) => x.better.length).length} of ${withObs.length} (${beatBlendHigh.filter((x) => x.better.length).map((x) => `${x.r.name}: ${x.better.join(', ')}`).join('; ')}).`);
  if (isNum(lhH) && tiErrs.length) md.push(`- At local hour ${lhH}:00 Tomorrow.io's "today" is ${24 - lhH} hour(s) long, so its "high" is the late-evening temperature: ${fmt(Math.min(...tiErrs))} to ${fmt(Math.max(...tiErrs))} °C against the observed max, and it still carries its full weight in the blended high (MET's strict high is null after about 12:00, so it carries none).`);
  if (radar.length) md.push(`- The Tomorrow.io radar override set the server key to rain at ${radar.map((r) => `${r.name} (latest report ${r.obs.latest?.sast?.slice(11) ?? '—'}: ${r.obs.latest?.wx || 'no present weather'}, ${r.obs.latest?.category ?? '—'})`).join('; ')} — the one route to rain the backtest cannot replay.`);
  const agree = SLOTS.map((n) => { const v = scored.map((r) => r.perSource.find((s) => s.name === n)?.voteMatchesObserved).filter((x) => x != null); return `${SHORT[n]} ${v.filter(Boolean).length}/${v.length}`; });
  const blendAgree = scored.map((r) => r.blendMatchesObserved).filter((x) => x != null);
  md.push(`- Current votes matching the airport's latest report (${scored.length} airports with a recent, observed report): ${agree.join(' · ')} · blend ${blendAgree.filter(Boolean).length}/${blendAgree.length}.`, '');
}

md.push('## What the numbers cover', '');
md.push('`meta.sourceRanges` (api/weather.js:2639–2643) is not one window:', '');
md.push('| source | min / max shipped | window |', '|---|---|---|');
md.push('| Open-Meteo | `daily.temperature_2m_min/max[0]` | the whole local calendar day (:1183–1184) |');
md.push('| WeatherAPI | `forecastday[0].day.mintemp_c/maxtemp_c` | the whole local calendar day (:1316–1317) |');
md.push('| Pirate Weather | `temperatureMin` / `temperatureHigh` | low: calendar day; high: Pirate\'s daytime high, 06:00–18:00 (:1445, :1456–1457) |');
md.push('| MET Norway | `displayLow` / `displayHigh` | now → midnight while ≥ 12 of today\'s hours remain (to about 12:00); after that the next 24 h of MET\'s series, mostly tomorrow (:1614–1637) |');
md.push('| Tomorrow.io | `todayLow` / `todayHigh` | now → midnight, however few hours are left (:1774–1778) |');
md.push('', 'The blend (`daily[0].highC` / `lowC`, :2068–2069) takes MET\'s high only while its strict window holds (null after about 12:00, :1646), Tomorrow.io\'s rest-of-day high always, and gives MET and Tomorrow.io no weight in the low (:1974).', '');
const lh = rows.find((r) => isNum(r.localHour))?.localHour;
if (isNum(lh)) md.push(`At this sample the API\'s local hour was **${lh}:00**, so Tomorrow.io\'s "today" was ${24 - lh} hour(s) long and MET\'s range ${24 - lh >= 12 ? 'was still today\'s' : 'was its next 24 hours (mostly tomorrow)'}.`, '');

md.push('## Temperatures (°C): each source\'s range, the blend, and the airport so far today', '');
md.push('| airport | OM min/max | WA min/max | PW min/max | MET min/max | TI min/max | blend low/high | observed min/max so far (reports, SAST) | blend high − obs max | blend low − obs min |');
md.push('|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) {
  const cell = (n) => { const s = r.perSource.find((x) => x.name === n); return s?.live ? `${fmt(s.minTemp)} / ${fmt(s.maxTemp)}` : 'n/a'; };
  md.push(`| ${r.name} (${r.icao}) | ${cell('Open-Meteo')} | ${cell('WeatherAPI')} | ${cell('Pirate Weather')} | ${cell('MET Norway')} | ${cell('Tomorrow.io')} | ${fmt(r.blendLow)} / ${fmt(r.blendHigh)} | ${fmt(r.obs.min, 0)} / ${fmt(r.obs.max, 0)} (${r.obs.reportsToday}, ${r.obs.firstSast?.slice(11) ?? '—'}–${r.obs.lastSast?.slice(11) ?? '—'}) | ${signed(r.blendHighErr)} | ${signed(r.blendLowErr)} |`);
}
md.push('', 'Error of each source\'s own max against the observed max so far (°C):', '');
md.push('| airport | OM | WA | PW | MET | TI | blend | closest to the observed max |', '|---|---|---|---|---|---|---|---|');
for (const r of rows) {
  const errs = r.perSource.filter((s) => isNum(s.maxErr)).map((s) => ({ n: SHORT[s.name], e: s.maxErr }));
  if (isNum(r.blendHighErr)) errs.push({ n: 'blend', e: r.blendHighErr });
  const best = errs.length ? Math.min(...errs.map((x) => Math.abs(x.e))) : null;
  md.push(`| ${r.name} | ${SLOTS.map((n) => signed(r.perSource.find((s) => s.name === n)?.maxErr)).join(' | ')} | ${signed(r.blendHighErr)} | ${errs.filter((x) => Math.abs(x.e) === best).map((x) => x.n).join(', ') || '—'} |`);
}

md.push('', '## Right now: the airport\'s latest report against each source\'s current vote and the blend', '');
md.push('Observed category = the report in the vote vocabulary of `categorizeDesc` (api/weather.js:3530): thunder → storm, precipitation → rain, fog/mist/haze → fog, BKN/OVC → cloudy, FEW/SCT/clear → clear. "unobserved" = an AUTO report with no present-weather sensor (`//`). ✓ = the vote matches.', '');
md.push(`A latest report more than ${STALE_MIN} min older than the API read is shown but not marked (stale).`, '');
md.push('| airport | latest report (SAST, age) | observed | OM | WA | PW | MET | TI | blend (server `now.conditionKey`) |', '|---|---|---|---|---|---|---|---|---|');
for (const r of rows) {
  const o = r.obs.latest;
  const obsTxt = o ? `${o.wx || (o.wxNotObserved ? '`//`' : 'no wx')}, ${isNum(o.cloudOkta) ? o.cloudOkta + '/8' : 'cloud n/a'}, ${fmt(o.windKph, 0)}${isNum(o.gustKph) ? ' G' + fmt(o.gustKph, 0) : ''} km/h, ${fmt(o.tempC, 0)}°C → **${o.category}**${o.windy ? ' (windy)' : ''}${o.stale ? ' — stale' : ''}` : 'no report';
  const vcell = (n) => { const s = r.perSource.find((x) => x.name === n); if (!s?.desc) return 'n/a'; return `${s.desc} → ${s.vote}${s.voteMatchesObserved === true ? ' ✓' : s.voteMatchesObserved === false ? ' ✗' : ''}`; };
  md.push(`| ${r.name} | ${o ? `${o.sast.slice(11)} (${o.ageMin} min)` : '—'} | ${obsTxt} | ${vcell('Open-Meteo')} | ${vcell('WeatherAPI')} | ${vcell('Pirate Weather')} | ${vcell('MET Norway')} | ${vcell('Tomorrow.io')} | ${r.blendNow.key ?? 'n/a'} (${r.blendNow.reason ?? ''})${r.blendMatchesObserved === true ? ' ✓' : r.blendMatchesObserved === false ? ' ✗' : ''} |`);
}
md.push('', '## Sample provenance', '');
md.push('| airport | API read at (UTC) | server cache | payload computed at | sources live | failed |', '|---|---|---|---|---|---|');
for (const r of rows) md.push(`| ${r.name} | ${r.apiAt ?? '—'}${r.apiOk ? '' : ' **FAILED: ' + r.apiError + '**'} | ${r.serverCache ?? '—'} | ${r.computedAt ?? '—'} | ${r.sourcesLive.map((n) => SHORT[n] ?? n).join(', ') || '—'} | ${r.sourcesFailed.map((n) => SHORT[n] ?? n).join(', ') || '—'} |`);
md.push('', `Raw latest METARs: ${rows.map((r) => r.obs.latest ? '`' + r.obs.latest.raw + '`' : '').filter(Boolean).join(' · ')}`, '');
writeFileSync(`${base}.md`, md.join('\n') + '\n');
process.stderr.write(`wrote ${path.relative(ACCURACY_ROOT, base)}.md${FROM ? '' : ' and .json'}\n`);
