document.addEventListener('DOMContentLoaded', () => {
  const bgImg = document.getElementById('bgImg');
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
  const searchScreen = document.getElementById('search-screen');
  const hourlyTimeline = document.getElementById('hourlyTimeline');
  const searchInput = document.getElementById('searchInput');
  const favoritesList = document.getElementById('favoritesList');
  const recentList = document.getElementById('recentList');
  const navHome = document.getElementById('navHome');
  const navHourly = document.getElementById('navHourly');
  const navSearch = document.getElementById('navSearch');
  const navWeek = document.getElementById('navWeek'); // For future

  let currentLat = -34.104; // Default Strand
  let currentLon = 18.817;

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
      day: 'Braai weather, boet!',
      dusk: 'Clear evening—starry night coming',
      night: 'Clear night—perfect for stargazing'
    }
  };

  // Load cached data if available
  const cached = localStorage.getItem('lastWeatherData');
  if (cached) {
    const data = JSON.parse(cached);
    updateUI(data);
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
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,is_day&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max&hourly=temperature_2m,precipitation_probability&timezone=auto`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Network error');
      const data = await res.json();

      const processed = {
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
        condition: determineCondition(data.current.apparent_temperature || data.current.temperature_2m, data.daily.precipitation_probability_max[0], (data.current.wind_speed_10m || 0) * 3.6),
        timeOfDay: getTimeOfDay(data.current.is_day, new Date().getHours())
      };

      processed.confidence = processed.rainChance < 20 || processed.rainChance > 80 ? 'High' : processed.rainChance < 50 ? 'Medium' : 'Low';

      localStorage.setItem('lastWeatherData', JSON.stringify(processed));
      updateUI(processed);
      loadHourly(processed.hourly); // Pre-load hourly if needed
    } catch (e) {
      console.error('Fetch error:', e);
      fallbackUI();
    }
  }

  function determineCondition(temp, rainChance, windKph) {
    if (rainChance >= 60) return 'storm';
    if (rainChance >= 40) return 'rain';
    if (windKph >= 45) return 'wind';
    if (temp <= 12) return 'cold'; // Fog if cold + low wind, but simplify
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
    body.classList.remove(...body.classList);
    body.classList.add(`weather-${cond}`);
    bgImg.src = `assets/images/bg/${cond}/${tod}.jpg`;

    headline.innerText = `This is ${cond} weather.`;
    temp.innerText = `${data.lowTemp}–${data.highTemp}°`;
    description.innerText = humor[cond][tod] || humor[cond].day;

    extremeLabel.innerText = "Today's extreme:";
    extremeValue.innerText = data.highTemp >= 32 ? 'Heat' : data.lowTemp <= 10 ? 'Cold' : cond.charAt(0).toUpperCase() + cond.slice(1);
    rainValue.innerText = data.rainChance < 20 ? 'Unlikely' : data.rainChance < 50 ? 'Possible' : 'Likely';
    uvValue.innerText = data.uv > 8 ? `High (${data.uv})` : data.uv > 5 ? `Moderate (${data.uv})` : `Low (${data.uv})`;
    confidenceValue.innerHTML = `${data.confidence} Confidence<br>Probably accurate`;

    addParticles(cond);
  }

  function fallbackUI() {
    const cached = localStorage.getItem('lastWeatherData');
    if (cached) {
      updateUI(JSON.parse(cached));
      description.innerText = 'Weather boffins on a quick braai break — here\'s the last forecast!';
    } else {
      body.classList.add('weather-clear');
      bgImg.src = 'assets/images/bg/clear/day.jpg';
      headline.innerText = 'This is clear weather.';
      temp.innerText = '22–28°';
      description.innerText = 'Braai weather! (cached/offline mode)';
      confidenceValue.innerHTML = 'Medium<br>Using fallback';
    }
  }

  function addParticles(condition) {
    particles.innerHTML = '';
    if (!['cold', 'wind', 'rain', 'storm'].includes(condition)) return;
    for (let i = 0; i < 15; i++) {
      const p = document.createElement('div');
      p.classList.add('particle');
      p.style.left = Math.random() * 100 + '%';
      p.style.animationDuration = (Math.random() * 5 + 10) + 's';
      p.style.animationDelay = Math.random() * 5 + 's';
      particles.appendChild(p);
    }
  }

  // Hourly (now uses passed data or fetches if needed)
  async function loadHourly(hourlyData = null) {
    hourlyTimeline.innerHTML = '<p>Loading hourly...</p>';
    if (!hourlyData) {
      // Fetch if not passed
      // Similar fetch as main, but skip for now
    } else {
      hourlyTimeline.innerHTML = '';
      for (let i = 0; i < hourlyData.length; i += 3) {
        const hr = new Date(hourlyData[i].time).getHours().toString().padStart(2, '0') + ':00';
        const card = document.createElement('div');
        card.classList.add('hourly-card');
        card.innerHTML = `
          <div class="hour-time">${hr}</div>
          <div class="hour-temp">${hourlyData[i].temp}°</div>
          <div class="hour-rain">${hourlyData[i].rain}% rain</div>
        `;
        hourlyTimeline.appendChild(card);
      }
    }
  }

  navHourly.addEventListener('click', () => {
    homeScreen.classList.add('hidden');
    searchScreen.classList.add('hidden');
    hourlyScreen.classList.remove('hidden');
    loadHourly(); // Will use cached or refetch if needed
  });

  navHome.addEventListener('click', () => {
    hourlyScreen.classList.add('hidden');
    searchScreen.classList.add('hidden');
    homeScreen.classList.remove('hidden');
  });

  navSearch.addEventListener('click', () => {
    homeScreen.classList.add('hidden');
    hourlyScreen.classList.add('hidden');
    searchScreen.classList.remove('hidden');
    // Load favorites/recent here later
  });

  // Week nav placeholder
  navWeek.addEventListener('click', () => {
    alert('Week screen coming soon!');
  });
});