// Fable's plan review, change 8: the temperature-freeze fixture must also walk the branches temperatures and wind
// share today — the WeatherAPI de-duplication (OM and WA today-highs within 0.5 °C), the MET Norway boost (MET's high
// > 5 °C above the OM/WA average, outside the Highveld), a source missing, and a place outside South Africa.
//   node review/accuracy/v6/make-temp-fixture-variants.mjs   (after make-temp-fixture.mjs; appends to the fixture once)
// The first three are the recorded cases with one provider's answer altered as named; London's Open-Meteo and MET
// Norway are recorded verbatim, its keyed sources built from Open-Meteo's own numbers (no recorder reading there).
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const FILE = path.resolve('tests/fixtures/temp-freeze.json');
const fx = JSON.parse(readFileSync(FILE, 'utf8'));
if (fx.cases.some((c) => c.variant)) throw new Error('variants already appended');
const UA = 'probably-weather test fixture (one-off recording; howzit@probablyweather.co.za)';
const clone = (x) => structuredClone(x);
const r1 = (x) => Math.round(x * 10) / 10;
const byPlace = (p) => fx.cases.find((c) => c.place === p);

// (a) WeatherAPI de-duplication: WA's today-high 0.3 °C from Open-Meteo's
const a = clone(byPlace('Cape Town city'));
a.variant = 'wa-dedup'; a.responses.weatherApi.forecast.forecastday[0].day.maxtemp_c = r1(a.responses.openMeteo.daily.temperature_2m_max[0] + 0.3);
// (b) MET Norway boost: every MET temperature 8 °C warmer (Durban is outside the Highveld gate). MET's today-high only
// counts with ≥ 12 hours of today in its series, so the clock is 06:20 SAST and MET's series is moved 8 hours earlier.
const b = clone(byPlace('Durban airport'));
b.variant = 'met-boost'; b.nowUtc = `${b.nowUtc.slice(0, 10)}T04:20:00.000Z`;
for (const t of b.responses.met.properties.timeseries) { t.time = new Date(Date.parse(t.time) - 8 * 3600e3).toISOString().replace('.000Z', 'Z'); t.data.instant.details.air_temperature = r1(t.data.instant.details.air_temperature + 8); }
// (c) a source missing: Tomorrow.io down (null → HTTP 503 in the test)
const c = clone(byPlace('Strand'));
c.variant = 'tomorrow-down'; c.responses.tomorrow = null;

// (d) outside South Africa: London
const lat = 51.5074, lon = -0.1278;
const get = async (u) => { const r = await fetch(u, { headers: { 'User-Agent': UA } }); if (!r.ok) throw new Error(`${r.status} ${u}`); return r.json(); };
const om = await get(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
  '&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,relative_humidity_2m,cloud_cover' +
  '&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,wind_speed_10m,wind_gusts_10m,wind_direction_10m,cloud_cover,relative_humidity_2m,uv_index,weather_code,visibility,dew_point_2m' +
  '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,weather_code,wind_speed_10m_max,sunrise,sunset&timezone=auto&forecast_days=7');
const met = await get(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`);
const off = om.utc_offset_seconds;
const cur = om.current, nowUtc = byPlace('Strand').nowUtc;
const hourAt = (i) => ({ temp_c: r1(om.hourly.temperature_2m[i] + 0.8), feelslike_c: r1(om.hourly.apparent_temperature[i] + 0.8), condition: { code: 1003, text: 'x' }, chance_of_rain: 20, precip_mm: 0.1, wind_kph: r1(om.hourly.wind_speed_10m[i] * 1.3), cloud: 60, humidity: 70, uv: 1 });
const day0 = Date.parse(`${om.daily.time[0]}T00:00:00Z`) / 1000 - off;
const d = {
  place: 'London', lat, lon, nowUtc, variant: 'outside-sa',
  responses: {
    openMeteo: om, precision: null, met,
    weatherApi: { location: { tz_id: 'Europe/London' }, current: { temp_c: r1(cur.temperature_2m + 0.8), feelslike_c: r1(cur.apparent_temperature + 0.8), condition: { code: 1003, text: 'x' }, wind_kph: r1(cur.wind_speed_10m * 1.3), gust_kph: r1(cur.wind_gusts_10m * 1.1), humidity: 70, cloud: 60, uv: 1, precip_mm: 0.1, vis_km: 10 },
      forecast: { forecastday: Array.from({ length: 7 }, (_, k) => ({ day: { maxtemp_c: r1(om.daily.temperature_2m_max[k] + 1.1), mintemp_c: r1(om.daily.temperature_2m_min[k] - 0.4), daily_chance_of_rain: 40, totalprecip_mm: 1, uv: 2, maxwind_kph: r1(om.daily.wind_speed_10m_max[k] * 1.3), condition: { code: 1063, text: 'x' } }, astro: { sunrise: '07:00 AM', sunset: '06:50 PM' }, hour: k < 2 ? Array.from({ length: 24 }, (_, h) => hourAt(k * 24 + h)) : [] })) } },
    pirate: { offset: off / 3600, currently: { temperature: r1(cur.temperature_2m - 0.5), windSpeed: r1(cur.wind_speed_10m * 0.9 / 3.6), windGust: r1(cur.wind_gusts_10m / 3.6), humidity: 0.7, icon: 'cloudy', cloudCover: 0.8, visibility: 12 },
      daily: { data: Array.from({ length: 7 }, (_, k) => ({ temperatureHigh: r1(om.daily.temperature_2m_max[k] - 0.7), temperatureMin: r1(om.daily.temperature_2m_min[k] + 0.3), temperatureLow: r1(om.daily.temperature_2m_min[k]), precipProbability: 0.3, uvIndex: 2, icon: 'cloudy', windSpeed: r1(om.daily.wind_speed_10m_max[k] / 3.6), cloudCover: 0.8, sunriseTime: day0 + k * 86400 + 7 * 3600, sunsetTime: day0 + k * 86400 + 18 * 3600 + 3000 })) } },
    tomorrow: { data: { timelines: [{ intervals: Array.from({ length: 49 }, (_, i) => {
      const t = Math.floor(Date.parse(nowUtc) / 3600e3) * 3600e3 + i * 3600e3, idx = Math.round((t - (day0 * 1000)) / 3600e3);
      return { startTime: new Date(t).toISOString(), values: { temperature: r1((om.hourly.temperature_2m[idx] ?? cur.temperature_2m) - 0.3), precipitationIntensity: 0, precipitationProbability: 10, weatherCode: 1001, windSpeed: r1((om.hourly.wind_speed_10m[idx] ?? cur.wind_speed_10m) * 1.1 / 3.6), humidity: 72, cloudCover: 85, visibility: 14 } };
    }) }] } },
  },
};
fx.cases.push(a, b, c, d);
writeFileSync(FILE, JSON.stringify(fx));
console.log(`appended 4 variant cases → ${fx.cases.length} cases`);
