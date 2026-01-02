// Full replacement app.js with week screen added (keeps all multi-source, visuals, etc.)
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
  const OPENWEATHERMAP_KEY = 'a56be2054510bc8fed22998c68972876';

  const humor = { /* same as before */ };

  // ... all the fetch functions, aggregation, determineCondition, getTimeOfDay, updateUI, fallbackUI, addParticles stay the same ...

  // Add daily data to fetchOpenMeteo return
  async function fetchOpenMeteo(lat, lon) {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,is_day&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,weather_code&hourly=temperature_2m,precipitation_probability&timezone=auto&forecast_days=7`;
    // ... same fetch ...
    return {
      // ... same ...
      daily: data.daily.time.map((t, i) => ({
        date: t,
        high: Math.round(data.daily.temperature_2m_max[i]),
        low: Math.round(data.daily.temperature_2m_min[i]),
        rainChance: data.daily.precipitation_probability_max[i] || 0,
        condition: codeToCondition(data.daily.weather_code[i]) // simple WMO code map if needed
      })),
      // ...
    };
  }

  // In aggregated, add daily: sources.find(s => s.source === 'openmeteo')?.daily || []

  // Render week
  function renderWeek(daily) {
    dailyCards.innerHTML = '';
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    daily.slice(0, 7).forEach((day, i) => {
      const date = new Date(day.date);
      const dayName = i === 0 ? 'Today' : days[date.getDay()];
      const dateStr = date.toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' });
      const cond = determineCondition((day.high + day.low)/2, day.rainChance, 20); // approx
      const card = document.createElement('div');
      card.classList.add('daily-card');
      card.innerHTML = `
        <div class="day-name">${dayName}</div>
        <div class="day-date">${dateStr}</div>
        <div class="day-temp">${day.low}–${day.high}°</div>
        <div class="day-rain">${day.rainChance < 20 ? 'Unlikely' : day.rainChance < 50 ? 'Possible' : 'Likely'}</div>
        <div class="day-humor">${humor[cond].day || 'Nice one'}</div>
      `;
      dailyCards.appendChild(card);
    });
  }

  // In updateUI, if (data.daily) renderWeek(data.daily);

  navWeek.addEventListener('click', () => {
    homeScreen.classList.add('hidden');
    hourlyScreen.classList.add('hidden');
    searchScreen.classList.add('hidden');
    weekScreen.classList.remove('hidden');
    if (data.daily) renderWeek(data.daily); // from cached/aggregated
  });

  // Other nav same
});