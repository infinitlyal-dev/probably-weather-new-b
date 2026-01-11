// assets/config.js
// Single source of truth for all app configuration

window.PW_CONFIG = {
  
  // API endpoint
  api: "/api/weather",
  
  // Thresholds for condition detection
  thresholds: {
    rainPct: 40,      // >= 40% = rain dominates
    windKph: 25,      // >= 25 km/h = wind dominates
    coldC: 16,        // <= 16°C = cold dominates
    hotC: 32          // >= 32°C = heat dominates
  },
  
  // Background image paths
  bgPath: "/assets/images/bg",
  
  // Map condition to folder name
  conditionFolders: {
    storm: "storm",
    rain: "rain",
    wind: "wind",
    cold: "cold",
    heat:  "heat",
    fog: "fog",
    cloudy: "cloudy",
    clear: "clear"
  },
  
  // Fallback if image not found
  fallbackBg: "/assets/images/bg/clear/day.jpg",
  
  // Headlines for each condition
  headlines:  {
    storm:  "This is stormy.",
    rain: "This is rainy.",
    wind: "This is windy.",
    cold: "This is cold.",
    heat: "This is hot.",
    fog: "This is foggy.",
    cloudy: "This is cloudy.",
    clear: "This is clear."
  },
  
  // Today's extreme labels
  extremeLabels: {
    storm: "Storm",
    rain:  "Rain",
    wind:  "Wind",
    cold: "Cold",
    heat: "Heat",
    fog: "Fog",
    cloudy:  "Cloudy",
    clear: "Clear"
  },
  
  // Witty lines for each condition
  wittyLines: {
    storm: "Electric vibes.  Don't be the tallest thing outside.",
    rain: "The clouds are crying like NZ at the '23 World Cup! ",
    wind: "Hold onto your hat — and your hairstyle.",
    cold: "Ja, it's jacket weather.",
    heat: "Frying an egg is a real option.",
    fog: "Misty mayhem—can't see your braai from the stoep! ",
    cloudy: "50/50 weather.  Could go either way.",
    clear: "Braai weather, boet!"
  },
  
  // Rain descriptions
  rainDescriptions: {
    none: "Probably none today",
    unlikely: "Unlikely",
    possible: "Possible showers",
    likely: "Steady showers",
    heavy: "Heavy rain expected"
  },
  
  // Confidence labels
  confidenceLabels: {
    strong: "High",
    decent: "Medium", 
    mixed: "Low"
  },
  
  // Confidence explanations
  confidenceExplain: {
    strong: "All sources agree.",
    decent: "Most sources agree.",
    mixed: "Sources disagree — have a backup plan."
  }
};