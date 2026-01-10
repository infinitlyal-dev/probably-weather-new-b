// assets/config.js
// Single source of truth for wording, thresholds and UI labels.
// Keep this file small and stable. Additive changes only.

window.PW_CONFIG = {
    // Temperature decisions / phrasing helpers
    thresholds: {
      hotThreshold: 25
    },
  
    // ✅ Confidence wording (product rule: never say "Low confidence")
    // Backend keys: strong | decent | mixed
    // UI labels: High | Mixed
    confidence: {
      strong: {
        label: "High",
        short: "Sources agree.",
        long: "The sources are closely aligned — you can plan with confidence."
      },
      decent: {
        label: "Mixed",
        short: "Mostly aligned.",
        long: "The sources mostly agree, but there’s still some variation — expect small swings."
      },
      mixed: {
        label: "Mixed",
        short: "Not fully aligned.",
        long: "Sources disagree — this is classic 50/50 weather. Have a Plan B."
      }
    },
  
    // Condition keys (used across UI)
    conditionKeys: {
      clear: "clear",
      cloudy: "cloudy",
      rain: "rain",
      storm: "storm",
      fog: "fog"
    }
  };
  