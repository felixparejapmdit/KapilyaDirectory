/**
 * Advanced congregation filters (Districts page and /api/locales/filter).
 *
 * Schedule criteria (day, time, language, service type, "starting within") are matched per
 * service: a congregation matches when ONE of its services meets all of them, so "Sunday + morning
 * + English" means an English service on Sunday morning. Filters round-trip through URL params so
 * a filtered view can be bookmarked or shared.
 */
import type { District, Locale, LocaleKind, WorshipScheduleItem } from './types.ts';
import { serviceDurationMinutes, shiftSlot, tzOffsetMinutes, zonedWallClock } from './next-service.ts';
import { haversineKm } from './geo.ts';
import { timeToMinutes } from './time.ts';

export type TimeBucket = 'early' | 'morning' | 'afternoon' | 'evening';
export type ServiceKind = 'worship' | 'cws';
export type SoonWindow = 'now' | '3h' | 'today';
export type ContactKind = 'phone' | 'email';
export type SortKey = 'relevance' | 'name' | 'nearest' | 'soonest' | 'services';
/**
 * Which clock day/time filters (and displayed times) use: each congregation's own (default),
 * Philippine time, or the viewer's own time zone.
 */
export type TimeRef = 'ph' | 'mine';
export const PH_TIMEZONE = 'Asia/Manila';

export const TIME_BUCKETS: { id: TimeBucket; label: string; range: string; from: number; to: number }[] = [
  { id: 'early', label: 'Early morning', range: 'before 7 AM', from: 0, to: 7 * 60 },
  { id: 'morning', label: 'Morning', range: '7 AM – 12 PM', from: 7 * 60, to: 12 * 60 },
  { id: 'afternoon', label: 'Afternoon', range: '12 – 5 PM', from: 12 * 60, to: 17 * 60 },
  { id: 'evening', label: 'Evening', range: '5 PM onwards', from: 17 * 60, to: 24 * 60 },
];
export const SOON_WINDOWS: { id: SoonWindow; label: string }[] = [
  { id: 'now', label: 'Within 1 hour' },
  { id: '3h', label: 'Within 3 hours' },
  { id: 'today', label: 'Later today' },
];
export const NEAR_OPTIONS = [5, 10, 25, 50, 100];

export interface AdvancedFilters {
  /** ISO country/territory code, e.g. "JP" (see countries.ts). */
  country?: string;
  region?: string;
  district?: string;
  /** Within this many km of the user's location. */
  near?: number;
  days: number[];
  times: TimeBucket[];
  /** Custom start-time range "HH:MM" (replaces the time buckets when set). */
  from?: string;
  to?: string;
  langs: string[];
  service?: ServiceKind;
  soon?: SoonWindow;
  contact: ContactKind[];
  sort?: SortKey;
  /** Match (and show) times in Philippine time or the viewer's own time zone. */
  tz?: TimeRef;
}

export const EMPTY_FILTERS: AdvancedFilters = { days: [], times: [], langs: [], contact: [] };

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const list = (v: string | null) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);
const oneOf = <T extends string>(v: string | null, options: readonly T[]) => (v && (options as readonly string[]).includes(v) ? (v as T) : undefined);

