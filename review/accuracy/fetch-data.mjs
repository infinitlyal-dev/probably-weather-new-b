// Re-download the harness inputs. Both sources are free and keyless.
//   node review/accuracy/fetch-data.mjs [--from 2026-06-24 --to 2026-09-22]
// Observations: Iowa Environmental Mesonet ASOS/METAR archive (routine + special reports, UTC).
// Forecasts:    Open-Meteo historical-forecast API — best_match (= production's Open-Meteo)
//               and four stand-in models (see lib/sources.mjs).

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const from = argOf('--from', '2026-06-24');
const to = argOf('--to', '2026-09-22');
const tag = `${from.replace(/-/g, '')}-${to.replace(/-/g, '')}`;

const CITIES = {
  FACT: [-33.9648, 18.6017], FAOR: [-26.1392, 28.2460], FALE: [-29.6144, 31.1197],
  FAPE: [-33.9849, 25.6173], FABL: [-29.0927, 26.3024], FAGG: [-34.0056, 22.3789],
};
const HOURLY_BM = 'temperature_2m,apparent_temperature,precipitation_probability,precipitation,wind_speed_10m,wind_gusts_10m,wind_direction_10m,cloud_cover,relative_humidity_2m,uv_index,weather_code,visibility,dew_point_2m';
const DAILY_BM = 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,weather_code,wind_speed_10m_max,sunrise,sunset';
const HOURLY_MODELS = 'temperature_2m,apparent_temperature,precipitation_probability,precipitation,wind_speed_10m,wind_gusts_10m,cloud_cover,relative_humidity_2m,weather_code';
const MODELS = 'gfs_seamless,ecmwf_ifs025,ukmo_seamless,icon_seamless';

const [fy, fm, fd] = from.split('-'), [ty, tm, td] = to.split('-');
mkdirSync(path.join(here, 'obs'), { recursive: true });
mkdirSync(path.join(here, 'forecast', 'om'), { recursive: true });
mkdirSync(path.join(here, 'forecast', 'om-models'), { recursive: true });

for (const [icao, [lat, lon]] of Object.entries(CITIES)) {
  const metar = `https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?station=${icao}&data=all&year1=${fy}&month1=${+fm}&day1=${+fd}&year2=${ty}&month2=${+tm}&day2=${+td + 1}&tz=Etc/UTC&format=onlycomma&latlon=no&elev=no&missing=M&trace=T&direct=no&report_type=3&report_type=4`;
  const bm = `https://historical-forecast-api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=${HOURLY_BM}&daily=${DAILY_BM}&start_date=${from}&end_date=${to}&timezone=Africa/Johannesburg`;
  const models = `https://historical-forecast-api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=${HOURLY_MODELS}&daily=temperature_2m_max,temperature_2m_min&start_date=${from}&end_date=${to}&timezone=Africa/Johannesburg&models=${MODELS}`;
  for (const [url, file] of [[metar, path.join('obs', `metar-${icao}-${tag}.csv`)], [bm, path.join('forecast', 'om', `om-${icao}-${tag}.json`)], [models, path.join('forecast', 'om-models', `models-${icao}-${tag}.json`)]]) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${file}: HTTP ${r.status}`);
    writeFileSync(path.join(here, file), await r.text());
    process.stderr.write(`${file}\n`);
  }
}
