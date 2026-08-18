// Serve the repo over http://127.0.0.1 so the review tools open like a website.
//
// Al, 2026-08-17: "i am struggling to open the review tool." Double-clicking an
// .html is at the mercy of whatever Windows has associated with the extension,
// and file:// origins are opaque — some browsers refuse localStorage on them,
// which is exactly where every curation verdict is being autosaved. A local
// server removes both problems at once.
//
//   node scripts/serve-review.mjs
// Then open the URL it prints.
import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };

const server = createServer((req, res) => {
  const pn = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
  // Contained to the repo: a review tool is not a reason to expose the disk.
  const file = path.resolve(root, '.' + pn);
  if (!file.startsWith(path.resolve(root))) { res.writeHead(403).end('outside the repo'); return; }
  let buf = null;
  try { if (statSync(file).isDirectory()) { res.writeHead(404).end('no index here'); return; } buf = readFileSync(file); }
  catch { res.writeHead(404).end('not found: ' + pn); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }).end(buf);
});
const PORT = Number(process.env.PW_REVIEW_PORT || 8788);
server.listen(PORT, '127.0.0.1', () => {
  console.log(`[review] http://127.0.0.1:${PORT}/review/crop-anchor-tool.html`);
  console.log('[review] Ctrl+C here to stop it.');
});
