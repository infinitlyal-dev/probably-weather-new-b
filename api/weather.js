// /api/weather.js
// Probably Weather – server-side weather aggregator
// Sources: Open-Meteo (no key), WeatherAPI (key), MET Norway (no key, User-Agent)

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

    const WEATHERAPI_KEY = process.env.WEATHERAPI_KEY || null;
    const MET_USER_AGENT = process.env.MET_USER_AGENT || 'ProbablyWeather/1.0 (contact: you@example.com)';

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
          { headers: { 'User-Agent': MET_USER_AGENT } }
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
          { headers: { 'User-Agent': MET_USER_AGENT } }
        );

        const addr = rev?.address || {};
        const isBadLabel = (s) => {
          const v = String(s || '').trim();
          return !v || /\bward\b/i.test(v) || /^\d+$/.test(v);
        };
        const pick = (...vals) => vals.find(v => !isBadLabel(v));
        const primary = pick(addr.town, addr.city, addr.village);
        const cityTown = pick(addr.suburb, addr.neighbourhood);
        const secondary = pick(addr.municipality, addr.state, addr.province);
        const country = addr.country;

        const parts = [];
        if (primary) {
          parts.push(primary);
        } else if (cityTown) {
          parts.push(cityTown);
        } else if (secondary) {
          parts.push(secondary);
        } else if (country) {
          parts.push(country);
        }
        if (country && parts[parts.length - 1] !== country) parts.push(country);

        if (parts.length) resolvedName = parts.join(', ');
      } catch {
        // Keep fallback name if reverse geocode fails
      }
    }

    const failures = [];
    const norms = [];
    const hourlies = [];
    const dailies = [];

    // Weather description mappings
    const openMeteoCodeMap = {
      0: 'Clear sky',
      1: 'Mainly clear',
      2: 'Partly cloudy',
      3: 'Overcast',
      45: 'Fog',
      48: 'Depositing rime fog',
      51: 'Light drizzle',
      53: 'Moderate drizzle',
      55: 'Dense drizzle',
      56: 'Light freezing drizzle',
      57: 'Dense freezing drizzle',
      61: 'Slight rain',
      63: 'Moderate rain',
      65: 'Heavy rain',
      66: 'Light freezing rain',
      67: 'Heavy freezing rain',
      71: 'Slight snow fall',
      73: 'Moderate snow fall',
      75: 'Heavy snow fall',
      77: 'Snow grains',
      80: 'Slight rain showers',
      81: 'Moderate rain showers',
      82: 'Violent rain showers',
      85: 'Slight snow showers',
      86: 'Heavy snow showers',
      95: 'Thunderstorm',
      96: 'Thunderstorm with slight hail',
      99: 'Thunderstorm with heavy hail',
    };

    const metSymbolMap = {
      'clearsky': 'Clear sky',
      'fair': 'Fair',
      'partlycloudy': 'Partly cloudy',
      'cloudy': 'Cloudy',
      'lightrainshowers': 'Light rain showers',
      'rainshowers': 'Rain showers',
      'heavyrainshowers': 'Heavy rain showers',
      'lightrain': 'Light rain',
      'rain': 'Rain',
      'heavyrain': 'Heavy rain',
      'lightsnowshowers': 'Light snow showers',
      'snowshowers': 'Snow showers',
      'heavysnowshowers': 'Heavy snow showers',
      'lightsnow': 'Light snow',
      'snow': 'Snow',
      'heavysnow': 'Heavy snow',
      'lightrainandthunder': 'Light rain and thunder',
      'rainandthunder': 'Rain and thunder',
      'heavyrainandthunder': 'Heavy rain and thunder',
      'lightsnowandthunder': 'Light snow and thunder',
      'snowandthunder': 'Snow and thunder',
      'heavysnowandthunder': 'Heavy snow and thunder',
      'fog': 'Fog',
      'sleet': 'Sleet',
      'lightsleet': 'Light sleet',
      'heavysleet': 'Heavy sleet',
      'sleetandthunder': 'Sleet and thunder',
    };

    // ---------- Open-Meteo ----------
    try {
      const om = await fetchJson(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m,cloud_cover` +
        `&hourly=temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,cloud_cover,relative_humidity_2m` +
        `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,weather_code,sunrise,sunset` +
        `&timezone=auto&forecast_days=7`
      );

      norms.push({
        source: 'Open-Meteo',
        nowTemp: om.current?.temperature_2m ?? null,
        feelsLike: om.current?.apparent_temperature ?? null,
        todayHigh: om.daily?.temperature_2m_max?.[0] ?? null,
        todayLow: om.daily?.temperature_2m_min?.[0] ?? null,
        todayRain: om.daily?.precipitation_probability_max?.[0] ?? null,
        todayUv: om.daily?.uv_index_max?.[0] ?? null,
        desc: openMeteoCodeMap[om.current?.weather_code] ?? 'Unknown',
        windKph: om.current?.wind_speed_10m ?? null,
        humidity: om.current?.relative_humidity_2m ?? null,
        sunrise: om.daily?.sunrise?.[0] ?? null,
        sunset: om.daily?.sunset?.[0] ?? null,
      });

      hourlies.push({
        source: 'Open-Meteo',
        temps: om.hourly?.temperature_2m?.slice(0, 24) ?? [],
        feelsLikes: om.hourly?.apparent_temperature?.slice(0, 24) ?? [],
        rains: om.hourly?.precipitation_probability?.slice(0, 24) ?? [],
        winds: om.hourly?.wind_speed_10m?.slice(0, 24) ?? [],
        clouds: om.hourly?.cloud_cover?.slice(0, 24) ?? [],
        humidity: om.hourly?.relative_humidity_2m?.slice(0, 24) ?? [],
      });

      dailies.push({
        source: 'Open-Meteo',
        highs: om.daily?.temperature_2m_max ?? [],
        lows: om.daily?.temperature_2m_min ?? [],
        rains: om.daily?.precipitation_probability_max ?? [],
        uvs: om.daily?.uv_index_max ?? [],
        descs: om.daily?.weather_code?.map(code => openMeteoCodeMap[code] ?? 'Unknown') ?? [],
        sunrises: om.daily?.sunrise ?? [],
        sunsets: om.daily?.sunset ?? [],
      });
    } catch {
      failures.push('Open-Meteo');
    }

    // ---------- WeatherAPI ----------
    if (WEATHERAPI_KEY) {
      try {
        const wa = await fetchJson(
          `https://api.weatherapi.com/v1/forecast.json?key=${WEATHERAPI_KEY}` +
          `&q=${lat},${lon}&days=7&aqi=no&alerts=no`
        );

        const d = wa.forecast?.forecastday?.[0]?.day || {};
        const astro = wa.forecast?.forecastday?.[0]?.astro || {};

        norms.push({
          source: 'WeatherAPI',
          nowTemp: wa.current?.temp_c ?? null,
          feelsLike: wa.current?.feelslike_c ?? null,
          todayHigh: d.maxtemp_c ?? null,
          todayLow: d.mintemp_c ?? null,
          todayRain: d.daily_chance_of_rain ?? null,
          todayUv: d.uv ?? null,
          desc: wa.current?.condition?.text ?? 'Unknown',
          windKph: wa.current?.wind_kph ?? null,
          humidity: wa.current?.humidity ?? null,
          sunrise: astro.sunrise ?? null,
          sunset: astro.sunset ?? null,
        });

        hourlies.push({
          source: 'WeatherAPI',
          temps: wa.forecast.forecastday[0].hour.map(h => h.temp_c) ?? [],
          feelsLikes: wa.forecast.forecastday[0].hour.map(h => h.feelslike_c) ?? [],
          rains: wa.forecast.forecastday[0].hour.map(h => h.chance_of_rain) ?? [],
          winds: wa.forecast.forecastday[0].hour.map(h => h.wind_kph) ?? [],
          clouds: wa.forecast.forecastday[0].hour.map(h => h.cloud) ?? [],
          humidity: wa.forecast.forecastday[0].hour.map(h => h.humidity) ?? [],
        });

        dailies.push({
          source: 'WeatherAPI',
          highs: wa.forecast.forecastday.map(fd => fd.day.maxtemp_c) ?? [],
          lows: wa.forecast.forecastday.map(fd => fd.day.mintemp_c) ?? [],
          rains: wa.forecast.forecastday.map(fd => fd.day.daily_chance_of_rain) ?? [],
          uvs: wa.forecast.forecastday.map(fd => fd.day.uv) ?? [],
          descs: wa.forecast.forecastday.map(fd => fd.day.condition.text) ?? [],
          sunrises: wa.forecast.forecastday.map(fd => fd.astro?.sunrise) ?? [],
          sunsets: wa.forecast.forecastday.map(fd => fd.astro?.sunset) ?? [],
        });
      } catch {
        failures.push('WeatherAPI');
      }
    } else {
      failures.push('WeatherAPI');
    }

    // ---------- MET Norway ----------
    try {
      const met = await fetchJson(
        `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`,
        { headers: { 'User-Agent': MET_USER_AGENT } }
      );

      const series = met.properties?.timeseries || [];
      const temps = series.slice(0, 24).map(p => p.data?.instant?.details?.air_temperature).filter(v => typeof v === 'number');
      const winds = series.slice(0, 24).map(p => p.data?.instant?.details?.wind_speed).filter(v => typeof v === 'number');
      const humidity = series[0]?.data?.instant?.details?.relative_humidity ?? null;

      // Better rain chance calculation for MET Norway
      // Check precipitation amounts and convert to probability estimate
      const precipAmounts = series.slice(0, 24).map(p => 
        p.data?.next_1_hours?.details?.precipitation_amount ?? 
        p.data?.next_6_hours?.details?.precipitation_amount ?? 0
      );
      const maxPrecip = Math.max(...precipAmounts, 0);
      // Convert mm to rough probability: 0mm=0%, 0.5mm=30%, 1mm=50%, 2mm=70%, 5mm+=90%
      const rainProxy = maxPrecip === 0 ? 0 : 
                        maxPrecip < 0.5 ? 20 :
                        maxPrecip < 1 ? 40 :
                        maxPrecip < 2 ? 60 :
                        maxPrecip < 5 ? 80 : 95;

      const symbolCode = series[0]?.data?.next_1_hours?.summary?.symbol_code?.replace(/_(day|night|polartwilight)$/, '') ?? null;
      const desc = metSymbolMap[symbolCode] ?? symbolCode ?? 'Unknown';
      const windKph = isNum(winds[0]) ? winds[0] * 3.6 : null; // m/s to km/h

      // Calculate feels like using wind chill if cold
      const nowTemp = temps[0] ?? null;
      const feelsLike = calcFeelsLike(nowTemp, windKph, humidity);

      norms.push({
        source: 'MET Norway',
        nowTemp,
        feelsLike,
        todayHigh: temps.length ? Math.max(...temps) : null,
        todayLow: temps.length ? Math.min(...temps) : null,
        todayRain: rainProxy,
        todayUv: null, // MET doesn't provide UV
        desc,
        windKph,
        humidity,
        sunrise: null,
        sunset: null,
      });

      hourlies.push({
        source: 'MET Norway',
        temps: series.slice(0, 24).map(p => p.data?.instant?.details?.air_temperature ?? null),
        feelsLikes: series.slice(0, 24).map(p => {
          const t = p.data?.instant?.details?.air_temperature;
          const w = p.data?.instant?.details?.wind_speed ? p.data.instant.details.wind_speed * 3.6 : null;
          const h = p.data?.instant?.details?.relative_humidity;
          return calcFeelsLike(t, w, h);
        }),
        rains: series.slice(0, 24).map(p => {
          const precip = p.data?.next_1_hours?.details?.precipitation_amount ?? 0;
          return precip === 0 ? 0 : precip < 0.5 ? 20 : precip < 1 ? 40 : precip < 2 ? 60 : 80;
        }),
        winds: series.slice(0, 24).map(p => {
          const w = p.data?.instant?.details?.wind_speed;
          return isNum(w) ? w * 3.6 : null;
        }),
        clouds: series.slice(0, 24).map(p => p.data?.instant?.details?.cloud_area_fraction ?? null),
        humidity: series.slice(0, 24).map(p => p.data?.instant?.details?.relative_humidity ?? null),
      });

      // MET only gives detailed data for ~2 days, so daily is limited
      dailies.push({
        source: 'MET Norway',
        highs: [temps.length ? Math.max(...temps) : null],
        lows: [temps.length ? Math.min(...temps) : null],
        rains: [rainProxy],
        uvs: [],
        descs: [desc],
        sunrises: [],
        sunsets: [],
      });
    } catch {
      failures.push('MET Norway');
    }

    // ========== AGGREGATION ==========

    // Aggregate hourly data
    const aggregatedHourly = Array.from({ length: 24 }, (_, i) => {
      const hourWinds = hourlies.map(h => h.winds[i]).filter(isNum);
      const medWind = median(hourWinds);
      const maxWind = hourWinds.length ? Math.max(...hourWinds) : null;
      // Use effective wind when sources disagree significantly
      const effectiveHourlyWind = (isNum(medWind) && isNum(maxWind) && maxWind > medWind * 1.4)
        ? Math.round((medWind * 0.4 + maxWind * 0.6) * 10) / 10
        : medWind;
      return {
        tempC: median(hourlies.map(h => h.temps[i]).filter(isNum)),
        feelsLikeC: median(hourlies.map(h => h.feelsLikes?.[i]).filter(isNum)),
        rainChance: median(hourlies.map(h => h.rains[i]).filter(isNum)),
        windKph: effectiveHourlyWind,
        cloudPct: median(hourlies.map(h => h.clouds?.[i]).filter(isNum)),
      };
    });

    // Aggregate daily data
    const aggregatedDaily = Array.from({ length: 7 }, (_, i) => {
      const descs = dailies.map(d => d.descs[i]).filter(Boolean);
      const conditionLabel = pickMostCommon(descs) || 'Unknown';
      const highC = median(dailies.map(d => d.highs[i]).filter(isNum));
      const lowC = median(dailies.map(d => d.lows[i]).filter(isNum));
      const rainChance = median(dailies.map(d => d.rains[i]).filter(isNum));
      const uv = median(dailies.map(d => d.uvs[i]).filter(isNum));
      const windKph = aggregatedHourly[Math.min(i * 4 + 12, 23)]?.windKph ?? null; // Midday wind estimate

      return {
        highC,
        lowC,
        rainChance,
        uv,
        conditionLabel,
        conditionKey: deriveCondition({
          desc: conditionLabel,
          rainChance,
          tempC: highC,
          windKph,
          uvIndex: uv,
          cloudPct: aggregatedHourly[Math.min(i * 4 + 12, 23)]?.cloudPct ?? null,
        }),
        sunrise: dailies.find(d => d.sunrises?.[i])?.sunrises[i] ?? null,
        sunset: dailies.find(d => d.sunsets?.[i])?.sunsets[i] ?? null,
      };
    });

    // Compute consensus confidence
    const temps = norms.map(n => n.nowTemp).filter(isNum);
    let confidenceKey = 'mixed';
    if (temps.length >= 2) {
      const spread = Math.max(...temps) - Math.min(...temps);
      if (spread <= 1.5) confidenceKey = 'strong';
      else if (spread <= 3.5) confidenceKey = 'decent';
    } else if (temps.length === 1) {
      confidenceKey = 'decent';
    }

    // Build "now" object from median of all sources
    const medNowTemp = median(norms.map(n => n.nowTemp).filter(isNum));
    const medFeelsLike = median(norms.map(n => n.feelsLike).filter(isNum));
    const medWindKph = median(norms.map(n => n.windKph).filter(isNum));
    const maxWindKph = Math.max(...norms.map(n => n.windKph).filter(isNum), 0);
    const medHumidity = median(norms.map(n => n.humidity).filter(isNum));
    const medUv = median(norms.map(n => n.todayUv).filter(isNum));
    const wind_kph = isNum(medWindKph) ? medWindKph : 0;
    // When sources disagree significantly about wind, use a weighted effective wind
    // This prevents showing 22 km/h when one source correctly reports 43 km/h
    const effectiveDisplayWind = (isNum(medWindKph) && isNum(maxWindKph) && maxWindKph > medWindKph * 1.4) 
      ? Math.round((medWindKph * 0.4 + maxWindKph * 0.6) * 10) / 10  // Weight toward max when big disagreement
      : wind_kph;

    // Get current hour's cloud cover from hourly data
    const currentCloudPct = aggregatedHourly[new Date().getHours()]?.cloudPct ?? null;

    // Get most common description
    const mostDesc = pickMostCommon(norms.map(n => n.desc).filter(Boolean)) || 'Weather today';

    // Calculate feels like if we don't have it from sources
    const finalFeelsLike = isNum(medFeelsLike) ? medFeelsLike : calcFeelsLike(medNowTemp, medWindKph, medHumidity);

    // Derive condition using ALL available data
    const nowConditionKey = deriveCondition({
      desc: mostDesc,
      rainChance: aggregatedDaily[0]?.rainChance ?? null,
      tempC: medNowTemp,
      feelsLikeC: finalFeelsLike,
      windKph: medWindKph,
      uvIndex: medUv,
      cloudPct: currentCloudPct,
      maxWindKph: maxWindKph,
    });

    // Get sunrise/sunset from first available source
    const sunrise = norms.find(n => n.sunrise)?.sunrise ?? null;
    const sunset = norms.find(n => n.sunset)?.sunset ?? null;

    return res.status(200).json({
      ok: true,
      location: {
        name: resolvedName || name || 'Unknown',
        lat,
        lon,
      },
      wind_kph: effectiveDisplayWind,
      maxWindKph: maxWindKph > 0 ? maxWindKph : null,
      now: {
        tempC: medNowTemp,
        feelsLikeC: finalFeelsLike,
        windKph: effectiveDisplayWind,
        humidity: medHumidity,
        rainChance: aggregatedDaily[0]?.rainChance ?? null,
        uv: medUv,
        cloudPct: currentCloudPct,
        conditionKey: nowConditionKey,
        conditionLabel: mostDesc,
        sunrise,
        sunset,
      },
      consensus: {
        confidenceKey,
      },
      daily: aggregatedDaily,
      hourly: aggregatedHourly,
      meta: {
        sources: [
          ...norms.map(n => ({ name: n.source, ok: true })),
          ...failures.map(f => ({ name: f, ok: false })),
        ],
        sourceRanges: norms.map(n => ({
          name: n.source,
          minTemp: n.todayLow,
          maxTemp: n.todayHigh,
        })),
        updatedAtLabel: new Date().toISOString(),
      },
    });

  } catch (e) {
    console.error('Weather API error:', e);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
}

