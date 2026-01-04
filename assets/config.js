// assets/config.js
// Single source of truth for wording, thresholds, and endpoints.
// This is how we avoid “functionality changes breaking look & feel”.

window.PW_CONFIG = {
    appName: "Probably Weather",
  
    endpoints: {
      // Vercel serverless function
      weather: "/api/weather",
    },
  
    // Confidence levels (based on how closely sources agree)
    confidence: {
      strong: {
        label: "Strong",
        short: "Sources agree.",
        long: "All sources are telling the same story — you can plan with confidence."
      },
      decent: {
        label: "Decent",
        short: "Mostly aligned.",
        long: "Most sources agree. Not perfect, but good enough to make a call."
      },
      mixed: {
        label: "Mixed",
        short: "Split decision.",
        long: "Sources disagree — this is classic 50/50 weather. Have a backup plan."
      }
    },
  
    // “Cloudy feels 50/50” — we bake that into copy + tone.
    conditionTone: {
      clear: {
        title: "Clear",
        vibe: "Low drama weather.",
        note: "If your plan depends on the sky behaving, this is the best version."
      },
      cloudy: {
        title: "Cloudy",
        vibe: "50/50 weather.",
        note: "Cloud can mean warm or cold — it’s the most ‘not sure’ forecast."
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
        note: "We’ll show what we can, but treat it as ‘mixed’ until it settles."
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
  