import { NextResponse } from 'next/server';
import { kapilyaStore } from '@/lib/store';

export async function GET() {
  try {
    const regions = kapilyaStore.getRegions();
    return NextResponse.json({ regions });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
