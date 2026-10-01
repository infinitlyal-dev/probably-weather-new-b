// Saved places must not show an old temperature as current (1 Oct 2026). The outside reviewer saw a
// saved Cape Town at 15° while live Cape Town was 23°: ensureFavoriteMeta returned early whenever an
// entry had tempC and conditionKey, with no age check. These pin the pure logic in
// assets/saved-place-meta.js and that app.js wires it.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  SAVED_META_MAX_AGE_MS, SAVED_META_DROP_AGE_MS,
  isStale, savedReadingView, formatAge, createSavedMetaRefresher,
} from '../assets/saved-place-meta.js';

const NOW = Date.UTC(2026, 9, 1, 10, 0, 0);
const MIN = 60 * 1000;
const place = (over = {}) => ({ name: 'Cape Town', lat: -33.92, lon: 18.42, tempC: 15, conditionKey: 'clear', metaAt: NOW - 5 * MIN, ...over });
const TEMPLATES = { mins: '{mins} min ago', hours: '{h} h ago' };
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('isStale', () => {
  it('a reading older than 30 min is stale; a fresh one is not', () => {
    expect(SAVED_META_MAX_AGE_MS).toBe(30 * MIN);
    expect(isStale(place({ metaAt: NOW - 31 * MIN }), NOW)).toBe(true);
    expect(isStale(place({ metaAt: NOW - 29 * MIN }), NOW)).toBe(false);
  });
  it('an entry saved before readings were dated (no metaAt) is stale', () => {
    const { metaAt, ...legacy } = place();
    expect(isStale(legacy, NOW)).toBe(true);
  });
  it('an entry with no reading at all is stale', () => {
    expect(isStale({ name: 'X', lat: 1, lon: 2 }, NOW)).toBe(true);
  });
});

describe('savedReadingView — never a stale number as current', () => {
  it('fresh: the number, no age', () => {
    expect(savedReadingView(place(), NOW)).toEqual({ tempC: 15, ageMs: null });
  });
  it('stale within a day: the number only with its age', () => {
    expect(savedReadingView(place({ metaAt: NOW - 45 * MIN }), NOW)).toEqual({ tempC: 15, ageMs: 45 * MIN });
  });
  it('older than 24 h: no number, no age', () => {
    expect(savedReadingView(place({ metaAt: NOW - SAVED_META_DROP_AGE_MS - MIN }), NOW)).toEqual({ tempC: null, ageMs: null });
  });
  it('undated legacy reading: no number (its age is unknown)', () => {
    const { metaAt, ...legacy } = place();
    expect(savedReadingView(legacy, NOW)).toEqual({ tempC: null, ageMs: null });
  });
});

describe('formatAge', () => {
  it('minutes under an hour, whole hours after', () => {
    expect(formatAge(45 * MIN, TEMPLATES)).toBe('45 min ago');
    expect(formatAge(59 * MIN + 59000, TEMPLATES)).toBe('59 min ago');
    expect(formatAge(60 * MIN, TEMPLATES)).toBe('1 h ago');
    expect(formatAge(5 * 60 * MIN + 40 * MIN, TEMPLATES)).toBe('5 h ago');
  });
  it('fills the reader\'s language', () => {
    expect(formatAge(40 * MIN, { mins: '{mins} min gelede', hours: '{h} h gelede' })).toBe('40 min gelede');
  });
});

// The refresh as app.js wires it: refresh stale rows through the queue, write metaAt on success.
function harness({ entries, load, visible = true }) {
  let store = entries.map((e) => ({ ...e }));
  const pending = new Set();
  const key = (p) => `${p.lat},${p.lon}`;
  const state = { visible, now: NOW };
  const refresh = createSavedMetaRefresher({
    pending,
    isVisible: () => state.visible,
    load,
    onResult: (p, norm) => {
      store = store.map((e) => (key(e) === key(p) ? { ...e, tempC: norm.nowTemp, conditionKey: norm.conditionKey, metaAt: state.now } : e));
    },
  });
  const render = () => store.forEach((p) => { if (isStale(p, state.now)) refresh(key(p), p); });
  return { render, pending, state, get store() { return store; } };
}

