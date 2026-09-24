import { NextResponse } from 'next/server';
import { kapilyaStore } from '@/lib/store';

export async function GET() {
  try {
    const totals = kapilyaStore.getTotals();
    const snapshots = kapilyaStore.getSnapshots();
    return NextResponse.json({
      totals,
      dataHealth: {
        status: 'healthy',
        lastSuccessfulSync: totals.last_updated,
        activeSnapshot: totals.last_snapshot_id,
        totalSnapshots: snapshots.length,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
