import { NextRequest, NextResponse } from 'next/server';
import { kapilyaStore } from '@/lib/store';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const latParam = searchParams.get('lat');
    const lngParam = searchParams.get('lng');

    const lat = latParam ? parseFloat(latParam) : 14.6644;
    const lng = lngParam ? parseFloat(lngParam) : 121.0544;

    // Search radius in kilometres.
    const radiusParam = searchParams.get('radius');
    const radiusKm = radiusParam ? parseFloat(radiusParam) : 50;

    const dayParam = searchParams.get('day');
    const day = dayParam !== null && dayParam !== '' ? parseInt(dayParam, 10) : undefined;

    const language = searchParams.get('language') || undefined;
    const kind = searchParams.get('kind') || undefined;
    const query = searchParams.get('q') || undefined;
    const startTime = searchParams.get('startTime') || undefined;
    const endTime = searchParams.get('endTime') || undefined;
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : undefined;

    const locales = kapilyaStore.searchNearby({
      lat,
      lng,
      radiusKm,
      day,
      language,
      kind,
      query,
      startTime,
      endTime,
      limit,
    });

    return NextResponse.json({
      count: locales.length,
      searchCenter: { lat, lng },
      radiusKm,
      locales,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
