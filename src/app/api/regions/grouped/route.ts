import { NextResponse } from 'next/server';
import { kapilyaStore } from '@/lib/store';

export async function GET() {
  try {
    const grouped = kapilyaStore.getGroupedRegions();
    return NextResponse.json({ grouped });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
