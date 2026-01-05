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
    confidenceBar: $("confidenceBar"),
    todayExtreme: $("todayExtreme"),
    rainChance: $("rainChance"),
    uvIndex: $("uvIndex"),
    confidenceLevel: $("confidenceLevel"),
    confidenceExplanation: $("confidenceExplanation"),
    feelsLike: $("feelsLike"),
    windKph: $("windKph"),
    humidity: $("humidity"),
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
  const fmtTemp = (n) => (Number.isFinite(n) ? `${Math.round(n)}°${C.units.temp}` : null);
  const fmtWind = (n) => (Number.isFinite(n) ? `${Math.round(n)} ${C.units.wind}` : null);
  const fmtPct = (n) => (Number.isFinite(n) ? `${Math.round(n)}%` : null);
  const fmtUV = (n) => (Number.isFinite(n) ? `${Math.round(n)}` : null);

  // Simple hash function for deterministic variant selection
  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  // Get vibe bucket from conditionKey and tempC
  function getVibeBucket(conditionKey, tempC) {
    if (!conditionKey) conditionKey = "unknown";
    const key = String(conditionKey).toLowerCase().trim();
    
    // OVERRIDES: storm/rain/fog/wind ALWAYS win if conditionKey indicates them
    if (key === "storm") return "STORMY";
    if (key === "rain") return "RAINY";
    if (key === "fog") return "FOGGY";
    if (key === "wind") return "WINDY";
    
    // PRIMARY: map conditionKey → bucket
    if (key === "clear") {
      // Temp-based hot/cold only for neutral conditions (cloudy/clear)
      if (Number.isFinite(tempC)) {
        if (tempC < 10) return "COLD";
        if (tempC > 25) return "HOT";
      }
      return "CLEAR";
    }
    if (key === "cloudy") {
      // Temp-based hot/cold only for neutral conditions
      if (Number.isFinite(tempC)) {
        if (tempC < 10) return "COLD";
        if (tempC > 25) return "HOT";
      }
      return "CLOUDY";
    }
    
    // Temp-based hot/cold only when conditionKey is missing/unknown
    if (key === "unknown" && Number.isFinite(tempC)) {
      if (tempC < 10) return "COLD";
      if (tempC > 25) return "HOT";
    }
    
    // Default fallback
    return "CLOUDY";
  }

  // Vibe variant definitions
  const vibeVariants = {
    CLEAR: ["This is clear.", "Clear and calm.", "Good weather today."],
    CLOUDY: ["This is cloudy.", "It's one of those days.", "Mostly just cloudy."],
    RAINY: ["This is rainy.", "Rain is in charge today.", "It's a wet one."],
    STORMY: ["This is stormy.", "Storms are the story today.", "Rough weather out there."],
    WINDY: ["This is windy.", "Wind has opinions today.", "Hold onto your hat."],
    COLD: ["This is cold.", "Properly cold today.", "Cold enough to feel it."],
    HOT: ["This is hot.", "Hot and heavy.", "Heat is the story today."],
    FOGGY: ["This is foggy.", "Low visibility kind of day.", "Mist everywhere."]
  };

  // Get deterministic vibe variant
  function getVibeVariant(vibeBucket, locationName, date) {
    const variants = vibeVariants[vibeBucket] || vibeVariants.CLOUDY;
    const dateStr = date ? date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const seed = (locationName || "") + dateStr;
    const hash = simpleHash(seed);
    const index = hash % variants.length;
    return variants[index];
  }

  // Witty line fallbacks per vibe bucket
  function getWittyFallback(vibeBucket) {
    const fallbacks = {
      CLEAR: "Not always braai on a clear day.",
      CLOUDY: "Cloudy means maybe.",
      RAINY: "Rain changes plans.",
      STORMY: "Storms demand respect.",
      WINDY: "Wind has its say.",
      COLD: "Cold is cold.",
      HOT: "Heat is the story.",
      FOGGY: "Fog hides things."
    };
    return fallbacks[vibeBucket] || "Weather is weather.";
  }

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
  function getWitty(conditionKey, isWeekend, vibeBucket) {
    const key = pickToneKey(conditionKey);
    const t = C.conditionTone[key] || C.conditionTone.unknown;
    if (isWeekend && key === 'clear') return "Braai weather, boet!";
    if (t.vibe && t.vibe.trim()) return t.vibe;
    return getWittyFallback(vibeBucket);
  }
  function renderTone(conditionKey) {
    const key = pickToneKey(conditionKey);
    const t = C.conditionTone[key] || C.conditionTone.unknown;
    if (dom.toneTitle) dom.toneTitle.textContent = t.title || "Unclear";
    if (dom.toneVibe) dom.toneVibe.textContent = t.vibe || "Hard to call.";
    if (dom.toneNote) dom.toneNote.textContent = t.note || "We'll show what we can.";
  }
  function renderConfidence(confKey, data) {
    // Safe default config if C.confidence is missing
    const cfg = (C && C.confidence) ? C.confidence : { high: 0.72, mixed: 0.50 };
    
    // Determine forecast count from various possible fields
    const count = data?.sourcesUsed?.length ?? data?.usedSources?.length ?? data?.sources?.length ?? data?.meta?.sourcesUsed?.length ?? (data?.meta?.sources ? data.meta.sources.filter(s => s && s.ok).length : 0);
    
    // Determine confidence level - prioritize confKey if available, then score, then default
    let level = "Medium"; // Default
    if (confKey && cfg[confKey]) {
      // Use confKey mapping if available
      const conf = cfg[confKey];
      const confLabel = conf?.label || "Mixed";
      level = confLabel === 'Strong' ? 'High' : confLabel === 'Decent' ? 'Medium' : 'Low';
    } else {
      // Fallback to score-based determination
      const score = data?.agreementScore ?? data?.agreement ?? data?.confidence?.score ?? null;
      if (score !== null && score !== undefined) {
        if (score >= (cfg.high || 0.72)) {
          level = "High";
        } else if (score >= (cfg.mixed || 0.50)) {
          level = "Medium";
        } else {
          level = "Low";
        }
      }
    }
    
    // Update confidence badge in hero
    if (dom.confidencePill) {
      const badgeLabel = level === 'High' ? 'STRONG' : level === 'Medium' ? 'DECENT' : 'MIXED';
      dom.confidencePill.textContent = `PROBABLY · ${badgeLabel} CONFIDENCE`;
    }
    
    // Update confidence card with exact wording
    if (dom.confidenceLevel) {
      dom.confidenceLevel.textContent = `Confidence: ${level}`;
    }
    
    // Update explanation with exact wording
    if (dom.confidenceExplanation) {
      dom.confidenceExplanation.textContent = `Based on ${count} forecasts →`;
    }
    
    // Update note and bar (safe access)
    if (dom.confidenceNote && cfg[confKey] && cfg[confKey].long) {
      dom.confidenceNote.textContent = cfg[confKey].long;
    } else if (dom.confidenceNote) {
      dom.confidenceNote.textContent = "Sources disagree — this is classic 50/50 weather.";
    }
    const barWidth = level === 'High' ? 100 : level === 'Medium' ? 66 : 33;
    if (dom.confidenceBar) {
      dom.confidenceBar.style.width = `${barWidth}%`;
    }
  }
  function renderSources(list) {
    if (!Array.isArray(list) || list.length === 0) {
      if (dom.sourcesList) dom.sourcesList.textContent = "No sources available";
      return;
    }
    if (dom.sourcesList) {
      dom.sourcesList.textContent = list
        .map((s) => `${s.name}${s.ok ? "" : " (down)"}`)
        .join(" • ");
    }
  }
  function renderHourly(hourly) {
    if (!dom.hourlyList) return;
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
        <div class="row-mid">${fmtTemp(h.tempC) || "—"}</div>
        <div class="row-right">${fmtPct(h.rainChance) || "—"} • ${fmtWind(h.windKph) || "—"}</div>
      `;
      frag.appendChild(row);
    });
    dom.hourlyList.appendChild(frag);
  }
  function renderWeek(days) {
    if (!dom.weekList) return;
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
        <div class="row-mid">${fmtTemp(d.highC) || "—"} / ${fmtTemp(d.lowC) || "—"}</div>
        <div class="row-right">${fmtPct(d.rainChance) || "—"}${Number.isFinite(d.uv) ? ` • UV ${Math.round(d.uv)}` : ""}</div>
      `;
      frag.appendChild(row);
    });
    dom.weekList.appendChild(frag);
  }
  // Province abbreviation mapping for South Africa
  function getProvinceAbbrev(admin1) {
    if (!admin1) return null;
    const abbrevMap = {
      "Western Cape": "WC",
      "Eastern Cape": "EC",
      "Northern Cape": "NC",
      "Free State": "FS",
      "KwaZulu-Natal": "KZN",
      "Gauteng": "GP",
      "Limpopo": "LP",
      "Mpumalanga": "MP",
      "North West": "NW"
    };
    return abbrevMap[admin1] || null;
  }

  function renderHome(data) {
    // Defensive fallbacks for all fields
    const locationName = data?.location?.name || state.city || "Unknown";
    const country = data?.location?.country || "";
    const tempC = data?.now?.tempC;
    const conditionKey = data?.now?.conditionKey;
    const daily = data?.daily || [];
    const today = daily[0] || {};
    
    // City and location suffix (province abbrev or country code)
    const admin1Abbrev = getProvinceAbbrev(data?.location?.admin1);
    const suffix = admin1Abbrev || data?.location?.countryCode || "";
    const locationDisplay = suffix ? `${locationName}, ${suffix}` : locationName;
    if (dom.cityName) dom.cityName.textContent = locationDisplay;
    if (dom.countryName) dom.countryName.textContent = "";
    
    // Updated time
    if (dom.updatedAt) {
      dom.updatedAt.textContent = data?.meta?.updatedAtLabel || new Date().toLocaleString();
    }
    
    // Get vibe bucket and variant
    const vibeBucket = getVibeBucket(conditionKey, tempC);
    const todayDate = new Date();
    const vibeStatement = getVibeVariant(vibeBucket, locationName, todayDate);
    
    // Render vibe statement (primary headline)
    if (dom.conditionText) dom.conditionText.textContent = vibeStatement;
    
    // Calculate temp range from daily[0] if available, otherwise use current temp
    let tempDisplay = "";
    if (Number.isFinite(today.highC) && Number.isFinite(today.lowC)) {
      tempDisplay = `${Math.round(today.lowC)}–${Math.round(today.highC)}°${C.units.temp}`;
    } else if (Number.isFinite(tempC)) {
      tempDisplay = `${Math.round(tempC)}°${C.units.temp}`;
    } else {
      tempDisplay = "—";
    }
    if (dom.bigTemp) dom.bigTemp.textContent = tempDisplay;
    
    // Witty line (never blank)
    const isWeekend = todayDate.getDay() === 0 || todayDate.getDay() === 6;
    const witty = getWitty(conditionKey, isWeekend, vibeBucket);
    if (dom.wittyLine) dom.wittyLine.textContent = witty || getWittyFallback(vibeBucket);
    
    // Sidebar cards
    // Today's extreme
    if (dom.todayExtreme) {
      const conditionLabel = data?.now?.conditionLabel || today.conditionLabel || "Clear";
      if (Number.isFinite(today.highC) && Number.isFinite(today.lowC)) {
        dom.todayExtreme.textContent = `${conditionLabel}\n${Math.round(today.lowC)}–${Math.round(today.highC)}°${C.units.temp}`;
      } else if (Number.isFinite(tempC)) {
        dom.todayExtreme.textContent = `${conditionLabel}\n${Math.round(tempC)}°${C.units.temp}`;
      } else {
        dom.todayExtreme.textContent = conditionLabel;
      }
    }
    
    // Rain
    if (dom.rainChance) {
      const rainPct = data?.now?.rainChance ?? today.rainChance;
      if (Number.isFinite(rainPct) && rainPct > 0) {
        dom.rainChance.textContent = `${Math.round(rainPct)}%`;
      } else {
        dom.rainChance.textContent = "None expected";
      }
    }
    
    // UV
    if (dom.uvIndex) {
      const uv = data?.now?.uv ?? today.uv;
      if (Number.isFinite(uv)) {
        const uvLevel = uv >= 8 ? "High" : uv >= 6 ? "Moderate" : uv >= 3 ? "Low" : "Very Low";
        dom.uvIndex.textContent = `${uvLevel} (${Math.round(uv)})`;
      } else {
        dom.uvIndex.textContent = "—";
      }
    }
    
    // Confidence (rendered separately with exact wording)
    renderConfidence(data?.consensus?.confidenceKey, data);
    
    // Legacy fields (keep for compatibility)
    if (dom.feelsLike) {
      const feels = fmtTemp(data?.now?.feelsLikeC);
      dom.feelsLike.textContent = feels || "—";
    }
    if (dom.windKph) {
      const wind = fmtWind(data?.now?.windKph);
      dom.windKph.textContent = wind || "—";
    }
    if (dom.humidity) {
      const hum = fmtPct(data?.now?.humidity);
      dom.humidity.textContent = hum || "—";
    }
    
    // Tone and sources
    renderTone(conditionKey);
    renderSources(data?.meta?.sources);
    
    // Background and particles
    setBackground(conditionKey, tempC);
    setParticles(conditionKey);
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
    if (dom.searchHint) dom.searchHint.textContent = "";
    try {
      state.city = city;
      const data = await fetchWeather(city);
      state.lastData = data;
      renderHome(data);
      renderHourly(data.hourly);
      renderWeek(data.daily);
    } catch (err) {
      console.error(err);
      if (dom.searchHint) dom.searchHint.textContent = "Couldn't load that city. Try another spelling.";
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
  if (dom.searchBtn) {
    dom.searchBtn.addEventListener("click", () => {
      const v = (dom.searchInput?.value || "").trim();
      if (!v) return;
      loadCity(v);
      showScreen("home");
    });
  }
  if (dom.searchInput) {
    dom.searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && dom.searchBtn) dom.searchBtn.click();
    });
  }
  // ---------- Boot ----------
  setBackground("cloudy", null);
  setParticles("cloudy");
  showScreen("home");
  loadCity(state.city);
})();
