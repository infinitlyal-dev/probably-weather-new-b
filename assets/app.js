// assets/app.js
(() => {
  const C = window.PW_CONFIG;
  // DOM elements updated for new cards
  const $ = (id) => document.getElementById(id);
  const $q = (sel) => document.querySelector(sel);
  const dom = {
    subhead: $("subhead"),
    updatedAt: $("updatedAt"),
    cityName: $("cityName"),
    countryName: $("countryName"),
    savePlace: $("savePlace"),
    bigTemp: $("bigTemp"),
    conditionText: $("conditionText"),
    wittyLine: $("wittyLine"),
    confidencePill: $("confidencePill"),
    confidenceNote: $("confidenceNote"),
    feelsLike: $("feelsLike"),
    windKph: $("windKph"),
    humidity: $("humidity"),
    rainChance: $("rainChance"),
    extremeValue: $("extremeValue"),
    rainValue: $("rainValue"),
    uvValue: $("uvValue"),
    confidenceLevel: $("confidenceLevel"),
    confidenceBar: $("confidenceBar"),
    confidenceSources: $("confidenceSources"),
    toneTitle: $("toneTitle"),
    toneVibe: $("toneVibe"),
    toneNote: $("toneNote"),
    hourlyList: $("hourlyList"),
    weekList: $("weekList"),
    searchInput: $("searchInput"),
    searchBtn: $("searchBtn"),
    searchHint: $("searchHint"),
    searchResults: $("searchResults"),
    sourcesList: $("sourcesList"),
    wittyToggle: $("wittyToggle"),
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
  // State
  let state = {
    city: "Cape Town",
    lastData: null,
    favorites: JSON.parse(localStorage.getItem('favorites') || '[]'),
    witty: localStorage.getItem('witty') !== 'false', // Default true
  };
  // Helpers
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
  function getConditionFolder(key, tempC) {
    if (tempC > C.temperature.heatThreshold) return "heat";
    if (tempC < C.temperature.coldThreshold) return "cold";
    return C.assets.conditionToFolder[key] || C.assets.fallbackFolder;
  }
  function getBackgroundImagePath(conditionKey, tempC) {
    if (!conditionKey) conditionKey = "unknown";
    const key = String(conditionKey).toLowerCase().trim();
    const folder = getConditionFolder(key, tempC);
    const timeOfDay = getTimeOfDay();
    return `${C.assets.bgBasePath}/${folder}/${timeOfDay}.jpg`;
  }
  function setBackground(conditionKey, tempC) {
    if (!dom.bgImg) return;
    const imagePath = getBackgroundImagePath(conditionKey, tempC);
    dom.bgImg.src = imagePath;
    document.body.className = document.body.className
      .split(/\s+/)
      .filter(c => !c.startsWith("weather-"))
      .join(" ");
    const weatherClass = `weather-${getConditionFolder(conditionKey?.toLowerCase() || "unknown", tempC)}`;
    document.body.classList.add(weatherClass);
  }
  function setParticles(conditionKey) {
    dom.particles.innerHTML = '';
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
    } else if (key === 'cold') {
      numParticles = 80;
      particleClass += ' snow-particle';
      animation = 'fall';
    } // Add more
    for (let i = 0; i < numParticles; i++) {
      const p = document.createElement('div');
      p.className = particleClass;
      p.style.left = `${Math.random() * 100}%`;
      p.style.animationDuration = `${Math.random() * 3 + 1}s`;
      p.style.animationDelay = `${Math.random() * 2}s`;
      p.style.opacity = 0.8; // Increase visibility
      dom.particles.appendChild(p);
    }
  }
  function setActiveNav(target) {
    document.querySelectorAll(".nav-btn").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.target === target);
    });
  }
  function showScreen(target) {
    Object.keys(screens).forEach((key) => {
      const screen = screens[key];
      if (screen) {
        screen.style.display = (key === target ? 'block' : 'none');
      }
    });
    const isHome = target === 'home';
    dom.header.style.display = isHome ? 'flex' : 'none';
    dom.sidebar.style.display = isHome ? 'block' : 'none';
    setActiveNav(target);
  }
  function getRainDesc(chance) {
    if (chance < 10) return C.rainDescs[0];
    if (chance < 30) return C.rainDescs.low;
    if (chance < 50) return C.rainDescs.medium;
    if (chance < 80) return C.rainDescs.high;
    return C.rainDescs.heavy;
  }
  function getUvLevel(uv) {
    if (uv < 3) return C.uvLevels.low + ` (${Math.round(uv)})`;
    if (uv < 6) return C.uvLevels.medium + ` (${Math.round(uv)})`;
    if (uv < 8) return C.uvLevels.high + ` (${Math.round(uv)})`;
    return C.uvLevels.veryHigh + ` (${Math.round(uv)})`;
  }
  function pickToneKey(conditionKey) {
    if (!conditionKey) return "unknown";
    const key = conditionKey.toLowerCase();
    return C.conditionTone[key] ? key : "unknown";
  }
  function getWitty(conditionKey, isWeekend, isWitty) {
    const key = pickToneKey(conditionKey);
    const t = C.conditionTone[key] || C.conditionTone.unknown;
    if (isWitty) {
      if (isWeekend && key === 'clear') return t.witty;
      return t.witty || t.vibe;
    }
    return t.plain || t.vibe;
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
    dom.confidenceLevel.textContent = conf.label;
    const barWidth = conf.label === 'High' ? 100 : conf.label === 'Medium' ? 66 : 33;
    dom.confidenceBar.style.width = `${barWidth}%`;
    dom.confidenceSources.textContent = `Aggregated from 3 sources`;
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
  function renderHome(data) {
    dom.cityName.textContent = data.location?.name || state.city || "—";
    dom.countryName.textContent = data.location?.country || "—";
    const today = data.daily?.[0] || {};
    dom.bigTemp.textContent = `${fmtTemp(today.lowC)}—${fmtTemp(today.highC)}`;
    dom.conditionText.textContent = `This is ${data.now?.conditionLabel?.toLowerCase() || "unclear"}.`;
    const isWeekend = new Date().getDay() >= 5 || new Date().getDay() === 0;
    dom.wittyLine.textContent = getWitty(data.now?.conditionKey, isWeekend, state.witty);
    dom.updatedAt.textContent = data.meta?.updatedAtLabel || "—";
    dom.feelsLike.textContent = fmtTemp(data.now?.feelsLikeC);
    dom.windKph.textContent = fmtWind(data.now?.windKph);
    dom.humidity.textContent = fmtPct(data.now?.humidity);
    dom.rainChance.textContent = fmtPct(data.now?.rainChance);
    dom.extremeValue.textContent = `${data.now.conditionLabel} ${dom.bigTemp.textContent}`;
    dom.rainValue.textContent = getRainDesc(data.now.rainChance);
    dom.uvValue.textContent = getUvLevel(data.now.uv);
    renderTone(data.now?.conditionKey);
    renderConfidence(data.consensus?.confidenceKey, data);
    renderSources(data.meta?.sources);
    setBackground(data.now?.conditionKey, data.now?.tempC);
    setParticles(data.now?.conditionKey);
    // Favorites star
    dom.savePlace.classList.toggle('saved', state.favorites.includes(state.city));
  }
  function renderHourly(hourly) {
    // Same as before, but add icons if desired (e.g., emoji for condition)
    dom.hourlyList.innerHTML = "";
    if (!Array.isArray(hourly) || hourly.length === 0) {
      dom.hourlyList.textContent = "No hourly data.";
      return;
    }
    const currentHour = new Date().getHours();
    const shiftedHourly = hourly.slice(currentHour).concat(hourly.slice(0, currentHour));
    const frag = document.createDocumentFragment();
    shiftedHourly.forEach((h, index) => {
      const isTomorrow = index >= (24 - currentHour);
      const timeLabel = isTomorrow ? `Tomorrow ${h.timeLocal}` : h.timeLocal;
      const icon = getConditionIcon(h.conditionKey); // Add function for emoji/icons
      const row = document.createElement("div");
      row.className = "row";
      row.innerHTML = `
        <div class="row-left">
          <div class="row-time">${timeLabel || "—"}</div>
          <div class="row-small">${icon} ${h.conditionLabel || ""}</div>
        </div>
        <div class="row-mid">${fmtTemp(h.tempC)}</div>
        <div class="row-right">${fmtPct(h.rainChance)} • ${fmtWind(h.windKph)}</div>
      `;
      frag.appendChild(row);
    });
    dom.hourlyList.appendChild(frag);
  }
  // Add similar for renderWeek with icons
  function getConditionIcon(key) {
    const icons = {
      clear: '☀️',
      cloudy: '☁️',
      rain: '🌧️',
      storm: '⛈️',
      fog: '🌫️',
      wind: '🌬️',
      cold: '❄️',
      hot: '🔥',
      unknown: '❓'
    };
    return icons[key.toLowerCase()] || '';
  }
  async function fetchNominatim(query) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`;
    const res = await fetch(url);
    return res.ok ? res.json() : [];
  }
  async function handleSearch() {
    const v = (dom.searchInput.value || "").trim();
    if (!v) return;
    dom.searchResults.innerHTML = '';
    const results = await fetchNominatim(v);
    const frag = document.createDocumentFragment();
    results.forEach((r) => {
      const item = document.createElement('div');
      item.className = 'search-item';
      item.textContent = r.display_name;
      item.addEventListener('click', () => {
        loadCity(r.display_name);
        showScreen("home");
      });
      frag.appendChild(item);
    });
    dom.searchResults.appendChild(frag);
  }
  function toggleFavorite() {
    const idx = state.favorites.indexOf(state.city);
    if (idx > -1) {
      state.favorites.splice(idx, 1);
    } else if (state.favorites.length < 5) {
      state.favorites.push(state.city);
    }
    localStorage.setItem('favorites', JSON.stringify(state.favorites));
    dom.savePlace.classList.toggle('saved', state.favorites.includes(state.city));
  }
  function toggleWitty(e) {
    state.witty = e.target.checked;
    localStorage.setItem('witty', state.witty);
    if (state.lastData) renderHome(state.lastData); // Refresh witty
  }
  // Events
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const t = btn.dataset.target;
      if (t && screens[t]) {
        showScreen(t);
      }
    });
  });
  dom.searchBtn.addEventListener("click", handleSearch);
  dom.searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSearch();
  });
  dom.savePlace.addEventListener("click", toggleFavorite);
  dom.wittyToggle.addEventListener("change", toggleWitty);
  dom.wittyToggle.checked = state.witty;
  // Boot
  setBackground("cloudy", null);
  setParticles("cloudy");
  showScreen("home");
  loadCity(state.city);
})();