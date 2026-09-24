'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Settings as SettingsIcon,
  Moon,
  Sun,
  Monitor,
  Eye,
  Clock,
  AlertTriangle,
  Database,
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  Send,
  Bell,
  ShieldAlert,
  Save,
  MapPin,
  Navigation as NavIcon,
} from 'lucide-react';
import { DataSnapshot } from '@/lib/types';
import { useTheme, type ThemePref } from '@/components/ThemeProvider';
import { useUserLocation, POPULAR_CITIES } from '@/components/LocationProvider';

interface SyncStatus {
  state: 'idle' | 'running';
  read_only?: boolean;
  phase: 'districts' | 'locales' | 'applying' | null;
  done: number;
  total: number;
  timezone: string;
  next_scheduled_at: string | null;
  last_sync: {
    finished_at: string;
    trigger: string;
    status: 'success' | 'partial' | 'failed';
    message: string;
    updated: number;
    added: number;
    removed: number;
  } | null;
}

const THEME_OPTIONS: { id: ThemePref; label: string; icon: typeof Moon }[] = [
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'system', label: 'System', icon: Monitor },
];

const PHASE_LABELS: Record<NonNullable<SyncStatus['phase']>, string> = {
  districts: 'Checking district listings…',
  locales: 'Fetching congregation pages…',
  applying: 'Saving updates…',
};

/** District listings are ~3% of the work, locale pages ~95%, saving the rest. */
function syncProgressPercent(s: SyncStatus): number {
  const frac = s.total > 0 ? s.done / s.total : 0;
  if (s.phase === 'districts') return Math.round(frac * 3);
  if (s.phase === 'locales') return Math.round(3 + frac * 95);
  return 99;
}

