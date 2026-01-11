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

  // Thresholds for condition detection (from spec section 4)
  const THRESH = {
    RAIN_PCT: 40,    // >= 40% rain chance = rain dominates
    WIND_KPH: 25,    // >= 25 km/h = wind dominates
    COLD_C: 16,      // <= 16°C = cold dominates
    HOT_C: 32        // >= 32°C = heat dominates
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

  // MOVED UP: These must be defined before normalizePayload() uses them
  function median(values) {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const half = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[half] : (sorted[half - 1] + sorted[half]) / 2.0;
  }

  function pickMostCommon(arr) {
    if (arr.length === 0) return null;
    const count = arr.reduce((acc, v) => ({ ...acc, [v]: (acc[v] || 0) + 1 }), {});
    return Object.keys(count).reduce((a, b) => count[a] > count[b] ? a : b);
  }

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
    SCREENS.forEach(s => s.classList.add("hidden"));
    which.classList.remove("hidden");
  }

  function showLoader(show) {
    loader.classList[show ? 'remove' : 'add']('hidden');
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
  // Spec Section 4: ONE condition drives headline, background, extreme label, particles
  // Priority order: Storm > Rain > Wind > Cold > Heat > Fog > Clear
  
  function computeDominantCondition(norm) {
    const desc = String(norm.desc || "").toLowerCase();
    const rain = norm.rainPct;
    const hi = norm.todayHigh;
    const low = norm.todayLow;
    const wind = norm.windKph;

    // 1. STORM - highest priority (thunder, lightning, severe)
    if (desc.includes("storm") || desc.includes("thunder") || desc.includes("lightning")) {
      return "storm";
    }

    // 2. RAIN - rain probability >= 40%
    if (isNum(rain) && rain >= THRESH.RAIN_PCT) {
      return "rain";
    }

    // 3. WIND - strong wind >= 25 km/h
    if (isNum(wind) && wind >= THRESH.WIND_KPH) {
      return "wind";
    }

    // 4. COLD - max temp <= 16°C
    if (isNum(hi) && hi <= THRESH.COLD_C) {
      return "cold";
    }

    // 5. HEAT - max temp >= 32°C
    if (isNum(hi) && hi >= THRESH.HOT_C) {
      return "heat";
    }

    // 6. FOG - fog, mist, haze in description
    if (desc.includes("fog") || desc.includes("mist") || desc.includes("haze")) {
      return "fog";
    }

    // 7. CLEAR - default fallback (NOT cloudy)
    // Spec: "Cloudy is not a dominant condition by default"
    return "clear";
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
  // Spec Section 5: Background folder MUST match dominant condition exactly
  // Fallback: same folder → clear (NEVER cloudy)

  function setBackgroundFor(condition) {
    const base = "assets/images/bg";
    const folder = condition; // Direct match - no translation needed
    
    // Image variants: dawn, day, dusk, night
    const variants = ['dawn', 'day', 'dusk', 'night'];
    const imageIndex = Math.abs(hashString(condition + (activePlace?.name || ''))) % 4;
    const imageName = variants[imageIndex];
    const primaryPath = `${base}/${folder}/${imageName}.jpg`;
    
    if (bgImg) {
      bgImg.src = primaryPath;
      
      // Fallback chain: same folder → clear (never cloudy)
      bgImg.onerror = () => {
        const sameFolderFallback = `${base}/${folder}/day.jpg`;
        if (bgImg.src !== sameFolderFallback) {
          bgImg.src = sameFolderFallback;
          bgImg.onerror = () => {
            // Final fallback: clear (NOT cloudy per spec)
            bgImg.src = `${base}/clear/day.jpg`;
            console.warn(`Background failed for ${folder}, falling back to clear`);
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
    
    // Only create particles for certain conditions
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

  // ========== CONFIDENCE LOGIC ==========
  
  function computeAgreementFromNorms(norms) {
    const temps = norms.map(n => n.nowTemp).filter(isNum);
    if (temps.length < 2) {
      return { 
        label: temps.length === 1 ? "DECENT" : "—", 
        explain: temps.length === 1 ? "Only one source responded." : "No sources responded." 
      };
    }

    const min = Math.min(...temps);
    const max = Math.max(...temps);
    const spread = max - min;

    if (spread <= 1.5) return { label: "STRONG", explain: "All sources line up closely." };
    if (spread <= 3.5) return { label: "DECENT", explain: "Two sources agree, one's a bit off." };
    return { label: "MIXED", explain: "Sources disagree today; we're showing the most probable middle-ground." };
  }

  // ========== API & DATA ==========
  
  async function fetchProbable(place) {
    const url = `/api/weather?lat=${encodeURIComponent(place.lat)}&lon=${encodeURIComponent(place.lon)}&name=${encodeURIComponent(place.name || '')}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('API error');
    return await response.json();
  }

  function normalizePayload(payload) {
    if (Array.isArray(payload.norms)) {
      const norms = payload.norms;
      const medNow = median(norms.map(n => n.nowTemp).filter(isNum));
      const medHigh = median(norms.map(n => n.todayHigh).filter(isNum));
      const medLow = median(norms.map(n => n.todayLow).filter(isNum));
      const medRain = median(norms.map(n => n.todayRain).filter(isNum));
      const medUv = median(norms.map(n => n.todayUv).filter(isNum));
      const medWind = median(norms.map(n => n.windKph).filter(isNum));
      const mostDesc = pickMostCommon(norms.map(n => n.desc).filter(Boolean)) || 'Weather today';

      return {
        nowTemp: medNow,
        todayHigh: medHigh,
        todayLow: medLow,
        rainPct: medRain,
        uv: medUv,
        windKph: medWind,
        desc: mostDesc,
        agreement: computeAgreementFromNorms(norms),
        used: payload.used || [],
        failed: payload.failed || [],
        countUsed: norms.length,
        hourly: payload.hourly || [],
        daily: payload.daily || [],
      };
    }
    // Fallback for other payload shapes
    return {
      nowTemp: payload.now?.temp ?? null,
      todayHigh: payload.today?.high ?? null,
      todayLow: payload.today?.low ?? null,
      rainPct: payload.today?.rainPct ?? null,
      uv: payload.today?.uv ?? null,
      windKph: payload.today?.windKph ?? null,
      desc: payload.today?.desc ?? 'Weather today',
      agreement: payload.agreement || { label: '—', explain: '' },
      used: payload.sources?.used || [],
      failed: payload.sources?.failed || [],
      countUsed: payload.sources?.countUsed || 0,
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
      const rp = round0(rain);
      const rainText = rp < 10 ? "None expected" 
                     : rp < 30 ? "Unlikely" 
                     : rp < 55 ? "Possible" 
                     : "Likely";
      safeText(rainValueEl, rainText);
    } else {
      safeText(rainValueEl, '--');
    }

    // UV display
    if (isNum(uv)) {
      const uvText = uv < 3 ? "Low"
                   : uv < 6 ? "Moderate"
                   : uv < 8 ? "High"
                   : uv < 11 ? "Very High"
                   : "Extreme";
      safeText(uvValueEl, `${uvText} (${round0(uv)})`);
    } else {
      safeText(uvValueEl, '--');
    }

    // Confidence
    const label = (norm.agreement?.label || "—").toUpperCase();
    safeText(confidenceEl, `PROBABLY • ${label} CONFIDENCE`);
    
    // Confidence value in sidebar
    const confidenceValue = $('#confidenceValue');
    if (confidenceValue) {
      safeText(confidenceValue, norm.agreement?.explain || "—");
    }
    
    // Confidence bar - visual indicator
    if (confidenceBarEl) {
      const barWidth = label === "STRONG" ? 100 
                     : label === "DECENT" ? 70 
                     : label === "MIXED" ? 40 
                     : 0;
      confidenceBarEl.style.width = `${barWidth}%`;
    }

    // Sources
    const usedTxt = norm.used.length ? `Used: ${norm.used.join(", ")}` : "Used: —";
    const failedTxt = norm.failed.length ? `Failed: ${norm.failed.join(", ")}` : "";
    safeText(sourcesEl, `${usedTxt}${failedTxt ? " · " + failedTxt : ""}`);

    // Background - driven by condition (Spec Section 5)
    setBackgroundFor(condition);
    
    // Particles - driven by condition
    createParticles(condition);
  }

  function renderHourly(hourly) {
    if (!hourlyTimeline) return;
    hourlyTimeline.innerHTML = '';
    if (!hourly || hourly.length === 0) {
      hourlyTimeline.innerHTML = '<div style="text-align: center; padding: 2rem; opacity: 0.7;">No hourly data available</div>';
      return;
    }
    hourly.forEach((h, i) => {
      const div = document.createElement('div');
      div.classList.add('hourly-card');
      const hourTime = new Date(Date.now() + i * 3600000).toLocaleTimeString([], { hour: 'numeric', hour12: true });
      div.innerHTML = `
        <div class="hour-time">${hourTime}</div>
        <div class="hour-temp">${round0(h.temp) ?? '--'}°</div>
        <div class="hour-rain">${round0(h.rain) ?? '--'}%</div>
      `;
      hourlyTimeline.appendChild(div);
    });
  }

  function renderWeek(daily) {
    if (!dailyCards) return;
    dailyCards.innerHTML = '';
    if (!daily || daily.length === 0) {
      dailyCards.innerHTML = '<div style="text-align: center; padding: 2rem; opacity: 0.7;">No daily data available</div>';
      return;
    }
    daily.forEach((d, i) => {
      const date = new Date(Date.now() + i * 86400000);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const div = document.createElement('div');
      div.classList.add('daily-card');
      div.innerHTML = `
        <div class="day-name">${dayName}</div>
        <div class="day-temp">${round0(d.low) ?? '--'}° – ${round0(d.high) ?? '--'}°</div>
        <div class="day-rain">${round0(d.rain) ?? '--'}%</div>
        <div class="day-humor">${escapeHtml(d.desc) || '—'}</div>
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
        list = list.filter(p => !(Number(p.lat).toFixed(4) === Number(lat).toFixed(4) && 
                                   Number(p.lon).toFixed(4) === Number(lon).toFixed(4)));
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
      return `<li data-lat="${r.lat}" data-lon="${r.lon}" data-name="${escapeHtml(r.display_name)}">${displayName}</li>`;
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

  // ========== INITIALIZATION ==========
  
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
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = round1(pos.coords.latitude);
          const lon = round1(pos.coords.longitude);
          homePlace = { name: "My Location", lat, lon };
          saveJSON(STORAGE.home, homePlace);
          loadAndRender(homePlace);
        },
        () => {
          // Fallback: Cape Town
          homePlace = { name: "Cape Town", lat: -33.9249, lon: 18.4241 };
          saveJSON(STORAGE.home, homePlace);
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
