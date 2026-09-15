// The /share page's only script, kept BYTE-CONSTANT so one sha256 in the site
// Content-Security-Policy allows it (scripts/generate-csp.mjs hashes this exact
// string).
//
// It used to be `window.location.replace(<JSON of the per-request app URL>)` —
// a different script on every request, which no hash can allow, so the
// enforcing CSP (2026-09-15) would have blocked it. The meta refresh beside it
// would still redirect, but a refresh leaves /share in the history and Back
// bounces straight forward again; replace() does not. So the script stays, and
// reads its destination from the meta refresh the server already escaped.
export const SHARE_REDIRECT_SCRIPT =
  "(function(){var m=document.querySelector('meta[http-equiv=\"refresh\"]');var u=m&&/url=(.+)$/i.exec(m.content);if(u)location.replace(u[1]);})();";
