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

  const dummyHourly = new Array(8).fill(0).map((_, i) => ({ time: new Date(Date.now() + i*3*3600000).toISOString(), temp: 25 + i, rain: 10 }));
  const dummyDaily = new Array(7).fill(0).map((_, i) => ({ date: new Date(Date.now() + i*86400000).toISOString(), high: 30 + i, low: 20 + i, rainChance: 10 + i*5 }));

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
      return 'Your Location';
    }
  }

  async function fetchWeather(lat, lon) {
    const url = `https://api.weatherapi.com/v1/forecast.json?key=${WEATHERAPI_KEY}&q=${lat},${lon}&days=7&aqi=no&alerts=no`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('WeatherAPI failed');
      const data = await res.json();

      const processed = {
        currentTemp: Math.round(data.current.temp_c),
        feelsLike: Math.round(data.current.feelslike_c),
        lowTemp: Math.round(data.forecast.forecastday[0].day.mintemp_c),
        highTemp: Math.round(data.forecast.forecastday[0].day.maxtemp_c),
        rainChance: data.forecast.forecastday[0].day.daily_chance_of_rain,
        uv: data.forecast.forecastday[0].day.uv,
        windKph: data.current.wind_kph,
        isDay: data.current.is_day === 1,
        hourly: data.forecast.forecastday[0].hour.map(h => ({
          time: h.time,
          temp: Math.round(h.temp_c),
          rain: h.chance_of_rain,
        })),
        daily: data.forecast.forecastday.map(d => ({
          date: d.date,
          high: Math.round(d.day.maxtemp_c),
          low: Math.round(d.day.mintemp_c),
          rainChance: d.day.daily_chance_of_rain,
        })),
        condition: determineCondition(Math.round(data.current.feelslike_c), data.forecast.forecastday[0].day.daily_chance_of_rain, data.current.wind_kph),
        timeOfDay: getTimeOfDay(data.current.is_day === 1, new Date().getHours()),
        confidence: 'High'
      };

      localStorage.setItem('lastWeatherData', JSON.stringify(processed));
      updateUI(processed);
      renderHourly(processed.hourly);
      renderWeek(processed.daily);
    } catch (e) {
      console.error('Fetch error:', e);
      fallbackUI();
    }
  }

  // ... the rest of the functions (determineCondition, getTimeOfDay, updateUI, renderHourly, renderWeek, fallbackUI, addParticles, showScreen) same as my last message ...

});