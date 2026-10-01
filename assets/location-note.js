// The note under the Home place name after a location attempt failed — pure, unit-tested in
// tests/location-note.test.js. DOM wiring stays in app.js.
//
// 1 Oct 2026 (outside reviewer, 30 Sept): when the phone refuses location the app shows a 5-second
// toast and then quietly loads the saved or approximate place, so a few seconds later Cape Town sits
// on Home with nothing saying it is not where the reader is. Al ruled the fallback itself stays;
// this is the honest note that stays with it. In memory only: it is never stored, so a reload is a
// fresh attempt and clears it.

export const NOTE_SAVED = 'saved';
export const NOTE_APPROX = 'approx';

/** Which T.home key says it: the saved GPS place, or the IP-based rough guess. */
export function noteTextKey(kind) {
  return kind === NOTE_SAVED ? 'fallbackSaved' : kind === NOTE_APPROX ? 'fallbackApprox' : null;
}

/**
 * The note's state: which variant, and the place it describes. It describes ONE place: loading any
 * other place (the user picked one, a later GPS fix moved Home) drops it. A later GPS success that
 * lands on the very same coordinates calls clear() itself, since the place alone cannot tell.
 */
export function createLocationNote() {
  let kind = null;
  let place = null;
  return {
    current: () => kind,
    show(nextKind, nextPlace) {
      if (!noteTextKey(nextKind)) return false;
      kind = nextKind; place = nextPlace || null;
      return true;
    },
    clear() { const had = kind !== null; kind = null; place = null; return had; },
    /** Call on every place load; true when the note was dropped. `same(a, b)` is app.js's samePlace. */
    dropUnlessFor(nextPlace, same) {
      if (kind === null) return false;
      if (place && nextPlace && same(place, nextPlace)) return false;
      return this.clear();
    },
  };
}
