/**
 * Geodesic and spatial math utilities for Near-Me search.
 * Computes exact great-circle distance between coordinates via Haversine formula.
 */

const R_KM = 6371; // Earth radius in km

/** Great-circle distance in kilometres. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  return R_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** "850 m", "3.4 km", "27 km". */
export function formatDistance(km?: number | null): string {
  if (km === undefined || km === null || Number.isNaN(km)) return '';
  if (km < 0.95) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

/**
 * Turn-by-turn handoff (Apple Maps on iPhone/iPad, Google Maps elsewhere), driving, starting from
 * `origin` when given: the same trip the app measured, so the route distance matches.
 */
export function directionsUrl(
  lat: number,
  lng: number,
  label: string,
  origin?: { lat: number; lng: number } | null
): string {
  const isApple = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);
  if (isApple) {
    const from = origin ? `&saddr=${origin.lat},${origin.lng}` : '';
    return `https://maps.apple.com/?daddr=${lat},${lng}${from}&dirflg=d&q=${encodeURIComponent(label)}`;
  }
  const params = new URLSearchParams({ api: '1', destination: `${lat},${lng}`, travelmode: 'driving' });
  if (origin) params.set('origin', `${origin.lat},${origin.lng}`);
  return `https://www.google.com/maps/dir/?${params}`;
}

export interface RoadInfo {
  km: number;
  minutes: number;
}

/**
 * Distance to show for a locale: the driving distance and time when known ("2.4 km · 4 min"),
 * otherwise the straight-line distance marked as approximate ("≈1.5 km").
 */
export function formatTravel(road: RoadInfo | null | undefined, straightKm?: number | null): string {
  if (road) return road.km < 0.03 ? 'Here' : `${formatDistance(road.km)} · ${formatMinutes(road.minutes)}`;
  const straight = formatDistance(straightKm);
  return straight ? `≈${straight}` : '';
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m ? `${h} hr ${m} min` : `${h} hr`;
}
