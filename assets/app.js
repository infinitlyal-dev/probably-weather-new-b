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

  const cached = localStorage.getItem('lastWeatherData');
  if (cached) {
    const data = JSON.parse(cached);
    updateUI(data);
  }

  navigator.geolocation.getCurrentPosition(async (pos) => {
    currentLat = pos.coords.latitude;
    currentLon = pos.coords.longitude;
    locationEl.innerText = 'Fetching location...';
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
      return data.address.city || data.address.town || 'Your Location';
    } catch {
      return 'Your Location';
    }
  }

  async function fetchWeather(lat, lon) {
    const url = `/api/weather?latitude=${lat}&longitude=${lon}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Proxy failed');
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
          temp: data.hourly.temperature_2m[i],
          rainProb: data.hourly.precipitation_probability[i],
        })),
        daily: data.daily.time.map((t, i) => ({
          date: t,
          high: data.daily.temperature_2m_max[i],
          low: data.daily.temperature_2m_min[i],
          rainChance: data.daily.precipitation_probability_max[i],
        })),
      };

      processed.confidence = processed.rainChance < 30 || processed.rainChance > 70 ? 'High' : 'Medium';

      processed.condition = determineCondition(processed.feelsLike, processed.rainChance, processed.windKph);
      processed.timeOfDay = getTimeOfDay(processed.isDay, new Date().getHours());

      localStorage.setItem('lastWeatherData', JSON.stringify(processed));
      updateUI(processed);
      renderHourly(processed.hourly);
      renderWeek(processed.daily);
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
    confidenceValue.innerHTML = `${data.confidence} Confidence<br>Probably accurate`;

    if (cond === 'heat') {
      heatOverlay.style.backgroundImage = `url(${bgImg.src})`;
      heatOverlay.style.backgroundPosition = 'center';
      heatOverlay.style.backgroundSize = 'cover';
      heatOverlay.style.display = 'block';
      heatOverlay.style.opacity = '0.5';
    }

    addParticles(cond);
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
      isDay: true,
      hourly: dummyHourly,
      daily: dummyDaily,
      condition: 'clear',
      timeOfDay: 'day',
      confidence: 'Medium'
    };
    updateUI(data);
    description.innerText = 'Weather boffins on a quick braai break — here's the last known forecast';
    renderHourly(data.hourly);
    renderWeek(data.daily);
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

  const showScreen = (screen) => {
    homeScreen.classList.add('hidden');
    hourlyScreen.classList.add('hidden');
    weekScreen.classList.add('hidden');
    searchScreen.classList.add('hidden');
    screen.classList.remove('hidden');
  };

  navHome.addEventListener('click', () => showScreen(homeScreen));
  navHourly.addEventListener('click', () => showScreen(hourlyScreen));
  navWeek.addEventListener('click', () => showScreen(weekScreen));
  navSearch.addEventListener('click', () => showScreen(searchScreen));
});