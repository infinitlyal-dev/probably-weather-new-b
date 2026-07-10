import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const loadServiceWorkerContext = () => {
  const code = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const listeners = {};
  const context = {
    self: {
      addEventListener(type, handler) { listeners[type] = handler; },
      skipWaiting() {},
      clients: { claim() {} },
      location: { origin: 'https://probablyweather.co.za' },
    },
    caches: {},
    URL,
    Headers,
    Response,
    fetch() {},
    Promise,
    Date,
    console,
  };
  vm.createContext(context);
  vm.runInContext(code, context);
  context.listeners = listeners;
  return context;
};

const dispatchFetch = (context, request) => {
  let responsePromise;
  const lifetimePromises = [];
  context.listeners.fetch({
    request,
    respondWith(promise) { responsePromise = promise; },
    waitUntil(promise) { lifetimePromises.push(promise); },
  });
  return { responsePromise, lifetimePromises };
};

describe('service worker cache routing', () => {
  it('treats app code as core assets but excludes background images', () => {
    const context = loadServiceWorkerContext();

    expect(context.isCoreAsset(new URL('https://probablyweather.co.za/assets/app.js'))).toBe(true);
    expect(context.isCoreAsset(new URL('https://probablyweather.co.za/assets/startup-location.js'))).toBe(true);
    expect(context.isCoreAsset(new URL('https://probablyweather.co.za/assets/images/bg/clear/day_5.jpg'))).toBe(false);
  });

  it('B1 serves a fresh cached forecast when the network responds 503', async () => {
    const context = loadServiceWorkerContext();
    const request = new Request('https://probablyweather.co.za/api/weather?lat=-34.1&lon=18.8');
    const cachedAt = Date.now() - 30_000;
    const cached = new Response(JSON.stringify({ ok: true, source: 'cache' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'sw-cached-at': String(cachedAt) },
    });
    context.fetch = async () => new Response(JSON.stringify({ ok: false }), { status: 503 });
    context.caches.open = async () => ({
      match: async () => cached,
      put: async () => {},
    });

    const { responsePromise } = dispatchFetch(context, request);
    const response = await responsePromise;

    expect(response.status).toBe(200);
    expect(response.headers.get('sw-offline')).toBe('true');
    expect(Number(response.headers.get('sw-cache-age-ms'))).toBeGreaterThanOrEqual(30_000);
    await expect(response.json()).resolves.toEqual({ ok: true, source: 'cache' });
  });

  it('P7 deletes an expired forecast entry before returning the offline error', async () => {
    const context = loadServiceWorkerContext();
    const request = new Request('https://probablyweather.co.za/api/weather?lat=-34.1&lon=18.8');
    const cached = new Response(JSON.stringify({ ok: true }), {
      headers: { 'sw-cached-at': String(Date.now() - 4 * 60 * 60 * 1000) },
    });
    const deleteEntry = vi.fn(async () => true);
    context.fetch = async () => { throw new Error('offline'); };
    context.caches.open = async () => ({
      match: async () => cached,
      delete: deleteEntry,
    });

    const { responsePromise } = dispatchFetch(context, request);
    const response = await responsePromise;

    expect(response.status).toBe(503);
    expect(deleteEntry).toHaveBeenCalledWith(request);
  });

  it('P7 trims the forecast cache to its explicit cap after a successful write', async () => {
    const context = loadServiceWorkerContext();
    const request = new Request('https://probablyweather.co.za/api/weather?lat=-34.1&lon=18.8');
    const keys = Array.from({ length: 63 }, (_, i) => new Request(`https://probablyweather.co.za/api/weather?lat=${i}&lon=18`));
    const deleteEntry = vi.fn(async () => true);
    let releaseWrite;
    const writeBarrier = new Promise((resolve) => { releaseWrite = resolve; });
    const cache = {
      match: async () => null,
      put: vi.fn(() => writeBarrier),
      keys: vi.fn(async () => keys),
      delete: deleteEntry,
    };
    context.caches.open = async () => cache;
    context.fetch = async () => new Response(JSON.stringify({ ok: true }), { status: 200 });

    const { responsePromise, lifetimePromises } = dispatchFetch(context, request);
    expect((await responsePromise).status).toBe(200);
    expect(lifetimePromises).toHaveLength(1);
    let lifetimeSettled = false;
    lifetimePromises[0].then(() => { lifetimeSettled = true; });
    await Promise.resolve();
    expect(lifetimeSettled).toBe(false);
    releaseWrite();
    await Promise.all(lifetimePromises);

    expect(deleteEntry).toHaveBeenCalledTimes(3);
  });

  it('P7 trims only the OG subspace without evicting background images', async () => {
    const context = loadServiceWorkerContext();
    const request = new Request('https://probablyweather.co.za/api/og?lang=en&c=clear');
    const backgrounds = Array.from({ length: 40 }, (_, i) => new Request(`https://probablyweather.co.za/assets/images/bg/clear/week_1/day/${i}.webp`));
    const ogEntries = Array.from({ length: 35 }, (_, i) => new Request(`https://probablyweather.co.za/api/og?lang=en&c=clear&variant=${i}`));
    const deleteEntry = vi.fn(async () => true);
    let releaseWrite;
    const writeBarrier = new Promise((resolve) => { releaseWrite = resolve; });
    const cache = {
      match: async () => new Response('cached-jpeg', { status: 200 }),
      put: vi.fn(() => writeBarrier),
      keys: vi.fn(async () => [...backgrounds, ...ogEntries]),
      delete: deleteEntry,
    };
    context.caches.open = async () => cache;
    context.fetch = async () => new Response('jpeg', { status: 200 });

    const { responsePromise, lifetimePromises } = dispatchFetch(context, request);
    await expect((await responsePromise).text()).resolves.toBe('cached-jpeg');
    expect(lifetimePromises).toHaveLength(1);
    let lifetimeSettled = false;
    lifetimePromises[0].then(() => { lifetimeSettled = true; });
    await Promise.resolve();
    expect(lifetimeSettled).toBe(false);
    releaseWrite();
    await Promise.all(lifetimePromises);

    expect(deleteEntry).toHaveBeenCalledTimes(3);
    expect(deleteEntry.mock.calls.every(([key]) => new URL(key.url).pathname === '/api/og')).toBe(true);
  });

  it('P7 finishes a background image write before trimming its bounded subspace', async () => {
    const context = loadServiceWorkerContext();
    const request = new Request('https://probablyweather.co.za/assets/images/bg/clear/week_1/day/1.webp');
    const backgrounds = Array.from({ length: 121 }, (_, i) => new Request(`https://probablyweather.co.za/assets/images/bg/clear/week_1/day/${i}.webp`));
    const ogEntries = Array.from({ length: 5 }, (_, i) => new Request(`https://probablyweather.co.za/api/og?lang=en&c=clear&variant=${i}`));
    const deleteEntry = vi.fn(async () => true);
    let releaseWrite;
    const writeBarrier = new Promise((resolve) => { releaseWrite = resolve; });
    const cache = {
      match: async () => new Response('cached-webp', { status: 200 }),
      put: vi.fn(() => writeBarrier),
      keys: vi.fn(async () => [...backgrounds, ...ogEntries]),
      delete: deleteEntry,
    };
    context.caches.open = async () => cache;
    context.fetch = async () => new Response('fresh-webp', { status: 200 });

    const { responsePromise, lifetimePromises } = dispatchFetch(context, request);
    await expect((await responsePromise).text()).resolves.toBe('cached-webp');
    expect(lifetimePromises).toHaveLength(1);
    expect(cache.keys).not.toHaveBeenCalled();
    releaseWrite();
    await Promise.all(lifetimePromises);

    expect(cache.keys).toHaveBeenCalledTimes(1);
    expect(deleteEntry).toHaveBeenCalledTimes(1);
    expect(new URL(deleteEntry.mock.calls[0][0].url).pathname).not.toBe('/api/og');
  });
});
