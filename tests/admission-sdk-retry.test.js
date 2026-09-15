// Prelaunch item 1, round 11: exercise the INSTALLED @upstash/redis client and
// its own retry path, not a hand-rolled stand-in for it.
//
// The earlier replay test called the fake EVAL twice by hand. That proves the
// Lua is replay-safe but says nothing about the client: it is the SDK that
// decides to retry a command whose reply was lost, and it is that retry —
// arriving after the command already applied — which double-charged. Here the
// real client posts to a mocked transport that applies every command it
// receives to an in-memory store (through the production Lua, under fengari)
// and can drop a reply, delay a command, or reorder two of them.
//
// Wire format, verified against the installed client rather than assumed:
//   POST <url>/pipeline   body [["eval", <script>, <numkeys>, ...keys, ...args]]
//   reply [{ "result": <value> }]

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Redis } from '@upstash/redis';

import {
  WEATHER_ADMISSION,
  chargeAdmission,
  refundAdmission,
  tokenKeyFor,
} from '../api/_lib/admission.js';
import { runRedisLua } from './helpers/run-admission-script.js';

const IP = '41.13.7.99';
const INSTALL = 'f7c1a2b4-9d3e-4a51-8c60-2b7e11d4a903';
const ME = { ip: IP, installId: INSTALL };
const NOW = Date.UTC(2026, 4, 19, 8, 30, 0);

let store;
let ttls;
let applied;       // every command the transport actually executed
let dropReplies;   // how many replies to swallow AFTER applying them (any command)
let dropAdmissionReplies; // ...targeted at the ADMISSION command only
let gate;          // when set, ADMISSION_SCRIPT waits on it before executing
let onAdmissionEnter; // resolved the moment an admission command reaches transport

// ADMISSION_SCRIPT is the one with the rollback loop; REVERT_SCRIPT is not.
const isAdmission = (cmd) => String(cmd[1]).includes('local undo');
const execute = (cmd) => {
  const [name, script, numkeys, ...rest] = cmd;
  if (String(name).toLowerCase() !== 'eval') throw new Error(`unexpected command ${name}`);
  const keys = rest.slice(0, numkeys);
  const args = rest.slice(numkeys);
  applied.push(String(script));
  return runRedisLua(script, keys, args, store, ttls);
};

// enableAutoPipelining is ON by default and merges CONCURRENT commands into a
// single HTTP request — verified against the installed client. That is fine in
// production, but here it would put a held charge and its compensation in the
// same request, so gating one would deadlock the other. One command per
// request keeps the ordering under the test's control.
const makeRedis = () => new Redis({ url: 'https://stub.upstash.io', token: 'stub', enableAutoPipelining: false });

