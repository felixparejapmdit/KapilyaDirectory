/**
 * Country and continent of each congregation (server only).
 *
 * Districts don't map to countries: "Central America" spans Mexico, Guatemala, Panama and Belize,
 * "Florida & Caribbean" spans the USA, Haiti, Jamaica and more. So the country belongs to each
 * congregation: from its map location (offline, via country-coder), else the country named at the
 * end of its address, else the most common country of its district. Territories count separately
 * (Guam, Hong Kong, Puerto Rico), the way members usually think of them.
 */
import { feature } from 'country-coder';
import type { District, Locale } from './types.ts';

export type Continent = 'Asia' | 'Europe' | 'Africa' | 'Oceania' | 'North America' | 'South America';
export const CONTINENTS: Continent[] = ['Asia', 'North America', 'Europe', 'Oceania', 'Africa', 'South America'];

// UN M49 groups that country-coder lists for each country.
const CONTINENT_BY_GROUP: [string, Continent][] = [
  ['142', 'Asia'],
  ['150', 'Europe'],
  ['002', 'Africa'],
  ['009', 'Oceania'],
  ['005', 'South America'],
  ['003', 'North America'],
];
const SHORT_NAMES: Record<string, string> = { US: 'United States', GB: 'United Kingdom', CD: 'DR Congo' };

export interface CountryInfo {
  code: string;
  name: string;
  continent: Continent;
}

type CountryFeature = { properties: { iso1A2?: string; nameEn?: string; groups?: string[] } } | null;
const find = (q: string | [number, number]) => feature(q, { level: 'territory' }) as CountryFeature;

const infoCache = new Map<string, CountryInfo | null>();
/** Name and continent of an ISO 3166-1 alpha-2 code (e.g. "JP"), or null. */
export function countryInfo(code: string): CountryInfo | null {
  if (!infoCache.has(code)) {
    const f = find(code);
    const p = f?.properties;
    const continent = CONTINENT_BY_GROUP.find(([g]) => p?.groups?.includes(g))?.[1];
    infoCache.set(code, p?.iso1A2 && continent ? { code: p.iso1A2, name: SHORT_NAMES[p.iso1A2] ?? p.nameEn ?? p.iso1A2, continent } : null);
  }
  return infoCache.get(code) ?? null;
}

function fromLocation(l: Locale): string | null {
  if (!Number.isFinite(l.latitude) || !Number.isFinite(l.longitude) || (l.latitude === 0 && l.longitude === 0)) return null;
  return find([l.longitude, l.latitude])?.properties.iso1A2 ?? null;
}

function fromAddress(address: string): string | null {
  const parts = address.split(',').map((s) => s.replace(/[\d().]+/g, ' ').trim()).filter((s) => s.length > 2);
  for (const part of parts.slice(-2).reverse()) {
    const code = find(part)?.properties.iso1A2;
    if (code && countryInfo(code)) return code;
  }
  return null;
}

/** Country code of every congregation (locale id → ISO code). */
export function buildCountryIndex(locales: Locale[]): Map<string, string> {
  const index = new Map<string, string>();
  const pending: Locale[] = [];
  const byDistrict = new Map<string, Map<string, number>>();
  for (const l of locales) {
    const code = fromLocation(l) ?? fromAddress(l.address);
    if (!code || !countryInfo(code)) {
      pending.push(l);
      continue;
    }
    index.set(l.id, code);
    const counts = byDistrict.get(l.district_id) ?? new Map<string, number>();
    counts.set(code, (counts.get(code) ?? 0) + 1);
    byDistrict.set(l.district_id, counts);
  }
  for (const l of pending) {
    const counts = byDistrict.get(l.district_id);
    const top = counts && [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (top) index.set(l.id, top);
  }
  return index;
}

export type Counts = [number, number, number]; // local, extension, GWS
const KIND_INDEX = { local_congregation: 0, extension: 1, group_worship_service: 2 } as const;

export interface CountryStat extends CountryInfo {
  counts: Counts;
  total: number;
  /** Districts with at least one congregation in this country. */
  districts: number;
}

export interface ContinentStat {
  name: Continent;
  countries: number;
  counts: Counts;
  total: number;
}

export interface CountrySummary {
  countries: CountryStat[];
  continents: ContinentStat[];
}

export function summarizeCountries(locales: Locale[], index: Map<string, string>, districts: District[]): CountrySummary {
  const stats = new Map<string, CountryStat & { districtIds: Set<string> }>();
  const known = new Set(districts.map((d) => d.id));
  for (const l of locales) {
    const code = index.get(l.id);
    const info = code ? countryInfo(code) : null;
    if (!info) continue;
    let s = stats.get(info.code);
    if (!s) stats.set(info.code, (s = { ...info, counts: [0, 0, 0], total: 0, districts: 0, districtIds: new Set() }));
    s.counts[KIND_INDEX[l.kind]]++;
    s.total++;
    if (known.has(l.district_id)) s.districtIds.add(l.district_id);
  }
  const countries: CountryStat[] = [...stats.values()]
    .map(({ districtIds, ...s }) => ({ ...s, districts: districtIds.size }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  const continents: ContinentStat[] = CONTINENTS.map((name) => {
    const cs = countries.filter((c) => c.continent === name);
    const counts: Counts = [0, 0, 0];
    for (const c of cs) for (let i = 0; i < 3; i++) counts[i] += c.counts[i];
    return { name, countries: cs.length, counts, total: counts[0] + counts[1] + counts[2] };
  }).filter((c) => c.countries > 0);
  return { countries, continents };
}
