'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Globe2, Search, ChevronDown, ChevronRight, ListFilter, ArrowLeft, Clock, X, List, Map as MapIcon, SlidersHorizontal, MapPin } from 'lucide-react';
import { Region, District, WorldArea, LocaleKind } from '@/lib/types';
import { findNextService, formatCountdown, ONGOING_LABEL, shiftSlot } from '@/lib/next-service';
import { formatTime12Hour } from '@/lib/time';
import { formatDistance } from '@/lib/geo';
import { activeFilterCount, parseFilters, writeFilters, type AdvancedFilters, type FilterResult, type SortKey } from '@/lib/locale-filter';
import { useDistrictHoverCard } from '@/components/DistrictHoverCard';
import { useUserLocation } from '@/components/LocationProvider';
import { AdvancedFiltersPanel, DAY_SHORT, FilterSummary, myTimeZone, refClockLabel, type FilterArea } from '@/components/districts/AdvancedFilters';
import { CountryDirectory } from '@/components/districts/CountryDirectory';
import type { CountrySummary } from '@/lib/countries';

// Leaflet only runs in the browser; load the map view on demand.
const DirectoryMapView = dynamic(
  () => import('@/components/districts/DirectoryMapView').then((m) => m.DirectoryMapView),
  { ssr: false, loading: () => <div className="glass-card h-[55dvh] animate-pulse" /> }
);

type KindCounts = Record<LocaleKind, number>;
type KindFilter = 'all' | LocaleKind;

interface GroupedArea {
  area: WorldArea;
  title: string;
  regions: {
    region: Region;
    districts: (District & { locale_count: number; kind_counts: KindCounts })[];
  }[];
}

const KIND_OPTIONS: { id: KindFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'local_congregation', label: 'Local congregations' },
  { id: 'extension', label: 'Extensions' },
  { id: 'group_worship_service', label: 'GWS' },
];

const KIND_INDEX: Record<LocaleKind, number> = { local_congregation: 0, extension: 1, group_worship_service: 2 };

const SORT_LABEL: Record<SortKey, string> = {
  relevance: 'Best match',
  name: 'Name (A–Z)',
  nearest: 'Nearest to you',
  soonest: 'Soonest service',
  services: 'Most services',
};

const KIND_BADGE: Record<LocaleKind, string> = {
  local_congregation: 'Local',
  extension: 'Ext',
  group_worship_service: 'GWS',
};

/** Congregation search starts at this many characters; shorter queries only filter district names. */
const MIN_LOCALE_QUERY = 2;
const RESULT_LIMIT = 40;

// useSearchParams needs a Suspense boundary on a statically rendered page.
export default function DistrictsPage() {
  return (
    <Suspense fallback={null}>
      <DistrictsView />
    </Suspense>
  );
}

const KIND_IDS: KindFilter[] = ['all', 'local_congregation', 'extension', 'group_worship_service'];

