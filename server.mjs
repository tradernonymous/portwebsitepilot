/**
 * Production server for Railway.
 *
 * Deliberately dependency-free: it serves the Vite build out of `dist/`, compresses
 * text responses, and caches hashed assets hard. `npm start` runs this.
 *
 * Railway injects PORT and expects the process to bind 0.0.0.0, and to answer a
 * healthcheck — /healthz below.
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve, sep } from 'node:path';
import { brotliCompressSync, gzipSync, constants as zlibConstants } from 'node:zlib';

const DIST = resolve(process.cwd(), 'dist');
const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.txt', '.xml', '.map', '.webmanifest']);

/** Small in-process cache of compressed bodies. The build is a few dozen files. */
const cache = new Map();
const CACHE_LIMIT = 96;

async function loadFile(filePath) {
  const info = await stat(filePath);
  if (!info.isFile()) throw new Error('not a file');
  const raw = await readFile(filePath);
  return { raw, info };
}

function compress(ext, raw) {
  if (!COMPRESSIBLE.has(ext) || raw.byteLength < 1024) return {};
  return {
    br: brotliCompressSync(raw, {
      params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 5 },
    }),
    gzip: gzipSync(raw, { level: 6 }),
  };
}

function cacheControl(pathname) {
  if (pathname.startsWith('/assets/')) return 'public, max-age=31536000, immutable';
  if (pathname.startsWith('/media/')) return 'public, max-age=604800, stale-while-revalidate=86400';
  return 'no-cache';
}

async function send(req, res, filePath, pathname, status = 200) {
  let entry = cache.get(filePath);
  if (!entry) {
    const { raw, info } = await loadFile(filePath);
    const ext = extname(filePath).toLowerCase();
    entry = {
      raw,
      etag: `W/"${info.size}-${Math.round(info.mtimeMs)}"`,
      type: MIME[ext] ?? 'application/octet-stream',
      ...compress(ext, raw),
    };
    if (cache.size >= CACHE_LIMIT) cache.clear();
    cache.set(filePath, entry);
  }

  if (req.headers['if-none-match'] === entry.etag) {
    res.writeHead(304, { etag: entry.etag, 'cache-control': cacheControl(pathname) });
    res.end();
    return;
  }

  const accept = String(req.headers['accept-encoding'] ?? '');
  let body = entry.raw;
  let encoding;
  if (entry.br && accept.includes('br')) {
    body = entry.br;
    encoding = 'br';
  } else if (entry.gzip && accept.includes('gzip')) {
    body = entry.gzip;
    encoding = 'gzip';
  }

  const headers = {
    'content-type': entry.type,
    'content-length': body.byteLength,
    'cache-control': cacheControl(pathname),
    etag: entry.etag,
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
  };
  if (encoding) {
    headers['content-encoding'] = encoding;
    headers.vary = 'accept-encoding';
  }

  res.writeHead(status, headers);
  if (req.method === 'HEAD') res.end();
  else res.end(body);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);

  if (pathname === '/healthz') {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
    res.end('ok');
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' });
    res.end();
    return;
  }

  // Resolve inside DIST only — no traversal out of the build directory.
  const candidate = resolve(join(DIST, pathname));
  const insideDist = candidate === DIST || candidate.startsWith(DIST + sep);

  if (insideDist && pathname !== '/') {
    try {
      await send(req, res, candidate, pathname);
      return;
    } catch {
      // fall through to the SPA shell
    }
  }

  if (url.pathname.includes('.')) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('404');
    return;
  }

  // Single page app: every unknown route renders the shell, which reads the hash.
  try {
    await send(req, res, join(DIST, 'index.html'), '/index.html');
  } catch {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Build missing. Run `npm run build` first.');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`PORT website listening on http://${HOST}:${PORT} (dist: ${DIST})`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
