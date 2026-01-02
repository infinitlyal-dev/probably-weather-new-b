document.addEventListener('DOMContentLoaded', () => {
  const bgImg = document.getElementById('bgImg');
  const heatOverlay = document.getElementById('heatOverlay');
  const body = document.body;
  const headline = document.getElementById('headline');
  const temp = document.getElementById('temp');
  const description = document.getElementById('description');
  const extremeLabel = document.getElementById('extremeLabel');
  const extremeValue = document.getElementById('extremeValue');
  const rainValue = document.getElementById('rainValue');
  const uvValue = document.getElementById('uvValue');
  const confidenceValue = document.getElementById('confidenceValue');
  const confidenceEl = document.getElementById('confidence');
  const locationEl = document.getElementById('location');
  const particles = document.getElementById('particles');
  const homeScreen = document.getElementById('home-screen');
  const hourlyScreen = document.getElementById('hourly-screen');
  const weekScreen = document.getElementById('week-screen');
  const searchScreen = document.getElementById('search-screen');
  const settingsScreen = document.getElementById('settings-screen');
  const dailyCards = document.getElementById('dailyCards');
  const hourlyTimeline = document.getElementById('hourlyTimeline');
  const searchInput = document.getElementById('searchInput');
  const saveCurrentBtn = document.getElementById('saveCurrent');
  const manageFavorites = document.getElementById('manageFavorites');
  const loader = document.getElementById('loader');
  const toast = document.getElementById('toast');
  const navHome = document.getElementById('navHome');
  const navHourly = document.getElementById('navHourly');
  const navWeek = document.getElementById('navWeek');
  const navSearch = document.getElementById('navSearch');
  const navSettings = document.getElementById('navSettings');

  let currentLat = -34.104;
  let currentLon = 18.817;
  let units = localStorage.getItem('units') || 'C';
  let theme = localStorage.getItem('theme') || 'auto';
  let apiMode = localStorage.getItem('api') || 'single';
  let favorites = JSON.parse(localStorage.getItem('probablyFavorites') || '[]');
  let recents = JSON.parse(localStorage.getItem('probablyRecents') || '[]');

  // ... (keep humor, dummyHourly, dummyDaily as is) ...

  const cached = localStorage.getItem('lastWeatherData');
  if (cached) {
    const data = JSON.parse(cached);
    updateUI(data);
    renderHourly(data.hourly || dummyHourly);
    renderWeek(data.daily || dummyDaily);
  } else {
    fallbackUI();
  }

  navigator.geolocation.getCurrentPosition(async (pos) => {
    currentLat = pos.coords.latitude;
    currentLon = pos.coords.longitude;
    const city = await reverseGeocode(currentLat, currentLon);
    locationEl.innerText = city || 'Your Location';
    await fetchWeather(currentLat, currentLon);
  }, async () => {
    locationEl.innerText = 'Strand, WC';
    await fetchWeather(currentLat, currentLon);
  });

  // ... (keep reverseGeocode as is) ...

  async function fetchWeather(lat, lon) {
    loader.classList.remove('hidden');
    try {
      let data;
      if (apiMode === 'multi') {
        data = await fetchMulti(lat, lon); // New multi function below
      } else {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,is_day&hourly=temperature_2m,precipitation_probability&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max&timezone=auto&forecast_days=7`;
        const res = await fetch(url, { signal: new AbortController().signal });
        if (!res.ok) throw new Error('Fetch failed');
        data = await res.json();
        data.confidence_level = 'High';
      }

      const processed = processData(data); // New process function to handle units, condition
      localStorage.setItem('lastWeatherData', JSON.stringify(processed));
      updateUI(processed);
      renderHourly(processed.hourly);
      renderWeek(processed.daily);
    } catch (e) {
      console.error('Fetch error:', e);
      fallbackUI();
    } finally {
      loader.classList.add('hidden');
    }
  }

  async function fetchMulti(lat, lon) {
    const omUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,is_day&hourly=temperature_2m,precipitation_probability&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max&timezone=auto&forecast_days=7`;
    const waUrl = `https://api.weatherapi.com/v1/forecast.json?key=a98886bfef6c4dcd8bf111514251512&q=${lat},${lon}&days=7`;

    const [omRes, waRes] = await Promise.all([fetch(omUrl), fetch(waUrl)].map(p => p.catch(() => null)));
    const omData = omRes && omRes.ok ? await omRes.json() : null;
    const waData = waRes && waRes.ok ? await waRes.json() : null;

    if (!omData && !waData) throw new Error('All sources failed');

    // Simple median aggregation (keep as is from earlier, but simplified)
    const aggregated = { /* ... implement median for temp, rain, etc. as in initial multi code ... */ };
    aggregated.confidence_level = (omData && waData) ? (/* range check for High/Low */ ) : 'Medium';
    return aggregated;
  }

  function processData(data) {
    const processed = {
      /* ... keep existing processing, add units conversion ... */
      lowTemp: units === 'F' ? cToF(data.daily.temperature_2m_min[0]) : Math.round(data.daily.temperature_2m_min[0]),
      highTemp: units === 'F' ? cToF(data.daily.temperature_2m_max[0]) : Math.round(data.daily.temperature_2m_max[0]),
      /* ... similar for hourly/daily temps ... */
    };
    return processed;
  }

  function cToF(c) {
    return Math.round((c * 9/5) + 32);
  }

  // ... (keep determineCondition with priority: cold/heat > rain/storm > wind > fog > clear) ...

  // ... (keep getTimeOfDay, updateUI, renderHourly now without %3 skip, add day labels and rain classes) ...

  function renderHourly(hourly) {
    hourlyTimeline.innerHTML = '';
    (hourly || dummyHourly).forEach((h, i) => {
      const date = new Date(h.time);
      const dayLabel = i < 24 ? 'Today' : 'Tomorrow';
      const hour = date.getHours().toString().padStart(2, '0') + ':00';
      const card = document.createElement('div');
      card.classList.add('hourly-card');
      card.innerHTML = `
        <div class="hour-time">${dayLabel} ${hour}</div>
        <div class="hour-temp">${h.temp}°</div>
        <div class="hour-rain ${h.rain < 20 ? '' : h.rain < 50 ? 'medium' : 'high'}">${h.rain}% rain</div>
      `;
      hourlyTimeline.appendChild(card);
    });
  }

  // ... (keep renderWeek with full month date.toLocaleDateString({ weekday: 'short', month: 'long', day: 'numeric' })) ...

  // ... (keep fallbackUI, addParticles with shimmer for clear) ...

  // Save toast
  saveCurrentBtn.addEventListener('click', () => {
    // ... keep existing, add:
    showToast('Saved!');
  });

  function showToast(msg) {
    toast.innerText = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  }

  // Manage favorites toggle delete mode
  manageFavorites.addEventListener('click', () => {
    const isEdit = manageFavorites.textContent === 'Done';
    manageFavorites.textContent = isEdit ? 'Manage favorites' : 'Done';
    document.querySelectorAll('#favoritesList li .remove-fav').forEach(el => el.style.display = isEdit ? 'none' : 'inline');
  });

  // Add mini-temps/icons to renderFavorites/renderRecents
  async function renderFavorites() {
    const list = document.getElementById('favoritesList');
    list.innerHTML = '';
    for (const fav of favorites) {
      const li = document.createElement('li');
      const quickData = await fetchQuickTemp(fav.lat, fav.lon);
      const cond = quickData.condition;
      const icon = getIcon(cond);
      li.innerHTML = `${icon} ${fav.name} <span class="mini-temp">${quickData.temp}°</span> <span class="remove-fav" data-idx="${favorites.indexOf(fav)}">✕</span>`;
      // ... keep click handler ...
      list.appendChild(li);
    }
  }

  // Similar for renderRecents

  async function fetchQuickTemp(lat, lon) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m`;
    const res = await fetch(url);
    const data = await res.json();
    return { temp: Math.round(data.current.temperature_2m), condition: determineCondition(/* ... */) };
  }

  function getIcon(cond) {
    const icons = { clear: '☀️', cloud: '☁️', rain: '🌧️', storm: '⛈️', wind: '💨', cold: '❄️', heat: '🔥', fog: '🌫️' };
    return icons[cond] || '🌤️';
  }

  // Settings handlers
  document.getElementById('units').value = units;
  document.getElementById('theme').value = theme;
  document.getElementById('api').value = apiMode;

  document.getElementById('units').addEventListener('change', (e) => {
    units = e.target.value;
    localStorage.setItem('units', units);
    fetchWeather(currentLat, currentLon); // Refresh
  });

  document.getElementById('theme').addEventListener('change', (e) => {
    theme = e.target.value;
    localStorage.setItem('theme', theme);
    body.classList.toggle('light-theme', theme === 'light');
    body.classList.toggle('dark-theme', theme === 'dark');
  });

  document.getElementById('api').addEventListener('change', (e) => {
    apiMode = e.target.value;
    localStorage.setItem('api', apiMode);
    fetchWeather(currentLat, currentLon);
  });

  // ... (keep loadPlace, searchInput listener, showScreen — add settingsScreen to array) ...

  navSettings.addEventListener('click', () => showScreen(settingsScreen));

  // PWA service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
  }

  renderFavorites();
  renderRecents();
});