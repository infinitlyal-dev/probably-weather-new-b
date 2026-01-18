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
  const refreshBtn = $('#refreshBtn');

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
  const clearRecentsBtn = $('#clearRecents');

  const unitsTempSelect = $('#unitsTemp');
  const unitsWindSelect = $('#unitsWind');
  const probRangeToggle = $('#probRange');
  const timeFormatSelect = $('#timeFormat');
  const taglineEl = document.querySelector('.tagline');

  const loader = $('#loader');
  const toast = $('#toast');

  // ========== CONSTANTS ==========
  // FIXED: STORAGE is now an object, not a string
  const STORAGE = {
    favorites: "pw_favorites",
    recents: "pw_recents",
    home: "pw_home",
    location: "pw_location"
  };

  const SCREENS = [screenHome, screenHourly, screenWeek, screenSearch, screenSettings];

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
  window.__PW_LAST_NORM = null; // Global store for latest normalized data
  let state = { city: "Cape Town" };
  let manageMode = false;
  const pendingFavMeta = new Set();
  const SETTINGS_KEYS = {
    temp: 'units.temp',
    wind: 'units.wind',
    range: 'display.range',
    time: 'format.time'
  };
  const DEFAULT_SETTINGS = {
    temp: 'C',
    wind: 'kmh',
    range: false,
    time: '24',
    lang: 'human'
  };
  let settings = { ...DEFAULT_SETTINGS };

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

  function favoriteKey(p) {
    return `${Number(p.lat).toFixed(4)},${Number(p.lon).toFixed(4)}`;
  }

  function isPlaceholderName(name) {
    const v = String(name || '').trim();
    return !v || /^unknown\b/i.test(v) || /^my location\b/i.test(v);
  }

  async function resolvePlaceName(place) {
    if (!place || !isNum(place.lat) || !isNum(place.lon)) return place?.name || 'Unknown';
    if (!isPlaceholderName(place.name)) return place.name;
    const cityName = await reverseGeocode(place.lat, place.lon);
    return cityName || place.name || 'Unknown';
  }

  function conditionEmoji(key) {
    switch (String(key || '').toLowerCase()) {
      case 'storm': return '⛈️';
      case 'rain': return '🌧️';
      case 'wind': return '💨';
      case 'cold': return '❄️';
      case 'heat': return '🔥';
      case 'fog': return '🌫️';
      case 'clear': return '☀️';
      default: return '⛅';
    }
  }

  function loadSettings() {
    settings = {
      temp: loadJSON(SETTINGS_KEYS.temp, DEFAULT_SETTINGS.temp),
      wind: loadJSON(SETTINGS_KEYS.wind, DEFAULT_SETTINGS.wind),
      range: loadJSON(SETTINGS_KEYS.range, DEFAULT_SETTINGS.range),
      time: loadJSON(SETTINGS_KEYS.time, DEFAULT_SETTINGS.time),
      lang: 'human'
    };
  }

  function saveSettings() {
    saveJSON(SETTINGS_KEYS.temp, settings.temp);
    saveJSON(SETTINGS_KEYS.wind, settings.wind);
    saveJSON(SETTINGS_KEYS.range, settings.range);
    saveJSON(SETTINGS_KEYS.time, settings.time);
  }

  function convertTemp(c) {
    if (!isNum(c)) return null;
    return settings.temp === 'F' ? (c * 9 / 5) + 32 : c;
  }

  function formatTemp(c) {
    const v = convertTemp(c);
    return isNum(v) ? `${round0(v)}°` : '--°';
  }

  function formatWind(kph) {
    if (!isNum(kph)) return '--';
    if (settings.wind === 'mph') {
      return `${round0(kph * 0.621371)} mph`;
    }
    return `${round0(kph)} km/h`;
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

    [screenHourly, screenWeek, screenSearch, screenSettings].forEach(panel => {
      if (!panel) return;
      panel.classList.toggle('light-glass', false);
      panel.classList.toggle('transparent-glass', false);
      panel.classList.toggle('glass-panel', !!which && which !== screenHome);
    });

    document.body.classList.toggle('modal-open', which && which !== screenHome);

    if (saveCurrent) {
      saveCurrent.style.display = which === screenHome ? '' : 'none';
    }
    
    // Hide sidebar on non-Home screens
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      if (which === screenHome) {
        sidebar.style.display = ''; // Show on Home
      } else {
        sidebar.style.display = 'none'; // Hide on other screens
      }
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
    const maxWindKph = (() => {
      let max = isNum(norm.windKph) ? norm.windKph : null;
      const hours = Array.isArray(norm.hourly) ? norm.hourly : [];
      for (let i = 0; i < Math.min(24, hours.length); i++) {
        const w = hours[i]?.windKph;
        if (isNum(w)) max = isNum(max) ? Math.max(max, w) : w;
      }
      return max;
    })();
    const wind = maxWindKph;
    const hi = norm.todayHigh;

    // 1. STORM
    if (condKey === 'storm' || condKey.includes('thunder')) {
      return 'storm';
    }

    // 2. RAIN (strict median precip)
    if (isNum(rain)) {
      if (rain > 20) return 'rain';
      if (rain > 0) return 'rain-possible';
      if (rain === 0) {
        // fall through to other conditions
      }
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

    if (condKey.includes('cloud')) {
      return 'cloudy';
    }

    // 7. CLEAR (default)
    return 'clear';
  }

  // ========== CONDITION-DRIVEN DISPLAY FUNCTIONS ==========
  
  // Spec Section 6: Hero headline - short, confident, declarative
  function getHeadline(condition) {
    const headlines = {
      storm: "This is stormy.",
      rain: "This is rainy.",
      'rain-possible': "Possible rain.",
      cloudy: "This is cloudy.",
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
      'rain-possible': "Possible showers",
      cloudy: "Cloudy",
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

    if (isWeekend && (condition === 'clear' || condition === 'heat')) {
      return 'Braai weather, boet!';
    }

    const linesHuman = {
      storm: [
        "Electric vibes. Don't be the tallest thing outside.",
        'Stormy mood — keep it safe, hey.',
        'Thunder rolling. Best stay close.',
        'Lights and rumbles — stay in if you can.',
        'Storm season energy, boet.'
      ],
      rain: [
        isNum(rainPct) && rainPct >= 70 ? "Plan indoors — today's moody." : 'Keep a jacket close.',
        "Grab the brolly, it's pissing down!",
        'Rain boots energy.',
        'Ja, it’s a wet one.',
        'Spat spat — pavement shimmer day.',
        'Clouds are doing the most today.'
      ],
      'rain-possible': [
        'Might sprinkle, boet.',
        'Teasing clouds.',
        'Possible showers — keep a brolly handy.',
        'Light drizzle vibes, just in case.',
        'Rain could pop in, hey.'
      ],
      cloudy: [
        'Clouds gatecrashing the party.',
        'Breezy boet, hold onto your hat!',
        'Overcast vibes, still lekker.',
        'Clouds doing the slow dance.',
        'Grey skies, easy pace.'
      ],
      wind: [
        'Hold onto your hat.',
        'Windy vibes — hair will do its own thing.',
        'Breezy day, hey.',
        'Lekker gusts — doors will slam.',
        'Cape Doctor is on duty.'
      ],
      cold: [
        "Ja, it's jacket weather.",
        'Brrr, bokdrol weather!',
        'Layer up, boet.',
        'Cold enough for beanies.',
        'Blanket weather, no shame.'
      ],
      heat: [
        'Big heat — pace yourself outside.',
        'Sun is proper, hey.',
        'Hot one — find some shade.',
        'Ice‑cold drink kind of day.',
        'Shade is the new lifestyle.'
      ],
      fog: [
        "Visibility vibes: drive like you've got a gran in the back.",
        'Foggy mood — take it slow.',
        'Low vis, high chill.',
        'Misty scenes — lights on.',
        'Fog is doing the rounds.'
      ],
      clear: [
        'Good day to get stuff done outside.',
        'Lekker clear skies.',
        'Fresh air kind of day.',
        'Blue skies, big smiles.',
        'Sun’s out, plans on.',
        'Perfect for a jol, boet!'
      ]
    };

    const options = linesHuman[condition] || ['Just... probably.'];
    return options[Math.floor(Math.random() * options.length)];
  }

  // ========== BACKGROUND IMAGE LOGIC ==========
  // Background folder MUST match dominant condition exactly
  // Fallback: same folder → clear (NEVER cloudy)

  function setBackgroundFor(condition) {
    const base = 'assets/images/bg';
    const folder = condition === 'rain-possible' ? 'cloudy' : condition;
    const fallbackFolder = 'clear';
    
    // Determine time of day based on current hour
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    let timeOfDay;
    
    if (hour >= 5 && hour < 8) {
      timeOfDay = 'dawn';
    } else if (hour >= 8 && hour < 17) {
      timeOfDay = 'day';
    } else if ((hour >= 17 && hour < 19) || (hour === 19 && minute < 30)) {
      timeOfDay = 'dusk';
    } else {
      timeOfDay = 'night';
    }
    
    const path = `${base}/${folder}/${timeOfDay}.jpg`;

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
    
    let particleClass = null;
    let amount = count;
    if (condition === 'rain' || condition === 'storm') {
      particleClass = 'rain';
      amount = 28;
    } else if (condition === 'cold') {
      particleClass = 'snow';
      amount = 18;
    } else if (condition === 'wind') {
      particleClass = 'wind';
      amount = 16;
    }

    if (!particleClass) return;

    for (let i = 0; i < amount; i++) {
      const particle = document.createElement('div');
      particle.classList.add('particle', particleClass);
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.animationDelay = `${Math.random() * 2}s`;
      particle.style.animationDuration = `${Math.random() * 3 + 2}s`;
      particlesEl.appendChild(particle);
    }
  }

  // ========== API & DATA ==========
  
  async function reverseGeocode(lat, lon) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`,
        { 
          headers: { 'User-Agent': 'ProbablyWeather/1.0' },
          signal: AbortSignal.timeout(5000)
        }
      );
      
      if (!response.ok) return null;
      
      const data = await response.json();
      
      // Extract city name - try suburb first (for Strand), then city/town/etc
      const city = data.address?.suburb || 
                   data.address?.city || 
                   data.address?.town || 
                   data.address?.village || 
                   data.address?.municipality ||
                   'Unknown Location';
      
      const country = data.address?.country || '';
      return country ? `${city}, ${country}` : city;
      
    } catch (error) {
      console.warn('[GEOCODE] Error:', error.message);
      return null;
    }
  }
  
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
      windKph: isNum(payload.wind_kph) ? payload.wind_kph : (isNum(now.windKph) ? now.windKph : 0),
      conditionKey: now.conditionKey || today.conditionKey || null,
      conditionLabel: now.conditionLabel || today.conditionLabel || 'Weather today',
      confidenceKey: payload.consensus?.confidenceKey || 'mixed',
      used: sources.filter(s => s.ok).map(s => s.name),
      failed: sources.filter(s => !s.ok).map(s => s.name),
      hourly: payload.hourly || [],
      daily: payload.daily || [],
      locationName: payload.location?.name,
      sourceRanges: meta.sourceRanges || [],
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

  function renderSidebar(norm) {
    // INVARIANT 1: If called with null/undefined, do nothing but don't break
    if (!norm) {
      // Runtime check: if __PW_LAST_NORM exists but norm is null, this is a programming error
      if (window.__PW_LAST_NORM) {
        console.error('[INVARIANT VIOLATION] renderSidebar called with null but __PW_LAST_NORM exists. Using cached data.');
        norm = window.__PW_LAST_NORM;
      } else {
        return; // No data available, early exit is safe
      }
    }
    
    const rain = norm.rainPct;
    const uv = norm.uv;
    const condition = computeDominantCondition(norm);

    let windValueEl = document.getElementById('windValue');
    if (!windValueEl) {
      const sidebar = document.querySelector('.sidebar');
      if (sidebar) {
        const card = document.createElement('div');
        card.className = 'card';
        const label = document.createElement('div');
        label.className = 'label';
        label.textContent = 'Wind';
        const value = document.createElement('div');
        value.className = 'value';
        value.id = 'windValue';
        card.appendChild(label);
        card.appendChild(value);
        if (rainValueEl && rainValueEl.parentElement) {
          sidebar.insertBefore(card, rainValueEl.parentElement);
        } else {
          sidebar.appendChild(card);
        }
        windValueEl = value;
      }
    }
    
    // Today's extreme
    const extremeLabel = getExtremeLabel(condition);
    safeText(extremeLabelEl, `Today's extreme:`);
    safeText(extremeValueEl, extremeLabel);
    
    // INVARIANT 2: Extreme label must never be empty string or undefined when data exists
    if (!extremeLabel) {
      console.error('[INVARIANT VIOLATION] getExtremeLabel returned empty for condition:', condition);
    }

    // Rain display
    if (isNum(rain)) {
      const rainText = rain < THRESH.RAIN_NONE ? 'None expected'
                     : rain < THRESH.RAIN_UNLIKELY ? 'Unlikely'
                     : rain < THRESH.RAIN_POSSIBLE ? 'Possible'
                     : 'Likely';
      safeText(rainValueEl, rainText);
      
      // INVARIANT 3: Rain text must be one of the valid strings when rain is numeric
      if (!['None expected', 'Unlikely', 'Possible', 'Likely'].includes(rainText)) {
        console.error('[INVARIANT VIOLATION] Invalid rain text computed:', rainText, 'for rain:', rain);
      }
    } else {
      safeText(rainValueEl, '--');
    }

    if (windValueEl) {
      const windKph = isNum(norm.windKph) ? norm.windKph : 0;
      safeText(windValueEl, formatWind(windKph));
    }

    // UV display
    if (isNum(uv)) {
      const uvText = uv < THRESH.UV_LOW ? 'Low'
                   : uv < THRESH.UV_MODERATE ? 'Moderate'
                   : uv < THRESH.UV_HIGH ? 'High'
                   : uv < THRESH.UV_VERY_HIGH ? 'Very High'
                   : 'Extreme';
      safeText(uvValueEl, `${uvText} (${round0(uv)})`);
      
      // INVARIANT 4: UV text must be one of the valid categories when UV is numeric
      if (!['Low', 'Moderate', 'High', 'Very High', 'Extreme'].includes(uvText)) {
        console.error('[INVARIANT VIOLATION] Invalid UV text computed:', uvText, 'for UV:', uv);
      }
    } else {
      safeText(uvValueEl, '--');
    }

    // Source Ranges - show individual source temperature ranges
    const sourceRanges = norm.sourceRanges || [];
    if (sourceRanges.length > 0) {
      const rangesText = sourceRanges
        .filter(s => isNum(s.minTemp) && isNum(s.maxTemp))
        .map(s => `${s.name}: ${round0(s.minTemp)}°-${round0(s.maxTemp)}°`)
        .join('\n');
      
      safeText($('#confidenceValue'), rangesText || '--');
    } else {
      // Fallback if no ranges (or render "Agreement" as fallback)
      const confMap = { strong: 'Strong', decent: 'Decent', mixed: 'Mixed' };
      const confText = confMap[norm.confidenceKey] || 'Mixed';
      safeText($('#confidenceValue'), confText);
    }

    // Hide confidence bar
    if (confidenceBarEl) {
      confidenceBarEl.style.display = 'none';
    }
    
    // INVARIANT 7: Log successful render for verification
    console.log('[SIDEBAR] Rendered successfully. Source Ranges:', sourceRanges.length);
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
    // Use hourly[0] median for home mood
    const currentHour = Array.isArray(norm.hourly) ? norm.hourly[0] : null;
    const hourRain = currentHour?.rainChance;
    const hourCloud = currentHour?.cloudPct;
    const hourWind = currentHour?.windKph;
    let condition = computeDominantCondition(norm);
    if (isNum(hourRain)) {
      if (hourRain > 30) condition = 'rain';
      else if (hourRain > 0) condition = 'rain-possible';
      else if (hourRain === 0 && isNum(hourCloud) && hourCloud > 50) condition = 'cloudy';
      else if (hourRain === 0 && isNum(hourWind) && hourWind > 20) condition = 'wind';
      else if (hourRain === 0) condition = 'clear';
    }

    // Set body class for condition-based styling
    document.body.className = `weather-${condition}`;
    const uiTone = ['clear', 'heat'].includes(condition) ? 'ui-light' : 'ui-dark';
    document.body.classList.remove('ui-light', 'ui-dark');
    document.body.classList.add(uiTone);
    document.body.style.setProperty('--panel-text', uiTone === 'ui-light' ? '#222' : '#eee');
    document.body.style.setProperty('--panel-subtext', uiTone === 'ui-light' ? '#4b5563' : '#cbd5e1');

    // Location - use API location name if available
    let locationName = norm.locationName || activePlace?.name || 'My Location';

    // Show initial value immediately
    safeText(locationEl, locationName);

    // If we only have "My Location" but we have coordinates, reverse geocode
    if (locationName === 'My Location' && activePlace?.lat && activePlace?.lon) {
      const currentPlace = activePlace; 
      
      reverseGeocode(activePlace.lat, activePlace.lon)
        .then(cityName => {
          if (cityName && currentPlace === activePlace) {
            safeText(locationEl, cityName);
            // Cache the result
            if (activePlace) activePlace.name = cityName;
            if (homePlace && homePlace.lat === currentPlace.lat && homePlace.lon === currentPlace.lon) {
              homePlace.name = cityName;
              saveJSON(STORAGE.home, homePlace);
            }
          }
        })
        .catch(error => {
          console.warn('[GEOCODE] Failed to reverse geocode:', error);
        });
    }
    
    // Hero headline - driven by condition (Spec Section 6)
    safeText(headlineEl, getHeadline(condition));
    
    // Temperature range
    const lowStr = isNum(low) ? formatTemp(low) : '--°';
    const hiStr = isNum(hi) ? formatTemp(hi) : '--°';
    safeText(tempEl, `${lowStr} – ${hiStr}`);
    
    // Witty line - driven by condition (Spec Section 7)
    safeText(descriptionEl, getWittyLine(condition, rain, hi));

    // Render sidebar (extracted for reuse across tabs)
    renderSidebar(norm);

    // Confidence
    const confLabel = (norm.confidenceKey || 'mixed').toUpperCase();
    safeText(confidenceEl, `PROBABLY • ${confLabel} CONFIDENCE`);

    // Sources
    const usedTxt = norm.used.length ? `Probable (combined): ${norm.used.join(', ')}` : 'Sources: —';
    const failedTxt = norm.failed.length ? `Failed: ${norm.failed.join(', ')}` : '';
    safeText(sourcesEl, `${usedTxt}${failedTxt ? ' · ' + failedTxt : ''}`);

    // Background - driven by condition (Spec Section 5)
    setBackgroundFor(condition);
    
    // Particles - driven by condition
    createParticles(condition);
  }

  function renderUpdatedAt(payload) {
    const updatedEl = document.getElementById('updatedAt');
    if (!updatedEl) return;
    const updatedAtLabel = payload?.meta?.updatedAtLabel;
    if (!updatedAtLabel) return;

    const cleanUpdatedAt = String(updatedAtLabel).split('.')[0];
    const timeOnly = cleanUpdatedAt.includes('T')
      ? cleanUpdatedAt.split('T')[1]?.slice(0, 5)
      : cleanUpdatedAt.slice(0, 5);
    let text = `Updated ${timeOnly}`;
    const lastData = window.lastData;
    if (navigator.onLine === false && lastData?.timestamp) {
      text += ` (offline, from ${lastData.timestamp})`;
    }
    updatedEl.textContent = text;
  }

  function renderHourly(hourly) {
    if (!hourlyTimeline) return;
    hourlyTimeline.innerHTML = '';
    hourly.forEach((h, i) => {
      const div = document.createElement('div');
      div.classList.add('hourly-card');
      const spread = isNum(h.tempC) && isNum(h.windKph) ? Math.abs(h.tempC - h.windKph / 5) : null;
      const confClass = spread == null ? 'conf-med'
        : spread < 2 ? 'conf-high'
        : spread < 5 ? 'conf-med'
        : 'conf-low';
      const hourTime = h.timeLocal || new Date(Date.now() + i * 3600000).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: settings.time === '12'
      });
      const tempStr = formatTemp(h.tempC);
      const rainStr = isNum(h.rainChance) ? `${round0(h.rainChance)}%` : '--%';
      const windStr = isNum(h.windKph) ? formatWind(h.windKph) : '--';
      div.innerHTML = `
        <div class="hour-row">
          <div class="hour-time">${hourTime}</div>
          <div class="confidence-row">
            <span class="confidence-dot ${confClass}"></span>
            <span class="confidence-dot ${confClass}"></span>
            <span class="confidence-dot ${confClass}"></span>
          </div>
        </div>
        <div class="hour-temp">${tempStr}</div>
        <div class="hour-rain"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 14h12M8 18h8M9 10h6" /></svg> ${rainStr}</div>
        <div class="hour-wind"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h18M3 6h18M3 18h18" /></svg> ${windStr}</div>
        <div class="precip-bar" style="--prob:${isNum(h.rainChance) ? round0(h.rainChance) : 0}"></div>
      `;
      hourlyTimeline.appendChild(div);
    });
  }

  function renderWeek(daily) {
    if (!dailyCards) return;
    dailyCards.innerHTML = '';
    daily.forEach((d, i) => {
      const dayName = d.dayLabel || new Date(Date.now() + i * 86400000).toLocaleDateString('en-US', { weekday: 'short' });
      const lowStr = isNum(d.lowC) ? formatTemp(d.lowC).replace('°', '') : '--';
      const highStr = isNum(d.highC) ? formatTemp(d.highC).replace('°', '') : '--';
      const medianStr = isNum(d.lowC) && isNum(d.highC)
        ? round0((convertTemp(d.lowC) + convertTemp(d.highC)) / 2)
        : '--';
      const rainStr = isNum(d.rainChance) ? `${round0(d.rainChance)}%` : '--%';
      const spread = isNum(d.highC) && isNum(d.lowC) ? Math.abs(d.highC - d.lowC) : null;
      const confClass = spread == null ? 'conf-med'
        : spread < 2 ? 'conf-high'
        : spread < 5 ? 'conf-med'
        : 'conf-low';
      const div = document.createElement('div');
      div.classList.add('daily-card');
      const tempLine = settings.range
        ? `${lowStr}° – ${highStr}°`
        : `${medianStr}°`;
      div.innerHTML = `
        <div class="day-row">
          <div class="day-name">${dayName}</div>
          <div class="confidence-row">
            <span class="confidence-dot ${confClass}"></span>
            <span class="confidence-dot ${confClass}"></span>
            <span class="confidence-dot ${confClass}"></span>
          </div>
        </div>
        <div class="day-temp">${tempLine}</div>
        <div class="day-rain"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 14h12M8 18h8M9 10h6" /></svg> ${rainStr}</div>
        <div class="day-uv"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v4M12 17v4M4.2 6.2l2.8 2.8M17 17l2.8 2.8M3 12h4M17 12h4M6.2 19.8l2.8-2.8M17 7l2.8-2.8" /></svg> ${isNum(d.uv) ? round0(d.uv) : '--'}</div>
        <div class="precip-bar" style="--prob:${isNum(d.rainChance) ? round0(d.rainChance) : 0}"></div>
      `;
      dailyCards.appendChild(div);
    });
  }

  function loadCity(city) {
    if (typeof city === 'string' && city.trim()) {
      state.city = city.trim();
    }
    const place = activePlace || homePlace;
    if (place) loadAndRender(place);
  }

  function applySettings() {
    if (unitsTempSelect) unitsTempSelect.value = settings.temp;
    if (unitsWindSelect) unitsWindSelect.value = settings.wind;
    if (probRangeToggle) probRangeToggle.checked = !!settings.range;
    if (timeFormatSelect) timeFormatSelect.value = settings.time;

    if (taglineEl) {
      taglineEl.textContent = 'No more Ja-No-Maybe weather. Just Probably.';
    }

    if (lastPayload) {
      const norm = normalizePayload(lastPayload);
      window.__PW_LAST_NORM = norm;
      renderHome(norm);
      renderHourly(norm.hourly);
      renderWeek(norm.daily);
      renderUpdatedAt(lastPayload);
    }
  }

  async function loadAndRender(place) {
    activePlace = place;
    renderLoading(place.name || 'My Location');
    try {
      const payload = await fetchProbable(place);
      lastPayload = payload;
      const norm = normalizePayload(payload);
      window.__PW_LAST_NORM = norm;
      renderHome(norm);
      renderHourly(norm.hourly);
      renderWeek(norm.daily);
      renderUpdatedAt(payload);
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
    const favorites = loadFavorites();
    if (favorites.some(p => samePlace(p, place))) return;
    const existing = loadRecents();
    if (existing.some(p => samePlace(p, place))) return;
    const list = [place, ...existing.filter(p => !samePlace(p, place))];
    saveRecents(list.slice(0, 20));
    renderRecents();
  }

  function clearRecents() {
    localStorage.removeItem(STORAGE.recents);
    renderRecents();
  }

  async function addFavorite(place) {
    let list = loadFavorites();
    if (list.some(p => samePlace(p, place))) {
      showToast('This place is already saved!');
      return;
    }
    if (list.length >= 5) {
      showToast('You can only save up to 5 places. Remove one first.');
      return;
    }
    const resolvedName = await resolvePlaceName(place);
    list.unshift({ ...place, name: resolvedName });
    saveFavorites(list.slice(0, 5));
    renderFavorites();
    showToast(`Saved ${place.name}!`);
  }

  async function addRecentIfNew(place) {
    const favorites = loadFavorites();
    if (favorites.some(p => samePlace(p, place))) return;
    const existing = loadRecents();
    if (existing.some(p => samePlace(p, place))) return;
    const resolvedName = await resolvePlaceName(place);
    const normalized = { ...place, name: resolvedName };
    const list = [normalized, ...existing.filter(p => !samePlace(p, normalized))];
    saveRecents(list.slice(0, 20));
    renderRecents();
  }

  async function toggleFavorite(place) {
    let list = loadFavorites();
    if (list.some(p => samePlace(p, place))) {
      list = list.filter(p => !samePlace(p, place));
      saveFavorites(list);
      renderFavorites();
      showToast('Place removed from favorites');
      return;
    }
    await addFavorite(place);
  }

  async function ensureFavoriteMeta(place) {
    if (!place || !isNum(place.lat) || !isNum(place.lon)) return;
    if (isNum(place.tempC) && place.conditionKey) return;
    const key = favoriteKey(place);
    if (pendingFavMeta.has(key)) return;
    pendingFavMeta.add(key);
    try {
      const payload = await fetchProbable(place);
      const norm = normalizePayload(payload);
      const list = loadFavorites();
      const idx = list.findIndex(p => samePlace(p, place));
      if (idx !== -1) {
        list[idx] = {
          ...list[idx],
          tempC: norm.nowTemp ?? null,
          conditionKey: norm.conditionKey ?? null
        };
        saveFavorites(list);
        renderFavorites();
      }
    } catch {
    } finally {
      pendingFavMeta.delete(key);
    }
  }

  function renderRecents() {
    if (!recentList) return;
    const list = loadRecents();
    recentList.innerHTML = list.map(p => `
      <li class="recent-item" data-lat="${p.lat}" data-lon="${p.lon}" data-name="${escapeHtml(p.name)}">${escapeHtml(p.name)}</li>
    `).join('') || '<li>No recent searches yet.</li>';

    recentList.querySelectorAll('li[data-lat]').forEach(li => {
      li.addEventListener('click', () => {
        const p = { name: li.dataset.name, lat: parseFloat(li.dataset.lat), lon: parseFloat(li.dataset.lon) };
        showScreen(screenHome);
        loadAndRender(p);
      });
    });
  }

  function renderFavorites() {
    if (!favoritesList) return;
    const list = loadFavorites();
    const favLimit = document.getElementById('favLimit');
    if (favLimit) {
      favLimit.style.display = list.length >= 5 ? 'block' : 'none';
    }
    favoritesList.innerHTML = list.map(p => {
      const temp = isNum(p.tempC) ? formatTemp(p.tempC) : '--°';
      const removeBtn = manageMode
        ? `<button class="remove-fav" data-lat="${p.lat}" data-lon="${p.lon}">✕</button>`
        : '';
      return `
      <li class="favorite-item" data-lat="${p.lat}" data-lon="${p.lon}" data-name="${escapeHtml(p.name)}">
        <button class="fav-star" data-lat="${p.lat}" data-lon="${p.lon}" aria-label="Remove favourite">★</button>
        <span class="fav-name">${escapeHtml(p.name)}</span>
        <span class="fav-temp">${temp}</span>
        ${removeBtn}
      </li>`;
    }).join('') || '<li>No saved places yet.</li>';

    favoritesList.querySelectorAll('li[data-lat] .fav-name').forEach(span => {
      span.addEventListener('click', () => {
        const li = span.closest('li');
        const p = { name: li.dataset.name, lat: parseFloat(li.dataset.lat), lon: parseFloat(li.dataset.lon) };
        showScreen(screenHome);
        loadAndRender(p);
      });
    });

    favoritesList.querySelectorAll('.fav-star').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const lat = parseFloat(btn.dataset.lat);
        const lon = parseFloat(btn.dataset.lon);
        const p = { name: btn.closest('li')?.dataset?.name, lat, lon };
        await toggleFavorite(p);
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

    list.forEach((p) => {
      ensureFavoriteMeta(p);
    });
  }

  // ========== SEARCH ==========
  
  let searchTimeout = null;
  let searchResults = [];
  const searchMiniCache = new Map();

  function parseQuery(raw) {
    const trimmed = raw.trim();
    const parts = trimmed.split(/\s+/);
    const last = parts[parts.length - 1];
    const countryMap = {
      us: 'us', usa: 'us', america: 'us', unitedstates: 'us', 'united-states': 'us',
      uk: 'gb', britain: 'gb', england: 'gb', scotland: 'gb', wales: 'gb',
      uae: 'ae', emirates: 'ae', sa: 'za', southafrica: 'za'
    };
    const lastKey = last?.toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, '');
    const countryCode = countryMap[lastKey] || (lastKey && lastKey.length === 2 ? lastKey : null);
    const baseQuery = countryCode ? parts.slice(0, -1).join(' ') : trimmed;
    return { baseQuery, countryCode };
  }

  async function miniFetchTemp(lat, lon) {
    const key = `${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`;
    if (searchMiniCache.has(key)) return searchMiniCache.get(key);
    try {
      const payload = await fetchProbable({ lat, lon, name: '' });
      const norm = normalizePayload(payload);
      const result = {
        temp: isNum(norm.nowTemp) ? formatTemp(norm.nowTemp) : '--°',
        icon: conditionEmoji(norm.conditionKey)
      };
      searchMiniCache.set(key, result);
      return result;
    } catch {
      return { temp: '--°', icon: '⛅' };
    }
  }
  
  async function runSearch(q) {
    if (!q || q.trim().length < 2) {
      const resultsContainer = document.getElementById('searchResults');
      if (resultsContainer) resultsContainer.innerHTML = '';
      return;
    }

    const { baseQuery, countryCode } = parseQuery(q);
    const queryText = baseQuery;

    const baseUrl = (query) =>
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}` +
      `&format=jsonv2&limit=10&addressdetails=1&bounded=0` +
      `&featureclass=P&featureclass=A` +
      `${countryCode ? `&countrycodes=${countryCode}` : `&countrycodes=za`}`;
    const hasComma = queryText.includes(',');
    try {
      let data = await (await fetch(baseUrl(queryText))).json();
      if (!hasComma && !countryCode && (!Array.isArray(data) || data.length === 0)) {
        data = await (await fetch(baseUrl(`${queryText}, South Africa`))).json();
      }
      if (!hasComma && !countryCode && (!Array.isArray(data) || data.length === 0)) {
        data = await (await fetch(baseUrl(`${queryText}, Western Cape, South Africa`))).json();
      }
      searchResults = data;
      renderSearchResults(data);
    } catch (e) {
      console.error('Search failed:', e);
    }
  }
  
  function renderSearchResults(results) {
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

    const favorites = loadFavorites();
    
    resultsList.innerHTML = results.map(r => {
      const displayName = escapeHtml(r.display_name);
      const isFav = favorites.some(p => samePlace(p, { lat: parseFloat(r.lat), lon: parseFloat(r.lon) }));
      const star = isFav ? '★' : '☆';
      return `
        <li class="search-result-item" data-lat="${r.lat}" data-lon="${r.lon}" data-name="${displayName}">
          <button class="fav-star${isFav ? ' is-fav' : ''}" data-lat="${r.lat}" data-lon="${r.lon}" aria-label="Toggle favourite">${star}</button>
          <span class="result-icon">⛅</span>
          <span class="result-name">${displayName}</span>
          <span class="result-temp">--°</span>
        </li>`;
    }).join('');
    
    resultsList.querySelectorAll('li[data-lat]').forEach(li => {
      li.addEventListener('click', async () => {
        const place = { 
          name: li.dataset.name, 
          lat: parseFloat(li.dataset.lat), 
          lon: parseFloat(li.dataset.lon) 
        };
        await addRecentIfNew(place);
        showScreen(screenHome);
        loadAndRender(place);
        if (searchInput) searchInput.value = '';
        resultsList.innerHTML = '';
      });
    });

    resultsList.querySelectorAll('.fav-star').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const lat = parseFloat(btn.dataset.lat);
        const lon = parseFloat(btn.dataset.lon);
        const name = btn.closest('li')?.dataset?.name;
        await toggleFavorite({ name, lat, lon });
        renderSearchResults(results);
      });
    });

    resultsList.querySelectorAll('li[data-lat]').forEach(async (li) => {
      const lat = parseFloat(li.dataset.lat);
      const lon = parseFloat(li.dataset.lon);
      const iconEl = li.querySelector('.result-icon');
      const tempEl = li.querySelector('.result-temp');
      const mini = await miniFetchTemp(lat, lon);
      if (iconEl) iconEl.textContent = mini.icon || '⛅';
      if (tempEl) tempEl.textContent = mini.temp || '--°';
    });
  }
  
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        runSearch(e.target.value);
      }, 300);
    });
  }

  // ========== NAVIGATION ==========
  
  navHome.addEventListener('click', () => {
    showScreen(screenHome);
    if (homePlace) loadAndRender(homePlace);
  });
  
  navHourly.addEventListener('click', () => {
    showScreen(screenHourly);
    if (window.__PW_LAST_NORM) {
      renderSidebar(window.__PW_LAST_NORM);
    } else {
      console.warn('[NAVIGATION] Switched to Hourly but no weather data loaded yet');
    }
  });
  
  navWeek.addEventListener('click', () => {
    showScreen(screenWeek);
    if (window.__PW_LAST_NORM) {
      renderSidebar(window.__PW_LAST_NORM);
    } else {
      console.warn('[NAVIGATION] Switched to Week but no weather data loaded yet');
    }
  });
  
  navSearch.addEventListener('click', () => {
    showScreen(screenSearch);
    renderRecents();
    renderFavorites();
    if (window.__PW_LAST_NORM) {
      renderSidebar(window.__PW_LAST_NORM);
    } else {
      console.warn('[NAVIGATION] Switched to Search but no weather data loaded yet');
    }
  });
  
  navSettings.addEventListener('click', () => {
    showScreen(screenSettings);
    if (window.__PW_LAST_NORM) {
      renderSidebar(window.__PW_LAST_NORM);
    } else {
      console.warn('[NAVIGATION] Switched to Settings but no weather data loaded yet');
    }
  });

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      if (navigator.onLine && state?.city) {
        loadCity(state.city);
      }
    });
  }

  if (unitsTempSelect) {
    unitsTempSelect.addEventListener('change', () => {
      settings.temp = unitsTempSelect.value;
      saveSettings();
      applySettings();
    });
  }

  if (unitsWindSelect) {
    unitsWindSelect.addEventListener('change', () => {
      settings.wind = unitsWindSelect.value;
      saveSettings();
      applySettings();
    });
  }

  if (probRangeToggle) {
    probRangeToggle.addEventListener('change', () => {
      settings.range = !!probRangeToggle.checked;
      saveSettings();
      applySettings();
    });
  }

  if (timeFormatSelect) {
    timeFormatSelect.addEventListener('change', () => {
      settings.time = timeFormatSelect.value;
      saveSettings();
      applySettings();
    });
  }

  if (saveCurrent) {
    saveCurrent.addEventListener('click', () => {
      if (activePlace) addFavorite(activePlace);
    });
  }
  
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
      manageMode = !manageMode;
      manageFavorites.textContent = manageMode ? 'Done' : 'Manage favourites';
      renderFavorites();
    });
  }

  if (clearRecentsBtn) {
    clearRecentsBtn.addEventListener('click', () => {
      clearRecents();
    });
  }

  // ========== INITIALIZATION ==========
  
  renderRecents();
  renderFavorites();
  loadSettings();
  applySettings();

  homePlace = loadJSON(STORAGE.home, null);
  const savedLocation = loadJSON(STORAGE.location, null);
  if (homePlace) {
    showScreen(screenHome);
    loadAndRender(homePlace);
  } else if (savedLocation?.lat && savedLocation?.lon) {
    const label = savedLocation.city && savedLocation.countryCode
      ? `${savedLocation.city}, ${savedLocation.countryCode}`
      : (savedLocation.city || "My Location");
    homePlace = { name: label, lat: savedLocation.lat, lon: savedLocation.lon };
    saveJSON(STORAGE.home, homePlace);
    showScreen(screenHome);
    loadAndRender(homePlace);
  } else {
    showScreen(screenHome);
    renderLoading("My Location");

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = round1(pos.coords.latitude);
          const lon = round1(pos.coords.longitude);
          try {
            const rev = await fetch(`/api/weather?reverse=1&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
            const data = await rev.json();
            const city = data?.city || "My Location";
            const countryCode = data?.countryCode || null;
            const name = countryCode ? `${city}, ${countryCode}` : city;
            saveJSON(STORAGE.location, { city, admin1: data?.admin1 || null, countryCode, lat, lon });
            homePlace = { name, lat, lon };
            saveJSON(STORAGE.home, homePlace);
            loadAndRender(homePlace);
          } catch {
            homePlace = { name: "My Location", lat, lon };
            saveJSON(STORAGE.home, homePlace);
            loadAndRender(homePlace);
          }
        },
        () => {
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