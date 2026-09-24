'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Star,
  CheckCircle2,
  MapPin,
  Clock,
  ChevronRight,
  Trash2,
  Bookmark,
} from 'lucide-react';
import { Locale } from '@/lib/types';

export default function SavedPage() {
  const [activeTab, setActiveTab] = useState<'favorites' | 'visited'>('favorites');
  const [favorites, setFavorites] = useState<Locale[]>([]);
  const [visited, setVisited] = useState<Locale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSavedData();
  }, []);

  const loadSavedData = async () => {
    setLoading(true);
    try {
      const favIds: string[] = JSON.parse(localStorage.getItem('kapilya_favorites') || '[]');
      const visitedIds: string[] = JSON.parse(localStorage.getItem('kapilya_visited') || '[]');

      // Fetch details for all saved IDs
      const allIds = Array.from(new Set([...favIds, ...visitedIds]));
      if (allIds.length === 0) {
        setLoading(false);
        return;
      }

      const promises = allIds.map((id) =>
        fetch(`/api/locales/${id}`)
          .then((r) => r.json())
          .then((d) => d.locale)
          .catch(() => null)
      );

      const locales = (await Promise.all(promises)).filter(Boolean) as Locale[];

      setFavorites(locales.filter((l) => favIds.includes(l.id)));
      setVisited(locales.filter((l) => visitedIds.includes(l.id)));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const removeFavorite = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const updated = favorites.filter((l) => l.id !== id);
    setFavorites(updated);
    localStorage.setItem('kapilya_favorites', JSON.stringify(updated.map((l) => l.id)));
  };

  const removeVisited = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const updated = visited.filter((l) => l.id !== id);
    setVisited(updated);
    localStorage.setItem('kapilya_visited', JSON.stringify(updated.map((l) => l.id)));
  };

  const currentList = activeTab === 'favorites' ? favorites : visited;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
          <Bookmark className="text-[#E8A33D]" size={28} />
          <span>Favorites & Visited</span>
        </h1>
        <p className="text-xs sm:text-sm text-[#A9B4C2] mt-0.5">
          Your bookmarked home congregations and logged worship visits (stored locally on this device).
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-3">
        <button
          onClick={() => setActiveTab('favorites')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'favorites'
              ? 'bg-[#E8A33D] text-[#0B1426] shadow-md'
              : 'bg-white/5 text-[#A9B4C2] hover:text-white hover:bg-white/10'
          }`}
        >
          <Star size={16} fill={activeTab === 'favorites' ? 'currentColor' : 'none'} />
          <span>Favorites ({favorites.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('visited')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            activeTab === 'visited'
              ? 'bg-[#3F8F5F] text-white shadow-md'
              : 'bg-white/5 text-[#A9B4C2] hover:text-white hover:bg-white/10'
          }`}
        >
          <CheckCircle2 size={16} />
          <span>Visited History ({visited.length})</span>
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="glass-card p-12 text-center text-[#A9B4C2]">
          Loading saved congregations...
        </div>
      ) : currentList.length > 0 ? (
        <div className="space-y-3">
          {currentList.map((locale) => (
            <Link
              key={locale.id}
              href={`/locales/${locale.id}`}
              className="glass-card p-4 border border-white/10 hover:border-white/20 transition-all flex items-center justify-between gap-3 group"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
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
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={(e) =>
                    activeTab === 'favorites'
                      ? removeFavorite(locale.id, e)
                      : removeVisited(locale.id, e)
                  }
                  className="p-2 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-white/5 transition-colors"
                  title="Remove"
                >
                  <Trash2 size={16} />
                </button>
                <ChevronRight size={18} className="text-[#A9B4C2] group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="glass-panel p-12 text-center space-y-3 border border-white/10">
          <p className="text-[#A9B4C2] text-sm">
            {activeTab === 'favorites'
              ? 'You have not favorited any congregations yet.'
              : 'You have not marked any worship visits yet.'}
          </p>
          <Link href="/near-me" className="btn-amber text-xs px-4 py-2 inline-flex">
            Find Near Me
          </Link>
        </div>
      )}
    </div>
  );
}
