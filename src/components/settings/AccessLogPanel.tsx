'use client';

import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import {
  Activity,
  Bot,
  Download,
  EyeOff,
  Fingerprint,
  Globe2,
  KeyRound,
  MapPin,
  Monitor,
  Network,
  RefreshCw,
  Search,
  Smartphone,
  Tablet,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type { AccessEntry, AccessQueryResult } from '@/lib/access-log-types';
import { getVisitorId } from '@/components/AccessBeacon';

// ---------- admin key (kept on this device) ----------
const ADMIN_KEY_STORE = 'kapilya_admin_key';
const keyListeners = new Set<() => void>();
const readStored = (k: string) => {
  try {
    return localStorage.getItem(k) ?? '';
  } catch {
    return '';
  }
};
function writeAdminKey(v: string) {
  try {
    if (v) localStorage.setItem(ADMIN_KEY_STORE, v);
    else localStorage.removeItem(ADMIN_KEY_STORE);
  } catch {
    // storage unavailable: the key lasts until reload
  }
  keyListeners.forEach((fn) => fn());
}
const subscribe = (fn: () => void) => {
  keyListeners.add(fn);
  return () => {
    keyListeners.delete(fn);
  };
};

// ---------- formatting ----------
type Range = '24h' | '7d' | '30d' | 'all' | 'custom';
const RANGES: { id: Range; label: string }[] = [
  { id: '24h', label: '24 hours' },
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: 'all', label: 'All' },
  { id: 'custom', label: 'Custom' },
];

const DEVICE_ICON = { desktop: Monitor, mobile: Smartphone, tablet: Tablet, bot: Bot } as const;
const DEVICE_LABEL: Record<string, string> = { desktop: 'Desktop / laptop', mobile: 'Phone', tablet: 'Tablet', bot: 'Bot / crawler' };

let regionNames: Intl.DisplayNames | null = null;
function countryName(code?: string) {
  if (!code) return '';
  try {
    regionNames ??= new Intl.DisplayNames(['en'], { type: 'region' });
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}

function where(e: AccessEntry) {
  if (e.city || e.country) return [e.city, e.region && e.region !== e.city ? e.region : '', countryName(e.country)].filter(Boolean).join(', ');
  if (/^(127\.|::1$|localhost)/.test(e.ip)) return 'This computer (local)';
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|fc|fd|fe80)/i.test(e.ip)) return 'Local network';
  return 'Location unknown';
}

