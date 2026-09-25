import { NextResponse } from 'next/server';
import { kapilyaStore } from '@/lib/store';
import type { LocaleKind } from '@/lib/types';

const KIND_INDEX: Record<LocaleKind, 0 | 1 | 2> = { local_congregation: 0, extension: 1, group_worship_service: 2 };
type Counts = [number, number, number]; // local, extension, GWS
type BBox = [number, number, number, number]; // south, west, north, east

const round = (n: number) => Math.round(n * 1e5) / 1e5;

/**
 * Everything the Districts map needs in one compact payload: regions and districts with
 * Local/Ext/GWS counts and bounds, and every congregation as [lat, lng, kind, districtIndex, name, slug].
 */
export async function GET() {
  try {
    const regions = kapilyaStore.getRegions();
    const districts = kapilyaStore.getDistricts();
    const locales = kapilyaStore.getRawData().locales;
    const districtIndex = new Map(districts.map((d, i) => [d.id, i]));

    const dCounts: Counts[] = districts.map(() => [0, 0, 0]);
    const dBox: (BBox | null)[] = districts.map(() => null);
    const dSum: [number, number, number][] = districts.map(() => [0, 0, 0]); // lat, lng, n
    const points: [number, number, number, number, string, string][] = [];

    for (const l of locales) {
      const di = districtIndex.get(l.district_id);
      if (di === undefined || (!l.latitude && !l.longitude)) continue;
      const k = KIND_INDEX[l.kind];
      dCounts[di][k]++;
      const b = dBox[di];
      dBox[di] = b
        ? [Math.min(b[0], l.latitude), Math.min(b[1], l.longitude), Math.max(b[2], l.latitude), Math.max(b[3], l.longitude)]
        : [l.latitude, l.longitude, l.latitude, l.longitude];
      dSum[di][0] += l.latitude;
      dSum[di][1] += l.longitude;
      dSum[di][2]++;
      points.push([round(l.latitude), round(l.longitude), k, di, l.name, l.slug]);
    }

    const regionIndex = new Map(regions.map((r, i) => [r.id, i]));
    const rCounts: Counts[] = regions.map(() => [0, 0, 0]);
    const rBox: (BBox | null)[] = regions.map(() => null);
    const rDistricts: number[] = regions.map(() => 0);
    districts.forEach((d, di) => {
      const ri = regionIndex.get(d.region_id);
      if (ri === undefined) return;
      rDistricts[ri]++;
      for (let k = 0; k < 3; k++) rCounts[ri][k] += dCounts[di][k];
      const b = dBox[di];
      const r = rBox[ri];
      if (b) rBox[ri] = r ? [Math.min(r[0], b[0]), Math.min(r[1], b[1]), Math.max(r[2], b[2]), Math.max(r[3], b[3])] : [...b];
    });

    return NextResponse.json(
      {
        regions: regions.map((r, ri) => ({
          id: r.id,
          name: r.name,
          worldArea: r.world_area,
          counts: rCounts[ri],
          districtCount: rDistricts[ri],
          bbox: rBox[ri],
        })),
        districts: districts.map((d, di) => ({
          id: d.id,
          slug: d.slug,
          name: d.name,
          regionId: d.region_id,
          counts: dCounts[di],
          center: dSum[di][2] ? [round(dSum[di][0] / dSum[di][2]), round(dSum[di][1] / dSum[di][2])] : null,
          bbox: dBox[di],
        })),
        points,
      },
      { headers: { 'Cache-Control': 'public, max-age=600, s-maxage=3600, stale-while-revalidate=86400' } }
    );
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
