// /api/weather.js
// Probably Weather – server-side weather aggregator
// Sources: Open-Meteo (ECMWF, no key), WeatherAPI (proprietary, key),
//          Pirate Weather (NOAA GFS/GEFS, key), MET Norway (no key, User-Agent)
// Base weights: 40% OM | 25% WA | 10% PW | 25% MET — dynamically adjusted at runtime
// MET Norway uses high-resolution NWP with good coastal coverage — important for SA wind.
// Pirate Weather (GFS/GEFS) is a genuinely independent model cross-check.
// NOTE: Pirate Weather is excluded from hourly aggregation — its hourly.data starts
// at the current hour (not midnight), making alignment with other sources impossible.

export default async function handler(req, res) {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    const rawName = typeof req.query.name === 'string' ? req.query.name.trim() : '';
    const isPlaceholder =
      !rawName ||
      /^unknown\b/i.test(rawName) ||
      /^unknown location\b/i.test(rawName);
    const name = rawName || null;

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ ok: false, error: 'Invalid lat/lon' });
    }

    const WEATHERAPI_KEY     = process.env.WEATHERAPI_KEY     || null;
    const PIRATE_WEATHER_KEY = process.env.PIRATE_WEATHER_KEY || null;
    const NOMINATIM_UA       = process.env.MET_USER_AGENT     || 'ProbablyWeather/1.0 (contact: howzit@probablyweather.co.za)';

    const timeoutMs = 9000;

    async function fetchJson(url, options = {}) {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const r = await fetch(url, { ...options, signal: controller.signal });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return await r.json();
      } finally {
        clearTimeout(t);
      }
    }

    // Reverse geocode endpoint — cascading zoom for small-town accuracy
    if (req.query.reverse) {
      try {
        // zoom=16 catches hamlets/suburbs; zoom=10 is city-level fallback
        const rev = await fetchJson(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=16&addressdetails=1`,
          { headers: { 'User-Agent': NOMINATIM_UA } }
        );
        const addr = rev?.address || {};
        // Priority: village/town/suburb BEFORE city — so "Wilderness" beats "George"
        const place = addr.village || addr.town || addr.suburb || addr.city || addr.neighbourhood || addr.municipality || null;
        const city = addr.city || addr.town || addr.municipality || null;
        const admin1 = addr.state || addr.province || addr.region || addr.county || null;
        const countryCode = addr.country_code ? String(addr.country_code).toUpperCase() : null;
        return res.status(200).json({ ok: true, city: place, admin1, countryCode, nearCity: place !== city ? city : null });
      } catch {
        return res.status(200).json({ ok: false, city: null, admin1: null, countryCode: null, nearCity: null });
      }
    }

    // Resolve location name — cascading strategy for small-town accuracy
    // Priority: village/town/suburb BEFORE city so Wilderness beats George
    let resolvedName = isPlaceholder ? null : name;
    if (!resolvedName) {
      try {
        const rev = await fetchJson(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=16&addressdetails=1`,
          { headers: { 'User-Agent': NOMINATIM_UA } }
        );
        const addr = rev?.address || {};
        const isBadLabel = (s) => {
          const v = String(s || '').trim();
          return !v || /\bward\b/i.test(v) || /^\d+$/.test(v);
        };
        const pick = (...vals) => vals.find(v => !isBadLabel(v));
        // Small place first: village/town, then suburb, then city
        const smallPlace = pick(addr.village, addr.town);
        const suburb     = pick(addr.suburb, addr.neighbourhood);
        const city       = pick(addr.city, addr.municipality);
        const province   = pick(addr.state, addr.province, addr.region);
        const country    = addr.country;

        const parts = [];
        if (smallPlace) {
          parts.push(smallPlace);
          // Add province for context: "Wilderness, Western Cape"
          if (province) parts.push(province);
          else if (country) parts.push(country);
        } else if (suburb) {
          parts.push(suburb);
          if (city) parts.push(city);
          else if (province) parts.push(province);
          else if (country) parts.push(country);
        } else if (city) {
          parts.push(city);
          if (province) parts.push(province);
          else if (country) parts.push(country);
        } else if (province) {
          parts.push(province);
          if (country) parts.push(country);
        } else if (country) {
          parts.push(country);
        }
        if (parts.length) resolvedName = parts.join(', ');
      } catch { /* Keep fallback name if reverse geocode fails */ }
    }

    // Source arrays: index 0=Open-Meteo, 1=WeatherAPI, 2=Pirate Weather, 3=MET Norway
    // null in a slot means that source failed or was not configured.
    // NOTE: hourlies has 3 slots (0=Open-Meteo, 1=WeatherAPI, 2=MET Norway).
    //       Pirate Weather excluded from hourly — its data starts at current hour not midnight.
    // Base weights — may be dynamically adjusted below based on source agreement
    let SOURCE_WEIGHTS        = [0.40, 0.25, 0.10, 0.25];
    let HOURLY_SOURCE_WEIGHTS = [0.50, 0.31, 0.19];  // 40/25/25 renormalised without Pirate Weather
    const failures = [];
    const norms    = [null, null, null, null]; // current conditions
    const hourlies = [null, null, null];       // hourly: Open-Meteo, WeatherAPI, MET Norway
    const dailies  = [null, null, null, null]; // 7-day daily arrays

    // UTC offset for the requested location (seconds).
    // Captured from Open-Meteo (timezone=auto) to calculate correct local hour.
    // Vercel runs UTC so new Date().getHours() would be wrong for non-UTC zones.
    let utcOffsetSeconds = 0;

    // Description maps
    const openMeteoCodeMap = {
      0:'Clear sky', 1:'Mainly clear', 2:'Partly cloudy', 3:'Overcast',
      45:'Fog', 48:'Depositing rime fog',
      51:'Light drizzle', 53:'Moderate drizzle', 55:'Dense drizzle',
      56:'Light freezing drizzle', 57:'Dense freezing drizzle',
      61:'Slight rain', 63:'Moderate rain', 65:'Heavy rain',
      66:'Light freezing rain', 67:'Heavy freezing rain',
      71:'Slight snow fall', 73:'Moderate snow fall', 75:'Heavy snow fall',
      77:'Snow grains',
      80:'Slight rain showers', 81:'Moderate rain showers', 82:'Violent rain showers',
      85:'Slight snow showers', 86:'Heavy snow showers',
      95:'Thunderstorm', 96:'Thunderstorm with slight hail', 99:'Thunderstorm with heavy hail',
    };

    const pirateIconMap = {
      'clear-day':'Clear sky', 'clear-night':'Clear sky',
      'rain':'Rain', 'snow':'Snow', 'sleet':'Sleet',
      'wind':'Windy', 'fog':'Fog', 'cloudy':'Cloudy',
      'partly-cloudy-day':'Partly cloudy', 'partly-cloudy-night':'Partly cloudy',
      'hail':'Hail', 'thunderstorm':'Thunderstorm', 'tornado':'Tornado',
    };

    // =========================================================================
    // Open-Meteo — ECMWF IFS — weight 50%
    // =========================================================================
    try {
      const om = await fetchJson(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,relative_humidity_2m,cloud_cover` +
        `&hourly=temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,wind_gusts_10m,cloud_cover,relative_humidity_2m,uv_index` +
        `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,weather_code,sunrise,sunset` +
        `&timezone=auto&forecast_days=7`
      );

      // Capture UTC offset so we can determine the correct local hour later
      if (isNum(om.utc_offset_seconds)) {
        utcOffsetSeconds = om.utc_offset_seconds;
      }

      norms[0] = {
        source:    'Open-Meteo',
        nowTemp:   om.current?.temperature_2m                    ?? null,
        feelsLike: om.current?.apparent_temperature              ?? null,
        todayHigh: om.daily?.temperature_2m_max?.[0]            ?? null,
        todayLow:  om.daily?.temperature_2m_min?.[0]            ?? null,
        todayRain: om.daily?.precipitation_probability_max?.[0] ?? null,
        todayUv:   om.daily?.uv_index_max?.[0]                  ?? null,
        desc:      openMeteoCodeMap[om.current?.weather_code]   ?? 'Unknown',
        windKph:   om.current?.wind_speed_10m                    ?? null,
        gustKph:   om.current?.wind_gusts_10m                    ?? null,
        humidity:  om.current?.relative_humidity_2m              ?? null,
        sunrise:   om.daily?.sunrise?.[0]                        ?? null,
        sunset:    om.daily?.sunset?.[0]                         ?? null,
      };

      hourlies[0] = {
        source:     'Open-Meteo',
        temps:      om.hourly?.temperature_2m?.slice(0, 48)            ?? [],
        feelsLikes: om.hourly?.apparent_temperature?.slice(0, 48)      ?? [],
        rains:      om.hourly?.precipitation_probability?.slice(0, 48) ?? [],
        winds:      om.hourly?.wind_speed_10m?.slice(0, 48)            ?? [],
        gusts:      om.hourly?.wind_gusts_10m?.slice(0, 48)            ?? [],
        clouds:     om.hourly?.cloud_cover?.slice(0, 48)               ?? [],
        humidity:   om.hourly?.relative_humidity_2m?.slice(0, 48)      ?? [],
        uvs:        om.hourly?.uv_index?.slice(0, 48)                  ?? [],
      };

      dailies[0] = {
        source:   'Open-Meteo',
        highs:    om.daily?.temperature_2m_max                          ?? [],
        lows:     om.daily?.temperature_2m_min                          ?? [],
        rains:    om.daily?.precipitation_probability_max               ?? [],
        uvs:      om.daily?.uv_index_max                                ?? [],
        descs:    om.daily?.weather_code?.map(c => openMeteoCodeMap[c] ?? 'Unknown') ?? [],
        sunrises: om.daily?.sunrise                                     ?? [],
        sunsets:  om.daily?.sunset                                      ?? [],
      };
    } catch {
      failures.push('Open-Meteo');
    }

    // =========================================================================
    // WeatherAPI — proprietary/mixed — weight 35%
    // =========================================================================
    if (WEATHERAPI_KEY) {
      try {
        const wa = await fetchJson(
          `https://api.weatherapi.com/v1/forecast.json?key=${WEATHERAPI_KEY}` +
          `&q=${lat},${lon}&days=7&aqi=no&alerts=no`
        );

        const d0    = wa.forecast?.forecastday?.[0]?.day   || {};
        const astro = wa.forecast?.forecastday?.[0]?.astro || {};

        // FIX-001: WeatherAPI codes 1000 (Sunny) and 1003 (Partly cloudy) with 0mm precip = "Clear sky"
        const waCondCode = wa.current?.condition?.code;
        const waDayPrecip = d0.totalprecip_mm ?? 0;
        let waDesc = wa.current?.condition?.text ?? 'Unknown';
        if ((waCondCode === 1000 || waCondCode === 1003) && waDayPrecip === 0) {
          console.log(`[FIX-001] WeatherAPI code ${waCondCode} ("${waDesc}") with 0mm precip → "Clear sky"`);
          waDesc = 'Clear sky';
        }

        norms[1] = {
          source:    'WeatherAPI',
          nowTemp:   wa.current?.temp_c          ?? null,
          feelsLike: wa.current?.feelslike_c     ?? null,
          todayHigh: d0.maxtemp_c                ?? null,
          todayLow:  d0.mintemp_c                ?? null,
          todayRain: d0.daily_chance_of_rain     ?? null,
          todayUv:   d0.uv                       ?? null,
          desc:      waDesc,
          windKph:   wa.current?.wind_kph        ?? null,
          humidity:  wa.current?.humidity        ?? null,
          sunrise:   astro.sunrise               ?? null,
          sunset:    astro.sunset                ?? null,
        };

        const waHours = [...(wa.forecast.forecastday[0]?.hour || []), ...(wa.forecast.forecastday[1]?.hour || [])].slice(0, 48);
        hourlies[1] = {
          source:     'WeatherAPI',
          temps:      waHours.map(h => h.temp_c),
          feelsLikes: waHours.map(h => h.feelslike_c),
          // FIX-001: Clamp rain chance to 0 for clear condition codes with no precipitation
          rains:      waHours.map(h => {
            const code = h.condition?.code;
            if ((code === 1000 || code === 1003) && (h.precip_mm ?? 0) === 0) return 0;
            return h.chance_of_rain;
          }),
          winds:      waHours.map(h => h.wind_kph),
          clouds:     waHours.map(h => h.cloud),
          humidity:   waHours.map(h => h.humidity),
        };

        dailies[1] = {
          source:   'WeatherAPI',
          highs:    wa.forecast.forecastday.map(fd => fd.day.maxtemp_c),
          lows:     wa.forecast.forecastday.map(fd => fd.day.mintemp_c),
          rains:    wa.forecast.forecastday.map(fd => fd.day.daily_chance_of_rain),
          uvs:      wa.forecast.forecastday.map(fd => fd.day.uv),
          // FIX-001: Override clear condition codes with 0mm precip
          descs:    wa.forecast.forecastday.map(fd => {
            const code = fd.day.condition?.code;
            if ((code === 1000 || code === 1003) && (fd.day.totalprecip_mm ?? 0) === 0) return 'Clear sky';
            return fd.day.condition.text;
          }),
          sunrises: wa.forecast.forecastday.map(fd => fd.astro?.sunrise ?? null),
          sunsets:  wa.forecast.forecastday.map(fd => fd.astro?.sunset  ?? null),
        };
      } catch {
        failures.push('WeatherAPI');
      }
    } else {
      failures.push('WeatherAPI');
    }

    // =========================================================================
    // Pirate Weather — NOAA GFS/GEFS — weight 15%
    // Used for current conditions and daily only (not hourly — see note above).
    // GEFS 30-member ensemble gives native rain probability (no mm->% hack).
    // Free tier: 20,000 calls/month. Sign up: https://pirateweather.net
    // =========================================================================
    if (PIRATE_WEATHER_KEY) {
      try {
        // units=si: temps in C, wind in m/s, humidity 0-1 fraction, precip mm
        const pw = await fetchJson(
          `https://api.pirateweather.net/forecast/${PIRATE_WEATHER_KEY}/${lat},${lon}` +
          `?units=si`
          // NOTE: We deliberately omit &extend=hourly since we don't use PW hourly data
        );

        const cur = pw.currently || {};
        const dly = pw.daily?.data || [];

        const toKph = v => isNum(v) ? Math.round(v * 3.6 * 10) / 10 : null; // m/s -> km/h
        const toPct = v => isNum(v) ? Math.round(v * 100) : null;            // 0-1 -> %
        const toIso = v => isNum(v) ? new Date(v * 1000).toISOString() : null; // Unix -> ISO

        const pwDesc = icon => pirateIconMap[icon] ?? icon ?? 'Unknown';

        const curTemp    = isNum(cur.temperature) ? cur.temperature : null;
        const curWindKph = toKph(cur.windSpeed);
        const curHumPct  = toPct(cur.humidity);

        norms[2] = {
          source:    'Pirate Weather',
          nowTemp:   curTemp,
          feelsLike: calcFeelsLike(curTemp, curWindKph, curHumPct),
          todayHigh: isNum(dly[0]?.temperatureHigh) ? dly[0].temperatureHigh : null,
          todayLow:  isNum(dly[0]?.temperatureLow)  ? dly[0].temperatureLow  : null,
          todayRain: toPct(dly[0]?.precipProbability), // native GEFS ensemble
          todayUv:   isNum(dly[0]?.uvIndex)          ? dly[0].uvIndex         : null,
          desc:      pwDesc(cur.icon),
          windKph:   curWindKph,
          gustKph:   toKph(cur.windGust),   // PW provides windGust in m/s (si units)
          humidity:  curHumPct,
          sunrise:   toIso(dly[0]?.sunriseTime),
          sunset:    toIso(dly[0]?.sunsetTime),
        };

        dailies[2] = {
          source:   'Pirate Weather',
          highs:    dly.slice(0, 7).map(d => isNum(d.temperatureHigh) ? d.temperatureHigh : null),
          lows:     dly.slice(0, 7).map(d => isNum(d.temperatureLow)  ? d.temperatureLow  : null),
          rains:    dly.slice(0, 7).map(d => toPct(d.precipProbability)),
          uvs:      dly.slice(0, 7).map(d => isNum(d.uvIndex)         ? d.uvIndex          : null),
          descs:    dly.slice(0, 7).map(d => pwDesc(d.icon)),
          sunrises: dly.slice(0, 7).map(d => toIso(d.sunriseTime)),
          sunsets:  dly.slice(0, 7).map(d => toIso(d.sunsetTime)),
        };
      } catch {
        failures.push('Pirate Weather');
      }
    } else {
      failures.push('Pirate Weather');
    }

    // ---------- MET Norway -- high-resolution NWP, weight 25% ---------------
    // No API key needed. Requires a descriptive User-Agent per api.met.no ToS.
    // Provides hourly wind at 10m (m/s) aligned to midnight local — safe for hourly aggregation.
    // Particularly valuable for coastal SA: higher resolution than global models.
    try {
      const met = await fetch(
        `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`,
        { headers: { 'User-Agent': NOMINATIM_UA }, signal: AbortSignal.timeout(timeoutMs) }
      );
      if (!met.ok) throw new Error(`HTTP ${met.status}`);
      const metJson = await met.json();

      const metSymbolMap = {
        'clearsky':'Clear sky', 'fair':'Fair', 'partlycloudy':'Partly cloudy',
        'cloudy':'Cloudy', 'fog':'Fog', 'sleet':'Sleet',
        'lightsleet':'Light sleet', 'heavysleet':'Heavy sleet',
        'lightrainshowers':'Light rain showers', 'rainshowers':'Rain showers',
        'heavyrainshowers':'Heavy rain showers',
        'lightrain':'Light rain', 'rain':'Rain', 'heavyrain':'Heavy rain',
        'lightrainandthunder':'Light rain and thunder',
        'rainandthunder':'Rain and thunder',
        'heavyrainandthunder':'Heavy rain and thunder',
        'lightsnow':'Light snow', 'snow':'Snow', 'heavysnow':'Heavy snow',
      };

      const series   = metJson.properties?.timeseries || [];
      const nowEntry = series[0] || {};
      const details  = nowEntry.data?.instant?.details || {};

      const metWindKph  = isNum(details.wind_speed) ? Math.round(details.wind_speed * 3.6 * 10) / 10 : null;
      const metHumidity = isNum(details.relative_humidity) ? details.relative_humidity : null;
      const metTemp     = isNum(details.air_temperature) ? details.air_temperature : null;

      // Rain proxy: convert max precipitation in next 24h to rough probability
      const precipAmounts = series.slice(0, 48).map(p =>
        p.data?.next_1_hours?.details?.precipitation_amount ??
        p.data?.next_6_hours?.details?.precipitation_amount ?? 0
      );
      const maxPrecip = Math.max(...precipAmounts, 0);
      const rainProxy = maxPrecip === 0 ? 0 :
                        maxPrecip < 0.5 ? 20 :
                        maxPrecip < 1   ? 40 :
                        maxPrecip < 2   ? 60 :
                        maxPrecip < 5   ? 80 : 95;

      const symbolCode = (nowEntry.data?.next_1_hours?.summary?.symbol_code ?? '').replace(/_(day|night|polartwilight)$/, '');
      const metDesc    = metSymbolMap[symbolCode] ?? symbolCode ?? 'Unknown';

      // Rec 3: Filter MET Norway timeseries to today's local date only (midnight to midnight)
      // The old code used series.slice(0, 48) which leaked tomorrow's peak temps into today's high.
      // Use utcOffsetSeconds to compute the correct local date string (YYYY-MM-DD).
      const nowUtcMs = Date.now();
      const localDateStr = new Date(nowUtcMs + utcOffsetSeconds * 1000).toISOString().slice(0, 10);
      const todaySeries = series.filter(p => {
        const ts = p.time; // ISO string e.g. "2026-03-10T12:00:00Z"
        if (!ts) return false;
        // Convert UTC timestamp to local date
        const entryLocalDate = new Date(new Date(ts).getTime() + utcOffsetSeconds * 1000).toISOString().slice(0, 10);
        return entryLocalDate === localDateStr;
      });
      console.log(`[MET Norway] Filtered ${series.length} entries → ${todaySeries.length} for local date ${localDateStr}`);

      const todayTemps = todaySeries.map(p => p.data?.instant?.details?.air_temperature).filter(isNum);

      norms[3] = {
        source:    'MET Norway',
        nowTemp:   metTemp,
        feelsLike: calcFeelsLike(metTemp, metWindKph, metHumidity),
        todayHigh: todayTemps.length > 0 ? todayTemps.reduce((a, b) => Math.max(a, b), -Infinity) : null,
        todayLow:  todayTemps.length > 0 ? todayTemps.reduce((a, b) => Math.min(a, b), Infinity)  : null,
        todayRain: rainProxy,
        todayUv:   null, // MET Norway compact doesn't provide UV
        desc:      metDesc,
        windKph:   metWindKph,
        gustKph:   null, // compact endpoint doesn't include gusts
        humidity:  metHumidity,
        sunrise:   null,
        sunset:    null,
      };

      hourlies[2] = {
        source:     'MET Norway',
        temps:      series.slice(0, 48).map(p => p.data?.instant?.details?.air_temperature ?? null),
        feelsLikes: series.slice(0, 48).map(p => {
          const t = p.data?.instant?.details?.air_temperature;
          const w = p.data?.instant?.details?.wind_speed ? p.data.instant.details.wind_speed * 3.6 : null;
          const h = p.data?.instant?.details?.relative_humidity;
          return calcFeelsLike(t, w, h);
        }),
        rains:  series.slice(0, 48).map(p => {
          const mm = p.data?.next_1_hours?.details?.precipitation_amount ?? 0;
          return mm === 0 ? 0 : mm < 0.5 ? 20 : mm < 1 ? 40 : mm < 2 ? 60 : 80;
        }),
        winds:  series.slice(0, 48).map(p => {
          const w = p.data?.instant?.details?.wind_speed;
          return isNum(w) ? Math.round(w * 3.6 * 10) / 10 : null;
        }),
        gusts:  series.slice(0, 48).map(() => null), // not in compact
        clouds: series.slice(0, 48).map(p => p.data?.instant?.details?.cloud_area_fraction ?? null),
      };

      dailies[3] = {
        source:   'MET Norway',
        highs:    [norms[3].todayHigh],
        lows:     [norms[3].todayLow],
        rains:    [rainProxy],
        uvs:      [],
        descs:    [metDesc],
        sunrises: [],
        sunsets:  [],
      };
    } catch {
      failures.push('MET Norway');
    }

    // =========================================================================
    // DYNAMIC WEIGHT ADJUSTMENT
    // Research shows Open-Meteo (ECMWF) and WeatherAPI often use the same
    // underlying model, doubling the cold bias during SA heat waves.
    // MET Norway's high-res model is more accurate for local extremes.
    // =========================================================================

    // Rec 1: When Open-Meteo and WeatherAPI daily highs are near-identical
    // (within 0.5°C), they're likely the same ECMWF model — halve WA weight
    if (isNum(norms[0]?.todayHigh) && isNum(norms[1]?.todayHigh)) {
      const ecmwfSpread = Math.abs(norms[0].todayHigh - norms[1].todayHigh);
      if (ecmwfSpread <= 0.5) {
        console.log(`[Weight adjust] OM=${norms[0].todayHigh}°C WA=${norms[1].todayHigh}°C (spread ${ecmwfSpread}°C ≤ 0.5) — halving WA weight (likely same ECMWF model)`);
        SOURCE_WEIGHTS[1] = SOURCE_WEIGHTS[1] / 2; // 0.25 → 0.125
      }
    }

    // Rec 2 + V2-1: When MET Norway diverges >5°C above ECMWF-family average,
    // boost MET Norway weight — but ONLY for coastal/western SA.
    // V2 research shows MET Norway has a -3.2°C cold bias on the highveld/bushveld
    // (Johannesburg, Polokwane), so boosting it there makes things worse.
    // Gate: skip boost for highveld/bushveld (lat north of -28° AND lon east of 25°)
    const isHighveld = lat > -28 && lon > 25;
    if (isNum(norms[3]?.todayHigh) && !isHighveld) {
      const ecmwfFamily = [norms[0]?.todayHigh, norms[1]?.todayHigh].filter(isNum);
      if (ecmwfFamily.length > 0) {
        const ecmwfAvg = ecmwfFamily.reduce((a, b) => a + b, 0) / ecmwfFamily.length;
        const metDivergence = norms[3].todayHigh - ecmwfAvg;
        if (metDivergence > 5) {
          console.log(`[Weight adjust] MET Norway ${norms[3].todayHigh}°C is ${metDivergence.toFixed(1)}°C above ECMWF avg ${ecmwfAvg.toFixed(1)}°C — boosting MET Norway 25%→40%, reducing OM 40%→25%`);
          SOURCE_WEIGHTS[0] = 0.25; // Open-Meteo: 40% → 25%
          SOURCE_WEIGHTS[3] = 0.40; // MET Norway: 25% → 40%
        }
      }
    } else if (isHighveld && isNum(norms[3]?.todayHigh)) {
      console.log(`[Weight adjust] Highveld location (lat=${lat}, lon=${lon}) — MET Norway boost disabled`);
    }

    // Recompute hourly weights from adjusted source weights (excl Pirate Weather)
    const hBase = [SOURCE_WEIGHTS[0], SOURCE_WEIGHTS[1], SOURCE_WEIGHTS[3]];
    const hTotal = hBase.reduce((a, b) => a + b, 0);
    HOURLY_SOURCE_WEIGHTS = hBase.map(w => Math.round(w / hTotal * 100) / 100);

    console.log(`[Weights] OM=${SOURCE_WEIGHTS[0]} WA=${SOURCE_WEIGHTS[1]} PW=${SOURCE_WEIGHTS[2]} MET=${SOURCE_WEIGHTS[3]} | Hourly=[${HOURLY_SOURCE_WEIGHTS.join(',')}]`);

    // =========================================================================
    // AGGREGATION
    // =========================================================================

    // Normalise weights for whichever sources actually returned data.
    function resolveWeights(arr, baseWeights) {
      const active = arr.map((item, i) => item !== null ? (baseWeights[i] ?? 0) : 0);
      const total  = active.reduce((s, v) => s + v, 0);
      if (total === 0) {
        const count = arr.filter(Boolean).length;
        return arr.map(item => item !== null ? 1 / count : 0);
      }
      return active.map(v => v / total);
    }

    const normW   = resolveWeights(norms, SOURCE_WEIGHTS);
    const hourlyW = resolveWeights(hourlies, HOURLY_SOURCE_WEIGHTS);
    const dailyW  = resolveWeights(dailies, SOURCE_WEIGHTS);

    // Weighted average across source slots (skips nulls).
    function wAvg(arr, weights, getter) {
      let sum = 0, wSum = 0;
      arr.forEach((item, i) => {
        if (item === null) return;
        const v = getter(item);
        if (isNum(v)) { sum += v * weights[i]; wSum += weights[i]; }
      });
      return wSum > 0 ? Math.round((sum / wSum) * 10) / 10 : null;
    }

    // Hourly aggregation (Open-Meteo + WeatherAPI only — aligned on local midnight)
    const aggregatedHourly = Array.from({ length: 48 }, (_, i) => {
      const hourWindVals = hourlies.map(h => h ? h.winds[i] : null).filter(isNum);
      const hourGustVals = hourlies.map(h => h ? (h.gusts?.[i] ?? null) : null).filter(isNum);
      const avgWind = wAvg(hourlies, hourlyW, h => h.winds[i]);
      const maxWind = Math.max(...hourWindVals, ...hourGustVals, 0) || null;

      // Use weighted average of mean wind speeds across sources.
      // Gusts are tracked separately and shown as "(gusts X km/h)" in the UI.
      const effectiveHourlyWind = avgWind;

      // UV: only Open-Meteo provides hourly UV; use directly if available
      const uvVal = hourlies[0]?.uvs?.[i] ?? null;

      // Rec 5: Modal cloud cover — use most frequent cloud category for condition logic.
      // Cloud cover is bimodal (clear or overcast), so averaging 10% and 90% gives 50%
      // which is meaningless. Modal approach picks the category most sources agree on.
      const cloudVals = hourlies.map(h => h ? h.clouds?.[i] : null).filter(isNum);
      const modalCloud = cloudVals.length > 0 ? pickModalCloud(cloudVals) : null;

      return {
        tempC:      wAvg(hourlies, hourlyW, h => h.temps[i]),
        feelsLikeC: wAvg(hourlies, hourlyW, h => h.feelsLikes?.[i]),
        rainChance: wAvg(hourlies, hourlyW, h => h.rains[i]),
        windKph:    effectiveHourlyWind,
        cloudPct:   modalCloud,  // Rec 5: use modal instead of averaged cloud cover
        uv:         isNum(uvVal) ? Math.round(uvVal * 10) / 10 : null,
      };
    });

    // Rec 6: Description voting weights — reduce WeatherAPI influence
    // WeatherAPI descriptions are unreliable (overcooks rain flags) so give it 10% weight.
    // Source order: [0]=Open-Meteo, [1]=WeatherAPI, [2]=Pirate Weather, [3]=MET Norway
    const DESC_WEIGHTS = [1, 0.1, 1, 1]; // WA gets 10% voting weight for descriptions

    // Daily aggregation (all sources)
    const aggregatedDaily = Array.from({ length: 7 }, (_, i) => {
      const descEntries  = dailies.map((d, si) => d && d.descs[i] ? { desc: d.descs[i], weight: DESC_WEIGHTS[si] } : null).filter(Boolean);
      const conditionLabel = pickWeightedMostCommon(descEntries) || 'Unknown';
      const highC        = wAvg(dailies, dailyW, d => d.highs[i]);
      const lowC         = wAvg(dailies, dailyW, d => d.lows[i]);
      const rainChance   = wAvg(dailies, dailyW, d => d.rains[i]);
      const uv           = wAvg(dailies, dailyW, d => d.uvs[i]);
      // Use midday wind estimate (index 12 = noon local time, day 1 = index 36)
      const noonIdx      = i * 24 + 12;
      const windKph      = aggregatedHourly[noonIdx]?.windKph ?? null;

      let dailyConditionKey = deriveCondition({
        desc:      conditionLabel,
        rainChance,
        tempC:     highC,
        windKph,
        uvIndex:   uv,
        cloudPct:  aggregatedHourly[noonIdx]?.cloudPct ?? null,
        isDay:     true,
      });

      // Rec 4: Majority voting for daily conditions — same logic as FIX-001
      // Requires ≥2 sources to agree on rain/cloudy before declaring it
      if ((dailyConditionKey === 'rain-possible' || dailyConditionKey === 'cloudy') && descEntries.length >= 3) {
        const dailyVotes = descEntries.map(e => categorizeDesc(e.desc));
        const rainOrCloudyCount = dailyVotes.filter(v => v === 'rain' || v === 'cloudy' || v === 'storm').length;
        if (rainOrCloudyCount < 2) {
          console.log(`[Rec 4] Day ${i}: ${dailyConditionKey} → clear (only ${rainOrCloudyCount}/${descEntries.length} sources vote rain/cloudy)`);
          dailyConditionKey = 'clear';
        }
      }

      return {
        highC,
        lowC,
        rainChance,
        uv,
        conditionLabel,
        conditionKey: dailyConditionKey,
        sunrise: dailies.filter(Boolean).find(d => d.sunrises?.[i])?.sunrises[i] ?? null,
        sunset:  dailies.filter(Boolean).find(d => d.sunsets?.[i])?.sunsets[i]   ?? null,
      };
    });

    // =========================================================================
    // CONFIDENCE
    // Based on agreement between Open-Meteo and WeatherAPI — genuinely different
    // model families, so their agreement is meaningful.
    // Pirate Weather (GFS) divergence is an additional uncertainty signal.
    // =========================================================================
    const omNorm  = norms[0];
    const waNorm  = norms[1];
    const pwNorm  = norms[2];
    const metNorm = norms[3];

    let confidenceKey = 'mixed';
    if (isNum(omNorm?.nowTemp) && isNum(waNorm?.nowTemp)) {
      const spread = Math.abs(omNorm.nowTemp - waNorm.nowTemp);
      confidenceKey = spread <= 1.5 ? 'strong' : spread <= 3.5 ? 'decent' : 'mixed';
    } else if (norms.filter(Boolean).length === 1) {
      confidenceKey = 'decent';
    }

    // GFS divergence check: when GFS and ECMWF disagree strongly, honest downgrade
    let pirateWeatherAlert = null;
    if (isNum(omNorm?.nowTemp) && isNum(pwNorm?.nowTemp)) {
      if (Math.abs(omNorm.nowTemp - pwNorm.nowTemp) > 3) {
        pirateWeatherAlert = 'gfs_ecmwf_divergence';
        if (confidenceKey === 'strong') confidenceKey = 'decent';
      }
    }

    // =========================================================================
    // "NOW" CALCULATIONS
    // =========================================================================
    const activeNorms = norms.filter(Boolean);

    // Bug 5 guard: if all sources failed, return a clear error
    if (activeNorms.length === 0) {
      return res.status(503).json({
        ok: false,
        error: 'All weather sources failed. Please try again shortly.',
        meta: { sources: failures.map(f => ({ name: f, ok: false })) },
      });
    }

    const medNowTemp   = wAvg(norms, normW, n => n.nowTemp);
    const medFeelsLike = wAvg(norms, normW, n => n.feelsLike);
    const medWindKph   = wAvg(norms, normW, n => n.windKph);

    // Rec 7: Temperature debug logging — shows each source's contribution to the blend
    const tempDebug = norms.map((n, i) => n ? `${n.source}: now=${n.nowTemp}°C high=${n.todayHigh}°C low=${n.todayLow}°C (weight=${Math.round(normW[i]*100)}%)` : null).filter(Boolean);
    console.log(`[Temp blend] ${tempDebug.join(' | ')} → blended=${medNowTemp}°C`);
    const highDebug = norms.map((n, i) => n ? `${n.source}=${n.todayHigh}°C` : null).filter(Boolean);
    const blendedHigh = wAvg(norms, normW, n => n.todayHigh);
    const blendedLow = wAvg(norms, normW, n => n.todayLow);
    console.log(`[Daily high/low] ${highDebug.join(' | ')} → blended high=${blendedHigh}°C low=${blendedLow}°C`);
    // maxWindKph includes gust data from Open-Meteo.
    // In gusty coastal conditions (Cape Town southeaster etc), gusts are the
    // real story — mean wind can be 18 km/h while gusts hit 45 km/h.
    const gustKph      = activeNorms.map(n => n.gustKph).filter(isNum);
    const maxWindKph   = Math.max(
      ...activeNorms.map(n => n.windKph).filter(isNum),
      ...gustKph,
      0
    );
    const medHumidity  = wAvg(norms, normW, n => n.humidity);
    const medUv        = wAvg(norms, normW, n => n.todayUv);

    // Display the weighted mean wind speed. Gusts (maxWindKph) are passed through
    // separately for UI display as "(gusts X km/h)" — not inflated into the main number.
    const effectiveDisplayWind = medWindKph ?? 0;

    // Correct local hour using UTC offset from Open-Meteo.
    // Vercel runs UTC so new Date().getHours() would be wrong for non-UTC zones.
    // e.g. South Africa (UTC+2): 21:31 SAST = 19:31 UTC. Without this fix,
    // we'd read cloudPct for 19:00 instead of 21:00.
    const localHour = Math.floor(((Date.now() / 1000) + utcOffsetSeconds) / 3600) % 24;

    const currentCloudPct = aggregatedHourly[localHour]?.cloudPct ?? null;

    // Current hour's rain chance (not today's daily max).
    // Using daily max caused the app to show 70% rain at 10pm when it only
    // rained in the morning. Current hour is more truthful for "right now".
    const currentHourRainChance = aggregatedHourly[localHour]?.rainChance ?? null;

    // Rec 6: Weight descriptions — WA gets 10% influence
    const nowDescEntries = norms.map((n, si) => n && n.desc ? { desc: n.desc, weight: DESC_WEIGHTS[si] } : null).filter(Boolean);
    const mostDesc       = pickWeightedMostCommon(nowDescEntries) || 'Weather today';
    const finalFeelsLike = isNum(medFeelsLike) ? medFeelsLike : calcFeelsLike(medNowTemp, medWindKph, medHumidity);

    // Sunrise/sunset for the response — first available source.
    // Declared before isDay so no ReferenceError.
    const sunrise = activeNorms.find(n => n.sunrise)?.sunrise ?? null;
    const sunset  = activeNorms.find(n => n.sunset)?.sunset   ?? null;

    // isDay — use ONLY Open-Meteo's sunrise/sunset which are ISO strings (parseable).
    // WeatherAPI returns "06:45 AM" with no date — new Date() gives Invalid Date.
    // If Open-Meteo failed, fall back to utcOffsetSeconds + a hardcoded 06:00–19:00
    // window, which is wrong but at least won't cause UV to fire all night.
    const nowMs = Date.now();
    let isDay = true;
    const omSunrise = norms[0]?.sunrise ?? null;
    const omSunset  = norms[0]?.sunset  ?? null;
    if (omSunrise && omSunset) {
      // Open-Meteo returns sunrise/sunset as local-time ISO strings WITHOUT a timezone
      // indicator (e.g. "2026-02-22T06:12"). The Vercel server runs UTC, so JS parses
      // these as UTC — creating a 2-hour error for SAST (UTC+2). We correct by
      // subtracting utcOffsetSeconds to convert the local-labelled timestamps to true UTC ms.
      const srMs = new Date(omSunrise).getTime() - (utcOffsetSeconds * 1000);
      const ssMs = new Date(omSunset).getTime()  - (utcOffsetSeconds * 1000);
      if (!isNaN(srMs) && !isNaN(ssMs)) {
        isDay = nowMs >= srMs && nowMs <= ssMs;
      }
    } else {
      // Open-Meteo unavailable — estimate from local hour (UTC offset known from earlier)
      // Assume daylight 06:00–19:00 local. Better than defaulting to true.
      isDay = localHour >= 6 && localHour < 19;
    }

    // medUv is the daily MAXIMUM (recorded at noon). Using it at 18:55 falsely
    // reports "High UV" near sunset. Only use UV to drive condition between 10:00-16:00.
    const uvForCondition = (localHour >= 10 && localHour < 16) ? medUv : null;

    let nowConditionKey = deriveCondition({
      desc:       mostDesc,
      rainChance: currentHourRainChance,
      tempC:      medNowTemp,
      feelsLikeC: finalFeelsLike,
      windKph:    medWindKph,
      uvIndex:    uvForCondition,
      cloudPct:   currentCloudPct,
      maxWindKph,
      isDay,
    });

    // FIX-001: Per-source condition votes for debugging and majority check
    const sourceConditionVotes = activeNorms.map(n => ({
      source: n.source,
      desc: n.desc,
      vote: categorizeDesc(n.desc),
    }));
    console.log('[Condition voting]', JSON.stringify(sourceConditionVotes));
    console.log(`[Condition derived] ${nowConditionKey} (desc="${mostDesc}", rain=${currentHourRainChance}%, cloud=${currentCloudPct}%)`);

    // FIX-001: Majority check — single source claiming rain/cloudy must not override clear consensus
    // Requires ≥2 sources to agree on rain/cloudy before the app declares it
    if ((nowConditionKey === 'rain-possible' || nowConditionKey === 'cloudy') && activeNorms.length >= 3) {
      const rainOrCloudyVotes = sourceConditionVotes.filter(v =>
        v.vote === 'rain' || v.vote === 'cloudy' || v.vote === 'storm'
      ).length;
      if (rainOrCloudyVotes < 2) {
        console.log(`[FIX-001 majority override] ${nowConditionKey} → clear (only ${rainOrCloudyVotes}/${activeNorms.length} sources vote rain/cloudy)`);
        nowConditionKey = 'clear';
      }
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    return res.status(200).json({
      ok: true,
      location: { name: resolvedName || name || 'Unknown', lat, lon },
      wind_kph:   effectiveDisplayWind,
      maxWindKph: maxWindKph > 0 ? maxWindKph : null,
      gustKph:    gustKph.length > 0 ? Math.max(...gustKph) : null,
      now: {
        tempC:          medNowTemp,
        feelsLikeC:     finalFeelsLike,
        windKph:        effectiveDisplayWind,
        humidity:       medHumidity,
        rainChance:     currentHourRainChance,  // current hour rain chance
        uv:             isDay ? medUv : null,  // UV is irrelevant after sunset
        cloudPct:       currentCloudPct,
        conditionKey:   nowConditionKey,
        conditionLabel: mostDesc,
        isDay,          // lets app.js switch night/day copy and suppress UV stat
        sunrise,
        sunset,
      },
      consensus: {
        confidenceKey,
        pirateWeatherAlert, // null | 'gfs_ecmwf_divergence'
      },
      daily:  aggregatedDaily,
      hourly: aggregatedHourly,
      meta: {
        sources: [
          ...activeNorms.map(n => ({ name: n.source, ok: true })),
          ...failures.map(f => ({ name: f, ok: false })),
        ],
        sourceRanges: activeNorms.map(n => ({
          name:    n.source,
          minTemp: n.todayLow,
          maxTemp: n.todayHigh,
        })),
        sourceWeights: {
          'Open-Meteo':     norms[0] ? Math.round(normW[0] * 100) : null,
          'WeatherAPI':     norms[1] ? Math.round(normW[1] * 100) : null,
          'Pirate Weather': norms[2] ? Math.round(normW[2] * 100) : null,
          'MET Norway':     norms[3] ? Math.round(normW[3] * 100) : null,
        },
        sourceConditions: sourceConditionVotes,
        localHour,
        updatedAtLabel: new Date().toISOString(),
      },
    });

  } catch (e) {
    console.error('Weather API error:', e);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function isNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function pickMostCommon(arr) {
  if (arr.length === 0) return null;
  const count = arr.reduce((acc, v) => ({ ...acc, [v]: (acc[v] || 0) + 1 }), {});
  return Object.keys(count).reduce((a, b) => count[a] > count[b] ? a : b);
}

/**
 * Rec 6: Weighted description voting. Each entry is { desc, weight }.
 * Accumulates weight per description string and returns the one with highest total weight.
 */
function pickWeightedMostCommon(entries) {
  if (entries.length === 0) return null;
  const scores = {};
  for (const { desc, weight } of entries) {
    scores[desc] = (scores[desc] || 0) + weight;
  }
  return Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);
}

