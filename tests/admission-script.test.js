// Prelaunch item 1: run the PRODUCTION Lua, not a JS re-implementation of it.
//
// The admission tests once drove a JS double that re-implemented the script's
// roll-back. A double that mirrors the thing it is checking can agree with
// itself forever while the shipped script is wrong — and "a refused charge
// spends nothing", plus round 10's "a replayed charge spends nothing twice and
// a refund can only give back its own charge", are the properties this whole
// item rests on. These tests execute the exported strings verbatim in a Lua 5.3
// VM (fengari), with redis.call bound to an in-memory store.

import { describe, expect, it } from 'vitest';

import {
  ADMISSION_SCRIPT,
  REVERT_SCRIPT,
  TOKEN_TTL_SECONDS,
  admissionKeys,
  tokenKeyFor,
} from '../api/_lib/admission.js';
import { runRedisLua } from './helpers/run-admission-script.js';

const TOKEN = 'tok-1';
const tk = (t = TOKEN) => tokenKeyFor(t);

// KEYS = [tokenKey, ...counters]; ARGV = [tokenTtl, (ceiling, ttl) per counter]
const charge = (counters, specs, store, ttls, token = TOKEN) => runRedisLua(
  ADMISSION_SCRIPT,
  [tk(token), ...counters],
  [String(TOKEN_TTL_SECONDS), ...specs.flatMap(([c, t]) => [String(c), String(t)])],
  store,
  ttls,
);
const refund = (store, ttls, token = TOKEN) => runRedisLua(REVERT_SCRIPT, [tk(token)], [String(TOKEN_TTL_SECONDS)], store, ttls);

const FOUR = [[30, 90], [300, 90000], [6000, 90], [20000, 90000]];

