// Reversed light advice (2026-09-23): the English tells drivers to use their lights, and the
// translation carries a verb that switches them OFF or removes them — st-0870, "tlosa mabone"
// (take the lights off) for "Headlights wouldn't hurt.", live from June to September 2026.
// Shared by rule-checks.mjs and tests/safety-reversal.test.js.
export const LIGHTS_ON = /headlight|lights? on|switch on the lights|turn on the lights/i;
export const LIGHTS_OFF = {
  af: /\b(ligte|lampe|koplampe)\s+(af|uit)\b|\bafskakel|\bafsit\b|\bdoodmaak/i,
  zu: /\b(cisha|cima|khipha|susa)\w*/i,
  xh: /\b(cima|cisha|khupha|susa)\w*/i,
  st: /\b(tima|tlosa|timetsa|ntsha)\w*/i,
};
export function reversedLightAdvice(lang, en, text) {
  if (!LIGHTS_ON.test(String(en)) || !LIGHTS_OFF[lang]) return null;
  const m = String(text).match(LIGHTS_OFF[lang]);
  return m ? m[0] : null;
}
