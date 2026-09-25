'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  MapPin,
  Phone,
  Mail,
  Clock,
  ExternalLink,
  Star,
  CheckCircle2,
  Bell,
  Navigation as NavIcon,
  Globe2,
  Calendar,
} from 'lucide-react';
import { Locale } from '@/lib/types';
import { DepartureBoard } from '@/components/DepartureBoard';
import { LeafletMap } from '@/components/LeafletMap';
import { directionsUrl, formatTravel, haversineKm } from '@/lib/geo';
import { useUserLocation } from '@/components/LocationProvider';
import { useRoadDistances } from '@/lib/use-road-distances';

export default function LocaleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [locale, setLocale] = useState<Locale | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isVisited, setIsVisited] = useState(false);
  const [reminderScheduled, setReminderScheduled] = useState(false);
  // Distance from the app's location, by road: the same trip Get Directions opens.
  const { location } = useUserLocation();
  const { roads } = useRoadDistances(location, locale ? [locale] : []);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/locales/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.locale) {
          setLocale(data.locale);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));

    // Check localStorage for favorite & visited
    if (typeof window !== 'undefined') {
      const favs = JSON.parse(localStorage.getItem('kapilya_favorites') || '[]');
      setIsFavorite(favs.includes(id));

      const visited = JSON.parse(localStorage.getItem('kapilya_visited') || '[]');
      setIsVisited(visited.includes(id));
    }
  }, [id]);

  const toggleFavorite = () => {
    const favs = JSON.parse(localStorage.getItem('kapilya_favorites') || '[]');
    let updated;
    if (isFavorite) {
      updated = favs.filter((item: string) => item !== id);
    } else {
      updated = [...favs, id];
    }
    localStorage.setItem('kapilya_favorites', JSON.stringify(updated));
    setIsFavorite(!isFavorite);
  };

  const toggleVisited = () => {
    const visited = JSON.parse(localStorage.getItem('kapilya_visited') || '[]');
    let updated;
    if (isVisited) {
      updated = visited.filter((item: string) => item !== id);
    } else {
      updated = [...visited, id];
    }
    localStorage.setItem('kapilya_visited', JSON.stringify(updated));
    setIsVisited(!isVisited);
  };

  const scheduleReminder = async () => {
    if (!('Notification' in window)) {
      alert('This browser does not support desktop notifications.');
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      new Notification(`Reminder scheduled for ${locale?.name}`, {
        body: `You will be notified 30 minutes before worship service starts.`,
      });
      setReminderScheduled(true);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center text-[#A9B4C2] space-y-3">
        <div className="w-8 h-8 rounded-full border-2 border-[#E8A33D] border-t-transparent animate-spin mx-auto" />
        <p>Loading congregation details...</p>
      </div>
    );
  }

  if (!locale) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center space-y-4">
        <h2 className="text-xl font-bold text-white">Congregation Not Found</h2>
        <p className="text-sm text-[#A9B4C2]">The requested locale could not be located.</p>
        <Link href="/near-me" className="btn-amber text-xs px-4 py-2 inline-flex">
          Back to Near Me
        </Link>
      </div>
    );
  }

  const mapsUrl = directionsUrl(locale.latitude, locale.longitude, locale.name, location);
  const road = roads[locale.id];
  const straightKm = haversineKm(location.lat, location.lng, locale.latitude, locale.longitude);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-xs font-semibold text-[#A9B4C2] hover:text-white transition-colors"
      >
        <ArrowLeft size={16} />
        <span>Back</span>
      </button>

      {/* 1. HERO HEADER */}
      <div className="glass-panel p-6 border border-white/20 relative overflow-hidden bg-gradient-to-br from-[#16233E]/95 via-[#1F2A36]/90 to-[#0B1426]/95 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#E8A33D]/20 text-[#E8A33D] font-bold uppercase tracking-wider border border-[#E8A33D]/30">
                {locale.kind.replace(/_/g, ' ')}
              </span>
              {locale.district_name && (
                <Link
                  href={`/districts/${locale.district_slug || locale.district_id}`}
                  className="text-xs text-[#5AA9FF] hover:underline font-semibold flex items-center gap-1"
                >
                  <Globe2 size={13} />
                  <span>District of {locale.district_name}</span>
                </Link>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {locale.name}
            </h1>
            <p className="text-xs sm:text-sm text-[#A9B4C2] flex items-center gap-1.5">
              <MapPin size={14} className="shrink-0 text-[#E8A33D]" />
              <span>{locale.address}</span>
            </p>
            <p className="text-xs text-[#A9B4C2] font-departure">
              {road === undefined ? 'Calculating road distance…' : `${formatTravel(road, straightKm)} from ${location.name}`}
            </p>
          </div>

          {/* Quick Actions (Favorite & Visited) */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={toggleFavorite}
              className={`p-2.5 rounded-xl border transition-all ${
                isFavorite
                  ? 'bg-[#E8A33D] text-[#0B1426] border-[#E8A33D]'
                  : 'bg-white/5 border-white/15 text-[#A9B4C2] hover:text-white'
              }`}
              title={isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
            >
              <Star size={18} fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
            <button
              onClick={toggleVisited}
              className={`p-2.5 rounded-xl border transition-all ${
                isVisited
                  ? 'bg-[#3F8F5F] text-white border-[#3F8F5F]'
                  : 'bg-white/5 border-white/15 text-[#A9B4C2] hover:text-white'
              }`}
              title={isVisited ? 'Marked as Visited' : 'Mark as Visited'}
            >
              <CheckCircle2 size={18} />
            </button>
          </div>
        </div>

        {/* Action CTAs */}
        <div className="flex flex-wrap items-center gap-3 pt-5 mt-5 border-t border-white/10">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-amber text-xs sm:text-sm px-5 py-2.5 shadow-lg flex-1 sm:flex-initial"
          >
            <ExternalLink size={16} />
            <span>Get Directions</span>
          </a>

          <button
            onClick={scheduleReminder}
            className={`btn-glass text-xs sm:text-sm px-4 py-2.5 flex-1 sm:flex-initial ${
              reminderScheduled ? 'text-[#4ADE80] border-[#3F8F5F]' : ''
            }`}
          >
            <Bell size={16} className={reminderScheduled ? 'text-[#4ADE80]' : 'text-[#E8A33D]'} />
            <span>{reminderScheduled ? 'Reminder Scheduled' : 'Remind me before service'}</span>
          </button>
        </div>
      </div>

      {/* 2. DEPARTURE-BOARD SCHEDULE TABLE */}
      <div className="glass-panel p-6 border border-white/15 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar size={20} className="text-[#E8A33D]" />
            <h2 className="text-lg font-bold text-white tracking-tight">Worship Service Schedule</h2>
          </div>
          <span className="text-xs text-[#A9B4C2] font-semibold">Local Departure Board</span>
        </div>

        <DepartureBoard schedule={locale.schedule} timezone={locale.timezone} />
      </div>

      {/* 3. CONTACT & LOCATION INFO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Contact Details */}
        <div className="glass-card p-5 border border-white/10 space-y-3">
          <h3 className="font-bold text-white text-base">Contact Information</h3>
          <div className="space-y-2.5 text-xs text-[#A9B4C2]">
            {locale.phone && (
              <div className="flex items-center gap-2.5">
                <Phone size={15} className="text-[#E8A33D]" />
                <a href={`tel:${locale.phone}`} className="text-white hover:underline">
                  {locale.phone}
                </a>
              </div>
            )}
            {locale.email && (
              <div className="flex items-center gap-2.5">
                <Mail size={15} className="text-[#5AA9FF]" />
                <a href={`mailto:${locale.email}`} className="text-white hover:underline">
                  {locale.email}
                </a>
              </div>
            )}
            <div className="flex items-center gap-2.5">
              <Clock size={15} className="text-emerald-400" />
              <span>Time Zone: {locale.timezone || 'Asia/Manila'}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Globe2 size={15} className="text-purple-400" />
              <span>Languages: {locale.languages.join(', ')}</span>
            </div>
          </div>
        </div>

        {/* Mini Interactive Map */}
        <div className="h-[220px] rounded-2xl overflow-hidden border border-white/15">
          <LeafletMap locales={[locale]} selectedLocaleId={locale.id} />
        </div>
      </div>
    </div>
  );
}
