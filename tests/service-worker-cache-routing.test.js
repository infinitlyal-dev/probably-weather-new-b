import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const loadServiceWorkerContext = () => {
  const code = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const context = {
    self: {
      addEventListener() {},
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
  return context;
};

describe('service worker cache routing', () => {
  it('treats app code as core assets but excludes background images', () => {
    const context = loadServiceWorkerContext();

    expect(context.isCoreAsset(new URL('https://probablyweather.co.za/assets/app.js'))).toBe(true);
    expect(context.isCoreAsset(new URL('https://probablyweather.co.za/assets/startup-location.js'))).toBe(true);
    expect(context.isCoreAsset(new URL('https://probablyweather.co.za/assets/images/bg/clear/day_5.jpg'))).toBe(false);
  });
});
