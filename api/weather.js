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
    const dailyCards = document.getElementById('dailyCards');
    const searchScreen = document.getElementById('search-screen');
    const hourlyTimeline = document.getElementById('hourlyTimeline');
    const searchInput = document.getElementById('searchInput');
    const saveCurrentBtn = document.getElementById('saveCurrent');
    const navHome = document.getElementById('navHome');
    const navHourly = document.getElementById('navHourly');
    const navWeek = document.getElementById('navWeek');
    const navSearch = document.getElementById('navSearch');
  
    let currentLat = -34.104;
    let currentLon = 18.817;
  
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
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,is_day&hourly=temperature_2m,precipitation_probability&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max&timezone=auto&forecast_days=7`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // Shorter timeout to force fallback faster
  
      try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error('Fetch failed');
        const data = await res.json();
  
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
          confidence: 'High' // Since single reliable source
        };
  
        localStorage.setItem('lastWeatherData', JSON.stringify(processed));
        updateUI(processed);
        renderHourly(processed.hourly);
        renderWeek(processed.daily);
      } catch (e) {
        clearTimeout(timeoutId);
        console.error('Fetch error:', e);
        fallbackUI();
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
      extremeValue.innerText = data.highTemp >= 32 ? 'Heat' : data.lowTemp <= 10 ? 'Cold' : cond.charAt(0).toUpperCase() + cond.slice(1);
  
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
        if (i % 3 !== 0) return;
        const hour = new Date(h.time).getHours().toString().padStart(2, '0') + ':00';
        const card = document.createElement('div');
        card.classList.add('hourly-card');
        card.innerHTML = `
          <div class="hour-time">${hour}</div>
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
      description.innerText = 'Weather boffins on a quick braai break — here's a probable fallback!';
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
  
    /* Favorites & Recents */
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
      addToRecents(place);
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
      }
    });
  
    /* Search */
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
            const newPlace = { name: placeName, lat: place.lat, lon: place.lon };
            loadPlace(newPlace);
            resultsList.remove();
            searchInput.value = '';
          });
          resultsList.appendChild(li);
        });
      } catch {
        resultsList.innerHTML = '<li>Search failed</li>';
      }
    });
  
    const showScreen = (screen) => {
      [homeScreen, hourlyScreen, weekScreen, searchScreen].forEach(s => s.classList.add('hidden'));
      screen.classList.remove('hidden');
      if (screen === searchScreen) {
        renderFavorites();
        renderRecents();
      }
    };
  
    navHome.addEventListener('click', () => showScreen(homeScreen));
    navHourly.addEventListener('click', () => showScreen(hourlyScreen));
    navWeek.addEventListener('click', () => showScreen(weekScreen));
    navSearch.addEventListener('click', () => showScreen(searchScreen));
  
    renderFavorites();
    renderRecents();
  });