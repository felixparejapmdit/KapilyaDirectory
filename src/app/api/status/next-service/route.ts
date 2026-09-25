import { NextRequest, NextResponse } from 'next/server';
import { kapilyaStore } from '@/lib/store';
import { NEARBY_POOL, NEARBY_RADIUS_KM, formatTravel } from '@/lib/geo';
import { roadDistances } from '@/lib/road-distance';
import { estimateTravelMinutes, findReachableService, formatCountdown, formatLeaveIn } from '@/lib/next-service';
import { formatTime12Hour } from '@/lib/time';

/**
 * The soonest worship service the user can still make: among the nearby congregations (same pool as
 * Near Me), the earliest service that starts after they'd arrive, driving there from where they are.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : undefined;
    const lng = searchParams.get('lng') ? parseFloat(searchParams.get('lng')!) : undefined;

    if (lat === undefined || lng === undefined || Number.isNaN(lat) || Number.isNaN(lng)) {
      return NextResponse.json({ nextService: kapilyaStore.getNextService() });
    }

    const pool = kapilyaStore.searchNearby({ lat, lng, radiusKm: NEARBY_RADIUS_KM, limit: NEARBY_POOL });
    if (!pool.length) return NextResponse.json({ nextService: kapilyaStore.getNextService(lat, lng) });

    const roads = await roadDistances({ lat, lng }, pool.map((l) => ({ lat: l.latitude, lng: l.longitude })));
    let best: {
      i: number;
      r: NonNullable<ReturnType<typeof findReachableService>>;
    } | null = null;
    pool.forEach((l, i) => {
      const travel = roads[i]?.minutes ?? estimateTravelMinutes(l.distance_km ?? 0);
      const r = findReachableService(l.schedule, l.timezone, travel);
      if (r && (!best || r.startsInMinutes < best.r.startsInMinutes)) best = { i, r };
    });
    if (!best) return NextResponse.json({ nextService: null });

    const { i, r } = best as { i: number; r: NonNullable<ReturnType<typeof findReachableService>> };
    const locale = pool[i];
    const start = formatTime12Hour(r.item.start_time);
    return NextResponse.json({
      nextService: {
        locale,
        scheduleItem: r.item,
        startsInMinutes: r.startsInMinutes,
        statusText:
          r.startsInMinutes < 24 * 60
            ? `starts ${formatCountdown(r.startsInMinutes)} · ${formatLeaveIn(r.leaveInMinutes)}`
            : `next ${r.item.day_name} at ${start}`,
        isImminent: r.startsInMinutes <= 60,
        leaveInMinutes: r.leaveInMinutes,
        travelText: formatTravel(roads[i], locale.distance_km),
      },
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
