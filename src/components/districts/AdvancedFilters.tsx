'use client';

import React, { useState } from 'react';
import { Clock, Globe2, Info, Languages, MapPin, Phone, SlidersHorizontal, X } from 'lucide-react';
import {
  EMPTY_FILTERS,
  NEAR_OPTIONS,
  PH_TIMEZONE,
  SOON_WINDOWS,
  TIME_BUCKETS,
  type AdvancedFilters,
  type ContactKind,
  type FilterResult,
  type TimeBucket,
} from '@/lib/locale-filter';
import { formatTime12Hour } from '@/lib/time';
import type { CountryStat } from '@/lib/countries';

export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SERVICE_LABEL = { worship: 'Worship service', cws: "Children's worship (CWS)" } as const;

export interface FilterArea {
  title: string;
  regions: { id: string; name: string; districts: { slug: string; name: string }[] }[];
}

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/** The viewer's time zone, e.g. "America/Los_Angeles". */
export const myTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
};
const zoneCity = (tz: string) => tz.split('/').pop()?.replace(/_/g, ' ') ?? tz;
/** "Philippine time" / "your time" for the chosen reference clock. */
export const refClockLabel = (tz: AdvancedFilters['tz']) => (tz === 'ph' ? 'Philippine time' : tz === 'mine' ? 'your time' : '');