export default function SettingsPage() {
  const [snapshots, setSnapshots] = useState<DataSnapshot[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(true);
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const { theme, setTheme, reducedTransparency, setReducedTransparency } = useTheme();
  const syncing = sync?.state === 'running';
  const { location, setLocation, detectGps, isDetecting } = useUserLocation();
  const [citySearch, setCitySearch] = useState('');

  const fetchSnapshots = async () => {
    try {
      const res = await fetch('/api/snapshots');
      const data = await res.json();
      setSnapshots(data.snapshots || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSnapshots(false);
    }
  };

  const fetchSyncStatus = async () => {
    try {
      const res = await fetch('/api/ingest/run', { cache: 'no-store' });
      setSync(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSnapshots();
    fetchSyncStatus();
  }, []);

  // Poll while a sync runs; refresh snapshots once it finishes.
  useEffect(() => {
    if (!syncing) return;
    const id = window.setInterval(fetchSyncStatus, 2000);
    return () => {
      window.clearInterval(id);
      fetchSnapshots();
    };
  }, [syncing]);

  const handleRunSync = async () => {
    try {
      const res = await fetch('/api/ingest/run', { method: 'POST' });
      setSync(await res.json());
    } catch (err: unknown) {
      console.error('Could not start sync:', err);
    }
  };

  const handleCreateSnapshot = async () => {
    try {
      const res = await fetch('/api/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'Manual administrative backup' }),
      });
      const data = await res.json();
      if (data.success) {
        fetchSnapshots();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRestore = async (id: string) => {
    if (!confirm(`Are you sure you want to restore snapshot ${id}? Current database state will revert.`)) {
      return;
    }
    setRestoringId(id);
    try {
      const res = await fetch(`/api/snapshots/${id}/restore`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        fetchSnapshots();
      } else {
        alert(`Restore failed: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
          <SettingsIcon className="text-[#E8A33D]" size={28} />
          <span>Settings & Administration</span>
        </h1>
        <p className="text-xs sm:text-sm text-[#A9B4C2] mt-0.5">
          Configure your location, appearance, data snapshots, and connected channels.
        </p>
      </div>

      {/* 0. CURRENT LOCATION */}
      <div className="glass-panel p-5 border border-white/15 space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <MapPin size={18} className="text-[#E8A33D]" />
          <span>My Current Location</span>
        </h2>
        <p className="text-xs text-[#A9B4C2] -mt-2">
          Set your location to find the nearest worship services and congregations accurately. This is used across the entire app.
        </p>

        {/* Active location pill */}
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#E8A33D]/10 border border-[#E8A33D]/30">
          <MapPin size={16} className="text-[#E8A33D] shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-white text-sm block truncate">{location.name}</span>
            <span className="text-xs text-[#A9B4C2]">{location.lat.toFixed(4)}, {location.lng.toFixed(4)}</span>
          </div>
          {location.isGps && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#3F8F5F]/20 text-[#4ADE80] border border-[#3F8F5F]/30 font-bold">GPS</span>
          )}
        </div>

        {/* GPS Button */}
        <button
          onClick={() => detectGps()}
          disabled={isDetecting}
          className="btn-amber w-full flex items-center justify-center gap-2 py-2.5 disabled:opacity-50"
        >
          <NavIcon size={16} className={isDetecting ? 'animate-spin' : ''} />
          <span>{isDetecting ? 'Detecting GPS...' : 'Use My GPS Location'}</span>
        </button>

        {/* City search */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-[#A9B4C2] uppercase tracking-wider">Or select a city</label>
          <input
            type="text"
            value={citySearch}
            onChange={(e) => setCitySearch(e.target.value)}
            placeholder="Search city..."
            className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#A9B4C2]/60 focus:outline-none focus:border-[#E8A33D] transition-colors"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
            {POPULAR_CITIES
              .filter(c => c.name.toLowerCase().includes(citySearch.toLowerCase()))
              .map((city) => (
                <button
                  key={city.name}
                  onClick={() => setLocation(city)}
                  className={`text-left px-3 py-2.5 rounded-xl text-sm transition-all border ${
                    location.name === city.name
                      ? 'bg-[#E8A33D]/20 border-[#E8A33D]/50 text-[#E8A33D] font-semibold'
                      : 'bg-white/5 border-white/10 text-[#A9B4C2] hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <MapPin size={13} className="shrink-0 opacity-60" />
                    {city.name}
                  </span>
                </button>
              ))}
          </div>
        </div>
      </div>

      {/* 1. APPEARANCE */}
      <section aria-labelledby="appearance-h" className="glass-panel p-5 border border-white/15">
        <h2 id="appearance-h" className="mb-4 text-lg font-bold text-white flex items-center gap-2">
          <Eye size={20} className="text-[#A9B4C2]" />
          <span>Appearance</span>
        </h2>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-white">Theme</legend>
          <div className="grid grid-cols-3 gap-2">
            {THEME_OPTIONS.map((o) => {
              const active = theme === o.id;
              const Icon = o.icon;
              return (
                <label
                  key={o.id}
                  className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[#E8A33D] ${
                    active
                      ? 'border-[#E8A33D] bg-white/10 text-white'
                      : 'border-white/15 text-[#A9B4C2] hover:text-white hover:bg-white/5'
                  }`}
                >
                  <input
                    type="radio"
                    name="theme"
                    value={o.id}
                    checked={active}
                    onChange={() => setTheme(o.id)}
                    className="sr-only"
                  />
                  <Icon size={16} aria-hidden />
                  {o.label}
                </label>
              );
            })}
          </div>
        </fieldset>

        <label className="mt-4 flex cursor-pointer items-start gap-3">
          <span className="flex-1">
            <span className="block text-sm font-semibold text-white">Reduce transparency</span>
            <span className="block text-xs text-[#A9B4C2]">
              Use solid surfaces instead of frosted glass. Easier to read on busy backgrounds.
            </span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={reducedTransparency}
            onChange={(e) => setReducedTransparency(e.target.checked)}
            className="peer sr-only"
          />
          <span
            aria-hidden
            className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-[#E8A33D] ${
              reducedTransparency ? 'bg-[#E8A33D]' : 'bg-slate-500/50'
            }`}
          >
            <span
              className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform ${
                reducedTransparency ? 'translate-x-[1.375rem]' : 'translate-x-0.5'
              }`}
            />
          </span>
        </label>
      </section>

      {/* 2. DATA PIPELINE & SNAPSHOTS */}
      <div className="glass-panel p-5 border border-white/15 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Database size={18} className="text-[#5AA9FF]" />
              <span>Data Pipeline & Rollback Snapshots</span>
            </h2>
            <p className="text-xs text-[#A9B4C2] mt-0.5">
              Pulls every congregation&apos;s schedule, address, and map location from iglesianicristo.net.
              Runs automatically every night at 12:00 AM{sync?.timezone ? ` (${sync.timezone})` : ''}, with a
              rollback snapshot before each update.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCreateSnapshot}
              className="btn-glass text-xs px-3 py-2 flex items-center gap-1.5 whitespace-nowrap"
            >
              <Save size={14} />
              <span>Take Snapshot</span>
            </button>
            <button
              onClick={handleRunSync}
              disabled={syncing || !!sync?.read_only}
              className="btn-amber text-xs px-3 py-2 flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              <span>{syncing ? 'Syncing...' : 'Run Sync Now'}</span>
            </button>
          </div>
        </div>

        {sync?.read_only && (
          <div className="p-3 rounded-xl border border-[#3A6EA5]/35 bg-[#3A6EA5]/15 text-xs text-[#A9B4C2]">
            This deployment is read-only, so syncing and snapshots are turned off here. To update the
            data, run the app locally, press Run Sync Now (or <code>npm run sync:directory</code>), then
            commit and push <code>data/store.json</code>; the site redeploys with the new data.
          </div>
        )}

        {syncing && sync && (
          <div className="p-3 rounded-xl bg-[#3A6EA5]/15 border border-[#3A6EA5]/35 space-y-2" aria-live="polite">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white">{PHASE_LABELS[sync.phase ?? 'districts']}</span>
              <span className="font-departure text-[#A9B4C2]">
                {sync.total > 0 ? `${sync.done.toLocaleString()} / ${sync.total.toLocaleString()}` : 'Starting…'}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#3A6EA5] to-[#E8A33D] transition-[width] duration-500"
                style={{ width: `${syncProgressPercent(sync)}%` }}
              />
            </div>
            <p className="text-[11px] text-[#A9B4C2]">
              A full sync fetches every locale page and takes about 30 minutes. You can leave this page; it keeps running.
            </p>
          </div>
        )}

        {!syncing && sync?.last_sync && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
              sync.last_sync.status === 'failed'
                ? 'bg-red-500/10 border-red-500/30 text-red-300'
                : sync.last_sync.status === 'partial'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            }`}
          >
            {sync.last_sync.status === 'success' ? (
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            )}
            <div className="space-y-0.5">
              <p className="font-semibold">{sync.last_sync.message}</p>
              <p className="opacity-80">
                Last sync {new Date(sync.last_sync.finished_at).toLocaleString()} ({sync.last_sync.trigger}) ·{' '}
                {sync.last_sync.updated.toLocaleString()} updated · {sync.last_sync.added} added ·{' '}
                {sync.last_sync.removed} removed
              </p>
            </div>
          </div>
        )}

        {sync?.next_scheduled_at && (
          <p className="text-xs text-[#A9B4C2] flex items-center gap-1.5">
            <Clock size={13} className="text-[#E8A33D]" />
            Next automatic sync: {new Date(sync.next_scheduled_at).toLocaleString()}
          </p>
        )}

        {/* Snapshots Table */}
        <div className="space-y-2 pt-2">
          <span className="text-xs font-bold text-[#A9B4C2] uppercase tracking-wider block">
            Versioned Backup Snapshots ({snapshots.length})
          </span>

          {loadingSnapshots ? (
            <p className="text-xs text-[#A9B4C2]">Loading snapshot history...</p>
          ) : snapshots.length > 0 ? (
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {snapshots.map((snap) => (
                <div
                  key={snap.id}
                  className="glass-card p-3 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-departure font-bold text-white text-sm">
                        {snap.id}
                      </span>
                      <span className="badge-service-active !text-[10px] !py-0 !px-1.5">
                        {snap.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[#A9B4C2]">{snap.description}</p>
                    <span className="text-[11px] text-[#A9B4C2]/80 block font-departure">
                      {new Date(snap.created_at).toLocaleString()} • {snap.record_counts.locales} locales, {snap.record_counts.districts} districts
                    </span>
                  </div>

                  <button
                    onClick={() => handleRestore(snap.id)}
                    disabled={restoringId === snap.id}
                    className="btn-glass text-[11px] py-1.5 px-3 self-start sm:self-auto flex items-center gap-1 hover:text-[#E8A33D] hover:border-[#E8A33D]/40"
                  >
                    <RotateCcw size={12} className={restoringId === snap.id ? 'animate-spin' : ''} />
                    <span>{restoringId === snap.id ? 'Restoring...' : 'Restore'}</span>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#A9B4C2]">No snapshots recorded yet.</p>
          )}
        </div>
      </div>

      {/* 3. CONNECTED CHANNELS: TELEGRAM BOT */}
      <div className="glass-panel p-5 border border-white/15 space-y-3">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Send size={18} className="text-[#5AA9FF]" />
          <span>Telegram Bot Companion</span>
        </h2>
        <div className="p-4 rounded-xl bg-[#3A6EA5]/15 border border-[#3A6EA5]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="font-semibold text-white text-sm block">@KapilyaDirectory_bot</span>
            <p className="text-xs text-[#A9B4C2] mt-0.5">
              Live Telegram Bot: Near-me lookups, district browse, and worship service reminders with zero installation.
            </p>
          </div>
          <Link
            href="/telegram"
            className="btn-amber text-xs px-4 py-2 shrink-0 flex items-center gap-1.5"
          >
            <span>Open Bot View</span>
            <Send size={13} />
          </Link>
        </div>
      </div>
    </div>
  );
}
