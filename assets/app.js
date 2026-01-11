// assets/app.js
(() => {
  const C = window.PW_CONFIG;

  // ---------------- DOM helpers
  const $ = (id) => document.getElementById(id);

  const dom = {
    // Background
    bgImg: $("bgImg"),

    // Topbar
    cityLine: $("cityLine"),
    subhead: $("subhead"),
    updatedAt: $("updatedAt"),

    // Home hero
    confidenceTop: $("confidenceTop"),
    conditionText: $("conditionText"),
    bigTemp: $("bigTemp"),
    wittyLine: $("wittyLine"),

    // Home cards
    todayExtremeKicker: $("todayExtremeKicker"),
    todayExtremeTitle: $("todayExtremeTitle"),
    todayExtremeRange: $("todayExtremeRange"),
    rainSummary: $("rainSummary"),
    uvSummary: $("uvSummary"),
    confidenceTitle: $("confidenceTitle"),
    confidenceSub: $("confidenceSub"),

    // Lists
    hourlyList: $("hourlyList"),
    weekList: $("weekList"),

    // Search
    searchInput: $("searchInput"),
    searchBtn: $("searchBtn"),

    // Settings
    sourcesList: $("sourcesList"),

    // Screens
    screens: {
      home: $("screen-home"),
      hourly: $("screen-hourly"),
      week: $("screen-week"),
      search: $("screen-search"),
      settings: $("screen-settings"),
    },
  };

  const state = {
    city: "", // IMPORTANT: no Cape Town fallback
    data: null,
    usingGeo: false,
    geoLabel: "",
  };

  // ---------------- thresholds (your rules)
  const THRESH = {
    WIND_KPH: 25,   // above 25 km/h => windy dominates
    RAIN_PCT: 50,   // above 50% => rain dominates
    HOT_C: 32,      // >= 32C => heat dominates
    COLD_C: 16,     // <= 16C => cold dominates
  };

  // ---------------- formatting helpers
  const isNum = (v) => typeof v === "number" && Number.isFinite(v);

  const fmtTemp = (c) => (isNum(c) ? `${Math.round(c)}°` : "—");
  const fmtRange = (lowC, highC) => {
    if (!isNum(lowC) && !isNum(highC)) return "—";
    if (isNum(lowC) && isNum(highC)) return `${Math.round(lowC)}–${Math.round(highC)}°`;
    return isNum(lowC) ? `${Math.round(lowC)}°` : `${Math.round(highC)}°`;
  };

  const rainCopy = (pct) => {
    if (!isNum(pct)) return "—";
    if (pct < 10) return "None expected";
    if (pct < 30) return "Unlikely";
    if (pct < 55) return "Possible";
    return "Likely";
  };

  const uvBand = (uv) => {
    if (!isNum(uv)) return "—";
    if (uv < 3) return "Low";
    if (uv < 6) return "Moderate";
    if (uv < 8) return "High";
    if (uv < 11) return "Very High";
    return "Extreme";
  };

  const confidenceLabel = (key) => {
    const map = C?.confidence || {};
    if (key && map[key]?.label) return map[key].label;
    if (key === "strong") return "High";
    if (key === "decent") return "Medium";
    return "Low";
  };

  const confidenceTopLine = (label) => `PROBABLY · ${String(label).toUpperCase()} CONFIDENCE`;

  // ---------------- condition label mapping (for headline + cards)
  const labelForKey = (key) => {
    // keys: clear, cloudy, rain, storm, fog, heat, cold, wind
    switch (key) {
      case "wind":
        return "Windy";
      case "heat":
        return "Hot";
      case "cold":
        return "Cold";
      case "fog":
        return "Foggy";
      case "cloudy":
        return "Cloudy";
      case "rain":
        return "Rain";
      case "storm":
        return "Storm";
      case "clear":
      default:
        return "Clear";
    }
  };

  // ---------------- dominant condition logic (ONE truth used everywhere on Home)
  function dominantKeyForHome(now, daily0) {
    const tempNow = now?.tempC;
    const high = daily0?.highC;
    const low = daily0?.lowC;

    const windNow = now?.windKph;
    const rainNow = now?.rainChance;
    const rainDay = daily0?.rainChance;

    const baseKey =
      (now?.conditionKey || daily0?.conditionKey || "clear")
        .toString()
        .toLowerCase();

    const rainPct = isNum(rainDay) ? rainDay : rainNow;
    const windKph = windNow;

    // 1) Storm overrides rain if the provider explicitly says storm/thunder
    if (baseKey.includes("storm") || baseKey.includes("thunder") || baseKey.includes("tstorm")) {
      return "storm";
    }

    // 2) Rain dominates if likely
    if (isNum(rainPct) && rainPct >= THRESH.RAIN_PCT) {
      return "rain";
    }

    // 3) Wind dominates if strong
    if (isNum(windKph) && windKph >= THRESH.WIND_KPH) {
      return "wind";
    }

    // 4) Heat / Cold by temp (use daily highs/lows as backup)
    const hot = (isNum(tempNow) && tempNow >= THRESH.HOT_C) || (isNum(high) && high >= THRESH.HOT_C);
    if (hot) return "heat";

    const cold = (isNum(tempNow) && tempNow <= THRESH.COLD_C) || (isNum(low) && low <= THRESH.COLD_C);
    if (cold) return "cold";

    // 5) Fog/mist/haze
    if (baseKey.includes("fog") || baseKey.includes("mist") || baseKey.includes("haze")) {
      return "fog";
    }

    // 6) Cloudy
    if (baseKey.includes("cloud")) {
      return "cloudy";
    }

    // 7) Default clear
    return "clear";
  }

  const wittyFor = (dominantKey, daily0) => {
    const high = daily0?.highC;
    const rain = daily0?.rainChance;

    if (dominantKey === "clear") {
      if (isNum(high) && high >= 26) return "Braai weather, boet!";
      return "Looks good outside.";
    }
    if (dominantKey === "rain" || dominantKey === "storm") {
      if (isNum(rain) && rain >= 60) return "Plan B. Then Plan C.";
      return "Maybe. Maybe not. Probably wet.";
    }
    if (dominantKey === "cloudy") return "50/50 weather.";
    if (dominantKey === "wind") return "Hold onto your hat.";
    if (dominantKey === "fog") return "Drive like you’ve got sense.";
    if (dominantKey === "heat") return "Find shade. Drink water.";
    if (dominantKey === "cold") return "Ja, it’s jacket weather.";
    return "Just… probably.";
  };

  // ---------------- background logic
  function getTimeOfDayLabel() {
    const h = new Date().getHours();
    if (h >= 5 && h < 8) return "dawn";
    if (h >= 8 && h < 17) return "day";
    if (h >= 17 && h < 20) return "dusk";
    return "night";
  }

  function setBackground(conditionKey) {
    const key = conditionKey || "cloudy";
    const folder = C?.assets?.conditionToFolder?.[key] || C?.assets?.fallbackFolder || "cloudy";

    const tod = getTimeOfDayLabel();
    const base = C?.assets?.bgBasePath || "/assets/images/bg";
    const src = `${base}/${folder}/${tod}.jpg`;

    dom.bgImg.src = src;
  }

  // ---------------- screen nav
  function showScreen(target) {
    const screens = dom.screens;
    Object.keys(screens).forEach((k) => {
      if (!screens[k]) return;
      screens[k].hidden = k !== target;
    });

    document.querySelectorAll(".nav-btn").forEach((btn) => {
      const t = btn.getAttribute("data-target");
      btn.classList.toggle("is-active", t === target);
    });
  }

  // ---------------- renderers
  function renderHome(data) {
    // If we got a reverse-geocoded label, show that.
    if (state.usingGeo && state.geoLabel) {
      dom.cityLine.textContent = state.geoLabel;
    } else {
      const name = data?.location?.name || state.city || "—";
      const country = data?.location?.country || "";
      dom.cityLine.textContent = country ? `${name}, ${country}` : name;
    }

    const daily0 = data?.daily?.[0] || {};
    const now = data?.now || {};

    // ONE dominant key for home
    const dKey = dominantKeyForHome(now, daily0);
    const dLabel = labelForKey(dKey).toLowerCase();

    // Headline
    dom.conditionText.textContent = `This is ${dLabel}.`;
    dom.bigTemp.textContent = fmtRange(daily0?.lowC, daily0?.highC);

    // Confidence
    const cKey = data?.consensus?.confidenceKey || "mixed";
    const cLabel = confidenceLabel(cKey);
    dom.confidenceTop.textContent = confidenceTopLine(cLabel);

    // Witty line uses dominant key
    dom.wittyLine.textContent = wittyFor(dKey, daily0);

    // Today's extreme: keep range, but make label consistent with dominant condition
    dom.todayExtremeTitle.textContent = labelForKey(dKey).toUpperCase();
    dom.todayExtremeRange.textContent = fmtRange(daily0?.lowC, daily0?.highC);

    const rainPct = isNum(daily0?.rainChance) ? daily0.rainChance : now?.rainChance;
    dom.rainSummary.textContent = rainCopy(rainPct);

    const uv = daily0?.uv;
    dom.uvSummary.textContent = isNum(uv) ? `${uvBand(uv)} (${Math.round(uv)})` : "—";

    dom.confidenceTitle.textContent = cLabel;
    const n = Array.isArray(data?.meta?.sources) ? data.meta.sources.length : 0;
    dom.confidenceSub.textContent = n ? `Based on ${n} forecasts →` : "—";

    dom.updatedAt.textContent = data?.meta?.updatedAtLabel || "—";
    if (dom.sourcesList) {
      dom.sourcesList.textContent = Array.isArray(data?.meta?.sources)
        ? data.meta.sources.map((s) => s?.name || s).join(" · ")
        : "—";
    }

    // Background uses the SAME dominant key
    setBackground(dKey);
  }

  function renderHourly(data) {
    const items = Array.isArray(data?.hourly) ? data.hourly : [];
    dom.hourlyList.innerHTML = "";

    items.slice(0, 24).forEach((h) => {
      const row = document.createElement("div");
      row.className = "list-row";

      const left = document.createElement("div");
      left.className = "list-left";
      left.innerHTML = `
        <div class="list-time">${h?.timeLocal || "—"}</div>
        <div class="list-cond">${h?.conditionLabel || "—"}</div>
      `;

      const mid = document.createElement("div");
      mid.className = "list-mid";
      mid.textContent = fmtTemp(h?.tempC);

      const right = document.createElement("div");
      right.className = "list-right";
      const rain = isNum(h?.rainChance) ? `${Math.round(h.rainChance)}%` : "—";
      const wind = isNum(h?.windKph) ? `${Math.round(h.windKph)} km/h` : "—";
      right.textContent = `${rain} · ${wind}`;

      row.appendChild(left);
      row.appendChild(mid);
      row.appendChild(right);
      dom.hourlyList.appendChild(row);
    });
  }

  function renderWeek(data) {
    const items = Array.isArray(data?.daily) ? data.daily : [];
    dom.weekList.innerHTML = "";

    items.slice(0, 7).forEach((d) => {
      const row = document.createElement("div");
      row.className = "list-row";

      const left = document.createElement("div");
      left.className = "list-left";
      left.innerHTML = `
        <div class="list-day">${d?.dayLabel || "—"}</div>
        <div class="list-cond">${d?.conditionLabel || "—"}</div>
      `;

      const mid = document.createElement("div");
      mid.className = "list-mid";
      mid.textContent = `${fmtTemp(d?.highC)} / ${fmtTemp(d?.lowC)}`;

      const right = document.createElement("div");
      right.className = "list-right";
      const rain = isNum(d?.rainChance) ? `${Math.round(d.rainChance)}%` : "—";
      const uv = isNum(d?.uv) ? `UV ${Math.round(d.uv)}` : "UV —";
      right.textContent = `${rain} · ${uv}`;

      row.appendChild(left);
      row.appendChild(mid);
      row.appendChild(right);
      dom.weekList.appendChild(row);
    });
  }

  function renderAll(data) {
    renderHome(data);
    renderHourly(data);
    renderWeek(data);
  }

  function renderGeoBlocked() {
    dom.cityLine.textContent = "Location unavailable — search for a city";
    dom.conditionText.textContent = "This is unclear.";
    dom.bigTemp.textContent = "—";
    dom.wittyLine.textContent = "Allow location or search.";
    dom.confidenceTop.textContent = "PROBABLY · LOW CONFIDENCE";
    dom.confidenceTitle.textContent = "Low";
    dom.confidenceSub.textContent = "Waiting for a location.";
    dom.updatedAt.textContent = "—";
    if (dom.sourcesList) dom.sourcesList.textContent = "—";
    setBackground("cloudy");
  }

  // ---------------- data fetch
  async function loadCity(city) {
    const q = (city || "").trim();
    if (!q) return;

    state.city = q;
    state.usingGeo = false;
    state.geoLabel = "";

    try {
      const url = `${C?.endpoints?.weather || "/api/weather"}?q=${encodeURIComponent(q)}`;
      const res = await fetch(url);
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`HTTP ${res.status}: ${t}`);
      }
      const data = await res.json();
      state.data = data;
      renderAll(data);
    } catch (err) {
      console.error(err);
      dom.conditionText.textContent = "This is unclear.";
      dom.bigTemp.textContent = "—";
      dom.wittyLine.textContent = "Something’s not pulling through.";
      dom.confidenceTop.textContent = "PROBABLY · LOW CONFIDENCE";
      dom.confidenceTitle.textContent = "Low";
      dom.confidenceSub.textContent = "Check the API / key.";
      setBackground("cloudy");
    }
  }

  async function reverseGeocodeLabel(lat, lon) {
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`
      );
      if (!r.ok) return "";
      const j = await r.json();
      const a = j.address || {};
      const city = a.town || a.city || a.village || a.suburb || a.hamlet || "";
      const country = a.country || "";
      if (city && country) return `${city}, ${country}`;
      if (city) return city;
      return "";
    } catch {
      return "";
    }
  }

  async function loadCoords(lat, lon) {
    state.usingGeo = true;
    state.city = "";
    state.geoLabel = "";

    try {
      const url = `${C?.endpoints?.weather || "/api/weather"}?lat=${encodeURIComponent(
        lat
      )}&lon=${encodeURIComponent(lon)}`;
      const res = await fetch(url);
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`HTTP ${res.status}: ${t}`);
      }
      const data = await res.json();
      state.data = data;
      renderAll(data);

      // display-only label (does not affect weather)
      const label = await reverseGeocodeLabel(lat, lon);
      if (label) {
        state.geoLabel = label;
        // update header without rerendering everything
        dom.cityLine.textContent = label;
      }
    } catch (err) {
      console.error(err);
      renderGeoBlocked();
    }
  }

  // ---------------- events
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const t = btn.getAttribute("data-target");
      if (t) showScreen(t);
    });
  });

  if (dom.searchBtn && dom.searchInput) {
    dom.searchBtn.addEventListener("click", () => {
      const v = (dom.searchInput.value || "").trim();
      if (!v) return;
      loadCity(v);
      showScreen("home");
    });

    dom.searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") dom.searchBtn.click();
    });
  }

  // ---------------- boot
  showScreen("home");
  setBackground("cloudy");

  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        loadCoords(lat, lon);
      },
      () => {
        // No fallback city: user must search
        renderGeoBlocked();
      },
      { timeout: 8000, maximumAge: 60000, enableHighAccuracy: false }
    );
  } else {
    renderGeoBlocked();
  }
})();
