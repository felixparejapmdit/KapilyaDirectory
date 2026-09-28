'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { History, MapPin, Search } from 'lucide-react';
import type { ChangeAction, ChangeEntry, ChangeField, ChangeSource, FieldChange } from '@/lib/change-log';

const FIELD_LABEL: Record<ChangeField, string> = {
  name: 'Name',
  schedule: 'Schedule',
  address: 'Address',
  location: 'Map location',
  kind: 'Type',
  district: 'District',
  phone: 'Phone',
  email: 'Email',
};
const FIELDS = Object.keys(FIELD_LABEL) as ChangeField[];
const ACTIONS: { id: ChangeAction; label: string; tone: string }[] = [
  { id: 'updated', label: 'Updated', tone: 'border-[#E8A33D]/40 bg-[#E8A33D]/10 text-[#E8A33D]' },
  { id: 'added', label: 'Added', tone: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-400' },
  { id: 'removed', label: 'Removed', tone: 'border-red-400/40 bg-red-500/10 text-red-300' },
];
const SOURCE_LABEL: Record<ChangeSource, string> = {
  scheduled: 'Scheduled sync',
  manual: 'Run Sync Now',
  cli: 'Automatic sync',
  restore: 'Snapshot restore',
  history: 'Automatic sync',
};
const RANGES = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
  { id: '', label: 'All' },
];
const PAGE = 50;

interface Result {
  updated_at: string | null;
  total: number;
  entries: ChangeEntry[];
  facets: { action: Record<string, number>; field: Record<string, number> };
  syncs: number;
}

function chip(active: boolean) {
  return `rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
    active ? 'border-transparent bg-[#E8A33D] text-[#0B1426]' : 'border-white/15 bg-white/5 text-[#A9B4C2] hover:bg-white/10 hover:text-white'
  }`;
}