function DistrictsView() {
  const router = useRouter();
  const [grouped, setGrouped] = useState<GroupedArea[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '');
  const kindFromUrl = (p: URLSearchParams): KindFilter => {
    const k = p.get('kind') as KindFilter | null;
    return k && KIND_IDS.includes(k) ? k : 'all';
  };
  const [kind, setKind] = useState<KindFilter>(() => kindFromUrl(searchParams));

  // ?q= and ?kind= (e.g. voice commands: "Show GWS in the Central Luzon region") also apply when
  // the URL changes while this page is open.
  // List or world map (?view=map opens the map directly).
  const [view, setView] = useState<'list' | 'map'>(() => (searchParams.get('view') === 'map' ? 'map' : 'list'));
  const [appliedParams, setAppliedParams] = useState(searchParams);
  if (searchParams !== appliedParams) {
    setAppliedParams(searchParams);
    setSearchQuery(searchParams.get('q') ?? '');
    setKind(kindFromUrl(searchParams));
    setView(searchParams.get('view') === 'map' ? 'map' : 'list');
  }
  const { linkProps, card: hoverCard } = useDistrictHoverCard(kind);
  const { location } = useUserLocation();
  const [expandedRegions, setExpandedRegions] = useState<{ [regId: string]: boolean }>({
    'reg-national-capital-region': true, // NCR expanded by default
  });

  // Advanced filters live in the URL (?day=0&time=morning&lang=English…), so a filtered view can be
  // bookmarked or shared; changing one replaces the URL.
  const adv = useMemo(() => parseFilters(new URLSearchParams(searchParams.toString())), [searchParams]);
  const advCount = activeFilterCount(adv);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const replaceParams = (change: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(searchParams.toString());
    change(p);
    const put = (k: string, v: string) => (v ? p.set(k, v) : p.delete(k));
    put('q', searchQuery.trim());
    put('kind', kind === 'all' ? '' : kind);
    put('view', view === 'map' ? 'map' : '');
    const qs = p.toString();
    router.replace(`/districts${qs ? `?${qs}` : ''}`, { scroll: false });
  };
  const setAdv = (next: AdvancedFilters) => replaceParams((p) => writeFilters(p, next));

  // Browse by region (districts) or by country (?group=country, e.g. from the dashboard).
  const group: 'region' | 'country' = searchParams.get('group') === 'country' ? 'country' : 'region';
  const setGroup = (g: 'region' | 'country') => replaceParams((p) => (g === 'country' ? p.set('group', 'country') : p.delete('group')));
  const needCountries = group === 'country' || filtersOpen || !!adv.country;
  const [countries, setCountries] = useState<CountrySummary | null>(null);
  useEffect(() => {
    if (!needCountries || countries) return;
    let alive = true;
    fetch('/api/countries')
      .then((r) => r.json())
      .then((d: CountrySummary) => alive && d.countries && setCountries(d))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [needCountries, countries]);

  useEffect(() => {
    fetch('/api/regions/grouped')
      .then((r) => r.json())
      .then((data) => {
        if (data.grouped) {
          setGrouped(data.grouped);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const q = searchQuery.toLowerCase().trim();
  const regionNames = useMemo(
    () => new Set(grouped.flatMap((g) => g.regions.map((r) => r.region.name.toLowerCase()))),
    [grouped]
  );
  const searchingLocales = q.length >= MIN_LOCALE_QUERY && !regionNames.has(q);
  const showResults = searchingLocales || advCount > 0;
  const withSlugs = view === 'map' && advCount > 0;

  // "Show more" pages; back to the first page whenever the search or filters change.
  const [pages, setPages] = useState(1);
  const resetKey = `${searchParams.toString()}|${q}|${kind}`;
  const [pageKey, setPageKey] = useState(resetKey);
  if (pageKey !== resetKey) {
    setPageKey(resetKey);
    setPages(1);
  }

  // Congregation search + advanced filters (debounced; stale responses are discarded). Also runs
  // while the filter panel is open, for the counts next to each option.
  const fetchParams = useMemo(() => {
    if (!showResults && !withSlugs && !filtersOpen) return null;
    const p = writeFilters(new URLSearchParams(), adv);
    if (searchingLocales) p.set('q', q);
    if (kind !== 'all') p.set('kind', kind);
    p.set('lat', location.lat.toFixed(5));
    p.set('lng', location.lng.toFixed(5));
    p.set('limit', String(RESULT_LIMIT * pages));
    if (withSlugs) p.set('slugs', '1');
    if (adv.tz === 'mine') p.set('mytz', myTimeZone());
    return p.toString();
  }, [adv, searchingLocales, q, kind, location.lat, location.lng, pages, withSlugs, showResults, filtersOpen]);
  const [filterRes, setFilterRes] = useState<{ key: string; data: FilterResult } | null>(null);
  useEffect(() => {
    if (!fetchParams) return;
    const ctrl = new AbortController();
    const t = window.setTimeout(() => {
      fetch(`/api/locales/filter?${fetchParams}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d: FilterResult) => setFilterRes({ key: fetchParams, data: d }))
        .catch(() => undefined);
    }, 150);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [fetchParams]);
  const currentResults = filterRes && filterRes.key === fetchParams ? filterRes.data : null;
  // The last answer stays on screen (dimmed) while the next one loads.
  const shownResults = currentResults ?? filterRes?.data ?? null;
  const slugSet = useMemo(() => (filterRes?.data.slugs ? new Set(filterRes.data.slugs) : null), [filterRes]);

  const areas: FilterArea[] = useMemo(
    () =>
      grouped.map((g) => ({
        title: g.title,
        regions: g.regions.map((r) => ({ id: r.region.id, name: r.region.name, districts: r.districts.map((d) => ({ slug: d.slug, name: d.name })) })),
      })),
    [grouped]
  );
  const sortValue: SortKey = adv.sort ?? (searchingLocales ? 'relevance' : adv.near ? 'nearest' : 'name');

  // Totals per kind across the whole directory (for the filter pills).
  const kindTotals = useMemo(() => {
    const totals: Record<KindFilter, number> = { all: 0, local_congregation: 0, extension: 0, group_worship_service: 0 };
    for (const g of grouped)
      for (const r of g.regions)
        for (const d of r.districts) {
          totals.all += d.locale_count;
          totals.local_congregation += d.kind_counts.local_congregation;
          totals.extension += d.kind_counts.extension;
          totals.group_worship_service += d.kind_counts.group_worship_service;
        }
    return totals;
  }, [grouped]);

  // With advanced filters, districts list (and count) only their matching congregations.
  const matchCounts = advCount > 0 ? shownResults?.byDistrict : undefined;
  const countFor = (d: District & { locale_count: number; kind_counts: KindCounts }) => {
    if (matchCounts) {
      const c = matchCounts[d.id];
      return !c ? 0 : kind === 'all' ? c[0] + c[1] + c[2] : c[KIND_INDEX[kind]];
    }
    return kind === 'all' ? d.locale_count : d.kind_counts[kind];
  };

  // A district is listed when its name matches the search and it has locales of the chosen kind.
  // A search also matches the district's region name ("Central Luzon" lists all its districts).
  const districtMatches = (d: District & { locale_count: number; kind_counts: KindCounts }, regionName = '') =>
    matchCounts
      ? countFor(d) > 0
      : (!q || d.name.toLowerCase().includes(q) || regionName.toLowerCase().includes(q)) && (kind === 'all' || d.kind_counts[kind] > 0);
  const pillCounts: Record<KindFilter, number> = showResults && shownResults ? shownResults.facets.kind : kindTotals;

  const toggleRegion = (regId: string) => {
    setExpandedRegions((prev) => ({
      ...prev,
      [regId]: !prev[regId],
    }));
  };

  const filtering = !!q || kind !== 'all' || advCount > 0;
  const kindLabel = KIND_OPTIONS.find((o) => o.id === kind)!.label.toLowerCase();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Header & Search */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#A9B4C2] hover:text-white transition-colors mb-2"
            >
              <ArrowLeft size={14} />
              <span>Dashboard</span>
            </button>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
              <Globe2 className="text-[#5AA9FF]" size={28} />
              <span>{group === 'country' ? 'Countries & Territories' : 'Districts By World Region'}</span>
            </h1>
            <p className="text-xs sm:text-sm text-[#A9B4C2] mt-0.5">
              {group === 'country'
                ? 'Every country and territory with Iglesia Ni Cristo congregations, by continent. Pick one to list its congregations.'
                : 'Browse Iglesia Ni Cristo ecclesiastical districts (hover one to preview its congregations), or search any congregation worldwide.'}
            </p>
          </div>

          {/* Search districts & congregations */}
          <div className={`relative w-full sm:w-96 ${view === 'map' ? 'hidden' : ''}`}>
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A9B4C2]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search districts or congregations..."
              aria-label="Search districts or congregations"
              className="w-full bg-white/5 border border-white/15 rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder-[#A9B4C2]/60 focus:outline-none focus:border-[#5AA9FF] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-[#A9B4C2] hover:text-white"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div role="tablist" aria-label="Browse by" className="flex w-fit items-center rounded-xl border border-white/15 bg-white/5 p-1 text-sm font-semibold">
          {(
            [
              { id: 'region', label: 'By region' },
              { id: 'country', label: 'By country' },
            ] as const
          ).map((g) => (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={group === g.id}
              onClick={() => setGroup(g.id)}
              className={`rounded-lg px-3.5 py-1.5 transition-colors ${group === g.id ? 'bg-[#5AA9FF] text-[#0B1426]' : 'text-[#A9B4C2] hover:text-white'}`}
            >
              {g.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Kind filter */}
        <div role="group" aria-label="Filter by type" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {KIND_OPTIONS.map((o) => {
            const active = kind === o.id;
            return (
              <button
                key={o.id}
                type="button"
                aria-pressed={active}
                onClick={() => setKind(o.id)}
                className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  active
                    ? 'border-transparent bg-[#E8A33D] text-[#0B1426]'
                    : 'border-white/15 bg-white/5 text-[#A9B4C2] hover:text-white hover:bg-white/10'
                }`}
              >
                {o.label}{' '}
                <span className="font-departure text-xs font-normal opacity-75">
                  {loading ? '' : pillCounts[o.id].toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          aria-expanded={filtersOpen}
          className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
            filtersOpen || advCount > 0 ? 'border-[#E8A33D]/60 bg-[#E8A33D]/10 text-[#E8A33D]' : 'border-white/15 bg-white/5 text-[#A9B4C2] hover:text-white'
          }`}
        >
          <SlidersHorizontal size={15} />
          Filters
          {advCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#E8A33D] px-1 text-[11px] font-bold text-[#0B1426]">{advCount}</span>}
        </button>

        {/* List | Map */}
        <div role="group" aria-label="View" className="flex items-center rounded-xl border border-white/15 bg-white/5 p-1 text-sm font-semibold">
          {(
            [
              { id: 'list', label: 'List', Icon: List },
              { id: 'map', label: 'Map', Icon: MapIcon },
            ] as const
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={view === id}
              onClick={() => setView(id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-colors ${
                view === id ? 'bg-[#E8A33D] text-[#0B1426]' : 'text-[#A9B4C2] hover:text-white'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
        </div>
        </div>

        <FilterSummary filters={adv} areas={areas} countries={countries?.countries} onChange={setAdv} />
      </div>

      {filtersOpen && (
        <AdvancedFiltersPanel
          filters={adv}
          facets={shownResults?.facets ?? null}
          areas={areas}
          countries={countries?.countries}
          locationName={location.name}
          total={currentResults ? currentResults.total : null}
          onChange={setAdv}
          onClose={() => {
            setFiltersOpen(false);
            if (showResults) document.getElementById('locale-results-h')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        />
      )}

      {view === 'map' && <DirectoryMapView kind={kind} onlySlugs={advCount > 0 ? slugSet : null} />}

      {/* Congregation results (instant search) */}
      {view === 'list' && showResults && (
        <section aria-labelledby="locale-results-h" className="glass-panel p-5 border border-white/15 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="min-w-0">
              <h2 id="locale-results-h" className="scroll-mt-24 text-lg font-bold text-white tracking-tight">
                {advCount > 0 ? 'Matching ' : ''}
                {kind === 'all' ? (advCount > 0 ? 'congregations' : 'Congregations') : KIND_OPTIONS.find((o) => o.id === kind)!.label}
              </h2>
              <span className="text-xs text-[#A9B4C2] font-departure" aria-live="polite">
                {!shownResults
                  ? 'Searching…'
                  : `${shownResults.total.toLocaleString()} ${shownResults.total === 1 ? 'congregation' : 'congregations'}${
                      advCount > 0 ? ` · ${shownResults.services.toLocaleString()} matching services` : ''
                    }${shownResults.ref_tz ? ` · times in ${refClockLabel(adv.tz)}` : ''}`}
              </span>
            </div>
            <label className="flex items-center gap-2 text-xs text-[#A9B4C2]">
              Sort
              <select
                value={sortValue}
                onChange={(e) => setAdv({ ...adv, sort: e.target.value as SortKey })}
                className="rounded-lg border border-white/15 bg-[#0B1426] px-2 py-1.5 text-xs text-white focus:border-[#E8A33D] focus:outline-none"
              >
                {(Object.keys(SORT_LABEL) as SortKey[])
                  .filter((k) => k !== 'relevance' || searchingLocales)
                  .map((k) => (
                    <option key={k} value={k}>
                      {SORT_LABEL[k]}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          {shownResults && shownResults.locales.length === 0 ? (
            <div className="py-4 text-center text-sm text-[#A9B4C2] space-y-2">
              <p>
                No {kind === 'all' ? 'congregations' : kindLabel} match
                {searchingLocales ? <> &ldquo;{searchQuery.trim()}&rdquo;</> : null}
                {advCount > 0 ? ' these filters' : ''}.
              </p>
              {advCount > 0 && (
                <button type="button" onClick={() => setFiltersOpen(true)} className="text-xs font-semibold text-[#5AA9FF] hover:underline">
                  Adjust filters
                </button>
              )}
            </div>
          ) : (
            <ul className={`divide-y divide-white/5 transition-opacity ${currentResults ? '' : 'opacity-60'}`}>
              {(shownResults?.locales ?? []).map((l) => {
                const matched = l.matched ? (l.schedule ?? []).filter((i) => l.matched!.includes(i.id)) : null;
                const next = findNextService(matched ?? l.schedule, l.timezone);
                // In Philippine time / your time: the converted slot first, the congregation's own time after.
                const shift = l.ref_shift ?? 0;
                const slot = (day: number, start: string) => {
                  const s = shift ? shiftSlot(day, start, shift) : { day, time: start };
                  return `${DAY_SHORT[s.day]} ${formatTime12Hour(s.time)}`;
                };
                const localSlot = (day: number, start: string) => `${DAY_SHORT[day]} ${formatTime12Hour(start)}`;
                return (
                  <li key={l.id}>
                    <Link
                      href={`/locales/${l.id}`}
                      className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-white/5 transition-colors group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-semibold text-white group-hover:text-[#E8A33D] transition-colors">
                            {l.name}
                          </span>
                          <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-md border border-white/15 text-[#A9B4C2] font-semibold uppercase">
                            {KIND_BADGE[l.kind]}
                          </span>
                        </div>
                        <p className="truncate text-xs text-[#A9B4C2]">
                          {l.district_name} · {l.address}
                        </p>
                        {matched && matched.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {matched.slice(0, 4).map((i) => (
                              <span key={i.id} className="rounded-md border border-[#E8A33D]/30 bg-[#E8A33D]/10 px-1.5 py-0.5 font-departure text-[10.5px] text-[#E8A33D]">
                                {slot(i.day_of_week, i.start_time)} · {i.language2 ? `${i.language} / ${i.language2}` : i.language}
                                {i.is_cws || i.service_type === 'CWS' ? ' · CWS' : ''}
                                {shift !== 0 && <span className="opacity-70"> (local {localSlot(i.day_of_week, i.start_time)})</span>}
                              </span>
                            ))}
                            {matched.length > 4 && <span className="px-1 text-[10.5px] text-[#A9B4C2]">+{matched.length - 4} more</span>}
                          </div>
                        )}
                      </div>
                      <span className="hidden sm:flex shrink-0 flex-col items-end gap-0.5 font-departure text-xs">
                        <span className="flex items-center gap-1 text-[#E8A33D]">
                          <Clock size={12} />
                          {next
                            ? next.startsInMinutes <= 0
                              ? `${ONGOING_LABEL} · started ${slot(next.item.day_of_week, next.item.start_time).slice(4)}`
                              : next.startsInMinutes < 24 * 60
                                ? `${slot(next.item.day_of_week, next.item.start_time)} · ${formatCountdown(next.startsInMinutes)}`
                                : slot(next.item.day_of_week, next.item.start_time)
                            : 'No schedule'}
                        </span>
                        {next && shift !== 0 && (
                          <span className="text-[10.5px] text-[#A9B4C2]">local {localSlot(next.item.day_of_week, next.item.start_time)}</span>
                        )}
                        {l.distance_km !== undefined && (
                          <span className="flex items-center gap-1 text-[#A9B4C2]">
                            <MapPin size={11} />≈{formatDistance(l.distance_km)}
                          </span>
                        )}
                      </span>
                      <ChevronRight size={16} className="shrink-0 text-[#A9B4C2] group-hover:text-[#E8A33D]" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {shownResults && shownResults.total > shownResults.locales.length && (
            <button
              type="button"
              onClick={() => setPages((n) => n + 1)}
              disabled={!currentResults}
              className="btn-glass w-full py-2 text-xs disabled:opacity-50"
            >
              Show more ({(shownResults.total - shownResults.locales.length).toLocaleString()} more)
            </button>
          )}
        </section>
      )}

      {view === 'list' && group === 'country' && (
        <CountryDirectory
          summary={countries}
          kind={kind}
          selected={adv.country}
          onSelect={(code) => {
            setAdv({ ...adv, country: code });
            if (code) window.setTimeout(() => document.getElementById('locale-results-h')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 400);
          }}
        />
      )}

      {view === 'map' || group === 'country' ? null : loading ? (
        <div className="glass-card p-12 text-center text-[#A9B4C2]">
          Loading worldwide districts directory...
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => {
            // Check if this is Philippines Regions (nested accordions) or International (flat list)
            const isPhilippines = group.area === 'philippines';

            const matchingDistricts = group.regions.flatMap((r) => r.districts.filter((d) => districtMatches(d, r.region.name)));

            if (filtering && matchingDistricts.length === 0) {
              return null; // hide areas with nothing matching
            }

            return (
              <div key={group.area} className="glass-panel p-6 border border-white/15 space-y-4">
                {/* Area Heading */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#5AA9FF]" />
                    {group.title}
                  </h2>
                  <span className="text-xs text-[#A9B4C2] font-departure">
                    {matchingDistricts.length} {matchingDistricts.length === 1 ? 'district' : 'districts'}
                  </span>
                </div>

                {/* 1. International Districts (Americas, Europe, Australia-Oceania, Africa) */}
                {!isPhilippines && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-2.5 pt-1">
                    {matchingDistricts.map((district) => (
                      <Link
                        key={district.id}
                        href={`/districts/${district.slug}`}
                        {...linkProps(district.slug)}
                        className="text-sm font-semibold text-[#5AA9FF] hover:text-[#E8A33D] hover:underline transition-colors flex items-center justify-between py-1 group"
                      >
                        <span className="truncate">{district.name}</span>
                        {countFor(district) > 0 && (
                          <span className="text-[11px] text-[#A9B4C2] font-departure ml-2 shrink-0 group-hover:text-white">
                            ({countFor(district)})
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                )}

                {/* 2. Philippines Regions (Accordion rows with list icon) */}
                {isPhilippines && (
                  <div className="space-y-3 pt-1">
                    {group.regions.map((regItem) => {
                      const reg = regItem.region;
                      const distList = regItem.districts.filter((d) => districtMatches(d, reg.name));

                      if (filtering && distList.length === 0) return null;

                      const isExpanded = q || advCount > 0 ? true : !!expandedRegions[reg.id];

                      return (
                        <div
                          key={reg.id}
                          className="glass-card border border-white/10 rounded-xl overflow-hidden transition-all"
                        >
                          {/* Local Region Row Header */}
                          <button
                            onClick={() => toggleRegion(reg.id)}
                            className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-lg bg-[#3A6EA5]/20 text-[#5AA9FF] flex items-center justify-center">
                                <ListFilter size={15} />
                              </div>
                              <span className="font-bold text-white text-sm sm:text-base">
                                {reg.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-[#A9B4C2] font-departure">
                                {distList.length} districts
                              </span>
                              {isExpanded ? (
                                <ChevronDown size={18} className="text-[#A9B4C2]" />
                              ) : (
                                <ChevronRight size={18} className="text-[#A9B4C2]" />
                              )}
                            </div>
                          </button>

                          {/* Expanded District List */}
                          {isExpanded && (
                            <div className="p-4 pt-1 border-t border-white/5 bg-black/20 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-2.5">
                              {distList.map((district) => (
                                <Link
                                  key={district.id}
                                  href={`/districts/${district.slug}`}
                                  {...linkProps(district.slug)}
                                  className="text-xs sm:text-sm font-semibold text-[#5AA9FF] hover:text-[#E8A33D] hover:underline transition-colors flex items-center justify-between py-1 group"
                                >
                                  <span className="truncate">{district.name}</span>
                                  {countFor(district) > 0 && (
                                    <span className="text-[10px] text-[#A9B4C2] font-departure ml-2 shrink-0 group-hover:text-white">
                                      ({countFor(district)})
                                    </span>
                                  )}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {hoverCard}
    </div>
  );
}
