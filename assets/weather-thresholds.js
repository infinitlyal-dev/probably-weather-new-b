// Shared heat thresholds — single source of truth for client AND server (M4).
//
// Before this module, the heat family was scattered: the API derived 'heat'
// at ≥35°C (extreme rung) / ≥30°C (warm rung, consensus support, daily heat)
// while assets/app.js used its own THRESH.HOT_C = 32 for the Hot badge and
// the client-side hero fallback — a 32–34°C band where the UI's numeric
// fallback could contradict the server's condition verdict.
//
// The client's numeric rungs are FALLBACK heuristics behind the server's
// conditionKey; they now fire only at the extreme rung, so the server verdict
// wins everywhere below it instead of being second-guessed in the gap band.
//
// Imported by api/weather.js (Node) and assets/app.js (browser) — keep this
// file dependency-free and side-effect-free.

/** Server: warm-temp derive rung, multi-source heat consensus, daily heat. */
export const HEAT_WARM_C = 30;

/** Server: extreme-heat derive rung. Client: Hot badge / hero numeric fallback. */
export const HEAT_EXTREME_C = 35;
