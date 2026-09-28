// TEMPERATURES MUST NOT MOVE (review/accuracy/v6/PLAN.md §3) — records the fixture once, before any wind change.
//   node review/accuracy/v6/make-temp-fixture.mjs      → tests/fixtures/temp-freeze.json
//
// Four places at one moment plus Strand at night. Open-Meteo (the main request and the precision request) and MET
// Norway are recorded verbatim from their free endpoints, once. WeatherAPI, Pirate Weather and Tomorrow.io have no keys
// on this machine, so their responses are built in each provider's own shape from the live recorder's latest reading of
// that source at that place (meta.sourceNow / meta.sourceToday): its own now temperature, wind, gust, humidity, cloud,
// today's high and low; hours follow Open-Meteo's curve shifted to that source's own now value. The golden numbers are
// then computed by playing the recorded responses through api/weather.js's handler with the clock frozen — the code as
// it stood before the v6 wind change.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const LIVE = 'C:/Users/27741/OneDrive/Desktop/Probably weather new/probably-weather-new-c/review/accuracy/live';
const OUT = path.resolve('tests/fixtures/temp-freeze.json');
const UA = 'probably-weather test fixture (one-off recording; howzit@probablyweather.co.za)';
const PLACES = [
  { name: 'Strand', lat: -34.1163, lon: 18.8362, rec: 'Strand' },
  { name: 'Cape Town city', lat: -33.9249, lon: 18.4241, rec: 'Cape Town city' },
  { name: 'Johannesburg airport', lat: -26.1392, lon: 28.246, rec: 'FAOR' },
  { name: 'Durban airport', lat: -29.6144, lon: 31.1197, rec: 'FALE' },
];
const NOW = new Date(Math.floor(Date.now() / 3600e3) * 3600e3 + 20 * 60e3);   // this hour, :20 UTC
const NIGHT = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth(), NOW.getUTCDate(), 20, 20));   // 22:20 SAST, same day

// the recorder's latest reading of each place
const lines = readdirSync(LIVE).filter((f) => f.endsWith('.jsonl')).sort().slice(-1).flatMap((f) => readFileSync(path.join(LIVE, f), 'utf8').trim().split('\n').map((l) => JSON.parse(l)));
const latest = (rec) => lines.filter((x) => (x.icao || x.spot) === rec && x.api?.payload?.meta?.sourceNow).pop();

const r1 = (x) => Math.round(x * 10) / 10;
const clampNum = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
async function getJson(url, headers = {}) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, ...headers } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

