import path from 'path';

export const AUTHOR = 'Mayzaa';

/**
 * Resolve the public base URL used to build download / short links.
 * Priority:
 *   1. BASE_URL env var (recommended in production, e.g. https://uploader.mayzaa.my.id)
 *   2. Request Host header (works out of the box on Vercel / most reverse proxies)
 */
export function getBaseUrl(req) {
  if (process.env.BASE_URL) {
    return process.env.BASE_URL.replace(/\/+$/, '');
  }
  const proto =
    req.headers['x-forwarded-proto'] ||
    (req.socket && req.socket.encrypted ? 'https' : 'http');
  const host = req.headers['host'] || 'localhost:3000';
  return `${proto}://${host}`;
}

/**
 * Resolve where uploaded blobs + JSON "database" files live.
 * Priority:
 *   1. DATA_DIR env var (explicit override)
 *   2. /tmp/mayzaadata when running on Vercel (Vercel functions only allow writes to /tmp;
 *      note this storage is EPHEMERAL there and can be wiped between invocations/deploys)
 *   3. ./data next to the project (persists normally on a VPS, Windows, or Replit)
 */
export function getDataDir() {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  if (process.env.VERCEL) return '/tmp/mayzaadata';
  return path.join(process.cwd(), 'data');
}
