import { NextRequest, NextResponse } from 'next/server';
import { kapilyaStore } from '@/lib/store';

export async function GET() {
  try {
    const snapshots = kapilyaStore.getSnapshots();
    return NextResponse.json({ snapshots });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const description = body?.description || 'Manual snapshot from admin settings';
    const snapshot = kapilyaStore.createSnapshot(description);
    return NextResponse.json({ success: true, snapshot });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
