module.exports = async (req, res) => {
    const { latitude, longitude } = req.query;
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Missing coordinates' });
    }
  
    const omUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,is_day&hourly=temperature_2m,precipitation_probability&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max&timezone=auto&forecast_days=7`;
    const waUrl = `https://api.weatherapi.com/v1/forecast.json?key=a98886bfef6c4dcd8bf111514251512&q=${latitude},${longitude}&days=7`;
    const owmUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=a56be2054510bc8fed22998c68972876&units=metric`;
  
    let omData = null;
    let waData = null;
    let owmData = null;
    let activeSources = 0;
  
    try {
      const [omRes, waRes, owmRes] = await Promise.all([
        fetch(omUrl),
        fetch(waUrl),
        fetch(owmUrl)
      ]);
      if (omRes.ok) { omData = await omRes.json(); activeSources++; }
      if (waRes.ok) { waData = await waRes.json(); activeSources++; }
      if (owmRes.ok) { owmData = await owmRes.json(); activeSources++; }
    } catch (err) {
      console.error('Fetch error:', err);
    }
  
    if (activeSources === 0) {
      return res.status(500).json({ error: 'All weather sources unavailable' });
    }
  
    function median(arr) {
      if (arr.length === 0) return null;
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    }
  
    const aggregated = {
      current: {},
      hourly: { time: [], temperature_2m: [], precipitation_probability: [] },
      daily: { time: [], temperature_2m_max: [], temperature_2m_min: [], precipitation_probability_max: [], uv_index_max: [] },
      confidence_level: activeSources === 1 ? 'Medium' : 'High'
    };
  
    // Current aggregation
    const temps = [], feels = [], precip = [], winds = [], isDayValues = [];
    if (omData) {
      temps.push(omData.current.temperature_2m);
      feels.push(omData.current.apparent_temperature);
      precip.push(omData.current.precipitation_probability ?? 0);
      winds.push(omData.current.wind_speed_10m * 3.6);
      isDayValues.push(omData.current.is_day);
    }
    if (waData) {
      temps.push(waData.current.temp_c);
      feels.push(waData.current.feelslike_c);
      const hourIdx = new Date().getHours();
      precip.push(waData.forecast.forecastday[0].hour[hourIdx]?.chance_of_rain ?? 0);
      winds.push(waData.current.wind_kph);
      isDayValues.push(waData.current.is_day);
    }
    if (owmData) {
      temps.push(owmData.main.temp);
      feels.push(owmData.main.feels_like);
      winds.push(owmData.wind.speed * 3.6);
    }
  
    aggregated.current.temperature_2m = Math.round(median(temps) || 20);
    aggregated.current.apparent_temperature = Math.round(median(feels.filter(v => v !== null)) || aggregated.current.temperature_2m);
    aggregated.current.precipitation_probability = Math.round(median(precip) || 0);
    aggregated.current.wind_speed_10m = (median(winds) || 0) / 3.6;
    aggregated.current.is_day = isDayValues[0] ?? 1;
  
    // Confidence refinement
    const tempRange = temps.length > 1 ? Math.max(...temps) - Math.min(...temps) : 0;
    const rainDay0 = [];
    if (omData) rainDay0.push(omData.daily.precipitation_probability_max[0] ?? 0);
    if (waData) rainDay0.push(waData.forecast.forecastday[0].day.daily_chance_of_rain);
    const rainRange = rainDay0.length > 1 ? Math.max(...rainDay0) - Math.min(...rainDay0) : 0;
  
    if (activeSources >= 2 && tempRange <= 3 && rainRange <= 20) {
      aggregated.confidence_level = 'High';
    } else if (tempRange > 8 || rainRange > 50) {
      aggregated.confidence_level = 'Low';
    } else {
      aggregated.confidence_level = 'Medium';
    }
  
    // Hourly
    const baseHourly = omData || waData || { hourly: { time: new Array(168).fill('') } };
    aggregated.hourly.time = baseHourly.hourly?.time || new Array(168).fill('');
    for (let i = 0; i < 168; i++) {
      const t = [], p = [];
      if (omData?.hourly) {
        t.push(omData.hourly.temperature_2m[i]);
        p.push(omData.hourly.precipitation_probability[i] ?? 0);
      }
      if (waData) {
        const dayIdx = Math.floor(i / 24);
        const hourIdx = i % 24;
        const h = waData.forecast.forecastday[dayIdx]?.hour[hourIdx];
        if (h) {
          t.push(h.temp_c);
          p.push(h.chance_of_rain);
        }
      }
      aggregated.hourly.temperature_2m.push(Math.round(median(t) || 20));
      aggregated.hourly.precipitation_probability.push(Math.round(median(p) || 0));
    }
  
    // Daily
    aggregated.daily.time = omData?.daily?.time || waData?.forecast.forecastday.map(d => d.date) || new Array(7).fill('');
    for (let i = 0; i < 7; i++) {
      const maxT = [], minT = [], rainP = [], uv = [];
      if (omData) {
        maxT.push(omData.daily.temperature_2m_max[i]);
        minT.push(omData.daily.temperature_2m_min[i]);
        rainP.push(omData.daily.precipitation_probability_max[i] ?? 0);
        uv.push(omData.daily.uv_index_max[i] ?? 0);
      }
      if (waData) {
        const day = waData.forecast.forecastday[i]?.day;
        if (day) {
          maxT.push(day.maxtemp_c);
          minT.push(day.mintemp_c);
          rainP.push(day.daily_chance_of_rain);
          uv.push(day.uv || 0);
        }
      }
      aggregated.daily.temperature_2m_max.push(Math.round(median(maxT) || 25));
      aggregated.daily.temperature_2m_min.push(Math.round(median(minT) || 15));
      aggregated.daily.precipitation_probability_max.push(Math.round(median(rainP) || 0));
      aggregated.daily.uv_index_max.push(Math.round(median(uv) || 5));
    }
  
    res.json(aggregated);
  };