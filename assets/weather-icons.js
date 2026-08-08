// Probably Weather — the one icon family (M5).
//
// Replaces every in-app platform emoji with inline SVG drawn to a single
// contract, so the app stops borrowing thirteen different house styles from
// whatever emoji font the device happens to ship:
//
//   · 24x24 viewBox, fill: none, stroke: currentColor, stroke-width 2,
//     round caps and joins — the same contract the install icons and the
//     Hourly clock in index.html already used.
//   · currentColor everywhere, so the colour system drives the icons and an
//     icon can never introduce a colour the palette has not ruled on.
//   · No emoji-presentation glyphs, no colour fonts, no per-OS drift.
//
// OUT OF SCOPE by Al's ruling: api/og.js and the share card keep their glyphs
// and their amber (that surface is styled for feeds, not for the app), and
// typographic characters that were never emoji — the Share arrow, the ×, the
// © — stay as characters.
//
// The 13 weather icons are keyed by NAME, not by condition: weather-emoji.js
// owns the condition -> name decision (and still owns the day/night split),
// this module owns what each name looks like.

// `fill` is NOT in here. It was, and the filled-star option then emitted a
// SECOND fill attribute later in the same tag — which every HTML parser drops,
// keeping the first. The saved/unsaved star rendered identically. Fill is a
// per-call attribute now, so there is exactly one of it.
const V = 'viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

// The shared cloud body. Every cloud-based icon reuses one of these two so the
// family cannot drift into three different clouds: CLOUD sits on a 17 baseline
// (nothing above it), CLOUD_LOW sits on 18 and is shifted right to leave the
// top-left corner free for a sun.
const CLOUD = 'M6.5 17.5h10a3.5 3.5 0 0 0 .3-7 5.6 5.6 0 0 0-10.4-1.6 5 5 0 0 0 .1 8.6Z';
const CLOUD_LOW = 'M10 18.5h6.8a3.1 3.1 0 0 0 .3-6.2 5 5 0 0 0-9.2-1.4 4.4 4.4 0 0 0 2.1 7.6Z';
// The sun that peeks out from behind CLOUD_LOW. It is an ARC, not a circle:
// a full circle would cross the cloud outline, and two stroked shapes crossing
// read as a scribble at 16px. The arc stops before the cloud starts — measured,
// not eyeballed: its right end lands ~1.1 units clear of the cloud's top edge.
const SUN_PEEK = '<path d="M4.79 7.89A3.2 3.2 0 0 1 10.95 7.36"/>'
  + '<path d="M7.8 2.4V1.2M4.69 3.69 3.84 2.84M10.91 3.69l.85-.85M3.4 6.8H2.2"/>';

