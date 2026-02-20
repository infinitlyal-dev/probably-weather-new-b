// /api/weather.js
// Probably Weather – server-side weather aggregator
// Sources: Open-Meteo (ECMWF, no key), WeatherAPI (proprietary, key), Pirate Weather (NOAA GFS/GEFS, key)
// Weights:  50% Open-Meteo  |  35% WeatherAPI  |  15% Pirate Weather
// Pirate Weather provides genuine model independence (GFS/GEFS vs ECMWF) and
// proper ensemble-based rain probability (30-member GEFS) — unlike MET Norway
// which was a raw ECMWF re-serve with mm→% conversion.

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

    // ── Reverse geocode endpoint ─────────────────────────────────────────────
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

    // ── Resolve location name ────────────────────────────────────────────────
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

    // ── Source arrays (index = source slot: 0=Open-Meteo, 1=WeatherAPI, 2=Pirate Weather) ──
    // null in a slot means that source failed.
    const SOURCE_WEIGHTS = [0.50, 0.35, 0.15];
    const failures = [];
    const norms    = [null, null, null];
    const hourlies = [null, null, null];
    const dailies  = [null, null, null];

    // ── Description maps ─────────────────────────────────────────────────────
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

    // ── Open-Meteo — ECMWF IFS — weight 50% ─────────────────────────────────
    try {
      const om = await fetchJson(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m,cloud_cover` +
        `&hourly=temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,cloud_cover,relative_humidity_2m` +
        `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,weather_code,sunrise,sunset` +
        `&timezone=auto&forecast_days=7`
      );

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

    // ── WeatherAPI — proprietary/mixed — weight 35% ──────────────────────────
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

    // ── Pirate Weather — NOAA GFS/GEFS — weight 15% ─────────────────────────
    // Completely independent from ECMWF. GEFS 30-member ensemble gives *native*
    // rain probability — no mm→% conversion needed (unlike former MET Norway).
    // Sign up free at https://pirateweather.net · 20,000 calls/month free tier.
    if (PIRATE_WEATHER_KEY) {
      try {
        // units=si → °C, wind m/s, humidity 0-1 fraction, precip mm
        const pw = await fetchJson(
          `https://api.pirateweather.net/forecast/${PIRATE_WEATHER_KEY}/${lat},${lon}` +
          `?units=si&extend=hourly`
        );

        const cur  = pw.currently  || {};
        const hrly = pw.hourly?.data  || [];
        const dly  = pw.daily?.data   || [];

        const toKph  = v => isNum(v) ? Math.round(v * 3.6 * 10) / 10 : null;  // m/s → km/h
        const toPct  = v => isNum(v) ? Math.round(v * 100) : null;             // 0-1 → %
        const toIso  = v => isNum(v) ? new Date(v * 1000).toISOString() : null; // Unix → ISO

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
          todayRain: toPct(dly[0]?.precipProbability), // native GEFS ensemble ✓
          todayUv:   isNum(dly[0]?.uvIndex)          ? dly[0].uvIndex         : null,
          desc:      pwDesc(cur.icon),
          windKph:   curWindKph,
          humidity:  curHumPct,
          sunrise:   toIso(dly[0]?.sunriseTime),
          sunset:    toIso(dly[0]?.sunsetTime),
        };

        hourlies[2] = {
          source:     'Pirate Weather',
          temps:      hrly.slice(0, 24).map(h => isNum(h.temperature)         ? h.temperature         : null),
          feelsLikes: hrly.slice(0, 24).map(h => isNum(h.apparentTemperature) ? h.apparentTemperature : null),
          rains:      hrly.slice(0, 24).map(h => toPct(h.precipProbability)),
          winds:      hrly.slice(0, 24).map(h => toKph(h.windSpeed)),
          clouds:     hrly.slice(0, 24).map(h => toPct(h.cloudCover)),
          humidity:   hrly.slice(0, 24).map(h => toPct(h.humidity)),
        };

        dailies[2] = {
          source:   'Pirate Weather',
          highs:    dly.slice(0, 7).map(d => isNum(d.temperatureHigh) ? d.temperatureHigh : null),
          lows:     dly.slice(0, 7).map(d => isNum(d.temperatureLow)  ? d.temperatureLow  : null),
          rains:    dly.slice(0, 7).map(d => toPct(d.precipProbability)), // native GEFS ✓
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

    // ── AGGREGATION ──────────────────────────────────────────────────────────

    // Normalise weights for whichever sources actually returned data.
    function resolveWeights(arr) {
      const active = arr.map((item, i) => item !== null ? SOURCE_WEIGHTS[i] : 0);
      const total  = active.reduce((s, v) => s + v, 0);
      return total > 0 ? active.map(v => v / total) : active.map((v, i) => arr[i] !== null ? 1 / arr.filter(Boolean).length : 0);
    }

    const normW   = resolveWeights(norms);
    const hourlyW = resolveWeights(hourlies);
    const dailyW  = resolveWeights(dailies);

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

    // Hourly aggregation
    const aggregatedHourly = Array.from({ length: 24 }, (_, i) => {
      const hourWindVals = hourlies.map(h => h ? h.winds[i] : null).filter(isNum);
      const medWind = wAvg(hourlies, hourlyW, h => h.winds[i]);
      const maxWind = hourWindVals.length ? Math.max(...hourWindVals) : null;

      const effectiveHourlyWind = (isNum(medWind) && isNum(maxWind) && maxWind > medWind * 1.4)
        ? Math.round((medWind * 0.4 + maxWind * 0.6) * 10) / 10
        : medWind;

      return {
        tempC:      wAvg(hourlies, hourlyW, h => h.temps[i]),
        feelsLikeC: wAvg(hourlies, hourlyW, h => h.feelsLikes?.[i]),
        rainChance: wAvg(hourlies, hourlyW, h => h.rains[i]),
        windKph:    effectiveHourlyWind,
        cloudPct:   wAvg(hourlies, hourlyW, h => h.clouds?.[i]),
      };
    });

    // Daily aggregation
    const aggregatedDaily = Array.from({ length: 7 }, (_, i) => {
      const descs        = dailies.filter(Boolean).map(d => d.descs[i]).filter(Boolean);
      const conditionLabel = pickMostCommon(descs) || 'Unknown';
      const highC        = wAvg(dailies, dailyW, d => d.highs[i]);
      const lowC         = wAvg(dailies, dailyW, d => d.lows[i]);
      const rainChance   = wAvg(dailies, dailyW, d => d.rains[i]);
      const uv           = wAvg(dailies, dailyW, d => d.uvs[i]);
      const windKph      = aggregatedHourly[Math.min(i * 4 + 12, 23)]?.windKph ?? null;

      return {
        highC,
        lowC,
        rainChance,
        uv,
        conditionLabel,
        conditionKey: deriveCondition({
          desc:      conditionLabel,
          rainChance,
          tempC:     highC,
          windKph,
          uvIndex:   uv,
          cloudPct:  aggregatedHourly[Math.min(i * 4 + 12, 23)]?.cloudPct ?? null,
        }),
        sunrise: dailies.filter(Boolean).find(d => d.sunrises?.[i])?.sunrises[i] ?? null,
        sunset:  dailies.filter(Boolean).find(d => d.sunsets?.[i])?.sunsets[i]   ?? null,
      };
    });

    // ── CONFIDENCE ───────────────────────────────────────────────────────────
    // Based on agreement between the two principal sources (Open-Meteo and WeatherAPI).
    // These use fundamentally different model families, so their agreement is meaningful.
    // Pirate Weather (GFS) divergence is used as an additional uncertainty signal.
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

    // GFS (Pirate Weather) divergence check: independent cross-model signal
    let pirateWeatherAlert = null;
    if (isNum(omNorm?.nowTemp) && isNum(pwNorm?.nowTemp)) {
      if (Math.abs(omNorm.nowTemp - pwNorm.nowTemp) > 3) {
        pirateWeatherAlert = 'gfs_ecmwf_divergence';
        if (confidenceKey === 'strong') confidenceKey = 'decent'; // honest downgrade
      }
    }

    // ── "NOW" OBJECT ─────────────────────────────────────────────────────────
    const medNowTemp   = wAvg(norms, normW, n => n.nowTemp);
    const medFeelsLike = wAvg(norms, normW, n => n.feelsLike);
    const medWindKph   = wAvg(norms, normW, n => n.windKph);
    const maxWindKph   = Math.max(...norms.filter(Boolean).map(n => n.windKph).filter(isNum), 0);
    const medHumidity  = wAvg(norms, normW, n => n.humidity);
    const medUv        = wAvg(norms, normW, n => n.todayUv);

    const effectiveDisplayWind = (isNum(medWindKph) && isNum(maxWindKph) && maxWindKph > medWindKph * 1.4)
      ? Math.round((medWindKph * 0.4 + maxWindKph * 0.6) * 10) / 10
      : (medWindKph ?? 0);

    const currentCloudPct = aggregatedHourly[new Date().getHours()]?.cloudPct ?? null;
    const activeNorms     = norms.filter(Boolean);
    const mostDesc        = pickMostCommon(activeNorms.map(n => n.desc).filter(Boolean)) || 'Weather today';
    const finalFeelsLike  = isNum(medFeelsLike) ? medFeelsLike : calcFeelsLike(medNowTemp, medWindKph, medHumidity);

    const nowConditionKey = deriveCondition({
      desc:       mostDesc,
      rainChance: aggregatedDaily[0]?.rainChance ?? null,
      tempC:      medNowTemp,
      feelsLikeC: finalFeelsLike,
      windKph:    medWindKph,
      uvIndex:    medUv,
      cloudPct:   currentCloudPct,
      maxWindKph,
    });

    const sunrise = activeNorms.find(n => n.sunrise)?.sunrise ?? null;
    const sunset  = activeNorms.find(n => n.sunset)?.sunset   ?? null;

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
        rainChance:     aggregatedDaily[0]?.rainChance ?? null,
        uv:             medUv,
        cloudPct:       currentCloudPct,
        conditionKey:   nowConditionKey,
        conditionLabel: mostDesc,
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
          'Open-Meteo':     isNum(normW[0]) && norms[0] ? Math.round(normW[0] * 100) : null,
          'WeatherAPI':     isNum(normW[1]) && norms[1] ? Math.round(normW[1] * 100) : null,
          'Pirate Weather': isNum(normW[2]) && norms[2] ? Math.round(normW[2] * 100) : null,
        },
        updatedAtLabel: new Date().toISOString(),
      },
    });

  } catch (e) {
    console.error('Weather API error:', e);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
}

