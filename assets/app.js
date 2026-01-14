document.addEventListener("DOMContentLoaded", () => {
  const $ = (sel) => document.querySelector(sel);

  // ========== DOM ELEMENTS ==========
  const locationEl = $('#location');
  const headlineEl = $('#headline');
  const tempEl = $('#temp');
  const descriptionEl = $('#description');
  const extremeLabelEl = $('#extremeLabel');
  const extremeValueEl = $('#extremeValue');
  const rainValueEl = $('#rainValue');
  const uvValueEl = $('#uvValue');
  const confidenceEl = $('#confidence');
  const sourcesEl = $('#sources');
  const bgImg = $('#bgImg');
  const saveCurrent = $('#saveCurrent');
  const confidenceBarEl = $('#confidenceBar');
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
  const searchCancel = $('#searchCancel');
  const favoritesList = $('#favoritesList');
  const recentList = $('#recentList');
  const manageFavorites = $('#manageFavorites');

  const loader = $('#loader');
  const toast = $('#toast');

  // ========== CONSTANTS ==========
  // FIXED: STORAGE is now an object, not a string
  const STORAGE = {
    favorites: "pw_favorites",
    recents: "pw_recents",
    home: "pw_home"
  };

  const SCREENS = [screenHome, screenHourly, screenWeek, screenSearch, screenSettings];

  // Default fallback location (tertiary fallback when geolocation fails)
  const DEFAULT_LOCATION = { name: "Cape Town", lat: -33.9249, lon: 18.4241 };

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

  // ========== STATE ==========
  let activePlace = null;
  let homePlace = null;
  let lastPayload = null;

  // ========== UTILITY FUNCTIONS ==========
  const safeText = (el, txt) => { if (el) el.textContent = txt ?? "--"; };
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
    if (!a || !b) return false;
    return Number(a.lat).toFixed(4) === Number(b.lat).toFixed(4) &&
           Number(a.lon).toFixed(4) === Number(b.lon).toFixed(4);
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
  
  function showToast(message, duration = 3000) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  }

  function hashString(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i);
    return h | 0;
  }

  function escapeHtml(s) {
    return String(s ?? "").replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  // ========== SINGLE SOURCE OF TRUTH: DOMINANT CONDITION ==========
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

  // ========== CONDITION-DRIVEN DISPLAY FUNCTIONS ==========
  
  // Spec Section 6: Hero headline - short, confident, declarative
  function getHeadline(condition) {
    const headlines = {
      storm: "This is stormy.",
      rain: "This is rainy.",
      wind: "This is windy.",
      cold: "This is cold.",
      heat: "This is hot.",
      fog: "This is foggy.",
      clear: "This is clear."
    };
    return headlines[condition] || "This is weather.";
  }

  // Spec Section 8: Today's extreme card - practical terms
  function getExtremeLabel(condition) {
    const labels = {
      storm: "Severe weather",
      rain: "Wet conditions",
      wind: "Gusty",
      cold: "Chilly",
      heat: "Very hot",
      fog: "Low visibility",
      clear: "Pleasant"
    };
    return labels[condition] || "Moderate";
  }

  // Spec Section 7: Humour - SA-specific, light, observational
  function getWittyLine(condition, rainPct, maxC) {
    // Weekend braai check (Fri-Sun)
    const day = new Date().getDay();
    const isWeekend = day === 0 || day === 5 || day === 6;
    
    if (isWeekend && condition === "clear") {
      return "Braai weather, boet!";
    }

    const lines = {
      storm: "Electric vibes. Don't be the tallest thing outside.",
      rain: isNum(rainPct) && rainPct >= 70 
        ? "Plan indoors — today's moody." 
        : "Keep a jacket close.",
      wind: "Hold onto your hat.",
      cold: "Ja, it's jacket weather.",
      heat: "Big heat — pace yourself outside.",
      fog: "Visibility vibes: drive like you've got a gran in the back.",
      clear: "Good day to get stuff done outside."
    };
    
    return lines[condition] || "Just... probably.";
  }

  // ========== BACKGROUND IMAGE LOGIC ==========
  // Background folder MUST match dominant condition exactly
  // Fallback: same folder → clear (NEVER cloudy)

  function setBackgroundFor(condition) {
    const base = 'assets/images/bg';
    const folder = condition;
    const fallbackFolder = 'clear';
    
    // Image variants: dawn, day, dusk, night
    const variants = ['dawn', 'day', 'dusk', 'night'];
    const imageIndex = Math.abs(hashString(condition + (activePlace?.name || ''))) % 4;
    const imageName = variants[imageIndex];
    const path = `${base}/${folder}/${imageName}.jpg`;

    if (bgImg) {
      bgImg.src = path;
      bgImg.onerror = () => {
        const fallback1 = `${base}/${folder}/day.jpg`;
        if (bgImg.src !== fallback1) {
          bgImg.src = fallback1;
          bgImg.onerror = () => {
            // Final fallback: clear (never cloudy)
            bgImg.src = `${base}/${fallbackFolder}/day.jpg`;
          };
        }
      };
    }
  }

  // ========== PARTICLES ==========
  // Driven by condition, not hardcoded
  
  function createParticles(condition, count = 20) {
    if (!particlesEl) return;
    particlesEl.innerHTML = '';
    
    // Only create particles for rain or storm
    if (condition === 'rain' || condition === 'storm') {
      for (let i = 0; i < count; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.animationDelay = `${Math.random() * 2}s`;
        particle.style.animationDuration = `${Math.random() * 3 + 2}s`;
        particlesEl.appendChild(particle);
      }
    }
  }

  // ========== API & DATA ==========
  
  async function fetchProbable(place) {
    const url = `/api/weather?lat=${encodeURIComponent(place.lat)}&lon=${encodeURIComponent(place.lon)}&name=${encodeURIComponent(place.name || '')}`;
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

  // ========== RENDER FUNCTIONS ==========
  
  function renderLoading(name) {
    showLoader(true);
    safeText(locationEl, name);
    safeText(headlineEl, 'Loading...');
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

    // ========== SINGLE SOURCE OF TRUTH ==========
    // Compute condition ONCE, use it for EVERYTHING
    const condition = computeDominantCondition(norm);

    // Set body class for condition-based styling
    document.body.className = `weather-${condition}`;

    // Location
    safeText(locationEl, activePlace.name || '—');
    
    // Hero headline - driven by condition (Spec Section 6)
    safeText(headlineEl, getHeadline(condition));
    
    // Temperature range
    const lowStr = isNum(low) ? round0(low) : '--';
    const hiStr = isNum(hi) ? round0(hi) : '--';
    safeText(tempEl, `${lowStr}° – ${hiStr}°`);
    
    // Witty line - driven by condition (Spec Section 7)
    safeText(descriptionEl, getWittyLine(condition, rain, hi));

    // Today's extreme - driven by condition (Spec Section 8)
    const extremeLabel = getExtremeLabel(condition);
    safeText(extremeLabelEl, `Today's extreme:`);
    safeText(extremeValueEl, extremeLabel);

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

    // Background - driven by condition (Spec Section 5)
    setBackgroundFor(condition);
    
    // Particles - driven by condition
    createParticles(condition);
  }

  function renderHourly(hourly) {
    if (!hourlyTimeline) return;
    hourlyTimeline.innerHTML = '';
    hourly.forEach((h, i) => {
      const div = document.createElement('div');
      div.classList.add('hourly-card');
      const hourTime = h.timeLocal || new Date(Date.now() + i * 3600000).toLocaleTimeString([], { hour: 'numeric', hour12: true });
      const tempStr = isNum(h.tempC) ? `${round0(h.tempC)}°` : '--°';
      const rainStr = isNum(h.rainChance) ? `${round0(h.rainChance)}%` : '--%';
      div.innerHTML = `
        <div class="hour-time">${hourTime}</div>
        <div class="hour-temp">${tempStr}</div>
        <div class="hour-rain">${rainStr}</div>
      `;
      hourlyTimeline.appendChild(div);
    });
  }

  function renderWeek(daily) {
    if (!dailyCards) return;
    dailyCards.innerHTML = '';
    daily.forEach((d, i) => {
      const dayName = d.dayLabel || new Date(Date.now() + i * 86400000).toLocaleDateString('en-US', { weekday: 'short' });
      const lowStr = isNum(d.lowC) ? round0(d.lowC) : '--';
      const highStr = isNum(d.highC) ? round0(d.highC) : '--';
      const rainStr = isNum(d.rainChance) ? `${round0(d.rainChance)}%` : '--%';
      const div = document.createElement('div');
      div.classList.add('daily-card');
      div.innerHTML = `
        <div class="day-name">${dayName}</div>
        <div class="day-temp">${lowStr}° – ${highStr}°</div>
        <div class="day-rain">${rainStr}</div>
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

  // ========== PLACES: FAVORITES & RECENTS ==========
  
  function loadFavorites() { return loadJSON(STORAGE.favorites, []); }
  function loadRecents() { return loadJSON(STORAGE.recents, []); }

  function saveFavorites(list) { saveJSON(STORAGE.favorites, list); }
  function saveRecents(list) { saveJSON(STORAGE.recents, list); }

  function addRecent(place) {
    let list = loadRecents().filter(p => !samePlace(p, place));
    list.unshift(place);
    saveRecents(list.slice(0, 10));
    renderRecents();
  }

  function addFavorite(place) {
    let list = loadFavorites();
    if (list.some(p => samePlace(p, place))) {
      showToast('This place is already saved!');
      return;
    }
    if (list.length >= 5) {
      showToast('You can only save up to 5 places. Remove one first.');
      return;
    }
    list.unshift(place);
    saveFavorites(list.slice(0, 5));
    renderFavorites();
    showToast(`Saved ${place.name}!`);
  }

  function renderRecents() {
    if (!recentList) return;
    const list = loadRecents();
    recentList.innerHTML = list.map(p => `
      <li data-lat="${p.lat}" data-lon="${p.lon}" data-name="${escapeHtml(p.name)}">${escapeHtml(p.name)}</li>
    `).join('') || '<li>No recent searches yet.</li>';

    recentList.querySelectorAll('li[data-lat]').forEach(li => {
      li.addEventListener('click', () => {
        const p = { name: li.dataset.name, lat: parseFloat(li.dataset.lat), lon: parseFloat(li.dataset.lon) };
        addRecent(p);
        showScreen(screenHome);
        loadAndRender(p);
      });
    });
  }

  function renderFavorites() {
    if (!favoritesList) return;
    const list = loadFavorites();
    favoritesList.innerHTML = list.map(p => `
      <li data-lat="${p.lat}" data-lon="${p.lon}" data-name="${escapeHtml(p.name)}">
        <span class="fav-name">${escapeHtml(p.name)}</span>
        <button class="remove-fav" data-lat="${p.lat}" data-lon="${p.lon}">✕</button>
      </li>
    `).join('') || '<li>No saved places yet.</li>';

    favoritesList.querySelectorAll('li[data-lat] .fav-name').forEach(span => {
      span.addEventListener('click', () => {
        const li = span.closest('li');
        const p = { name: li.dataset.name, lat: parseFloat(li.dataset.lat), lon: parseFloat(li.dataset.lon) };
        showScreen(screenHome);
        loadAndRender(p);
      });
    });
    
    favoritesList.querySelectorAll('.remove-fav').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const lat = parseFloat(btn.dataset.lat);
        const lon = parseFloat(btn.dataset.lon);
        let list = loadFavorites();
        list = list.filter(p => !samePlace(p, {lat, lon}));
        saveFavorites(list);
        renderFavorites();
        showToast('Place removed from favorites');
      });
    });
  }

  // ========== SEARCH ==========
  
  let searchTimeout = null;
  let searchResults = [];
  
  async function runSearch(q) {
    if (!q || q.trim().length < 2) {
      // Clear search results
      const resultsContainer = document.getElementById('searchResults');
      if (resultsContainer) resultsContainer.innerHTML = '';
      return;
    }
    
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=8`;
    try {
      const data = await (await fetch(url)).json();
      searchResults = data;
      renderSearchResults(data);
    } catch (e) {
      console.error('Search failed:', e);
    }
  }
  
  function renderSearchResults(results) {
    // Find or create search results container
    let resultsContainer = document.getElementById('searchResults');
    if (!resultsContainer) {
      resultsContainer = document.createElement('div');
      resultsContainer.id = 'searchResults';
      resultsContainer.className = 'section';
      const searchTitle = document.createElement('h3');
      searchTitle.textContent = 'Search results';
      resultsContainer.appendChild(searchTitle);
      const resultsList = document.createElement('ul');
      resultsList.id = 'searchResultsList';
      resultsContainer.appendChild(resultsList);
      
      // Insert after search input
      const searchScreen = document.getElementById('search-screen');
      const cancelBtn = document.getElementById('searchCancel');
      if (searchScreen && cancelBtn) {
        cancelBtn.after(resultsContainer);
      }
    }
    
    const resultsList = document.getElementById('searchResultsList');
    if (!resultsList) return;
    
    if (results.length === 0) {
      resultsList.innerHTML = '<li>No results found.</li>';
      return;
    }
    
    resultsList.innerHTML = results.map(r => {
      const displayName = escapeHtml(r.display_name);
      return `<li data-lat="${r.lat}" data-lon="${r.lon}" data-name="${displayName}">${displayName}</li>`;
    }).join('');
    
    // Add click handlers
    resultsList.querySelectorAll('li[data-lat]').forEach(li => {
      li.addEventListener('click', () => {
        const place = { 
          name: li.dataset.name, 
          lat: parseFloat(li.dataset.lat), 
          lon: parseFloat(li.dataset.lon) 
        };
        addRecent(place);
        showScreen(screenHome);
        loadAndRender(place);
        // Clear search
        if (searchInput) searchInput.value = '';
        resultsList.innerHTML = '';
      });
    });
  }
  
  // Add search input handler with debouncing
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        runSearch(e.target.value);
      }, 300); // 300ms debounce
    });
  }

  // ========== NAVIGATION ==========
  
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

  saveCurrent.addEventListener('click', () => {
    if (activePlace) addFavorite(activePlace);
  });
  
  if (searchCancel) {
    searchCancel.addEventListener('click', () => {
      showScreen(screenHome);
      if (searchInput) searchInput.value = '';
    });
  }
  
  if (manageFavorites) {
    manageFavorites.addEventListener('click', () => {
      const list = loadFavorites();
      if (list.length === 0) {
        showToast('No saved places to manage');
        return;
      }
      // Show help message
      showToast('Click the ✕ button next to a place to remove it', 4000);
    });
  }

  // ========== GEOLOCATION ==========
  
  /**
   * Attempts to get the user's current geolocation.
   * Returns a Promise that resolves to a place object with coordinates.
   * Rejects with an error message if geolocation fails.
   */
  function getUserLocation() {
    return new Promise((resolve, reject) => {
      if (!("geolocation" in navigator)) {
        reject("Geolocation not supported by your browser");
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = round1(pos.coords.latitude);
          const lon = round1(pos.coords.longitude);
          resolve({ name: "My Location", lat, lon });
        },
        (error) => {
          // Handle different geolocation error types
          let errorMessage;
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = "Location permissions denied. Please enable location access in your browser settings.";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = "Unable to determine your location. Please try again.";
              break;
            case error.TIMEOUT:
              errorMessage = "Location request timed out. Please try again.";
              break;
            default:
              errorMessage = "Unable to access your location.";
          }
          reject(errorMessage);
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
      );
    });
  }

  /**
   * Gets a fallback location when the primary location source fails.
   * First tries geolocation, then falls back to Cape Town as a tertiary option.
   */
  async function getFallbackLocation() {
    try {
      // Try to get user's geolocation first
      const geoLocation = await getUserLocation();
      showToast("Using your current location");
      return geoLocation;
    } catch (geoError) {
      // Show geolocation error to user
      showToast(geoError, 4000);
      console.warn("Geolocation failed:", geoError);
      
      // Fall back to default location as tertiary fallback
      showToast(`Using default location: ${DEFAULT_LOCATION.name}`, 3000);
      return DEFAULT_LOCATION;
    }
  }

  // ========== INITIALIZATION ==========
  
  renderRecents();
  renderFavorites();

  homePlace = loadJSON(STORAGE.home, null);
  if (homePlace) {
    showScreen(screenHome);
    loadAndRender(homePlace);
  } else {
    // Try to get user's current location
    showScreen(screenHome);
    renderLoading("My Location");

    getFallbackLocation()
      .then((location) => {
        homePlace = location;
        saveJSON(STORAGE.home, homePlace);
        loadAndRender(homePlace);
      })
      .catch((error) => {
        // This should not happen since getFallbackLocation always returns something
        console.error("Unexpected error in getFallbackLocation:", error);
        homePlace = DEFAULT_LOCATION;
        saveJSON(STORAGE.home, homePlace);
        loadAndRender(homePlace);
      });
  }
});