// ========== HELPER FUNCTIONS ==========

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const half = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[half] : (sorted[half - 1] + sorted[half]) / 2.0;
}

function pickMostCommon(arr) {
  if (arr.length === 0) return null;
  const count = arr.reduce((acc, v) => ({ ...acc, [v]: (acc[v] || 0) + 1 }), {});
  return Object.keys(count).reduce((a, b) => count[a] > count[b] ? a : b);
}

function isNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Calculate "feels like" temperature using wind chill or heat index
 * @param {number} tempC - Temperature in Celsius
 * @param {number} windKph - Wind speed in km/h
 * @param {number} humidity - Relative humidity percentage
 * @returns {number|null} - Feels like temperature in Celsius
 */
function calcFeelsLike(tempC, windKph, humidity) {
  if (!isNum(tempC)) return null;

  // Wind chill (for cold temperatures with wind)
  // Valid for temps <= 10°C and wind > 4.8 km/h
  if (tempC <= 10 && isNum(windKph) && windKph > 4.8) {
    const windChill = 13.12 + 0.6215 * tempC - 11.37 * Math.pow(windKph, 0.16) + 0.3965 * tempC * Math.pow(windKph, 0.16);
    return Math.round(windChill * 10) / 10;
  }

  // Heat index (for hot temperatures with humidity)
  // Valid for temps >= 27°C
  if (tempC >= 27 && isNum(humidity)) {
    // Simplified heat index formula
    const heatIndex = tempC + 0.33 * (humidity / 100 * 6.105 * Math.exp(17.27 * tempC / (237.7 + tempC))) - 4;
    return Math.round(heatIndex * 10) / 10;
  }

  // No adjustment needed
  return tempC;
}