function Change({ c, action }: { c: FieldChange; action: ChangeAction }) {
  const label = <span className="w-24 shrink-0 font-semibold text-[#A9B4C2]">{FIELD_LABEL[c.field]}</span>;
  if (c.field === 'schedule') {
    const removed = c.removed ?? [];
    const added = c.added ?? [];
    return (
      <div className="flex gap-2">
        {label}
        <div className="min-w-0 space-y-0.5 font-departure">
          {removed.map((s) => (
            <p key={`-${s}`} className="text-red-300">
              − <span className="line-through decoration-red-300/60">{s}</span>
            </p>
          ))}
          {added.map((s) => (
            <p key={`+${s}`} className="text-emerald-400">
              + {s}
            </p>
          ))}
          {!removed.length && !added.length && <p className="text-[#A9B4C2]">Same services, listed differently</p>}
        </div>
      </div>
    );
  }
  if (c.field === 'location') {
    const [lat, lng] = (c.new ?? c.old ?? '').split(',').map((s) => s.trim());
    return (
      <div className="flex gap-2">
        {label}
        <div className="min-w-0 space-y-0.5">
          {action === 'updated' && c.moved_km !== undefined && (
            <p className="text-white">
              Pin moved {c.moved_km < 1 ? `${Math.round(c.moved_km * 1000)} m` : `${c.moved_km.toFixed(1)} km`}
            </p>
          )}
          <p className="font-departure text-[#A9B4C2]">
            {c.old && <span className="text-red-300 line-through decoration-red-300/60">{c.old}</span>}
            {c.old && c.new && ' → '}
            {c.new && <span className="text-emerald-400">{c.new}</span>}
            {lat && lng && (
              <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-0.5 text-[#5AA9FF] hover:underline">
                <MapPin size={11} /> map
              </a>
            )}
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      {label}
      <p className="min-w-0 break-words">
        {c.old !== null && <span className="text-red-300 line-through decoration-red-300/60">{c.old}</span>}
        {c.old !== null && c.new !== null && <span className="text-[#A9B4C2]"> → </span>}
        {c.new !== null ? <span className="text-emerald-400">{c.new}</span> : action === 'updated' && <span className="text-[#A9B4C2]"> (removed)</span>}
      </p>
    </div>
  );
}

/**
 * Settings → Change history: what each sync changed per congregation (old → new), from
 * data/change-log.json. Filter by name/district, date range, kind of change, and field.
 */
export function ChangeHistoryPanel() {
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [range, setRange] = useState('30d');
  const [action, setAction] = useState<ChangeAction | ''>('');
  const [field, setField] = useState<ChangeField | ''>('');
  const [pages, setPages] = useState(1);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setQuery(q.trim());
      setPages(1);
    }, 250);
    return () => window.clearTimeout(t);
  }, [q]);

  const params = useMemo(() => {
    const p = new URLSearchParams({ limit: String(PAGE * pages) });
    if (query) p.set('q', query);
    if (range) p.set('within', range);
    if (action) p.set('action', action);
    if (field) p.set('field', field);
    return p.toString();
  }, [query, range, action, field, pages]);

  const [result, setResult] = useState<{ key: string; data: Result | null; error?: boolean }>({ key: '', data: null });
  useEffect(() => {
    let alive = true;
    fetch(`/api/changes?${params}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: Result) => alive && setResult({ key: params, data: d }))
      .catch(() => alive && setResult((prev) => ({ key: params, data: prev.data, error: true })));
    return () => {
      alive = false;
    };
  }, [params]);
  const data = result.data;
  const loading = result.key !== params;

  // Group by calendar day (viewer's time zone).
  const days = useMemo(() => {
    const groups = new Map<string, ChangeEntry[]>();
    for (const e of data?.entries ?? []) {
      const day = new Date(e.at).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      groups.set(day, [...(groups.get(day) ?? []), e]);
    }
    return [...groups];
  }, [data]);

  const pick = <T,>(set: (v: T) => void, v: T) => {
    set(v);
    setPages(1);
  };

  return (
    <section aria-labelledby="changes-h" className="glass-panel space-y-4 border border-white/15 p-5">
      <div>
        <h2 id="changes-h" className="flex items-center gap-2 text-base font-bold text-white">
          <History size={18} className="text-[#E8A33D]" />
          <span>Change History</span>
        </h2>
        <p className="mt-0.5 text-xs text-[#A9B4C2]">
          What each sync changed in the directory: names, schedules, addresses, map locations, contacts, type, and
          district, shown as old → new. Congregations added or removed are listed too.
        </p>
      </div>

      <div className="space-y-2">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A9B4C2]" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search congregation or district…"
            aria-label="Search congregation or district"
            className="w-full rounded-xl border border-white/15 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder-[#A9B4C2]/60 focus:border-[#E8A33D] focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Time range" className="flex items-center rounded-xl border border-white/15 bg-white/5 p-1 text-xs font-semibold">
            {RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={range === r.id}
                onClick={() => pick(setRange, r.id)}
                className={`rounded-lg px-2.5 py-1 transition-colors ${range === r.id ? 'bg-[#E8A33D] text-[#0B1426]' : 'text-[#A9B4C2] hover:text-white'}`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button type="button" aria-pressed={!action} onClick={() => pick(setAction, '')} className={chip(!action)}>
            All changes
          </button>
          {ACTIONS.map((a) => (
            <button key={a.id} type="button" aria-pressed={action === a.id} onClick={() => pick(setAction, action === a.id ? '' : a.id)} className={chip(action === a.id)}>
              {a.label} <span className="font-departure font-normal opacity-75">{data?.facets.action[a.id] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={!field} onClick={() => pick(setField, '')} className={chip(!field)}>
            Any field
          </button>
          {FIELDS.filter((fl) => (data?.facets.field[fl] ?? 0) > 0 || field === fl).map((fl) => (
            <button key={fl} type="button" aria-pressed={field === fl} onClick={() => pick(setField, field === fl ? '' : fl)} className={chip(field === fl)}>
              {FIELD_LABEL[fl]} <span className="font-departure font-normal opacity-75">{data?.facets.field[fl] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      {data && (
        <p className="text-xs text-[#A9B4C2]" aria-live="polite">
          {data.total.toLocaleString()} {data.total === 1 ? 'congregation' : 'congregations'} changed
          {range ? ` in the last ${RANGES.find((r) => r.id === range)!.label}` : ''} · {data.syncs} {data.syncs === 1 ? 'sync' : 'syncs'} with changes
        </p>
      )}
      {result.error && <p className="text-xs text-red-300">Couldn’t load the change history.</p>}
      {!data && !result.error && <p className="text-xs text-[#A9B4C2]">Loading change history…</p>}
      {data && data.total === 0 && <p className="py-4 text-center text-sm text-[#A9B4C2]">No changes match these filters.</p>}

      <div className={`space-y-5 transition-opacity ${loading ? 'opacity-60' : ''}`}>
        {days.map(([day, entries]) => (
          <div key={day} className="space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#A9B4C2]">{day}</h3>
            {entries.map((e) => {
              const tone = ACTIONS.find((a) => a.id === e.action)!;
              return (
                <article key={e.id} className="glass-card space-y-2 border border-white/10 p-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tone.tone}`}>{tone.label}</span>
                    {e.action === 'removed' ? (
                      <span className="text-sm font-bold text-white">{e.name}</span>
                    ) : (
                      <Link href={`/locales/${e.locale_id}`} className="text-sm font-bold text-white hover:text-[#E8A33D] hover:underline">
                        {e.name}
                      </Link>
                    )}
                    {e.district_name && <span className="text-[#A9B4C2]">· {e.district_name}</span>}
                    <span className="ml-auto font-departure text-[#A9B4C2]" title={new Date(e.at).toLocaleString()}>
                      {new Date(e.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} · {SOURCE_LABEL[e.source]}
                    </span>
                  </div>
                  <div className="space-y-1.5 border-t border-white/5 pt-2">
                    {e.changes.map((c, i) => (
                      <Change key={`${c.field}-${i}`} c={c} action={e.action} />
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        ))}
      </div>

      {data && data.entries.length < data.total && (
        <button type="button" onClick={() => setPages((n) => n + 1)} disabled={loading} className="btn-glass w-full py-2 text-xs disabled:opacity-50">
          Show more ({(data.total - data.entries.length).toLocaleString()} more)
        </button>
      )}
      <p className="text-[11px] text-[#A9B4C2]/80">
        Recorded with every sync (kept in data/change-log.json, latest 5,000 changes). Earlier history was rebuilt from the
        synced data saved in git.
      </p>
    </section>
  );
}
