// assets/config.js
// Single source of truth for wording, thresholds, and endpoints.

window.PW_CONFIG = {
  appName: "Probably Weather",

  endpoints: {
    weather: "/api/weather",
  },

  assets: {
    basePath: "/assets/images",
    bgBasePath: "/assets/images/bg",
    conditionToFolder: {
      clear: "clear",
      cloudy: "cloudy",
      rain: "rain",
      storm: "storm",
      fog: "fog",
      wind: "wind",
      hot: "heat", // Map if separate
      cold: "cold",
      unknown: "cloudy"
    },
    fallbackFolder: "cloudy",
    fallbackImage: "/assets/images/bg/default.jpg",
    timeOfDayLabels: ["dawn", "day", "dusk", "night"]
  },

  temperature: {
    coldThreshold: 10,
    heatThreshold: 25
  },

  confidence: {
    strong: {
      label: "High",
      short: "Sources agree.",
      long: "All sources are telling the same story — you can plan with confidence."
    },
    decent: {
      label: "Medium",
      short: "Mostly aligned.",
      long: "Most sources agree. Not perfect, but good enough to make a call."
    },
    mixed: {
      label: "Low",
      short: "Split decision.",
      long: "Sources disagree — this is classic 50/50 weather. Have a backup plan."
    }
  },

  conditionTone: {
    clear: {
      title: "Clear",
      vibe: "Low drama weather.",
      note: "If your plan depends on the sky behaving, this is the best version.",
      witty: "Braai weather, boet!",
      plain: "Clear skies."
    },
    cloudy: {
      title: "Cloudy",
      vibe: "50/50 weather.",
      note: "Cloud can mean warm or cold — it's the most 'not sure' forecast.",
      witty: "50/50 weather.",
      plain: "Overcast."
    },
    rain: {
      title: "Rain",
      vibe: "Plan accordingly.",
      note: "Not dangerous by default — but it can get messy fast. Think timing.",
      witty: "The clouds are crying like NZ at the '23 World Cup!",
      plain: "Rainy."
    },
    storm: {
      title: "Storm",
      vibe: "This can turn.",
      note: "This is where weather becomes genuinely risky — avoid unnecessary travel.",
      witty: "Better stay indoors",
      plain: "Stormy."
    },
    fog: {
      title: "Fog",
      vibe: "Misty mayhem.",
      note: "Visibility low — drive slow, flights delayed.",
      witty: "Misty mayhem—can't see your braai from the stoep!",
      plain: "Foggy."
    },
    wind: {
      title: "Wind",
      vibe: "Hairdo beware.",
      note: "Gusts can make outdoor plans tricky.",
      witty: "Windy dawn—hairdo beware!",
      plain: "Windy."
    },
    hot: {
      title: "Hot",
      vibe: "Scorching.",
      note: "Stay hydrated, avoid midday sun.",
      witty: "Frying an egg is a real option",
      plain: "Hot."
    },
    cold: {
      title: "Cold",
      vibe: "Chilly.",
      note: "Bundle up, possible frost.",
      witty: "Time to build a snowman",
      plain: "Cold."
    },
    unknown: {
      title: "Unclear",
      vibe: "Hard to call.",
      note: "We'll show what we can, but treat it as 'mixed' until it settles.",
      witty: "Weather's playing hide and seek.",
      plain: "Unknown."
    }
  },

  rainDescs: {
    0: "Probably none today",
    low: "Misty, no rain",
    medium: "Light gusts possible",
    high: "Steady showers",
    heavy: "Heavy rain expected"
  },

  uvLevels: {
    low: "Low",
    medium: "Moderate",
    high: "High",
    veryHigh: "Very high"
  },

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

  units: {
    temp: "C",
    wind: "km/h"
  }
};