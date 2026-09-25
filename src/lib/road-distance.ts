/**
 * Road (driving) distance and time from an origin to many destinations, so the distance the app
 * shows matches the route the "Get directions" link opens.
 *
 * Provider: Google Distance Matrix when GOOGLE_MAPS_API_KEY is set (same routing engine as the
 * Google Maps link, so the numbers match its default driving route); otherwise the public OSRM
 * router (OpenStreetMap roads), which closely tracks it. Results are cached; when routing is
 * unavailable, callers fall back to straight-line distance.
 *
 * Server-only. Imports carry .ts extensions so the Node-run Telegram bot can use it too.
 */
import { haversineKm } from './geo.ts';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RoadDistance {
  km: number;
  minutes: number;
  source: 'google' | 'osrm';
}

const OSRM_URL = process.env.OSRM_URL || 'https://router.project-osrm.org';
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY || '';
const TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const CACHE_MAX = 50_000;

// Keyed by rounded coordinates (~1 m), shared across requests in this server process.
const cache = new Map<string, { value: RoadDistance | null; at: number }>();
const key = (o: LatLng, d: LatLng) => `${o.lat.toFixed(5)},${o.lng.toFixed(5)}>${d.lat.toFixed(5)},${d.lng.toFixed(5)}`;

function remember(k: string, value: RoadDistance | null) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(k, { value, at: Date.now() });
}

async function osrmBatch(origin: LatLng, dests: LatLng[]): Promise<(RoadDistance | null)[]> {
  const coords = [origin, ...dests].map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
  const res = await fetch(`${OSRM_URL}/table/v1/driving/${coords}?sources=0&annotations=distance,duration`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`OSRM ${res.status}`);
  const j = (await res.json()) as { code: string; distances?: (number | null)[][]; durations?: (number | null)[][] };
  if (j.code !== 'Ok' || !j.distances) throw new Error(`OSRM ${j.code}`);
  return dests.map((_, i) => {
    const m = j.distances![0][i + 1];
    const s = j.durations?.[0][i + 1];
    return m == null ? null : { km: m / 1000, minutes: Math.max(1, Math.round((s ?? 0) / 60)), source: 'osrm' as const };
  });
}

async function googleBatch(origin: LatLng, dests: LatLng[]): Promise<(RoadDistance | null)[]> {
  const params = new URLSearchParams({
    origins: `${origin.lat},${origin.lng}`,
    destinations: dests.map((d) => `${d.lat},${d.lng}`).join('|'),
    mode: 'driving',
    key: GOOGLE_KEY,
  });
  const res = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?${params}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const j = (await res.json()) as {
    status: string;
    rows?: { elements: { status: string; distance?: { value: number }; duration?: { value: number } }[] }[];
  };
  if (j.status !== 'OK' || !j.rows) throw new Error(`Google Distance Matrix ${j.status}`);
  return j.rows[0].elements.map((e) =>
    e.status === 'OK' && e.distance
      ? { km: e.distance.value / 1000, minutes: Math.max(1, Math.round((e.duration?.value ?? 0) / 60)), source: 'google' as const }
      : null
  );
}

/**
 * Road distances from `origin` to each destination (same order). Entries are null when no route
 * could be computed (unreachable, or the routing service failed).
 */
export async function roadDistances(origin: LatLng, dests: LatLng[]): Promise<(RoadDistance | null)[]> {
  const out: (RoadDistance | null)[] = new Array(dests.length).fill(null);
  const missing: number[] = [];
  const now = Date.now();
  dests.forEach((d, i) => {
    // Same spot: no routing needed.
    if (haversineKm(origin.lat, origin.lng, d.lat, d.lng) < 0.03) {
      out[i] = { km: 0, minutes: 0, source: GOOGLE_KEY ? 'google' : 'osrm' };
      return;
    }
    const hit = cache.get(key(origin, d));
    if (hit && now - hit.at < CACHE_TTL_MS) out[i] = hit.value;
    else missing.push(i);
  });

  const batchSize = GOOGLE_KEY ? 25 : 90;
  for (let b = 0; b < missing.length; b += batchSize) {
    const idx = missing.slice(b, b + batchSize);
    try {
      const results = await (GOOGLE_KEY ? googleBatch : osrmBatch)(origin, idx.map((i) => dests[i]));
      idx.forEach((i, n) => {
        out[i] = results[n];
        remember(key(origin, dests[i]), results[n]);
      });
    } catch (err) {
      // Leave these null (callers show straight-line); don't cache failures.
      console.warn('[road-distance]', (err as Error).message);
    }
  }
  return out;
}

/** Google Maps directions from the same origin the distance was measured from, driving mode. */
export function googleDirectionsUrl(dest: LatLng, origin?: LatLng | null): string {
  const params = new URLSearchParams({ api: '1', destination: `${dest.lat},${dest.lng}`, travelmode: 'driving' });
  if (origin) params.set('origin', `${origin.lat},${origin.lng}`);
  return `https://www.google.com/maps/dir/?${params}`;
}
