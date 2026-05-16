// /api/version.js
// Probably Weather — current deployed version probe.
//
// Returns the commit SHA of the deployment that's currently serving traffic.
// The client compares this value against the version it saw at boot — if
// they differ, the user is running stale code (typically because the SW
// auto-update flow stuck or the browser HTTP cache hasn't expired yet).
// In that case the client shows a "New version — tap to refresh" banner.
//
// Vercel sets VERCEL_GIT_COMMIT_SHA on every deploy automatically — no
// build step or env-var config needed.

export default function handler(req, res) {
  const version = process.env.VERCEL_GIT_COMMIT_SHA || 'local';
  // The version itself must never be cached — if it were, the whole point
  // of the probe (detecting "did the server change since I booted") fails.
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.status(200).json({ version });
}
