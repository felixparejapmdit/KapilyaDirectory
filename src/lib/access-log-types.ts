import type { DeviceType } from './user-agent';

/** One page view, as recorded by /api/access-log. */
export interface AccessEntry {
  id: string;
  /** ISO time. */
  at: string;
  /** Anonymous per-browser visitor ID (the site has no accounts). */
  vid: string;
  ip: string;
  /** From the host's IP geolocation (Vercel); empty on a local server. */
  city?: string;
  region?: string;
  /** ISO country code, e.g. "PH". */
  country?: string;
  lat?: number;
  lng?: number;
  path: string;
  /** Where the visitor came from (another site), if any. */
  ref?: string;
  device: DeviceType;
  os: string;
  osFamily: string;
  browser: string;
  browserFamily: string;
  model?: string;
  /** e.g. "1920×1080". */
  screen?: string;
  lang?: string;
  /** The visitor's own time zone, e.g. "Asia/Manila". */
  tz?: string;
  ua: string;
}

export type AccessStorage = 'redis' | 'file' | 'none';

export interface AccessFilters {
  /** Rolling window ending now: "24h", "7d", "30d" (ignored when `from` is set). */
  within?: string;
  from?: string;
  to?: string;
  q?: string;
  device?: string;
  country?: string;
  os?: string;
  browser?: string;
  page?: string;
  vid?: string;
  ip?: string;
  /** Leave out this visitor ID (e.g. the admin's own device). */
  excludeVid?: string;
}

export interface AccessQueryResult {
  storage: AccessStorage;
  /** Entries kept at most (older ones are dropped). */
  capacity: number;
  entries: AccessEntry[];
  /** Matching entries in total (entries is one page of them). */
  total: number;
  stats: { visits: number; visitors: number; ips: number; countries: number };
  /** Visits per visitor ID among the matches. */
  visitorVisits: Record<string, number>;
  /** Values to choose from in the filters (within the date range). */
  facets: {
    device: [string, number][];
    country: [string, number][];
    os: [string, number][];
    browser: [string, number][];
    page: [string, number][];
  };
}
