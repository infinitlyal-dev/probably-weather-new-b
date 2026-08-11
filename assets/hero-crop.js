// Probably Weather — per-image hero crop offsets (M7).
//
// The mobile hero card is a CSS crop of a 9:16 portrait into a 342x304 landscape
// band: `background-size: cover` with `background-position: center
// var(--hero-crop, 78%)`. One number, 78%, for 294 different photographs. It
// survives most of them and cuts people's heads off in the rest.
//
// This module is the escape hatch: an OPTIONAL vertical offset per image. It is
// DISPLAY METADATA — no image byte changes, no manifest changes, no picker
// changes. An image with no entry renders exactly as it does today, because the
// CSS default is the fallback in the var() itself.
//
// AUTHORED per image hash in `review/set-001-crop-offsets.json` (the hash is the
// stable identity of the bytes; one hash can occupy several rotation slots).
// EXPANDED to slot paths by scripts/build-hero-crop-offsets.mjs, because the
// path is what the picker actually hands the browser and a path lookup costs
// nothing at render time.
//
// The map below is EMPTY on purpose. The mechanism ships first and does nothing;
// the offsets ship only once Al has ruled on the contact sheets.

/** @type {Readonly<Record<string, number>>} slot path (no prefix) -> crop % */
export const HERO_CROP_OFFSETS = Object.freeze({
  // __HERO_CROP_OFFSETS__  (generated — do not hand-edit)
  // (none ruled yet)
});

// The key is everything after `assets/images/`, which means it covers BOTH
// shapes the picker can emit — and it has to, because they are different:
//
//   source tree / preview  ->  bg/clear/week_2/dawn/5.webp
//   production             ->  bg-canonical/<sha256>.webp
//
// scripts/image-slot-manifest.mjs inlines a slot->content-hash manifest into
// image-picker.js at build time, ships one WebP per unique body under
// bg-canonical/, and DELETES dist/assets/images/bg/<condition>/ outright. The
// first version of this module keyed on 'assets/images/bg/' only — which
// `bg-canonical/` does not contain — so it resolved nothing in production and
// the whole mechanism would have shipped dead. The content-hash key is also the
// safer one: reroll different bytes into a slot and the hash changes, so a stale
// offset stops matching and the image falls back to the CSS default rather than
// wearing a crop authored for a different photograph.
const PREFIX = 'assets/images/';
// Anchored, not a substring search: `indexOf` alone would happily key
// https://elsewhere.example/x/assets/images/bg/clear/1.webp off a foreign host.
const ANCHOR = /^(?:\.?\/)?assets\/images\//;

/**
 * Normalise anything the picker or the shell might hold — a relative slot path,
 * an absolute path, a full URL, with or without a query string — down to the
 * key the map is written in.
 * @param {string} src
 * @returns {string} '' when the src is not a background-image path
 */
export function heroCropKey(src) {
  if (typeof src !== 'string' || !src) return '';
  let s = src;
  // Full URL -> pathname. Deliberately not `new URL(...)`: this runs on the
  // paint path and a malformed src must not throw.
  const scheme = s.indexOf('://');
  if (scheme !== -1) {
    const slash = s.indexOf('/', scheme + 3);
    s = slash === -1 ? '' : s.slice(slash);
  }
  s = s.split('?')[0].split('#')[0];
  if (s.startsWith('/')) s = s.slice(1);
  if (!ANCHOR.test(s)) return '';
  return s.slice(PREFIX.length);
}

/**
 * The crop offset for a background src, or null to mean "use the CSS default".
 * Null is deliberately distinct from 78: the default lives in ONE place, the
 * stylesheet, and this module never restates it.
 * @param {string} src
 * @param {Record<string, number>} [table]
 * @returns {number|null} 0-100
 */
export function heroCropFor(src, table = HERO_CROP_OFFSETS) {
  const key = heroCropKey(src);
  if (!key) return null;
  const value = table[key];
  // An out-of-range or non-numeric entry is treated as absent rather than
  // clamped: a bad number in generated data should fall back to the shipped
  // default, not silently paint a different crop.
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) return null;
  return value;
}

/**
 * Apply (or clear) the offset on the document element. Clearing matters: the
 * picker changes image on every condition/time/week transition, and a stale
 * --hero-crop left behind would apply one photograph's offset to the next one.
 * @param {Element} root
 * @param {number|null} crop
 */
export function applyHeroCrop(root, crop) {
  if (!root || !root.style) return;
  if (crop == null) root.style.removeProperty('--hero-crop');
  else root.style.setProperty('--hero-crop', `${crop}%`);
}
