'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type * as Leaflet from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ChevronRight, Globe2, Layers, MapPin, Search } from 'lucide-react';
import type { LocaleKind } from '@/lib/types';

type KindFilter = 'all' | LocaleKind;
type Counts = [number, number, number];
type BBox = [number, number, number, number];

interface MapRegion {
  id: string;
  name: string;
  worldArea: string;
  counts: Counts;
  districtCount: number;
  bbox: BBox | null;
}
interface MapDistrict {
  id: string;
  slug: string;
  name: string;
  regionId: string;
  counts: Counts;
  center: [number, number] | null;
  bbox: BBox | null;
}
type Point = [number, number, 0 | 1 | 2, number, string, string];
interface MapData {
  regions: MapRegion[];
  districts: MapDistrict[];
  points: Point[];
}

type Scope = { type: 'world' } | { type: 'region'; id: string } | { type: 'district'; id: string };

const KIND_ORDER: LocaleKind[] = ['local_congregation', 'extension', 'group_worship_service'];
const KIND_COLORS = ['#5AA9FF', '#E8A33D', '#4ADE80'];
const KIND_SHORT = ['Local', 'Ext', 'GWS'];
const KIND_LONG = ['Local congregations', 'Extensions', 'GWS'];
const total = (c: Counts) => c[0] + c[1] + c[2];
const shown = (c: Counts, kind: KindFilter) => (kind === 'all' ? total(c) : c[KIND_ORDER.indexOf(kind)]);

