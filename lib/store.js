import fs from 'fs';
import path from 'path';
import { getDataDir } from './config.js';

const DATA_DIR = getDataDir();
const BLOB_DIR = path.join(DATA_DIR, 'blobs');
const FILES_DB = path.join(DATA_DIR, 'files.json');
const LINKS_DB = path.join(DATA_DIR, 'links.json');

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(BLOB_DIR)) fs.mkdirSync(BLOB_DIR, { recursive: true });
  if (!fs.existsSync(FILES_DB)) fs.writeFileSync(FILES_DB, JSON.stringify({ files: [] }, null, 2));
  if (!fs.existsSync(LINKS_DB)) fs.writeFileSync(LINKS_DB, JSON.stringify({ links: [] }, null, 2));
}

function readJson(file) {
  ensureDirs();
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, data) {
  ensureDirs();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

export function generateId(len = 9) {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 2 + len);
}

export function generateShortCode(len = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function blobPath(id) {
  ensureDirs();
  return path.join(BLOB_DIR, id);
}

/* ---------------- files.json ---------------- */

export function readFiles() {
  return readJson(FILES_DB).files;
}

export function writeFiles(files) {
  writeJson(FILES_DB, { files });
}

export function upsertFile(entry) {
  const files = readFiles();
  const idx = files.findIndex(f => f.name === entry.name);
  if (idx !== -1) {
    const oldPath = blobPath(files[idx].id);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    files[idx] = entry;
  } else {
    files.push(entry);
  }
  writeFiles(files);
  return entry;
}

export function deleteFileEntry({ id, name }) {
  const files = readFiles();
  const idx = files.findIndex(f => (id && f.id === id) || (name && f.name === name));
  if (idx === -1) return null;
  const [removed] = files.splice(idx, 1);
  const filePath = blobPath(removed.id);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  writeFiles(files);
  return removed;
}

/* ---------------- links.json (shortener) ---------------- */

export function readLinks() {
  return readJson(LINKS_DB).links;
}

export function writeLinks(links) {
  writeJson(LINKS_DB, { links });
}

export function createShortLink(originalUrl) {
  const links = readLinks();

  // Reuse an existing short code if this exact URL was already shortened.
  const existing = links.find(l => l.original === originalUrl);
  if (existing) return existing;

  let code;
  do {
    code = generateShortCode();
  } while (links.some(l => l.code === code));

  const entry = {
    code,
    original: originalUrl,
    createdAt: new Date().toISOString(),
    clicks: 0,
  };
  links.push(entry);
  writeLinks(links);
  return entry;
}

export function findShortLink(code) {
  return readLinks().find(l => l.code === code) || null;
}

export function registerClick(code) {
  const links = readLinks();
  const entry = links.find(l => l.code === code);
  if (entry) {
    entry.clicks += 1;
    writeLinks(links);
  }
  return entry;
}

export { ensureDirs, DATA_DIR };
