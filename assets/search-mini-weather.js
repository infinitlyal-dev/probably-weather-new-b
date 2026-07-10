export const SEARCH_MINI_VISIBLE_LIMIT = 3;

export function createSearchMiniPromiseCache(maxEntries = 120) {
  const cache = new Map();

  return function getOrLoad(lat, lon, load) {
    const key = `${Number(lat).toFixed(2)},${Number(lon).toFixed(2)}`;
    if (cache.has(key)) return cache.get(key);
    if (cache.size >= maxEntries) cache.delete(cache.keys().next().value);

    let pending;
    try {
      pending = Promise.resolve(load());
    } catch (error) {
      pending = Promise.reject(error);
    }
    cache.set(key, pending);
    pending.catch(() => {
      if (cache.get(key) === pending) cache.delete(key);
    });
    return pending;
  };
}
