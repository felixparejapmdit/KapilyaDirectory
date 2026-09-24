import { NextRequest, NextResponse } from 'next/server';
import { kapilyaStore } from '@/lib/store';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const district = kapilyaStore.getDistrictBySlug(slug);

    if (!district) {
      return NextResponse.json({ error: 'District not found' }, { status: 404 });
    }

    return NextResponse.json({ district });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