/** Counts up to `value` when it changes (ease-out). */
function useCountUp(value: number, ms = 700) {
  const [display, setDisplay] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(a + (value - a) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return display;
}

function Stat({ label, value, color, dim }: { label: string; value: number; color?: string; dim?: boolean }) {
  const n = useCountUp(value);
  return (
    <div className={`kd-map-stat ${dim ? 'opacity-40' : ''}`}>
      <span className="kd-map-stat-label">
        {color && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
        {label}
      </span>
      <span className="kd-map-stat-value">{n.toLocaleString()}</span>
    </div>
  );
}

/** Proportion bar of Local / Ext / GWS. */
function KindBar({ counts }: { counts: Counts }) {
  const t = Math.max(1, total(counts));
  return (
    <span className="kd-map-bar" aria-hidden>
      {counts.map((c, i) => (
        <span key={i} style={{ width: `${(c / t) * 100}%`, background: KIND_COLORS[i] }} />
      ))}
    </span>
  );
}

/**
 * Worldwide map of every congregation with Local / Extension / GWS counts per region and district.
 * Selecting a region or district (list, breadcrumb, or a district bubble) flies the map there.
 */
export function DirectoryMapView({ kind }: { kind: KindFilter }) {
  const [data, setData] = useState<MapData | null>(null);
  const [error, setError] = useState(false);
  const [scope, setScope] = useState<Scope>({ type: 'world' });
  const [filter, setFilter] = useState('');
  const [hoverDistrict, setHoverDistrict] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/map/directory')
      .then((r) => r.json())
      .then((d) => alive && setData(d))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, []);

  const byRegion = useMemo(() => new Map(data?.regions.map((r) => [r.id, r]) ?? []), [data]);
  const byDistrict = useMemo(() => new Map(data?.districts.map((d) => [d.id, d]) ?? []), [data]);
  const region = scope.type === 'region' ? byRegion.get(scope.id) : scope.type === 'district' ? byRegion.get(byDistrict.get(scope.id)?.regionId ?? '') : undefined;
  const district = scope.type === 'district' ? byDistrict.get(scope.id) : undefined;

  const scopeCounts: Counts = useMemo(() => {
    if (!data) return [0, 0, 0];
    if (district) return district.counts;
    if (region) return region.counts;
    return data.regions.reduce<Counts>((a, r) => [a[0] + r.counts[0], a[1] + r.counts[1], a[2] + r.counts[2]], [0, 0, 0]);
  }, [data, region, district]);

  const districtIdx = useMemo(() => (district && data ? data.districts.indexOf(district) : -1), [district, data]);
  const districtPoints = useMemo(
    () =>
      data && districtIdx >= 0
        ? data.points
            .filter((p) => p[3] === districtIdx && (kind === 'all' || KIND_ORDER[p[2]] === kind))
            .sort((a, b) => a[4].localeCompare(b[4]))
        : [],
    [data, districtIdx, kind]
  );

  // ---------------- Leaflet ----------------
  const containerRef = useRef<HTMLDivElement>(null);
  const [L, setL] = useState<typeof Leaflet | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const pointsLayer = useRef<Leaflet.LayerGroup | null>(null);
  const bubbleLayer = useRef<Leaflet.LayerGroup | null>(null);
  const pointMarkers = useRef(new Map<string, Leaflet.CircleMarker>());
  const bubbleMarkers = useRef(new Map<string, Leaflet.CircleMarker>());
  const canvas = useRef<Leaflet.Canvas | null>(null);
  const [zoom, setZoom] = useState(2);

  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    import('leaflet').then((mod) => {
      const leaflet = (mod as unknown as { default?: typeof Leaflet }).default ?? (mod as unknown as typeof Leaflet);
      if (cancelled || !containerRef.current || mapRef.current) return;
      const map = leaflet.map(containerRef.current, {
        center: [18, 20],
        zoom: 2,
        minZoom: 2,
        zoomControl: false,
        worldCopyJump: true,
        zoomSnap: 0.25,
      });
      leaflet.control.zoom({ position: 'topright' }).addTo(map);
      leaflet
        .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        })
        .addTo(map);
      canvas.current = leaflet.canvas({ padding: 0.4 });
      pointsLayer.current = leaflet.layerGroup().addTo(map);
      bubbleLayer.current = leaflet.layerGroup().addTo(map);
      map.on('zoomend', () => setZoom(map.getZoom()));
      observer = new ResizeObserver(() => map.invalidateSize());
      observer.observe(containerRef.current);
      mapRef.current = map;
      setL(leaflet);
    });
    return () => {
      cancelled = true;
      observer?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Congregation dots (canvas): coloured by kind; outside the selected scope they fade back.
  useEffect(() => {
    const layer = pointsLayer.current;
    if (!L || !data || !layer || !canvas.current) return;
    layer.clearLayers();
    pointMarkers.current.clear();
    const inScope = (p: Point) =>
      scope.type === 'world' ||
      (scope.type === 'district' ? data.districts[p[3]].id === scope.id : data.districts[p[3]].regionId === scope.id);
    for (const p of data.points) {
      if (kind !== 'all' && KIND_ORDER[p[2]] !== kind) continue;
      const focus = inScope(p);
      const m = L.circleMarker([p[0], p[1]], {
        renderer: canvas.current,
        radius: 3,
        stroke: focus && scope.type === 'district',
        color: '#0B1426',
        weight: 1,
        fillColor: KIND_COLORS[p[2]],
        fillOpacity: focus ? 0.9 : scope.type === 'world' ? 0.18 : 0.06,
        interactive: focus,
      });
      if (focus) {
        m.bindPopup(
          `<div class="kd-map-popup"><b>${p[4].replace(/</g, '&lt;')}</b><span style="color:${KIND_COLORS[p[2]]}">${KIND_LONG[p[2]].replace(/s$/, '')}</span>` +
            `<span>${data.districts[p[3]].name.replace(/</g, '&lt;')}</span>` +
            `<a href="/locales/loc-${p[5]}">View details →</a>` +
            `<a href="https://www.google.com/maps/dir/?api=1&destination=${p[0]},${p[1]}&travelmode=driving" target="_blank" rel="noopener">Directions ↗</a></div>`,
          { closeButton: false }
        );
      }
      m.addTo(layer);
      pointMarkers.current.set(p[5], m);
    }
  }, [L, data, kind, scope]);

  // Dot size follows the zoom level.
  useEffect(() => {
    const r = zoom < 4 ? 1.8 : zoom < 7 ? 2.8 : zoom < 10 ? 4.5 : 6.5;
    pointMarkers.current.forEach((m) => m.setRadius(r));
  }, [zoom, L, data, kind, scope]);

  // District bubbles (sized by count) at world/region level, growing in when the scope changes.
  useEffect(() => {
    const layer = bubbleLayer.current;
    const map = mapRef.current;
    if (!L || !data || !layer || !map) return;
    layer.clearLayers();
    bubbleMarkers.current.clear();
    // Bubbles summarise districts: always at region level, and at world level until zoomed in close.
    if (scope.type === 'district' || (scope.type === 'world' && zoom >= 8)) return;
    const list = data.districts.filter((d) => d.center && (scope.type === 'world' || d.regionId === scope.id));
    const max = Math.max(1, ...list.map((d) => shown(d.counts, kind)));
    const anims: (() => boolean)[] = [];
    for (const d of list) {
      const n = shown(d.counts, kind);
      if (!n) continue;
      const target = (scope.type === 'world' ? 5 : 8) + Math.sqrt(n / max) * (scope.type === 'world' ? 15 : 28);
      const bubble = L.circleMarker(d.center!, {
        radius: 1,
        color: '#E8A33D',
        weight: 1.5,
        fillColor: '#E8A33D',
        fillOpacity: 0.28,
        className: 'kd-map-bubble',
      })
        .bindTooltip(
          `<b>${d.name.replace(/</g, '&lt;')}</b><br/>${n.toLocaleString()} ${kind === 'all' ? 'locales' : KIND_LONG[KIND_ORDER.indexOf(kind)].toLowerCase()}` +
            `<br/><span class="kd-map-tip-counts">Local ${d.counts[0]} · Ext ${d.counts[1]} · GWS ${d.counts[2]}</span>`,
          { direction: 'top', className: 'kd-map-tooltip', offset: [0, -4] }
        )
        .on('click', () => setScope({ type: 'district', id: d.id }))
        .on('mouseover', () => setHoverDistrict(d.id))
        .on('mouseout', () => setHoverDistrict(null))
        .addTo(layer);
      bubbleMarkers.current.set(d.id, bubble);
      const start = performance.now();
      anims.push(() => {
        const p = Math.min(1, (performance.now() - start) / 500);
        bubble.setRadius(1 + (target - 1) * (1 - Math.pow(1 - p, 3)));
        return p < 1;
      });
    }
    let raf = 0;
    const tick = () => {
      const running = anims.map((a) => a()).some(Boolean);
      if (running) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [L, data, scope, kind, zoom]);

  // Highlight the district hovered in the list.
  useEffect(() => {
    bubbleMarkers.current.forEach((m, id) =>
      m.setStyle(id === hoverDistrict ? { fillOpacity: 0.6, weight: 3, color: '#FFFFFF' } : { fillOpacity: 0.28, weight: 1.5, color: '#E8A33D' })
    );
  }, [hoverDistrict]);

  // Fly to the selected scope.
  useEffect(() => {
    const map = mapRef.current;
    if (!L || !map || !data) return;
    const bbox = district?.bbox ?? region?.bbox ?? null;
    if (!bbox) {
      map.flyTo([18, 20], 2, { duration: 1.1 });
      return;
    }
    const [s, w, n, e] = bbox;
    map.flyToBounds(
      [
        [s, w],
        [n, e],
      ],
      { padding: [40, 40], maxZoom: district ? 13 : 11, duration: 1.2 }
    );
  }, [L, data, region, district]);

  const focusPoint = (p: Point) => {
    const map = mapRef.current;
    const m = pointMarkers.current.get(p[5]);
    if (!map || !m) return;
    map.flyTo([p[0], p[1]], Math.max(map.getZoom(), 15), { duration: 0.9 });
    window.setTimeout(() => m.openPopup(), 950);
  };

  // ---------------- Panel ----------------
  const q = filter.trim().toLowerCase();
  const worldGroups = useMemo(() => {
    if (!data) return [];
    const intl = data.regions.filter((r) => r.worldArea !== 'philippines');
    const ph = data.regions.filter((r) => r.worldArea === 'philippines');
    return [
      { title: 'Worldwide', items: intl },
      { title: 'Philippines', items: ph },
    ];
  }, [data]);
  const regionDistricts = useMemo(
    () =>
      data && region && scope.type === 'region'
        ? data.districts.filter((d) => d.regionId === region.id).sort((a, b) => total(b.counts) - total(a.counts))
        : [],
    [data, region, scope.type]
  );
  const scopeKey = scope.type === 'world' ? 'world' : `${scope.type}:${scope.id}`;

  if (error) {
    return <div className="glass-card p-10 text-center text-sm text-[#A9B4C2]">The map couldn’t be loaded. Please try again.</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(20rem,24rem)_1fr]">
      {/* Map */}
      <div className="relative h-[55dvh] min-h-[360px] lg:order-last lg:h-[calc(100dvh-14rem)] lg:min-h-[560px] overflow-hidden rounded-[1.5rem] border border-white/15 shadow-2xl">
        <div ref={containerRef} className="h-full w-full" />
        {!data && <div className="absolute inset-0 grid place-items-center bg-[#0B1426]/60 text-sm text-[#A9B4C2]">Loading 8,000+ congregations…</div>}
        <div className="kd-map-legend">
          {KIND_SHORT.map((k, i) => (
            <span key={k} className={kind !== 'all' && KIND_ORDER[i] !== kind ? 'opacity-35' : ''}>
              <i style={{ background: KIND_COLORS[i] }} /> {k}
            </span>
          ))}
          {(scope.type === 'region' || (scope.type === 'world' && zoom < 8)) && (
            <span>
              <i className="kd-map-legend-bubble" /> District size
            </span>
          )}
        </div>
      </div>

      {/* Panel */}
      <aside className="glass-panel flex max-h-none flex-col gap-4 p-4 lg:max-h-[calc(100dvh-14rem)] lg:min-h-[560px]">
        {/* Breadcrumb */}
        <nav aria-label="Map scope" className="flex flex-wrap items-center gap-1 text-sm font-semibold">
          <button type="button" onClick={() => setScope({ type: 'world' })} className={`kd-map-crumb ${scope.type === 'world' ? 'is-current' : ''}`}>
            <Globe2 size={14} /> World
          </button>
          {region && (
            <>
              <ChevronRight size={14} className="text-[#A9B4C2]" />
              <button type="button" onClick={() => setScope({ type: 'region', id: region.id })} className={`kd-map-crumb ${scope.type === 'region' ? 'is-current' : ''}`}>
                {region.name}
              </button>
            </>
          )}
          {district && (
            <>
              <ChevronRight size={14} className="text-[#A9B4C2]" />
              <span className="kd-map-crumb is-current">{district.name}</span>
            </>
          )}
        </nav>

        {/* Counts */}
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Total" value={total(scopeCounts)} />
          {scopeCounts.map((c, i) => (
            <Stat key={i} label={KIND_LONG[i]} value={c} color={KIND_COLORS[i]} dim={kind !== 'all' && KIND_ORDER[i] !== kind} />
          ))}
        </div>
        <KindBar counts={scopeCounts} />

        {scope.type !== 'district' && (
          <label className="relative block">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A9B4C2]" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={scope.type === 'world' ? 'Filter regions…' : 'Filter districts…'}
              className="w-full rounded-xl border border-white/15 bg-white/5 py-2 pl-8 pr-3 text-sm text-white placeholder-[#A9B4C2]/60 focus:border-[#E8A33D] focus:outline-none"
            />
          </label>
        )}

        {/* Drill-down list */}
        <div key={scopeKey} className="kd-map-list min-h-0 flex-1 overflow-y-auto pr-1">
          {scope.type === 'world' &&
            worldGroups.map((g) => {
              const items = g.items.filter((r) => !q || r.name.toLowerCase().includes(q));
              if (!items.length) return null;
              return (
                <div key={g.title} className="mb-3">
                  <p className="kd-map-list-heading">{g.title}</p>
                  {items.map((r, i) => (
                    <button key={r.id} type="button" onClick={() => { setFilter(''); setScope({ type: 'region', id: r.id }); }} className="kd-map-row" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate font-semibold">{r.name}</span>
                          <span className="font-departure text-xs text-[#E8A33D]">{shown(r.counts, kind).toLocaleString()}</span>
                        </span>
                        <KindBar counts={r.counts} />
                        <span className="font-departure text-[11px] text-[#A9B4C2]">
                          {r.districtCount} districts · L {r.counts[0]} · E {r.counts[1]} · G {r.counts[2]}
                        </span>
                      </span>
                      <ChevronRight size={16} className="shrink-0 text-[#A9B4C2]" />
                    </button>
                  ))}
                </div>
              );
            })}

          {scope.type === 'region' &&
            regionDistricts
              .filter((d) => !q || d.name.toLowerCase().includes(q))
              .map((d, i) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => { setFilter(''); setScope({ type: 'district', id: d.id }); }}
                  onMouseEnter={() => setHoverDistrict(d.id)}
                  onMouseLeave={() => setHoverDistrict(null)}
                  className={`kd-map-row ${hoverDistrict === d.id ? 'is-hover' : ''}`}
                  style={{ animationDelay: `${Math.min(i, 14) * 25}ms` }}
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold">{d.name}</span>
                      <span className="font-departure text-xs text-[#E8A33D]">{shown(d.counts, kind)}</span>
                    </span>
                    <KindBar counts={d.counts} />
                    <span className="font-departure text-[11px] text-[#A9B4C2]">
                      Local {d.counts[0]} · Ext {d.counts[1]} · GWS {d.counts[2]}
                    </span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-[#A9B4C2]" />
                </button>
              ))}

          {scope.type === 'district' && district && (
            <>
              <Link href={`/districts/${district.slug}`} className="kd-map-open-district">
                <Layers size={15} /> Open the {district.name} district page
                <ChevronRight size={15} className="ml-auto" />
              </Link>
              {districtPoints.map((p, i) => (
                <button key={p[5]} type="button" onClick={() => focusPoint(p)} className="kd-map-row" style={{ animationDelay: `${Math.min(i, 16) * 20}ms` }}>
                  <MapPin size={14} style={{ color: KIND_COLORS[p[2]] }} className="shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-left font-semibold">{p[4]}</span>
                  <span className="text-[10px] font-bold uppercase" style={{ color: KIND_COLORS[p[2]] }}>
                    {KIND_SHORT[p[2]]}
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