beforeEach(() => {
  store = new Map();
  ttls = new Map();
  applied = [];
  dropReplies = 0;
  dropAdmissionReplies = 0;
  gate = null;
  onAdmissionEnter = null;
  vi.stubGlobal('fetch', async (url, opts) => {
    // The client speaks TWO shapes, verified against the installed version:
    // batched `[[cmd…], [cmd…]]` to /pipeline when auto-pipelining is on, and
    // a bare `[cmd…]` otherwise. Handle both rather than assume one.
    const parsed = JSON.parse(opts.body);
    const batched = Array.isArray(parsed[0]);
    const commands = batched ? parsed : [parsed];
    // A command can be held mid-flight, which is how "cancelled before it
    // executed" is reproduced faithfully rather than asserted.
    if (commands.some(isAdmission) && onAdmissionEnter) onAdmissionEnter();
    if (gate && commands.some(isAdmission)) await gate;
    const results = commands.map(c => ({ result: execute(c) }));
    // Reply loss is TARGETED: "the admission reply was lost" and "the
    // cancellation reply was lost" are different orderings and must be tested
    // separately (round 12, minor 3 — the old T4 dropped the cancellation's
    // reply and so never retried admission at all).
    if (dropAdmissionReplies > 0 && commands.some(isAdmission)) {
      dropAdmissionReplies -= 1;
      throw new Error('network: admission reply lost');
    }
    if (dropReplies > 0) {
      dropReplies -= 1;
      // Applied, then the connection dies. The SDK will retry this command.
      throw new Error('network: reply lost');
    }
    return {
      ok: true,
      status: 200,
      headers: new Map([['upstash-sync-token', 'x']]),
      text: async () => JSON.stringify(batched ? results : results[0]),
    };
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const counterKeys = () => [...store.keys()].filter(k => k.startsWith('pw-adm:') && !k.startsWith('pw-adm:tok:'));
const counterTotal = () => counterKeys().reduce((n, k) => n + (Number(store.get(k)) || 0), 0);

describe('the installed Upstash client, retried for real', () => {
  it('T1 an SDK retry after an applied-but-lost reply bills exactly once', async () => {
    const redis = makeRedis();
    dropReplies = 1; // first attempt applies, then its reply is lost

    const outcome = await chargeAdmission(WEATHER_ADMISSION, ME, redis, NOW, { token: 'sdk-1' });

    // The client retried; the token made the retry a no-op.
    expect(applied.length).toBeGreaterThanOrEqual(2); // applied more than once...
    expect(outcome.allowed).toBe(true);
    expect(outcome.billed).toBe(true);
    expect(counterKeys()).toHaveLength(4);
    for (const k of counterKeys()) expect(Number(store.get(k))).toBe(1); // ...charged once
  });

  it('T2 every retry of a REFUSED charge stays refused and moves nothing', async () => {
    const redis = makeRedis();
    // Fill the per-install minute bucket so the charge must be refused.
    await chargeAdmission(WEATHER_ADMISSION, ME, redis, NOW, { token: 'warm' });
    const before = counterTotal();
    const minuteKey = counterKeys().find(k => k.includes('weatherMinuteInstall'));
    store.set(minuteKey, 30); // at its ceiling

    dropReplies = 1;
    const outcome = await chargeAdmission(WEATHER_ADMISSION, ME, redis, NOW, { token: 'sdk-2' });

    expect(outcome.allowed).toBe(false);
    expect(outcome.billed).toBe(false);
    // Rolled back inside the script, and every retry replayed the refusal
    // rather than re-running it: the ceiling key is exactly where we set it.
    expect(Number(store.get(minuteKey))).toBe(30);
    // And no other bucket drifted: the three non-ceiling counters still carry
    // only the one charge the warm-up made.
    for (const k of counterKeys()) {
      if (k !== minuteKey) expect(Number(store.get(k))).toBe(1);
    }
    expect(before).toBe(4);
  });

  it('T3 CANCELLED BEFORE IT EXECUTED: the delayed charge finds a tombstone and bills nothing', async () => {
    // Round 11, major 1, reproduced end to end. The charge is held in flight;
    // its compensation runs first and finds no token. Without a tombstone the
    // charge later executed and kept all four counters.
    const redis = makeRedis();
    let release;
    gate = new Promise((resolve) => { release = resolve; });

    const charging = chargeAdmission(WEATHER_ADMISSION, ME, redis, NOW, { token: 'late' });
    // The caller gave up and compensated while the charge is still queued.
    const refunded = await refundAdmission('late', redis, { schedule: (p) => p });
    expect(refunded).toBe(0);                                   // nothing to give back yet
    expect(store.get(tokenKeyFor('late'))).toBe('c');           // ...so it left a tombstone

    // Now the original command finally reaches Redis.
    release();
    const outcome = await charging;

    expect(outcome.allowed).toBe(false);
    expect(outcome.billed).toBe(false);
    // The ORIGINAL counter keys never moved — asserted after every outstanding
    // command has settled.
    expect(counterTotal()).toBe(0);
  });

  it('T4 the CANCELLATION reply is lost: the tombstone still lands and nothing bills', async () => {
    // Ordering here is cancel → lost reply → cancel(retry) → charge. Admission
    // itself is never retried; this is the cancellation-side loss.
    const redis = makeRedis();
    let release;
    gate = new Promise((resolve) => { release = resolve; });
    dropReplies = 1;

    const charging = chargeAdmission(WEATHER_ADMISSION, ME, redis, NOW, { token: 'late-2' });
    await refundAdmission('late-2', redis, { schedule: (p) => p });
    release();
    const outcome = await charging;

    expect(outcome.allowed).toBe(false);
    expect(counterTotal()).toBe(0);
    expect(store.get(tokenKeyFor('late-2'))).toBe('c');
  });

  it('T5 the ADMISSION reply is lost while it is held: it retries, executes twice, bills nothing', async () => {
    // Round 12, minor 3. Drop the reply of the ADMISSION command specifically,
    // so the SDK's retry of ADMISSION is what races the cancellation. The
    // command therefore reaches Redis twice; the tombstone must make both
    // executions no-ops.
    const redis = makeRedis();
    let release;
    gate = new Promise((resolve) => { release = resolve; });
    dropAdmissionReplies = 1;

    const charging = chargeAdmission(WEATHER_ADMISSION, ME, redis, NOW, { token: 'late-3' });
    // Cancel while the admission command is still held.
    await refundAdmission('late-3', redis, { schedule: (p) => p });
    expect(store.get(tokenKeyFor('late-3'))).toBe('c');

    release();
    const outcome = await charging;

    // The SDK retried admission after its reply was lost: it reached the store
    // twice, and both times found the tombstone.
    const admissionExecutions = applied.filter(script => script.includes('local undo')).length;
    expect(admissionExecutions).toBe(2);
    expect(outcome.allowed).toBe(false);
    expect(outcome.billed).toBe(false);
    expect(counterTotal()).toBe(0);
    expect(store.get(tokenKeyFor('late-3'))).toBe('c');
  });

  it('T6 the same cancellation race with DEFAULT auto-pipelining on', async () => {
    // Round 13, minor 3: a true repeat of T5 against the SHIPPED client
    // configuration. Auto-pipelining batches concurrent commands, so the
    // cancellation is issued on its OWN client — that is what a real second
    // invocation would do — while the admission command is held in transport.
    const redis = new Redis({ url: 'https://stub.upstash.io', token: 'stub' });
    const canceller = new Redis({ url: 'https://stub.upstash.io', token: 'stub' });
    let release;
    let admissionEnteredTransport;
    const entered = new Promise((resolve) => { admissionEnteredTransport = resolve; });
    gate = new Promise((resolve) => { release = resolve; });
    onAdmissionEnter = admissionEnteredTransport;
    dropAdmissionReplies = 1;

    const charging = chargeAdmission(WEATHER_ADMISSION, ME, redis, NOW, { token: 'pipe-1' });
    // Wait until admission is genuinely IN transport before cancelling, rather
    // than assuming the ordering.
    await entered;
    await refundAdmission('pipe-1', canceller, { schedule: (p) => p });
    expect(store.get(tokenKeyFor('pipe-1'))).toBe('c');

    release();
    const outcome = await charging;

    // Original attempt + the SDK's retry after the lost reply.
    expect(applied.filter(script => script.includes('local undo')).length).toBe(2);
    expect(outcome.allowed).toBe(false);
    expect(outcome.billed).toBe(false);
    expect(counterTotal()).toBe(0);
  });
});