const PATHS = {
  // Clear, day and night.
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.6v2M12 19.4v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.6 12h2M19.4 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 7.5 7.5 0 1 0 20 14.5Z"/>',
  // Cloud family.
  cloud: `<path d="${CLOUD}"/>`,
  'cloud-sun': `${SUN_PEEK}<path d="${CLOUD_LOW}"/>`,
  rain: `<path d="${CLOUD}"/><path d="M8.6 19.4l-1 2.6M12.2 19.4l-1 2.6M15.8 19.4l-1 2.6"/>`,
  'rain-sun': `${SUN_PEEK}<path d="${CLOUD_LOW}"/><path d="M11.2 20.4l-.8 2.2M14.8 20.4l-.8 2.2"/>`,
  storm: `<path d="${CLOUD}"/><path d="M13.5 17.6 10.6 21.4h2.9l-1.3 2.4"/>`,
  // Hail / sleet: dots under the cloud, deliberately NOT a snowflake — the
  // snowflake is the cold icon and the two must not read as each other.
  sleet: `<path d="${CLOUD}"/><path d="M9 20.2h.01M12.4 20.2h.01M10.7 22.8h.01M15.6 20.2h.01"/>`,
  fog: `<path d="${CLOUD}"/><path d="M6 20.6h12M8.6 23.2h7"/>`,
  wind: '<path d="M3 8h9a2.6 2.6 0 1 0-2.6-2.6"/><path d="M3 12h13a3 3 0 1 1-3 3"/><path d="M3 16h7a2.4 2.4 0 1 1-2.4 2.4"/>',
  // Cold: the condition that also renders snow particles, so the snowflake is
  // the honest glyph for it.
  cold: '<path d="M12 3.4v17.2M4.6 7.7l14.8 8.6M19.4 7.7 4.6 16.3"/><path d="m9.9 5.5 2.1 1.9 2.1-1.9M9.9 18.5l2.1-1.9 2.1 1.9"/>',
  // Cold-clear: Highveld dry cold under a blue sky — it looks nothing like it
  // feels, so the icon has to say both at once. A sun and a snowflake side by
  // side was tried first and failed the 16px read (two small objects, one box);
  // this is ONE object — the snowflake wearing the sun's rays. Distinct from
  // plain `cold`, which has no diagonal rays.
  'cold-clear': '<path d="M12 7v10M7.67 9.5l8.66 5M16.33 9.5l-8.66 5"/>'
    + '<path d="M17.3 17.3l1.77 1.77M6.7 17.3l-1.77 1.77M6.7 6.7 4.93 4.93M17.3 6.7l1.77-1.77"/>',
  heat: '<path d="M12 2.8c4 3.8 6 6.8 6 9.8a6 6 0 0 1-12 0c0-2.2 1-4.2 2.7-5.9 0 2 1.1 3.2 2.2 3.2 1.3 0 2-1.1 2-2.6 0-1.7-.6-3.2-.9-4.5Z"/>',

  // ---- UI icons (the non-weather glyphs M5 retires) ----
  pin: '<path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/>',
  star: '<path d="M12 3.8 14.29 9.24 20.18 9.74 15.71 13.61 17.05 19.36 12 16.3 6.95 19.36 8.29 13.61 3.82 9.74 9.71 9.24Z"/>',
  warning: '<path d="M12 4.2 2.6 20.4h18.8Z"/><path d="M12 10v4.4M12 17.8h.01"/>',
};

// Which condition key each weather icon stands for, so a caller can look the
// icon's accessible name up in the app's OWN five-language copy bank
// (heroLabels) instead of this module inventing English strings. That matters:
// the emoji these replaced were announced by the screen reader's LOCALISED
// Unicode name, so a hard-coded English label here would be a regression for
// four of the five languages.
export const ICON_CONDITION = {
  sun: 'clear', moon: 'night', cloud: 'cloudy', 'cloud-sun': 'partly-cloudy',
  rain: 'rain', 'rain-sun': 'rain-possible', storm: 'storm', sleet: 'hail',
  fog: 'fog', wind: 'wind', cold: 'cold', 'cold-clear': 'cold-clear', heat: 'heat',
};

export const ICON_NAMES = Object.keys(PATHS);

/**
 * Inline SVG markup for one icon.
 *
 * @param {string} name      key from PATHS
 * @param {object} [opts]
 * @param {number} [opts.size]     px, both axes (default 22)
 * @param {string} [opts.cls]      extra class on the <svg>
 * @param {boolean} [opts.filled]  fill the shape with currentColor (star only)
 * @param {string} [opts.label]    accessible name — supply an ALREADY-TRANSLATED
 *                                 string; omit it and the icon is aria-hidden
 *                                 decoration
 * @returns {string} SVG markup, safe to assign with innerHTML (no interpolation
 *                   of caller data beyond the numeric size, a scrubbed class
 *                   name and an escaped label)
 */
export function weatherIconSvg(name, opts = {}) {
  const body = PATHS[name];
  if (!body) return '';
  const size = Number.isFinite(opts.size) ? opts.size : 22;
  const cls = typeof opts.cls === 'string' ? opts.cls.replace(/[^\w- ]/g, '') : '';
  const label = typeof opts.label === 'string' ? opts.label.trim() : '';
  // The label comes from the copy bank, but it still lands inside an attribute,
  // so it is escaped rather than trusted.
  const safeLabel = label.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const a11y = safeLabel ? `role="img" aria-label="${safeLabel}"` : 'aria-hidden="true"';
  const fill = opts.filled ? 'currentColor' : 'none';
  // data-icon is the icon's identity in the rendered DOM. It costs nothing and
  // it is what lets the M5 gate say WHICH icons a screen actually drew, rather
  // than only how many — the difference between "the contract holds" and "the
  // contract holds over an empty set".
  return `<svg xmlns="http://www.w3.org/2000/svg" ${V} width="${size}" height="${size}"`
    + ` fill="${fill}" class="pw-icon${cls ? ` ${cls}` : ''}" data-icon="${name}" ${a11y}>${body}</svg>`;
}
