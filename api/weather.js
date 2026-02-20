// /api/weather.js
// Probably Weather – server-side weather aggregator
// Sources: Open-Meteo (ECMWF, no key), WeatherAPI (proprietary, key), Pirate Weather (NOAA GFS/GEFS, key)
// Weights:  50% Open-Meteo  |  35% WeatherAPI  |  15% Pirate Weather
// Pirate Weather provides genuine model independence (GFS/GEFS vs ECMWF) and
// proper ensemble-based rain probability (30-member GEFS).
// NOTE: Pirate Weather is used for current conditions and daily only — its
// hourly.data starts at the current hour (not midnight) so cannot be safely
// aligned with Open-Meteo/WeatherAPI hourly arrays that start at 00:00 local.

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
    const NOMINATIM_UA       = process.env.MET_USER_AGENT     || 'ProbablyWeather/1.0 (contact: you@example.com)';

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

    // Reverse geocode endpoint
    if (req.query.reverse) {
      try {
        const rev = await fetchJson(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`,
          { headers: { 'User-Agent': NOMINATIM_UA } }
        );
        const addr = rev?.address || {};
        const city = addr.city || addr.town || addr.village || addr.suburb || addr.neighbourhood || addr.municipality || null;
        const admin1 = addr.state || addr.province || addr.region || addr.county || null;
        const countryCode = addr.country_code ? String(addr.country_code).toUpperCase() : null;
        return res.status(200).json({ ok: true, city, admin1, countryCode });
      } catch {
        return res.status(200).json({ ok: false, city: null, admin1: null, countryCode: null });
      }
    }

    // Resolve location name
    let resolvedName = isPlaceholder ? null : name;
    if (!resolvedName) {
      try {
        const rev = await fetchJson(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
          { headers: { 'User-Agent': NOMINATIM_UA } }
        );
        const addr = rev?.address || {};
        const isBadLabel = (s) => {
          const v = String(s || '').trim();
          return !v || /\bward\b/i.test(v) || /^\d+$/.test(v);
        };
        const pick = (...vals) => vals.find(v => !isBadLabel(v));
        const primary   = pick(addr.town, addr.city, addr.village);
        const cityTown  = pick(addr.suburb, addr.neighbourhood);
        const secondary = pick(addr.municipality, addr.state, addr.province);
        const country   = addr.country;

        const parts = [];
        if (primary)        parts.push(primary);
        else if (cityTown)  parts.push(cityTown);
        else if (secondary) parts.push(secondary);
        else if (country)   parts.push(country);
        if (country && parts[parts.length - 1] !== country) parts.push(country);
        if (parts.length) resolvedName = parts.join(', ');
      } catch { /* Keep fallback name if reverse geocode fails */ }
    }

    // Source arrays: index 0=Open-Meteo, 1=WeatherAPI, 2=Pirate Weather
    // null in a slot means that source failed or was not configured.
    // NOTE: hourlies only has 2 slots — Pirate Weather is excluded from hourly
    //       aggregation because its hourly.data starts at the current hour (not
    //       midnight local time), making it impossible to align with the other sources.
    const SOURCE_WEIGHTS        = [0.50, 0.35, 0.15];
    const HOURLY_SOURCE_WEIGHTS = [0.59, 0.41];  // renormalised 50/35 without Pirate Weather
    const failures = [];
    const norms    = [null, null, null]; // current conditions
    const hourlies = [null, null];       // hourly arrays (Open-Meteo, WeatherAPI only)
    const dailies  = [null, null, null]; // 7-day daily arrays

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
        `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m,cloud_cover` +
        `&hourly=temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,cloud_cover,relative_humidity_2m` +
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
        humidity:  om.current?.relative_humidity_2m              ?? null,
        sunrise:   om.daily?.sunrise?.[0]                        ?? null,
        sunset:    om.daily?.sunset?.[0]                         ?? null,
      };

      hourlies[0] = {
        source:     'Open-Meteo',
        temps:      om.hourly?.temperature_2m?.slice(0, 24)            ?? [],
        feelsLikes: om.hourly?.apparent_temperature?.slice(0, 24)      ?? [],
        rains:      om.hourly?.precipitation_probability?.slice(0, 24) ?? [],
        winds:      om.hourly?.wind_speed_10m?.slice(0, 24)            ?? [],
        clouds:     om.hourly?.cloud_cover?.slice(0, 24)               ?? [],
        humidity:   om.hourly?.relative_humidity_2m?.slice(0, 24)      ?? [],
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

        norms[1] = {
          source:    'WeatherAPI',
          nowTemp:   wa.current?.temp_c          ?? null,
          feelsLike: wa.current?.feelslike_c     ?? null,
          todayHigh: d0.maxtemp_c                ?? null,
          todayLow:  d0.mintemp_c                ?? null,
          todayRain: d0.daily_chance_of_rain     ?? null,
          todayUv:   d0.uv                       ?? null,
          desc:      wa.current?.condition?.text ?? 'Unknown',
          windKph:   wa.current?.wind_kph        ?? null,
          humidity:  wa.current?.humidity        ?? null,
          sunrise:   astro.sunrise               ?? null,
          sunset:    astro.sunset                ?? null,
        };

        hourlies[1] = {
          source:     'WeatherAPI',
          temps:      wa.forecast.forecastday[0].hour.map(h => h.temp_c),
          feelsLikes: wa.forecast.forecastday[0].hour.map(h => h.feelslike_c),
          rains:      wa.forecast.forecastday[0].hour.map(h => h.chance_of_rain),
          winds:      wa.forecast.forecastday[0].hour.map(h => h.wind_kph),
          clouds:     wa.forecast.forecastday[0].hour.map(h => h.cloud),
          humidity:   wa.forecast.forecastday[0].hour.map(h => h.humidity),
        };

        dailies[1] = {
          source:   'WeatherAPI',
          highs:    wa.forecast.forecastday.map(fd => fd.day.maxtemp_c),
          lows:     wa.forecast.forecastday.map(fd => fd.day.mintemp_c),
          rains:    wa.forecast.forecastday.map(fd => fd.day.daily_chance_of_rain),
          uvs:      wa.forecast.forecastday.map(fd => fd.day.uv),
          descs:    wa.forecast.forecastday.map(fd => fd.day.condition.text),
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
    const aggregatedHourly = Array.from({ length: 24 }, (_, i) => {
      const hourWindVals = hourlies.map(h => h ? h.winds[i] : null).filter(isNum);
      const avgWind = wAvg(hourlies, hourlyW, h => h.winds[i]);
      const maxWind = hourWindVals.length ? Math.max(...hourWindVals) : null;

      // When sources disagree on wind by more than 40%, bias toward the higher reading
      const effectiveHourlyWind = (isNum(avgWind) && isNum(maxWind) && maxWind > avgWind * 1.4)
        ? Math.round((avgWind * 0.4 + maxWind * 0.6) * 10) / 10
        : avgWind;

      return {
        tempC:      wAvg(hourlies, hourlyW, h => h.temps[i]),
        feelsLikeC: wAvg(hourlies, hourlyW, h => h.feelsLikes?.[i]),
        rainChance: wAvg(hourlies, hourlyW, h => h.rains[i]),
        windKph:    effectiveHourlyWind,
        cloudPct:   wAvg(hourlies, hourlyW, h => h.clouds?.[i]),
      };
    });

    // Daily aggregation (all three sources)
    const aggregatedDaily = Array.from({ length: 7 }, (_, i) => {
      const descs        = dailies.filter(Boolean).map(d => d.descs[i]).filter(Boolean);
      const conditionLabel = pickMostCommon(descs) || 'Unknown';
      const highC        = wAvg(dailies, dailyW, d => d.highs[i]);
      const lowC         = wAvg(dailies, dailyW, d => d.lows[i]);
      const rainChance   = wAvg(dailies, dailyW, d => d.rains[i]);
      const uv           = wAvg(dailies, dailyW, d => d.uvs[i]);
      // Use midday wind estimate (index 12 = noon local time)
      const noonIdx      = Math.min(i * 4 + 12, 23);
      const windKph      = aggregatedHourly[noonIdx]?.windKph ?? null;

      return {
        highC,
        lowC,
        rainChance,
        uv,
        conditionLabel,
        // Daily condition: isDay=true because it represents the whole day
        conditionKey: deriveCondition({
          desc:      conditionLabel,
          rainChance,
          tempC:     highC,
          windKph,
          uvIndex:   uv,
          cloudPct:  aggregatedHourly[noonIdx]?.cloudPct ?? null,
          isDay:     true,
        }),
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
    const omNorm = norms[0];
    const waNorm = norms[1];
    const pwNorm = norms[2];

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
    const maxWindKph   = Math.max(...activeNorms.map(n => n.windKph).filter(isNum), 0);
    const medHumidity  = wAvg(norms, normW, n => n.humidity);
    const medUv        = wAvg(norms, normW, n => n.todayUv);

    const effectiveDisplayWind = (isNum(medWindKph) && isNum(maxWindKph) && maxWindKph > medWindKph * 1.4)
      ? Math.round((medWindKph * 0.4 + maxWindKph * 0.6) * 10) / 10
      : (medWindKph ?? 0);

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

    const mostDesc      = pickMostCommon(activeNorms.map(n => n.desc).filter(Boolean)) || 'Weather today';
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
      const srMs = new Date(omSunrise).getTime();
      const ssMs = new Date(omSunset).getTime();
      if (!isNaN(srMs) && !isNaN(ssMs)) {
        isDay = nowMs >= srMs && nowMs <= ssMs;
      }
    } else {
      // Open-Meteo unavailable — estimate from local hour (UTC offset known from earlier)
      // Assume daylight 06:00–19:00 local. Better than defaulting to true.
      isDay = localHour >= 6 && localHour < 19;
    }

    const nowConditionKey = deriveCondition({
      desc:       mostDesc,
      rainChance: currentHourRainChance,  // current hour, not today's daily max
      tempC:      medNowTemp,
      feelsLikeC: finalFeelsLike,
      windKph:    medWindKph,
      uvIndex:    medUv,
      cloudPct:   currentCloudPct,
      maxWindKph,
      isDay,
    });

    return res.status(200).json({
      ok: true,
      location: { name: resolvedName || name || 'Unknown', lat, lon },
      wind_kph:   effectiveDisplayWind,
      maxWindKph: maxWindKph > 0 ? maxWindKph : null,
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
        },
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

  // Use max wind when sources disagree significantly (captures gusty reality
  // that weighted averages can wash out)
  const effectiveWind = isNum(maxWindKph) && maxWindKph > (windKph || 0) ? maxWindKph : windKph;

  // Cloud cover classification
  const isTrulyOvercast  = isNum(cloudPct) && cloudPct >= 80;
  const isMostlyCloudy   = isNum(cloudPct) && cloudPct >= 55;
  const isPartlyCloudy   = isNum(cloudPct) && cloudPct >= 30 && cloudPct < 55;

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

  // 6. High UV — daytime only, not overcast
  if (isDay && isNum(uvIndex) && uvIndex >= 8 && !(isTrulyOvercast || overcastByDesc)) return 'uv';

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

  // 16. Moderate UV — daytime only, not mostly cloudy
  if (isDay && isNum(uvIndex) && uvIndex >= 6 && !(isMostlyCloudy || cloudyByDesc)) return 'uv';

  // 17. Mostly cloudy
  if (isMostlyCloudy || cloudyByDesc)         return 'cloudy';

  // 18. Partly cloudy / mainly clear / fair — treated as clear (nice day)
  if (isPartlyCloudy || partlyByDesc)         return 'clear';

  // 19. Clear by description (includes 'wind' to avoid 'Windy' desc falling to bottom)
  if (d.includes('clear') || d.includes('sunny') || d.includes('fair') || d.includes('wind')) return 'clear';

  // 20. Fallback
  return 'clear';
}

