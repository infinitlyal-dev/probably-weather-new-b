// assets/config.js
// Single source of truth for wording, thresholds, and endpoints.
// This is how we avoid "functionality changes breaking look & feel".

window.PW_CONFIG = {
  appName: "Probably Weather",

  endpoints: {
    // Vercel serverless function
    weather: "/api/weather",
  },

  // Asset paths (all lowercase to match Linux case-sensitive filesystem)
  assets: {
    basePath: "/assets/images",
    bgBasePath: "/assets/images/bg",
    // Map conditionKey (from API) to folder name (must match folder names exactly, lowercase)
    conditionToFolder: {
      clear: "clear",
      cloudy: "cloudy",
      rain: "rain",
      storm: "storm",
      fog: "fog",
      wind: "wind",
      // Fallback for unknown conditions
      unknown: "cloudy"
    },
    // Fallback folder if conditionKey doesn't match
    fallbackFolder: "cloudy",
    // Fallback image if time-of-day variant doesn't exist
    fallbackImage: "/assets/images/bg/default.jpg",
    // Time-of-day labels (all lowercase to match folder names)
    timeOfDayLabels: ["dawn", "day", "dusk", "night"]
  },

  // Temperature thresholds for cold/heat mapping (optional, if needed)
  // Note: API doesn't return cold/heat as conditionKeys, but folders exist
  // For now, we'll use conditionKey direc...
  conditionTone: {
    clear: {
      title: "Clear",
      vibe: "Low drama weather.",
      note: "If your plan depends on the sky behaving, this is the best version."
    },
    cloudy: {
      title: "Cloudy",
      vibe: "50/50 weather.",
      note: "Cloud can mean warm or cold — it's the most 'not sure' forecast."
    },
    rain: {
      title: "Rain",
      vibe: "Plan accordingly.",
      note: "Not dangerous by default — but it can get messy fast. Think timing."
    },
    storm: {
      title: "Storm",
      vibe: "This can turn.",
      note: "This is where weather becomes genuinely risky — avoid unnecessary travel."
    },
    unknown: {
      title: "Unclear",
      vibe: "Hard to call.",
      note: "We'll show what we can, but treat it as 'mixed' until it settles."
    }
  },

  // Visual labels (keep it cheeky, NOT crass, NOT culturally loaded)
  uiCopy: {
    searchPlaceholder: "Search a city…",
    myLocationDisabled: "Location button coming soon.",
    updated: "Updated",
    feelsLike: "Feels like",
    wind: "Wind",
    humidity: "Humidity",
    rainChance: "Rain chance",
    today: "Today",
    hourly: "Hourly",
    week: "Week",
    search: "Search",
    settings: "Settings",
    home: "Home",
    sources: "Sources"
  },

  // Basic unit formatting preferences
  units: {
    temp: "C",
    wind: "km/h"
  }
};