describe('refreshing saved readings', () => {
  it('an old saved reading refreshes, and metaAt is written on success', async () => {
    const load = vi.fn(async () => ({ nowTemp: 23, conditionKey: 'clear' }));
    const h = harness({ entries: [place({ metaAt: NOW - 2 * 60 * MIN })], load });
    h.render();
    await flush();
    expect(load).toHaveBeenCalledTimes(1);
    expect(h.store[0].tempC).toBe(23);
    expect(h.store[0].metaAt).toBe(NOW);
    expect(savedReadingView(h.store[0], NOW)).toEqual({ tempC: 23, ageMs: null });
  });

  it('a fresh reading does not refetch', async () => {
    const load = vi.fn(async () => ({ nowTemp: 23, conditionKey: 'clear' }));
    const h = harness({ entries: [place({ metaAt: NOW - 10 * MIN })], load });
    h.render();
    await flush();
    expect(load).not.toHaveBeenCalled();
  });

  it('a failed refresh leaves the old number shown only with its age, never as current', async () => {
    const load = vi.fn(async () => { throw new Error('API error'); });
    const h = harness({ entries: [place({ metaAt: NOW - 50 * MIN })], load });
    h.render();
    await flush();
    expect(load).toHaveBeenCalledTimes(1);
    expect(h.store[0].metaAt).toBe(NOW - 50 * MIN);
    const view = savedReadingView(h.store[0], NOW);
    expect(view.tempC).toBe(15);
    expect(formatAge(view.ageMs, TEMPLATES)).toBe('50 min ago');
    expect(h.pending.size).toBe(0);
  });

  it('five stale entries fetch one at a time, not in parallel', async () => {
    let inFlight = 0, maxInFlight = 0;
    const resolvers = [];
    const load = vi.fn(() => new Promise((resolve) => {
      inFlight += 1; maxInFlight = Math.max(maxInFlight, inFlight);
      resolvers.push(() => { inFlight -= 1; resolve({ nowTemp: 20, conditionKey: 'clear' }); });
    }));
    const entries = Array.from({ length: 5 }, (_, i) => place({ lat: -33 - i, metaAt: NOW - 60 * MIN }));
    const h = harness({ entries, load });
    h.render();
    h.render(); // a re-render while the queue runs must not queue the same rows twice
    for (let i = 0; i < 5; i++) {
      await flush();
      expect(load).toHaveBeenCalledTimes(i + 1);
      expect(inFlight).toBe(1);
      resolvers[i]();
    }
    await flush();
    expect(load).toHaveBeenCalledTimes(5);
    expect(maxInFlight).toBe(1);
    expect(h.store.every((e) => e.metaAt === NOW)).toBe(true);
  });

  it('nothing is fetched while the Search screen is not showing, and a hidden list drops its queue', async () => {
    const load = vi.fn(async () => ({ nowTemp: 20, conditionKey: 'clear' }));
    const h = harness({ entries: [place({ metaAt: NOW - 60 * MIN })], load, visible: false });
    h.render();
    await flush();
    expect(load).not.toHaveBeenCalled();
    expect(h.pending.size).toBe(0);

    let release;
    const slow = vi.fn(() => new Promise((r) => { release = () => r({ nowTemp: 20, conditionKey: 'clear' }); }));
    const h2 = harness({ entries: [place({ lat: -1, metaAt: NOW - 60 * MIN }), place({ lat: -2, metaAt: NOW - 60 * MIN })], load: slow });
    h2.render();
    await flush();
    expect(slow).toHaveBeenCalledTimes(1);
    h2.state.visible = false;
    release();
    await flush();
    expect(slow).toHaveBeenCalledTimes(1);
    expect(h2.pending.size).toBe(0);
  });
});

describe('app.js wiring', () => {
  const src = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
  it('ensureFavoriteMeta checks age (no early return on tempC + conditionKey alone)', () => {
    expect(src).not.toMatch(/\(isNum\(place\.tempC\) && place\.conditionKey\)\) return/);
    expect(src).toMatch(/!isStale\(place, Date\.now\(\)\)/);
  });
  it('the refresh writes metaAt and goes through fetchProbable', () => {
    expect(src).toMatch(/load: async \(place\) => normalizePayload\(await fetchProbable\(place\)\)/);
    expect(src).toMatch(/metaAt: Date\.now\(\)/);
  });
  it('the row renders through savedReadingView with the misc.agoMins / misc.agoHours keys', () => {
    expect(src).toMatch(/savedReadingView\(p, now\)/);
    expect(src).toMatch(/t\('misc', 'agoMins'\)/);
    expect(src).toMatch(/t\('misc', 'agoHours'\)/);
  });
});

// Sol's second review of the launch run (2 Oct 2026).
describe('Sol, 2 Oct 2026: expiry while Search stays open, a clock that moved back, a throwing onError', async () => {
  const mod = await import('../assets/saved-place-meta.js');
  const { nextExpiryMs, isStale, savedReadingView, createSavedMetaRefresher, SAVED_META_MAX_AGE_MS } = mod;
  const now = 1_700_000_000_000;
  it('nextExpiryMs: the soonest fresh reading sets the re-render; none fresh → null', () => {
    const list = [{ metaAt: now - 29 * 60000 }, { metaAt: now - 5 * 60000 }, { metaAt: now - 40 * 60000 }];
    expect(nextExpiryMs(list, now)).toBe(60000);
    expect(nextExpiryMs([{ metaAt: now - 40 * 60000 }], now)).toBeNull();
    expect(nextExpiryMs([], now)).toBeNull();
  });
  it('a metaAt in the future is stale and shows no number', () => {
    const e = { tempC: 15, conditionKey: 'clear', metaAt: now + 60000 };
    expect(isStale(e, now)).toBe(true);
    expect(savedReadingView(e, now)).toEqual({ tempC: null, ageMs: null });
    expect(nextExpiryMs([e], now)).toBeNull();
  });
  it('a throwing onError does not strand the rows still queued', async () => {
    const pending = new Set(); const seen = [];
    const enqueue = createSavedMetaRefresher({
      pending, isVisible: () => true,
      load: async (p) => { if (p.id === 1) throw new Error('boom'); return { nowTemp: 20 }; },
      onResult: (p) => seen.push(p.id), onError: () => { throw new Error('onError itself throws'); },
    });
    enqueue('a', { id: 1 }); enqueue('b', { id: 2 });
    await new Promise((r) => setTimeout(r, 10));
    expect(seen).toEqual([2]);
    expect(pending.size).toBe(0);
  });
  it('app.js re-renders the saved list at the freshest reading\'s expiry and clears the note on a pinned pick', () => {
    const src = readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');
    expect(src).toMatch(/nextExpiryMs\(list, now\)/);
    expect(src).toMatch(/favExpiryTimer = setTimeout/);
    expect(SAVED_META_MAX_AGE_MS).toBe(30 * 60 * 1000);
  });
});
