'use client';

import { useEffect, useMemo, useState } from 'react';
import type { RoadInfo } from './geo';

interface Target {
  id: string;
  latitude: number;
  longitude: number;
}

type Result = RoadInfo | null;

// Per-page-load cache: "originKey|localeId" -> road distance (null = no route).
const cache = new Map<string, Result>();
const originKey = (o: { lat: number; lng: number }) => `${o.lat.toFixed(5)},${o.lng.toFixed(5)}`;

/**
 * Driving distance/time from `origin` to each locale (via /api/road-distance), keyed by locale id.
 * `pending` is true while any requested distance is still loading; ids missing from `roads`
 * (or null) should fall back to straight-line distance.
 */
export function useRoadDistances(origin: { lat: number; lng: number } | null | undefined, locales: Target[]) {
  const oKey = origin ? originKey(origin) : '';
  const idsKey = locales.map((l) => l.id).join(',');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!origin || !locales.length) return;
    const missing = locales.filter((l) => !cache.has(`${oKey}|${l.id}`));
    if (!missing.length) return;
    const ctrl = new AbortController();
    fetch('/api/road-distance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        origin,
        destinations: missing.slice(0, 100).map((l) => ({ id: l.id, lat: l.latitude, lng: l.longitude })),
      }),
    })
      .then((r) => r.json())
      .then((d: { results?: Record<string, Result> }) => d.results ?? {})
      .catch((err: { name?: string }): Record<string, Result> | null => (err?.name === 'AbortError' ? null : {}))
      .then((results) => {
        if (!results) return; // superseded by a newer request
        // Unknown/failed entries become null: shown as straight-line instead of loading forever.
        for (const l of missing.slice(0, 100)) cache.set(`${oKey}|${l.id}`, results[l.id] ?? null);
        setVersion((v) => v + 1);
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oKey, idsKey]);

  const roads = useMemo(() => {
    const out: Record<string, Result> = {};
    for (const l of locales) {
      const hit = cache.get(`${oKey}|${l.id}`);
      if (hit !== undefined) out[l.id] = hit;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oKey, idsKey, version]);

  const pending = !!origin && locales.some((l) => roads[l.id] === undefined);
  return { roads, pending };
}
