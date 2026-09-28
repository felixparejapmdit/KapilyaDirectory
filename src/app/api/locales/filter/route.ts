import { NextRequest, NextResponse } from 'next/server';
import { kapilyaStore } from '@/lib/store';
import { filterLocales, parseFilters, PH_TIMEZONE } from '@/lib/locale-filter';
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
    const countries = kapilyaStore.getCountryIndex();
    const filters = parseFilters(p);
    // ?tz=ph matches times in Philippine time; ?tz=mine&mytz=America/Los_Angeles in the viewer's zone.
    const mytz = p.get('mytz') ?? '';
    const validZone = (z: string) => {
      try {
        return !!z && !!new Intl.DateTimeFormat('en-US', { timeZone: z });
      } catch {
        return false;
      }
    };
    const refTz = filters.tz === 'ph' ? PH_TIMEZONE : filters.tz === 'mine' && validZone(mytz) ? mytz : undefined;
    const result = filterLocales(kapilyaStore.getRawData(), {
      countryOf: (l) => countries.get(l.id),
      q: (p.get('q') ?? '').slice(0, 100),
      kind,
      filters,
      refTz,
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