function Chip({
  active,
  count,
  disabled,
  onClick,
  children,
  title,
}: {
  active: boolean;
  count?: number;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  const off = !active && (disabled || count === 0);
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={off}
      onClick={onClick}
      title={title}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? 'border-transparent bg-[#E8A33D] text-[#0B1426]'
          : off
            ? 'border-white/10 text-[#A9B4C2]/40 cursor-not-allowed'
            : 'border-white/15 bg-white/5 text-[#A9B4C2] hover:bg-white/10 hover:text-white'
      }`}
    >
      {children}
      {count !== undefined && <span className="ml-1 font-departure font-normal opacity-75">{count.toLocaleString()}</span>}
    </button>
  );
}

function Group({ label, icon: Icon, children, hint }: { label: string; icon: typeof Clock; children: React.ReactNode; hint?: string }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#A9B4C2]">
        <Icon size={13} className="text-[#E8A33D]" />
        {label}
        {hint && <span className="font-normal normal-case tracking-normal text-[#A9B4C2]/70">· {hint}</span>}
      </legend>
      {children}
    </fieldset>
  );
}

const selectClass =
  'w-full min-w-0 rounded-xl border border-white/15 bg-[#0B1426] px-3 py-2 text-sm text-white focus:border-[#E8A33D] focus:outline-none';

/** The advanced filter panel of the Districts page. */
export function AdvancedFiltersPanel({
  filters: f,
  facets,
  areas,
  countries,
  locationName,
  total,
  onChange,
  onClose,
}: {
  filters: AdvancedFilters;
  facets: FilterResult['facets'] | null;
  areas: FilterArea[];
  countries?: CountryStat[];
  locationName: string;
  total: number | null;
  onChange: (next: AdvancedFilters) => void;
  onClose: () => void;
}) {
  const set = (patch: Partial<AdvancedFilters>) => onChange({ ...f, ...patch });
  const [allLangs, setAllLangs] = useState(false);
  const [customTime, setCustomTime] = useState(!!(f.from || f.to));
  const customOn = customTime || !!(f.from || f.to);

  const region = areas.flatMap((a) => a.regions).find((r) => r.id === f.region);
  const districtOptions = region ? [{ ...region }] : areas.flatMap((a) => a.regions);

  const langs = facets?.lang ?? [];
  const langList = [...langs, ...f.langs.filter((l) => !langs.some(([x]) => x === l)).map((l): [string, number] => [l, 0])];
  const shownLangs = allLangs ? langList : langList.filter(([l], i) => i < 8 || f.langs.includes(l));

  return (
    <section aria-label="Advanced filters" className="glass-panel border border-white/15 p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-white">
          <SlidersHorizontal size={17} className="text-[#E8A33D]" />
          Advanced filters
        </h2>
        <button type="button" onClick={onClose} aria-label="Close filters" className="rounded-lg p-1.5 text-[#A9B4C2] hover:bg-white/10 hover:text-white">
          <X size={16} />
        </button>
      </div>
      <p className="-mt-2 mb-4 flex items-start gap-1.5 text-[11px] text-[#A9B4C2]">
        <Info size={13} className="mt-px shrink-0 text-[#5AA9FF]" />
        Day, time, language, and service type must all match the same service.
      </p>

      <div className="grid gap-5 lg:grid-cols-2 lg:gap-x-8">
        {/* TIMES SHOWN IN (reference clock) */}
        <div className="lg:col-span-2">
          <Group label="Times shown in" icon={Globe2} hint="day, time, and “later today” follow this clock">
            <div className="flex flex-wrap gap-2">
              <Chip active={!f.tz} onClick={() => set({ tz: undefined })}>
                Each congregation’s local time
              </Chip>
              <Chip active={f.tz === 'ph'} onClick={() => set({ tz: 'ph' })} title="Asia/Manila (UTC+8)">
                Philippine time (PHT)
              </Chip>
              {myTimeZone() && myTimeZone() !== PH_TIMEZONE && (
                <Chip active={f.tz === 'mine'} onClick={() => set({ tz: 'mine' })} title={myTimeZone()}>
                  My time ({zoneCity(myTimeZone())})
                </Chip>
              )}
            </div>
          </Group>
        </div>

        {/* WHERE */}
        <Group label="Where" icon={MapPin}>
          <div className="grid gap-2 sm:grid-cols-2">
            <select value={f.country ?? ''} onChange={(e) => set({ country: e.target.value || undefined })} aria-label="Country" className={selectClass}>
              <option value="">All countries</option>
              {[...new Set((countries ?? []).map((c) => c.continent))].map((cont) => (
                <optgroup key={cont} label={cont}>
                  {(countries ?? [])
                    .filter((c) => c.continent === cont)
                    .map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name} ({c.total})
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
            <select
              value={f.region ?? ''}
              onChange={(e) => set({ region: e.target.value || undefined, district: undefined })}
              aria-label="Region"
              className={selectClass}
            >
              <option value="">All regions</option>
              {areas.map((a) => (
                <optgroup key={a.title} label={a.title}>
                  {a.regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <select value={f.district ?? ''} onChange={(e) => set({ district: e.target.value || undefined })} aria-label="District" className={selectClass}>
              <option value="">All districts</option>
              {districtOptions.map((r) => (
                <optgroup key={r.id} label={r.name}>
                  {r.districts.map((d) => (
                    <option key={d.slug} value={d.slug}>
                      {d.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <select
              value={f.near ?? ''}
              onChange={(e) => set({ near: e.target.value ? Number(e.target.value) : undefined })}
              aria-label="Distance from you"
              className={selectClass}
            >
              <option value="">Any distance</option>
              {NEAR_OPTIONS.map((km) => (
                <option key={km} value={km}>
                  Within {km} km
                </option>
              ))}
            </select>
          </div>
          <p className="text-[11px] text-[#A9B4C2]">Distance is measured from {locationName} (your location).</p>
        </Group>

        {/* STARTING WITHIN */}
        <Group label="Starting within" icon={Clock} hint={f.tz ? `“later today” in ${refClockLabel(f.tz)}` : 'local time of each congregation'}>
          <div className="flex flex-wrap gap-2">
            <Chip active={!f.soon} onClick={() => set({ soon: undefined })}>
              Any time
            </Chip>
            {SOON_WINDOWS.map((w) => (
              <Chip key={w.id} active={f.soon === w.id} onClick={() => set({ soon: f.soon === w.id ? undefined : w.id })}>
                {w.label}
              </Chip>
            ))}
          </div>
        </Group>

        {/* DAY */}
        <Group label="Worship day" icon={Clock} hint={f.tz ? `in ${refClockLabel(f.tz)}` : undefined}>
          <div className="flex flex-wrap gap-2">
            {DAY_SHORT.map((d, i) => (
              <Chip key={d} active={f.days.includes(i)} count={facets?.day[i]} onClick={() => set({ days: toggle(f.days, i).sort() })}>
                {d}
              </Chip>
            ))}
          </div>
        </Group>

        {/* TIME */}
        <Group label="Time of day" icon={Clock} hint={f.tz ? `in ${refClockLabel(f.tz)}` : undefined}>
          <div className="flex flex-wrap gap-2">
            {TIME_BUCKETS.map((b) => (
              <Chip
                key={b.id}
                active={!customOn && f.times.includes(b.id)}
                count={facets?.time[b.id]}
                disabled={customOn}
                title={b.range}
                onClick={() => set({ times: toggle<TimeBucket>(f.times, b.id) })}
              >
                {b.label} <span className="font-normal opacity-70">({b.range})</span>
              </Chip>
            ))}
            <Chip
              active={customOn}
              onClick={() => {
                if (customOn) {
                  setCustomTime(false);
                  set({ from: undefined, to: undefined });
                } else setCustomTime(true);
              }}
            >
              Custom…
            </Chip>
          </div>
          {customOn && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#A9B4C2]">
              Starts between
              <input type="time" value={f.from ?? ''} onChange={(e) => set({ from: e.target.value || undefined, times: [] })} aria-label="From" className={`${selectClass} !w-auto`} />
              and
              <input type="time" value={f.to ?? ''} onChange={(e) => set({ to: e.target.value || undefined, times: [] })} aria-label="To" className={`${selectClass} !w-auto`} />
              {(f.from || f.to) && (
                <span className="text-[#E8A33D]">
                  {f.from ? formatTime12Hour(f.from) : '12:00 AM'} – {f.to ? formatTime12Hour(f.to) : '11:59 PM'}
                </span>
              )}
            </div>
          )}
        </Group>

        {/* LANGUAGE */}
        <Group label="Language" icon={Languages} hint="includes bilingual services">
          <div className="flex flex-wrap gap-2">
            {shownLangs.map(([l, n]) => (
              <Chip key={l} active={f.langs.includes(l)} count={n} onClick={() => set({ langs: toggle(f.langs, l) })}>
                {l}
              </Chip>
            ))}
            {langList.length > 8 && (
              <button type="button" onClick={() => setAllLangs((v) => !v)} className="px-2 text-xs font-semibold text-[#5AA9FF] hover:underline">
                {allLangs ? 'Fewer' : `+${langList.length - shownLangs.length} more`}
              </button>
            )}
          </div>
        </Group>

        {/* SERVICE + CONTACT */}
        <Group label="Service & contact" icon={Phone}>
          <div className="flex flex-wrap gap-2">
            {(['worship', 'cws'] as const).map((s) => (
              <Chip key={s} active={f.service === s} count={facets?.service[s]} onClick={() => set({ service: f.service === s ? undefined : s })}>
                {SERVICE_LABEL[s]}
              </Chip>
            ))}
            {(['phone', 'email'] as ContactKind[]).map((c) => (
              <Chip key={c} active={f.contact.includes(c)} onClick={() => set({ contact: toggle(f.contact, c) })}>
                Has {c === 'phone' ? 'phone number' : 'email'}
              </Chip>
            ))}
          </div>
        </Group>
      </div>

      {/* Stays in reach while scrolling the options (above the phone's bottom navigation bar). */}
      <div className="sticky bottom-[calc(4.6rem+env(safe-area-inset-bottom))] -mx-4 -mb-4 mt-5 flex items-center justify-end gap-2 rounded-b-[inherit] border-t border-white/10 bg-[#0B1426]/90 px-4 py-3 backdrop-blur md:bottom-0 sm:-mx-5 sm:-mb-5 sm:px-5">
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <button type="button" onClick={() => onChange({ ...EMPTY_FILTERS, sort: f.sort })} className="btn-glass px-3 py-2 text-xs">
            Clear all
          </button>
          <button type="button" onClick={onClose} className="btn-amber flex-1 px-4 py-2 text-xs sm:flex-none">
            {total === null ? 'Show results' : `Show ${total.toLocaleString()} ${total === 1 ? 'congregation' : 'congregations'}`}
          </button>
        </div>
      </div>
    </section>
  );
}

/** One removable chip per active filter, plus "Clear all". */
export function FilterSummary({
  filters: f,
  areas,
  countries,
  onChange,
}: {
  filters: AdvancedFilters;
  areas: FilterArea[];
  countries?: CountryStat[];
  onChange: (next: AdvancedFilters) => void;
}) {
  const regions = areas.flatMap((a) => a.regions);
  const districtName = f.district ? regions.flatMap((r) => r.districts).find((d) => d.slug === f.district)?.name ?? f.district : '';
  const chips: { key: string; label: string; clear: Partial<AdvancedFilters> }[] = [];
  if (f.country) chips.push({ key: 'country', label: countries?.find((c) => c.code === f.country)?.name ?? f.country, clear: { country: undefined } });
  if (f.region) chips.push({ key: 'region', label: regions.find((r) => r.id === f.region)?.name ?? f.region, clear: { region: undefined, district: undefined } });
  if (f.district) chips.push({ key: 'district', label: districtName, clear: { district: undefined } });
  if (f.near) chips.push({ key: 'near', label: `Within ${f.near} km`, clear: { near: undefined } });
  if (f.soon) chips.push({ key: 'soon', label: SOON_WINDOWS.find((w) => w.id === f.soon)!.label, clear: { soon: undefined } });
  if (f.days.length) chips.push({ key: 'day', label: f.days.map((d) => DAY_SHORT[d]).join(', '), clear: { days: [] } });
  if (f.from || f.to)
    chips.push({ key: 'time', label: `${f.from ? formatTime12Hour(f.from) : '12:00 AM'} – ${f.to ? formatTime12Hour(f.to) : '11:59 PM'}`, clear: { from: undefined, to: undefined } });
  else if (f.times.length)
    chips.push({ key: 'time', label: f.times.map((t) => TIME_BUCKETS.find((b) => b.id === t)!.label).join(', '), clear: { times: [] } });
  if (f.langs.length) chips.push({ key: 'lang', label: f.langs.join(', '), clear: { langs: [] } });
  if (f.service) chips.push({ key: 'service', label: SERVICE_LABEL[f.service], clear: { service: undefined } });
  if (f.tz) chips.push({ key: 'tz', label: f.tz === 'ph' ? 'Philippine time' : `My time (${zoneCity(myTimeZone())})`, clear: { tz: undefined } });
  if (f.contact.length) chips.push({ key: 'contact', label: f.contact.map((c) => (c === 'phone' ? 'Has phone' : 'Has email')).join(', '), clear: { contact: [] } });
  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onChange({ ...f, ...c.clear })}
          className="flex items-center gap-1.5 rounded-full border border-[#E8A33D]/40 bg-[#E8A33D]/10 px-3 py-1 text-xs font-semibold text-[#E8A33D] hover:bg-[#E8A33D]/20"
          aria-label={`Remove filter: ${c.label}`}
        >
          {c.label}
          <X size={12} />
        </button>
      ))}
      <button type="button" onClick={() => onChange({ ...EMPTY_FILTERS, sort: f.sort })} className="px-1 text-xs font-semibold text-[#5AA9FF] hover:underline">
        Clear all
      </button>
    </div>
  );
}
