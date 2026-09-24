'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building,
  MapPin,
  Clock,
  Search,
  Globe2,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { District, Locale, Region } from '@/lib/types';
import { formatTime12Hour } from '@/lib/time';

interface DistrictDetailResponse extends District {
  region?: Region;
  locales: Locale[];
}

export default function DistrictLocalesPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const [district, setDistrict] = useState<DistrictDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [kindFilter, setKindFilter] = useState('all');

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

        <div className="flex flex-wrap items-center gap-4 text-xs text-[#A9B4C2] pt-2">
          <span className="flex items-center gap-1.5 font-departure text-white">
            <Building size={14} className="text-[#E8A33D]" />
            {district.locales.length} Locales, Extensions & GWS
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5">
            <Clock size={14} className="text-emerald-400" />
            Timezone: {district.timezone}
          </span>
        </div>
      </div>

      {/* 2. SEARCH & KIND FILTER */}
      <div className="glass-panel p-4 border border-white/15 flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A9B4C2]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search within ${district.name}...`}
            className="w-full bg-white/5 border border-white/15 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder-[#A9B4C2]/60 focus:outline-none focus:border-[#5AA9FF] transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value)}
            className="w-full sm:w-auto bg-[#0B1426] border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#5AA9FF]"
          >
            <option value="all">All Types</option>
            <option value="local_congregation">Local Congregations</option>
            <option value="extension">Extensions</option>
            <option value="group_worship_service">Group Worship Services (GWS)</option>
          </select>
        </div>
      </div>

      {/* 3. LOCALES LIST */}
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
    </div>
  );
}
