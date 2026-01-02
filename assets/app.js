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

  const dummyHourly = new Array(8).fill(0).map((_, i) => ({ time: new Date(Date.now() + i*3*3600000).toISOString(), temp: 25 + i, rain: 10 }));
  const dummyDaily = new Array(7).fill(0).map((_, i) => ({ date: new Date(Date.now() + i*86400000).toISOString(), high: 30 + i, low: 20 + i, rainChance: 10 + i*5 }));

  const cached = localStorage.getItem('lastWeatherData');
  if (cached) {
    currentData = JSON.parse(cached);
    updateUI(currentData);
    renderHourly(currentData.hourly || dummyHourly);
    renderWeek(currentData.daily || dummyDaily);
  } else {
    fallbackUI();
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
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout to force fallback if slow
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error('Fetch failed');
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
    const tod = data.timeOfDay;
    const cond = data.condition;

    body.className = `weather-${cond}`;
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
    confidenceValue.innerHTML = `${data.confidence} Confidence<br>Probably accurate`;

    if (cond === 'heat') {
      heatOverlay.style.backgroundImage = `url(${bgImg.src})`;
      heatOverlay.style.display = 'block';
      heatOverlay.style.opacity = '0.5';
    }

    addParticles(cond);
  }

  function renderHourly(hourly) {
    hourlyTimeline.innerHTML = '';
    (hourly.length ? hourly : dummyHourly).forEach((h, i) => {
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
    (daily.length ? daily : dummyDaily).forEach((day, i) => {
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
      hourly: dummyHourly,
      daily: dummyDaily
    };
    updateUI(currentData);
    description.innerText = 'Quick braai break — probable fallback forecast!';
    renderHourly(dummyHourly);
    renderWeek(dummyDaily);
  }

  const showScreen = (screen) => {
    [homeScreen, hourlyScreen, weekScreen, searchScreen].forEach(s => s.classList.add('hidden'));
    screen.classList.remove('hidden');
  };

  navHome.addEventListener('click', () => showScreen(homeScreen));
  navHourly.addEventListener('click', () => showScreen(hourlyScreen));
  navWeek.addEventListener('click', () => showScreen(weekScreen));
  navSearch.addEventListener('click', () => showScreen(searchScreen));
});