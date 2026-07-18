import fs from 'fs';
import { AUTHOR, getBaseUrl } from './config.js';
import {
  generateId,
  blobPath,
  readFiles,
  upsertFile,
  deleteFileEntry,
  createShortLink,
  findShortLink,
  registerClick,
  readLinks,
} from './store.js';
import { getMimeType, readRawBody, parseMultipart } from './multipart.js';

function send(res, statusCode, obj) {
  const body = JSON.stringify(obj, null, 2);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(body);
}

function fileEntryPublic(f, baseUrl) {
  return {
    file: f.name,
    link: `${baseUrl}/api/upload/${encodeURIComponent(f.name)}`,
    size: f.size,
    uploadedAt: f.uploadedAt,
  };
}

function isValidUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Main entry point. Works with any (req, res) pair that behaves like
 * Node's http.IncomingMessage / http.ServerResponse — this covers plain
 * Node `http`, Express, and Vercel Node functions alike.
 */
export async function handleRequest(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Filename');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  const fullUrl = req.url || '/';
  const pathname = fullUrl.split('?')[0];
  const baseUrl = getBaseUrl(req);

  try {
    // ------------------------------------------------------------------
    // GET /api/upload/:filename  — serve the raw file bytes
    // ------------------------------------------------------------------
    if (req.method === 'GET' && pathname.startsWith('/api/upload/') && pathname !== '/api/upload/') {
      const filename = decodeURIComponent(pathname.replace('/api/upload/', ''));
      const files = readFiles();
      const file = files.find(f => f.name === filename);

      if (!file) return send(res, 404, { author: AUTHOR, error: 'File tidak ditemukan' });

      const filePath = blobPath(file.id);
      if (!fs.existsSync(filePath)) {
        return send(res, 404, { author: AUTHOR, error: 'File fisik tidak ditemukan' });
      }

      const stat = fs.statSync(filePath);
      res.setHeader('Content-Type', getMimeType(file.name));
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    // ------------------------------------------------------------------
    // GET /s/:code  and  GET /api/s/:code — short link redirect
    // ------------------------------------------------------------------
    if (req.method === 'GET' && (pathname.startsWith('/s/') || pathname.startsWith('/api/s/'))) {
      const code = decodeURIComponent(pathname.split('/').pop());
      const link = findShortLink(code);
      if (!link) return send(res, 404, { author: AUTHOR, error: 'Link pendek tidak ditemukan' });

      registerClick(code);
      res.statusCode = 302;
      res.setHeader('Location', link.original);
      return res.end();
    }

    // ------------------------------------------------------------------
    // /api/shorten — link converter/shortener
    // ------------------------------------------------------------------
    if (pathname === '/api/shorten') {
      if (req.method === 'POST') {
        const raw = await readRawBody(req);
        let body;
        try {
          body = JSON.parse(raw.toString('utf8') || '{}');
        } catch {
          return send(res, 400, { author: AUTHOR, error: 'Body harus JSON, contoh: {"url":"https://..."}' });
        }

        const original = (body.url || body.link || '').trim();
        if (!original) return send(res, 400, { author: AUTHOR, error: 'Field "url" wajib diisi' });
        if (!isValidUrl(original)) return send(res, 400, { author: AUTHOR, error: 'URL tidak valid' });

        const entry = createShortLink(original);
        return send(res, 200, {
          author: AUTHOR,
          code: entry.code,
          original: entry.original,
          link: `${baseUrl}/s/${entry.code}`,
        });
      }

      if (req.method === 'GET') {
        const links = readLinks();
        return send(res, 200, {
          author: AUTHOR,
          count: links.length,
          links: links.map(l => ({
            code: l.code,
            original: l.original,
            link: `${baseUrl}/s/${l.code}`,
            clicks: l.clicks,
            createdAt: l.createdAt,
          })),
        });
      }
    }

    // ------------------------------------------------------------------
    // POST /api/botupload — raw byte body upload (no multipart), handy
    // for bots/scripts: POST raw bytes, filename via ?filename= or
    // X-Filename header.
    // ------------------------------------------------------------------
    if (req.method === 'POST' && pathname.startsWith('/api/botupload')) {
      const fileBuffer = await readRawBody(req);
      if (!fileBuffer.length) {
        return send(res, 400, { author: AUTHOR, error: 'Body kosong, tidak ada file yang dikirim' });
      }

      const query = new URLSearchParams(fullUrl.split('?')[1] || '');
      let filename = query.get('filename') || req.headers['x-filename'] || `file-${generateId()}`;
      filename = decodeURIComponent(filename).replace(/^.*[\\/]/, '');

      const id = generateId();
      fs.writeFileSync(blobPath(id), fileBuffer);

      const entry = upsertFile({
        id,
        name: filename,
        size: fileBuffer.length,
        uploadedAt: new Date().toISOString(),
      });

      return send(res, 200, {
        author: AUTHOR,
        file: entry.name,
        link: `${baseUrl}/api/upload/${encodeURIComponent(entry.name)}`,
      });
    }

    // ------------------------------------------------------------------
    // /api/upload — list / upload / delete
    // ------------------------------------------------------------------
    if (pathname === '/api/upload' || pathname === '/api/upload/') {
      // GET: list every uploaded file
      if (req.method === 'GET') {
        const files = readFiles();
        return send(res, 200, {
          author: AUTHOR,
          count: files.length,
          files: files.map(f => fileEntryPublic(f, baseUrl)),
        });
      }

      // POST: multipart file upload (single or multiple)
      if (req.method === 'POST') {
        const buffer = await readRawBody(req);
        const contentType = req.headers['content-type'] || '';
        const boundary = contentType.split('boundary=')[1];

        if (!boundary) {
          return send(res, 400, { author: AUTHOR, error: 'Gunakan multipart/form-data (field "files")' });
        }

        const parsed = parseMultipart(buffer, boundary);
        if (!parsed.length) {
          return send(res, 400, { author: AUTHOR, error: 'Tidak ada file pada request' });
        }

        const uploaded = parsed.map(({ filename, buffer: fileBuffer }) => {
          const id = generateId();
          fs.writeFileSync(blobPath(id), fileBuffer);
          return upsertFile({
            id,
            name: filename,
            size: fileBuffer.length,
            uploadedAt: new Date().toISOString(),
          });
        });

        if (uploaded.length === 1) {
          const f = uploaded[0];
          return send(res, 200, {
            author: AUTHOR,
            file: f.name,
            link: `${baseUrl}/api/upload/${encodeURIComponent(f.name)}`,
          });
        }

        return send(res, 200, {
          author: AUTHOR,
          count: uploaded.length,
          files: uploaded.map(f => fileEntryPublic(f, baseUrl)),
        });
      }

      // DELETE: remove a file by ?id= or ?file=
      if (req.method === 'DELETE') {
        const query = new URLSearchParams(fullUrl.split('?')[1] || '');
        const id = query.get('id');
        const name = query.get('file');

        if (!id && !name) {
          return send(res, 400, { author: AUTHOR, error: 'Parameter "id" atau "file" diperlukan' });
        }

        const removed = deleteFileEntry({ id, name });
        if (!removed) return send(res, 404, { author: AUTHOR, error: 'File tidak ditemukan' });

        return send(res, 200, { author: AUTHOR, success: true, message: 'File berhasil dihapus' });
      }
    }

    return send(res, 404, { author: AUTHOR, error: 'Endpoint tidak ditemukan' });
  } catch (err) {
    console.error('Error:', err);
    return send(res, 500, { author: AUTHOR, error: err.message });
  }
}
