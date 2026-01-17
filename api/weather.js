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
        'fog': 'Fog',
        'sleet': 'Sleet',
        'lightsleet': 'Light sleet',
        'heavysleet': 'Heavy sleet',
      };
  
      // ---------- Open-Meteo ----------
      try {
        const om = await fetchJson(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
          `&current=temperature_2m,weather_code,wind_speed_10m` +
          `&hourly=temperature_2m,precipitation_probability,wind_speed_10m` +
          `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,weather_code` +
          `&timezone=auto&forecast_days=7`
        );
  
        norms.push({
          source: 'Open-Meteo',
          nowTemp: om.current?.temperature_2m ?? null,
          todayHigh: om.daily?.temperature_2m_max?.[0] ?? null,
          todayLow: om.daily?.temperature_2m_min?.[0] ?? null,
          todayRain: om.daily?.precipitation_probability_max?.[0] ?? null,
          todayUv: om.daily?.uv_index_max?.[0] ?? null,
          desc: openMeteoCodeMap[om.current?.weather_code] ?? 'Unknown',
          windKph: om.current?.wind_speed_10m ?? null, // km/h
        });
  
        hourlies.push({
          source: 'Open-Meteo',
          temps: om.hourly?.temperature_2m.slice(0, 24) ?? [],
          rains: om.hourly?.precipitation_probability.slice(0, 24) ?? [],
          winds: om.hourly?.wind_speed_10m.slice(0, 24) ?? [],
        });
  
        dailies.push({
          source: 'Open-Meteo',
          highs: om.daily?.temperature_2m_max ?? [],
          lows: om.daily?.temperature_2m_min ?? [],
          rains: om.daily?.precipitation_probability_max ?? [],
          uvs: om.daily?.uv_index_max ?? [],
          descs: om.daily?.weather_code.map(code => openMeteoCodeMap[code] ?? 'Unknown') ?? [],
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
          norms.push({
            source: 'WeatherAPI',
            nowTemp: wa.current?.temp_c ?? null,
            todayHigh: d.maxtemp_c ?? null,
            todayLow: d.mintemp_c ?? null,
            todayRain: d.daily_chance_of_rain ?? null,
            todayUv: d.uv ?? null,
            desc: wa.current?.condition?.text ?? 'Unknown',
            windKph: wa.current?.wind_kph ?? null, // km/h
          });
  
          hourlies.push({
            source: 'WeatherAPI',
            temps: wa.forecast.forecastday[0].hour.map(h => h.temp_c) ?? [],
            rains: wa.forecast.forecastday[0].hour.map(h => h.chance_of_rain) ?? [],
            winds: wa.forecast.forecastday[0].hour.map(h => h.wind_kph) ?? [],
          });
  
          dailies.push({
            source: 'WeatherAPI',
            highs: wa.forecast.forecastday.map(fd => fd.day.maxtemp_c) ?? [],
            lows: wa.forecast.forecastday.map(fd => fd.day.mintemp_c) ?? [],
            rains: wa.forecast.forecastday.map(fd => fd.day.daily_chance_of_rain) ?? [],
            uvs: wa.forecast.forecastday.map(fd => fd.day.uv) ?? [],
            descs: wa.forecast.forecastday.map(fd => fd.day.condition.text) ?? [],
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
        const temps = series.map(p => p.data?.instant?.details?.air_temperature).filter(v => typeof v === 'number');
        const rainAmounts = series.map(p => p.data?.next_1_hours?.details?.precipitation_amount).filter(v => typeof v === 'number');
        const rainProxy = rainAmounts.length === 0 ? null : Math.min(100, Math.round(Math.max(...rainAmounts) * 40));
        const symbolCode = series[0]?.data?.next_1_hours?.summary?.symbol_code?.replace(/_(day|night|polartwilight)$/, '') ?? null;
        const desc = metSymbolMap[symbolCode] ?? 'Unknown';
        const wind = series[0]?.data?.instant?.details?.wind_speed * 3.6 ?? null; // m/s to km/h
  
        norms.push({
          source: 'MET Norway',
          nowTemp: temps[0] ?? null,
          todayHigh: temps.length ? Math.max(...temps) : null,
          todayLow: temps.length ? Math.min(...temps) : null,
          todayRain: rainProxy,
          todayUv: null,
          desc,
          windKph: wind,
        });
  
        hourlies.push({
          source: 'MET Norway',
          temps: temps.slice(0, 24),
          rains: series.slice(0, 24).map(p => (p.data?.next_1_hours?.details?.precipitation_amount ?? 0) * 40),
          winds: series.slice(0, 24).map(p => p.data?.instant?.details?.wind_speed * 3.6 ?? null),
        });
  
        dailies.push({
          source: 'MET Norway',
          highs: [Math.max(...temps)],
          lows: [Math.min(...temps)],
          rains: [rainProxy],
          uvs: [],
          descs: [desc],
        });
      } catch {
        failures.push('MET Norway');
      }
  
      // Aggregate
      const aggregatedHourly = Array.from({length: 24}, (_, i) => ({
        tempC: median(hourlies.map(h => h.temps[i]).filter(isNum)),
        rainChance: median(hourlies.map(h => h.rains[i]).filter(isNum)),
        windKph: median(hourlies.map(h => h.winds[i]).filter(isNum)),
      }));
  
      const aggregatedDaily = Array.from({length: 7}, (_, i) => ({
        highC: median(dailies.map(d => d.highs[i]).filter(isNum)),
        lowC: median(dailies.map(d => d.lows[i]).filter(isNum)),
        rainChance: median(dailies.map(d => d.rains[i]).filter(isNum)),
        uv: median(dailies.map(d => d.uvs[i]).filter(isNum)),
        conditionLabel: pickMostCommon(dailies.map(d => d.descs[i]).filter(Boolean)) || 'Unknown',
        conditionKey: deriveConditionKey(pickMostCommon(dailies.map(d => d.descs[i]).filter(Boolean)) || 'Unknown'),
      }));
  
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
      const medWindKph = median(norms.map(n => n.windKph).filter(isNum));
      const wind_kph = isNum(medWindKph) ? medWindKph : 0;
      const mostDesc = pickMostCommon(norms.map(n => n.desc).filter(Boolean)) || 'Weather today';
  
      return res.status(200).json({
        ok: true,
        location: {
          name: resolvedName || name || 'Unknown',
          lat,
          lon,
        },
        wind_kph,
        now: {
          tempC: medNowTemp,
          feelsLikeC: medNowTemp, // Simplified - same as temp
          windKph: medWindKph,
          rainChance: aggregatedDaily[0]?.rainChance ?? null,
          conditionKey: deriveConditionKey(mostDesc),
          conditionLabel: mostDesc,
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
      return res.status(500).json({ ok: false, error: 'Server error' });
    }
  }
  
  // Helpers
  function median(values) {
    if (values.length === 0) return null;
    values.sort((a, b) => a - b);
    const half = Math.floor(values.length / 2);
    return values.length % 2 ? values[half] : (values[half - 1] + values[half]) / 2.0;
  }
  
  function pickMostCommon(arr) {
    if (arr.length === 0) return null;
    const count = arr.reduce((acc, v) => ({ ...acc, [v]: (acc[v] || 0) + 1 }), {});
    return Object.keys(count).reduce((a, b) => count[a] > count[b] ? a : b);
  }
  
  function isNum(v) {
    return typeof v === 'number' && Number.isFinite(v);
  }
  
  function deriveConditionKey(desc) {
    const d = String(desc || '').toLowerCase();
    if (d.includes('storm') || d.includes('thunder')) return 'storm';
    if (d.includes('rain') || d.includes('drizzle') || d.includes('shower')) return 'rain';
    if (d.includes('wind') || d.includes('gust')) return 'wind';
    if (d.includes('cold') || d.includes('freez') || d.includes('snow') || d.includes('ice')) return 'cold';
    if (d.includes('hot') || d.includes('heat')) return 'heat';
    if (d.includes('fog') || d.includes('mist') || d.includes('haze')) return 'fog';
    if (d.includes('clear') || d.includes('sunny') || d.includes('fair')) return 'clear';
    // Default: cloudy or unknown → clear (per spec)
    return 'clear';
  }