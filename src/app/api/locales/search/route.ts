import { NextRequest, NextResponse } from 'next/server';
import { kapilyaStore } from '@/lib/store';

/** Worldwide locale search by name, address, or district: ?q=cubao&kind=extension&limit=50 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') ?? '';
    const kind = searchParams.get('kind') || undefined;
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(200, parseInt(limitParam, 10)) : 50;

    const { total, locales } = kapilyaStore.searchLocales({ query, kind, limit });
    return NextResponse.json({ total, locales });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
