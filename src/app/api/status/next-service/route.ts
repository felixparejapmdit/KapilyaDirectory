import { NextRequest, NextResponse } from 'next/server';
import { kapilyaStore } from '@/lib/store';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : undefined;
    const lng = searchParams.get('lng') ? parseFloat(searchParams.get('lng')!) : undefined;

    const nextService = kapilyaStore.getNextService(lat, lng);
    return NextResponse.json({ nextService });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