describe('ADMISSION_SCRIPT — the real Lua, executed', () => {
  it('L1 admits when every bucket is under its ceiling, incrementing each exactly once', () => {
    const store = new Map();
    const ttls = new Map();

    expect(charge(['a', 'b', 'c', 'd'], FOUR, store, ttls)).toBe(1);

    for (const k of ['a', 'b', 'c', 'd']) expect(store.get(k)).toBe(1);
    // The token records the outcome AND the keys, so a refund can own them.
    expect(store.get(tk())).toBe('1:a\nb\nc\nd');
    expect(ttls.get(tk())).toBe(TOKEN_TTL_SECONDS);
  });

  it('L2 a breach on the LAST bucket undoes every earlier increment', () => {
    const store = new Map([['a', 5], ['b', 5], ['c', 5], ['d', 20000]]);

    expect(charge(['a', 'b', 'c', 'd'], FOUR, store, new Map())).toBe(0);

    expect(store.get('a')).toBe(5);
    expect(store.get('b')).toBe(5);
    expect(store.get('c')).toBe(5);
    expect(store.get('d')).toBe(20000);
    expect(store.get(tk())).toBe('0'); // refusal is recorded too
  });

  it('L3 a breach on the FIRST bucket leaves nothing behind either', () => {
    const store = new Map([['a', 30]]);

    expect(charge(['a', 'b'], [[30, 90], [300, 90000]], store, new Map())).toBe(0);

    expect(store.get('a')).toBe(30);
    expect(store.get('b') ?? 0).toBe(0);
  });

  it('L4 EXPIRE is set on the FIRST increment only', () => {
    const store = new Map();
    const ttls = new Map();

    charge(['a'], [[30, 90]], store, ttls, 'tok-A');
    expect(ttls.get('a')).toBe(90);

    ttls.delete('a');
    charge(['a'], [[30, 90]], store, ttls, 'tok-B');
    expect(store.get('a')).toBe(2);
    expect(ttls.has('a')).toBe(false); // second must not re-stamp it
  });

  it('L5 the ceiling is inclusive: the Nth call is admitted, the N+1th is not', () => {
    const store = new Map([['a', 29]]);

    expect(charge(['a'], [[30, 90]], store, new Map(), 'tok-A')).toBe(1);
    expect(store.get('a')).toBe(30);

    expect(charge(['a'], [[30, 90]], store, new Map(), 'tok-B')).toBe(0);
    expect(store.get('a')).toBe(30); // refused, and rolled back
  });

  it('L6 a rolled-back breach is repeatable — it does not drift the counters', () => {
    const store = new Map([['a', 1], ['b', 300]]);
    for (let i = 0; i < 25; i++) {
      expect(charge(['a', 'b'], [[30, 90], [300, 90000]], store, new Map(), `tok-${i}`)).toBe(0);
    }
    expect(store.get('a')).toBe(1);
    expect(store.get('b')).toBe(300);
  });

  it('L7 the scripts only use redis commands the binding implements', () => {
    const used = (src) => [...src.matchAll(/redis\.call\('(\w+)'/g)].map(m => m[1]);
    expect(new Set(used(ADMISSION_SCRIPT))).toEqual(new Set(['get', 'incr', 'expire', 'decr', 'set']));
    expect(new Set(used(REVERT_SCRIPT))).toEqual(new Set(['get', 'decr', 'ttl', 'set']));
  });

  it('L8 it is wired to the real key layout: token key plus four counters', () => {
    const entries = admissionKeys(
      ['weatherMinuteInstall', 'weatherDailyInstall', 'weatherMinuteIp', 'weatherDailyIp'],
      { ip: '41.13.7.99', installId: 'abcdefgh' },
    );
    const store = new Map();
    const ttls = new Map();

    expect(charge(entries.map(e => e.key), entries.map(e => [e.ceiling, e.ttl]), store, ttls)).toBe(1);

    for (const e of entries) expect(store.get(e.key)).toBe(1);
    expect(ttls.get(entries[0].key)).toBe(90);      // minute bucket
    expect(ttls.get(entries[1].key)).toBe(90000);   // day bucket
  });
});

describe('the token makes admission and refund EXACTLY ONCE (round 10)', () => {
  it('L9 an SDK REPLAY of the same charge touches no counter and returns the recorded outcome', () => {
    const store = new Map();
    const ttls = new Map();

    expect(charge(['a', 'b'], [[30, 90], [300, 90000]], store, ttls)).toBe(1);
    expect(store.get('a')).toBe(1);

    // The Upstash client retries a request whose reply was lost. Same token,
    // so the script must replay the ANSWER, not the effect.
    expect(charge(['a', 'b'], [[30, 90], [300, 90000]], store, ttls)).toBe(1);
    expect(charge(['a', 'b'], [[30, 90], [300, 90000]], store, ttls)).toBe(1);
    expect(store.get('a')).toBe(1); // charged exactly once
    expect(store.get('b')).toBe(1);
  });

  it('L10 a replayed REFUSAL also stays refused, without touching counters', () => {
    const store = new Map([['a', 30]]);
    expect(charge(['a'], [[30, 90]], store, new Map())).toBe(0);
    expect(charge(['a'], [[30, 90]], store, new Map())).toBe(0);
    expect(store.get('a')).toBe(30);
  });

  it('L11 a refund gives back exactly its own charge, once', () => {
    const store = new Map();
    const ttls = new Map();
    charge(['a', 'b'], [[30, 90], [300, 90000]], store, ttls);

    expect(refund(store, ttls)).toBe(2);
    expect(store.get('a')).toBe(0);
    expect(store.get('b')).toBe(0);

    // A second refund is a no-op — this is what stops a retry subtracting
    // somebody else's charge.
    expect(refund(store, ttls)).toBe(0);
    expect(store.get('a')).toBe(0);
  });

  it('L12 a refund NEVER subtracts another request’s charge', () => {
    const store = new Map();
    const ttls = new Map();
    // Ours, then 40 other requests on the same counters.
    charge(['a'], [[300, 90]], store, ttls, 'mine');
    for (let i = 0; i < 40; i++) charge(['a'], [[300, 90]], store, ttls, `other-${i}`);
    expect(store.get('a')).toBe(41);

    // Refund ours repeatedly: exactly one decrement, ever.
    expect(refund(store, ttls, 'mine')).toBe(1);
    expect(refund(store, ttls, 'mine')).toBe(0);
    expect(refund(store, ttls, 'mine')).toBe(0);
    expect(store.get('a')).toBe(40); // the other 40 are untouched
  });

  it('L13 refunding a charge that never applied subtracts nothing from a populated counter', () => {
    // The lost-reply case where the EVAL did NOT land: the token is absent, so
    // the refund must not guess, and must not raid a counter other requests
    // have legitimately filled.
    const store = new Map([['a', 17]]);
    expect(refund(store, new Map(), 'never-applied')).toBe(0);
    expect(store.get('a')).toBe(17);
  });

  it('L14 a refunded token cannot be re-admitted by a replay', () => {
    const store = new Map();
    const ttls = new Map();
    charge(['a'], [[30, 90]], store, ttls);
    refund(store, ttls);
    expect(store.get('a')).toBe(0);

    // A late SDK replay after the refund must not re-charge.
    expect(charge(['a'], [[30, 90]], store, ttls)).toBe(0);
    expect(store.get('a')).toBe(0);
  });

  it('L16 CANCEL BEFORE ADMIT: a refund with no token leaves a tombstone the late charge obeys', () => {
    // Round 11, major 1. The charge command is still in flight (an SDK retry
    // queued behind a lost reply), so the refund finds no token. It must not
    // shrug: it leaves 'c', and when the original command finally executes it
    // refuses without incrementing. Measured without the tombstone: the
    // delayed command landed at 13.50 s and kept all four charges.
    const store = new Map([['a', 7], ['b', 3]]);
    const ttls = new Map();

    // Cancellation arrives FIRST.
    expect(refund(store, ttls, 'late')).toBe(0);
    expect(store.get(tk('late'))).toBe('c');
    expect(ttls.get(tk('late'))).toBe(TOKEN_TTL_SECONDS);

    // ...and now the original charge finally reaches Redis.
    expect(charge(['a', 'b'], [[30, 90], [300, 90000]], store, ttls, 'late')).toBe(0);

    // Nothing was billed, and nobody else's counters moved.
    expect(store.get('a')).toBe(7);
    expect(store.get('b')).toBe(3);
  });

  it('L17 a tombstone is idempotent and never becomes an admission', () => {
    const store = new Map();
    const ttls = new Map();
    expect(refund(store, ttls, 'ghost')).toBe(0);
    expect(refund(store, ttls, 'ghost')).toBe(0); // still 0, still 'c'
    expect(store.get(tk('ghost'))).toBe('c');
    expect(charge(['a'], [[30, 90]], store, ttls, 'ghost')).toBe(0);
    expect(charge(['a'], [[30, 90]], store, ttls, 'ghost')).toBe(0);
    expect(store.get('a') ?? 0).toBe(0);
  });

  it('L15 the token outlives the longest counter window', () => {
    // Otherwise the record could expire while the counters it describes are
    // still live, and a refund would have nothing to own.
    expect(TOKEN_TTL_SECONDS).toBeGreaterThan(90000);
  });
});
