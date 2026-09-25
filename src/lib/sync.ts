/**
 * Directory sync from the official INC directory (directory.iglesianicristo.net).
 *
 * Fetches every district listing and every locale page, then rebuilds each locale's name, kind,
 * address, coordinates, contacts and worship schedule from the source. Shared by the in-app sync
 * job (Settings -> Run Sync Now, 6-hourly schedule) and `scripts/sync-directory.ts`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { SOURCE_BASE_URL, parseLocalePage, buildSchedule, scheduleLanguages, type ParsedLocalePage } from './schedule-parser.ts';
import { classifyLocaleName } from './locale-kind.ts';
import type { District, Locale } from './types.ts';

export type SyncPhase = 'districts' | 'locales' | 'applying';

export interface SyncProgress {
  phase: SyncPhase;
  done: number;
  total: number;
}

export interface SyncOptions {
  concurrency?: number;
  /** Only sync these locale slugs (skips the district listing check). */
  only?: string[];
  /** Directory for caching raw HTML (CLI use); pages already cached are not refetched. */
  cacheDir?: string | null;
  onProgress?(p: SyncProgress): void;
}

export interface SyncReport {
  pages_fetched: number;
  fetch_failures: { slug: string; status: number }[];
  district_failures: string[];
  updated: number;
  unchanged: number;
  added: string[];
  removed: string[];
  empty_schedules: string[];
  parse_warnings: { slug: string; warnings: string[] }[];
}

export interface SyncOutcome {
  locales: Locale[];
  report: SyncReport;
}

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) KapilyaDirectoryBot/1.0';

async function fetchWithRetry(url: string, attempts = 4): Promise<{ status: number; body: string | null }> {
  let lastStatus = 0;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(30_000) });
      lastStatus = res.status;
      if (res.ok) return { status: res.status, body: await res.text() };
      if (res.status === 404) return { status: 404, body: null };
    } catch {
      lastStatus = -1;
    }
    await new Promise((r) => setTimeout(r, 2000 * 2 ** i));
  }
  return { status: lastStatus, body: null };
}

async function fetchPage(kind: 'districts' | 'locales', slug: string, cacheDir: string | null | undefined) {
  const file = cacheDir ? path.join(cacheDir, kind === 'districts' ? 'district' : 'locale', `${slug}.html`) : null;
  if (file && fs.existsSync(file)) return { status: 200, body: fs.readFileSync(file, 'utf-8') };
  const res = await fetchWithRetry(`${SOURCE_BASE_URL}/${kind}/${slug}`);
  if (file && res.body) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, res.body, 'utf-8');
  }
  return res;
}

async function pool<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>, onDone: (done: number) => void) {
  let next = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (next < items.length) {
        const item = items[next++];
        await worker(item);
        onDone(++done);
      }
    })
  );
}

function localeSignature(l: Locale) {
  return JSON.stringify([
    l.name,
    l.kind,
    l.address,
    l.latitude,
    l.longitude,
    l.phone ?? null,
    l.email ?? null,
    l.district_id,
    (l.schedule ?? []).map((s) => [s.day_of_week, s.start_time, s.language, s.language2 ?? null, s.service_type]),
  ]);
}

/** Applies a parsed source page onto a locale record (existing or new). */
function fromSource(base: Locale, page: ParsedLocalePage, district: District | undefined, syncedAt: string): Locale {
  const schedule = buildSchedule(base.slug, page);
  const name = page.name || base.name;
  const hasCoords = page.latitude !== null && page.longitude !== null && !(page.latitude === 0 && page.longitude === 0);
  const next: Locale = {
    ...base,
    name,
    kind: classifyLocaleName(name),
    address: page.address || base.address,
    latitude: hasCoords ? page.latitude! : base.latitude,
    longitude: hasCoords ? page.longitude! : base.longitude,
    phone: page.phone,
    email: page.email,
    languages: scheduleLanguages(schedule),
    schedule,
    source_updated_at: syncedAt,
  };
  if (district) {
    next.district_id = district.id;
    if ('district_name' in next) next.district_name = district.name;
    if ('district_slug' in next) next.district_slug = district.slug;
  }
  return next;
}

