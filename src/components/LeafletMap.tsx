'use client';

import React, { useEffect, useRef } from 'react';
import type * as Leaflet from 'leaflet';
import { Locale } from '@/lib/types';
import 'leaflet/dist/leaflet.css';

interface LeafletMapProps {
  locales: Locale[];
  selectedLocaleId?: string | null;
  onSelectLocale?: (locale: Locale) => void;
  /** The search point (user location); drawn as a blue dot and included when fitting the view. */
  origin?: { lat: number; lng: number } | null;
  className?: string;
}

const pinSvg = (active: boolean) =>
  active
    ? `<svg width="38" height="46" viewBox="0 0 38 46" aria-hidden="true"><path d="M19 1C9.1 1 1 8.8 1 18.4 1 31 19 45 19 45s18-14 18-26.6C37 8.8 28.9 1 19 1Z" fill="#3F8F5F" stroke="#fff" stroke-width="2.5"/><circle cx="19" cy="18" r="6.5" fill="#fff"/></svg>`
    : `<svg width="28" height="34" viewBox="0 0 28 34" aria-hidden="true"><path d="M14 1C6.8 1 1 6.6 1 13.6 1 22.8 14 33 14 33s13-10.2 13-19.4C27 6.6 21.2 1 14 1Z" fill="#16233E" stroke="#E8A33D" stroke-width="2"/><circle cx="14" cy="13.5" r="4.5" fill="#E8A33D"/></svg>`;

const hasCoords = (l: Locale) => Number.isFinite(l.latitude) && Number.isFinite(l.longitude) && !(l.latitude === 0 && l.longitude === 0);

export function LeafletMap({ locales, selectedLocaleId, onSelectLocale, origin, className = '' }: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [L, setL] = React.useState<typeof Leaflet | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const markersRef = useRef(new Map<string, Leaflet.Marker>());
  const originRef = useRef<Leaflet.CircleMarker | null>(null);
  const iconsRef = useRef<{ normal: Leaflet.DivIcon; active: Leaflet.DivIcon } | null>(null);
  const onSelectRef = useRef(onSelectLocale);
  useEffect(() => {
    onSelectRef.current = onSelectLocale;
  }, [onSelectLocale]);

  // Load Leaflet on the client and create the map once.
  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    const markers = markersRef.current;
    import('leaflet').then((mod) => {
      const leaflet = (mod as unknown as { default?: typeof Leaflet }).default ?? (mod as unknown as typeof Leaflet);
      if (cancelled || !containerRef.current || mapRef.current) return;
      const map = leaflet.map(containerRef.current, {
        center: origin ? [origin.lat, origin.lng] : [14.5995, 120.9842],
        zoom: 12,
        zoomControl: false,
      });
      leaflet.control.zoom({ position: 'topright' }).addTo(map);
      leaflet
        .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        })
        .addTo(map);
      iconsRef.current = {
        normal: leaflet.divIcon({ className: 'kd-pin', html: pinSvg(false), iconSize: [28, 34], iconAnchor: [14, 33] }),
        active: leaflet.divIcon({ className: 'kd-pin', html: pinSvg(true), iconSize: [38, 46], iconAnchor: [19, 45] }),
      };
      // Keep tiles correct when the container resizes (layout shifts, mobile collapse).
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
      markers.clear();
      originRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild markers and fit the view whenever the result set (or origin) changes, not on selection.
  const resultKey = `${origin?.lat},${origin?.lng}|${locales.map((l) => l.id).join(',')}`;
  useEffect(() => {
    const map = mapRef.current;
    const icons = iconsRef.current;
    if (!L || !map || !icons) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();
    originRef.current?.remove();
    originRef.current = null;

    const points: Leaflet.LatLngExpression[] = [];
    for (const loc of locales) {
      if (!hasCoords(loc)) continue;
      const marker = L.marker([loc.latitude, loc.longitude], {
        icon: icons.normal,
        title: loc.name,
        alt: loc.name,
        keyboard: true,
      })
        .on('click', () => onSelectRef.current?.(loc))
        .addTo(map);
      markersRef.current.set(loc.id, marker);
      points.push([loc.latitude, loc.longitude]);
    }

    if (origin) {
      originRef.current = L.circleMarker([origin.lat, origin.lng], {
        radius: 8,
        color: '#fff',
        weight: 3,
        fillColor: '#3A6EA5',
        fillOpacity: 1,
      }).addTo(map);
      points.push([origin.lat, origin.lng]);
    }

    if (points.length === 1) map.setView(points[0], 14);
    else if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L, resultKey]);

  // Highlight the selected pin and pan to it.
  useEffect(() => {
    const map = mapRef.current;
    const icons = iconsRef.current;
    if (!map || !icons) return;
    markersRef.current.forEach((marker, id) => {
      const active = id === selectedLocaleId;
      marker.setIcon(active ? icons.active : icons.normal);
      marker.setZIndexOffset(active ? 1000 : 0);
    });
    const selected = locales.find((l) => l.id === selectedLocaleId);
    if (selected && hasCoords(selected)) map.panTo([selected.latitude, selected.longitude], { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L, selectedLocaleId, resultKey]);

  return <div ref={containerRef} className={`w-full h-full ${className}`} />;
}
