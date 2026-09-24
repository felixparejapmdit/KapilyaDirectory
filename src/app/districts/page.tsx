'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Globe2, Search, ChevronDown, ChevronRight, ListFilter, ArrowLeft, Clock, X } from 'lucide-react';
import { Region, District, WorldArea, Locale, LocaleKind } from '@/lib/types';
import { findNextService } from '@/lib/next-service';
import { formatTime12Hour } from '@/lib/time';

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

const KIND_BADGE: Record<LocaleKind, string> = {
  local_congregation: 'Local',
  extension: 'Ext',
  group_worship_service: 'GWS',
};

/** Congregation search starts at this many characters; shorter queries only filter district names. */
const MIN_LOCALE_QUERY = 2;
const RESULT_LIMIT = 40;

export default function DistrictsPage() {
  const router = useRouter();
  const [grouped, setGrouped] = useState<GroupedArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [kind, setKind] = useState<KindFilter>('all');
  const [results, setResults] = useState<{ query: string; kind: KindFilter; total: number; locales: Locale[] } | null>(null);
  const [expandedRegions, setExpandedRegions] = useState<{ [regId: string]: boolean }>({
    'reg-ncr': true, // NCR expanded by default
  });

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
  const searchingLocales = q.length >= MIN_LOCALE_QUERY;

  // Instant congregation search (debounced; stale responses are discarded).
  useEffect(() => {
    if (!searchingLocales) return;
    const ctrl = new AbortController();
    const t = window.setTimeout(() => {
      const params = new URLSearchParams({ q, limit: String(RESULT_LIMIT) });
      if (kind !== 'all') params.set('kind', kind);
      fetch(`/api/locales/search?${params}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d) => setResults({ query: q, kind, total: d.total ?? 0, locales: d.locales ?? [] }))
        .catch(() => undefined);
    }, 180);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [q, kind, searchingLocales]);

  const currentResults = results && results.query === q && results.kind === kind ? results : null;

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

  const countFor = (d: { locale_count: number; kind_counts: KindCounts }) =>
    kind === 'all' ? d.locale_count : d.kind_counts[kind];

  // A district is listed when its name matches the search and it has locales of the chosen kind.
  const districtMatches = (d: District & { locale_count: number; kind_counts: KindCounts }) =>
    (!q || d.name.toLowerCase().includes(q)) && (kind === 'all' || d.kind_counts[kind] > 0);

  const toggleRegion = (regId: string) => {
    setExpandedRegions((prev) => ({
      ...prev,
      [regId]: !prev[regId],
    }));
  };

  const filtering = !!q || kind !== 'all';
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
              <span>Districts By World Region</span>
            </h1>
            <p className="text-xs sm:text-sm text-[#A9B4C2] mt-0.5">
              Browse Iglesia Ni Cristo ecclesiastical districts, or search any congregation worldwide.
            </p>
          </div>

          {/* Search districts & congregations */}
          <div className="relative w-full sm:w-96">
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
                  {loading ? '' : kindTotals[o.id].toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Congregation results (instant search) */}
      {searchingLocales && (
        <section aria-labelledby="locale-results-h" className="glass-panel p-5 border border-white/15 space-y-3">
          <div className="flex items-baseline justify-between gap-3 border-b border-white/10 pb-3">
            <h2 id="locale-results-h" className="text-lg font-bold text-white tracking-tight">
              {kind === 'all' ? 'Congregations' : KIND_OPTIONS.find((o) => o.id === kind)!.label}
            </h2>
            <span className="text-xs text-[#A9B4C2] font-departure" aria-live="polite">
              {!currentResults
                ? 'Searching…'
                : `${currentResults.total.toLocaleString()} ${currentResults.total === 1 ? 'match' : 'matches'}${
                    currentResults.total > currentResults.locales.length ? ` · showing ${currentResults.locales.length}` : ''
                  }`}
            </span>
          </div>

          {currentResults && currentResults.locales.length === 0 ? (
            <p className="py-4 text-center text-sm text-[#A9B4C2]">
              No {kind === 'all' ? 'congregations' : kindLabel} match &ldquo;{searchQuery.trim()}&rdquo;.
            </p>
          ) : (
            <ul className="divide-y divide-white/5">
              {(currentResults?.locales ?? []).map((l) => {
                const next = findNextService(l.schedule, l.timezone);
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
                      </div>
                      <span className="hidden sm:flex shrink-0 items-center gap-1 font-departure text-xs text-[#E8A33D]">
                        <Clock size={12} />
                        {next ? `${next.item.day_name.slice(0, 3)} ${formatTime12Hour(next.item.start_time)}` : 'No schedule'}
                      </span>
                      <ChevronRight size={16} className="shrink-0 text-[#A9B4C2] group-hover:text-[#E8A33D]" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {loading ? (
        <div className="glass-card p-12 text-center text-[#A9B4C2]">
          Loading worldwide districts directory...
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => {
            // Check if this is Philippines Regions (nested accordions) or International (flat list)
            const isPhilippines = group.area === 'philippines';

            const matchingDistricts = group.regions.flatMap((r) => r.districts).filter(districtMatches);

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
                      const distList = regItem.districts.filter(districtMatches);

                      if (filtering && distList.length === 0) return null;

                      const isExpanded = q ? true : !!expandedRegions[reg.id];

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
    </div>
  );
}
