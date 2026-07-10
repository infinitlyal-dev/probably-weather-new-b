export const INSTALL_IDLE_TIMEOUT_MS = 5000;

export function setupDeferredInstallLoad({
  windowRef = typeof window !== 'undefined' ? window : null,
  load,
  idleTimeoutMs = INSTALL_IDLE_TIMEOUT_MS,
} = {}) {
  if (!windowRef || typeof load !== 'function') return null;

  let capturedPrompt = null;
  let loadPromise = null;
  const loadNow = () => {
    if (!loadPromise) loadPromise = Promise.resolve().then(() => load(capturedPrompt));
    return loadPromise;
  };

  windowRef.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    capturedPrompt = event;
    loadNow();
  }, { once: true });

  if (typeof windowRef.requestIdleCallback === 'function') {
    windowRef.requestIdleCallback(() => loadNow(), { timeout: idleTimeoutMs });
  } else {
    windowRef.setTimeout(() => loadNow(), 3000);
  }

  return { loadNow, getCapturedPrompt: () => capturedPrompt };
}
