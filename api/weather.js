// api/weather.js
export default async function handler(req, res) {
  try {
    const { city, lat, lon } = req.query;

    const isNum = (v) => Number.isFinite(Number(v));
    const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

    // Basic helpers
    const median = (arr) => {
      const nums = (arr || []).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
      if (!nums.length) return null;
      const mid = Math.floor(nums.length / 2);
      return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
    };

    const mostCommon = (arr) => {
      if (!arr || !arr.length) return null;
      const count = {};
      for (const x of arr) count[x] = (count[x] || 0) + 1;
      return Object.keys(count).sort((x, y) => count[y] - count[x])[0];
    };

    // Condition normalization: stable buckets for tone/background logic.
    const normalizeCondition = ({ code, text }) => {
      const t = (text || "").toLowerCase();

      // Open-Meteo weather codes
      // https://open-meteo.com/en/docs
      if (isNum(code)) {
        const c = Number(code);
        if (c === 0) return { key: "clear", label: "Clear" };
        if ([1, 2, 3].includes(c)) return { key: "cloudy", label: "Cloudy" };
        if ([45, 48].includes(c)) return { key: "cloudy", label: "Fog / Low cloud" };
        if ([51, 53, 55, 56, 57].includes(c)) return { key: "rain", label: "Drizzle" };
        if ([61, 63, 65, 66, 67, 80, 81, 82].includes(c)) return { key: "rain", label: "Rain" };
        if ([71, 73, 75, 77, 85, 86].includes(c)) return { key: "rain", label: "Snow / Hail" };
        if ([95, 96, 99].includes(c)) return { key: "storm", label: "Thunderstorm" };
      }

      // Text fallback (WeatherAPI / MET)
      if (t.includes("thunder") || t.includes("storm")) return { key: "storm", label: "Storm" };
      if (t.includes("rain") || t.includes("shower") || t.includes("drizzle")) return { key: "rain", label: "Rain" };
      if (t.includes("snow") || t.includes("hail") || t.includes("sleet")) return { key: "rain", label: "Snow / Hail" };
      if (t.includes("fog") || t.includes("mist")) return { key: "cloudy", label: "Fog / Low cloud" };
      if (t.includes("cloud") || t.includes("overcast")) return { key: "cloudy", label: "Cloudy" };
      if (t.includes("clear") || t.includes("sun")) return { key: "clear", label: "Clear" };

      return { key: "unknown", label: "Unclear" };
    };

    // Geocode if we have a city (fallback to WeatherAPI search if present; otherwise Open-Meteo geocoding)
    async function geocodeCity(name) {
      // Open-Meteo geocoding
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        name
      )}&count=1&language=en&format=json`;

      const r = await fetch(url);
      if (!r.ok) return null;
      const j = await r.json();
      const hit = j?.results?.[0];
      if (!hit) return null;

      return {
        lat: hit.latitude,
        lon: hit.longitude,
        city: hit.name,
        country: hit.country,
        admin1: hit.admin1,
      };
    }

    let place = null;

    if (isNum(lat) && isNum(lon)) {
      place = { lat: Number(lat), lon: Number(lon), city: city || "Selected location", country: "" };
    } else if (city) {
      place = await geocodeCity(String(city));
    }

    if (!place) {
      return res.status(400).json({ error: "Missing or invalid location. Provide ?city= or ?lat=&lon=" });
    }

    const { lat: LAT, lon: LON } = place;

    // Build API URLs
    const omUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code` +
      `&hourly=temperature_2m,precipitation_probability,wind_speed_10m,weather_code` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max` +
      `&timezone=auto`;

    const metUrl =
      `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${LAT}&lon=${LON}`;

    const waKey = process.env.WEATHERAPI_KEY;
    const waUrl = waKey
      ? `https://api.weatherapi.com/v1/forecast.json?key=${encodeURIComponent(waKey)}&q=${LAT},${LON}&days=1&aqi=no&alerts=no`
      : null;

    // Fetch all
    const [omRes, metRes, waRes] = await Promise.all([
      fetch(omUrl),
      fetch(metUrl, {
        headers: {
          // MET requires a user-agent
          "User-Agent": "ProbablyWeather/1.0 (contact: you@example.com)",
        },
      }),
      waUrl ? fetch(waUrl) : Promise.resolve(null),
    ]);

    const om = omRes.ok ? await omRes.json() : null;
    const met = metRes.ok ? await metRes.json() : null;
    const wa = waRes && waRes.ok ? await waRes.json() : null;

    // Sources (enriched so the UI can show what each says)
    const sources = [
      { name: "Open-Meteo", ok: omRes.ok, tempC: null, conditionKey: null, conditionLabel: null },
      { name: "MET Norway", ok: metRes.ok, tempC: null, conditionKey: null, conditionLabel: null },
      { name: "WeatherAPI", ok: !!(waRes && waRes.ok), tempC: null, conditionKey: null, conditionLabel: null },
    ];

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

      sources[0].tempC = isNum(om.current.temperature_2m) ? Number(om.current.temperature_2m) : null;
      sources[0].conditionKey = cond.key;
      sources[0].conditionLabel = cond.label;

      const rp = om?.hourly?.precipitation_probability?.[0];
      if (isNum(rp)) nowRainChance.push(rp);
    }

    // MET Norway current-ish (first timeseries)
    if (met?.properties?.timeseries?.[0]) {
      const ts0 = met.properties.timeseries[0];
      const inst = ts0?.data?.instant?.details;
      const next1 = ts0?.data?.next_1_hours;

      if (inst) {
        if (isNum(inst.air_temperature)) nowTemps.push(inst.air_temperature);
        if (isNum(inst.wind_speed)) nowWind.push(inst.wind_speed * 3.6); // m/s -> km/h
        if (isNum(inst.relative_humidity)) nowHumidity.push(inst.relative_humidity);

        sources[1].tempC = isNum(inst.air_temperature) ? Number(inst.air_temperature) : null;
      }

      if (next1?.summary?.symbol_code) {
        const cond = normalizeCondition({ text: next1.summary.symbol_code.replace(/_/g, " ") });
        nowConditionKeys.push(cond.key);
        nowConditionLabels.push(cond.label);

        sources[1].conditionKey = cond.key;
        sources[1].conditionLabel = cond.label;
      }

      // precip proxy -> crude % (MET gives mm, not probability)
      const mm = next1?.details?.precipitation_amount;
      if (isNum(mm)) nowRainChance.push(clamp(mm * 40, 0, 100));
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

      sources[2].tempC = isNum(wa.current.temp_c) ? Number(wa.current.temp_c) : null;
      sources[2].conditionKey = cond.key;
      sources[2].conditionLabel = cond.label;

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

    // Agreement (formerly "confidence"): based on spread between available temps
    const temps = nowTemps.filter((t) => Number.isFinite(Number(t))).map(Number);
    let confidenceKey = "mixed";
    if (temps.length >= 2) {
      const spread = Math.max(...temps) - Math.min(...temps);
      if (spread <= 1.5) confidenceKey = "strong";
      else if (spread <= 3.5) confidenceKey = "decent";
      else confidenceKey = "mixed";
    } else if (temps.length === 1) {
      confidenceKey = "decent";
    }

    // Hourly: prefer Open-Meteo because it’s aligned + has probabilities
    const hourly = [];
    if (om?.hourly?.time?.length) {
      for (let i = 0; i < Math.min(24, om.hourly.time.length); i++) {
        const t = om.hourly.time[i];
        const temp = om.hourly.temperature_2m?.[i];
        const rain = om.hourly.precipitation_probability?.[i];
        const wind = om.hourly.wind_speed_10m?.[i];
        const code = om.hourly.weather_code?.[i];
        const c = normalizeCondition({ code });

        const dt = new Date(t);
        const hh = String(dt.getHours()).padStart(2, "0");
        const mm = String(dt.getMinutes()).padStart(2, "0");

        hourly.push({
          timeISO: t,
          timeLocal: `${hh}:${mm}`,
          tempC: Number.isFinite(Number(temp)) ? Number(temp) : null,
          rainChance: Number.isFinite(Number(rain)) ? Number(rain) : null,
          windKph: Number.isFinite(Number(wind)) ? Number(wind) : null,
          conditionKey: c.key,
          conditionLabel: c.label,
        });
      }
    }

    // Daily: from Open-Meteo
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
          highC: Number.isFinite(Number(highC)) ? Number(highC) : null,
          lowC: Number.isFinite(Number(lowC)) ? Number(lowC) : null,
          rainChance: Number.isFinite(Number(rain)) ? Number(rain) : null,
          uv: Number.isFinite(Number(uv)) ? Number(uv) : null,
          conditionKey: c.key,
          conditionLabel: c.label,
        });
      }
    }

    // Today extreme (min/max today from Open-Meteo daily[0])
    const today = daily?.[0] || {};
    const payload = {
      location: {
        city: place.city || city || "Selected location",
        country: place.country || "",
        admin1: place.admin1 || "",
        lat: LAT,
        lon: LON,
      },
      now: {
        tempC: Number.isFinite(Number(tempC)) ? Number(tempC) : null,
        feelsLikeC: Number.isFinite(Number(feelsLikeC)) ? Number(feelsLikeC) : null,
        humidity: Number.isFinite(Number(humidity)) ? Number(humidity) : null,
        windKph: Number.isFinite(Number(windKph)) ? Number(windKph) : null,
        rainChance: Number.isFinite(Number(rainChance)) ? Number(rainChance) : null,
        conditionKey,
        conditionLabel,
      },
      consensus: {
        confidenceKey, // keep key name so you don’t break anything else
      },
      today: {
        conditionKey: today.conditionKey || conditionKey,
        conditionLabel: today.conditionLabel || conditionLabel,
        lowC: today.lowC ?? null,
        highC: today.highC ?? null,
        rainChance: today.rainChance ?? null,
        uv: today.uv ?? null,
      },
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
