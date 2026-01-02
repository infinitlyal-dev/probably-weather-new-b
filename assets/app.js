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
  const confidenceBar = document.getElementById('confidenceBar');
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
  let favorites = JSON.parse(localStorage.getItem('probablyFavorites') || '[]');
  let recents = JSON.parse(localStorage.getItem('probablyRecents') || '[]');

  const humor = {
    cold: ['Time to build a snowman', 'Polar bear weather—stay warm!', 'Freezing evening—rug up tight!', 'Chilly start—coffee and blankets time!'],
    heat: ['Frying an egg is a real option', 'Sizzling night—fan on full!', 'Hot evening—ice cream time!', 'Warm start—early braai?'],
    storm: ['Better stay indoors', 'Thunder\'s rolling—don\'t get zapped!', 'Evening storm—lights out?', 'Stormy dawn—stay in bed!'],
    rain: ['The clouds are crying like NZ at the \'23 World Cup!', 'Evening downpour—cozy inside!', 'Night rain—sleep to the pitter-patter', 'Rainy morning—lazy day ahead'],
    wind: ['Gale force—your bakkie might fly!', 'Evening gusts—secure the bins!', 'Howling night—close the windows', 'Windy dawn—hairdo beware!'],
    fog: ['Misty mayhem—can\'t see your braai from the stoep!', 'Evening fog—early lights on', 'Foggy night—watch your step!', 'Foggy dawn—ghostly start'],
    clear: ['Braai weather, boet!', 'Clear evening—starry night coming', 'Clear night—perfect for stargazing', 'Clear dawn—beautiful sunrise ahead']
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
      const omUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,is_day&hourly=temperature_2m,precipitation_probability&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max&timezone=auto&forecast_days=7`;
      const owmUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=a56be2054510bc8fed22998c68972876&units=metric`;
      const waUrl = `https://api.weatherapi.com/v1/forecast.json?key=a98886bfef6c4dcd8bf111514251512&q=${lat},${lon}&days=7`;

      const responses = await Promise.allSettled([
        fetch(omUrl).then(res => res.json()),
        fetch(owmUrl).then(res => res.json()),
        fetch(waUrl).then(res => res.json())
      ]);

      const dataList = responses.filter(r => r.status === 'fulfilled').map(r => r.value);

      const activeSources = dataList.length;
      if (activeSources === 0) throw new Error('No sources available');

      function median(arr) {
        const sorted = arr.filter(v => v !== undefined).sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
      }

      const temps = dataList.map(d => d.current?.temperature_2m || d.list?.[0].main.temp || d.current.temp_c);
      const highs = dataList.map(d => d.daily?.temperature_2m_max[0] || d.list?.[0].main.temp_max || d.forecast.forecastday[0].day.maxtemp_c);
      const lows = dataList.map(d => d.daily?.temperature_2m_min[0] || d.list?.[0].main.temp_min || d.forecast.forecastday[0].day.mintemp_c);
      const rainProbs = dataList.map(d => d.daily?.precipitation_probability_max[0] || d.list?.[0].pop * 100 || d.forecast.forecastday[0].day.daily_chance_of_rain);
      const uv = median(dataList.map(d => d.daily?.uv_index_max[0] || d.forecast.forecastday[0].day.uv));
      const windKph = median(dataList.map(d => d.current.wind_speed_10m * 3.6 || d.list?.[0].wind.speed * 3.6 || d.current.wind_kph));

      const tempRange = Math.max(...temps) - Math.min(...temps);
      const rainRange = Math.max(...rainProbs) - Math.min(...rainProbs);
      const confidence = activeSources >= 3 && tempRange <= 3 && rainRange <= 20 ? 'High' : activeSources >= 2 ? 'Medium' : 'Low';

      const processed = {
        lowTemp: Math.round(median(lows)),
        highTemp: Math.round(median(highs)),
        rainChance: Math.round(median(rainProbs)),
        uv: Math.round(uv),
        windKph: Math.round(windKph),
        condition: determineCondition(median(temps), median(rainProbs), windKph),
        timeOfDay: getTimeOfDay(dataList[0]?.current.is_day === 1, new Date().getHours()),
        confidence,
        activeSources,
        hourly: dataList[0]?.hourly?.time.map((t, i) => ({ time: t, temp: Math.round(median(dataList.map(d => d.hourly?.temperature_2m[i] || d.forecast.forecastday[Math.floor(i/24)].hour[i%24].temp_c))), rain: Math.round(median(dataList.map(d => d.hourly?.precipitation_probability[i] || d.forecast.forecastday[Math.floor(i/24)].hour[i%24].chance_of_rain))) })) || dummyHourly,
        daily: dataList[0]?.daily?.time.map((t, i) => ({ date: t, high: Math.round(median(dataList.map(d => d.daily?.temperature_2m_max[i] || d.forecast.forecastday[i].day.maxtemp_c))), low: Math.round(median(dataList.map(d => d.daily?.temperature_2m_min[i] || d.forecast.forecastday[i].day.mintemp_c))), rainChance: Math.round(median(dataList.map(d => d.daily?.precipitation_probability_max[i] || d.forecast.forecastday[i].day.daily_chance_of_rain))) })) || dummyDaily
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

  function determineCondition(temp, rainChance, windKph) {
    if (rainChance >= 60) return 'storm';
    if (rainChance >= 40) return 'rain';
    if (windKph >= 45) return 'wind';
    if (temp <= 12) return 'cold';
    if (temp >= 32) return 'heat';
    return 'clear';
  }

  function getTimeOfDay(isDay, hour) {
    if (hour < 6 || hour >= 20) return 'night';
    if (hour < 9) return 'dawn';
    if (hour < 17) return 'day';
    return 'dusk';
  }

  function updateUI(data) {
    const tod = data.timeOfDay || 'day';
    const cond = data.condition || 'clear';

    body.className = '';
    body.classList.add(`weather-${cond}`);
    heatOverlay.style.display = 'none';

    bgImg.src = `assets/images/bg/${cond}/${tod}.jpg`;

    headline.innerHTML = `This is ${cond}.`;
    temp.innerText = `${data.lowTemp}–${data.highTemp}°`;
    description.innerHTML = humor[cond][Math.floor(Math.random() * humor[cond].length)] + (cond === 'clear' || cond === 'heat' ? '<span class="braai-icon">🍖</span>' : '');
    extremeValue.innerText = `${cond.toUpperCase()} ${data.lowTemp}–${data.highTemp}°`;

    rainValue.innerText = data.rainChance < 20 ? 'Unlikely' : data.rainChance < 50 ? 'Possible' : 'Likely';
    rainValue.parentElement.classList.add(data.rainChance < 20 ? 'low' : data.rainChance < 50 ? 'medium' : 'high');

    uvValue.innerText = data.uv > 8 ? `High (${data.uv})` : data.uv > 5 ? `Moderate (${data.uv})` : `Low (${data.uv})`;
    uvValue.parentElement.classList.add(data.uv > 8 ? 'high' : data.uv > 5 ? 'medium' : 'low');

    confidenceEl.innerText = `PROBABLY • ${data.confidence.toUpperCase()} CONFIDENCE`;
    confidenceValue.innerHTML = `${data.confidence} <br><small>Based on ${data.activeSources} sources →</small>`;
    confidenceBar.style.width = `${(data.activeSources / 3) * 100}%`;

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
      const card = document.createElement('div');
      card.classList.add('hourly-card');
      card.innerHTML = `
        <div class="hour-time">${dayLabel} ${hour}</div>
        <div class="hour-temp">${h.temp}°</div>
        <div class="hour-rain">${h.rain}% rain</div>
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
      const dateStr = date.toLocaleDateString('en-ZA', { weekday: 'short', month: 'short', day: 'numeric' });
      const avgTemp = Math.round((day.high + day.low) / 2);
      const cond = determineCondition(avgTemp, day.rainChance, 20);
      const card = document.createElement('div');
      card.classList.add('daily-card');
      card.innerHTML = `
        <div class="day-name">${dayName}</div>
        <div class="day-date">${dateStr}</div>
        <div class="day-temp">${day.low}–${day.high}°</div>
        <div class="day-rain">${day.rainChance < 20 ? 'Unlikely' : day.rainChance < 50 ? 'Possible' : 'Likely'} rain</div>
        <div class="day-humor">${humor[cond][Math.floor(Math.random() * humor[cond].length)]}</div>
      `;
      dailyCards.appendChild(card);
    });
  }

  function fallbackUI() {
    locationEl.innerText = 'Strand, WC (fallback)';
    const data = {
      lowTemp: 20,
      highTemp: 25,
      rainChance: 10,
      uv: 7,
      windKph: 15,
      condition: 'clear',
      timeOfDay: 'day',
      confidence: 'Low',
      activeSources: 1,
      hourly: dummyHourly,
      daily: dummyDaily
    };
    updateUI(data);
    description.innerHTML = 'Weather boffins on a quick braai break — here\'s a probable fallback!';
    renderHourly(dummyHourly);
    renderWeek(dummyDaily);
  }

  function addParticles(condition) {
    particles.innerHTML = '';
    if (!['cold', 'wind', 'rain', 'storm', 'heat'].includes(condition)) return;

    const count = condition === 'wind' ? 25 : condition === 'heat' ? 20 : condition === 'storm' ? 30 : 15;

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
    favorites.forEach((fav, idx) => {
      const li = document.createElement('li');
      li.innerHTML = `${fav.name} <span class="remove-fav" data-idx="${idx}">✕</span>`;
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
    recents.forEach(recent => {
      const li = document.createElement('li');
      li.textContent = recent.name;
      li.addEventListener('click', () => loadPlace(recent));
      list.appendChild(li);
    });
  }

  function addToRecents(place) {
    recents = recents.filter(r => !(Math.abs(r.lat - place.lat) < 0.001 && Math.abs(r.lon - place.lon) < 0.001));
    recents.unshift(place);
    recents = recents.slice(0, 10);
    localStorage.setItem('probablyRecents', JSON.stringify(recents));
    renderRecents();
  }

  function loadPlace(place) {
    currentLat = parseFloat(place.lat);
    currentLon = parseFloat(place.lon);
    locationEl.innerText = place.name;
    fetchWeather(currentLat, currentLon);
    showScreen(homeScreen);
  }

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
    const isEdit = manageFavorites.textContent === 'Done';
    manageFavorites.textContent = isEdit ? 'Manage favorites' : 'Done';
    document.querySelectorAll('.remove-fav').forEach(el => el.style.display = isEdit ? 'none' : 'inline');
  });

  searchInput.addEventListener('keyup', async (e) => {
    if (e.key !== 'Enter') return;
    const query = searchInput.value.trim();
    if (!query) return;

    const existing = document.querySelector('.search-results-list');
    if (existing) existing.remove();

    const resultsList = document.createElement('ul');
    resultsList.className = 'search-results-list';
    searchInput.after(resultsList);
    resultsList.innerHTML = '<li>Loading...</li>';

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=8&addressdetails=1`);
      const places = await res.json();
      resultsList.innerHTML = '';
      if (places.length === 0) {
        resultsList.innerHTML = '<li>No places found</li>';
        return;
      }

      places.forEach(place => {
        const li = document.createElement('li');
        const placeName = place.display_name.split(',')[0].trim();
        li.innerHTML = `${placeName}<br><small>${place.display_name}</small>`;
        li.addEventListener('click', () => {
          locationEl.innerText = placeName;
          currentLat = place.lat;
          currentLon = place.lon;
          fetchWeather(currentLat, currentLon);
          addToRecents({ name: placeName, lat: place.lat, lon: place.lon });
          resultsList.remove();
          searchInput.value = '';
          showScreen(homeScreen);
        });
        resultsList.appendChild(li);
      });
    } catch {
      resultsList.innerHTML = '<li>Search failed</li>';
    }
  });

  const showScreen = (screen) => {
    [homeScreen, hourlyScreen, weekScreen, searchScreen, settingsScreen].forEach(s => s.classList.add('hidden'));
    screen.classList.remove('hidden');
  };

  navHome.addEventListener('click', () => showScreen(homeScreen));
  navHourly.addEventListener('click', () => showScreen(hourlyScreen));
  navWeek.addEventListener('click', () => showScreen(weekScreen));
  navSearch.addEventListener('click', () => showScreen(searchScreen));
  navSettings.addEventListener('click', () => showScreen(settingsScreen));

  // Settings
  document.getElementById('units').value = units;
  document.getElementById('units').addEventListener('change', (e) => {
    units = e.target.value;
    localStorage.setItem('units', units);
    fetchWeather(currentLat, currentLon);
  });

  document.getElementById('theme').value = theme;
  document.getElementById('theme').addEventListener('change', (e) => {
    theme = e.target.value;
    localStorage.setItem('theme', theme);
    // Apply theme
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js');
  }

  renderFavorites();
  renderRecents();
});