function ago(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

const refHost = (ref?: string) => {
  if (!ref) return '';
  try {
    return new URL(ref).host;
  } catch {
    return ref;
  }
};

const selectClass =
  'min-w-0 bg-[#0B1426] border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#E8A33D]';

interface Filters {
  range: Range;
  from: string;
  to: string;
  q: string;
  device: string;
  country: string;
  os: string;
  browser: string;
  page: string;
  vid: string;
  ip: string;
  hideMine: boolean;
}
const NO_FILTERS: Filters = { range: '7d', from: '', to: '', q: '', device: '', country: '', os: '', browser: '', page: '', vid: '', ip: '', hideMine: false };
const PAGE_SIZE = 100;

/**
 * Settings → Access log: who opened the site (anonymous visitor ID), from what device, where
 * (IP-based city/region/country), and which pages. Admin-only: the API needs the ADMIN_KEY.
 */
export function AccessLogPanel() {
  const adminKey = useSyncExternalStore(subscribe, () => readStored(ADMIN_KEY_STORE), () => '');
  const myVid = useSyncExternalStore(subscribe, getVisitorId, () => '');
  const [keyInput, setKeyInput] = useState('');
  const [f, setF] = useState<Filters>(NO_FILTERS);
  const [q, setQ] = useState(''); // typed search, applied after a pause
  const [pages, setPages] = useState(1);
  const [tick, setTick] = useState(0);
  const [live, setLive] = useState(false);
  const [now, setNow] = useState(0);
  const [exporting, setExporting] = useState(false);

  const set = (patch: Partial<Filters>) => {
    setF((prev) => ({ ...prev, ...patch }));
    setPages(1);
  };

  // Search applies 300 ms after typing stops.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setF((prev) => (prev.q === q ? prev : { ...prev, q }));
      setPages(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [q]);

  // "Auto-refresh" re-reads the log every 30 s.
  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 30000);
    return () => window.clearInterval(id);
  }, [live]);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (f.range === 'custom') {
      if (f.from) p.set('from', new Date(`${f.from}T00:00:00`).toISOString());
      if (f.to) p.set('to', new Date(`${f.to}T23:59:59.999`).toISOString());
    } else if (f.range !== 'all') {
      p.set('within', f.range); // the server counts back from now
    }
    for (const k of ['q', 'device', 'country', 'os', 'browser', 'page', 'vid', 'ip'] as const) if (f[k]) p.set(k, f[k]);
    if (f.hideMine && myVid) p.set('excludeVid', myVid);
    return p.toString();
  }, [f, myVid]);

  const fetchKey = `${query}|${pages}|${adminKey}|${tick}`;
  const [result, setResult] = useState<{ key: string; data?: AccessQueryResult; error?: string }>({ key: '' });
  const loading = result.key !== fetchKey;

  useEffect(() => {
    let alive = true;
    fetch(`/api/access-log?${query}&limit=${pages * PAGE_SIZE}`, {
      cache: 'no-store',
      headers: adminKey ? { 'X-Admin-Key': adminKey } : {},
    })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!alive) return;
        setNow(Date.now());
        setResult(res.ok ? { key: fetchKey, data: json } : { key: fetchKey, error: json.error ?? `error ${res.status}` });
      })
      .catch(() => alive && setResult({ key: fetchKey, error: 'network' }));
    return () => {
      alive = false;
    };
  }, [fetchKey, query, pages, adminKey]);

  const data = result.data;
  const error = result.error;
  const needsKey = error === 'missing-key' || error === 'wrong-key';

  const exportCsv = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/access-log?${query}&format=csv`, { headers: adminKey ? { 'X-Admin-Key': adminKey } : {} });
      if (!res.ok) throw new Error(String(res.status));
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `kapilya-access-log-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Export failed. Try again.');
    } finally {
      setExporting(false);
    }
  };

  const clearLog = async () => {
    if (!confirm('Delete the whole access log? This can’t be undone.')) return;
    await fetch('/api/access-log', { method: 'DELETE', headers: adminKey ? { 'X-Admin-Key': adminKey } : {} });
    setTick((t) => t + 1);
  };

  const activeFilters =
    f.q || f.device || f.country || f.os || f.browser || f.page || f.vid || f.ip || f.hideMine || f.range !== NO_FILTERS.range;

  return (
    <section aria-labelledby="access-h" className="glass-panel p-5 border border-white/15 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h2 id="access-h" className="text-base font-bold text-white flex items-center gap-2">
            <Activity size={18} className="text-[#4ADE80]" />
            <span>Access Log</span>
          </h2>
          <p className="text-xs text-[#A9B4C2] mt-0.5">
            Who opened the site, from which device, and where (city from the IP address). The site has no
            accounts, so each browser gets an anonymous visitor ID.
          </p>
        </div>
        {data && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <label className="flex items-center gap-1.5 text-xs text-[#A9B4C2] cursor-pointer">
              <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} className="accent-[#E8A33D]" />
              Auto-refresh
            </label>
            <button onClick={() => setTick((t) => t + 1)} className="btn-glass text-xs px-3 py-2 flex items-center gap-1.5">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button onClick={exportCsv} disabled={exporting || !data.total} className="btn-glass text-xs px-3 py-2 flex items-center gap-1.5 disabled:opacity-50">
              <Download size={13} />
              {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
          </div>
        )}
      </div>

      {/* Locked: ask for the admin key */}
      {needsKey && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            writeAdminKey(keyInput.trim());
            setKeyInput('');
          }}
          className="p-4 rounded-xl border border-white/15 bg-white/5 space-y-3"
        >
          <p className="text-sm text-white flex items-center gap-2">
            <KeyRound size={16} className="text-[#E8A33D]" />
            Enter the admin key to view the access log.
          </p>
          {error === 'wrong-key' && adminKey && <p className="text-xs text-red-300">That key isn’t right. Check ADMIN_KEY and try again.</p>}
          <div className="flex gap-2">
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="Admin key"
              autoComplete="current-password"
              className="flex-1 min-w-0 bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-sm text-white placeholder-[#A9B4C2]/60 focus:outline-none focus:border-[#E8A33D]"
            />
            <button type="submit" disabled={!keyInput.trim()} className="btn-amber text-xs px-4 py-2 disabled:opacity-50">
              Unlock
            </button>
          </div>
          <p className="text-[11px] text-[#A9B4C2]">It’s the ADMIN_KEY value (in .env.local, and in Vercel). It’s remembered on this device.</p>
        </form>
      )}

      {error === 'not-configured' && (
        <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-200">
          The access log is locked on this deployment until an admin key is set: add <code>ADMIN_KEY</code> in Vercel
          (Settings → Environment Variables, Production), then redeploy.
        </div>
      )}
      {error && !needsKey && error !== 'not-configured' && (
        <p className="text-xs text-red-300">Couldn’t load the access log ({error}).</p>
      )}

      {data && (
        <>
          {data.storage === 'none' && (
            <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-200">
              Visits aren’t being recorded on this deployment yet: it needs somewhere to store them. In Vercel, open
              <b> Storage → Create Database → Upstash for Redis</b> (free), connect it to this project, then redeploy.
            </div>
          )}

          {/* Totals */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: 'Visits', value: data.stats.visits, Icon: Activity },
              { label: 'Visitors', value: data.stats.visitors, Icon: Users },
              { label: 'IP addresses', value: data.stats.ips, Icon: Network },
              { label: 'Countries', value: data.stats.countries, Icon: Globe2 },
            ].map(({ label, value, Icon }) => (
              <div key={label} className="kd-map-stat">
                <span className="kd-map-stat-label">
                  <Icon size={12} className="text-[#E8A33D]" />
                  {label}
                </span>
                <span className="kd-map-stat-value">{value.toLocaleString()}</span>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div role="group" aria-label="Time range" className="flex items-center rounded-xl border border-white/15 bg-white/5 p-1 text-xs font-semibold">
                {RANGES.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    aria-pressed={f.range === r.id}
                    onClick={() => set({ range: r.id })}
                    className={`rounded-lg px-2.5 py-1 transition-colors ${f.range === r.id ? 'bg-[#E8A33D] text-[#0B1426]' : 'text-[#A9B4C2] hover:text-white'}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              {f.range === 'custom' && (
                <div className="flex items-center gap-1.5 text-xs text-[#A9B4C2]">
                  <input type="date" value={f.from} onChange={(e) => set({ from: e.target.value })} className={selectClass} aria-label="From" />
                  <span>to</span>
                  <input type="date" value={f.to} onChange={(e) => set({ to: e.target.value })} className={selectClass} aria-label="To" />
                </div>
              )}
            </div>

            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A9B4C2]" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search IP, city, page, device, browser, visitor…"
                className="w-full bg-white/5 border border-white/15 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-[#A9B4C2]/60 focus:outline-none focus:border-[#E8A33D]"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <select value={f.device} onChange={(e) => set({ device: e.target.value })} className={selectClass} aria-label="Device">
                <option value="">All devices</option>
                {data.facets.device.map(([v, n]) => (
                  <option key={v} value={v}>
                    {DEVICE_LABEL[v] ?? v} ({n})
                  </option>
                ))}
              </select>
              <select value={f.country} onChange={(e) => set({ country: e.target.value })} className={selectClass} aria-label="Country">
                <option value="">All countries</option>
                {data.facets.country.map(([v, n]) => (
                  <option key={v} value={v}>
                    {countryName(v)} ({n})
                  </option>
                ))}
              </select>
              <select value={f.os} onChange={(e) => set({ os: e.target.value })} className={selectClass} aria-label="Operating system">
                <option value="">All systems</option>
                {data.facets.os.map(([v, n]) => (
                  <option key={v} value={v}>
                    {v} ({n})
                  </option>
                ))}
              </select>
              <select value={f.browser} onChange={(e) => set({ browser: e.target.value })} className={selectClass} aria-label="Browser">
                <option value="">All browsers</option>
                {data.facets.browser.map(([v, n]) => (
                  <option key={v} value={v}>
                    {v} ({n})
                  </option>
                ))}
              </select>
              <select value={f.page} onChange={(e) => set({ page: e.target.value })} className={`${selectClass} col-span-2 sm:col-span-1`} aria-label="Page">
                <option value="">All pages</option>
                {data.facets.page.map(([v, n]) => (
                  <option key={v} value={v}>
                    {v} ({n})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <label className="flex items-center gap-1.5 text-[#A9B4C2] cursor-pointer">
                <input type="checkbox" checked={f.hideMine} onChange={(e) => set({ hideMine: e.target.checked })} className="accent-[#E8A33D]" />
                <EyeOff size={13} /> Hide this device
              </label>
              {f.vid && (
                <button onClick={() => set({ vid: '' })} className="kd-map-crumb !text-xs border border-white/15">
                  Visitor #{f.vid.slice(0, 6)} <X size={12} />
                </button>
              )}
              {f.ip && (
                <button onClick={() => set({ ip: '' })} className="kd-map-crumb !text-xs border border-white/15">
                  IP {f.ip} <X size={12} />
                </button>
              )}
              {activeFilters && (
                <button
                  onClick={() => {
                    setQ('');
                    set(NO_FILTERS);
                  }}
                  className="text-[#5AA9FF] hover:underline"
                >
                  Reset filters
                </button>
              )}
              <span className="ml-auto text-[#A9B4C2]">
                {data.total.toLocaleString()} {data.total === 1 ? 'visit' : 'visits'}
                {data.storage === 'file' && ' · stored on this computer'}
              </span>
            </div>
          </div>

          {/* Visits */}
          {data.entries.length === 0 ? (
            <p className="text-xs text-[#A9B4C2] py-6 text-center">{loading ? 'Loading…' : 'No visits match these filters.'}</p>
          ) : (
            <ul className={`space-y-2 transition-opacity ${loading ? 'opacity-60' : ''}`}>
              {data.entries.map((e) => {
                const Icon = DEVICE_ICON[e.device] ?? Monitor;
                const visits = data.visitorVisits[e.vid] ?? 1;
                return (
                  <li key={e.id} className="glass-card p-3 border border-white/10 text-xs space-y-1.5">
                    <div className="flex items-start gap-2">
                      <Icon size={16} className="mt-0.5 shrink-0 text-[#5AA9FF]" aria-label={DEVICE_LABEL[e.device]} />
                      <p className="min-w-0 flex-1 font-semibold text-white">
                        {[e.os, e.browser, e.model, e.screen].filter(Boolean).join(' · ')}
                      </p>
                      <time dateTime={e.at} title={new Date(e.at).toLocaleString()} className="shrink-0 font-departure text-[#A9B4C2]">
                        {ago(e.at, now)}
                      </time>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-6 text-[#A9B4C2]">
                      <span className="flex items-center gap-1">
                        <MapPin size={12} className="text-[#E8A33D]" />
                        {e.country && (
                          <span className="rounded border border-white/20 px-1 font-departure text-[10px] font-bold text-white/80">{e.country}</span>
                        )}
                        {where(e)}
                        {e.lat !== undefined && e.lng !== undefined && (
                          <a
                            href={`https://www.google.com/maps?q=${e.lat},${e.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#5AA9FF] hover:underline"
                            title="Approximate area of the IP address"
                          >
                            map
                          </a>
                        )}
                      </span>
                      <button onClick={() => set({ ip: e.ip })} className="font-departure text-white/90 hover:text-[#E8A33D]" title="Show only this IP address">
                        {e.ip}
                      </button>
                      <button onClick={() => set({ vid: e.vid })} className="flex items-center gap-1 hover:text-[#E8A33D]" title="Show only this visitor">
                        <Fingerprint size={12} />#{e.vid.slice(0, 6)}
                        {visits > 1 && <span className="opacity-80">· {visits} visits</span>}
                      </button>
                      {e.vid === myVid && <span className="rounded-full border border-[#4ADE80]/40 px-1.5 text-[10px] font-bold text-[#4ADE80]">This device</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-6 text-[#A9B4C2]">
                      <Link href={e.path} className="font-departure text-[#E8A33D] hover:underline break-all">
                        {e.path}
                      </Link>
                      {e.ref && <span>from {refHost(e.ref)}</span>}
                      {e.tz && <span>{e.tz}</span>}
                      {e.lang && <span>{e.lang}</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            {data.entries.length < data.total ? (
              <button onClick={() => setPages((p) => p + 1)} disabled={loading} className="btn-glass text-xs px-4 py-2 disabled:opacity-50">
                Show more ({(data.total - data.entries.length).toLocaleString()} older)
              </button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-3 text-xs">
              {adminKey && (
                <button onClick={() => writeAdminKey('')} className="text-[#A9B4C2] hover:text-white flex items-center gap-1">
                  <KeyRound size={12} /> Forget key on this device
                </button>
              )}
              <button onClick={clearLog} className="text-red-300 hover:text-red-200 flex items-center gap-1">
                <Trash2 size={12} /> Clear log
              </button>
            </div>
          </div>
          <p className="text-[11px] text-[#A9B4C2]/80">
            Keeps the latest {data.capacity.toLocaleString()} visits. Locations are approximate (from the IP address,
            usually the city of the internet provider).
          </p>
        </>
      )}

      {!data && !error && <p className="text-xs text-[#A9B4C2]">Loading access log…</p>}
    </section>
  );
}
