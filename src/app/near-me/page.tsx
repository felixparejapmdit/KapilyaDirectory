'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Filter, Navigation as NavIcon, ChevronRight, MapPin } from 'lucide-react';
import { Locale } from '@/lib/types';
import { LeafletMap } from '@/components/LeafletMap';
import { formatTime12Hour } from '@/lib/time';
import { directionsUrl, formatTravel } from '@/lib/geo';
import { useRoadDistances } from '@/lib/use-road-distances';
import { findNextService, formatCountdown } from '@/lib/next-service';
import { useUserLocation } from '@/components/LocationProvider';

const RADII_KM = [5, 10, 25, 50, 100];
const DAYS = [
  { v: '1', label: 'Monday' },
  { v: '2', label: 'Tuesday' },
  { v: '3', label: 'Wednesday' },
  { v: '4', label: 'Thursday' },
  { v: '5', label: 'Friday' },
  { v: '6', label: 'Saturday' },
  { v: '0', label: 'Sunday' },
];
const LANGUAGES = [
  'English',
  'Tagalog',
  'Cebuano',
  'Ilocano',
  'Hiligaynon',
  'Ilonggo',
  'Visayan',
  'Spanish',
  'Italian',
  'German',
  'French',
  'Portuguese',
  'Nihongo',
  'Korean',
  'Tagalog Sign',
  'English Sign',
];

const clock = (t: string) => formatTime12Hour(t).toLowerCase();

