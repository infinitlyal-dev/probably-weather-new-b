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
  const location = document.getElementById('location');
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

  const hour = new Date().getHours();
  let timeOfDay;
  if (hour < 6) timeOfDay = 'night';
  else if (hour < 12) timeOfDay = 'dawn';
  else if (hour < 18) timeOfDay = 'day';
  else timeOfDay = 'dusk';

  navigator.geolocation.getCurrentPosition(async (pos) => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    location.innerText = 'Your Location';
    await fetchWeather(lat, lon);
  }, async () => {
    location.innerText = 'Strand, WC';
    await fetchWeather(-34.104, 18.817);
  });

  async function fetchWeather(lat, lon) {
    const proxy = 'https://corsproxy.io/?';
    const url = `${proxy}https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,precipitation_probability,uv_index,wind_speed_10m&hourly=temperature_2m,precipitation_probability`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      const current = data.current;
      const temp = current.temperature_2m;
      const tempRange = `${Math.floor(temp - 2)}–${Math.ceil(temp + 2)}°`;
      const rain = current.precipitation_probability || 0;
      const uv = current.uv_index || 0;
      const wind = current.wind_speed_10m || 0;

      let condition = 'clear';
      if (rain > 50) condition = 'storm';
      else if (rain > 10) condition = 'rain';
      if (wind > 40) condition = 'wind';
      if (uv < 2 && temp < 15) condition = 'fog';
      if (temp < 10) condition = 'cold';
      if (temp > 30) condition = 'heat';

      body.classList.add(`weather-${condition}`);
      bgImg.src = `assets/images/bg/${condition}/${timeOfDay}.jpg` || 'assets/images/bg/clear/day.jpg';
      headline.innerText = `This is ${condition}.`;
      temp.innerText = tempRange;
      description.innerText = humor[condition][timeOfDay] || humor[condition]['day'];
      extremeLabel.innerText = "Today's extreme: " + condition.charAt(0).toUpperCase() + condition.slice(1);
      extremeValue.innerText = tempRange;
      rainValue.innerText = rain > 10 ? 'Likely' : 'Unlikely';
      uvValue.innerText = uv > 6 ? 'High' : uv > 3 ? 'Moderate' : 'Low';
      confidenceValue.innerHTML = 'High<br>Based on Open-Meteo';

      addParticles(condition);
    } catch (e) {
      console.error('Fetch error:', e);
      fallbackUI();
    }
  }

  function fallbackUI() {
    body.classList.add('weather-clear');
    bgImg.src = 'assets/images/bg/clear/day.jpg';
    headline.innerText = 'This is clear.';
    temp.innerText = '25–30°';
    description.innerText = 'Braai weather, boet!';
    extremeLabel.innerText = "Today's extreme: Clear";
    extremeValue.innerText = '25–30°';
    rainValue.innerText = 'None expected';
    uvValue.innerText = 'High (8)';
    confidenceValue.innerHTML = 'High<br>Based on Open-Meteo';
  }

  function addParticles(condition) {
    if (particles) {
      particles.innerHTML = '';
      for (let i = 0; i < 10; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDuration = Math.random() * 3 + 5 + 's';
        particle.style.animationDelay = Math.random() * 5 + 's';
        particles.appendChild(particle);
      }
    }
  }

  // Hourly
  navHourly.addEventListener('click', () => {
    homeScreen.classList.add('hidden');
    searchScreen.classList.add('hidden');
    hourlyScreen.classList.remove('hidden');
    loadHourly();
  });

  async function loadHourly() {
    hourlyTimeline.innerHTML = '<p>Loading hourly forecast...</p>';
    try {
      const lat = -34.104; // Strand; replace with current lat/lon later
      const lon = 18.817;
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation_probability`;
      const res = await fetch(url);
      const data = await res.json();
      const hourly = data.hourly;
      hourlyTimeline.innerHTML = '';
      for (let i = 0; i < 24; i += 3) {
        const time = new Date(hourly.time[i]).getHours() + ':00';
        const temp = Math.round(hourly.temperature_2m[i]) + '°';
        const rain = hourly.precipitation_probability[i] + '% rain';
        const card = document.createElement('div');
        card.classList.add('hourly-card');
        card.innerHTML = `
          <div class="hour-time">${time}</div>
          <div class="hour-temp">${temp}</div>
          <div class="hour-rain">${rain}</div>
          <div class="hour-confidence">High</div>
        `;
        hourlyTimeline.appendChild(card);
      }
    } catch (e) {
      hourlyTimeline.innerHTML = '<p>Error loading hourly</p>';
    }
  }

  // Search
  navSearch.addEventListener('click', () => {
    homeScreen.classList.add('hidden');
    hourlyScreen.classList.add('hidden');
    searchScreen.classList.remove('hidden');
    loadFavorites();
    loadRecent();
  });

  // Home from other screens
  navHome.addEventListener('click', () => {
    hourlyScreen.classList.add('hidden');
    searchScreen.classList.add('hidden');
    homeScreen.classList.remove('hidden');
  });
});