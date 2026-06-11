// Per-language copy loading (Group 6 bundle split).
//
// app.js used to statically import the full five-language bank (~120 KB) on
// every load. Now it imports THIS module: COPY_BANK starts as a crash-safe
// minimal seed, and loadCopyBank(lang) dynamically imports the one generated
// per-language file (assets/copy/<lang>.js, ~23-46 KB) and merges it IN PLACE
// — app.js's T object holds references to these exact nested objects, so a
// merge is immediately visible to every getter without re-wiring.
//
// Failure posture: if the dynamic import fails (network blip on a first-ever
// uncached visit), the app keeps rendering with the seed strings below —
// degraded but alive, and the next loadCopyBank call retries.

const SUPPORTED = ['en', 'af', 'zu', 'xh', 'st'];

// Minimal seed so the copy getters in app.js (which end in hard fallbacks
// like `|| T.witty.clear.en`) can never throw before the real bank lands.
// Strings match the real en bank's register; they show only in the rare
// window where weather data beats the ~30 KB same-origin copy fetch.
export const COPY_BANK = {
  heroLabels: { clear: { en: 'Pleasant' } },
  headlines: { clear: { en: 'Clear skies.' } },
  witty: {
    clear: { en: ['Absolutely beautiful out there.'] },
    weekend: { en: ['Braai weather, boet! No excuses.'] },
  },
  witty_low_confidence: {},
};

function mergeInPlace(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !Array.isArray(value)
        && target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
      mergeInPlace(target[key], value);
    } else {
      target[key] = value;
    }
  }
}

const loadedLangs = new Set();

/**
 * Ensure the bank for `lang` is merged into COPY_BANK.
 * Resolves true when a NEW bank was merged (caller should re-render),
 * false when it was already loaded. Rejects on import failure.
 */
export async function loadCopyBank(lang) {
  const safe = SUPPORTED.includes(lang) ? lang : 'en';
  if (loadedLangs.has(safe)) return false;
  const mod = await import(`./copy/${safe}.js`);
  mergeInPlace(COPY_BANK, mod.WEATHER_COPY);
  loadedLangs.add(safe);
  return true;
}