// ========== HELPER FUNCTIONS ==========

function isNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function pickMostCommon(arr) {
  if (arr.length === 0) return null;
  const count = arr.reduce((acc, v) => ({ ...acc, [v]: (acc[v] || 0) + 1 }), {});
  return Object.keys(count).reduce((a, b) => count[a] > count[b] ? a : b);
}

/**
 * Calculate "feels like" temperature using wind chill or heat index
 */
function calcFeelsLike(tempC, windKph, humidity) {
  if (!isNum(tempC)) return null;

  if (tempC <= 10 && isNum(windKph) && windKph > 4.8) {
    const windChill = 13.12 + 0.6215 * tempC
      - 11.37 * Math.pow(windKph, 0.16)
      + 0.3965 * tempC * Math.pow(windKph, 0.16);
    return Math.round(windChill * 10) / 10;
  }

  if (tempC >= 27 && isNum(humidity)) {
    const heatIndex = tempC + 0.33 * (humidity / 100 * 6.105 * Math.exp(17.27 * tempC / (237.7 + tempC))) - 4;
    return Math.round(heatIndex * 10) / 10;
  }

  return tempC;
}

/**
 * Derive weather condition key.
 * Priority: Storm > Extreme Cold > Snow > Extreme Heat > Heavy Rain > High UV
 *         > Strong Wind > Moderate Rain > Rain by desc > Moderate Wind
 *         > Overcast > Possible Rain > Fog > Cold > Hot > High UV (lower)
 *         > Mostly Cloudy > Partly Cloudy > Clear
 */