/** Re-renders every 30 s so countdowns stay current. */
function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export default function NearMePage() {
  const router = useRouter();
  const { location, detectGps } = useUserLocation();
  const now = useNow();
  const [locales, setLocales] = useState<Locale[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());

  // Search & Filter state — coords sync with global location
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: location.lat,
    lng: location.lng,
  });
  const [addressInput, setAddressInput] = useState('');
  const [radiusKm, setRadiusKm] = useState<number>(25);
  const [selectedDay, setSelectedDay] = useState<string>('all');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [selectedKind, setSelectedKind] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Sync coords when global location changes (from My Location picker in nav)
  useEffect(() => {
    setCoords({ lat: location.lat, lng: location.lng });
    setSelectedId(null);
  }, [location.lat, location.lng]);

  const fetchNearby = useCallback(
    async (lat = coords.lat, lng = coords.lng) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('lat', String(lat));
        params.set('lng', String(lng));
        params.set('radius', String(radiusKm));

        if (selectedDay !== 'all') params.set('day', selectedDay);
        if (selectedLanguage !== 'all') params.set('language', selectedLanguage);
        if (selectedKind !== 'all') params.set('kind', selectedKind);
        if (addressInput.trim()) params.set('q', addressInput.trim());
        params.set('limit', '60');

        const res = await fetch(`/api/locales/nearby?${params.toString()}`);
        const data = await res.json();
        const list: Locale[] = data.locales || [];
        setLocales(list);
        setSelectedId((cur) => (cur && list.some((l) => l.id === cur) ? cur : null));
      } catch (err) {
        console.error('Error fetching nearby locales:', err);
      } finally {
        setLoading(false);
      }
    },
    [coords.lat, coords.lng, radiusKm, selectedDay, selectedLanguage, selectedKind, addressInput]
  );

  useEffect(() => {
    fetchNearby();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords, radiusKm, selectedDay, selectedLanguage, selectedKind]);

  // Handle GPS location request — uses global detectGps + updates coords
  const handleUseGps = async () => {
    try {
      setLoading(true);
      const loc = await detectGps();
      setCoords({ lat: loc.lat, lng: loc.lng });
    } catch {
      setLoading(false);
    }
  };

  const select = useCallback((id: string) => {
    setSelectedId(id);
    rowRefs.current.get(id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, []);

  // First tap previews (row highlight + active pin + info box); a second tap opens the full schedule.
  const handleRowClick = (locale: Locale) => {
    if (selectedId === locale.id) router.push(`/locales/${locale.id}`);
    else select(locale.id);
  };

  // Driving distance/time from the search point (matches the route "Get directions" opens).
  const { roads, pending: roadsPending } = useRoadDistances(coords, locales);
  const ordered = useMemo(() => {
    if (roadsPending) return locales;
    const km = (l: Locale) => roads[l.id]?.km ?? l.distance_km ?? Infinity;
    return [...locales].sort((a, b) => km(a) - km(b));
  }, [locales, roads, roadsPending]);

  const selected = useMemo(() => locales.find((l) => l.id === selectedId) ?? null, [locales, selectedId]);
  const selectedNext = selected ? findNextService(selected.schedule, selected.timezone, now) : null;

  const infoCard = selected ? (
    <div className="kd-map-card pointer-events-auto rounded-2xl p-4">
      <p className="truncate text-lg font-bold text-white">{selected.name}</p>
      <p className="font-departure text-xs text-[#A9B4C2]">
        {roads[selected.id] === undefined ? '…' : formatTravel(roads[selected.id], selected.distance_km)}
        {selected.district_name ? ` · ${selected.district_name}` : ''}
      </p>

      <div className="mt-2">
        {!selectedNext ? (
          <span className="text-xs text-[#A9B4C2]">No schedule posted</span>
        ) : selectedNext.startsInMinutes <= 0 ? (
          <span className="badge-service-active">
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            In progress · started {clock(selectedNext.item.start_time)}
          </span>
        ) : selectedNext.startsInMinutes <= 60 ? (
          <span className="badge-service-active">
            <span className="font-departure">Starts {formatCountdown(selectedNext.startsInMinutes)}</span>
          </span>
        ) : (
          <span className="text-sm text-[#A9B4C2]">
            Next service{' '}
            <span className="font-departure font-semibold text-white">
              {selectedNext.item.day_name.slice(0, 3)} {clock(selectedNext.item.start_time)}
            </span>
            <span className="font-departure"> · {formatCountdown(selectedNext.startsInMinutes)}</span>
          </span>
        )}
      </div>

      {selectedNext && (
        <p className="font-departure mt-2 truncate text-xs text-[#A9B4C2]">
          {selectedNext.item.day_name}:{' '}
          {(selected.schedule ?? [])
            .filter((s) => s.day_of_week === selectedNext.item.day_of_week)
            .map((s) => clock(s.start_time))
            .join(' · ')}
        </p>
      )}

      <div className="mt-3.5 flex gap-2">
        <a
          href={directionsUrl(selected.latitude, selected.longitude, selected.name, coords)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-amber flex-1 !rounded-xl py-2.5 text-sm"
        >
          <NavIcon size={16} />
          <span>Get directions</span>
        </a>
        <Link href={`/locales/${selected.id}`} className="btn-glass flex-1 !rounded-xl py-2.5 text-sm">
          Full schedule
        </Link>
      </div>
    </div>
  ) : null;

  const map = (
    <LeafletMap
      locales={locales}
      selectedLocaleId={selectedId}
      onSelectLocale={(loc) => select(loc.id)}
      origin={coords}
    />
  );

  return (
    // Desktop: search + list on the left, full-height sticky map on the right (the reference layout).
    // Small screens: search, then map, then list.
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 gap-4 lg:gap-5 lg:grid-cols-[minmax(22rem,27rem)_1fr] lg:grid-rows-[auto_1fr]">
      {/* 1. SEARCH & FILTERS */}
      <div className="glass-panel p-4 border border-white/15 space-y-3 lg:col-start-1 lg:row-start-1">
        <div className="flex items-center gap-2">
          {/* Address / Search Input */}
          <div className="relative flex-1 min-w-0">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A9B4C2]" />
            <input
              type="text"
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchNearby()}
              placeholder="Search name, city, or district..."
              className="w-full bg-white/5 border border-white/15 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-[#A9B4C2]/60 focus:outline-none focus:border-[#E8A33D] transition-colors"
            />
          </div>

          {/* Geolocation Button */}
          <button
            onClick={handleUseGps}
            className="btn-amber shrink-0 !px-3 !py-2.5 !rounded-xl"
            title="Use my GPS location"
            aria-label="Use my GPS location"
          >
            <NavIcon size={18} />
          </button>

          {/* Advanced Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2.5 rounded-xl border transition-colors shrink-0 ${
              showFilters
                ? 'bg-[#E8A33D]/20 border-[#E8A33D] text-[#E8A33D]'
                : 'bg-white/5 border-white/15 text-[#A9B4C2] hover:text-white'
            }`}
            title="Filter days, languages, types"
            aria-label="Filters"
            aria-expanded={showFilters}
          >
            <Filter size={18} />
          </button>
        </div>

        {/* Radius Selector */}
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-xs text-[#A9B4C2] font-semibold">Radius</span>
          <div className="flex items-center gap-1.5">
            {RADII_KM.map((r) => (
              <button
                key={r}
                onClick={() => setRadiusKm(r)}
                aria-pressed={radiusKm === r}
                className={`px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-departure font-semibold whitespace-nowrap transition-all ${
                  radiusKm === r
                    ? 'bg-[#E8A33D] text-[#0B1426] shadow-md'
                    : 'bg-white/5 text-[#A9B4C2] hover:text-white hover:bg-white/10 border border-white/10'
                }`}
              >
                {r} km
              </button>
            ))}
          </div>
        </div>

        {/* Expandable Advanced Filters */}
        {showFilters && (
          <div className="pt-3 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#A9B4C2] mb-1">Worship Day</label>
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="w-full bg-[#0B1426] border border-white/15 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#E8A33D]"
              >
                <option value="all">Any Day</option>
                {DAYS.map((d) => (
                  <option key={d.v} value={d.v}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#A9B4C2] mb-1">Language</label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="w-full bg-[#0B1426] border border-white/15 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#E8A33D]"
              >
                <option value="all">All Languages</option>
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#A9B4C2] mb-1">Service Type</label>
              <select
                value={selectedKind}
                onChange={(e) => setSelectedKind(e.target.value)}
                className="w-full bg-[#0B1426] border border-white/15 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#E8A33D]"
              >
                <option value="all">All Types</option>
                <option value="local_congregation">Local Congregation</option>
                <option value="extension">Extension</option>
                <option value="group_worship_service">Group Worship Service (GWS)</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* 2. MAP + INFO BOX */}
      <div className="relative h-[52dvh] min-h-[380px] lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:self-start lg:sticky lg:top-28 lg:h-[calc(100dvh-9rem)] lg:min-h-[520px] rounded-[1.5rem] overflow-hidden border border-white/15 shadow-2xl">
        {map}
        {infoCard && (
          <div className="pointer-events-none absolute inset-x-3 bottom-3 lg:inset-x-4 lg:bottom-4 z-[500] mx-auto max-w-md">
            {infoCard}
          </div>
        )}
      </div>

      {/* 3. RESULTS LIST */}
      <div className="space-y-3 lg:col-start-1 lg:row-start-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-[#A9B4C2] uppercase tracking-wider" aria-live="polite">
            {loading ? 'Searching...' : `${locales.length} Locales Found`}
          </span>
          <span className="text-xs text-[#A9B4C2]">Nearest by road · within {radiusKm} km</span>
        </div>

        <div className="space-y-2 lg:max-h-[calc(100dvh-19rem)] lg:overflow-y-auto pr-1">
          {locales.length > 0 ? (
            ordered.map((locale) => {
              const isSelected = selectedId === locale.id;
              const next = findNextService(locale.schedule, locale.timezone, now);
              return (
                <button
                  key={locale.id}
                  type="button"
                  ref={(el) => {
                    if (el) rowRefs.current.set(locale.id, el);
                    else rowRefs.current.delete(locale.id);
                  }}
                  onClick={() => handleRowClick(locale)}
                  aria-pressed={isSelected}
                  className={`glass-card w-full text-left px-4 py-3 border transition-all cursor-pointer group flex items-center gap-3 ${
                    isSelected ? 'glass-row-selected shadow-lg' : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-bold text-white group-hover:text-[#E8A33D] transition-colors">
                        {locale.name}
                      </span>
                      {locale.kind !== 'local_congregation' && (
                        <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-md border border-white/15 text-[#A9B4C2] font-semibold uppercase">
                          {locale.kind === 'group_worship_service' ? 'GWS' : 'Ext'}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-[#A9B4C2]">{locale.district_name ?? locale.address}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="font-departure text-sm font-bold text-[#E8A33D]">
                      {roads[locale.id] === undefined ? (
                        <span className="inline-block h-3.5 w-16 rounded bg-white/10 animate-pulse align-middle" aria-label="Calculating road distance" />
                      ) : (
                        formatTravel(roads[locale.id], locale.distance_km)
                      )}
                    </span>
                    <span className="font-departure text-[11px] text-[#A9B4C2]">
                      {next
                        ? next.startsInMinutes <= 0
                          ? 'In progress'
                          : `${next.item.day_name.slice(0, 3)} ${clock(next.item.start_time)}`
                        : 'No schedule'}
                    </span>
                  </div>
                  {isSelected && <ChevronRight size={16} className="shrink-0 text-[#E8A33D]" />}
                </button>
              );
            })
          ) : !loading ? (
            <div className="glass-card p-10 text-center text-sm text-[#A9B4C2] space-y-3">
              <MapPin size={28} className="mx-auto text-[#A9B4C2]/50" />
              <p>No congregations found within {radiusKm} km matching these filters.</p>
              <button
                onClick={() => {
                  setRadiusKm(100);
                  setSelectedDay('all');
                  setSelectedLanguage('all');
                  setSelectedKind('all');
                  setAddressInput('');
                }}
                className="btn-amber text-xs px-3 py-1.5"
              >
                Reset Filters (100 km)
              </button>
            </div>
          ) : (
            [0, 1, 2, 3].map((i) => <div key={i} className="glass-card h-16 animate-pulse border border-white/10" />)
          )}
        </div>
      </div>
    </div>
  );
}
