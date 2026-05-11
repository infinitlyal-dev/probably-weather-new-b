export const WEATHER_BACKGROUND_ALIASES = {
  'rain-possible': 'cloudy',
  'partly-cloudy': 'cloudy',
  uv: 'clear',
  hail: 'storm',
  thunder: 'storm',
};

export function getWeatherBackgroundFolder(condition) {
  return WEATHER_BACKGROUND_ALIASES[condition] || condition || 'clear';
}

export function getWeatherBackgroundFallbackFolder(condition) {
  return condition === 'cold' ? 'cloudy' : 'clear';
}

export function getOgBackgroundPath(condition) {
  return `assets/images/bg/${getWeatherBackgroundFolder(condition)}/day_1.jpg`;
}
