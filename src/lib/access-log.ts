/**
 * Access log storage (server only): the latest page views, newest first, capped at CAPACITY.
 *
 * - Upstash Redis (Vercel → Storage → Upstash for Redis) when its REST credentials are set: the only
 *   option on Vercel, whose filesystem is read-only.
 * - Otherwise a local server keeps data/access-log.json (gitignored).
 * - A read-only deployment without Redis records nothing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, READ_ONLY_DEPLOYMENT } from './store-files';
import type { AccessEntry, AccessFilters, AccessQueryResult, AccessStorage } from './access-log-types';

export const CAPACITY = 5000;
const REDIS_KEY = 'kapilya:access-log';
const LOG_FILE = path.join(DATA_DIR, 'access-log.json');

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '';
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';

export const ACCESS_STORAGE: AccessStorage = REDIS_URL && REDIS_TOKEN ? 'redis' : READ_ONLY_DEPLOYMENT ? 'none' : 'file';

async function redis(commands: (string | number)[][]): Promise<{ result?: unknown; error?: string }[]> {
  const res = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Redis ${res.status}`);
  return res.json();
}

function readFile(): AccessEntry[] {
  try {
    return JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

// One write at a time, so concurrent page views don't overwrite each other.
let fileQueue: Promise<void> = Promise.resolve();

export function recordAccess(entry: AccessEntry): Promise<void> {
  if (ACCESS_STORAGE === 'redis') {
    return redis([
      ['LPUSH', REDIS_KEY, JSON.stringify(entry)],
      ['LTRIM', REDIS_KEY, 0, CAPACITY - 1],
    ]).then(() => undefined);
  }
  if (ACCESS_STORAGE === 'file') {
    fileQueue = fileQueue.then(() => {
      const entries = readFile();
      entries.unshift(entry);
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(LOG_FILE, JSON.stringify(entries.slice(0, CAPACITY)));
    });
    return fileQueue;
  }
  return Promise.resolve();
}

export async function readAccess(): Promise<AccessEntry[]> {
  if (ACCESS_STORAGE === 'redis') {
    const [res] = await redis([['LRANGE', REDIS_KEY, 0, CAPACITY - 1]]);
    return ((res?.result as string[]) ?? []).flatMap((s) => {
      try {
        return [JSON.parse(s) as AccessEntry];
      } catch {
        return [];
      }
    });
  }
  if (ACCESS_STORAGE === 'file') {
    await fileQueue;
    return readFile();
  }
  return [];
}

export async function clearAccess(): Promise<void> {
  if (ACCESS_STORAGE === 'redis') await redis([['DEL', REDIS_KEY]]);
  else if (ACCESS_STORAGE === 'file') {
    await fileQueue;
    fs.rmSync(LOG_FILE, { force: true });
  }
}

function countBy(entries: AccessEntry[], key: (e: AccessEntry) => string | undefined): [string, number][] {
  const counts = new Map<string, number>();
  for (const e of entries) {
    const k = key(e);
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1]);
}

const searchable = (e: AccessEntry) =>
  [e.ip, e.city, e.region, e.country, e.path, e.ref, e.os, e.browser, e.model, e.vid, e.screen, e.lang, e.tz]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

/** Filters, counts, and pages the log (entries are newest first). */
export function queryAccess(all: AccessEntry[], f: AccessFilters, offset = 0, limit = 100): Omit<AccessQueryResult, 'storage' | 'capacity'> {
  const win = f.within?.match(/^(\d{1,4})(h|d)$/);
  const from = f.from ? Date.parse(f.from) : win ? Date.now() - Number(win[1]) * (win[2] === 'h' ? 36e5 : 864e5) : NaN;
  const to = f.to ? Date.parse(f.to) : NaN;
  const inRange = all.filter((e) => {
    const t = Date.parse(e.at);
    return (Number.isNaN(from) || t >= from) && (Number.isNaN(to) || t <= to) && (!f.excludeVid || e.vid !== f.excludeVid);
  });

  const terms = (f.q ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const matches = inRange.filter(
    (e) =>
      (!f.device || e.device === f.device) &&
      (!f.country || e.country === f.country) &&
      (!f.os || e.osFamily === f.os) &&
      (!f.browser || e.browserFamily === f.browser) &&
      (!f.page || e.path === f.page) &&
      (!f.vid || e.vid === f.vid) &&
      (!f.ip || e.ip === f.ip) &&
      (!terms.length || terms.every((t) => searchable(e).includes(t)))
  );

  const visitorVisits: Record<string, number> = {};
  for (const e of matches) visitorVisits[e.vid] = (visitorVisits[e.vid] ?? 0) + 1;

  return {
    entries: matches.slice(offset, offset + limit),
    total: matches.length,
    stats: {
      visits: matches.length,
      visitors: Object.keys(visitorVisits).length,
      ips: new Set(matches.map((e) => e.ip)).size,
      countries: new Set(matches.map((e) => e.country).filter(Boolean)).size,
    },
    visitorVisits,
    facets: {
      device: countBy(inRange, (e) => e.device),
      country: countBy(inRange, (e) => e.country),
      os: countBy(inRange, (e) => e.osFamily),
      browser: countBy(inRange, (e) => e.browserFamily),
      page: countBy(inRange, (e) => e.path).slice(0, 40),
    },
  };
}
