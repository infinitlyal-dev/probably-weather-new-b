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
  const clearRecentsBtn = $('#clearRecents');

  const unitsTempSelect = $('#unitsTemp');
  const unitsWindSelect = $('#unitsWind');
  const probRangeToggle = $('#probRange');
  const timeFormatSelect = $('#timeFormat');

  const loader = $('#loader');
  const toast = $('#toast');

  // ========== CONSTANTS ==========
  const STORAGE = {
    favorites: "pw_favorites",
    recents: "pw_recents",
    home: "pw_home",
    location: "pw_location"
  };

  const SCREENS = [screenHome, screenHourly, screenWeek, screenSearch, screenSettings];

  const THRESH = {
    RAIN_PCT: 40,
    WIND_KPH: 25,
    COLD_C: 16,
    HOT_C: 32,
    RAIN_NONE: 10,
    RAIN_UNLIKELY: 30,
    RAIN_POSSIBLE: 55,
    UV_LOW: 3,
    UV_MODERATE: 6,
    UV_HIGH: 8,
    UV_VERY_HIGH: 11
  };

  // ========== STATE ==========
  let activePlace = null;
  let homePlace = null;
  let lastPayload = null;
  window.__PW_LAST_NORM = null;
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
    time: '24'
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
      time: loadJSON(SETTINGS_KEYS.time, DEFAULT_SETTINGS.time)
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

    document.body.classList.toggle('modal-open', which && which !== screenHome);

    if (saveCurrent) {
      saveCurrent.style.display = which === screenHome ? '' : 'none';
    }
    
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      sidebar.style.display = which === screenHome ? '' : 'none';
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

  function escapeHtml(s) {
    return String(s ?? "").replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  // ========== SKY CONDITION ==========
  function computeSkyCondition(norm) {
    const condKey = (norm.conditionKey || '').toLowerCase();
    const rain = norm.rainPct;
    const cloudPct = Array.isArray(norm.hourly) && norm.hourly[0]?.cloudPct;

    if (condKey === 'storm' || condKey.includes('thunder')) return 'storm';
    if (condKey === 'fog' || condKey.includes('mist') || condKey.includes('haze')) return 'fog';
    if (isNum(rain) && rain >= 50) return 'rain';
    if (isNum(rain) && rain >= 30) return 'rain-possible';
    if ((isNum(cloudPct) && cloudPct >= 60) || condKey.includes('cloud') || condKey.includes('overcast')) return 'cloudy';
    return 'clear';
  }

  // ========== TODAY'S HERO ==========
  function computeTodaysHero(norm) {
    const condKey = (norm.conditionKey || '').toLowerCase();
    const rain = norm.rainPct;
    const wind = norm.windKph;
    const hi = norm.todayHigh;
    const uv = norm.uv;

    if (condKey === 'storm' || condKey.includes('thunder')) return 'storm';
    if (isNum(rain) && rain >= 50) return 'rain';
    if (isNum(rain) && rain >= 30) return 'rain';
    if (isNum(wind) && wind >= 20) return 'wind';
    if (isNum(hi) && hi >= THRESH.HOT_C) return 'heat';
    if (isNum(hi) && hi <= 10) return 'cold';
    if (isNum(uv) && uv >= 8) return 'uv';
    if (isNum(hi) && hi <= THRESH.COLD_C) return 'cold';
    return 'clear';
  }

  function computeHomeDisplayCondition(norm) {
    const hero = computeTodaysHero(norm);
    const sky = computeSkyCondition(norm);
    if (hero !== 'clear') return hero;
    return sky;
  }

  // ========== HEADLINES - Bold & Proud ==========
  function getHeadline(condition) {
    const headlines = {
      storm: "Storms rolling in.",
      rain: "Rain's here.",
      'rain-possible': "Might rain.",
      cloudy: "Cloudy vibes.",
      wind: "Wind's up.",
      cold: "It's chilly.",
      heat: "It's hot.",
      uv: "UV's hectic.",
      fog: "Foggy out there.",
      clear: "Clear skies."
    };
    return headlines[condition] || "Clear skies.";
  }

  function getHeroLabel(condition) {
    const labels = {
      storm: "Severe weather",
      rain: "Wet conditions",
      'rain-possible': "Possible showers",
      wind: "Gusty winds",
      cold: "Chilly",
      heat: "Very hot",
      uv: "High UV",
      fog: "Low visibility",
      clear: "Pleasant"
    };
    return labels[condition] || "Pleasant";
  }

  // ========== WITTY LINES - Proudly South African ==========
  function getWittyLine(condition, rainPct, maxC) {
    const day = new Date().getDay();
    const isWeekend = day === 0 || day === 5 || day === 6;

    // Weekend specials
    if (isWeekend && (condition === 'clear' || condition === 'heat')) {
      const weekendLines = [
        "Braai weather, boet!",
        "Fire up the Weber!",
        "Perfect for a jol outside.",
        "Get the tongs ready!",
        "Beach or braai? Both!",
        "Time to make some memories.",
        "The ancestors approve."
      ];
      return weekendLines[Math.floor(Math.random() * weekendLines.length)];
    }

    const lines = {
      storm: [
        "Jislaaik, stay inside!",
        "Thunder's grumbling, hey.",
        "Not even the taxi's running.",
        "Eskom wishes it had this power.",
        "The sky's having a moment.",
        "Cancel everything, seriously.",
        "Even the hadedas are quiet.",
        "Nature's putting on a show.",
        "Time to watch from the window.",
        "The mountain's angry today."
      ],
      rain: [
        "Grab your brolly, boet.",
        "Spat spat on the roof.",
        "The garden's saying dankie.",
        "Traffic's about to be chaos.",
        "Perfect weather for a movie.",
        "The dams are smiling.",
        "Wet socks incoming.",
        "Stay dry out there.",
        "The earth needed this.",
        "Cosy day inside."
      ],
      'rain-possible': [
        "Maybe rain, maybe not.",
        "Clouds looking suspicious.",
        "Take a brolly just in case.",
        "Could go either way.",
        "The weather's being shy.",
        "50/50 on getting wet.",
        "Nature's playing games.",
        "Keep one eye on the sky."
      ],
      cloudy: [
        "Grey skies, no drama.",
        "Overcast but okay.",
        "Good day for a walk.",
        "The sun's taking a nap.",
        "Moody but manageable.",
        "Perfect selfie lighting.",
        "The clouds are chilling.",
        "Not bad, not bad."
      ],
      uv: [
        "Sunscreen is not optional.",
        "SPF 50 or regret it.",
        "The sun's not playing.",
        "Seek shade, my friend.",
        "Your future self says thanks for the hat.",
        "Lobster red is not a good look.",
        "UV index is hectic today.",
        "Protect that face!",
        "The ozone layer tried its best."
      ],
      wind: [
        "Hold onto your hat!",
        "The southeaster's here.",
        "Table Mountain's tablecloth is out.",
        "Doors will slam today.",
        "Hair will be a problem.",
        "Kites are having the time of their lives.",
        "Walking home will be an adventure.",
        "The Cape Doctor is in.",
        "Windy, but you'll survive.",
        "Perfect for drying washing!"
      ],
      cold: [
        "Ja, it's jersey weather.",
        "Time to find that beanie.",
        "Cold enough for soup.",
        "The heater's working overtime.",
        "Hot chocolate kind of day.",
        "Cuddle weather, hey.",
        "Your breath's visible.",
        "The cold front has arrived.",
        "Layer up, buttercup.",
        "Even the penguins are shivering."
      ],
      heat: [
        "Jislaaik, it's hot!",
        "Melting is a real possibility.",
        "Ice cream is a necessity.",
        "The tar's getting soft.",
        "Shorts and slops only.",
        "Stay hydrated, boet.",
        "The pool is calling.",
        "Hotter than a bakkie bonnet.",
        "AC on full blast.",
        "The sun chose violence today.",
        "Too hot to think straight."
      ],
      fog: [
        "Can't see a thing, hey.",
        "Driving slow is the vibe.",
        "Mysterious morning.",
        "The fog's got atmosphere.",
        "Visibility is optional.",
        "Eerie but beautiful.",
        "Watch out for the other cars.",
        "The mist has rolled in."
      ],
      clear: [
        "Absolutely beautiful out there.",
        "Perfect day, no excuses.",
        "Get outside and enjoy it!",
        "The kind of day postcards are made of.",
        "Nothing to complain about.",
        "Blue skies and good vibes.",
        "Nature nailed it today.",
        "This is why we live here.",
        "Cherish this, it's perfect.",
        "Not a cloud in sight.",
        "Main character weather."
      ]
    };

    const options = lines[condition] || lines.clear;
    return options[Math.floor(Math.random() * options.length)];
  }

  // ========== BACKGROUND IMAGE ==========
  function setBackgroundFor(condition) {
    const base = 'assets/images/bg';
    const aliasMap = {
      'rain-possible': 'cloudy',
      'uv': 'clear'
    };
    const folder = aliasMap[condition] || condition;
    const fallbackFolder = condition === 'cold' ? 'cloudy' : 'clear';

    const now = new Date();
    const hour = now.getHours();
    let timeOfDay;

    if (hour >= 5 && hour < 8) timeOfDay = 'dawn';
    else if (hour >= 8 && hour < 17) timeOfDay = 'day';
    else if (hour >= 17 && hour < 20) timeOfDay = 'dusk';
    else timeOfDay = 'night';

    const path = `${base}/${folder}/${timeOfDay}.jpg`;

    if (bgImg) {
      bgImg.src = path;
      bgImg.onerror = () => {
        const fallback1 = `${base}/${folder}/day.jpg`;
        if (bgImg.src !== fallback1) {
          bgImg.src = fallback1;
          bgImg.onerror = () => {
            bgImg.src = `${base}/${fallbackFolder}/day.jpg`;
          };
        }
      };
    }
  }

  // ========== PARTICLES ==========
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
  }

  function renderSidebar(norm, heroOverride) {
    if (!norm) {
      if (window.__PW_LAST_NORM) {
        norm = window.__PW_LAST_NORM;
      } else {
        return;
      }
    }

    const rain = norm.rainPct;
    const uv = norm.uv;
    const hero = heroOverride || window.__PW_LAST_HERO || computeTodaysHero(norm);

    // Today's Hero
    const heroLabel = getHeroLabel(hero);
    safeText(extremeLabelEl, `Today's Hero:`);
    safeText(extremeValueEl, heroLabel);

    // Source Ranges
    const sourceRanges = norm.sourceRanges || [];
    if (sourceRanges.length > 0) {
      const rangesText = sourceRanges
        .filter(s => isNum(s.minTemp) && isNum(s.maxTemp))
        .map(s => `${s.name}: ${round0(s.minTemp)}°-${round0(s.maxTemp)}°`)
        .join('\n');
      
      safeText($('#confidenceValue'), rangesText || '--');
    } else {
      const confMap = { strong: 'Strong', decent: 'Decent', mixed: 'Mixed' };
      const confText = confMap[norm.confidenceKey] || 'Mixed';
      safeText($('#confidenceValue'), confText);
    }
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
    const wind = norm.windKph;
    const uv = norm.uv;

    const displayCondition = computeHomeDisplayCondition(norm);
    const hero = computeTodaysHero(norm);

    document.body.className = `weather-${displayCondition}`;

    // Location
    let locationName = norm.locationName || activePlace?.name || 'My Location';
    safeText(locationEl, locationName);

    if (locationName === 'My Location' && activePlace?.lat && activePlace?.lon) {
      const currentPlace = activePlace; 
      reverseGeocode(activePlace.lat, activePlace.lon)
        .then(cityName => {
          if (cityName && currentPlace === activePlace) {
            safeText(locationEl, cityName);
            if (activePlace) activePlace.name = cityName;
            if (homePlace && homePlace.lat === currentPlace.lat && homePlace.lon === currentPlace.lon) {
              homePlace.name = cityName;
              saveJSON(STORAGE.home, homePlace);
            }
          }
        })
        .catch(() => {});
    }
    
    // Headline
    safeText(headlineEl, getHeadline(displayCondition));

    // Temperature range
    const lowStr = isNum(low) ? formatTemp(low) : '--°';
    const hiStr = isNum(hi) ? formatTemp(hi) : '--°';
    safeText(tempEl, `${lowStr} – ${hiStr}`);

    // Witty line
    safeText(descriptionEl, getWittyLine(displayCondition, rain, hi));

    // Weather byline
    const bylineEl = $('#weatherByline');
    if (bylineEl) {
      const windStr = isNum(wind) ? formatWind(wind) : '--';
      const rainStr = isNum(rain) ? (rain < 10 ? 'None' : rain < 30 ? 'Unlikely' : rain < 55 ? 'Possible' : 'Likely') : '--';
      const uvStr = isNum(uv) ? (uv < 3 ? 'Low' : uv < 6 ? 'Moderate' : uv < 8 ? 'High' : 'Very High') + ` (${round0(uv)})` : '--';
      bylineEl.innerHTML = `Wind ${windStr} • Rain ${rainStr} • UV ${uvStr}`;
    }

    // Condition text styling
    const heroClasses = ['hero-storm', 'hero-rain', 'hero-heat', 'hero-cold', 'hero-wind', 'hero-uv', 'hero-clear', 'hero-cloudy', 'hero-fog'];
    [headlineEl, tempEl, descriptionEl].forEach(el => {
      if (el) {
        el.classList.remove(...heroClasses);
        el.classList.add('hero-' + displayCondition);
      }
    });

    window.__PW_LAST_DISPLAY = displayCondition;
    window.__PW_LAST_HERO = hero;

    renderSidebar(norm, hero);
    setBackgroundFor(displayCondition);
    createParticles(displayCondition);
  }

  function getWeatherIcon(rainPct, cloudPct, tempC) {
    if (isNum(rainPct) && rainPct >= 50) return '🌧️';
    if (isNum(rainPct) && rainPct >= 30) return '🌦️';
    if (isNum(cloudPct) && cloudPct >= 70) return '☁️';
    if (isNum(cloudPct) && cloudPct >= 40) return '⛅';
    if (isNum(tempC) && tempC >= 30) return '🔥';
    if (isNum(tempC) && tempC <= 5) return '❄️';
    return '☀️';
  }

  // ========== HOURLY - Compact Horizontal ==========
  function renderHourly(hourly) {
    if (!hourlyTimeline) return;
    hourlyTimeline.innerHTML = '';
    
    // Show next 24 hours
    const hoursToShow = hourly.slice(0, 24);
    
    hoursToShow.forEach((h, i) => {
      const div = document.createElement('div');
      div.classList.add('hourly-card');
      
      const hourTime = h.timeLocal || new Date(Date.now() + i * 3600000).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: settings.time === '12'
      });
      
      const tempStr = formatTemp(h.tempC);
      const icon = getWeatherIcon(h.rainChance, h.cloudPct, h.tempC);
      const rainStr = isNum(h.rainChance) ? `${round0(h.rainChance)}%` : '--%';
      
      div.innerHTML = `
        <div class="hour-time"><span class="weather-icon">${icon}</span>${hourTime}</div>
        <div class="hour-temp">${tempStr}</div>
        <div class="hour-detail"><span class="detail-value">${rainStr}</span></div>
      `;
      hourlyTimeline.appendChild(div);
    });
  }

  // ========== WEEKLY - Compact Horizontal ==========
  function computeDayHero(d) {
    const rain = d.rainChance;
    const uv = d.uv;
    const hi = d.highC;

    if (isNum(rain) && rain >= 50) return 'Rainy';
    if (isNum(rain) && rain >= 30) return 'Showers';
    if (isNum(uv) && uv >= 8) return 'High UV';
    if (isNum(hi) && hi >= THRESH.HOT_C) return 'Hot';
    if (isNum(hi) && hi <= 10) return 'Cold';
    if (isNum(uv) && uv >= 6) return 'UV Alert';
    return '';
  }

  function renderWeek(daily) {
    if (!dailyCards) return;
    dailyCards.innerHTML = '';
    
    daily.forEach((d, i) => {
      const dayName = d.dayLabel || new Date(Date.now() + i * 86400000).toLocaleDateString('en-US', { weekday: 'short' });
      const highStr = isNum(d.highC) ? formatTemp(d.highC) : '--°';
      const lowStr = isNum(d.lowC) ? formatTemp(d.lowC) : '--°';
      const dayHero = computeDayHero(d);
      const icon = getWeatherIcon(d.rainChance, d.cloudPct, d.highC);
      const rainStr = isNum(d.rainChance) ? `${round0(d.rainChance)}%` : '--%';
      
      const div = document.createElement('div');
      div.classList.add('daily-card');
      
      div.innerHTML = `
        <div class="day-name"><span class="weather-icon">${icon}</span>${dayName}</div>
        <div class="day-temp">${highStr}</div>
        <div class="day-temp" style="font-size:0.8rem;opacity:0.7;">${lowStr}</div>
        ${dayHero ? `<div class="day-hero">${dayHero}</div>` : ''}
        <div class="day-detail"><span class="detail-label">Rain</span><span class="detail-value">${rainStr}</span></div>
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

    if (lastPayload) {
      const norm = normalizePayload(lastPayload);
      window.__PW_LAST_NORM = norm;
      renderHome(norm);
      renderHourly(norm.hourly);
      renderWeek(norm.daily);
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
    } catch (e) {
      console.error("Load failed:", e);
      renderError("Couldn't fetch weather right now.");
    }
  }

  // ========== FAVORITES & RECENTS ==========
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
      showToast('Already saved!');
      return;
    }
    if (list.length >= 5) {
      showToast('Max 5 places. Remove one first.');
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
      showToast('Removed from favorites');
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
    `).join('') || '<li style="opacity:0.6;cursor:default;">No recent searches yet.</li>';

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
    }).join('') || '<li style="opacity:0.6;cursor:default;">No saved places yet.</li>';

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
        showToast('Removed');
      });
    });

    list.forEach((p) => ensureFavoriteMeta(p));
  }

  // ========== SEARCH ==========
  let searchTimeout = null;
  let searchResults = [];
  let activeSearchController = null;
  let searchSeq = 0;
  const searchMiniCache = new Map();

  function parseQuery(raw) {
    const trimmed = raw.trim();
    const parts = trimmed.split(/\s+/);
    const last = parts[parts.length - 1];
    const countryMap = {
      us: 'us', usa: 'us', america: 'us', unitedstates: 'us',
      uk: 'gb', britain: 'gb', england: 'gb',
      uae: 'ae', sa: 'za', southafrica: 'za'
    };
    const lastKey = last?.toLowerCase().replace(/[.,]/g, '');
    const countryCode = countryMap[lastKey] || (lastKey && lastKey.length === 2 ? lastKey : null);
    const baseQuery = countryCode ? parts.slice(0, -1).join(' ') : trimmed;
    return { baseQuery, countryCode };
  }

  async function runSearch(query) {
    if (!query || query.length < 2) {
      renderSearchResults([]);
      return;
    }

    const thisSeq = ++searchSeq;
    if (activeSearchController) activeSearchController.abort();
    activeSearchController = new AbortController();

    const { baseQuery, countryCode } = parseQuery(query);
    
    try {
      let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(baseQuery)}&limit=8&addressdetails=1`;
      if (countryCode) url += `&countrycodes=${countryCode}`;
      
      const response = await fetch(url, {
        headers: { 'User-Agent': 'ProbablyWeather/1.0' },
        signal: activeSearchController.signal
      });
      
      if (thisSeq !== searchSeq) return;
      if (!response.ok) throw new Error('Search failed');
      
      const data = await response.json();
      searchResults = data.map(r => ({
        name: r.display_name?.split(',')[0] || 'Unknown',
        fullName: r.display_name,
        lat: r.lat,
        lon: r.lon,
        address: r.address
      }));
      
      renderSearchResults(searchResults);
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error('Search error:', e);
      }
    }
  }

  function formatSearchResult(r) {
    const addr = r.address || {};
    const city = addr.city || addr.town || addr.village || r.name;
    const country = addr.country || '';
    return country ? `${city}, ${country}` : city;
  }

  async function miniFetchTemp(lat, lon) {
    const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    if (searchMiniCache.has(key)) return searchMiniCache.get(key);
    
    try {
      const payload = await fetchProbable({ lat, lon, name: '' });
      const norm = normalizePayload(payload);
      const result = {
        temp: formatTemp(norm.nowTemp),
        icon: conditionEmoji(norm.conditionKey)
      };
      searchMiniCache.set(key, result);
      return result;
    } catch {
      return { temp: '--°', icon: '⛅' };
    }
  }

  function renderSearchResults(results) {
    const resultsList = document.getElementById('searchResults') || (() => {
      const ul = document.createElement('ul');
      ul.id = 'searchResults';
      ul.className = 'search-results';
      const searchBody = document.querySelector('.search-body');
      if (searchBody) searchBody.prepend(ul);
      return ul;
    })();

    if (!results.length) {
      resultsList.innerHTML = '';
      return;
    }

    const favorites = loadFavorites();

    resultsList.innerHTML = results.map(r => {
      const formattedName = escapeHtml(formatSearchResult(r));
      const isFav = favorites.some(p => samePlace(p, { lat: parseFloat(r.lat), lon: parseFloat(r.lon) }));
      const star = isFav ? '★' : '☆';
      return `
        <li class="search-result-item" data-lat="${r.lat}" data-lon="${r.lon}" data-name="${formattedName}">
          <button class="fav-star${isFav ? ' is-fav' : ''}" data-lat="${r.lat}" data-lon="${r.lon}">${star}</button>
          <span class="result-icon">⛅</span>
          <span class="result-name">${formattedName}</span>
          <span class="result-temp">--°</span>
        </li>`;
    }).join('');
    
    resultsList.querySelectorAll('li[data-lat]').forEach(li => {
      li.addEventListener('click', async (e) => {
        if (e.target.closest('.fav-star')) return;
        const place = {
          name: li.dataset.name,
          lat: parseFloat(li.dataset.lat),
          lon: parseFloat(li.dataset.lon)
        };
        showScreen(screenHome);
        loadAndRender(place);
        if (searchInput) searchInput.value = '';
        resultsList.innerHTML = '';
        addRecentIfNew(place).catch(() => {});
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
  navHome?.addEventListener('click', () => {
    showScreen(screenHome);
    if (homePlace) loadAndRender(homePlace);
  });
  
  navHourly?.addEventListener('click', () => {
    showScreen(screenHourly);
  });
  
  navWeek?.addEventListener('click', () => {
    showScreen(screenWeek);
  });
  
  navSearch?.addEventListener('click', () => {
    showScreen(screenSearch);
    renderRecents();
    renderFavorites();
  });
  
  navSettings?.addEventListener('click', () => {
    showScreen(screenSettings);
  });

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
      showToast('Recents cleared');
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