export async function syncFromSource(
  current: { districts: District[]; locales: Locale[] },
  opts: SyncOptions = {}
): Promise<SyncOutcome> {
  const concurrency = Math.max(1, opts.concurrency ?? 6);
  const districtBySlug = new Map(current.districts.map((d) => [d.slug, d]));

  // Phase 1: district listings (which locales exist, and in which district).
  const listing = new Map<string, string>(); // locale slug -> district slug
  const districtFailures: string[] = [];
  if (!opts.only) {
    const slugs = current.districts.map((d) => d.slug);
    await pool(
      slugs,
      concurrency,
      async (slug) => {
        const res = await fetchPage('districts', slug, opts.cacheDir);
        if (!res.body) {
          districtFailures.push(slug);
          return;
        }
        for (const m of res.body.matchAll(/\/locales\/([a-z0-9-]+)"/gi)) listing.set(m[1], slug);
      },
      (done) => opts.onProgress?.({ phase: 'districts', done, total: slugs.length })
    );
  }

  // Phase 2: locale pages.
  const known = new Set(current.locales.map((l) => l.slug));
  const newSlugs = [...listing.keys()].filter((s) => !known.has(s));
  const targets = opts.only ?? [...current.locales.map((l) => l.slug), ...newSlugs];
  const pages = new Map<string, ParsedLocalePage>();
  const failures: { slug: string; status: number }[] = [];
  await pool(
    targets,
    concurrency,
    async (slug) => {
      const res = await fetchPage('locales', slug, opts.cacheDir);
      if (res.body) pages.set(slug, parseLocalePage(res.body));
      else failures.push({ slug, status: res.status });
    },
    (done) => opts.onProgress?.({ phase: 'locales', done, total: targets.length })
  );

  // Phase 3: rebuild records.
  opts.onProgress?.({ phase: 'applying', done: 0, total: 1 });
  const syncedAt = new Date().toISOString();
  const listingComplete = !opts.only && districtFailures.length === 0;
  const failed = new Set(failures.map((f) => f.slug));
  const report: SyncReport = {
    pages_fetched: pages.size,
    fetch_failures: failures,
    district_failures: districtFailures,
    updated: 0,
    unchanged: 0,
    added: [],
    removed: [],
    empty_schedules: [],
    parse_warnings: [],
  };

  const locales: Locale[] = [];
  for (const locale of current.locales) {
    const page = pages.get(locale.slug);
    if (!page) {
      // Drop a locale only when the source no longer lists it anywhere AND its page is gone.
      if (listingComplete && failed.has(locale.slug) && !listing.has(locale.slug)) {
        report.removed.push(locale.slug);
        continue;
      }
      locales.push(locale);
      continue;
    }
    const districtSlug = listing.get(locale.slug) ?? page.district_slug;
    const next = fromSource(locale, page, districtSlug ? districtBySlug.get(districtSlug) : undefined, syncedAt);
    if (page.warnings.length) report.parse_warnings.push({ slug: locale.slug, warnings: page.warnings });
    if (next.schedule!.length === 0) report.empty_schedules.push(locale.slug);
    // Unchanged records keep their object (and source_updated_at), so a no-op sync changes nothing.
    if (localeSignature(next) === localeSignature(locale)) {
      report.unchanged++;
      locales.push(locale);
    } else {
      report.updated++;
      locales.push(next);
    }
  }

  for (const slug of newSlugs) {
    const page = pages.get(slug);
    const district = districtBySlug.get(listing.get(slug)!);
    if (!page || !district || page.latitude === null || page.longitude === null) continue;
    const base: Locale = {
      id: `loc-${slug}`,
      district_id: district.id,
      name: slug,
      slug,
      kind: 'local_congregation',
      address: '',
      latitude: 0,
      longitude: 0,
      languages: [],
      source_updated_at: syncedAt,
    };
    locales.push(fromSource(base, page, district, syncedAt));
    report.added.push(slug);
  }

  return { locales, report };
}
