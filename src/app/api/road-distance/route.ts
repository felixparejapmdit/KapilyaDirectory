import { NextRequest, NextResponse } from 'next/server';
import { roadDistances } from '@/lib/road-distance';

const MAX_DESTINATIONS = 100;

/**
 * Driving distance/time from an origin to up to 100 destinations.
 * POST { origin: {lat,lng}, destinations: [{id,lat,lng}] } -> { results: { [id]: {km, minutes, source} | null } }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const origin = body?.origin;
    const dests: { id: string; lat: number; lng: number }[] = Array.isArray(body?.destinations)
      ? body.destinations.slice(0, MAX_DESTINATIONS)
      : [];
    if (!origin || !Number.isFinite(origin.lat) || !Number.isFinite(origin.lng)) {
      return NextResponse.json({ error: 'origin {lat,lng} is required' }, { status: 400 });
    }
    const valid = dests.filter((d) => d && typeof d.id === 'string' && Number.isFinite(d.lat) && Number.isFinite(d.lng));
    const roads = await roadDistances(origin, valid);
    return NextResponse.json({ results: Object.fromEntries(valid.map((d, i) => [d.id, roads[i]])) });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
