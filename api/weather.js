// api/weather.js
export default async function handler(req, res) {
  try {
    const q = (req.query.q || req.query.city || "").toString().trim();
    if (!q) return res.status(400).json({ error: "Missing query param: q" });

    const weatherApiKey = process.env.WEATHERAPI_KEY || "";

    // 1) Geocode via Open-Meteo (simple + free)
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json`;
    const geoRes = await fetch(geoUrl);
    if (!geoRes.ok) return res.status(502).json({ error: "Geocoding failed" });
    const geo = await geoRes.json();

    const place = geo?.results?.[0];
    if (!place) return res.status(404).json({ error: "City not found" });

    const lat = place.latitude;
    const lon = place.longitude;
    const name = place.name;
    const country = place.country || "";

    // Helpers
    const isNum = (v) => typeof v === "number" && Number.isFinite(v);

    const median = (arr) => {
      const v = arr.filter(isNum).sort((a, b) => a - b);
      if (!v.length) return null;
      const mid = Math.floor(v.length / 2);
      return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
    };

    const mostCommon = (arr) => {
      const a = arr.filter(Boolean);
      if (!a.length) return null;
      const count = a.reduce((m, x) => (m[x] = (m[x] || 0) + 1, m), {});
      return Object.keys(count).sort((x, y) => count[y] - count[x])[0];
    };

    // Condition normalization
    // We only need stable buckets for tone + background logic.
    const normalizeCondition = ({ code, text }) => {
      const t = (text || "").toLowerCase();

      // Open-Meteo weather codes
      // https://open-meteo.com/en/docs
      if (isNum(code)) {
        if (code === 0) return { key: "clear", label: "Clear" };
        if ([1, 2, 3].includes(code)) return { key: "cloudy", label: "Cloudy" };
        if ([45, 48].includes(code)) return { key: "cloudy", label: "Fog / Low cloud" };
        if ([51, 53, 55, 56, 57].includes(code)) return { key: "rain", label: "Drizzle" };
        if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { key: "rain", label: "Rain" };
        if ([71, 73, 75, 77, 85, 86].includes(code)) return { key: "rain", label: "Snow / Hail" };
        if ([95, 96, 99].includes(code)) return { key: "storm", label: "Thunderstorm" };
      }

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

    // Hourly: prefer Open-Meteo because it’s already aligned + has probabilities
    const hourly = [];
    if (om?.hourly?.time?.length) {
      for (let i = 0; i < Math.min(24, om.hourly.time.length); i++) {
        const t = om.hourly.time[i];
        const temp = om.hourly.temperature_2m?.[i];
        const rain = om.hourly.precipitation_probability?.[i];
        const wind = om.hourly.wind_speed_10m?.[i];
        const code = om.hourly.weather_code?.[i];
        const c = normalizeCondition({ code });

        // local time label HH:MM
        const dt = new Date(t);
        const hh = String(dt.getHours()).padStart(2, "0");
        const mm = String(dt.getMinutes()).padStart(2, "0");

        hourly.push({
          timeISO: t,
          timeLocal: `${hh}:${mm}`,
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

        const d = new Date(dateISO);
        const dayLabel = d.toLocaleDateString(undefined, { weekday: "short" });

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
        });
      }
    }

    const payload = {
      location: { name, country, lat, lon },
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
  }
}
