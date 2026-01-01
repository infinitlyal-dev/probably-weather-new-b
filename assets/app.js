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
  const searchScreen = document.getElementById('search-screen');
  const hourlyTimeline = document.getElementById('hourlyTimeline');
  const navHome = document.getElementById('navHome');
  const navHourly = document.getElementById('navHourly');
  const navSearch = document.getElementById('navSearch');
  const navWeek = document.getElementById('navWeek');

  let currentLat = -34.104;
  let currentLon = 18.817;

  const WEATHERAPI_KEY = 'a98886bfef6c4dcd8bf111514251512';

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
    locationEl.innerText = 'Your Location';
    await fetchWeather(currentLat, currentLon);
  }, async () => {
    locationEl.innerText = 'Strand, WC';
    await fetchWeather(currentLat, currentLon);
  });

  async function fetchWeather(lat, lon) {
    const openMeteoPromise = fetchOpenMeteo(lat, lon);
    const weatherApiPromise = fetchWeatherAPI(lat, lon);

    const results = await Promise.allSettled([openMeteoPromise, weatherApiPromise]);

    const sources = [];
    if (results[0].status === 'fulfilled') sources.push(results[0].value);
    if (results[1].status === 'fulfilled') sources.push(results[1].value);

    if (sources.length === 0) {
      console.error('All sources failed');
      fallbackUI();
      return;
    }

    // Aggregate
    const currentTemps = sources.map(s => s.currentTemp).filter(Boolean);
    const highTemps = sources.map(s => s.highTemp).filter(Boolean);
    const lowTemps = sources.map(s => s.lowTemp).filter(Boolean);
    const rainChances = sources.map(s => s.rainChance).filter(Boolean);
    const uvValues = sources.map(s => s.uv).filter(Boolean);
    const windKphs = sources.map(s => s.windKph).filter(Boolean);

    const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
    const median = arr => {
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };

    const aggregated = {
      currentTemp: Math.round(avg(currentTemps.length ? currentTemps : [20])),
      highTemp: Math.round(avg(highTemps.length ? highTemps : [25])),
      lowTemp: Math.round(avg(lowTemps.length ? lowTemps : [18])),
      rainChance: Math.round(avg(rainChances.length ? rainChances : [10])),
      uv: Math.round(avg(uvValues.length ? uvValues : [5]) * 10) / 10,
      windKph: Math.round(avg(windKphs.length ? windKphs : [10])),
      hourly: sources.find(s => s.hourly)?.hourly || [],
      condition: 'clear',
      timeOfDay: 'day',
      sourcesUsed: sources.length
    };

    // Use Open-Meteo hourly if available
    if (sources.find(s => s.source === 'openmeteo')) {
      aggregated.hourly = sources.find(s => s.source === 'openmeteo').hourly;
    }

    // Condition from aggregated values
    aggregated.condition = determineCondition(aggregated.currentTemp, aggregated.rainChance, aggregated.windKph);

    // Confidence based on agreement
    const tempSpread = Math.max(...currentTemps) - Math.min(...currentTemps);
    const rainSpread = Math.max(...rainChances) - Math.min(...rainChances);
    if (sources.length >= 2 && tempSpread <= 4 && rainSpread <= 30) {
      aggregated.confidence = 'High';
    } else if (sources.length >= 2) {
      aggregated.confidence = 'Medium';
    } else {
      aggregated.confidence = 'Low';
    }

    // Time of day (prefer Open-Meteo if available)
    const omSource = sources.find(s => s.source === 'openmeteo');
    aggregated.timeOfDay = omSource ? omSource.timeOfDay : getTimeOfDay(true, new Date().getHours());

    localStorage.setItem('lastWeatherData', JSON.stringify(aggregated));
    updateUI(aggregated);
  }

  async function fetchOpenMeteo(lat, lon) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,is_day&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max&hourly=temperature_2m,precipitation_probability&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Open-Meteo failed');
    const data = await res.json();

    return {
      source: 'openmeteo',
      currentTemp: data.current.apparent_temperature || data.current.temperature_2m,
      highTemp: data.daily.temperature_2m_max[0],
      lowTemp: data.daily.temperature_2m_min[0],
      rainChance: data.daily.precipitation_probability_max[0] || 0,
      uv: data.daily.uv_index_max[0] || 0,
      windKph: (data.current.wind_speed_10m || 0) * 3.6,
      hourly: data.hourly.time.slice(0, 24).map((t, i) => ({
        time: t,
        temp: Math.round(data.hourly.temperature_2m[i]),
        rain: data.hourly.precipitation_probability[i] || 0
      })),
      timeOfDay: getTimeOfDay(data.current.is_day === 1, new Date().getHours())
    };
  }

  async function fetchWeatherAPI(lat, lon) {
    const url = `https://api.weatherapi.com/v1/forecast.json?key=${WEATHERAPI_KEY}&q=${lat},${lon}&days=1&aqi=no&alerts=no`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('WeatherAPI failed');
    const data = await res.json();

    const current = data.current;
    const day = data.forecast.forecastday[0].day;

    return {
      source: 'weatherapi',
      currentTemp: current.temp_c,
      highTemp: day.maxtemp_c,
      lowTemp: day.mintemp_c,
      rainChance: day.daily_chance_of_rain,
      uv: day.uv,
      windKph: current.wind_kph,
      timeOfDay: current.is_day ? getTimeOfDay(true, new Date().getHours()) : 'night'
    };
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
    confidenceValue.innerHTML = `${data.confidence} Confidence<br>Based on ${data.sourcesUsed} source${data.sourcesUsed > 1 ? 's' : ''}`;

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
    const cached = localStorage.getItem('lastWeatherData');
    if (cached) {
      updateUI(JSON.parse(cached));
      description.innerText = 'Weather boffins on a quick braai break — here\'s the last forecast!';
    } else {
      body.className = 'weather-clear';
      bgImg.src = 'assets/images/bg/clear/day.jpg';
      headline.innerHTML = 'This is clear weather.';
      temp.innerText = '22–28°';
      description.innerText = 'Braai weather! (offline mode)';
      confidenceValue.innerHTML = 'Medium<br>Using fallback';
    }
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

  navHourly.addEventListener('click', () => {
    homeScreen.classList.add('hidden');
    searchScreen.classList.add('hidden');
    hourlyScreen.classList.remove('hidden');
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
  });

  navWeek.addEventListener('click', () => {
    alert('Week screen coming soon!');
  });
});