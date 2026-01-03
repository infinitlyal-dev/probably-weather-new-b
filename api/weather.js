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
  
      const WEATHERAPI_KEY = process.env.WEATHERAPI_KEY || null;
      const MET_USER_AGENT =
        process.env.MET_USER_AGENT ||
        'ProbablyWeather/1.0 (contact: you@example.com)';
  
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
  
      // ---------- Open-Meteo ----------
      try {
        const om = await fetchJson(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
          `&current_weather=true` +
          `&hourly=temperature_2m,precipitation_probability` +
          `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max` +
          `&timezone=auto&forecast_days=7`
        );
  
        norms.push({
          source: 'Open-Meteo',
          nowTemp: om.current_weather?.temperature ?? null,
          todayHigh: om.daily?.temperature_2m_max?.[0] ?? null,
          todayLow: om.daily?.temperature_2m_min?.[0] ?? null,
          todayRain: om.daily?.precipitation_probability_max?.[0] ?? null,
          todayUv: om.daily?.uv_index_max?.[0] ?? null
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
            todayUv: d.uv ?? null
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
        const temps = series
          .map(p => p.data?.instant?.details?.air_temperature)
          .filter(v => typeof v === 'number');
  
        const rainAmounts = series
          .map(p => p.data?.next_1_hours?.details?.precipitation_amount)
          .filter(v => typeof v === 'number');
  
        const rainProxy =
          rainAmounts.length === 0 ? null :
          Math.min(100, Math.round(Math.max(...rainAmounts) * 40));
  
        norms.push({
          source: 'MET Norway',
          nowTemp: temps[0] ?? null,
          todayHigh: temps.length ? Math.max(...temps) : null,
          todayLow: temps.length ? Math.min(...temps) : null,
          todayRain: rainProxy,
          todayUv: null
        });
      } catch {
        failures.push('MET Norway');
      }
  
      return res.status(200).json({
        ok: true,
        name,
        lat,
        lon,
        used: norms.map(n => n.source),
        failed: failures,
        norms
      });
  
    } catch (e) {
      return res.status(500).json({ ok: false, error: 'Server error' });
    }
  }
  