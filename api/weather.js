export default async function handler(req, res) {
  try {
    const isNum = (v) => typeof v === "number" && Number.isFinite(v);

    const lat = req.query.lat !== undefined ? Number(req.query.lat) : null;
    const lon = req.query.lon !== undefined ? Number(req.query.lon) : null;
    const hasCoords = isNum(lat) && isNum(lon);

    const q = (req.query.q || "").toString().trim();
    const weatherApiKey = process.env.WEATHERAPI_KEY || "";

    let finalLat, finalLon;
    let name = "Near you";
    let country = "";

    /* ---------- LOCATION RESOLUTION ---------- */

    if (hasCoords) {
      finalLat = lat;
      finalLon = lon;
    } else {
      if (!q) {
        return res.status(400).json({ error: "Missing q or lat/lon" });
      }

      const geoUrl =
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}` +
        `&count=1&language=en&format=json`;

      const geoRes = await fetch(geoUrl);
      if (!geoRes.ok) {
        return res.status(502).json({ error: "Geocoding failed" });
      }

      const geo = await geoRes.json();
      const place = geo?.results?.[0];
      if (!place) {
        return res.status(404).json({ error: "City not found" });
      }

      finalLat = place.latitude;
      finalLon = place.longitude;
      name = place.name || q;
      country = place.country || "";
    }

    /* ---------- WEATHER SOURCES ---------- */

    const omUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${finalLat}&longitude=${finalLon}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
      `&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,weather_code` +
      `&timezone=auto`;

    const metUrl =
      `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${finalLat}&lon=${finalLon}`;

    const waUrl = weatherApiKey
      ? `https://api.weatherapi.com/v1/forecast.json?key=${encodeURIComponent(
          weatherApiKey
        )}&q=${finalLat},${finalLon}&days=7&aqi=no&alerts=no`
      : null;

    const [omRes, metRes, waRes] = await Promise.all([
      fetch(omUrl),
      fetch(metUrl, { headers: { "User-Agent": "ProbablyWeather/1.0" } }),
      waUrl ? fetch(waUrl) : Promise.resolve(null),
    ]);

    const om = omRes.ok ? await omRes.json() : null;
    const met = metRes.ok ? await metRes.json() : null;
    const wa = waRes && waRes.ok ? await waRes.json() : null;

    const sources = [];
    if (omRes.ok) sources.push("Open-Meteo");
    if (metRes.ok) sources.push("MET Norway");
    if (wa) sources.push("WeatherAPI");

    /* ---------- NORMALISATION ---------- */

    const avg = (arr) => {
      const v = arr.filter(isNum);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    };

    const nowTemps = [];
    const feels = [];
    const humid = [];
    const wind = [];
    const rain = [];

    if (om?.current) {
      nowTemps.push(om.current.temperature_2m);
      feels.push(om.current.apparent_temperature);
      humid.push(om.current.relative_humidity_2m);
      wind.push(om.current.wind_speed_10m);
      rain.push(om.hourly?.precipitation_probability?.[0]);
    }

    if (wa?.current) {
      nowTemps.push(wa.current.temp_c);
      feels.push(wa.current.feelslike_c);
      humid.push(wa.current.humidity);
      wind.push(wa.current.wind_kph);
      rain.push(Number(wa.forecast?.forecastday?.[0]?.day?.daily_chance_of_rain));
    }

    const now = {
      tempC: avg(nowTemps),
      feelsLikeC: avg(feels),
      humidity: avg(humid),
      windKph: avg(wind),
      rainChance: avg(rain),
      conditionKey: "cloudy",
      conditionLabel: "Cloudy",
    };

    const daily = [];
    if (om?.daily?.time?.length) {
      for (let i = 0; i < Math.min(7, om.daily.time.length); i++) {
        const d = new Date(om.daily.time[i]);
        daily.push({
          dayLabel: d.toLocaleDateString(undefined, { weekday: "short" }),
          highC: om.daily.temperature_2m_max?.[i],
          lowC: om.daily.temperature_2m_min?.[i],
          rainChance: om.daily.precipitation_probability_max?.[i],
          uv: om.daily.uv_index_max?.[i],
          conditionKey: "cloudy",
          conditionLabel: "Cloudy",
        });
      }
    }

    const payload = {
      location: { name, country, lat: finalLat, lon: finalLon },
      now,
      daily,
      hourly: [],
      consensus: { confidenceKey: "mixed" },
      meta: {
        updatedAtLabel: new Date().toLocaleString(),
        sources,
      },
    };

    return res.status(200).json(payload);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
}