// ---------- build the keyed sources from the recorder ----------
function waFrom(om, src, today) {
  const dT = src.tempC - om.current.temperature_2m, k = om.current.wind_speed_10m > 0.5 ? clampNum(src.windKph / om.current.wind_speed_10m, 0.3, 4) : 1;
  const hour = (i) => ({
    temp_c: r1(om.hourly.temperature_2m[i] + dT), feelslike_c: r1(om.hourly.apparent_temperature[i] + dT), condition: { code: 1003, text: 'Partly cloudy' },
    chance_of_rain: 0, precip_mm: 0, wind_kph: r1(om.hourly.wind_speed_10m[i] * k), cloud: src.cloudPct ?? 30, humidity: src.humidity, uv: om.hourly.uv_index[i] ?? 0,
  });
  return {
    location: { tz_id: 'Africa/Johannesburg' },
    current: { temp_c: src.tempC, feelslike_c: r1(src.tempC - 1), condition: { code: 1003, text: 'Partly cloudy' }, wind_kph: src.windKph, gust_kph: src.gustKph, humidity: src.humidity, cloud: src.cloudPct ?? 30, uv: 4, precip_mm: 0, vis_km: 10 },
    forecast: { forecastday: Array.from({ length: 7 }, (_, d) => ({
      day: { maxtemp_c: r1(om.daily.temperature_2m_max[d] + (today.highC - om.daily.temperature_2m_max[0])), mintemp_c: r1(om.daily.temperature_2m_min[d] + (today.lowC - om.daily.temperature_2m_min[0])), daily_chance_of_rain: 10 * d, totalprecip_mm: d > 3 ? 1.2 : 0, uv: 6, maxwind_kph: r1(om.daily.wind_speed_10m_max[d] * k), condition: { code: d > 3 ? 1063 : 1003, text: 'x' } },
      astro: { sunrise: '06:05 AM', sunset: '06:25 PM' },
      hour: d < 2 ? Array.from({ length: 24 }, (_, h) => hour(d * 24 + h)) : [],
    })) },
  };
}
function pirateFrom(om, src, today) {
  const dT = src.tempC - om.current.temperature_2m, ms = (kph) => r1(kph / 3.6 * 10) / 10;
  const day0 = Date.parse(`${om.daily.time[0]}T00:00:00+02:00`) / 1000;
  return {
    offset: 2,
    currently: { temperature: src.tempC, windSpeed: ms(src.windKph), windGust: ms(src.gustKph ?? src.windKph * 1.4), humidity: src.humidity / 100, icon: 'partly-cloudy-day', cloudCover: (src.cloudPct ?? 30) / 100, visibility: 16 },
    daily: { data: Array.from({ length: 7 }, (_, d) => ({
      temperatureHigh: r1(om.daily.temperature_2m_max[d] + (today.highC - om.daily.temperature_2m_max[0])), temperatureMin: r1(om.daily.temperature_2m_min[d] + (today.lowC - om.daily.temperature_2m_min[0])), temperatureLow: r1(om.daily.temperature_2m_min[d] + dT),
      precipProbability: 0.05 * d, uvIndex: 6, icon: 'partly-cloudy-day', windSpeed: ms(om.daily.wind_speed_10m_max[d]), cloudCover: 0.3,
      sunriseTime: day0 + d * 86400 + 6 * 3600 + 300, sunsetTime: day0 + d * 86400 + 18 * 3600 + 1500,
    })) },
  };
}
function tomorrowFrom(om, src, at) {
  const dT = src.tempC - om.current.temperature_2m, k = om.current.wind_speed_10m > 0.5 ? clampNum(src.windKph / om.current.wind_speed_10m, 0.3, 4) : 1;
  const start = Math.floor(at.getTime() / 3600e3) * 3600e3, day0 = Date.parse(`${om.daily.time[0]}T00:00:00+02:00`);
  return { data: { timelines: [{ intervals: Array.from({ length: 49 }, (_, i) => {
    const t = start + i * 3600e3, idx = Math.round((t - day0) / 3600e3);
    const T = om.hourly.temperature_2m[idx] ?? om.hourly.temperature_2m[om.hourly.temperature_2m.length - 1];
    const W = om.hourly.wind_speed_10m[idx] ?? om.current.wind_speed_10m;
    return { startTime: new Date(t).toISOString(), values: { temperature: r1(T + dT), precipitationIntensity: 0, precipitationProbability: 0, weatherCode: 1101, windSpeed: r1(W * k / 3.6), humidity: src.humidity, cloudCover: src.cloudPct ?? 30, visibility: 16 } };
  }) }] } };
}

// ---------- record ----------
const { precisionUrl } = await import('../../../api/_lib/precision.js');
const cases = [];
for (const p of PLACES) {
  const rec = latest(p.rec);
  if (!rec) throw new Error(`no recorder reading with sourceNow for ${p.rec}`);
  const sn = Object.fromEntries(rec.api.payload.meta.sourceNow.map((s) => [s.name, s]));
  const st = Object.fromEntries(rec.api.payload.meta.sourceToday.map((s) => [s.name, s]));
  const omUrl = `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}` +
    '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,relative_humidity_2m,cloud_cover' +
    '&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,wind_speed_10m,wind_gusts_10m,wind_direction_10m,cloud_cover,relative_humidity_2m,uv_index,weather_code,visibility,dew_point_2m' +
    '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,weather_code,wind_speed_10m_max,sunrise,sunset&timezone=auto&forecast_days=7';
  const om = await getJson(omUrl);
  const precision = await getJson(precisionUrl('https://api.open-meteo.com/v1/forecast', p.lat, p.lon, ''));
  const met = await getJson(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${p.lat}&lon=${p.lon}`);
  for (const at of p.name === 'Strand' ? [NOW, NIGHT] : [NOW]) {
    cases.push({
      place: p.name, lat: p.lat, lon: p.lon, nowUtc: at.toISOString(), recorderReading: rec.runAtUtc,
      responses: {
        openMeteo: om, precision, met,
        weatherApi: waFrom(om, sn.WeatherAPI, st.WeatherAPI),
        pirate: pirateFrom(om, sn['Pirate Weather'], st['Pirate Weather']),
        tomorrow: tomorrowFrom(om, sn['Tomorrow.io'], at),
      },
    });
  }
  await new Promise((r) => setTimeout(r, 1500));
}
mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ recordedAtUtc: new Date().toISOString(), note: 'review/accuracy/v6/make-temp-fixture.mjs — see its header', cases }));
console.log(`${cases.length} cases → ${OUT} (${Math.round(readFileSync(OUT).length / 1024)} KB)`);
