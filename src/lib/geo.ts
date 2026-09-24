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

/** Turn-by-turn handoff: Apple Maps on iPhone/iPad, Google Maps elsewhere. */
export function directionsUrl(lat: number, lng: number, label: string): string {
  const isApple = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);
  if (isApple) return `https://maps.apple.com/?daddr=${lat},${lng}&q=${encodeURIComponent(label)}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
