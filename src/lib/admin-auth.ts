import { createHash, timingSafeEqual } from 'node:crypto';
import { READ_ONLY_DEPLOYMENT } from './store-files';

const ADMIN_KEY = process.env.ADMIN_KEY ?? '';

export type AdminCheck = 'ok' | 'missing-key' | 'wrong-key' | 'not-configured';

/**
 * Admin-only data (the access log holds visitors' IP addresses and locations) needs the ADMIN_KEY,
 * sent in the X-Admin-Key header. Without ADMIN_KEY set, only a local (writable) server allows it;
 * a public deployment refuses until the key is configured.
 */
export function checkAdmin(request: Request): AdminCheck {
  if (!ADMIN_KEY) return READ_ONLY_DEPLOYMENT ? 'not-configured' : 'ok';
  const given = request.headers.get('x-admin-key');
  if (!given) return 'missing-key';
  const digest = (s: string) => createHash('sha256').update(s).digest();
  return timingSafeEqual(digest(given), digest(ADMIN_KEY)) ? 'ok' : 'wrong-key';
}
