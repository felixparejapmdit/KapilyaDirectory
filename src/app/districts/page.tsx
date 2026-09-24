'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Globe2,
  Search,
  ChevronDown,
  ChevronRight,
  ListFilter,
  ArrowLeft,
  Building2,
  MapPin,
} from 'lucide-react';
import { Region, District, WorldArea } from '@/lib/types';

interface GroupedArea {
  area: WorldArea;
  title: string;
  regions: {
    region: Region;
    districts: (District & { locale_count: number })[];
  }[];
}

export default function DistrictsPage() {
  const router = useRouter();
  const [grouped, setGrouped] = useState<GroupedArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
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

  const toggleRegion = (regId: string) => {
    setExpandedRegions((prev) => ({
      ...prev,
      [regId]: !prev[regId],
    }));
  };

  const q = searchQuery.toLowerCase().trim();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
            Browse Iglesia Ni Cristo ecclesiastical districts grouped by geographic area.
          </p>
        </div>

        {/* Search District */}
        <div className="relative w-full sm:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A9B4C2]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter district by name..."
            className="w-full bg-white/5 border border-white/15 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-[#A9B4C2]/60 focus:outline-none focus:border-[#5AA9FF] transition-colors"
          />
        </div>
      </div>

      {loading ? (
        <div className="glass-card p-12 text-center text-[#A9B4C2]">
          Loading worldwide districts directory...
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => {
            // Check if this is Philippines Regions (nested accordions) or International (flat list)
            const isPhilippines = group.area === 'philippines';

            // Filter districts in this area if search query present
            const allDistrictsInArea = group.regions.flatMap((r) => r.districts);
            const matchingDistricts = q
              ? allDistrictsInArea.filter((d) => d.name.toLowerCase().includes(q))
              : allDistrictsInArea;

            if (q && matchingDistricts.length === 0) {
              return null; // hide non-matching areas during search
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
                        {district.locale_count > 0 && (
                          <span className="text-[11px] text-[#A9B4C2] font-departure ml-2 shrink-0 group-hover:text-white">
                            ({district.locale_count})
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
                      const distList = q
                        ? regItem.districts.filter((d) => d.name.toLowerCase().includes(q))
                        : regItem.districts;

                      if (q && distList.length === 0) return null;

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
                                  {district.locale_count > 0 && (
                                    <span className="text-[10px] text-[#A9B4C2] font-departure ml-2 shrink-0 group-hover:text-white">
                                      ({district.locale_count})
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
