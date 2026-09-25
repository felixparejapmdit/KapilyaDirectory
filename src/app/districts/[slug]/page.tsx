'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Building2, GitBranch, Users, MapPin, Clock, Search, ChevronRight, List, Map as MapIcon } from 'lucide-react';
import { District, Locale, LocaleKind, Region } from '@/lib/types';
import { formatTime12Hour } from '@/lib/time';

// Leaflet only runs in the browser; load the map view on demand.
const DirectoryMapView = dynamic(
  () => import('@/components/districts/DirectoryMapView').then((m) => m.DirectoryMapView),
  { ssr: false, loading: () => <div className="glass-card h-[55dvh] animate-pulse" /> }
);

type KindFilter = 'all' | LocaleKind;

const KIND_OPTIONS: { id: KindFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'local_congregation', label: 'Local congregations' },
  { id: 'extension', label: 'Extensions' },
  { id: 'group_worship_service', label: 'GWS' },
];

const KIND_STATS: { id: LocaleKind; label: string; color: string; Icon: typeof Building2 }[] = [
  { id: 'local_congregation', label: 'Local congregations', color: '#5AA9FF', Icon: Building2 },
  { id: 'extension', label: 'Extensions', color: '#E8A33D', Icon: GitBranch },
  { id: 'group_worship_service', label: 'GWS', color: '#4ADE80', Icon: Users },
];

const KIND_IDS: KindFilter[] = KIND_OPTIONS.map((o) => o.id);

interface DistrictDetailResponse extends District {
  region?: Region;
  locales: Locale[];
}

export default function DistrictLocalesPage() {
  return (
    <Suspense fallback={null}>
      <DistrictLocales />
    </Suspense>
  );
}

