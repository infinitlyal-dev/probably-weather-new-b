// First-open location coordinator — pure orchestration, no DOM, so the race is
// unit-testable independently of app.js. app.js owns the side-effect wiring
// (geolocation, reverse-geocode, loadAndRender, persistence); this owns the
// decision of WHICH source wins and WHEN.
//
// The bug it fixes: a first-time user with no saved location used to wait up to
// 8s on a blank "Locating…" screen because IP geolocation only ran AFTER
// getCurrentPosition errored/timed out. Here GPS and a short grace timer race:
// IP paints fast if GPS is slow, and a late GPS resolve upgrades to precise
// coords — without ever clobbering a place the user chose in the meantime.

// Grace window: how long we wait for a fast GPS fix before falling back to IP.
// 1s is long enough that a phone with location already warm resolves first
// (so fast-GPS users never trigger an IP lookup, keeping the privacy posture
// "IP only when GPS is slow/unavailable"), short enough that a cold/blocked
// sensor doesn't strand the user staring at a spinner.
export const GPS_GRACE_MS = 1000;

/**
 * Coordinate the first-open location flow. Fire-and-forget.
 *
 * @param {object} deps
 * @param {(onSuccess: (coords) => void, onError: (err) => void) => void} deps.getCurrentPosition
 *        Starts a bounded geolocation request. onSuccess receives `coords`
 *        ({latitude, longitude}); onError receives a GeolocationPositionError.
 * @param {(coords) => object} deps.gpsPlaceFromCoords
 *        Build a renderable place from GPS coords. Returns synchronously with a
 *        placeholder name so the weather paint is NOT gated on reverse-geocode;
 *        the real label is resolved in parallel by the render layer.
 * @param {() => Promise<object>} deps.fetchIpPlace
 *        Resolve an approximate place from IP. Must never reject — it owns its
 *        own ultimate fallback (e.g. Johannesburg) so "both sources fail" still
 *        paints something instead of spinning forever.
 * @param {(place) => void} deps.paint        Render weather for a place (loadAndRender).
 * @param {(place) => void} deps.persistHome  Persist a place as the home location.
 * @param {() => object|null} deps.getActivePlace  Current activePlace reference.
 * @param {(err) => void} deps.onApproxToast  Notify the user we fell back to IP.
 * @param {typeof setTimeout} [deps.setTimeoutFn]
 * @param {typeof clearTimeout} [deps.clearTimeoutFn]
 * @param {number} [deps.graceMs]
 */
export function startFirstOpenLocation({
  getCurrentPosition,
  gpsPlaceFromCoords,
  fetchIpPlace,
  paint,
  persistHome,
  getActivePlace,
  onApproxToast,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  graceMs = GPS_GRACE_MS,
}) {
  // Ownership token. `lastRendered` is the exact place object this flow last
  // painted; it starts as whatever is active now (null — the "Locating…"
  // screen). The flow only ever paints/upgrades while it still owns the view:
  // any intervening user pick reassigns activePlace to a different reference,
  // so isOurs() fails closed and we neither repaint nor clobber their choice.
  let lastRendered = getActivePlace();
  let gpsDone = false;    // a GPS fix has won — IP must not downgrade it
  let gpsFailed = false;  // GPS errored — don't start IP twice / don't double-toast
  let ipStarted = false;

  const isOurs = () => getActivePlace() === lastRendered;
  const render = (place) => { lastRendered = place; paint(place); };

  function startIp() {
    if (ipStarted || gpsDone) return;
    ipStarted = true;
    (async () => {
      let place;
      try {
        place = await fetchIpPlace();
      } catch {
        return;  // fetchIpPlace owns its fallback; a throw means give up quietly
      }
      if (gpsDone) return;     // GPS won during the IP fetch — keep the better fix
      if (!isOurs()) return;   // user navigated away — don't hijack their view
      persistHome(place);
      render(place);
    })();
  }

  const graceHandle = setTimeoutFn(() => {
    if (gpsDone || gpsFailed) return;  // GPS already resolved/handled
    startIp();
  }, graceMs);

  getCurrentPosition(
    (coords) => {
      if (gpsDone) return;
      gpsDone = true;
      clearTimeoutFn(graceHandle);
      const place = gpsPlaceFromCoords(coords);
      // Always persist the GPS fix as home: even if the user has navigated away,
      // their next cold open should land on the precise location (best-available).
      persistHome(place);
      // Only paint if we still own the view — this is the upgrade-over-IP case,
      // or the GPS-instant case where nothing else has rendered yet.
      if (isOurs()) render(place);
    },
    (err) => {
      if (gpsDone || gpsFailed) return;
      gpsFailed = true;
      if (!ipStarted) {
        // Fast failure (typically a permission denial) beat the grace timer —
        // surface the "using approximate location" notice and start IP now
        // instead of waiting out the rest of the grace window.
        clearTimeoutFn(graceHandle);
        onApproxToast(err);
        startIp();
      }
      // Otherwise the grace timer already started IP (weather is on its way),
      // so a late GPS timeout stays silent — no alarming toast over live data.
    },
  );
}
