document.addEventListener("DOMContentLoaded", () => {
  const $ = (sel) => document.querySelector(sel);

  // ========== DOM ELEMENTS ==========
  const locationEl = $('#location');
  const headlineEl = $('#headline');
  const tempEl = $('#temp');
  const descriptionEl = $('#description');
  const extremeValueEl = $('#extremeValue');
  const rainValueEl = $('#rainValue');
  const uvValueEl = $('#uvValue');
  const confidenceEl = $('#confidence');
  const sourcesEl = $('#sources');
  const bgImg = $('#bgImg');
  const saveCurrent = $('#saveCurrent');
  const particlesEl = $('#particles');

  const navHome = $('#navHome');
  const navHourly = $('#navHourly');
  const navWeek = $('#navWeek');
  const navSearch = $('#navSearch');
  const navSettings = $('#navSettings');

  const screenHome = $('#home-screen');
  const screenHourly = $('#hourly-screen');
  const screenWeek = $('#week-screen');
  const screenSearch = $('#search-screen');
  const screenSettings = $('#settings-screen');

  const hourlyTimeline = $('#hourly-timeline');
  const dailyCards = $('#daily-cards');

  const searchInput = $('#searchInput');
  const favoritesList = $('#favoritesList');
  const recentList = $('#recentList');

  const loader = $('#loader');

  // ========== CONSTANTS ==========
  const STORAGE = {
    favorites: "pw_favorites",
    recents: "pw_recents",
    home: "pw_home"
  };

  const SCREENS = [screenHome, screenHourly, screenWeek, screenSearch, screenSettings];

  // Thresholds from product spec
  const THRESH = {
    RAIN_PCT: 40,
    WIND_KPH:  25,
    COLD_C: 16,
    HOT_C: 32
  };

  // ========== STATE ==========
  let activePlace = null;
  let homePlace = null;

  // ========== UTILITY FUNCTIONS ==========
  const safeText = (el, txt) => { if (el) el.textContent = txt ??  "--"; };
  const isNum = (v) => typeof v === "number" && Number.isFinite(v);
  function round0(n) { return isNum(n) ? Math.round(n) : null; }

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON. parse(raw) : fallback;
    } catch { return fallback; }
  }

  function saveJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }

  function samePlace(a, b) {
    if (! a || !b) return false;
    return Number(a.lat).toFixed(4) === Number(b.lat).toFixed(4) &&
           Number(a. lon).toFixed(4) === Number(b.lon).toFixed(4);
  }

  function hashString(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i);
    return h;
  }

  // ========== SCREEN NAVIGATION ==========
  function showScreen(which) {
    SCREENS.forEach(s => { if (s) s.classList.add("hidden"); });
    if (which) which.classList.remove("hidden");
  }

  function showLoader(show) {
    if (loader) loader.classList[show ? 'remove' : 'add']('hidden');
  }

  // ========== SINGLE SOURCE OF TRUTH ==========
  // This function determines the dominant weather condition
  // Priority: Storm > Rain > Wind > Cold > Heat > Fog > Clear
  function computeDominantCondition(norm) {
    const condKey = (norm.conditionKey || "").toLowerCase();
    const rain = norm.rainPct;
    const wind = norm.windKph;
    const hi = norm.todayHigh;

    // 1. STORM
    if (condKey === "storm" || condKey. includes("thunder")) {
      return "storm";
    }

    // 2. RAIN (>=40%)
    if (isNum(rain) && rain >= THRESH.RAIN_PCT) {
      return "rain";
    }

    // 3. WIND (>=25 km/h)
    if (isNum(wind) && wind >= THRESH.WIND_KPH) {
      return "wind";
    }

    // 4. COLD (max <=16°C)
    if (isNum(hi) && hi <= THRESH. COLD_C) {
      return "cold";
    }

    // 5. HEAT (max >=32°C)
    if (isNum(hi) && hi >= THRESH.HOT_C) {
      return "heat";
    }

    // 6. FOG
    if (condKey === "fog" || condKey.includes("mist") || condKey.includes("haze")) {
      return "fog";
    }

    // 7. CLEAR (default)
    return "clear";
  }

  // ========== CONDITION-DRIVEN DISPLAY ==========
  function getHeadline(condition) {
    const map = {
      storm: "This is stormy.",
      rain: "This is rainy.",
      wind: "This is windy.",
      cold: "This is cold.",
      heat: "This is hot.",
      fog: "This is foggy.",
      clear: "This is clear."
    };
    return map[condition] || "This is weather. ";
  }

  function getExtremeLabel(condition) {
    const map = {
      storm: "Severe weather",
      rain: "Wet conditions",
      wind:  "Gusty",
      cold: "Chilly",
      heat: "Very hot",
      fog: "Low visibility",
      clear: "Pleasant"
    };
    return map[condition] || "Moderate";
  }

  function getWittyLine(condition, rainPct) {
    const day = new Date().getDay();
    const isWeekend = day === 0 || day === 5 || day === 6;

    if (isWeekend && condition === "clear") {
      return "Braai weather, boet!";
    }

    const lines = {
      storm: "Electric vibes.  Don't be the tallest thing outside.",
      rain: isNum(rainPct) && rainPct >= 70 ? "Plan indoors — today's moody." : "Keep a jacket close.",
      wind: "Hold onto your hat.",
      cold: "Ja, it's jacket weather.",
      heat: "Big heat — pace yourself outside.",
      fog: "Visibility vibes:  drive like you've got a gran in the back.",
      clear: "Good day to get stuff done outside."
    };

    return lines[condition] || "Just...  probably. ";
  }

  // ========== BACKGROUND ==========
  function setBackgroundFor(condition) {
    const base = "assets/images/bg";
    const folder = condition;
    const n = 1 + (Math.abs(hashString(condition + (activePlace?. name || ""))) % 4);
    const path = `${base}/${folder}/${folder}${n}.jpg`;

    if (bgImg) {
      bgImg.onerror = () => {
        bgImg. onerror = () => {
          bgImg. src = `${base}/clear/clear1.jpg`;
        };
        bgImg.src = `${base}/${folder}/${folder}1.jpg`;
      };
      bgImg.src = path;
    }
  }

  // ========== PARTICLES ==========
  function createParticles(condition) {
    if (! particlesEl) return;
    particlesEl.innerHTML = "";

    if (condition === "rain" || condition === "storm") {
      for (let i = 0; i < 20; i++) {
        const p = document.createElement("div");
        p.classList.add("particle");
        p.style.left = `${Math.random() * 100}%`;
        p.style.animationDuration = `${Math.random() * 3 + 2}s`;
        p.style.animationDelay = `${Math.random() * 2}s`;
        particlesEl.appendChild(p);
      }
    }
  }

  // ========== API FETCH ==========
  async function fetchWeather(place) {
    const url = `/api/weather? lat=${encodeURIComponent(place.lat)}&lon=${encodeURIComponent(place. lon)}&name=${encodeURIComponent(place.name || "")}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("API error");
    return await response.json();
  }

  // ========== NORMALIZE API RESPONSE ==========
  // Converts API response to internal format
  function normalizePayload(payload) {
    const now = payload.now || {};
    const today = (payload.daily && payload.daily[0]) || {};
    const meta = payload.meta || {};
    const sources = meta.sources || [];

    return {
      nowTemp: now.tempC,
      feelsLike: now.feelsLikeC,
      todayHigh: today.highC,
      todayLow: today.lowC,
      rainPct: today.rainChance,
      uv: today.uv,
      windKph: now. windKph,
      conditionKey: now. conditionKey || today.conditionKey || "unknown",
      conditionLabel: now.conditionLabel || today.conditionLabel || "Weather",
      confidenceKey: (payload.consensus && payload.consensus. confidenceKey) || "mixed",
      used: sources.filter(function(s) { return s.ok; }).map(function(s) { return s.name; }),
      failed: sources.filter(function(s) { return !s.ok; }).map(function(s) { return s.name; }),
      hourly: payload.hourly || [],
      daily: payload.daily || []
    };
  }

  // ========== RENDER FUNCTIONS ==========
  function renderLoading(name) {
    showLoader(true);
    safeText(locationEl, name);
    safeText(headlineEl, "Loading...");
    safeText(tempEl, "--°");
    safeText(descriptionEl, "—");
    safeText(extremeValueEl, "--");
    safeText(rainValueEl, "--");
    safeText(uvValueEl, "--");
    safeText(confidenceEl, "PROBABLY • —");
    safeText(sourcesEl, "Sources: —");
  }

  function renderError(msg) {
    showLoader(false);
    safeText(headlineEl, "Error");
    safeText(descriptionEl, msg);
  }

  function renderHome(norm) {
    showLoader(false);

    const hi = norm.todayHigh;
    const low = norm.todayLow;
    const rain = norm.rainPct;
    const uv = norm.uv;

    // SINGLE SOURCE OF TRUTH - compute condition ONCE
    const condition = computeDominantCondition(norm);

    // Location
    safeText(locationEl, activePlace. name || "—");

    // Headline - driven by condition
    safeText(headlineEl, getHeadline(condition));

    // Temperature range
    const lowStr = isNum(low) ? round0(low) : "--";
    const hiStr = isNum(hi) ? round0(hi) : "--";
    safeText(tempEl, lowStr + "° – " + hiStr + "°");

    // Witty line - driven by condition
    safeText(descriptionEl, getWittyLine(condition, rain));

    // Today's extreme - driven by condition
    safeText(extremeValueEl, getExtremeLabel(condition));

    // Rain display
    if (isNum(rain)) {
      var rainText;
      if (rain < 10) rainText = "None expected";
      else if (rain < 30) rainText = "Unlikely";
      else if (rain < 55) rainText = "Possible";
      else rainText = "Likely";
      safeText(rainValueEl, rainText);
    } else {
      safeText(rainValueEl, "--");
    }

    // UV display
    if (isNum(uv)) {
      var uvText;
      if (uv < 3) uvText = "Low";
      else if (uv < 6) uvText = "Moderate";
      else if (uv < 8) uvText = "High";
      else if (uv < 11) uvText = "Very High";
      else uvText = "Extreme";
      safeText(uvValueEl, uvText + " (" + round0(uv) + ")");
    } else {
      safeText(uvValueEl, "--");
    }

    // Confidence
    var confLabel = (norm.confidenceKey || "mixed").toUpperCase();
    safeText(confidenceEl, "PROBABLY • " + confLabel + " CONFIDENCE");

    // Sources
    var usedTxt = norm.used. length ?  "Used: " + norm. used.join(", ") : "Used: —";
    var failedTxt = norm.failed. length ? "Failed:  " + norm.failed.join(", ") : "";
    safeText(sourcesEl, usedTxt + (failedTxt ?  " · " + failedTxt :  ""));

    // Background - uses SAME condition
    setBackgroundFor(condition);

    // Particles - uses SAME condition
    createParticles(condition);
  }

  function renderHourly(hourly) {
    if (!hourlyTimeline) return;
    hourlyTimeline.innerHTML = "";

    hourly.forEach(function(h) {
      var div = document.createElement("div");
      div.classList.add("hourly-card");

      var timeStr = h.timeLocal || "--";
      var tempStr = isNum(h.tempC) ? round0(h.tempC) + "°" : "--°";
      var rainStr = isNum(h.rainChance) ? round0(h.rainChance) + "%" : "--%";

      div.innerHTML = '<div class="hour-time">' + timeStr + '</div>' +
                      '<div class="hour-temp">' + tempStr + '</div>' +
                      '<div class="hour-rain">' + rainStr + '</div>';

      hourlyTimeline.appendChild(div);
    });
  }

  function renderWeek(daily) {
    if (!dailyCards) return;
    dailyCards.innerHTML = "";

    daily. forEach(function(d) {
      var div = document.createElement("div");
      div.classList.add("daily-card");

      var dayStr = d.dayLabel || "--";
      var lowStr = isNum(d.lowC) ? round0(d.lowC) : "--";
      var hiStr = isNum(d.highC) ? round0(d.highC) : "--";
      var rainStr = isNum(d.rainChance) ? round0(d.rainChance) + "%" : "--%";
      var descStr = d.conditionLabel || "—";

      div. innerHTML = '<div class="day-name">' + dayStr + '</div>' +
                      '<div class="day-temp">' + lowStr + '° – ' + hiStr + '°</div>' +
                      '<div class="day-rain">' + rainStr + '</div>' +
                      '<div class="day-humor">' + descStr + '</div>';

      dailyCards. appendChild(div);
    });
  }

  // ========== MAIN LOAD FUNCTION ==========
  async function loadAndRender(place) {
    activePlace = place;
    renderLoading(place. name || "My Location");

    try {
      var payload = await fetchWeather(place);
      var norm = normalizePayload(payload);
      renderHome(norm);
      renderHourly(norm. hourly);
      renderWeek(norm.daily);
    } catch (e) {
      console.error("Load failed:", e);
      renderError("Couldn't fetch weather right now.");
    }
  }

  // ========== FAVORITES & RECENTS ==========
  function loadFavorites() { return loadJSON(STORAGE.favorites, []); }
  function loadRecents() { return loadJSON(STORAGE.recents, []); }
  function saveFavorites(list) { saveJSON(STORAGE. favorites, list); }
  function saveRecents(list) { saveJSON(STORAGE.recents, list); }

  function addRecent(place) {
    var list = loadRecents().filter(function(p) { return !samePlace(p, place); });
    list.unshift(place);
    saveRecents(list. slice(0, 10));
    renderRecents();
  }

  function addFavorite(place) {
    var list = loadFavorites();
    if (list.some(function(p) { return samePlace(p, place); })) return;
    list. unshift(place);
    saveFavorites(list. slice(0, 5));
    renderFavorites();
  }

  function escapeHtml(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function renderRecents() {
    if (!recentList) return;
    var list = loadRecents();

    if (list.length === 0) {
      recentList.innerHTML = "<li>No recent searches yet. </li>";
      return;
    }

    recentList. innerHTML = list.map(function(p) {
      return '<li data-lat="' + p. lat + '" data-lon="' + p.lon + '" data-name="' + escapeHtml(p.name) + '">' + escapeHtml(p.name) + '</li>';
    }).join("");

    recentList.querySelectorAll("li[data-lat]").forEach(function(li) {
      li.addEventListener("click", function() {
        var p = { name: li.dataset.name, lat: parseFloat(li.dataset.lat), lon: parseFloat(li.dataset.lon) };
        addRecent(p);
        showScreen(screenHome);
        loadAndRender(p);
      });
    });
  }

  function renderFavorites() {
    if (!favoritesList) return;
    var list = loadFavorites();

    if (list. length === 0) {
      favoritesList.innerHTML = "<li>No saved places yet.</li>";
      return;
    }

    favoritesList.innerHTML = list.map(function(p) {
      return '<li data-lat="' + p.lat + '" data-lon="' + p.lon + '" data-name="' + escapeHtml(p.name) + '">' + escapeHtml(p.name) + '</li>';
    }).join("");

    favoritesList.querySelectorAll("li[data-lat]").forEach(function(li) {
      li.addEventListener("click", function() {
        var p = { name: li.dataset.name, lat: parseFloat(li.dataset.lat), lon: parseFloat(li.dataset. lon) };
        showScreen(screenHome);
        loadAndRender(p);
      });
    });
  }

  // ========== NAVIGATION ==========
  if (navHome) navHome.addEventListener("click", function() {
    showScreen(screenHome);
    if (homePlace) loadAndRender(homePlace);
  });

  if (navHourly) navHourly.addEventListener("click", function() {
    showScreen(screenHourly);
  });

  if (navWeek) navWeek.addEventListener("click", function() {
    showScreen(screenWeek);
  });

  if (navSearch) navSearch.addEventListener("click", function() {
    showScreen(screenSearch);
    renderRecents();
    renderFavorites();
  });

  if (navSettings) navSettings.addEventListener("click", function() {
    showScreen(screenSettings);
  });

  if (saveCurrent) saveCurrent.addEventListener("click", function() {
    if (activePlace) addFavorite(activePlace);
  });

  // ========== INIT ==========
  renderRecents();
  renderFavorites();

  homePlace = loadJSON(STORAGE.home, null);

  if (homePlace) {
    showScreen(screenHome);
    loadAndRender(homePlace);
  } else {
    showScreen(screenHome);
    renderLoading("My Location");

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        function(pos) {
          var lat = Math.round(pos. coords.latitude * 10) / 10;
          var lon = Math.round(pos.coords.longitude * 10) / 10;
          homePlace = { name:  "My Location", lat: lat, lon: lon };
          saveJSON(STORAGE. home, homePlace);
          loadAndRender(homePlace);
        },
        function() {
          homePlace = { name:  "Cape Town", lat: -33.9249, lon: 18.4241 };
          saveJSON(STORAGE. home, homePlace);
          loadAndRender(homePlace);
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
      );
    } else {
      homePlace = { name: "Cape Town", lat: -33.9249, lon: 18.4241 };
      saveJSON(STORAGE.home, homePlace);
      loadAndRender(homePlace);
    }
  }
});