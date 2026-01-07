// api/weather.js
export default async function handler(req, res) {
  try {
    const q = (req.query.q || req.query.city || "").toString().trim();

    const latRaw = req.query.lat;
    const lonRaw = req.query.lon;

    const hasLatLon = latRaw !== undefined && lonRaw !== undefined;
    const lat = hasLatLon ? Number(latRaw) : null;
    const lon = hasLatLon ? Number(lonRaw) : null;

    const isNum = (v) => typeof v === "number" && Number.isFinite(v);

    const weatherApiKey = process.env.WEATHERAPI_KEY || "";

    // --- Helpers
    function normalizeCondition({ code, text } = {}) {
      // Simple mapping used across sources (keep it conservative)
      const t = (text || "").toLowerCase();

      if (typeof code === "number") {
        // Open-Meteo weather codes
        if (code === 0) return { key: "clear", label: "Clear sky" };
        if ([1, 2].includes(code)) return { key: "cloudy", label: "Partly cloudy" };
        if (code === 3) return { key: "cloudy", label: "Cloudy" };
        if ([45, 48].includes(code)) return { key: "fog", label: "Fog" };
        if ([51, 53, 55, 56, 57].includes(code)) return { key: "rain", label: "Drizzle" };
        if ([61, 63, 65, 66, 67].includes(code)) return { key: "rain", label: "Rain" };
        if ([71, 73, 75, 77].includes(code)) return { key: "snow", label: "Snow" };
        if ([80, 81, 82].includes(code)) return { key: "rain", label: "Showers" };
        if ([95, 96, 99].includes(code)) return { key: "storm", label: "Thunderstorm" };
      }

      if (t.includes("thunder")) return { key: "storm", label: "Thunderstorm" };
      if (t.includes("snow")) return { key: "snow", label: "Snow" };
      if (t.includes("rain") || t.includes("shower")) return { key: "rain", label: "Rain" };
      if (t.includes("fog") || t.includes("mist")) return { key: "fog", label: "Fog" };
      if (t.includes("wind")) return { key: "wind", label: "Windy" };
      if (t.includes("cloud")) return { key: "cloudy", label: "Cloudy" };
      if (t.includes("clear") || t.includes("sun")) return { key: "clear", label: "Clear sky" };

      return { key: "cloudy", label: "Cloudy" };
    }

    // --- Decide coordinates + display name
    let name = "My Location";
    let country = "";
    let finalLat = null;
    let finalLon = null;

    // Optional label provided by client (purely for display)
    // Example: "Strand, South Africa" or "Strand, ZA"
    const label = (req.query.label || "").toString().trim();
    if (label) {
      const parts = label.split(",").map((s) => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        name = parts[0];
        country = parts.slice(1).join(", ");
      } else {
        name = label;
      }
    }

    if (hasLatLon) {
      if (!isNum(lat) || !isNum(lon)) {
        return res.status(400).json({ error: "Invalid lat/lon" });
      }
      finalLat = lat;
      finalLon = lon;
    } else {
      if (!q) return res.status(400).json({ error: "Missing query param: q (or provide lat/lon)" });

      // 1) Geocode via Open-Meteo (simple + free)
      const geoUrl =
        `https://geocoding-api.open-meteo.com/v1/search` +
        `?name=${encodeURIComponent(q)}&count=1&language=en&format=json`;

      const geoRes = await fetch(geoUrl);
      if (!geoRes.ok) return res.status(502).json({ error: "Geocoding failed" });

      const geo = await geoRes.json();
      const place = geo?.results?.[0];
      if (!place) return res.status(404).json({ error: "City not found" });

      finalLat = place.latitude;
      finalLon = place.longitude;

      // Better display name from geocoder
      name = place.name || q;
      country = place.country || "";
    }

    // 2) Source A: Open-Meteo forecast (coords)
    const omUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${finalLat}&longitude=${finalLon}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
      `&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,weather_code` +
      `&timezone=auto`;

    // 3) Source B: MET Norway (coords)
    const metUrl = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${finalLat}&lon=${finalLon}`;

    // 4) Source C: WeatherAPI (optional)
    // WeatherAPI can accept "lat,lon" as the q param, which is perfect here.
    const waUrl = weatherApiKey
      ? `https://api.weatherapi.com/v1/forecast.json?key=${encodeURIComponent(weatherApiKey)}&q=${encodeURIComponent(`${finalLat},${finalLon}`)}&days=7&aqi=no&alerts=no`
      : null;

    const sources = [];

    // --- Fetch sources
    const [omRes, metRes, waRes] = await Promise.all([
      fetch(omUrl),
      fetch(metUrl, { headers: { "User-Agent": "ProbablyWeather/1.0 (contact: vercel)" } }),
      waUrl ? fetch(waUrl) : Promise.resolve(null),
    ]);

    const om = omRes?.ok ? await omRes.json() : null;
    sources.push({ name: "Open-Meteo", ok: !!omRes?.ok });

    const met = metRes?.ok ? await metRes.json() : null;
    sources.push({ name: "MET Norway", ok: !!metRes?.ok });

    let wa = null;
    if (waRes) {
      wa = waRes.ok ? await waRes.json() : null;
      sources.push({ name: "WeatherAPI", ok: !!waRes.ok });
    }

    // --- Consensus building
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

      const rp = om?.hourly?.precipitation_probability?.[0];
      if (isNum(rp)) nowRainChance.push(rp);
    }

    // MET current
    const metNow = met?.properties?.timeseries?.[0]?.data;
    if (metNow?.instant?.details) {
      const d = metNow.instant.details;
      if (isNum(d.air_temperature)) nowTemps.push(d.air_temperature);
      if (isNum(d.wind_speed)) nowWind.push(d.wind_speed * 3.6); // m/s -> km/h approx
      if (isNum(d.relative_humidity)) nowHumidity.push(d.relative_humidity);

      // MET doesn't have a simple "condition" equivalent in compact; we won't force it.
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

      const cr = Number(wa?.forecast?.forecastday?.[0]?.day?.daily_chance_of_rain);
      if (isNum(cr)) nowRainChance.push(cr);
    }

    const avg = (arr) => {
      const nums = arr.filter((x) => isNum(x));
      if (!nums.length) return null;
      return nums.reduce((a, b) => a + b, 0) / nums.length;
    };

    const pickMostCommon = (arr) => {
      const counts = new Map();
      for (const x of arr) {
        if (!x) continue;
        counts.set(x, (counts.get(x) || 0) + 1);
      }
      let best = null;
      let bestN = 0;
      for (const [k, v] of counts.entries()) {
        if (v > bestN) {
          best = k;
          bestN = v;
        }
      }
      return best;
    };

    const tempC = avg(nowTemps);
    const feelsLikeC = avg(nowFeels);
    const humidity = avg(nowHumidity);
    const windKph = avg(nowWind);
    const rainChance = avg(nowRainChance);

    const conditionKey = pickMostCommon(nowConditionKeys) || "cloudy";
    const conditionLabel = pickMostCommon(nowConditionLabels) || normalizeCondition({ text: conditionKey }).label;

    // Confidence based on spread between available now temps
    let confidenceKey = "mixed";
    const temps = nowTemps.filter((x) => isNum(x));
    if (temps.length >= 2) {
      const spread = Math.max(...temps) - Math.min(...temps);
      confidenceKey = spread <= 2 ? "strong" : spread <= 4 ? "decent" : "mixed";
    } else if (temps.length === 1) {
      confidenceKey = "decent";
    }

    // Hourly: prefer Open-Meteo hourly (it’s consistent)
    const hourly = [];
    if (om?.hourly?.time?.length) {
      const n = Math.min(24, om.hourly.time.length);
      for (let i = 0; i < n; i++) {
        const dateISO = om.hourly.time[i];
        const temp = om.hourly.temperature_2m?.[i];
        const rain = om.hourly.precipitation_probability?.[i];
        const wind = om.hourly.wind_speed_10m?.[i];
        const code = om.hourly.weather_code?.[i];
        const c = normalizeCondition({ code });

        const d = new Date(dateISO);
        const hh = String(d.getHours()).padStart(2, "0");
        const mm = String(d.getMinutes()).padStart(2, "0");

        hourly.push({
          timeISO: dateISO,
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
      location: { name, country, lat: finalLat, lon: finalLon },
      now: {
        tempC,
        feelsLikeC,
        humidity,
        windKph,
        rainChance,
        conditionKey,
        conditionLabel,
      },
      consensus: { confidenceKey },
      meta: {
        updatedAtLabel: new Date().toLocaleString(),
        sources: sources.filter((s) => s.ok).map((s) => s.name),
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
