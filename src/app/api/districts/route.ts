import { NextResponse } from 'next/server';
import { kapilyaStore } from '@/lib/store';

export async function GET() {
  try {
    const districts = kapilyaStore.getDistricts();
    return NextResponse.json({ districts });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
