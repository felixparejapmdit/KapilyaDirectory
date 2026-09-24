import { NextRequest, NextResponse } from 'next/server';
import { kapilyaStore } from '@/lib/store';

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const ok = kapilyaStore.restoreSnapshot(id);

    if (!ok) {
      return NextResponse.json(
        { error: 'Snapshot not found or restore failed' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Snapshot ${id} successfully restored.`,
      totals: kapilyaStore.getTotals(),
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
