import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

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

    let responsePromise;
    context.listeners.fetch({
      request,
      respondWith(promise) { responsePromise = promise; },
    });
    const response = await responsePromise;

    expect(response.status).toBe(200);
    expect(response.headers.get('sw-offline')).toBe('true');
    expect(Number(response.headers.get('sw-cache-age-ms'))).toBeGreaterThanOrEqual(30_000);
    await expect(response.json()).resolves.toEqual({ ok: true, source: 'cache' });
  });
});
