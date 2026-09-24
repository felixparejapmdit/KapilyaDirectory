import { NextRequest, NextResponse } from 'next/server';
import { kapilyaStore } from '@/lib/store';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const locale = kapilyaStore.getLocaleById(id);

    if (!locale) {
      return NextResponse.json({ error: 'Locale not found' }, { status: 404 });
    }

    return NextResponse.json({ locale });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
