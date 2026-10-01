// Saved places' readings (1 Oct 2026). A saved row used to keep the first temperature it ever
// fetched: the early return in ensureFavoriteMeta had no age check, so a saved Cape Town showed 15°
// while live Cape Town was 23° (outside reviewer, 30 Sept). Each reading now carries metaAt, the
// moment it was fetched, and the list decides from that whether the number may stand as current.

// 30 min is the longest a "current" number may sit. The server's shared ensemble cache is 5 min and
// Home refreshes on a cadence of that order, so a reading older than half an hour is past anything
// the rest of the app would still call now; past it the row refetches and, until it lands, says how
// old its number is.
export const SAVED_META_MAX_AGE_MS = 30 * 60 * 1000;
// Past a day the number says nothing about today: the row shows "--°" and no age.
export const SAVED_META_DROP_AGE_MS = 24 * 60 * 60 * 1000;

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// An entry without metaAt was saved before readings were dated, so its age is unknown: stale.
export function isStale(entry, now) {
  if (!entry || !isNum(entry.tempC) || !entry.conditionKey || !isNum(entry.metaAt)) return true;
  return now - entry.metaAt > SAVED_META_MAX_AGE_MS;
}

// What the row may show: { tempC, ageMs }. A fresh reading shows as current (ageMs null). A stale one
// shows its number only beside its age; an undated or day-old one shows no number at all.
export function savedReadingView(entry, now) {
  if (!entry || !isNum(entry.tempC) || !isNum(entry.metaAt)) return { tempC: null, ageMs: null };
  const ageMs = Math.max(0, now - entry.metaAt);
  if (ageMs > SAVED_META_DROP_AGE_MS) return { tempC: null, ageMs: null };
  if (ageMs <= SAVED_META_MAX_AGE_MS) return { tempC: entry.tempC, ageMs: null };
  return { tempC: entry.tempC, ageMs };
}

// templates: { mins: '{mins} min ago', hours: '{h} h ago' } in the reader's language.
export function formatAge(ageMs, templates) {
  const mins = Math.floor(ageMs / 60000);
  if (mins < 60) return String(templates.mins).replace('{mins}', String(mins));
  return String(templates.hours).replace('{h}', String(Math.floor(mins / 60)));
}

// One refresh at a time: five stale rows must not fire five requests at once. `pending` is the
// caller's set of keys in flight (pendingFavMeta) so a re-render skips a row already queued; when
// the list stops showing (isVisible false), what is left in the queue is dropped, not fetched.
export function createSavedMetaRefresher({ load, onResult, onError, isVisible, pending = new Set() }) {
  const queue = [];
  let running = false;
  async function drain() {
    if (running) return;
    running = true;
    try {
      while (queue.length) {
        if (!isVisible()) { queue.splice(0).forEach(({ key }) => pending.delete(key)); break; }
        const { key, place } = queue.shift();
        try { onResult(place, await load(place)); } catch (err) { onError?.(place, err); } finally { pending.delete(key); }
      }
    } finally {
      running = false;
    }
  }
  return function enqueue(key, place) {
    if (pending.has(key) || !isVisible()) return false;
    pending.add(key);
    queue.push({ key, place });
    drain();
    return true;
  };
}
