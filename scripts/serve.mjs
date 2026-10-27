/**
 * Lokaler HTTP-Server fuer Dev und Verify-Loop (kein file:// wegen ES-Modul-CORS).
 * Aufruf: node scripts/serve.mjs [port]  (Default 8080)
 * Bauplan Abschnitt 9: Tests laufen ueber http://localhost, nicht file.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve(process.argv[3] ?? '.');
const PORT = Number(process.argv[2] ?? 8080);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    let path = normalize(join(ROOT, decodeURIComponent(url.pathname)));
    if (!path.startsWith(ROOT)) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }
    if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'src/shell/index.html');
    if (url.pathname === '/') path = join(ROOT, 'src/shell/index.html');
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`serve: http://127.0.0.1:${PORT}/ (root ${ROOT})`);
});
