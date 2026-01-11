document.addEventListener("DOMContentLoaded", () => {
  const $ = (sel) => document.querySelector(sel);

  const locationEl = $('#cityLine');
  const headlineEl = $('#conditionText');
  const tempEl = $('#bigTemp');
  const descriptionEl = $('#wittyLine');
  const extremeValueEl = $('#todayExtremeTitle');
  const rainValueEl = $('#rainSummary');
  const uvValueEl = $('#uvSummary');
  const confidenceEl = $('#confidenceTop');
  const sourcesEl = $('#sourcesList');
  const bgImg = $('#bgImg');
  const saveCurrent = $('#saveCurrent');
  const confidenceBarEl = $('#confidenceBar');
  const particlesEl = $('#particles');

  const navHome = $('.nav-btn[data-target="home"]');
  const navHourly = $('.nav-btn[data-target="hourly"]');
  const navWeek = $('.nav-btn[data-target="week"]');
  const navSearch = $('.nav-btn[data-target="search"]');
  const navSettings = $('.nav-btn[data-target="settings"]');

  const screenHome = $('#screen-home');
  const screenHourly = $('#screen-hourly');
  const screenWeek = $('#screen-week');
  const screenSearch = $('#screen-search');
  const screenSettings = $('#screen-settings');

  const hourlyTimeline = $('#hourlyList');
  const dailyCards = $('#weekList');

  const searchInput = $('#searchInput');
  const favoritesList = $('#favoritesList');
  const recentList = $('#recentList');
  const manageFavorites = $('#manageFavorites');

  const loader = $('#loader');

  // FIXED: Changed from string to object
  const STORAGE = {
    favorites: "pw_favorites",
    recents: "pw_recents",
    home: "pw_home"
  };
  
  // Thresholds for condition detection (from product spec)
  const THRESH = {
    RAIN_PCT: 40,    // >= 40% rain chance = rain dominates
    WIND_KPH: 25,    // >= 25 km/h = wind dominates
    COLD_C: 16,      // <= 16°C max = cold dominates
    HOT_C: 32,       // >= 32°C max = heat dominates
    // Rain display thresholds
    RAIN_NONE: 10,   // < 10% = None expected
    RAIN_UNLIKELY: 30,  // < 30% = Unlikely
    RAIN_POSSIBLE: 55,  // < 55% = Possible
    // UV index thresholds
    UV_LOW: 3,       // < 3 = Low
    UV_MODERATE: 6,  // < 6 = Moderate
    UV_HIGH: 8,      // < 8 = High
    UV_VERY_HIGH: 11 // < 11 = Very High
  };
  
  const SCREENS = [screenHome, screenHourly, screenWeek, screenSearch, screenSettings];

  let activePlace = null;
  let homePlace = null;
  let lastPayload = null;

  const safeText = (el, txt) => { if (el) el.textContent = txt ??  "--"; };
  const isNum = (v) => typeof v === "number" && Number.isFinite(v);

  function round0(n) { return isNum(n) ? Math.round(n) : null; }
  function round1(n) { return isNum(n) ? Math.round(n * 10) / 10 : null; }

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
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

  function showScreen(which) {
    SCREENS.forEach(s => {
      if (s) {
        s.classList.add("hidden");
        s.setAttribute('hidden', '');
      }
    });
    if (which) {
      which.classList.remove("hidden");
      which.removeAttribute('hidden');
    }
  }

  function showLoader(show) {
    if (loader) loader.classList[show ? 'remove' : 'add']('hidden');
  }

  function hashString(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i);
    return h | 0;
  }

  // SINGLE SOURCE OF TRUTH for weather condition
  // Priority order: Storm > Rain > Wind > Cold > Heat > Fog > Clear
  function computeDominantCondition(norm) {
    const condKey = (norm.conditionKey || '').toLowerCase();
    const rain = norm.rainPct;
    const wind = norm.windKph;
    const hi = norm.todayHigh;

    // 1. STORM
    if (condKey === 'storm' || condKey.includes('thunder')) {
      return 'storm';
    }

    // 2. RAIN (>=40%)
    if (isNum(rain) && rain >= THRESH.RAIN_PCT) {
      return 'rain';
    }

    // 3. WIND (>=25 km/h)
    if (isNum(wind) && wind >= THRESH.WIND_KPH) {
      return 'wind';
    }

    // 4. COLD (max <=16°C)
    if (isNum(hi) && hi <= THRESH.COLD_C) {
      return 'cold';
    }

    // 5. HEAT (max >=32°C)
    if (isNum(hi) && hi >= THRESH.HOT_C) {
      return 'heat';
    }

    // 6. FOG
    if (condKey === 'fog' || condKey.includes('mist') || condKey.includes('haze')) {
      return 'fog';
    }

    // 7. CLEAR (default - NOT cloudy per spec)
    return 'clear';
  }

  function getHeadline(condition) {
    const map = {
      storm: 'This is stormy.',
      rain: 'This is rainy.',
      wind: 'This is windy.',
      cold: 'This is cold.',
      heat: 'This is hot.',
      fog: 'This is foggy.',
      clear: 'This is clear.'
    };
    return map[condition] || 'This is weather.';
  }

  function getExtremeLabel(condition) {
    const map = {
      storm: 'Severe weather',
      rain: 'Wet conditions',
      wind: 'Gusty',
      cold: 'Chilly',
      heat: 'Very hot',
      fog: 'Low visibility',
      clear: 'Pleasant'
    };
    return map[condition] || 'Moderate';
  }

  function setBackgroundFor(condition) {
    const base = 'assets/images/bg';
    const folder = condition;
    const fallbackFolder = 'clear';
    const n = 1 + (Math.abs(hashString(condition + (activePlace?.name || ''))) % 4);
    const path = `${base}/${folder}/${folder}${n}.jpg`;

    if (bgImg) {
      bgImg.src = path;
      bgImg.onerror = () => {
        const fallback1 = `${base}/${folder}/${folder}1.jpg`;
        if (bgImg.src !== fallback1) {
          bgImg.src = fallback1;
          bgImg.onerror = () => {
            // Final fallback: clear (never cloudy)
            bgImg.src = `${base}/${fallbackFolder}/${fallbackFolder}1.jpg`;
          };
        }
      };
    }
  }

  function createParticles(condition, count = 20) {
    if (!particlesEl) return;
    particlesEl.innerHTML = '';
    
    // Only create particles for rain or storm
    if (condition === 'rain' || condition === 'storm') {
      for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.animationDuration = `${Math.random() * 3 + 2}s`;
        particle.style.animationDelay = `${Math.random() * 2}s`;
        particlesEl.appendChild(particle);
      }
    }
  }

  function isWeekendLocal() {
    const d = new Date();
    const day = d.getDay();
    return day === 0 || day === 5 || day === 6;
  }

  function getWittyLine(condition, rainPct, maxC) {
    const isWeekend = [0, 5, 6].includes(new Date().getDay());
    
    if (isWeekend && condition === 'clear') {
      return 'Braai weather, boet!';
    }

    const lines = {
      storm: "Electric vibes. Don't be the tallest thing outside.",
      rain: isNum(rainPct) && rainPct >= 70 ? "Plan indoors — today's moody." : "Keep a jacket close.",
      wind: "Hold onto your hat.",
      cold: "Ja, it's jacket weather.",
      heat: "Big heat — pace yourself outside.",
      fog: "Visibility vibes: drive like you've got a gran in the back.",
      clear: "Good day to get stuff done outside."
    };

    return lines[condition] || "Just... probably.";
  }

  async function fetchProbable(place) {
    const url = `/api/weather? lat=${encodeURIComponent(place.lat)}&lon=${encodeURIComponent(place.lon)}&name=${encodeURIComponent(place.name || '')}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('API error');
    return await response.json();
  }

  function normalizePayload(payload) {
    const now = payload.now || {};
    const today = payload.daily?.[0] || {};
    const meta = payload.meta || {};
    const sources = meta.sources || [];

    return {
      nowTemp: now.tempC ?? null,
      feelsLike: now.feelsLikeC ?? null,
      todayHigh: today.highC ?? null,
      todayLow: today.lowC ?? null,
      rainPct: today.rainChance ?? now.rainChance ?? null,
      uv: today.uv ?? null,
      windKph: now.windKph ?? null,
      conditionKey: now.conditionKey || today.conditionKey || null,
      conditionLabel: now.conditionLabel || today.conditionLabel || 'Weather today',
      confidenceKey: payload.consensus?.confidenceKey || 'mixed',
      used: sources.filter(s => s.ok).map(s => s.name),
      failed: sources.filter(s => !s.ok).map(s => s.name),
      hourly: payload.hourly || [],
      daily: payload.daily || [],
    };
  }

  function renderLoading(name) {
    showLoader(true);
    safeText(locationEl, name);
    safeText(headlineEl, 'Loading.. .');
    safeText(tempEl, '--°');
    safeText(descriptionEl, '—');
    safeText(extremeValueEl, '--');
    safeText(rainValueEl, '--');
    safeText(uvValueEl, '--');
    safeText(confidenceEl, 'PROBABLY • —');
    safeText(sourcesEl, 'Sources: —');
  }

  function renderError(msg) {
    showLoader(false);
    safeText(headlineEl, 'Error');
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
    safeText(locationEl, activePlace.name || '—');
    
    // Headline - driven by condition
    safeText(headlineEl, getHeadline(condition));
    
    // Temperature range
    safeText(tempEl, `${round0(low)}° – ${round0(hi)}°`);
    
    // Witty line - driven by condition
    safeText(descriptionEl, getWittyLine(condition, rain, hi));

    // Today's extreme - driven by condition
    safeText(extremeValueEl, getExtremeLabel(condition));

    // Rain display
    if (isNum(rain)) {
      const rainText = rain < THRESH.RAIN_NONE ? 'None expected'
                     : rain < THRESH.RAIN_UNLIKELY ? 'Unlikely'
                     : rain < THRESH.RAIN_POSSIBLE ? 'Possible'
                     : 'Likely';
      safeText(rainValueEl, rainText);
    } else {
      safeText(rainValueEl, '--');
    }

    // UV display
    if (isNum(uv)) {
      const uvText = uv < THRESH.UV_LOW ? 'Low'
                   : uv < THRESH.UV_MODERATE ? 'Moderate'
                   : uv < THRESH.UV_HIGH ? 'High'
                   : uv < THRESH.UV_VERY_HIGH ? 'Very High'
                   : 'Extreme';
      safeText(uvValueEl, `${uvText} (${round0(uv)})`);
    } else {
      safeText(uvValueEl, '--');
    }

    // Confidence
    const confLabel = (norm.confidenceKey || 'mixed').toUpperCase();
    safeText(confidenceEl, `PROBABLY • ${confLabel} CONFIDENCE`);

    // Sources
    const usedTxt = norm.used.length ? `Used: ${norm.used.join(', ')}` : 'Used: —';
    const failedTxt = norm.failed.length ? `Failed: ${norm.failed.join(', ')}` : '';
    safeText(sourcesEl, `${usedTxt}${failedTxt ? ' · ' + failedTxt : ''}`);

    // Background - uses SAME condition (Single Source of Truth)
    setBackgroundFor(condition);
    
    // Particles - uses SAME condition
    createParticles(condition);
  }

  function renderHourly(hourly) {
    if (!hourlyTimeline) return;
    hourlyTimeline.innerHTML = '';
    hourly.forEach((h, i) => {
      const div = document.createElement('div');
      div.classList.add('hourly-card');
      const hourTime = h.timeLocal || new Date(Date.now() + i * 3600000).toLocaleTimeString([], { hour: 'numeric', hour12: true });
      div.innerHTML = `
        <div class="hour-time">${hourTime}</div>
        <div class="hour-temp">${round0(h.tempC)}°</div>
        <div class="hour-rain">${round0(h.rainChance)}%</div>
      `;
      hourlyTimeline.appendChild(div);
    });
  }

  function renderWeek(daily) {
    if (!dailyCards) return;
    dailyCards.innerHTML = '';
    daily.forEach((d, i) => {
      const dayName = d.dayLabel || new Date(Date.now() + i * 86400000).toLocaleDateString('en-US', { weekday: 'short' });
      const div = document.createElement('div');
      div.classList.add('daily-card');
      div.innerHTML = `
        <div class="day-name">${dayName}</div>
        <div class="day-temp">${round0(d.lowC)}° – ${round0(d.highC)}°</div>
        <div class="day-rain">${round0(d.rainChance)}%</div>
        <div class="day-humor">${d.conditionLabel || '—'}</div>
      `;
      dailyCards.appendChild(div);
    });
  }

  async function loadAndRender(place) {
    activePlace = place;
    renderLoading(place.name || 'My Location');
    try {
      const payload = await fetchProbable(place);
      lastPayload = payload;
      const norm = normalizePayload(payload);
      renderHome(norm);
      renderHourly(norm.hourly);
      renderWeek(norm.daily);
    } catch (e) {
      console.error("Load failed:", e);
      renderError("Couldn't fetch weather right now.");
    }
  }

  // Places:  recents/favorites
  function loadFavorites() { return loadJSON(STORAGE.favorites, []); }
  function loadRecents() { return loadJSON(STORAGE.recents, []); }

  function saveFavorites(list) { saveJSON(STORAGE. favorites, list); }
  function saveRecents(list) { saveJSON(STORAGE.recents, list); }

  function addRecent(place) {
    let list = loadRecents().filter(p => ! samePlace(p, place));
    list.unshift(place);
    saveRecents(list. slice(0, 10));
    renderRecents();
  }

  function addFavorite(place) {
    let list = loadFavorites();
    if (list.some(p => samePlace(p, place))) return;
    list.unshift(place);
    saveFavorites(list. slice(0, 5));
    renderFavorites();
  }

  function escapeHtml(s) {
    return String(s ??  "").replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  function renderRecents() {
    if (!recentList) return;
    const list = loadRecents();
    recentList.innerHTML = list.map(p => `
      <li data-lat="${p.lat}" data-lon="${p.lon}" data-name="${escapeHtml(p.name)}">${escapeHtml(p.name)}</li>
    `).join('') || '<li>No recent searches yet. </li>';

    recentList.querySelectorAll('li[data-lat]').forEach(li => {
      li.addEventListener('click', () => {
        const p = { name: li.dataset.name, lat: parseFloat(li.dataset.lat), lon: parseFloat(li. dataset.lon) };
        addRecent(p);
        showScreen(screenHome);
        loadAndRender(p);
      });
    });
  }

  function renderFavorites() {
    if (!favoritesList) return;
    const list = loadFavorites();
    favoritesList. innerHTML = list.map(p => `
      <li data-lat="${p.lat}" data-lon="${p.lon}" data-name="${escapeHtml(p.name)}">${escapeHtml(p. name)}</li>
    `).join('') || '<li>No saved places yet.</li>';

    favoritesList.querySelectorAll('li[data-lat]').forEach(li => {
      li.addEventListener('click', () => {
        const p = { name: li.dataset.name, lat: parseFloat(li. dataset.lat), lon: parseFloat(li.dataset.lon) };
        showScreen(screenHome);
        loadAndRender(p);
      });
    });
  }

  // Search
  async function runSearch(q) {
    if (!q || q.trim().length < 2) return;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=8`;
    try {
      const data = await (await fetch(url)).json();
      // Render results
      console.log(data); // TODO: Add search results rendering to #search-screen
    } catch (e) {
      console. error(e);
    }
  }

  // Buttons / Nav
  navHome.addEventListener('click', () => {
    showScreen(screenHome);
    if (homePlace) loadAndRender(homePlace);
  });
  navHourly.addEventListener('click', () => showScreen(screenHourly));
  navWeek.addEventListener('click', () => showScreen(screenWeek));
  navSearch.addEventListener('click', () => {
    showScreen(screenSearch);
    renderRecents();
    renderFavorites();
  });
  navSettings.addEventListener('click', () => showScreen(screenSettings));

  if (saveCurrent) {
    saveCurrent.addEventListener('click', () => {
      if (activePlace) addFavorite(activePlace);
    });
  }

  // Init
  renderRecents();
  renderFavorites();

  homePlace = loadJSON(STORAGE.home, null);
  if (homePlace) {
    showScreen(screenHome);
    loadAndRender(homePlace);
  } else {
    // Geolocation
    showScreen(screenHome);
    renderLoading("My Location");

    if ("geolocation" in navigator) {
      navigator.geolocation. getCurrentPosition(
        (pos) => {
          const lat = round1(pos. coords.latitude);
          const lon = round1(pos.coords.longitude);
          homePlace = { name: "My Location", lat, lon };
          saveJSON(STORAGE.home, homePlace);
          loadAndRender(homePlace);
        },
        () => {
          // fallback: Cape Town
          homePlace = { name: "Cape Town", lat:  -33.9249, lon: 18.4241 };
          saveJSON(STORAGE.home, homePlace);
          loadAndRender(homePlace);
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
      );
    } else {
      homePlace = { name: "Cape Town", lat:  -33.9249, lon: 18.4241 };
      saveJSON(STORAGE.home, homePlace);
      loadAndRender(homePlace);
    }
  }
});