function deriveCondition({ desc, rainChance, tempC, feelsLikeC, windKph, uvIndex, cloudPct, maxWindKph }) {
  const d = String(desc || '').toLowerCase();
  const effectiveWind    = isNum(maxWindKph) && maxWindKph > (windKph || 0) ? maxWindKph : windKph;
  const isTrulyOvercast  = isNum(cloudPct) && cloudPct >= 80;
  const isMostlyCloudy   = isNum(cloudPct) && cloudPct >= 55;
  const isPartlyCloudy   = isNum(cloudPct) && cloudPct >= 30 && cloudPct < 55;
  const descSaysOvercast = d.includes('overcast');
  const descSaysPartly   = d.includes('partly') || d.includes('mainly clear') || d.includes('fair');
  const descSaysCloudy   = d.includes('cloud') && !descSaysPartly;
  const cloudyByDesc     = !isNum(cloudPct) && (descSaysOvercast || descSaysCloudy);
  const overcastByDesc   = !isNum(cloudPct) && descSaysOvercast;
  const partlyByDesc     = !isNum(cloudPct) && descSaysPartly;

  if (d.includes('thunder') || d.includes('storm') || d.includes('tornado')) return 'storm';
  if (isNum(feelsLikeC) && feelsLikeC <= -5)  return 'cold';
  if (isNum(tempC) && tempC <= 0)              return 'cold';
  if (d.includes('snow') || d.includes('sleet') || d.includes('ice') || d.includes('hail') || d.includes('blizzard') || d.includes('freezing')) return 'cold';
  if (isNum(tempC) && tempC >= 35)             return 'heat';
  if (isNum(feelsLikeC) && feelsLikeC >= 38)  return 'heat';
  if (isNum(rainChance) && rainChance >= 60)   return 'rain';
  if (isNum(uvIndex) && uvIndex >= 8 && !(isTrulyOvercast || overcastByDesc)) return 'uv';
  if (isNum(effectiveWind) && effectiveWind >= 30) return 'wind';
  if (isNum(rainChance) && rainChance >= 30)   return 'rain';
  if (d.includes('rain') || d.includes('drizzle') || d.includes('shower') || d.includes('precip')) return 'rain';
  if (isNum(effectiveWind) && effectiveWind >= 25) return 'wind';
  if (isTrulyOvercast || overcastByDesc)       return 'cloudy';
  if (isNum(rainChance) && rainChance >= 20)   return 'rain-possible';
  if (d.includes('fog') || d.includes('mist') || d.includes('haze')) return 'fog';
  if (isNum(tempC) && tempC <= 10)             return 'cold';
  if (isNum(tempC) && tempC >= 30)             return 'heat';
  if (isNum(uvIndex) && uvIndex >= 6 && !(isMostlyCloudy || cloudyByDesc)) return 'uv';
  if (isMostlyCloudy || cloudyByDesc)          return 'cloudy';
  if (isPartlyCloudy || partlyByDesc)          return 'clear';
  if (d.includes('clear') || d.includes('sunny') || d.includes('fair') || d.includes('wind')) return 'clear';
  return 'clear';
}
