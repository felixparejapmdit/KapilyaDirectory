'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MapPin, ChevronDown, Crosshair, Search, Loader2 } from 'lucide-react';
import { useUserLocation, POPULAR_CITIES, UserLocation } from './LocationProvider';

export function LocationPicker() {
  const { location, setLocation, detectGps, isDetecting } = useUserLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle address / city / district search
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchInput.trim();
    if (!query) return;

    setIsSearching(true);
    try {
      // 1. Check if matches popular city
      const matchedCity = POPULAR_CITIES.find(
        (c) => c.name.toLowerCase().includes(query.toLowerCase())
      );
      if (matchedCity) {
        setLocation(matchedCity);
        setIsOpen(false);
        setSearchInput('');
        return;
      }

      // 2. Query Nominatim / OpenStreetMap geocoding with Philippines prioritize
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const item = data[0];
        const newLoc: UserLocation = {
          name: item.display_name.split(',')[0] || query,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
        };
        setLocation(newLoc);
        setIsOpen(false);
        setSearchInput('');
      } else {
        alert(`Location "${query}" not found. Please try another city or district.`);
      }
    } catch (err) {
      console.error('Search error:', err);
      // Fallback: search within popular cities
      const fallback = POPULAR_CITIES.find((c) =>
        c.name.toLowerCase().includes(query.toLowerCase())
      );
      if (fallback) {
        setLocation(fallback);
        setIsOpen(false);
      } else {
        alert('Could not search for location. Please check your network or pick a city from the list.');
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleUseMyLocation = async () => {
    try {
      await detectGps();
      setIsOpen(false);
    } catch {
      // Handled in provider alert
    }
  };

  const selectCity = (city: UserLocation) => {
    setLocation(city);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Trigger Button beside Dashboard in Menu Bar */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/10 hover:bg-white/15 text-white border border-white/20 transition-all shadow-sm group cursor-pointer location-trigger"
        title="Change my active location"
        aria-expanded={isOpen}
      >
        <MapPin size={14} className="text-[#3A82F6] shrink-0 fill-[#3A82F6]/30" />
        <span className="truncate max-w-[110px] sm:max-w-[140px]">
          {location.name === 'Quezon City' ? 'My location' : location.name}
        </span>
        <ChevronDown
          size={13}
          className={`text-gray-400 group-hover:text-white transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Popover Dropdown (Matches Image 1) */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-72 sm:w-80 rounded-2xl bg-[#FFFFFF] dark:bg-[#16233E] border border-gray-200 dark:border-white/15 shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150 text-slate-800 dark:text-slate-100">
          {/* Section 1: SEARCH A PLACE */}
          <div className="space-y-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 dark:text-gray-400 block">
              Search a place
            </span>

            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <div className="relative flex-1">
                <MapPin
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 fill-blue-500/20"
                />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Address, city, or district"
                  className="w-full bg-blue-50/50 dark:bg-white/5 border border-blue-200 dark:border-white/15 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching}
                className="bg-[#2563EB] hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-md transition-colors shrink-0 disabled:opacity-50"
              >
                {isSearching ? <Loader2 size={13} className="animate-spin" /> : 'Go'}
              </button>
            </form>

            {/* Use my location button */}
            <button
              onClick={handleUseMyLocation}
              disabled={isDetecting}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#2563EB] hover:text-blue-700 dark:text-blue-400 py-1 transition-colors cursor-pointer"
            >
              {isDetecting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Crosshair size={14} className="text-[#2563EB] dark:text-blue-400" />
              )}
              <span>{isDetecting ? 'Detecting GPS...' : 'Use my location'}</span>
            </button>
          </div>

          <div className="my-3 border-t border-gray-100 dark:border-white/10" />

          {/* Section 2: POPULAR CITIES */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 dark:text-gray-400 block px-1">
              Popular Cities
            </span>

            <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1">
              {POPULAR_CITIES.map((city) => {
                const isSelected =
                  location.lat.toFixed(3) === city.lat.toFixed(3) &&
                  location.lng.toFixed(3) === city.lng.toFixed(3);

                return (
                  <button
                    key={city.name}
                    onClick={() => selectCity(city)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-white/5'
                    }`}
                  >
                    <MapPin
                      size={14}
                      className={
                        isSelected
                          ? 'text-blue-600 dark:text-blue-400 fill-blue-600/30'
                          : 'text-gray-400 shrink-0'
                      }
                    />
                    <span className="truncate">{city.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