/**
 * Rec 5: Pick modal cloud cover from multiple source values.
 * Categorises each source's cloud % into buckets (clear/partly/mostly/overcast),
 * finds the most common bucket, then returns the median value within that bucket.
 * This avoids averaging bimodal data (e.g. 10% and 90% → meaningless 50%).
 */
function pickModalCloud(values) {
  if (values.length === 0) return null;
  if (values.length === 1) return values[0];

  // Bucket cloud values: clear (0-25), partly (25-55), mostly (55-80), overcast (80-100)
  const buckets = { clear: [], partly: [], mostly: [], overcast: [] };
  for (const v of values) {
    if (v < 25)      buckets.clear.push(v);
    else if (v < 55) buckets.partly.push(v);
    else if (v < 80) buckets.mostly.push(v);
    else             buckets.overcast.push(v);
  }

  // Find bucket with most votes
  let winner = 'clear';
  let maxCount = 0;
  for (const [name, vals] of Object.entries(buckets)) {
    if (vals.length > maxCount) {
      maxCount = vals.length;
      winner = name;
    }
  }

  // Return median of the winning bucket
  const winnerVals = buckets[winner].sort((a, b) => a - b);
  return winnerVals[Math.floor(winnerVals.length / 2)];
}

/**
 * Calculate "feels like" temperature using wind chill or heat index formulas.
 * Wind chill: valid for temps <= 10C with wind > 4.8 km/h
 * Heat index: valid for temps >= 27C with humidity data
 */
