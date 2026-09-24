'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Compass,
  MapPin,
  Globe2,
  Clock,
  ArrowRight,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Calendar,
  Layers,
  Building,
  Navigation as NavigationIcon,
  Search,
} from 'lucide-react';
import { DirectoryTotals, NextServiceStatus, Locale } from '@/lib/types';
import { formatTime12Hour } from '@/lib/time';
import { useUserLocation } from '@/components/LocationProvider';
import { useSplash } from '@/components/SplashScreen';
import { useIsLocalhost } from '@/lib/use-is-localhost';
import { formatDistance } from '@/lib/geo';
import { findNextService } from '@/lib/next-service';

export default function DashboardPage() {
  const [totals, setTotals] = useState<DirectoryTotals | null>(null);
  const [nextService, setNextService] = useState<NextServiceStatus | null>(null);
  const [nearbyLocales, setNearbyLocales] = useState<Locale[]>([]);
  const [loading, setLoading] = useState(true);

  // Use global location context (driven by My Location picker in nav bar)
  const { location, ready: locationReady } = useUserLocation();
  const { completeStep } = useSplash();
  const isLocalhost = useIsLocalhost();
  const [statsLoaded, setStatsLoaded] = useState(false);

  const loadLocationData = useCallback(async (lat: number, lng: number) => {
    setLoading(true);
    try {
      const [nextRes, nearbyRes] = await Promise.all([
        fetch(`/api/status/next-service?lat=${lat}&lng=${lng}`).then((r) => r.json()),
        fetch(`/api/locales/nearby?lat=${lat}&lng=${lng}&radius=25&limit=3`).then((r) => r.json()),
      ]);

      setNextService(nextRes.nextService);
      setNearbyLocales(nearbyRes.locales?.slice(0, 3) || []);
    } catch (err) {
      console.error('Error loading location data:', err);
    } finally {
      setLoading(false);
      completeStep('congregations');
    }
  }, [completeStep]);

  // Re-fetch whenever location changes (from the My Location picker). Waits for the startup
  // location to settle so the first load uses the user's real position, not the default.
  useEffect(() => {
    if (!locationReady) return;
    loadLocationData(location.lat, location.lng);
  }, [locationReady, location.lat, location.lng, loadLocationData]);

  // Fetch directory totals once
  useEffect(() => {
    fetch('/api/stats')
      .then((r) => r.json())
      .then((d) => setTotals(d.totals))
      .catch((err) => console.error('Failed to load stats:', err))
      .finally(() => setStatsLoaded(true));
  }, []);

  // Dashboard is ready once its data has rendered; tell the splash after that frame paints.
  useEffect(() => {
    if (!statsLoaded || loading) return;
    const frame = requestAnimationFrame(() => completeStep('dashboard'));
    return () => cancelAnimationFrame(frame);
  }, [statsLoaded, loading, completeStep]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      
      {/* 1. TOP BANNER ROW — Nearest Service + Find Nearby (always visible side-by-side) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* LEFT: Nearest Scheduled Service */}
        <div className="lg:col-span-7 glass-panel p-5 border border-white/20 relative overflow-hidden bg-gradient-to-r from-[#16233E]/90 via-[#1F2A36]/80 to-[#0B1426]/90 shadow-xl">
          <div className="absolute right-0 top-0 w-64 h-full bg-gradient-to-l from-[#3F8F5F]/15 to-transparent pointer-events-none" />
          
          {loading ? (
            <div className="flex items-center gap-3 relative z-10">
              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                <Clock size={22} className="text-[#A9B4C2] animate-pulse" />
              </div>
              <div>
                <div className="h-4 w-32 bg-white/10 rounded animate-pulse mb-2" />
                <div className="h-6 w-48 bg-white/10 rounded animate-pulse" />
              </div>
            </div>
          ) : nextService ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-[#3F8F5F]/20 text-[#4ADE80] border border-[#3F8F5F]/40 flex items-center justify-center shrink-0 shadow-lg">
                  <Clock size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="badge-service-active">
                      <span className="w-2 h-2 rounded-full bg-[#4ADE80] animate-pulse" />
                      {nextService.statusText}
                    </span>
                    <span className="text-xs text-[#A9B4C2] font-medium hidden sm:inline">
                      Nearest scheduled service
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                    {nextService.locale.name}
                  </h2>
                  <p className="text-xs sm:text-sm text-[#A9B4C2] mt-0.5 line-clamp-1">
                    {nextService.scheduleItem.day_name} at {formatTime12Hour(nextService.scheduleItem.start_time)} (
                    {nextService.scheduleItem.language}
                    {nextService.scheduleItem.is_cws ? ', CWS' : ''}) • {nextService.locale.address}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/locales/${nextService.locale.id}`}
                  className="btn-amber text-xs sm:text-sm px-4 py-2.5 shadow-md"
                >
                  <span>View Schedule</span>
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3.5 relative z-10">
              <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-[#A9B4C2]">
                <Clock size={22} />
              </div>
              <div>
                <p className="font-semibold text-white">No upcoming services found nearby</p>
                <p className="text-xs text-[#A9B4C2] mt-0.5">
                  Try changing your location using <strong className="text-[#E8A33D]">My Location</strong> in the menu.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Find Nearby Worship Services — always visible */}
        <div className="lg:col-span-5 glass-panel p-5 border border-[#3A6EA5]/40 bg-gradient-to-br from-[#0B1426]/95 to-[#16233E]/80 flex flex-col justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#3A6EA5]/20 text-[#5AA9FF] border border-[#3A6EA5]/40 flex items-center justify-center shrink-0">
              <Search size={22} />
            </div>
            <div>
              <h3 className="font-bold text-white text-base leading-tight">Find Nearby Worship Services</h3>
              <p className="text-xs text-[#A9B4C2] mt-1 leading-relaxed">
                Live departure-board schedules for congregations near you — worldwide.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/near-me" className="btn-amber text-xs px-4 py-2.5 flex-1 text-center justify-center">
              <NavigationIcon size={14} />
              <span>Open Near Me Map</span>
            </Link>
            <Link href="/districts" className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 text-[#A9B4C2] hover:text-white border border-white/15 transition-colors">
              <Globe2 size={14} />
              <span>Districts</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 2. DIRECTORY TOTALS CARDS */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-sm font-bold text-[#A9B4C2] uppercase tracking-wider">
            Directory Overview
          </h3>
          <span className="text-xs text-[#A9B4C2]/80">Worldwide Source Data</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
          {/* Card 1: Regions Worldwide (Tappable -> Opens Districts By World Region) */}
          <Link
            href="/districts"
            className="glass-card p-4 border border-white/15 hover:border-[#E8A33D]/50 hover:bg-[#E8A33D]/10 transition-all flex flex-col justify-between group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-[#A9B4C2] group-hover:text-white transition-colors">
                Regions Worldwide
              </span>
              <ChevronRight
                size={16}
                className="text-[#E8A33D] group-hover:translate-x-1 transition-transform"
              />
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-white font-departure tracking-tight">
                {(totals?.regions ?? 21).toLocaleString()}
              </span>
              <span className="text-[11px] text-[#5AA9FF] font-semibold">Browse &rarr;</span>
            </div>
          </Link>

          {/* Card 2: Ecclesiastical Districts */}
          <div className="glass-card p-4 border border-white/10">
            <span className="block text-xs font-semibold text-[#A9B4C2] mb-2">
              Ecclesiastical Districts
            </span>
            <span className="text-3xl font-extrabold text-white font-departure tracking-tight">
              {(totals?.districts ?? 198).toLocaleString()}
            </span>
          </div>

          {/* Card 3: Local Congregations */}
          <div className="glass-card p-4 border border-white/10">
            <span className="block text-xs font-semibold text-[#A9B4C2] mb-2">
              Local Congregations
            </span>
            <span className="text-3xl font-extrabold text-white font-departure tracking-tight">
              {(totals?.locales ?? 6157).toLocaleString()}
            </span>
          </div>

          {/* Card 4: Extensions */}
          <div className="glass-card p-4 border border-white/10">
            <span className="block text-xs font-semibold text-[#A9B4C2] mb-2">Extensions</span>
            <span className="text-3xl font-extrabold text-white font-departure tracking-tight">
              {(totals?.extensions ?? 1083).toLocaleString()}
            </span>
          </div>

          {/* Card 5: Group Worship Services */}
          <div className="glass-card p-4 border border-white/10 col-span-2 md:col-span-1">
            <span className="block text-xs font-semibold text-[#A9B4C2] mb-2">
              Group Worship Services (GWS)
            </span>
            <span className="text-3xl font-extrabold text-white font-departure tracking-tight">
              {(totals?.group_worship_services ?? 1539).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* 3. TODAY'S SCHEDULE NEAR YOU + QUICK ACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Nearby Chapels Quick Board */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <MapPin size={18} className="text-[#E8A33D]" />
              <h3 className="font-bold text-white text-base">Closest Congregations</h3>
              {location.name && (
                <span className="text-xs text-[#A9B4C2] font-medium hidden sm:inline">
                  near <span className="text-[#E8A33D]">{location.name}</span>
                </span>
              )}
            </div>
            <Link
              href="/near-me"
              className="text-xs font-semibold text-[#5AA9FF] hover:underline flex items-center gap-1"
            >
              Open Full Map &rarr;
            </Link>
          </div>

          <div className="grid gap-3">
            {loading ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="glass-card p-4 border border-white/10 animate-pulse">
                  <div className="h-4 w-48 bg-white/10 rounded mb-2" />
                  <div className="h-3 w-64 bg-white/5 rounded" />
                </div>
              ))
            ) : nearbyLocales.length > 0 ? (
              nearbyLocales.map((locale) => (
                <Link
                  key={locale.id}
                  href={`/locales/${locale.id}`}
                  className="glass-card p-4 border border-white/10 hover:border-white/25 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-white text-base group-hover:text-[#E8A33D] transition-colors">
                        {locale.name}
                      </h4>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-[#A9B4C2] font-semibold uppercase">
                        {locale.kind.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-[#A9B4C2] line-clamp-1">{locale.address}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-white/80">
                      <span className="flex items-center gap-1 font-departure text-[#E8A33D]">
                        <Clock size={12} />
                        {(() => {
                          const next = findNextService(locale.schedule, locale.timezone);
                          return next
                            ? `Next: ${next.item.day_name} ${formatTime12Hour(next.item.start_time)}`
                            : 'No schedule posted';
                        })()}
                      </span>
                      <span>•</span>
                      <span>{locale.languages.join(', ')}</span>
                    </div>
                  </div>

                  <div className="sm:text-right shrink-0">
                    <span className="text-sm font-bold text-white font-departure block">
                      {formatDistance(locale.distance_km)}
                    </span>
                    <span className="text-[11px] text-[#5AA9FF] group-hover:underline">
                      View Schedule &rarr;
                    </span>
                  </div>
                </Link>
              ))
            ) : (
              <div className="glass-card p-6 text-center text-sm text-[#A9B4C2]">
                <MapPin size={32} className="mx-auto mb-2 text-[#A9B4C2]/40" />
                <p>No congregations found within 25 km.</p>
                <p className="text-xs mt-1">Try changing your location or increasing the search radius.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Quick Action Cards & System Health */}
        <div className="space-y-4">
          <div className="glass-card p-5 border border-white/15 bg-gradient-to-br from-[#16233E] to-[#0B1426] space-y-4">
            <h4 className="font-bold text-white text-base">Quick Wayfinding</h4>
            <div className="grid gap-2.5">
              <Link
                href="/near-me"
                className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#E8A33D]/20 text-[#E8A33D] flex items-center justify-center font-bold">
                    <NavigationIcon size={16} />
                  </div>
                  <div>
                    <span className="font-semibold text-white text-sm block">Near Me Search</span>
                    <span className="text-xs text-[#A9B4C2]">GPS or typed address</span>
                  </div>
                </div>
                <ChevronRight size={16} className="text-gray-400" />
              </Link>

              <Link
                href="/districts"
                className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#3A6EA5]/20 text-[#5AA9FF] flex items-center justify-center font-bold">
                    <Globe2 size={16} />
                  </div>
                  <div>
                    <span className="font-semibold text-white text-sm block">Districts Directory</span>
                    <span className="text-xs text-[#A9B4C2]">Grouped by World Region</span>
                  </div>
                </div>
                <ChevronRight size={16} className="text-gray-400" />
              </Link>

              <Link
                href="/saved"
                className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                    <Building size={16} />
                  </div>
                  <div>
                    <span className="font-semibold text-white text-sm block">Favorites &amp; Visited</span>
                    <span className="text-xs text-[#A9B4C2]">Track your home &amp; visits</span>
                  </div>
                </div>
                <ChevronRight size={16} className="text-gray-400" />
              </Link>
            </div>
          </div>

          {/* System & Data Health Card */}
          <div className="glass-card p-4 border border-white/10 text-xs text-[#A9B4C2] space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-semibold text-white">
                <ShieldCheck size={14} className="text-[#3F8F5F]" />
                Data Health: Verified
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#3F8F5F]/20 text-[#4ADE80] font-bold">
                AUTO-SYNCED
              </span>
            </div>
            <p className="leading-relaxed">
              Synchronized nightly with snapshot rollback protection. Schedules are rendered in each
              chapel&apos;s local timezone.
            </p>
            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
              <span>Active Snapshot: {totals?.last_snapshot_id || 'snap-seed-v1'}</span>
              {isLocalhost && (
                <Link href="/settings" className="text-[#E8A33D] hover:underline font-semibold">
                  Manage &rarr;
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
