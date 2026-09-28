import { NextResponse } from 'next/server';
import { kapilyaStore } from '@/lib/store';

/** Congregations per country/territory and continent (Local / Extension / GWS), largest first. */
export async function GET() {
  try {
    return NextResponse.json(kapilyaStore.getCountrySummary(), {
      headers: { 'Cache-Control': 'public, max-age=600, s-maxage=3600, stale-while-revalidate=86400' },
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
