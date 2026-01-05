(() => {
  const C = window.PW_CONFIG;
  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const $q = (sel) => document.querySelector(sel);
  const dom = {
    subhead: $("subhead"),
    updatedAt: $("updatedAt"),
    cityName: $("cityName"),
    countryName: $("countryName"),
    bigTemp: $("bigTemp"),
    conditionText: $("conditionText"),
    wittyLine: $("wittyLine"),
    confidencePill: $("confidencePill"),
    confidenceNote: $("confidenceNote"),
    confidenceBar: $("confidenceBar"), // New
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
    header: $q(".header"),
    hero: $q(".hero"),
    sidebar: $("sidebar"),
    screenHourly: $("screen-hourly"),
    screenWeek: $("screen-week"),
    screenSearch: $("screen-search"),
    screenSettings: $("screen-settings"),
    bgImg: $("bgImg"),
    particles: $("particles"),
  };
  const screens = {
    home: dom.hero,
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
  function getTimeOfDay() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 7) return "dawn";
    if (hour >= 7 && hour < 18) return "day";
    if (hour >= 18 && hour < 20) return "dusk";
    return "night";
  }
  function getBackgroundImagePath(conditionKey, tempC) {
    if (!conditionKey) conditionKey = "unknown";
    const key = String(conditionKey).toLowerCase().trim();
    const folder = C.assets.conditionToFolder[key] || C.assets.fallbackFolder;
    const timeOfDay = getTimeOfDay();
    const imagePath = `${C.assets.bgBasePath}/${folder}/${timeOfDay}.jpg`;
    return imagePath;
  }
  function setBackground(conditionKey, tempC) {
    if (!dom.bgImg) return;
    const imagePath = getBackgroundImagePath(conditionKey, tempC);
    dom.bgImg.src = imagePath;
    document.body.className = document.body.className
      .split(/\s+/)
      .filter(c => !c.startsWith("weather-"))
      .join(" ");
    const weatherClass = `weather-${String(conditionKey || "unknown").toLowerCase().trim()}`;
    document.body.classList.add(weatherClass);
  }
  function setParticles(conditionKey) {
    dom.particles.innerHTML = "";
    const key = conditionKey?.toLowerCase() || 'unknown';
    let numParticles = 0;
    let particleClass = 'particle';
    let animation = 'fall';
    if (key === 'rain') {
      numParticles = 100;
      particleClass += ' rain-particle';
      animation = 'fall';
    } else if (key === 'storm') {
      numParticles = 50;
      particleClass += ' storm-particle';
      animation = 'gust';
    } else if (key === 'wind') {
      numParticles = 30;
      particleClass += ' wind-particle';
      animation = 'gust';
    } else if (key === 'fog') {
      numParticles = 20;
      particleClass += ' fog-particle';
      animation = 'float';
    }
    for (let i = 0; i < numParticles; i++) {
      const p = document.createElement('div');
      p.className = particleClass;
      p.style.left = `${Math.random() * 100}%`;
      p.style.animationDuration = `${Math.random() * 3 + 1}s`;
      p.style.animationDelay = `${Math.random() * 2}s`;
      dom.particles.appendChild(p);
    }
  }
  function setActiveNav(target) {
    document.querySelectorAll(".nav-btn").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.target === target);
    });
  }
  function showScreen(target) {
    // Hide all screens
    Object.keys(screens).forEach((key) => {
      const screen = screens[key];
      if (screen) {
        screen.style.display = 'none';
      }
    });
    // Show target screen
    const targetScreen = screens[target];
    if (targetScreen) {
      targetScreen.style.display = 'block';
    }
    // Home-specific: show/hide header, sidebar, hero
    if (target === 'home') {
      dom.header.style.display = 'flex';
      dom.sidebar.style.display = 'block';
      dom.hero.style.display = 'block';
    } else {
      dom.header.style.display = 'none';
      dom.sidebar.style.display = 'none';
      dom.hero.style.display = 'none';
    }
    setActiveNav(target);
  }
  function pickToneKey(conditionKey) {
    if (!conditionKey) return "unknown";
    const key = conditionKey.toLowerCase();
    return C.conditionTone[key] ? key : "unknown";
  }
  function getWitty(conditionKey, isWeekend) {
    const key = pickToneKey(conditionKey);
    const t = C.conditionTone[key] || C.conditionTone.unknown;
    if (isWeekend && key === 'clear') return "Braai weather, boet!";
    return t.vibe;
  }
  function renderTone(conditionKey) {
    const key = pickToneKey(conditionKey);
    const t = C.conditionTone[key] || C.conditionTone.unknown;
    dom.toneTitle.textContent = t.title;
    dom.toneVibe.textContent = t.vibe;
    dom.toneNote.textContent = t.note;
  }
  function renderConfidence(confKey, data) {
    const conf = C.confidence[confKey] || C.confidence.mixed;
    dom.confidencePill.textContent = `${conf.label} Agreement`;
    dom.confidenceNote.textContent = `${conf.long} Aggregated from 3 sources.`;
    const barWidth = conf.label === 'Strong' ? 100 : conf.label === 'Decent' ? 66 : 33;
    dom.confidenceBar.style.width = `${barWidth}%`;
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
    renderConfidence(data.consensus?.confidenceKey, data);
    renderSources(data.meta?.sources);
    setBackground(data.now?.conditionKey, data.now?.tempC);
    setParticles(data.now?.conditionKey);
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
    }
  }
  // ---------- Events ----------
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const t = btn.dataset.target;
      if (t) {
        showScreen(t);
      }
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
  setBackground("cloudy", null);
  setParticles("cloudy");
  showScreen("home");
  loadCity(state.city);
})();