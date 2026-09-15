// ADS-READINESS (branch ads-readiness, do not merge) — the ad surfaces, per Al's ruling
// of 2026-09-15: no Home slot at all; one slot on Hourly and one on Weekly, phones and
// tablets only, below the fold, never over content or the nav; a Search slot that exists
// only behind a flag, off by default. With no network live, every enabled slot shows the
// placeholder card (T.ads.placeholder) and nothing is requested from anyone.
export const ADS_CONFIG = Object.freeze({
  network: null,
  slots: Object.freeze({ hourly: true, weekly: true, search: false }),
  // Phones and tablets only: the >=1024px desktop postcard carries no slot.
  maxWidthPx: 1023,
});

export function slotEnabled(name, config = ADS_CONFIG) {
  return config.slots[name] === true;
}
