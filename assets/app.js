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
  const locationEl = document.getElementById('location');
  const particles = document.getElementById('particles');
  const homeScreen = document.getElementById('home-screen');
  const hourlyScreen = document.getElementById('hourly-screen');
  const weekScreen = document.getElementById('week-screen');
  const dailyCards = document.getElementById('dailyCards');
  const searchScreen = document.getElementById('search-screen');
  const hourlyTimeline = document.getElementById('hourlyTimeline');
  const navHome = document.getElementById('navHome');
  const navHourly = document.getElementById('navHourly');
  const navWeek = document.getElementById('navWeek');
  const navSearch = document.getElementById('navSearch');

  let currentLat = -34.104;
  let currentLon = 18.817;
  let currentData = null;

  const humor = {
    cold: { dawn: 'Chilly start—coffee and blankets time!', day: 'Time to build a snowman', dusk: 'Freezing evening—rug up tight!', night: 'Polar bear weather—stay warm!' },
    heat: { dawn: 'Warm start—early braai?', day: 'Frying an egg is a real option', dusk: 'Hot evening—ice cream time!', night: 'Sizzling night—fan on full!' },
    storm: { dawn: 'Stormy dawn—stay in bed!', day: 'Thunder\'s rolling—don\'t get zapped!', dusk: 'Evening storm—lights out?', night: 'Night thunder—sweet dreams?' },
    rain: { dawn: 'Rainy morning—lazy day ahead', day: 'The clouds are crying like NZ at the \'23 World Cup!', dusk: 'Evening downpour—cozy inside!', night: 'Night rain—sleep to the pitter-patter' },
    wind: { dawn: 'Windy dawn—hairdo beware!', day: 'Gale force—your bakkie might fly!', dusk: 'Evening gusts—secure the bins!', night: 'Howling night—close the windows' },
    fog: { dawn: 'Foggy dawn—ghostly start', day: 'Misty mayhem—can\'t see your braai from the stoep!', dusk: 'Evening fog—early lights on', night: 'Foggy night—watch your step!' },
    clear: { dawn: 'Clear dawn—beautiful sunrise ahead', day: 'Braai weather!', dusk: 'Clear evening—starry night coming', night: 'Clear night—perfect for stargazing' }
  };

  const dummyDaily = [
    { date: new Date().toISOString(), high: 28, low: 20, rainChance: 10 },
    { date: new Date(Date.now() + 86400000).toISOString(), high: 29, low: 21, rainChance: 5 },
    { date: new Date(Date.now() + 172800000).toISOString(), high: 27, low: 19, rainChance: 20 },
    { date: new Date(Date.now() + 259200000).toISOString(), high: 30, low: 22, rainChance: 0 },
    { date: new Date(Date.now() + 345600000).toISOString(), high: 26, low: 18, rainChance: 30 },
    { date: new Date(Date.now() + 432000000).toISOString(), high: 28, low: 20, rainChance: 15 },
    { date: new Date(Date.now() + 518400000).toISOString(), high: 31, low: 23, rainChance: 5 }
  ];

  const cached = localStorage.getItem('lastWeatherData');
  if (cached) {
    currentData = JSON.parse(cached);
    updateUI(currentData);
    renderHourly(currentData.hourly || []);
    renderWeek(currentData.daily || dummyDaily);
  }

  navigator.geolocation.getCurrentPosition(async (pos) => {
    currentLat = pos.coords.latitude;
    currentLon = pos.coords.longitude;
    locationEl.innerText = 'Your Location';
    await fetchWeather(currentLat, currentLon);
  }, async () => {
    locationEl.innerText = 'Strand, WC';
    await fetchWeather(currentLat, currentLon);
  });

  async function fetchWeather(lat, lon) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,is_day&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max&hourly=temperature_2m,precipitation_probability&timezone=auto&forecast_days=7`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error('Network error');
      const data = await res.json();

      currentData = {
        currentTemp: Math.round(data.current.apparent_temperature || data.current.temperature_2m),
        highTemp: Math.round(data.daily.temperature_2m_max[0]),
        lowTemp: Math.round(data.daily.temperature_2m_min[0]),
        rainChance: data.daily.precipitation_probability_max[0] || 0,
        uv: data.daily.uv_index_max[0] || 0,
        windKph: Math.round((data.current.wind_speed_10m || 0) * 3.6),
        isDay: data.current.is_day === 1,
        hourly: data.hourly.time.slice(0, 24).map((t, i) => ({
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
        confidence: 'High'
      };

      localStorage.setItem('lastWeatherData', JSON.stringify(currentData));
      updateUI(currentData);
      renderHourly(currentData.hourly);
      renderWeek(currentData.daily);
    } catch (e) {
      console.error('Fetch failed, using fallback', e);
      fallbackUI();
    }
  }

  // ... determineCondition, getTimeOfDay, updateUI, addParticles same as last ...

  function renderHourly(hourly) {
    hourlyTimeline.innerHTML = '<p>No hourly data — using fallback</p>';
    if (hourly.length > 0) {
      hourlyTimeline.innerHTML = '';
      hourly.forEach((h, i) => {
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
  }

  function renderWeek(daily) {
    dailyCards.innerHTML = '';
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
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
    currentData = {
      currentTemp: 24,
      highTemp: 28,
      lowTemp: 20,
      rainChance: 10,
      uv: 7,
      windKph: 15,
      condition: 'clear',
      timeOfDay: 'day',
      confidence: 'Medium',
      hourly: [],
      daily: dummyDaily
    };
    updateUI(currentData);
    description.innerText = 'Weather boffins on a braai break — here\'s a probable fallback!';
    renderHourly([]);
    renderWeek(dummyDaily);
  }

  // Nav same as last
  const showScreen = (screen) => {
    [homeScreen, hourlyScreen, weekScreen, searchScreen].forEach(s => s.classList.add('hidden'));
    screen.classList.remove('hidden');
  };

  navHome.addEventListener('click', () => showScreen(homeScreen));
  navHourly.addEventListener('click', () => showScreen(hourlyScreen));
  navWeek.addEventListener('click', () => showScreen(weekScreen));
  navSearch.addEventListener('click', () => showScreen(searchScreen));
});