// Import-form scanner for the build's client-side guard (G5).
//
// Detects whether a JS source references a given module specifier in ANY
// import/export form — including the bare side-effect import the old regex
// missed (`import './x.js'`). Statement forms are anchored at a statement
// boundary (start / ; / } / newline) so a passing mention in a comment or
// string can't false-positive, and so it works on source AND minified output.

/**
 * @param {string} src      JS source (formatted or minified)
 * @param {string} basename module file name, e.g. 'weather-copy.js'
 * @returns {boolean} true if src imports/re-exports/dynamically-imports it
 */
export function importsModule(src, basename) {
  const esc = basename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const spec = new RegExp(esc);
  if (!spec.test(src)) return false;
  // import X from '…/basename'   import {x} from …   import * as X from …
  // import '…/basename'          export {x} from …   export * from …
  const statement = new RegExp(
    `(?:^|[;\\n}])\\s*(?:import|export)\\b[^;\\n]*?['"][^'"]*${esc}['"]`, 'm',
  );
  // import('…/basename') — can appear mid-expression, not at a statement start.
  const dynamic = new RegExp(`\\bimport\\s*\\(\\s*['"][^'"]*${esc}['"]`);
  return statement.test(src) || dynamic.test(src);
}
