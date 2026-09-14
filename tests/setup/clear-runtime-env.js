// Strip the runtime's environment before ANY test module imports a handler.
//
// WHY THIS EXISTS. Since the release gate (package.json build → `vitest run &&
// …`) the suite runs INSIDE the Vercel build container, and Vercel exposes the
// project's environment variables to the build. Every test in this suite was
// written on a machine with none of them set:
//
//   - api/_lib/limiters.js getRedis() builds a REAL Upstash client the moment
//     UPSTASH_KV_REST_API_URL + UPSTASH_KV_REST_API_TOKEN are both present, and
//     memoises it. The per-file fetch mocks reject those requests, so every
//     rate-limited handler hangs until the test times out.
//   - Provider tests assert the missing-key path directly — e.g.
//     tests/tomorrow-io.test.js "returns null when TOMORROWIO_API_KEY env var is
//     missing" only clears keys in afterEach, so a key present at import time
//     inverts the assertion.
//
// Measured before this file existed: populating dummy values for the Upstash and
// provider variables turned a green suite (21777 passed) into 88 failures across
// 6 files. That is a deploy-breaking gate, not a gate.
//
// This only guarantees the STARTING state is "no runtime configuration", which
// is what the suite assumes. Tests that need a variable still set it themselves
// (beforeEach / vi.stubEnv), and nothing here touches the build steps that run
// after vitest — scripts/build.mjs reads VERCEL_GIT_COMMIT_SHA in its own
// process and still stamps the real deploy SHA.

/** Exact runtime secrets / integration variables the handlers read. */
export const CLEARED_ENV_NAMES = [
  'UPSTASH_KV_REST_API_URL',
  'UPSTASH_KV_REST_API_TOKEN',
  'WEATHERAPI_KEY',
  'PIRATE_WEATHER_KEY',
  'TOMORROWIO_API_KEY',
  'LOCATIONIQ_TOKEN',
  'OPEN_METEO_API_KEY',
  'MET_USER_AGENT',
  // api/errors.js reads this at MODULE LOAD, so a value set in the Vercel
  // project would change handler behaviour before any test could intervene.
  'PW_ERROR_ALLOWED_ORIGINS',
];

/** Whole families, so a newly-added KV/Redis/Vercel variable cannot reintroduce this. */
export const CLEARED_ENV_PREFIXES = ['UPSTASH_', 'KV_', 'REDIS_', 'VERCEL_'];

const shouldClear = (name) =>
  CLEARED_ENV_NAMES.includes(name) || CLEARED_ENV_PREFIXES.some((p) => name.startsWith(p));

for (const name of Object.keys(process.env)) {
  if (shouldClear(name)) delete process.env[name];
}
