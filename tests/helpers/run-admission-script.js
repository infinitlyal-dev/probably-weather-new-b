// Executes api/_lib/admission.js's ADMISSION_SCRIPT — the REAL Lua source,
// verbatim — against an in-memory store, using fengari (a Lua 5.3 VM in pure
// JS, dev dependency only).
//
// Why this exists: the admission tests used a JS double that re-implemented the
// script's roll-back. That double could agree with itself forever while the
// production Lua was wrong, so the one piece of logic the whole item rests on —
// "a refused charge spends nothing" — was the one piece nothing executed.
// Everything here runs the shipped string.
//
// Only the three commands the script issues are implemented: INCR, DECR and
// EXPIRE. Anything else throws, so a command added to the script without a
// matching test binding fails loudly instead of silently returning nil.

import { lua, lauxlib, lualib, to_luastring, to_jsstring } from 'fengari';

import { ADMISSION_SCRIPT } from '../../api/_lib/admission.js';

/**
 * @param {string[]} keys   KEYS for the script
 * @param {string[]} argv   ARGV for the script
 * @param {Map<string, number>} store  counter store, mutated in place
 * @param {Map<string, number>} [ttls] EXPIRE calls recorded here (key → ttl)
 * @returns {number} the script's integer return (1 admitted, 0 refused)
 */
export function runAdmissionScript(keys, argv, store, ttls = new Map()) {
  return runRedisLua(ADMISSION_SCRIPT, keys, argv, store, ttls);
}

/**
 * Execute ANY of admission.js's Lua sources. Callers that stand in for Redis
 * must dispatch on the script they were handed — a double that assumes every
 * EVAL is the admission script will silently run a charge where a revert was
 * asked for, which is exactly the bug this signature exists to prevent.
 */
export function runRedisLua(source, keys, argv, store, ttls = new Map()) {
  const L = lauxlib.luaL_newstate();
  lualib.luaL_openlibs(L);

  // redis = { call = <js function> }
  lua.lua_newtable(L);
  lua.lua_pushjsfunction(L, (state) => {
    const argc = lua.lua_gettop(state);
    const cmd = to_jsstring(lua.lua_tolstring(state, 1)).toLowerCase();
    const key = argc >= 2 ? to_jsstring(lua.lua_tolstring(state, 2)) : null;
    if (cmd === 'incr') {
      const next = (store.get(key) || 0) + 1;
      store.set(key, next);
      lua.lua_pushinteger(state, next);
      return 1;
    }
    if (cmd === 'set') {
      // SET key value [EX seconds]. The TTL is recorded so the token scripts'
      // EX/TTL handling is exercised rather than assumed.
      const value = to_jsstring(lua.lua_tolstring(state, 3));
      store.set(key, value);
      if (argc >= 5 && to_jsstring(lua.lua_tolstring(state, 4)).toLowerCase() === 'ex') {
        ttls.set(key, Number(to_jsstring(lua.lua_tolstring(state, 5))));
      }
      lua.lua_pushstring(state, to_luastring('OK'));
      return 1;
    }
    if (cmd === 'del') {
      // Used by weather-cache.js's RELEASE_LOCK_SCRIPT, so the real lock
      // helpers can run against this same store.
      const existed = store.delete(key);
      ttls.delete(key);
      lua.lua_pushinteger(state, existed ? 1 : 0);
      return 1;
    }
    if (cmd === 'ttl') {
      lua.lua_pushinteger(state, ttls.has(key) ? ttls.get(key) : -1);
      return 1;
    }
    if (cmd === 'get') {
      // Redis GET returns a bulk string or nil — never a number. Returning a
      // number here would let a script that does `tonumber(get(...))` pass
      // against the double while failing against Redis.
      const raw = store.has(key) ? String(store.get(key)) : null;
      if (raw === null) lua.lua_pushnil(state);
      else lua.lua_pushstring(state, to_luastring(raw));
      return 1;
    }
    if (cmd === 'decr') {
      const next = (store.get(key) || 0) - 1;
      store.set(key, next);
      lua.lua_pushinteger(state, next);
      return 1;
    }
    if (cmd === 'expire') {
      const ttl = Number(to_jsstring(lua.lua_tolstring(state, 3)));
      ttls.set(key, ttl);
      lua.lua_pushinteger(state, 1);
      return 1;
    }
    throw new Error(`ADMISSION_SCRIPT issued an unbound redis command: ${cmd}`);
  });
  lua.lua_setfield(L, -2, to_luastring('call'));
  lua.lua_setglobal(L, to_luastring('redis'));

  const pushStringArray = (values, globalName) => {
    lua.lua_createtable(L, values.length, 0);
    values.forEach((value, i) => {
      lua.lua_pushstring(L, to_luastring(String(value)));
      lua.lua_rawseti(L, -2, i + 1); // Lua tables are 1-based
    });
    lua.lua_setglobal(L, to_luastring(globalName));
  };
  pushStringArray(keys, 'KEYS');
  pushStringArray(argv, 'ARGV');

  // The script is a bare body (`for ... return 1`), which is a valid chunk.
  const status = lauxlib.luaL_dostring(L, to_luastring(source));
  if (status !== lua.LUA_OK) {
    throw new Error(`Lua script failed: ${to_jsstring(lua.lua_tolstring(L, -1))}`);
  }
  return lua.lua_tointeger(L, -1);
}
