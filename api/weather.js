// /api/weather.js
// Probably Weather – server-side weather aggregator
// Sources: Open-Meteo (no key), WeatherAPI (key), MET Norway (no key, User-Agent)

export default async function handler(req, res) {
  // CORS headers for native app (Capacitor makes cross-origin requests)
  const allowedOrigins = ['https://www.probablyweather.co.za', 'capacitor://localhost', 'http://localhost'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

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
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=12&addressdetails=1`,
          { headers: { 'User-Agent': MET_USER_AGENT } }
        );

        const addr = rev?.address || {};
        // Filter out ward labels and pure numbers
        const isBad = (s) => {
          const v = String(s || '').trim();
          return !v || /\bward\b/i.test(v) || /^\d+$/.test(v);
        };
        const pick = (...vals) => vals.find(v => !isBad(v)) || null;
        // Prefer most specific: suburb/town/village before city (metro names swallow small towns)
        const city = pick(addr.suburb, addr.neighbourhood, addr.town, addr.village, addr.city, addr.municipality);
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
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=12&addressdetails=1`,
          { headers: { 'User-Agent': MET_USER_AGENT } }
        );

        const addr = rev?.address || {};
        const isBadLabel = (s) => {
          const v = String(s || '').trim();
          return !v || /\bward\b/i.test(v) || /^\d+$/.test(v);
        };
        const pick = (...vals) => vals.find(v => !isBadLabel(v));
        // Prefer most specific: suburb/neighbourhood > town > village > city > municipality
        // This ensures small towns like Strand aren't swallowed by metro names like Cape Town
        const specific = pick(addr.suburb, addr.neighbourhood, addr.town, addr.village);
        const broad = pick(addr.city, addr.municipality, addr.state, addr.province);
        const country = addr.country;

        const parts = [];
        if (specific) {
          parts.push(specific);
        } else if (broad) {
          parts.push(broad);
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
        `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,relative_humidity_2m,cloud_cover` +
        `&hourly=temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,wind_direction_10m,cloud_cover,relative_humidity_2m` +
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
        windDir: om.current?.wind_direction_10m ?? null,
        humidity: om.current?.relative_humidity_2m ?? null,
        sunrise: om.daily?.sunrise?.[0] ?? null,
        sunset: om.daily?.sunset?.[0] ?? null,
      });

      // Determine current hour offset so hourly data starts from NOW, not midnight
      const omCurrentTime = om.current?.time || '';
      const omCurrentHour = omCurrentTime ? new Date(omCurrentTime).getHours() : new Date().getUTCHours();
      const omHourOffset = Math.max(0, Math.min(omCurrentHour, 167));

      hourlies.push({
        source: 'Open-Meteo',
        temps: om.hourly?.temperature_2m?.slice(omHourOffset, omHourOffset + 24) ?? [],
        feelsLikes: om.hourly?.apparent_temperature?.slice(omHourOffset, omHourOffset + 24) ?? [],
        rains: om.hourly?.precipitation_probability?.slice(omHourOffset, omHourOffset + 24) ?? [],
        winds: om.hourly?.wind_speed_10m?.slice(omHourOffset, omHourOffset + 24) ?? [],
        windDirs: om.hourly?.wind_direction_10m?.slice(omHourOffset, omHourOffset + 24) ?? [],
        clouds: om.hourly?.cloud_cover?.slice(omHourOffset, omHourOffset + 24) ?? [],
        humidity: om.hourly?.relative_humidity_2m?.slice(omHourOffset, omHourOffset + 24) ?? [],
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
          windDir: wa.current?.wind_degree ?? null,
          humidity: wa.current?.humidity ?? null,
          sunrise: astro.sunrise ?? null,
          sunset: astro.sunset ?? null,
        });

        // Combine today and tomorrow's hours, starting from current hour
        const waLocalTime = wa.location?.localtime || '';
        const waCurrentHour = waLocalTime ? new Date(waLocalTime).getHours() : new Date().getUTCHours();
        const todayHours = wa.forecast.forecastday[0]?.hour || [];
        const tomorrowHours = wa.forecast.forecastday[1]?.hour || [];
        const combinedHours = [...todayHours.slice(waCurrentHour), ...tomorrowHours].slice(0, 24);

        hourlies.push({
          source: 'WeatherAPI',
          temps: combinedHours.map(h => h.temp_c) ?? [],
          feelsLikes: combinedHours.map(h => h.feelslike_c) ?? [],
          rains: combinedHours.map(h => h.chance_of_rain) ?? [],
          winds: combinedHours.map(h => h.wind_kph) ?? [],
          windDirs: combinedHours.map(h => h.wind_degree) ?? [],
          clouds: combinedHours.map(h => h.cloud) ?? [],
          humidity: combinedHours.map(h => h.humidity) ?? [],
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
        windDir: series[0]?.data?.instant?.details?.wind_from_direction ?? null,
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
        windDirs: series.slice(0, 24).map(p => p.data?.instant?.details?.wind_from_direction ?? null),
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

    // ========== AGGREGATION (Weighted by source reliability) ==========

    // Aggregate hourly data using weighted averages
    const aggregatedHourly = Array.from({ length: 24 }, (_, i) => ({
      tempC: weightedAvg(hourlies.map(h => ({ source: h.source, value: h.temps[i] }))),
      feelsLikeC: weightedAvg(hourlies.map(h => ({ source: h.source, value: h.feelsLikes?.[i] }))),
      rainChance: weightedAvg(hourlies.map(h => ({ source: h.source, value: h.rains[i] })), RAIN_WEIGHTS),
      windKph: weightedAvg(hourlies.map(h => ({ source: h.source, value: h.winds[i] }))),
      windDir: median(hourlies.map(h => h.windDirs?.[i]).filter(isNum)), // Direction still uses median (angles are tricky to weight)
      cloudPct: weightedAvg(hourlies.map(h => ({ source: h.source, value: h.clouds?.[i] }))),
    }));

    // Aggregate daily data
    const aggregatedDaily = Array.from({ length: 7 }, (_, i) => {
      const sourceDescs = dailies.map(d => ({ source: d.source, desc: d.descs[i] })).filter(sd => sd.desc);
      const conditionLabel = pickBestCondition(sourceDescs);
      const highC = weightedAvg(dailies.map(d => ({ source: d.source, value: d.highs[i] })));
      const lowC = weightedAvg(dailies.map(d => ({ source: d.source, value: d.lows[i] })));
      const rainChance = weightedAvg(dailies.map(d => ({ source: d.source, value: d.rains[i] })), RAIN_WEIGHTS);
      const uv = weightedAvg(dailies.map(d => ({ source: d.source, value: d.uvs[i] })));
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
          tempC: highC, // Use high temp for daily condition
          windKph,
          uvIndex: uv,
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

    // Build "now" object from weighted average of all sources
    const medNowTemp = weightedAvg(norms.map(n => ({ source: n.source, value: n.nowTemp })));
    const medFeelsLike = weightedAvg(norms.map(n => ({ source: n.source, value: n.feelsLike })));
    const medWindKph = weightedAvg(norms.map(n => ({ source: n.source, value: n.windKph })));
    const medWindDir = median(norms.map(n => n.windDir).filter(isNum)); // Angles use median
    const medHumidity = weightedAvg(norms.map(n => ({ source: n.source, value: n.humidity })));
    const medUv = weightedAvg(norms.map(n => ({ source: n.source, value: n.todayUv })));
    const wind_kph = isNum(medWindKph) ? medWindKph : 0;
    const wind_dir = isNum(medWindDir) ? Math.round(medWindDir) : null;

    // SANITY CLAMP: Ensure today's high/low are consistent with current temp
    // Independent median calculations can produce impossible states (current > high)
    if (isNum(medNowTemp) && aggregatedDaily.length > 0) {
      if (isNum(aggregatedDaily[0].highC) && medNowTemp > aggregatedDaily[0].highC) {
        aggregatedDaily[0].highC = Math.round(medNowTemp * 10) / 10;
      }
      if (isNum(aggregatedDaily[0].lowC) && medNowTemp < aggregatedDaily[0].lowC) {
        aggregatedDaily[0].lowC = Math.round(medNowTemp * 10) / 10;
      }
    }

    // Get best condition description (with severe weather escalation)
    const mostDesc = pickBestCondition(norms.map(n => ({ source: n.source, desc: n.desc }))) || 'Weather today';

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
      wind_kph,
      wind_dir,
      now: {
        tempC: medNowTemp,
        feelsLikeC: finalFeelsLike,
        windKph: medWindKph,
        windDir: wind_dir,
        humidity: medHumidity,
        rainChance: aggregatedDaily[0]?.rainChance ?? null,
        uv: medUv,
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
          ...norms.map(n => ({ name: n.source, ok: true, weight: SOURCE_WEIGHTS[n.source] ?? 0, desc: n.desc })),
          ...failures.map(f => ({ name: f, ok: false, weight: SOURCE_WEIGHTS[f] ?? 0 })),
        ],
        sourceRanges: norms.map(n => ({
          name: n.source,
          minTemp: n.todayLow,
          maxTemp: n.todayHigh,
          rain: n.todayRain,
        })),
        aggregation: 'weighted', // so the frontend knows
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

// ========== SOURCE WEIGHTS ==========
// MET Norway (yr.no) is most accurate for Southern Africa precipitation & conditions.
// Open-Meteo (ECMWF) is strong on temperature, decent on precipitation.
// WeatherAPI is least precise for this region.
const SOURCE_WEIGHTS = {
  'MET Norway': 0.50,
  'Open-Meteo': 0.30,
  'WeatherAPI': 0.20,
};

// MET Norway is especially accurate for SA precipitation timing.
// Give it extra weight for rain to prevent stale/inaccurate sources inflating rain %.
const RAIN_WEIGHTS = {
  'MET Norway': 0.60,
  'Open-Meteo': 0.25,
  'WeatherAPI': 0.15,
};

/**
 * Weighted average using source reliability weights.
 * Takes an array of { source, value } objects and optional custom weights.
 * Falls back to simple average if no weights match.
 */
function weightedAvg(sourceValues, customWeights) {
  const valid = sourceValues.filter(sv => isNum(sv.value));
  if (valid.length === 0) return null;
  if (valid.length === 1) return valid[0].value;

  const weights = customWeights || SOURCE_WEIGHTS;
  let totalWeight = 0;
  let weightedSum = 0;
  for (const sv of valid) {
    const w = weights[sv.source] ?? (1 / valid.length);
    totalWeight += w;
    weightedSum += sv.value * w;
  }
  return totalWeight > 0 ? weightedSum / totalWeight : null;
}

/**
 * Pick best condition description with smart severe weather escalation.
 * Only escalates to storm if:
 *   - The most trusted source (MET Norway, weight >= 0.4) reports it, OR
 *   - Two or more sources independently report severe weather
 * Otherwise picks the highest-weighted source's description.
 */
function pickBestCondition(sourceDescs) {
  // sourceDescs = [{ source: 'Open-Meteo', desc: '...' }, ...]
  const valid = sourceDescs.filter(sd => sd.desc && sd.desc !== 'Unknown');
  if (valid.length === 0) return 'Unknown';

  const severeKeywords = ['thunder', 'storm', 'tornado', 'hurricane'];
  const severeSources = valid.filter(sd => {
    const d = sd.desc.toLowerCase();
    return severeKeywords.some(k => d.includes(k));
  });

  // ESCALATION: Only if a high-weight source (≥0.4) reports severe, or 2+ sources agree
  if (severeSources.length >= 2) {
    // Multiple sources confirm severe — trust it
    const ranked = severeSources.sort((a, b) =>
      (SOURCE_WEIGHTS[b.source] ?? 0) - (SOURCE_WEIGHTS[a.source] ?? 0)
    );
    return ranked[0].desc;
  }
  if (severeSources.length === 1) {
    const severeWeight = SOURCE_WEIGHTS[severeSources[0].source] ?? 0;
    if (severeWeight >= 0.4) {
      // Only MET Norway (0.50) clears this bar — trust it alone
      return severeSources[0].desc;
    }
    // A single low-weight source says storm? Ignore it, use normal ranking.
  }

  // Default: pick from the highest-weighted source
  const ranked = [...valid].sort((a, b) =>
    (SOURCE_WEIGHTS[b.source] ?? 0) - (SOURCE_WEIGHTS[a.source] ?? 0)
  );
  return ranked[0].desc;
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
function deriveCondition({ desc, rainChance, tempC, feelsLikeC, windKph, uvIndex }) {
  const d = String(desc || '').toLowerCase();

  // 1. STORM - Thunder always takes priority
  if (d.includes('thunder') || d.includes('storm')) {
    return 'storm';
  }

  // 2. EXTREME COLD - Freezing temperatures or severe wind chill
  // Check feels like first (wind chill), then actual temp
  if (isNum(feelsLikeC) && feelsLikeC <= -5) {
    return 'cold';
  }
  if (isNum(tempC) && tempC <= 0) {
    return 'cold';
  }

  // 3. SNOW/ICE - Winter precipitation (before rain check!)
  if (d.includes('snow') || d.includes('sleet') || d.includes('ice') || d.includes('hail') || d.includes('blizzard') || d.includes('freezing')) {
    return 'cold';
  }

  // 4. EXTREME HEAT - Very hot temperatures
  if (isNum(tempC) && tempC >= 35) {
    return 'heat';
  }
  if (isNum(feelsLikeC) && feelsLikeC >= 38) {
    return 'heat';
  }

  // 5. HEAVY RAIN - High rain probability
  if (isNum(rainChance) && rainChance >= 60) {
    return 'rain';
  }

  // 6. HIGH UV - Dangerous UV levels
  if (isNum(uvIndex) && uvIndex >= 8) {
    return 'uv';
  }

  // 7. STRONG WIND - Before light rain
  if (isNum(windKph) && windKph >= 35) {
    return 'wind';
  }

  // 8. MODERATE RAIN - Likely rain
  if (isNum(rainChance) && rainChance >= 30) {
    return 'rain';
  }

  // 9. RAIN from description (drizzle, showers, etc.)
  if (d.includes('rain') || d.includes('drizzle') || d.includes('shower') || d.includes('precip')) {
    return 'rain';
  }

  // 10. POSSIBLE RAIN - Low but non-zero chance
  if (isNum(rainChance) && rainChance > 10) {
    return 'rain-possible';
  }

  // 11. MODERATE WIND
  if (isNum(windKph) && windKph >= 25) {
    return 'wind';
  }

  // 12. FOG / LOW VISIBILITY
  if (d.includes('fog') || d.includes('mist') || d.includes('haze')) {
    return 'fog';
  }

  // 13. COLD (but not freezing) - Chilly day
  if (isNum(tempC) && tempC <= 10) {
    return 'cold';
  }

  // 14. HOT (but not extreme)
  if (isNum(tempC) && tempC >= 30) {
    return 'heat';
  }

  // 15. HIGH UV (moderate threshold)
  if (isNum(uvIndex) && uvIndex >= 6) {
    return 'uv';
  }

  // 16. CLOUDY
  if (d.includes('cloud') || d.includes('overcast')) {
    return 'cloudy';
  }

  // 17. CLEAR - Default for nice weather
  if (d.includes('clear') || d.includes('sunny') || d.includes('fair')) {
    return 'clear';
  }

  // 18. Fallback - if nothing matches, assume partly cloudy/clear
  return 'clear';
}
