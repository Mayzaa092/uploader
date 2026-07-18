import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleRequest } from './lib/router.js';
import { getMimeType } from './lib/multipart.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

function serveStatic(req, res, pathname) {
  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  const target = safePath === '/' ? '/index.html' : safePath;
  const filePath = path.join(PUBLIC_DIR, target);

  if (!filePath.startsWith(PUBLIC_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain');
    return res.end('Not found');
  }

  res.setHeader('Content-Type', getMimeType(filePath) + (target.endsWith('.html') ? '; charset=utf-8' : ''));
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const pathname = (req.url || '/').split('?')[0];

  const isApiRoute =
    pathname.startsWith('/api/') ||
    pathname === '/api' ||
    pathname.startsWith('/s/');

  if (isApiRoute) {
    return handleRequest(req, res);
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    return serveStatic(req, res, pathname);
  }

  res.statusCode = 405;
  res.end('Method not allowed');
});

server.listen(PORT, HOST, () => {
  console.log(`MayzaaCloud uploader running di http://${HOST}:${PORT}`);
  console.log(`Set env BASE_URL kalau domain publik beda (misal https://uploader.mayzaa.my.id)`);
});