/**
 * Derive weather condition key with PROPER PRIORITY
 * Priority: Storm > Extreme Cold > Snow > Extreme Heat > Heavy Rain > High UV > Wind > Rain > Fog > Cloudy > Clear
 * 
 * @param {Object} params
 * @param {string} params.desc - Weather description text
 * @param {number} params.rainChance - Rain probability percentage
 * @param {number} params.tempC - Current/high temperature
 * @param {number} params.feelsLikeC - Feels like temperature
 * @param {number} params.windKph - Wind speed in km/h
 * @param {number} params.uvIndex - UV index
 * @returns {string} - Condition key for UI display
 */
function deriveCondition({ desc, rainChance, tempC, feelsLikeC, windKph, uvIndex, cloudPct, maxWindKph }) {
  const d = String(desc || '').toLowerCase();
  // Use max wind if available (captures real gusty conditions that median smooths away)
  const effectiveWind = isNum(maxWindKph) && maxWindKph > (windKph || 0) ? maxWindKph : windKph;
  // Determine actual cloud state from percentage (more reliable than text)
  const isTrulyOvercast = isNum(cloudPct) && cloudPct >= 80;
  const isMostlyCloudy = isNum(cloudPct) && cloudPct >= 55;
  const isPartlyCloudy = isNum(cloudPct) && cloudPct >= 30 && cloudPct < 55;
  // If we don't have cloudPct, fall back to description - but distinguish "partly cloudy" from "cloudy/overcast"
  const descSaysOvercast = d.includes('overcast');
  const descSaysPartly = d.includes('partly') || d.includes('mainly clear') || d.includes('fair');
  const descSaysCloudy = d.includes('cloud') && !descSaysPartly;  // "Cloudy" but NOT "Partly cloudy"
  const cloudyByDesc = !isNum(cloudPct) && (descSaysOvercast || descSaysCloudy);
  const overcastByDesc = !isNum(cloudPct) && descSaysOvercast;
  const partlyByDesc = !isNum(cloudPct) && descSaysPartly;

  // 1. STORM - Thunder always takes priority
  if (d.includes('thunder') || d.includes('storm')) {
    return 'storm';
  }

  // 2. EXTREME COLD - Freezing temperatures or severe wind chill
  if (isNum(feelsLikeC) && feelsLikeC <= -5) return 'cold';
  if (isNum(tempC) && tempC <= 0) return 'cold';

  // 3. SNOW/ICE - Winter precipitation
  if (d.includes('snow') || d.includes('sleet') || d.includes('ice') || d.includes('hail') || d.includes('blizzard') || d.includes('freezing')) {
    return 'cold';
  }

  // 4. EXTREME HEAT
  if (isNum(tempC) && tempC >= 35) return 'heat';
  if (isNum(feelsLikeC) && feelsLikeC >= 38) return 'heat';

  // 5. HEAVY RAIN - High rain probability
  if (isNum(rainChance) && rainChance >= 60) return 'rain';

  // 6. HIGH UV - Only if sky is actually clear enough for UV to matter
  if (isNum(uvIndex) && uvIndex >= 8) {
    if (!(isTrulyOvercast || overcastByDesc)) return 'uv';
  }

  // 7. STRONG WIND - Wind is the dominant weather feature (30+ km/h)
  if (isNum(effectiveWind) && effectiveWind >= 30) {
    return 'wind';
  }

  // 8. MODERATE RAIN - Likely rain
  if (isNum(rainChance) && rainChance >= 30) return 'rain';

  // 9. RAIN from description
  if (d.includes('rain') || d.includes('drizzle') || d.includes('shower') || d.includes('precip')) {
    return 'rain';
  }

  // 10. MODERATE WIND - Noticeable wind (25+ km/h, ~force 4-5)
  if (isNum(effectiveWind) && effectiveWind >= 25) {
    return 'wind';
  }

  // 11. OVERCAST - Genuinely grey skies (80%+ cloud) BEFORE rain-possible
  //     A 15% rain chance on an overcast day should show cloudy, not rain-possible
  if (isTrulyOvercast || overcastByDesc) {
    return 'cloudy';
  }

  // 12. POSSIBLE RAIN - Meaningful chance but not certain (raised from 10% to 20%)
  //     Below 20% is just API noise, not worth showing rain imagery
  if (isNum(rainChance) && rainChance >= 20) return 'rain-possible';

  // 13. FOG / LOW VISIBILITY
  if (d.includes('fog') || d.includes('mist') || d.includes('haze')) return 'fog';

  // 14. COLD (but not freezing)
  if (isNum(tempC) && tempC <= 10) return 'cold';

  // 15. HOT (but not extreme)
  if (isNum(tempC) && tempC >= 30) return 'heat';

  // 16. HIGH UV (moderate threshold) - still cloud-gated
  if (isNum(uvIndex) && uvIndex >= 6) {
    if (!(isMostlyCloudy || cloudyByDesc)) return 'uv';
  }

  // 17. MOSTLY CLOUDY (55-80% cloud cover)
  if (isMostlyCloudy || cloudyByDesc) {
    return 'cloudy';
  }

  // 18. PARTLY CLOUDY (30-55% cloud) or "partly cloudy" description
  //     This is nice weather with some clouds - treated as CLEAR
  if (isPartlyCloudy || partlyByDesc) {
    return 'clear';
  }

  // 19. CLEAR
  if (d.includes('clear') || d.includes('sunny') || d.includes('fair')) {
    return 'clear';
  }

  // 20. Fallback
  return 'clear';
}
