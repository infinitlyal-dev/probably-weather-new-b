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

  const humor = {
    cold: {
      dawn: 'Chilly start—coffee and blankets time!',
      day: 'Time to build a snowman',
      dusk: 'Freezing evening—rug up tight!',
      night: 'Polar bear weather—stay warm!'
    },
    heat: {
      dawn: 'Warm start—early braai?',
      day: 'Frying an egg is a real option',
      dusk: 'Hot evening—ice cream time!',
      night: 'Sizzling night—fan on full!'
    },
    storm: {
      dawn: 'Stormy dawn—stay in bed!',
      day: 'Thunder\'s rolling—don\'t get zapped!',
      dusk: 'Evening storm—lights out?',
      night: 'Night thunder—sweet dreams?'
    },
    rain: {
      dawn: 'Rainy morning—lazy day ahead',
      day: 'The clouds are crying like NZ at the \'23 World Cup!',
      dusk: 'Evening downpour—cozy inside!',
      night: 'Night rain—sleep to the pitter-patter'
    },
    wind: {
      dawn: 'Windy dawn—hairdo beware!',
      day: 'Gale force—your bakkie might fly!',
      dusk: 'Evening gusts—secure the bins!',
      night: 'Howling night—close the windows'
    },
    fog: {
      dawn: 'Foggy dawn—ghostly start',
      day: 'Misty mayhem—can\'t see your braai from the stoep!',
      dusk: 'Evening fog—early lights on',
      night: 'Foggy night—watch your step!'
    },
    clear: {
      dawn: 'Clear dawn—beautiful sunrise ahead',
      day: 'Braai weather!',
      dusk: 'Clear evening—starry night coming',
      night: 'Clear night—perfect for stargazing'
    }
  };

  const dummyHourly = new Array(24).fill(0).map((_, i) => ({ time: new Date(Date.now() + i*3600000).toISOString(), temp: 25 + Math.sin(i/4)*5, rain: Math.random()*20 }));
  const dummyDaily = new Array(7).fill(0).map((_, i) => ({ date: new Date(Date.now() + i*86400000).toISOString(), high: 30 + i*0.5, low: 20 + i*0.5, rainChance: 10 + i*5 }));

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

  async function reverseGeocode(lat, lon) {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
      const res = await fetch(url);
      const data = await res.json();
      return data.address.city || data.address.town || data.address.village || 'Your Location';
    } catch {
      return null;
    }
  }

  async function fetchWeather(lat, lon) {
    loader.classList.remove('hidden');
    try {
      let data;
      if (apiMode === 'multi') {
        data = await fetchMulti(lat, lon);
      } else {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,is_day&hourly=temperature_2m,precipitation_probability&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max&timezone=auto&forecast_days=7`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Fetch failed');
        data = await res.json();
        data.confidence_level = 'High';
      }

      const processed = {
        currentTemp: Math.round(data.current.temperature_2m),
        feelsLike: Math.round(data.current.apparent_temperature),
        lowTemp: Math.round(data.daily.temperature_2m_min[0]),
        highTemp: Math.round(data.daily.temperature_2m_max[0]),
        rainChance: data.daily.precipitation_probability_max[0] || 0,
        uv: data.daily.uv_index_max[0] || 0,
        windKph: data.current.wind_speed_10m * 3.6,
        isDay: data.current.is_day === 1,
        hourly: data.hourly.time.map((t, i) => ({
          time: t,
          temp: Math.round(data.hourly.temperature_2m[i]),
          rain: data.hourly.precipitation_probability[i] || 0
        })),
        daily: data.daily.time.map((t, i) => ({
          date: t,
          high: Math.round(data.daily.temperature_2m_max[i]),
          low: Math.round(data.daily.temperature_2m_min[i]),
          rainChance: data.daily.precipitation_probability_max[i] || 0
        })),
        condition: determineCondition(Math.round(data.current.apparent_temperature || data.current.temperature_2m), data.daily.precipitation_probability_max[0] || 0, Math.round((data.current.wind_speed_10m || 0) * 3.6)),
        timeOfDay: getTimeOfDay(data.current.is_day === 1, new Date().getHours()),
        confidence: data.confidence_level || 'Medium'
      };

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

    let omData, waData;
    try {
      const [omRes, waRes] = await Promise.all([
        fetch(omUrl),
        fetch(waUrl)
      ]);
      omData = await omRes.json();
      waData = await waRes.json();
    } catch {
      return { confidence_level: 'Low' }; // Fallback
    }

    function median(arr) {
      const sorted = arr.sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    }

    const temps = [omData.current.temperature_2m, waData.current.temp_c];
    const rainDay0 = [omData.daily.precipitation_probability_max[0], waData.forecast.forecastday[0].day.daily_chance_of_rain];
    const tempRange = Math.max(...temps) - Math.min(...temps);
    const rainRange = Math.max(...rainDay0) - Math.min(...rainDay0);

    const confidence = (tempRange <= 3 && rainRange <= 20) ? 'High' : (tempRange > 8 || rainRange > 50) ? 'Low' : 'Medium';

    // Aggregate other fields similarly...
    return { ...omData, confidence_level: confidence }; // Use OM as base
  }

  function determineCondition(temp, rainChance, windKph) {
    if (temp <= 12) return 'cold';
    if (temp >= 32) return 'heat';
    if (rainChance >= 60) return 'storm';
    if (rainChance >= 40) return 'rain';
    if (windKph >= 45) return 'wind';
    return 'clear';
  }

  // ... (keep getTimeOfDay) ...

  function updateUI(data) {
    const tod = data.timeOfDay || 'day';
    const cond = data.condition || 'clear';

    body.className = '';
    body.classList.add(`weather-${cond}`);
    heatOverlay.style.display = 'none';

    bgImg.src = `assets/images/bg/${cond}/${tod}.jpg`;

    let headlineText = `This is ${cond} weather.`;
    if (cond === 'wind') {
      headlineText = headlineText.split('').map((char, i) => 
        `<span class="wind-letter" style="animation-delay: ${i * 0.05}s">${char === ' ' ? '&nbsp;' : char}</span>`
      ).join('');
    }
    headline.innerHTML = headlineText;

    temp.innerText = `${data.lowTemp}–${data.highTemp}°`;

    description.innerText = humor[cond][tod] || humor[cond].day;

    extremeLabel.innerText = "Today's extreme:";
    extremeValue.innerText = data.highTemp >= 32 ? 'Scorching Heat' : data.lowTemp <= 10 ? 'Biting Cold' : cond.charAt(0).toUpperCase() + cond.slice(1);

    rainValue.innerText = data.rainChance < 20 ? 'Unlikely' : data.rainChance < 50 ? 'Possible' : 'Likely';
    uvValue.innerText = data.uv > 8 ? `High (${data.uv})` : data.uv > 5 ? `Moderate (${data.uv})` : `Low (${data.uv})`;

    confidenceEl.innerText = `PROBABLY • ${data.confidence.toUpperCase()} CONFIDENCE`;
    confidenceValue.innerHTML = `${data.confidence} Confidence<br><small>Probably ${data.confidence === 'High' ? 'spot-on' : data.confidence === 'Low' ? 'a bit iffy' : 'decent'}</small>`;

    if (cond === 'heat') {
      heatOverlay.style.backgroundImage = `url(${bgImg.src})`;
      heatOverlay.style.display = 'block';
      heatOverlay.style.opacity = '0.5';
    }

    addParticles(cond);
    saveCurrentBtn.classList.remove('hidden');
  }

  function renderHourly(hourly) {
    hourlyTimeline.innerHTML = '';
    (hourly || dummyHourly).forEach((h, i) => {
      const date = new Date(h.time);
      const dayLabel = i < 24 ? 'Today' : 'Tomorrow';
      const hour = date.getHours().toString().padStart(2, '0') + ':00';
      const rainClass = h.rain < 20 ? '' : h.rain < 50 ? 'medium' : 'high';
      const card = document.createElement('div');
      card.classList.add('hourly-card');
      card.innerHTML = `
        <div class="hour-time">${dayLabel} ${hour}</div>
        <div class="hour-temp">${h.temp}°</div>
        <div class="hour-rain ${rainClass}">${h.rain}% rain</div>
      `;
      hourlyTimeline.appendChild(card);
    });
  }

  function renderWeek(daily) {
    dailyCards.innerHTML = '';
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    (daily || dummyDaily).forEach((day, i) => {
      const date = new Date(day.date);
      const dayName = i === 0 ? 'Today' : days[date.getDay()];
      const dateStr = date.toLocaleDateString('en-ZA', { weekday: 'short', month: 'long', day: 'numeric' });
      const avgTemp = Math.round((day.high + day.low) / 2);
      const cond = determineCondition(avgTemp, day.rainChance, 20);
      const card = document.createElement('div');
      card.classList.add('daily-card');
      card.innerHTML = `
        <div class="day-name">${dayName}</div>
        <div class="day-date">${dateStr}</div>
        <div class="day-temp">${day.low}–${day.high}°</div>
        <div class="day-rain">${day.rainChance < 20 ? 'Unlikely' : day.rainChance < 50 ? 'Possible' : 'Likely'} rain</div>
        <div class="day-humor">${humor[cond].day || 'Solid day'}</div>
      `;
      dailyCards.appendChild(card);
    });
  }

  function fallbackUI() {
    locationEl.innerText = 'Strand, WC (fallback)';
    const data = {
      currentTemp: 24,
      highTemp: 28,
      lowTemp: 20,
      rainChance: 10,
      uv: 7,
      windKph: 15,
      condition: 'clear',
      timeOfDay: 'day',
      confidence: 'Low',
      hourly: dummyHourly,
      daily: dummyDaily
    };
    updateUI(data);
    description.innerText = 'Weather boffins on a quick braai break — here\'s a probable fallback!';
    renderHourly(dummyHourly);
    renderWeek(dummyDaily);
  }

  function addParticles(condition) {
    particles.innerHTML = '';
    if (!['cold', 'wind', 'rain', 'storm', 'heat', 'clear'].includes(condition)) return;

    const count = condition === 'wind' ? 25 : condition === 'heat' ? 20 : condition === 'storm' ? 30 : condition === 'clear' ? 15 : 15;

    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.classList.add('particle');
      p.style.top = Math.random() * 100 + '%';
      p.style.left = Math.random() * 100 + '%';
      p.style.animationDuration = (Math.random() * 5 + (condition === 'wind' ? 3 : condition === 'storm' ? 2 : 8)) + 's';
      p.style.animationDelay = Math.random() * 5 + 's';
      particles.appendChild(p);
    }
  }

  function renderFavorites() {
    const list = document.getElementById('favoritesList');
    list.innerHTML = '';
    if (favorites.length === 0) {
      list.innerHTML = '<li style="opacity: 0.6;">No favorites yet—add some!</li>';
    }
    favorites.forEach((fav, idx) => {
      const li = document.createElement('li');
      li.innerHTML = `${fav.name} <span class="mini-icon">${getIcon(fav.condition || 'clear')}</span> <span class="mini-temp">${fav.temp || '--'}°</span> <span class="remove-fav" data-idx="${idx}">✕</span>`;
      li.addEventListener('click', (e) => {
        if (e.target.classList.contains('remove-fav')) {
          favorites.splice(e.target.dataset.idx, 1);
          localStorage.setItem('probablyFavorites', JSON.stringify(favorites));
          renderFavorites();
        } else {
          loadPlace(fav);
        }
      });
      list.appendChild(li);
    });
  }

  function renderRecents() {
    const list = document.getElementById('recentList');
    list.innerHTML = '';
    if (recents.length === 0) {
      list.innerHTML = '<li style="opacity: 0.6;">No recent places—search some!</li>';
    }
    recents.forEach(recent => {
      const li = document.createElement('li');
      li.innerHTML = `${recent.name} <span class="mini-icon">${getIcon(recent.condition || 'clear')}</span> <span class="mini-temp">${recent.temp || '--'}°</span>`;
      li.addEventListener('click', () => loadPlace(recent));
      list.appendChild(li);
    });
  }

  // Fetch mini-temp for lists (called in render)
  async function updateListData(list) {
    for (let item of list) {
      const quick = await fetchQuickTemp(item.lat, item.lon);
      item.temp = quick.temp;
      item.condition = quick.condition;
    }
  }

  async function fetchQuickTemp(lat, lon) {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m`;
      const res = await fetch(url);
      const data = await res.json();
      return {
        temp: Math.round(data.current.temperature_2m),
        condition: determineCondition(data.current.apparent_temperature, data.current.precipitation_probability, data.current.wind_speed_10m * 3.6)
      };
    } catch {
      return { temp: '--', condition: 'clear' };
    }
  }

  function getIcon(cond) {
    const icons = { clear: '☀️', rain: '🌧️', storm: '⛈️', wind: '💨', cold: '❄️', heat: '🔥', fog: '🌫️' };
    return icons[cond] || '🌤️';
  }

  // ... (keep addToRecents, loadPlace) ...

  saveCurrentBtn.addEventListener('click', () => {
    const name = locationEl.innerText;
    const newFav = { name, lat: currentLat, lon: currentLon };
    if (!favorites.some(f => Math.abs(f.lat - newFav.lat) < 0.001 && Math.abs(f.lon - newFav.lon) < 0.001)) {
      favorites.push(newFav);
      if (favorites.length > 5) favorites.shift();
      localStorage.setItem('probablyFavorites', JSON.stringify(favorites));
      renderFavorites();
      toast.innerText = 'Saved!';
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2000);
    }
  });

  manageFavorites.addEventListener('click', () => {
    const list = document.getElementById('favoritesList');
    list.classList.toggle('edit-mode');
    manageFavorites.innerText = list.classList.contains('edit-mode') ? 'Done' : 'Manage favorites';
  });

  // ... (keep searchInput listener) ...

  const showScreen = (screen) => {
    [homeScreen, hourlyScreen, weekScreen, searchScreen, settingsScreen].forEach(s => s.classList.add('hidden'));
    screen.classList.remove('hidden');
    if (screen === searchScreen) {
      updateListData(favorites).then(renderFavorites);
      updateListData(recents).then(renderRecents);
    }
  };

  navHome.addEventListener('click', () => showScreen(homeScreen));
  navHourly.addEventListener('click', () => showScreen(hourlyScreen));
  navWeek.addEventListener('click', () => showScreen(weekScreen));
  navSearch.addEventListener('click', () => showScreen(searchScreen));
  navSettings.addEventListener('click', () => showScreen(settingsScreen));

  // Settings
  const unitsSelect = document.getElementById('units');
  unitsSelect.value = units;
  unitsSelect.addEventListener('change', (e) => {
    units = e.target.value;
    localStorage.setItem('units', units);
    fetchWeather(currentLat, currentLon);
  });

  const themeSelect = document.getElementById('theme');
  themeSelect.value = theme;
  themeSelect.addEventListener('change', (e) => {
    theme = e.target.value;
    localStorage.setItem('theme', theme);
    // Apply theme classes if needed
  });

  const apiSelect = document.getElementById('api');
  apiSelect.value = apiMode;
  apiSelect.addEventListener('change', (e) => {
    apiMode = e.target.value;
    localStorage.setItem('api', apiMode);
    fetchWeather(currentLat, currentLon);
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(() => console.log('SW registered')).catch(err => console.error('SW error', err));
  }

  renderFavorites();
  renderRecents();
});