// assets/app.js
(() => {
  const C = window.PW_CONFIG;

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);

  const dom = {
    subhead: $("subhead"),
    updatedAt: $("updatedAt"),

    cityName: $("cityName"),
    countryName: $("countryName"),
    bigTemp: $("bigTemp"),
    conditionText: $("conditionText"),

    confidencePill: $("confidencePill"),
    confidenceNote: $("confidenceNote"),

    feelsLike: $("feelsLike"),
    windKph: $("windKph"),
    humidity: $("humidity"),
    rainChance: $("rainChance"),

    toneTitle: $("toneTitle"),
    toneVibe: $("toneVibe"),
    toneNote: $("toneNote"),

    hourlyList: $("hourlyList"),
    weekList: $("weekList"),

    searchInput: $("searchInput"),
    searchBtn: $("searchBtn"),
    searchHint: $("searchHint"),

    sourcesList: $("sourcesList"),

    screenHourly: $("screen-hourly"),
    screenWeek: $("screen-week"),
    screenSearch: $("screen-search"),
    screenSettings: $("screen-settings"),

    bgImg: $("bgImg"),
  };

  const screens = {
    home: null,
    hourly: dom.screenHourly,
    week: dom.screenWeek,
    search: dom.screenSearch,
    settings: dom.screenSettings,
  };

  // ---------- State ----------
  let state = {
    city: "Cape Town",
    lastData: null,
  };

  // ---------- Helpers ----------
  const fmtTemp = (n) => (Number.isFinite(n) ? `${Math.round(n)}°${C.units.temp}` : "—");
  const fmtWind = (n) => (Number.isFinite(n) ? `${Math.round(n)} ${C.units.wind}` : "—");
  const fmtPct = (n) => (Number.isFinite(n) ? `${Math.round(n)}%` : "—");

  // Determine time of day based on current hour (local time)
  function getTimeOfDay() {
    const hour = new Date().getHours();
    // Dawn: 5-7, Day: 7-18, Dusk: 18-20, Night: 20-5
    if (hour >= 5 && hour < 7) return "dawn";
    if (hour >= 7 && hour < 18) return "day";
    if (hour >= 18 && hour < 20) return "dusk";
    return "night";
  }

  // Get background image path based on conditionKey (all lowercase for Linux compatibility)
  function getBackgroundImagePath(conditionKey, tempC) {
    if (!conditionKey) conditionKey = "unknown";
    
    // Normalize to lowercase
    const key = String(conditionKey).toLowerCase().trim();
    
    // Map conditionKey to folder name
    const folder = C.assets.conditionToFolder[key] || C.assets.fallbackFolder;
    
    // Get time of day
    const timeOfDay = getTimeOfDay();
    
    // Build path: /assets/images/bg/{folder}/{timeOfDay}.jpg
    // All lowercase to match Linux case-sensitive filesystem
    const imagePath = `${C.assets.bgBasePath}/${folder}/${timeOfDay}.jpg`;
    
    return imagePath;
  }

  // Set background image and apply body class
  function setBackground(conditionKey, tempC) {
    if (!dom.bgImg) return;
    
    // Get image path
    const imagePath = getBackgroundImagePath(conditionKey, tempC);
    
    // Set image source
    dom.bgImg.src = imagePath;
    
    // Apply body class for weather condition (lowercase, with weather- prefix)
    // Remove all existing weather- classes first
    document.body.className = document.body.className
      .split(/\s+/)
      .filter(c => !c.startsWith("weather-"))
      .join(" ");
    
    // Add new weather class (normalize to lowercase)
    const weatherClass = `weather-${String(conditionKey || "unknown").toLowerCase().trim()}`;
    document.body.classList.add(weatherClass);
  }

  function setActiveNav(target) {
    document.querySelectorAll(".nav-btn").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.target === target);
    });
  }

  function showScreen(target) {
    // hide all overlay screens
    Object.values(screens).forEach((el) => {
      if (el) el.hidden = true;
    });

    if (target !== "home" && screens[target]) {
      screens[target].hidden = false;
    }

    setActiveNav(target);
  }

  function pickToneKey(conditionKey) {
    if (!conditionKey) return "unknown";
    if (conditionKey === "storm") return "storm";
    if (conditionKey === "rain") return "rain";
    if (conditionKey === "cloudy") return "cloudy";
    if (conditionKey === "clear") return "clear";
    return "unknown";
  }

  function renderTone(conditionKey) {
    const key = pickToneKey(conditionKey);
    const t = C.conditionTone[key] || C.conditionTone.unknown;
    dom.toneTitle.textContent = t.title;
    dom.toneVibe.textContent = t.vibe;
    dom.toneNote.textContent = t.note;
  }

  function renderConfidence(confKey) {
    const conf = C.confidence[confKey] || C.confidence.mixed;
    dom.confidencePill.textContent = `${conf.label} confidence`;
    dom.confidenceNote.textContent = conf.long;
  }

  function renderSources(list) {
    if (!Array.isArray(list) || list.length === 0) {
      dom.sourcesList.textContent = "—";
      return;
    }
    dom.sourcesList.textContent = list
      .map((s) => `${s.name}${s.ok ? "" : " (down)"}`)
      .join(" • ");
  }

  function renderHourly(hourly) {
    dom.hourlyList.innerHTML = "";
    if (!Array.isArray(hourly) || hourly.length === 0) {
      dom.hourlyList.textContent = "No hourly data.";
      return;
    }

    const frag = document.createDocumentFragment();
    hourly.slice(0, 24).forEach((h) => {
      const row = document.createElement("div");
      row.className = "row";
      row.innerHTML = `
        <div class="row-left">
          <div class="row-time">${h.timeLocal || "—"}</div>
          <div class="row-small">${h.conditionLabel || ""}</div>
        </div>
        <div class="row-mid">${fmtTemp(h.tempC)}</div>
        <div class="row-right">${fmtPct(h.rainChance)} • ${fmtWind(h.windKph)}</div>
      `;
      frag.appendChild(row);
    });

    dom.hourlyList.appendChild(frag);
  }

  function renderWeek(days) {
    dom.weekList.innerHTML = "";
    if (!Array.isArray(days) || days.length === 0) {
      dom.weekList.textContent = "No weekly data.";
      return;
    }

    const frag = document.createDocumentFragment();
    days.slice(0, 7).forEach((d) => {
      const row = document.createElement("div");
      row.className = "row";
      row.innerHTML = `
        <div class="row-left">
          <div class="row-time">${d.dayLabel || d.dateLocal || "—"}</div>
          <div class="row-small">${d.conditionLabel || ""}</div>
        </div>
        <div class="row-mid">${fmtTemp(d.highC)} / ${fmtTemp(d.lowC)}</div>
        <div class="row-right">${fmtPct(d.rainChance)}${Number.isFinite(d.uv) ? ` • UV ${Math.round(d.uv)}` : ""}</div>
      `;
      frag.appendChild(row);
    });

    dom.weekList.appendChild(frag);
  }

  function renderHome(data) {
    dom.cityName.textContent = data.location?.name || state.city || "—";
    dom.countryName.textContent = data.location?.country || "—";

    dom.bigTemp.textContent = fmtTemp(data.now?.tempC);
    dom.conditionText.textContent = data.now?.conditionLabel || "—";

    dom.updatedAt.textContent = data.meta?.updatedAtLabel || "—";

    dom.feelsLike.textContent = fmtTemp(data.now?.feelsLikeC);
    dom.windKph.textContent = fmtWind(data.now?.windKph);
    dom.humidity.textContent = fmtPct(data.now?.humidity);
    dom.rainChance.textContent = fmtPct(data.now?.rainChance);

    renderTone(data.now?.conditionKey);
    renderConfidence(data.consensus?.confidenceKey);
    renderSources(data.meta?.sources);

    // Set background image and body class based on condition
    setBackground(data.now?.conditionKey, data.now?.tempC);
  }

  async function fetchWeather(city) {
    const url = `${C.endpoints.weather}?q=${encodeURIComponent(city)}`;
    const res = await fetch(url);
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Weather API failed (${res.status}). ${txt}`);
    }
    return res.json();
  }

  async function loadCity(city) {
    dom.searchHint.textContent = "";
    try {
      state.city = city;
      const data = await fetchWeather(city);
      state.lastData = data;

      renderHome(data);
      renderHourly(data.hourly);
      renderWeek(data.daily);

    } catch (err) {
      console.error(err);
      dom.searchHint.textContent = "Couldn't load that city. Try another spelling.";
      // keep old UI instead of wiping it out
    }
  }

  // ---------- Events ----------
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const t = btn.dataset.target;
      showScreen(t);
    });
  });

  dom.searchBtn.addEventListener("click", () => {
    const v = (dom.searchInput.value || "").trim();
    if (!v) return;
    loadCity(v);
    showScreen("home");
  });

  dom.searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") dom.searchBtn.click();
  });

  // ---------- Boot ----------
  // Set initial background (fallback) before data loads
  setBackground("cloudy", null);
  showScreen("home");
  loadCity(state.city);
})();
