const MIME_TYPES = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  pdf: 'application/pdf',
  txt: 'text/plain',
  json: 'application/json',
  js: 'application/javascript',
  css: 'text/css',
  html: 'text/html',
  zip: 'application/zip',
  rar: 'application/x-rar-compressed',
  '7z': 'application/x-7z-compressed',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

export function getExtension(filename = '') {
  return filename.split('.').pop()?.toLowerCase() || '';
}

export function getMimeType(filename) {
  return MIME_TYPES[getExtension(filename)] || 'application/octet-stream';
}

/**
 * Read the full request body into a single Buffer.
 */
export function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/**
 * Minimal multipart/form-data parser (no external dependencies, works
 * identically on Vercel functions, Express, or plain Node http).
 * Returns an array of { fieldName, filename, buffer }.
 */
export function parseMultipart(buffer, boundary) {
  const parts = buffer.toString('binary').split(`--${boundary}`);
  const files = [];

  for (const part of parts) {
    if (!part.includes('filename=')) continue;

    const filenameMatch = part.match(/filename="(.*?)"/);
    if (!filenameMatch || !filenameMatch[1]) continue;

    let filename = filenameMatch[1].replace(/^.*[\\/]/, '');
    if (!filename) continue;

    const dataStart = part.indexOf('\r\n\r\n') + 4;
    let fileData = part.substring(dataStart);
    fileData = fileData.replace(/\r\n--$/, '').replace(/\r\n$/, '');

    const buf = Buffer.from(fileData, 'binary');
    files.push({ filename, buffer: buf });
  }

  return files;
}
