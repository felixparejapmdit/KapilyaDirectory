import { NextRequest, NextResponse } from 'next/server';
import { kapilyaStore } from '@/lib/store';
import { filterLocales, parseFilters } from '@/lib/locale-filter';
import type { LocaleKind } from '@/lib/types';

const KINDS = ['all', 'local_congregation', 'extension', 'group_worship_service'] as const;

/**
 * Advanced congregation filter for the Districts page, e.g.
 * ?q=&kind=all&region=reg-ncr&day=0&time=morning&lang=English&near=10&lat=14.6&lng=121.0&sort=nearest&limit=40
 * (see src/lib/locale-filter.ts for every parameter). `slugs=1` also returns every matching slug for the map.
 */
export async function GET(request: NextRequest) {
  try {
    const p = request.nextUrl.searchParams;
    const lat = parseFloat(p.get('lat') ?? '');
    const lng = parseFloat(p.get('lng') ?? '');
    const kind = (KINDS as readonly string[]).includes(p.get('kind') ?? '') ? (p.get('kind') as 'all' | LocaleKind) : 'all';
    const result = filterLocales(kapilyaStore.getRawData(), {
      q: (p.get('q') ?? '').slice(0, 100),
      kind,
      filters: parseFilters(p),
      lat: Number.isFinite(lat) ? lat : undefined,
      lng: Number.isFinite(lng) ? lng : undefined,
      offset: Math.max(0, parseInt(p.get('offset') ?? '0', 10) || 0),
      limit: Math.min(200, Math.max(1, parseInt(p.get('limit') ?? '40', 10) || 40)),
      withSlugs: p.get('slugs') === '1',
    });
    return NextResponse.json(result);
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
