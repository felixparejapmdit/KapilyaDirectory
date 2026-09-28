'use client';

import React, { useMemo, useState } from 'react';
import { Globe2, Search } from 'lucide-react';
import type { LocaleKind } from '@/lib/types';
import type { CountryStat, CountrySummary } from '@/lib/countries';

type KindFilter = 'all' | LocaleKind;
const KIND_INDEX: Record<LocaleKind, number> = { local_congregation: 0, extension: 1, group_worship_service: 2 };
const KIND_COLORS = ['#5AA9FF', '#E8A33D', '#4ADE80'];

const shown = (c: { counts: [number, number, number]; total: number }, kind: KindFilter) => (kind === 'all' ? c.total : c.counts[KIND_INDEX[kind]]);

/**
 * Districts page "By country": every country/territory with congregations, grouped by continent,
 * with Local / Extension / GWS counts. Selecting one filters the congregation list to it.
 */
export function CountryDirectory({
  summary,
  kind,
  selected,
  onSelect,
}: {
  summary: CountrySummary | null;
  kind: KindFilter;
  selected?: string;
  onSelect: (code: string | undefined) => void;
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const byContinent = useMemo(() => {
    if (!summary) return [];
    return summary.continents
      .map((cont) => ({
        ...cont,
        items: summary.countries.filter((c) => c.continent === cont.name && shown(c, kind) > 0 && (!q || c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q)),
      }))
      .filter((cont) => cont.items.length > 0);
  }, [summary, kind, q]);

  if (!summary) return <div className="glass-card h-64 animate-pulse" />;

  const countriesShown = summary.countries.filter((c) => shown(c, kind) > 0).length;
  const continentsShown = summary.continents.filter((c) => shown(c, kind) > 0).length;

  return (
    <div className="space-y-5">
      <div className="glass-panel flex flex-col gap-3 border border-white/15 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-sm text-white">
          <Globe2 size={18} className="text-[#5AA9FF]" />
          <span>
            <b className="font-departure text-lg">{countriesShown}</b> countries &amp; territories on{' '}
            <b className="font-departure text-lg">{continentsShown}</b> continents
          </span>
        </p>
        <label className="relative block sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A9B4C2]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a country…"
            aria-label="Find a country"
            className="w-full rounded-xl border border-white/15 bg-white/5 py-2 pl-8 pr-3 text-sm text-white placeholder-[#A9B4C2]/60 focus:border-[#E8A33D] focus:outline-none"
          />
        </label>
      </div>

      {byContinent.length === 0 && <p className="py-6 text-center text-sm text-[#A9B4C2]">No country matches “{query}”.</p>}

      {byContinent.map((cont) => (
        <section key={cont.name} aria-label={cont.name} className="glass-panel space-y-4 border border-white/15 p-5 sm:p-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight text-white">
              <span className="h-2.5 w-2.5 rounded-full bg-[#5AA9FF]" />
              {cont.name}
            </h2>
            <span className="font-departure text-xs text-[#A9B4C2]">
              {cont.items.length} {cont.items.length === 1 ? 'country' : 'countries'} · {shown(cont, kind).toLocaleString()}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {cont.items.map((c) => (
              <CountryTile key={c.code} c={c} kind={kind} active={selected === c.code} onClick={() => onSelect(selected === c.code ? undefined : c.code)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function CountryTile({ c, kind, active, onClick }: { c: CountryStat; kind: KindFilter; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`kd-map-row flex-col !items-stretch !gap-1.5 border ${active ? 'border-[#E8A33D] bg-[#E8A33D]/10' : 'border-white/10 bg-white/[0.03]'}`}
    >
      <span className="flex items-center gap-2">
        <span className="rounded border border-white/20 px-1 font-departure text-[10px] font-bold text-white/80">{c.code}</span>
        <span className="min-w-0 flex-1 truncate text-left font-semibold">{c.name}</span>
        <span className="font-departure text-sm font-bold text-[#E8A33D]">{shown(c, kind).toLocaleString()}</span>
      </span>
      <span className="kd-map-bar" aria-hidden>
        {c.counts.map((n, i) => (
          <span key={i} style={{ width: `${(n / Math.max(1, c.total)) * 100}%`, background: KIND_COLORS[i] }} />
        ))}
      </span>
      <span className="text-left font-departure text-[11px] text-[#A9B4C2]">
        Local {c.counts[0]} · Ext {c.counts[1]} · GWS {c.counts[2]} · {c.districts} {c.districts === 1 ? 'district' : 'districts'}
      </span>
    </button>
  );
}