function calcFeelsLike(tempC, windKph, humidity) {
  if (!isNum(tempC)) return null;

  if (tempC <= 10 && isNum(windKph) && windKph > 4.8) {
    const wc = 13.12 + 0.6215 * tempC
      - 11.37 * Math.pow(windKph, 0.16)
      + 0.3965 * tempC * Math.pow(windKph, 0.16);
    return Math.round(wc * 10) / 10;
  }

  if (tempC >= 27 && isNum(humidity)) {
    const hi = tempC + 0.33 * (humidity / 100 * 6.105 * Math.exp(17.27 * tempC / (237.7 + tempC))) - 4;
    return Math.round(hi * 10) / 10;
  }

  return tempC;
}

/**
 * Derive the weather condition key for UI display.
 *
 * Priority order (highest wins):
 *  1. Storm / thunder / tornado
 *  2. Extreme cold (feels like <= -5C, or temp <= 0C)
 *  3. Snow / sleet / ice / hail / freezing
 *  4. Extreme heat (temp >= 35C or feels like >= 38C)
 *  5. Heavy rain (>= 60% chance)
 *  6. High UV (>= 8, daytime only, not overcast)
 *  7. Strong wind (>= 30 km/h effective)
 *  8. Moderate rain (>= 30% chance)
 *  9. Rain by description
 * 10. Moderate wind (>= 25 km/h)
 * 11. Overcast (>= 80% cloud or description)
 * 12. Rain possible (>= 20% chance)
 * 13. Fog / mist / haze
 * 14. Cold (temp <= 10C)
 * 15. Hot (temp >= 30C)
 * 16. Moderate UV (>= 6, daytime only, not mostly cloudy)
 * 17. Mostly cloudy (>= 55% cloud)
 * 18. Partly cloudy / mainly clear / fair -> treated as clear
 * 19. Clear by description
 * 20. Fallback: clear
 *
 * @param {object} params
 * @param {string}  params.desc         - Weather description text
 * @param {number}  params.rainChance   - Rain probability % (current hour)
 * @param {number}  params.tempC        - Current temperature C
 * @param {number}  params.feelsLikeC   - Feels like temperature C
 * @param {number}  params.windKph      - Wind speed km/h (weighted average)
 * @param {number}  params.maxWindKph   - Max wind from any source (for gust bias)
 * @param {number}  params.uvIndex      - UV index
 * @param {number}  params.cloudPct     - Cloud cover %
 * @param {boolean} params.isDay        - Whether the sun is currently up
 * @returns {string} condition key
 */
