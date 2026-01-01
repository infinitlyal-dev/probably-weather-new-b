document.addEventListener('DOMContentLoaded', () => {
  // ... (previous code for home)

  const hourlyScreen = document.getElementById('hourly-screen');
  const hourlyTimeline = document.getElementById('hourlyTimeline');
  const navHourly = document.getElementById('navHourly');

  navHourly.addEventListener('click', () => {
    homeScreen.classList.add('hidden');
    hourlyScreen.classList.remove('hidden');
    loadHourly();
  });

  async function loadHourly() {
    hourlyTimeline.innerHTML = 'Loading hourly...';
    try {
      const res = await fetch(url); // Reuse from home fetch
      const data = await res.json();
      const hourly = data.hourly;
      hourlyTimeline.innerHTML = '';
      for (let i = 0; i < 24; i += 3) { // Every 3 hours
        const time = new Date(hourly.time[i]).getHours() + ':00';
        const temp = hourly.temperature_2m[i] + '°';
        const rain = hourly.precipitation_probability[i] + '% rain';
        const card = document.createElement('div');
        card.classList.add('hourly-card');
        card.innerHTML = `
          <div class="hour-time">${time}</div>
          <div class="hour-temp">${temp}</div>
          <div class="hour-rain">${rain}</div>
          <div class="hour-confidence">High</div> <!-- Dots later -->
        `;
        hourlyTimeline.appendChild(card);
      }
    } catch (e) {
      hourlyTimeline.innerHTML = 'Error loading hourly';
    }
  }
});