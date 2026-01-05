// /api/weather.js
// Probably Weather – server-side weather aggregator
// Sources: Open-Meteo (no key), WeatherAPI (key), MET Norway (no key, User-Agent)

export default async function handler(req, res) {
    try {
      const lat = parseFloat(req.query.lat);
      const lon = parseFloat(req.query.lon);
      const name = req.query.name || null;
  
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return res.status(400).json({ ok: false, error: 'Invalid lat/lon' });
      }
<<<<<<< Updated upstream
  
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
          wind: om.current?.wind_speed_10m ?? null, // km/h
        });
  
        hourlies.push({
          source: 'Open-Meteo',
          temps: om.hourly?.temperature_2m.slice(0, 24) ?? [],
          rains: om.hourly?.precipitation_probability.slice(0, 24) ?? [],
          winds: om.hourly?.wind_speed_10m.slice(0, 24) ?? [],
=======

      // Text fallback (WeatherAPI / MET)
      if (t.includes("thunder") || t.includes("storm")) return { key: "storm", label: "Storm" };
      if (t.includes("rain") || t.includes("shower") || t.includes("drizzle")) return { key: "rain", label: "Rain" };
      if (t.includes("cloud") || t.includes("overcast") || t.includes("fog") || t.includes("mist")) return { key: "cloudy", label: "Cloudy" };
      if (t.includes("clear") || t.includes("sun")) return { key: "clear", label: "Clear" };

      return { key: "unknown", label: "Unclear" };
    };

    // 2) Source A: Open-Meteo forecast
    const omUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
      `&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,weather_code` +
      `&timezone=auto`;

    // 3) Source B: MET Norway (compact)
    const metUrl = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`;

    // 4) Source C: WeatherAPI (optional)
    const waUrl = weatherApiKey
      ? `https://api.weatherapi.com/v1/forecast.json?key=${weatherApiKey}&q=${encodeURIComponent(name)}&days=7&aqi=no&alerts=no`
      : null;

    const [omRes, metRes, waRes] = await Promise.all([
      fetch(omUrl),
      fetch(metUrl, { headers: { "User-Agent": "ProbablyWeather/1.0 (contact: hello@probablyweather.app)" } }),
      waUrl ? fetch(waUrl) : Promise.resolve(null)
    ]);

    const sources = [
      { name: "Open-Meteo", ok: omRes.ok },
      { name: "MET Norway", ok: metRes.ok },
      { name: "WeatherAPI", ok: waRes ? waRes.ok : false }
    ];

    const om = omRes.ok ? await omRes.json() : null;
    const met = metRes.ok ? await metRes.json() : null;
    const wa = waRes && waRes.ok ? await waRes.json() : null;

    // Extract timezone from Open-Meteo response (for proper time formatting)
    const timezone = om?.timezone || "UTC";
    const timezoneAbbreviation = om?.timezone_abbreviation || "UTC";

    // Pull "now" from each source where possible
    const nowTemps = [];
    const nowFeels = [];
    const nowHumidity = [];
    const nowWind = [];
    const nowRainChance = [];
    const nowConditionKeys = [];
    const nowConditionLabels = [];

    // Open-Meteo current
    if (om?.current) {
      nowTemps.push(om.current.temperature_2m);
      nowFeels.push(om.current.apparent_temperature);
      nowHumidity.push(om.current.relative_humidity_2m);
      nowWind.push(om.current.wind_speed_10m);
      const cond = normalizeCondition({ code: om.current.weather_code });
      nowConditionKeys.push(cond.key);
      nowConditionLabels.push(cond.label);

      // Rain chance: use first hourly precip prob as a proxy
      const rp = om?.hourly?.precipitation_probability?.[0];
      if (isNum(rp)) nowRainChance.push(rp);
    }

    // MET Norway current-ish: first timeseries
    if (met?.properties?.timeseries?.[0]) {
      const ts0 = met.properties.timeseries[0];
      const inst = ts0?.data?.instant?.details;
      const next1 = ts0?.data?.next_1_hours;
      if (inst) {
        if (isNum(inst.air_temperature)) nowTemps.push(inst.air_temperature);
        if (isNum(inst.wind_speed)) nowWind.push(inst.wind_speed * 3.6); // m/s -> km/h
        if (isNum(inst.relative_humidity)) nowHumidity.push(inst.relative_humidity);
      }
      if (next1?.summary?.symbol_code) {
        const cond = normalizeCondition({ text: next1.summary.symbol_code.replace(/_/g, " ") });
        nowConditionKeys.push(cond.key);
        nowConditionLabels.push(cond.label);
      }
      // precip proxy -> crude % (MET gives mm, not probability)
      const mm = next1?.details?.precipitation_amount;
      if (isNum(mm)) nowRainChance.push(Math.max(0, Math.min(100, mm * 40)));
    }

    // WeatherAPI current (optional)
    if (wa?.current) {
      if (isNum(wa.current.temp_c)) nowTemps.push(wa.current.temp_c);
      if (isNum(wa.current.feelslike_c)) nowFeels.push(wa.current.feelslike_c);
      if (isNum(wa.current.humidity)) nowHumidity.push(wa.current.humidity);
      if (isNum(wa.current.wind_kph)) nowWind.push(wa.current.wind_kph);
      const cond = normalizeCondition({ text: wa.current?.condition?.text });
      nowConditionKeys.push(cond.key);
      nowConditionLabels.push(cond.label);

      // WeatherAPI gives daily chance_of_rain, so approximate using forecast day 0
      const cr = wa?.forecast?.forecastday?.[0]?.day?.daily_chance_of_rain;
      if (isNum(cr)) nowRainChance.push(cr);
    }

    const tempC = median(nowTemps);
    const feelsLikeC = median(nowFeels.length ? nowFeels : nowTemps);
    const humidity = median(nowHumidity);
    const windKph = median(nowWind);
    const rainChance = median(nowRainChance);

    const conditionKey = mostCommon(nowConditionKeys) || "unknown";
    const conditionLabel = mostCommon(nowConditionLabels) || "Unclear";

    // Confidence: based on spread between available temps
    const temps = nowTemps.filter(isNum);
    let confidenceKey = "mixed";
    if (temps.length >= 2) {
      const spread = Math.max(...temps) - Math.min(...temps);
      if (spread <= 1.5) confidenceKey = "strong";
      else if (spread <= 3.5) confidenceKey = "decent";
      else confidenceKey = "mixed";
    } else if (temps.length === 1) {
      confidenceKey = "decent";
    }

    // Hourly: prefer Open-Meteo because it's already aligned + has probabilities
    // Fix: Format times using location timezone instead of server UTC
    const hourly = [];
    if (om?.hourly?.time?.length) {
      for (let i = 0; i < Math.min(24, om.hourly.time.length); i++) {
        const t = om.hourly.time[i];
        const temp = om.hourly.temperature_2m?.[i];
        const rain = om.hourly.precipitation_probability?.[i];
        const wind = om.hourly.wind_speed_10m?.[i];
        const code = om.hourly.weather_code?.[i];
        const c = normalizeCondition({ code });

        // Format time in location's timezone
        // Open-Meteo returns times like "2024-01-15T14:00" (already in location's local time, no TZ suffix)
        // Extract time directly from the string to avoid timezone conversion issues
        let timeLocal = "—";
        try {
          // Extract HH:MM directly from ISO string (e.g., "2024-01-15T14:00" -> "14:00")
          const timeMatch = t.match(/T(\d{2}):(\d{2})/);
          if (timeMatch) {
            timeLocal = `${timeMatch[1]}:${timeMatch[2]}`;
          } else {
            // Fallback: try parsing (may be incorrect but won't crash)
            const dt = new Date(t);
            const hh = String(dt.getHours()).padStart(2, "0");
            const mm = String(dt.getMinutes()).padStart(2, "0");
            timeLocal = `${hh}:${mm}`;
          }
        } catch (e) {
          // Fallback: parse as-is (may be incorrect but won't crash)
          const dt = new Date(t);
          const hh = String(dt.getHours()).padStart(2, "0");
          const mm = String(dt.getMinutes()).padStart(2, "0");
          timeLocal = `${hh}:${mm}`;
        }

        hourly.push({
          timeISO: t,
          timeLocal: timeLocal,
          tempC: isNum(temp) ? temp : null,
          rainChance: isNum(rain) ? rain : null,
          windKph: isNum(wind) ? wind : null,
          conditionKey: c.key,
          conditionLabel: c.label,
        });
      }
    }

    // Daily: Open-Meteo daily
    const daily = [];
    if (om?.daily?.time?.length) {
      for (let i = 0; i < Math.min(7, om.daily.time.length); i++) {
        const dateISO = om.daily.time[i];
        const highC = om.daily.temperature_2m_max?.[i];
        const lowC = om.daily.temperature_2m_min?.[i];
        const rain = om.daily.precipitation_probability_max?.[i];
        const uv = om.daily.uv_index_max?.[i];
        const code = om.daily.weather_code?.[i];
        const c = normalizeCondition({ code });

        // Format day label in location's timezone
        // Open-Meteo returns dates like "2024-01-15" (already in location's local date)
        let dayLabel = "—";
        try {
          // Create date at midnight in the location's timezone
          const d = new Date(dateISO + 'T00:00:00');
          const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            weekday: 'short'
          });
          dayLabel = formatter.format(d);
        } catch (e) {
          // Fallback: parse as-is
          const d = new Date(dateISO);
          dayLabel = d.toLocaleDateString(undefined, { weekday: "short" });
        }

        daily.push({
          dateISO,
          dateLocal: dateISO,
          dayLabel,
          highC: isNum(highC) ? highC : null,
          lowC: isNum(lowC) ? lowC : null,
          rainChance: isNum(rain) ? rain : null,
          uv: isNum(uv) ? uv : null,
          conditionKey: c.key,
          conditionLabel: c.label,
>>>>>>> Stashed changes
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
            wind: wa.current?.wind_kph ?? null, // km/h
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
          wind,
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
        temp: median(hourlies.map(h => h.temps[i]).filter(isNum)),
        rain: median(hourlies.map(h => h.rains[i]).filter(isNum)),
        wind: median(hourlies.map(h => h.winds[i]).filter(isNum)),
      }));
  
      const aggregatedDaily = Array.from({length: 7}, (_, i) => ({
        high: median(dailies.map(d => d.highs[i]).filter(isNum)),
        low: median(dailies.map(d => d.lows[i]).filter(isNum)),
        rain: median(dailies.map(d => d.rains[i]).filter(isNum)),
        uv: median(dailies.map(d => d.uvs[i]).filter(isNum)),
        desc: pickMostCommon(dailies.map(d => d.descs[i]).filter(Boolean)) || 'Unknown',
      }));
  
      return res.status(200).json({
        ok: true,
        name,
        lat,
        lon,
        used: norms.map(n => n.source),
        failed: failures,
        norms,
        hourly: aggregatedHourly,
        daily: aggregatedDaily,
      });
  
    } catch (e) {
      return res.status(500).json({ ok: false, error: 'Server error' });
    }
<<<<<<< Updated upstream
=======

    const payload = {
      location: { name, country, lat, lon, timezone, timezoneAbbreviation },
      now: { tempC, feelsLikeC, humidity, windKph, rainChance, conditionKey, conditionLabel },
      consensus: { confidenceKey },
      meta: {
        updatedAtLabel: new Date().toLocaleString(),
        sources,
      },
      hourly,
      daily,
    };

    return res.status(200).json(payload);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error", detail: String(e?.message || e) });
>>>>>>> Stashed changes
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