function deriveCondition({ desc, rainChance, tempC, feelsLikeC, windKph, uvIndex, cloudPct, maxWindKph, isDay = true }) {
  const d = String(desc || '').toLowerCase();

  // Use mean wind speed for condition thresholds. Gusts are displayed separately in the UI.
  const effectiveWind = windKph;

  // Cloud cover classification
  const isTrulyOvercast    = isNum(cloudPct) && cloudPct >= 80;
  const isMostlyCloudy     = isNum(cloudPct) && cloudPct >= 55;
  const isSignificantCloud = isNum(cloudPct) && cloudPct >= 40; // blocks UV
  const isPartlyCloudy     = isNum(cloudPct) && cloudPct >= 30 && cloudPct < 55;

  // Description-based cloud fallbacks (used when cloudPct is unavailable)
  const descSaysOvercast = d.includes('overcast');
  const descSaysPartly   = d.includes('partly') || d.includes('mainly clear') || d.includes('fair');
  const descSaysCloudy   = d.includes('cloud') && !descSaysPartly;
  const cloudyByDesc     = !isNum(cloudPct) && (descSaysOvercast || descSaysCloudy);
  const overcastByDesc   = !isNum(cloudPct) && descSaysOvercast;
  const partlyByDesc     = !isNum(cloudPct) && descSaysPartly;

  // 1. Storm
  if (d.includes('thunder') || d.includes('storm') || d.includes('tornado')) return 'storm';

  // 2. Extreme cold
  if (isNum(feelsLikeC) && feelsLikeC <= -5) return 'cold';
  if (isNum(tempC) && tempC <= 0)             return 'cold';

  // 3. Winter precipitation
  if (d.includes('snow') || d.includes('sleet') || d.includes('ice') ||
      d.includes('hail') || d.includes('blizzard') || d.includes('freezing')) return 'cold';

  // 4. Extreme heat
  if (isNum(tempC) && tempC >= 35)            return 'heat';
  if (isNum(feelsLikeC) && feelsLikeC >= 38) return 'heat';

  // 5. Heavy rain
  if (isNum(rainChance) && rainChance >= 60)  return 'rain';

  // 6. High UV — daytime only, not overcast, not significantly cloudy
  if (isDay && isNum(uvIndex) && uvIndex >= 8 && !(isTrulyOvercast || isMostlyCloudy || overcastByDesc)) return 'uv';

  // 7. Strong wind
  if (isNum(effectiveWind) && effectiveWind >= 30) return 'wind';

  // 8. Moderate rain
  if (isNum(rainChance) && rainChance >= 30)  return 'rain';

  // 9. Rain by description
  if (d.includes('rain') || d.includes('drizzle') || d.includes('shower') || d.includes('precip')) return 'rain';

  // 10. Moderate wind
  if (isNum(effectiveWind) && effectiveWind >= 25) return 'wind';

  // 11. Overcast
  if (isTrulyOvercast || overcastByDesc)      return 'cloudy';

  // 12. Possible rain (20%+ but not yet "rain")
  if (isNum(rainChance) && rainChance >= 20)  return 'rain-possible';

  // 13. Fog / mist / haze
  if (d.includes('fog') || d.includes('mist') || d.includes('haze')) return 'fog';

  // 14. Cold (not freezing, but chilly)
  if (isNum(tempC) && tempC <= 10)            return 'cold';

  // 15. Hot (not extreme, but warm)
  if (isNum(tempC) && tempC >= 30)            return 'heat';

  // 16. Moderate UV — daytime only, not significantly cloudy (40%+ blocks UV)
  if (isDay && isNum(uvIndex) && uvIndex >= 6 && !(isSignificantCloud || isMostlyCloudy || cloudyByDesc)) return 'uv';

  // 17. Mostly cloudy
  if (isMostlyCloudy || cloudyByDesc)         return 'cloudy';

  // 18. Partly cloudy / mainly clear / fair — treated as clear (nice day)
  if (isPartlyCloudy || partlyByDesc)         return 'clear';

  // 19. Clear by description (includes 'wind' to avoid 'Windy' desc falling to bottom)
  if (d.includes('clear') || d.includes('sunny') || d.includes('fair') || d.includes('wind')) return 'clear';

  // 20. Fallback
  return 'clear';
}

/**
 * Categorize a weather description into a broad condition bucket.
 * Used by FIX-001 majority voting to count how many sources agree on rain/cloudy.
 */
function categorizeDesc(desc) {
  const d = String(desc || '').toLowerCase();
  if (d.includes('thunder') || d.includes('storm') || d.includes('tornado')) return 'storm';
  if (d.includes('rain') || d.includes('drizzle') || d.includes('shower') || d.includes('precip')) return 'rain';
  if (d.includes('snow') || d.includes('sleet') || d.includes('hail') || d.includes('freezing')) return 'cold';
  if (d.includes('overcast')) return 'cloudy';
  if (d.includes('cloud') && !d.includes('partly') && !d.includes('mainly')) return 'cloudy';
  if (d.includes('fog') || d.includes('mist')) return 'fog';
  return 'clear';
}