function DistrictLocales() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = params?.slug as string;

  const [district, setDistrict] = useState<DistrictDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const kindFromUrl = (p: URLSearchParams): KindFilter => {
    const k = p.get('kind') as KindFilter | null;
    return k && KIND_IDS.includes(k) ? k : 'all';
  };
  const [kindFilter, setKindFilter] = useState<KindFilter>(() => kindFromUrl(searchParams));
  // List or map (?view=map opens the map directly).
  const [view, setView] = useState<'list' | 'map'>(() => (searchParams.get('view') === 'map' ? 'map' : 'list'));
  const [appliedParams, setAppliedParams] = useState(searchParams);
  if (searchParams !== appliedParams) {
    setAppliedParams(searchParams);
    setKindFilter(kindFromUrl(searchParams));
    setView(searchParams.get('view') === 'map' ? 'map' : 'list');
  }

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/districts/${slug}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.district) {
          setDistrict(data.district);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 text-center text-[#A9B4C2] space-y-3">
        <div className="w-8 h-8 rounded-full border-2 border-[#5AA9FF] border-t-transparent animate-spin mx-auto" />
        <p>Loading district congregations...</p>
      </div>
    );
  }

  if (!district) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 text-center space-y-4">
        <h2 className="text-xl font-bold text-white">District Not Found</h2>
        <p className="text-sm text-[#A9B4C2]">The requested district could not be located.</p>
        <Link href="/districts" className="btn-amber text-xs px-4 py-2 inline-flex">
          Back to Districts
        </Link>
      </div>
    );
  }

  const kindCounts: Record<KindFilter, number> = { all: district.locales.length, local_congregation: 0, extension: 0, group_worship_service: 0 };
  for (const l of district.locales) kindCounts[l.kind]++;

  // Filter locales
  const q = searchQuery.toLowerCase().trim();
  const filteredLocales = district.locales.filter((l) => {
    const matchesSearch =
      !q || l.name.toLowerCase().includes(q) || l.address.toLowerCase().includes(q);
    const matchesKind = kindFilter === 'all' || l.kind === kindFilter;
    return matchesSearch && matchesKind;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Back to Districts Directory */}
      <button
        onClick={() => router.push('/districts')}
        className="flex items-center gap-1.5 text-xs font-semibold text-[#A9B4C2] hover:text-white transition-colors"
      >
        <ArrowLeft size={16} />
        <span>Back to Districts</span>
      </button>

      {/* 1. DISTRICT HERO HEADER */}
      <div className="glass-panel p-6 border border-white/20 bg-gradient-to-r from-[#16233E]/90 to-[#0B1426]/90 shadow-xl space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-[#5AA9FF] uppercase tracking-wider bg-[#3A6EA5]/20 px-2.5 py-0.5 rounded-full border border-[#3A6EA5]/30">
            Ecclesiastical District
          </span>
          {district.region && (
            <span className="text-xs text-[#A9B4C2] font-medium">• {district.region.name}</span>
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          {district.name}
        </h1>

        {/* Counts per type (tap one to filter the list) */}
        <div className="grid grid-cols-2 gap-2 pt-3 sm:grid-cols-4">
          <div className="kd-map-stat">
            <span className="kd-map-stat-label">Total</span>
            <span className="kd-map-stat-value">{district.locales.length.toLocaleString()}</span>
          </div>
          {KIND_STATS.map(({ id, label, color, Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={kindFilter === id}
              onClick={() => setKindFilter(kindFilter === id ? 'all' : id)}
              className={`kd-map-stat text-left transition-colors hover:bg-white/10 ${kindFilter === id ? 'ring-1 ring-[#E8A33D]' : ''}`}
            >
              <span className="kd-map-stat-label">
                <Icon size={12} style={{ color }} />
                {label}
              </span>
              <span className="kd-map-stat-value">{kindCounts[id].toLocaleString()}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 pt-1 text-xs text-[#A9B4C2]">
          <Clock size={14} className="text-emerald-400" />
          Timezone: {district.timezone}
        </div>
      </div>

      {/* 2. KIND FILTER + LIST | MAP */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Filter by type" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {KIND_OPTIONS.map((o) => {
            const active = kindFilter === o.id;
            return (
              <button
                key={o.id}
                type="button"
                aria-pressed={active}
                onClick={() => setKindFilter(o.id)}
                className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  active
                    ? 'border-transparent bg-[#E8A33D] text-[#0B1426]'
                    : 'border-white/15 bg-white/5 text-[#A9B4C2] hover:text-white hover:bg-white/10'
                }`}
              >
                {o.label} <span className="font-departure text-xs font-normal opacity-75">{kindCounts[o.id]}</span>
              </button>
            );
          })}
        </div>

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

      {view === 'map' && <DirectoryMapView kind={kindFilter} districtId={district.id} />}

      {/* 3. SEARCH */}
      {view === 'list' && (
      <div className="glass-panel p-4 border border-white/15">
        <div className="relative w-full">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A9B4C2]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search within ${district.name}...`}
            className="w-full bg-white/5 border border-white/15 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder-[#A9B4C2]/60 focus:outline-none focus:border-[#5AA9FF] transition-colors"
          />
        </div>
      </div>
      )}

      {/* 4. LOCALES LIST */}
      {view === 'list' && (
      <div className="space-y-3">
        {filteredLocales.length > 0 ? (
          filteredLocales.map((locale) => (
            <Link
              key={locale.id}
              href={`/locales/${locale.id}`}
              className="glass-card p-4 border border-white/10 hover:border-white/25 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-white text-base group-hover:text-[#E8A33D] transition-colors">
                    {locale.name}
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-[#A9B4C2] font-semibold uppercase">
                    {locale.kind.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-xs text-[#A9B4C2] flex items-center gap-1">
                  <MapPin size={13} className="shrink-0 text-[#E8A33D]" />
                  <span>{locale.address}</span>
                </p>
                {locale.schedule && locale.schedule.length > 0 && (
                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    {locale.schedule.slice(0, 3).map((s) => (
                      <span
                        key={s.id}
                        className="font-departure bg-[#0B1426] border border-white/10 px-2 py-0.5 rounded text-[11px] text-white"
                      >
                        {s.day_name.slice(0, 3)} {formatTime12Hour(s.start_time)}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 text-xs text-[#5AA9FF] font-semibold group-hover:translate-x-1 transition-transform shrink-0">
                <span>View Details</span>
                <ChevronRight size={16} />
              </div>
            </Link>
          ))
        ) : (
          <div className="glass-card p-8 text-center text-sm text-[#A9B4C2]">
            No congregations found matching your search in {district.name}.
          </div>
        )}
      </div>
      )}
    </div>
  );
}