export function parseFilters(p: URLSearchParams): AdvancedFilters {
  const near = Number(p.get('near'));
  return {
    country: /^[A-Z]{2}$/.test(p.get('country') ?? '') ? p.get('country')! : undefined,
    region: p.get('region') || undefined,
    district: p.get('district') || undefined,
    near: NEAR_OPTIONS.includes(near) ? near : undefined,
    days: [...new Set(list(p.get('day')).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort(),
    times: list(p.get('time')).filter((t): t is TimeBucket => TIME_BUCKETS.some((b) => b.id === t)),
    from: HHMM.test(p.get('from') ?? '') ? p.get('from')! : undefined,
    to: HHMM.test(p.get('to') ?? '') ? p.get('to')! : undefined,
    langs: list(p.get('lang')).slice(0, 10),
    service: oneOf(p.get('service'), ['worship', 'cws'] as const),
    soon: oneOf(p.get('soon'), ['now', '3h', 'today'] as const),
    contact: list(p.get('contact')).filter((c): c is ContactKind => c === 'phone' || c === 'email'),
    sort: oneOf(p.get('sort'), ['relevance', 'name', 'nearest', 'soonest', 'services'] as const),
    tz: oneOf(p.get('tz'), ['ph', 'mine'] as const),
  };
}

/** Writes the filters into `p` (removing unset ones), leaving other params alone. */
export function writeFilters(p: URLSearchParams, f: AdvancedFilters): URLSearchParams {
  const put = (k: string, v: string | number | undefined) => (v === undefined || v === '' ? p.delete(k) : p.set(k, String(v)));
  put('country', f.country);
  put('region', f.region);
  put('district', f.district);
  put('near', f.near);
  put('day', f.days.join(','));
  put('time', f.from || f.to ? '' : f.times.join(','));
  put('from', f.from);
  put('to', f.to);
  put('lang', f.langs.join(','));
  put('service', f.service);
  put('soon', f.soon);
  put('contact', f.contact.join(','));
  put('sort', f.sort);
  put('tz', f.tz);
  return p;
}

/** Number of active filters (sort doesn't count). */
export function activeFilterCount(f: AdvancedFilters): number {
  return (
    (f.country ? 1 : 0) +
    (f.region ? 1 : 0) +
    (f.district ? 1 : 0) +
    (f.near ? 1 : 0) +
    (f.days.length ? 1 : 0) +
    (f.times.length || f.from || f.to ? 1 : 0) +
    (f.langs.length ? 1 : 0) +
    (f.service ? 1 : 0) +
    (f.soon ? 1 : 0) +
    (f.contact.length ? 1 : 0)
  );
}

/** How well a congregation's name (or district / address) matches a search: 0 = not at all. */
export function nameScore(name: string, districtName: string | undefined, address: string, q: string): number {
  const n = name.toLowerCase();
  if (n === q) return 100;
  if (n.startsWith(q)) return 80;
  if (n.split(/[\s,.()-]+/).some((w) => w.startsWith(q))) return 60;
  if (n.includes(q)) return 40;
  if (districtName?.toLowerCase().includes(q)) return 20;
  if (address.toLowerCase().includes(q)) return 10;
  return 0;
}

// ---------------- Server side ----------------

export interface FilterQuery {
  q: string;
  kind: 'all' | LocaleKind;
  filters: AdvancedFilters;
  /** The user's location (distances, "near me", nearest-first). */
  lat?: number;
  lng?: number;
  offset: number;
  limit: number;
  /** Also return every matching slug (for the map). */
  withSlugs: boolean;
  /** Country code of a congregation (needed for the country filter). */
  countryOf?: (l: Locale) => string | undefined;
  /** Time zone that day/time filters use (from `filters.tz`); unset = each congregation's own. */
  refTz?: string;
}

export interface FilteredLocale extends Locale {
  /** IDs of the services that meet the schedule criteria (only when schedule criteria are set). */
  matched?: string[];
  /** Minutes to add to this congregation's times to get the reference time zone's (see `ref_tz`). */
  ref_shift?: number;
}

type Counts = [number, number, number];
const KIND_INDEX: Record<LocaleKind, 0 | 1 | 2> = { local_congregation: 0, extension: 1, group_worship_service: 2 };

export interface FilterResult {
  total: number;
  /** Matching services across all matching congregations. */
  services: number;
  locales: FilteredLocale[];
  /** Matches per district by kind (all kinds, for the list and the map). */
  byDistrict: Record<string, Counts>;
  facets: {
    kind: Record<LocaleKind | 'all', number>;
    day: number[];
    time: Record<TimeBucket, number>;
    lang: [string, number][];
    service: Record<ServiceKind, number>;
  };
  slugs?: string[];
  /** The reference time zone used for day/time matching, when not each congregation's own. */
  ref_tz?: string;
}

export function filterLocales(
  data: { locales: Locale[]; districts: District[] },
  query: FilterQuery,
  now: Date = new Date()
): FilterResult {
  const f = query.filters;
  const q = query.q.toLowerCase().replace(/\s+/g, ' ').trim();
  const districtById = new Map(data.districts.map((d) => [d.id, d]));
  const hasPoint = Number.isFinite(query.lat) && Number.isFinite(query.lng);
  const customFrom = f.from ? timeToMinutes(f.from) : 0;
  const customTo = f.to ? timeToMinutes(f.to) : 24 * 60;
  const customRange = !!(f.from || f.to);
  const scheduleCriteria = f.days.length > 0 || f.times.length > 0 || customRange || f.langs.length > 0 || !!f.service || !!f.soon;

  // Wall clock per time zone (for "starting within"), computed once per zone.
  const clocks = new Map<string, { day: number; minutes: number }>();
  const clockFor = (tz: string) => {
    let c = clocks.get(tz);
    if (!c) clocks.set(tz, (c = zonedWallClock(tz, now)));
    return c;
  };
  const startsIn = (item: WorshipScheduleItem, tz: string) => {
    const c = clockFor(tz);
    let diff = item.day_of_week * 1440 + timeToMinutes(item.start_time) - (c.day * 1440 + c.minutes);
    if (diff < -serviceDurationMinutes(item)) diff += 7 * 1440; // ongoing services count as now
    return { diff, leftToday: 1440 - c.minutes };
  };

  // Reference time zone: each service's day and time as seen there (this week's offsets, so DST counts).
  const refTz = query.refTz;
  const offsets = new Map<string, number>();
  const offsetOf = (tz: string) => {
    let o = offsets.get(tz);
    if (o === undefined) offsets.set(tz, (o = tzOffsetMinutes(tz, now)));
    return o;
  };
  const refLeftToday = refTz ? 1440 - clockFor(refTz).minutes : null;

  const dayOK = (day: number) => !f.days.length || f.days.includes(day);
  const timeOK = (m: number) => {
    if (customRange) return m >= customFrom && m <= customTo;
    return !f.times.length || f.times.some((t) => {
      const b = TIME_BUCKETS.find((x) => x.id === t)!;
      return m >= b.from && m < b.to;
    });
  };
  const langOK = (i: WorshipScheduleItem) => !f.langs.length || f.langs.includes(i.language) || (!!i.language2 && f.langs.includes(i.language2));
  const serviceOf = (i: WorshipScheduleItem): ServiceKind => (i.is_cws || i.service_type === 'CWS' ? 'cws' : 'worship');
  const serviceOK = (i: WorshipScheduleItem) => !f.service || serviceOf(i) === f.service;
  const soonOK = (i: WorshipScheduleItem, tz: string) => {
    if (!f.soon) return true;
    const { diff, leftToday } = startsIn(i, tz);
    return f.soon === 'now' ? diff <= 60 : f.soon === '3h' ? diff <= 180 : diff <= (refLeftToday ?? leftToday);
  };

  const facets: FilterResult['facets'] = {
    kind: { all: 0, local_congregation: 0, extension: 0, group_worship_service: 0 },
    day: [0, 0, 0, 0, 0, 0, 0],
    time: { early: 0, morning: 0, afternoon: 0, evening: 0 },
    lang: [],
    service: { worship: 0, cws: 0 },
  };
  const langCounts = new Map<string, number>();
  const byDistrict: Record<string, Counts> = {};
  const matches: { locale: Locale; score: number; km?: number; matched: WorshipScheduleItem[]; soonest: number; shift: number }[] = [];
  let services = 0;

  for (const locale of data.locales) {
    const district = districtById.get(locale.district_id);
    // Where + contact + search: independent of the schedule.
    if (f.country && query.countryOf?.(locale) !== f.country) continue;
    if (f.district && district?.slug !== f.district) continue;
    if (f.region && district?.region_id !== f.region) continue;
    if (f.contact.includes('phone') && !locale.phone) continue;
    if (f.contact.includes('email') && !locale.email) continue;
    const km = hasPoint ? haversineKm(query.lat!, query.lng!, locale.latitude, locale.longitude) : undefined;
    if (f.near && (km === undefined || km > f.near)) continue;
    const score = q ? nameScore(locale.name, district?.name, locale.address, q) : 1;
    if (!score) continue;

    const tz = district?.timezone || 'Asia/Manila';
    const shift = refTz ? offsetOf(refTz) - offsetOf(tz) : 0;
    const items = locale.schedule ?? [];
    // Per service: which criteria it meets. Facets leave out their own criterion.
    const facetDays = new Set<number>();
    const facetTimes = new Set<TimeBucket>();
    const facetLangs = new Set<string>();
    const facetServices = new Set<ServiceKind>();
    const matched: WorshipScheduleItem[] = [];
    for (const i of items) {
      if (!soonOK(i, tz)) continue;
      const slot = shift ? shiftSlot(i.day_of_week, i.start_time, shift) : { day: i.day_of_week, minutes: timeToMinutes(i.start_time) };
      const d = dayOK(slot.day);
      const t = timeOK(slot.minutes);
      const l = langOK(i);
      const s = serviceOK(i);
      if (t && l && s) facetDays.add(slot.day);
      if (d && l && s) {
        const bucket = TIME_BUCKETS.find((b) => slot.minutes >= b.from && slot.minutes < b.to);
        if (bucket) facetTimes.add(bucket.id);
      }
      if (d && t && s) {
        if (i.language && i.language !== 'Unspecified') facetLangs.add(i.language);
        if (i.language2) facetLangs.add(i.language2);
      }
      if (d && t && l) facetServices.add(serviceOf(i));
      if (d && t && l && s) matched.push(i);
    }
    const kindOK = query.kind === 'all' || locale.kind === query.kind;
    if (kindOK) {
      for (const d of facetDays) facets.day[d]++;
      for (const t of facetTimes) facets.time[t]++;
      for (const l of facetLangs) langCounts.set(l, (langCounts.get(l) ?? 0) + 1);
      for (const s of facetServices) facets.service[s]++;
    }
    if (scheduleCriteria && !matched.length) continue;

    // Counts by kind ignore the kind filter (the type pills and the map show all three).
    facets.kind[locale.kind]++;
    facets.kind.all++;
    (byDistrict[locale.district_id] ??= [0, 0, 0])[KIND_INDEX[locale.kind]]++;
    if (!kindOK) continue;

    const pool = scheduleCriteria ? matched : items;
    services += pool.length;
    // Minutes to the next (or in-progress) service, on the congregation's own clock.
    let soonest = Infinity;
    for (const i of pool) soonest = Math.min(soonest, startsIn(i, tz).diff);
    matches.push({ locale, score, km, matched, soonest, shift });
  }

  const sort: SortKey = f.sort ?? (q ? 'relevance' : f.near && hasPoint ? 'nearest' : 'name');
  const byName = (a: (typeof matches)[number], b: (typeof matches)[number]) => a.locale.name.localeCompare(b.locale.name);
  matches.sort((a, b) => {
    switch (sort) {
      case 'relevance':
        return b.score - a.score || byName(a, b);
      case 'nearest':
        return (a.km ?? Infinity) - (b.km ?? Infinity) || byName(a, b);
      case 'soonest':
        return a.soonest - b.soonest || byName(a, b);
      case 'services':
        return (scheduleCriteria ? b.matched.length - a.matched.length : (b.locale.schedule?.length ?? 0) - (a.locale.schedule?.length ?? 0)) || byName(a, b);
      default:
        return byName(a, b);
    }
  });

  facets.lang = [...langCounts].sort((a, b) => b[1] - a[1]);
  return {
    total: matches.length,
    services,
    locales: matches.slice(query.offset, query.offset + query.limit).map(({ locale, km, matched, shift }) => {
      const district = districtById.get(locale.district_id);
      return {
        ...locale,
        district_name: district?.name,
        district_slug: district?.slug,
        timezone: district?.timezone || 'Asia/Manila',
        distance_km: km,
        matched: scheduleCriteria ? matched.map((i) => i.id) : undefined,
        ref_shift: refTz ? shift : undefined,
      };
    }),
    byDistrict,
    facets,
    slugs: query.withSlugs ? matches.map((m) => m.locale.slug) : undefined,
    ref_tz: refTz,
  };
}
